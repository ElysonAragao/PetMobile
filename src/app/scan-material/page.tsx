"use client";

import * as React from 'react';
import jsQR from 'jsqr';
import { Camera, Loader2, ArrowLeft, RefreshCw, PackageOpen, Box } from 'lucide-react';
import { PageTitle } from '@/components/layout/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Material } from '@/lib/types';

export default function ScanMaterialPage() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [videoDevices, setVideoDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string>('');
  const [scannedMaterial, setScannedMaterial] = React.useState<Material | null>(null);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const switchingRef = React.useRef(false);
  const scanIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const isScanActiveRef = React.useRef(true);
  const [mounted, setMounted] = React.useState(false);

  const refreshDevices = React.useCallback(async () => {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach(track => track.stop());
      const foundDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = foundDevices.filter(device => device.kind === 'videoinput');
      setVideoDevices(videoInputs);

      const savedDeviceId = localStorage.getItem('petmobile_preferred_camera');
      const savedDeviceExists = videoInputs.some(d => d.deviceId === savedDeviceId);

      if (savedDeviceExists && savedDeviceId) {
        setSelectedDeviceId(savedDeviceId);
      } else if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (err) {
      console.error("Erro ao listar dispositivos:", err);
    }
  }, [selectedDeviceId]);

  React.useEffect(() => {
    setMounted(true);
    refreshDevices();
  }, [refreshDevices]);

  const stopScan = React.useCallback(() => {
    isScanActiveRef.current = false;
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const processScannedData = React.useCallback(async (scannedId: string) => {
    stopScan();
    setIsProcessing(true);

    try {
      if (scannedId.startsWith('MAT:')) {
        const materialId = scannedId.replace('MAT:', '');
        toast({ title: "Material Identificado!", description: "Buscando dados no estoque..." });
        
        const { data, error } = await supabase
          .from('pet_materiais')
          .select('*')
          .eq('id', materialId)
          .single();
          
        if (error || !data) throw new Error("Material não encontrado no banco de dados.");
        
        setScannedMaterial({
          id: data.id,
          codigo: data.codigo,
          idMaterial: data.id_material,
          descricao: data.descricao,
          categoria: data.categoria,
          unidade: data.unidade,
          estoque: data.estoque,
          precoUnitario: data.preco_unitario
        } as Material);
      } else {
        throw new Error("QR Code inválido para Material.");
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na Leitura", description: e.message });
      isScanActiveRef.current = true;
      startCameraStream(selectedDeviceId);
    } finally {
      setIsProcessing(false);
    }
  }, [stopScan, supabase, toast]);

  const tick = React.useCallback(() => {
    if (!isScanActiveRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        if (code && code.data) processScannedData(code.data);
      }
    }
  }, [processScannedData]);

  const startCameraStream = React.useCallback(async (deviceId: string) => {
    if (!deviceId || switchingRef.current) return;
    switchingRef.current = true;
    
    stopScan();
    await new Promise(resolve => setTimeout(resolve, 500));
    isScanActiveRef.current = true;

    let retryCount = 0;
    const tryGetMedia = async (): Promise<MediaStream> => {
      try {
        return await navigator.mediaDevices.getUserMedia({ 
          video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
      } catch (err) {
        try {
          return await navigator.mediaDevices.getUserMedia({ 
            video: { deviceId: { exact: deviceId } } 
          });
        } catch (err2: any) {
          if ((err2.name === 'NotReadableError' || err2.name === 'TrackStartError') && retryCount < 2) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000));
            return tryGetMedia();
          }
          throw err2;
        }
      }
    };

    try {
      const stream = await tryGetMedia();
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play();
        scanIntervalRef.current = setInterval(tick, 250);
      }
    } catch (err2: any) {
      const msg = err2.name === 'NotReadableError' || err2.name === 'TrackStartError'
        ? "Câmera em uso por outro programa ou aba do navegador."
        : "Câmera não autorizada ou indisponível.";
      toast({ variant: "destructive", title: "Erro", description: msg });
    } finally {
      switchingRef.current = false;
    }
  }, [stopScan, tick, toast]);

  React.useEffect(() => {
    if (selectedDeviceId && !streamRef.current && !switchingRef.current) {
      startCameraStream(selectedDeviceId);
    }
  }, [selectedDeviceId, startCameraStream]);

  React.useEffect(() => {
    return () => stopScan();
  }, [stopScan]);

  if (!mounted) return null;

  return (
    <>
      <PageTitle title="Identificação de Material" description="Aponte a câmera para a Etiqueta ou Identificação do Material.">
        <Button variant="outline" asChild><Link href="/scan-menu"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link></Button>
      </PageTitle>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        <Card className="shadow-lg border-2 border-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PackageOpen className="text-primary" /> Leitor de Material</CardTitle>
            <CardDescription>Posicione o QR Code no centro da tela.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="aspect-video w-full bg-slate-900 rounded-xl flex flex-col items-center justify-center overflow-hidden relative border-4 border-slate-200">
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              {isProcessing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
                  <Loader2 className="h-12 w-12 animate-spin mb-4" />
                  <p className="font-bold tracking-widest uppercase">Processando...</p>
                </div>
              )}
            </div>

            {videoDevices.length > 1 && (
              <div className="space-y-2">
                <Select value={selectedDeviceId} onValueChange={(val) => {
                  setSelectedDeviceId(val);
                  localStorage.setItem('petmobile_preferred_camera', val);
                  setTimeout(() => startCameraStream(val), 300);
                }}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Escolha a câmera..." /></SelectTrigger>
                  <SelectContent>
                    {videoDevices.map((device, i) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label || `Câmera ${i + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button onClick={() => { setScannedMaterial(null); startCameraStream(selectedDeviceId); }} variant="outline" className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" /> Nova Leitura
            </Button>
          </CardContent>
        </Card>

        {/* RESULTADO MATERIAL */}
        <Card className="shadow-lg border-2 border-slate-100">
          <CardHeader className="bg-slate-50 border-b">
             <CardTitle>Dados do Material</CardTitle>
             <CardDescription>Informações decodificadas da etiqueta.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {scannedMaterial ? (
              <div className="divide-y divide-slate-100">
                <div className="p-5 flex justify-between items-start bg-blue-50/30">
                  <div className="space-y-1">
                    <p className="text-[8pt] text-slate-400 uppercase font-bold">Categoria</p>
                    <p className="text-[12pt] font-mono">{scannedMaterial.categoria}</p>
                  </div>
                  <div className="text-[8pt] text-right text-slate-400">ID: {scannedMaterial.codigo}</div>
                </div>

                <div className="p-5 space-y-4">
                  <div className="text-[9pt] font-bold text-blue-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Box className="w-4 h-4" /> Informações
                  </div>
                  <div className="space-y-2 text-sm grid grid-cols-2 gap-y-4">
                    <div className="col-span-2">
                      <p className="text-muted-foreground text-xs font-bold uppercase mb-1">Descrição</p>
                      <p className="text-lg font-medium">{scannedMaterial.descricao}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs font-bold uppercase mb-1">Código de Barras / ID</p>
                      <p>{scannedMaterial.idMaterial || 'Não cadastrado'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs font-bold uppercase mb-1">Unidade</p>
                      <p>{scannedMaterial.unidade}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs font-bold uppercase mb-1">Estoque Atual</p>
                      <p className="font-bold text-lg">{scannedMaterial.estoque}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs font-bold uppercase mb-1">Preço Unitário</p>
                      <p className="font-bold text-lg text-emerald-600">R$ {scannedMaterial.precoUnitario.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="pt-2">
                    <Button autoFocus onClick={() => router.push(`/materiais?searchId=${scannedMaterial.id}`)} className="w-full bg-slate-900 hover:bg-slate-800 text-white focus:ring-4 focus:ring-slate-300 focus:outline-none">
                      <Box className="w-4 h-4 mr-2" /> Gerenciar no Catálogo
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-slate-300 opacity-50 space-y-4">
                <PackageOpen className="h-16 w-16" />
                <p className="font-medium italic text-center px-8">As informações aparecerão aqui após o escaneamento.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
