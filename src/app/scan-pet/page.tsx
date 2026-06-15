"use client";

import * as React from 'react';
import jsQR from 'jsqr';
import { Camera, Loader2, ArrowLeft, RefreshCw, PawPrint } from 'lucide-react';
import { PageTitle } from '@/components/layout/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ScanPetPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [videoDevices, setVideoDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string>('');

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
      if (scannedId.startsWith('PET:')) {
        const petId = scannedId.replace('PET:', '');
        toast({ title: "Pet Identificado!", description: "Abrindo cadastro do pet..." });
        router.push(`/pets?searchId=${petId}`);
      } else {
        throw new Error("QR Code inválido para Pet.");
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na Leitura", description: e.message });
      isScanActiveRef.current = true;
      setIsProcessing(false);
      startCameraStream(selectedDeviceId);
    }
  }, [stopScan, router, toast]);

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
      <PageTitle title="Identificação de Pet" description="Aponte a câmera para o Crachá ou Etiqueta do Pet.">
        <Button variant="outline" asChild><Link href="/scan-menu"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link></Button>
      </PageTitle>

      <div className="max-w-2xl mx-auto mt-8">
        <Card className="shadow-lg border-2 border-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PawPrint className="text-primary" /> Leitor de Pet</CardTitle>
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

            <Button onClick={() => startCameraStream(selectedDeviceId)} variant="outline" className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" /> Reiniciar Câmera
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
