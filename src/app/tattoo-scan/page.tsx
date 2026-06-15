"use client";

import * as React from 'react';
import { PageTitle } from '@/components/layout/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Camera, Search, RefreshCw, Undo2, AlertTriangle, ScanLine, X } from 'lucide-react';
import Link from 'next/link';
import { createWorker } from 'tesseract.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function TattooScanTestPage() {
  const [imageSrc, setImageSrc] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [ocrResult, setOcrResult] = React.useState<string | null>(null);
  const [confidence, setConfidence] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // --- WEBCAM STATES ---
  const [isWebcamOpen, setIsWebcamOpen] = React.useState(false);
  const [videoDevices, setVideoDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string>('');
  const [webcamStream, setWebcamStream] = React.useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    // Listar câmeras quando abrir o modal
    if (isWebcamOpen) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
           stream.getTracks().forEach(track => track.stop());
           return navigator.mediaDevices.enumerateDevices();
        })
        .then(devices => {
           const videoInputs = devices.filter(device => device.kind === 'videoinput');
           setVideoDevices(videoInputs);
           if (videoInputs.length > 0 && !selectedDeviceId) {
             setSelectedDeviceId(videoInputs[0].deviceId);
           }
        })
        .catch(err => {
           console.error("Erro ao acessar câmeras", err);
           setError("Permissão de câmera negada ou nenhuma câmera encontrada.");
        });
    } else {
      stopCamera();
    }
  }, [isWebcamOpen]);

  React.useEffect(() => {
    if (isWebcamOpen && selectedDeviceId) {
      startCamera(selectedDeviceId);
    }
  }, [selectedDeviceId, isWebcamOpen]);

  const startCamera = async (deviceId: string) => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setWebcamStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error(err);
      setError("Erro ao iniciar a câmera selecionada.");
    }
  };

  const stopCamera = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(t => t.stop());
      setWebcamStream(null);
    }
  };

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Tentar aplicar algum filtro de contraste para ajudar o OCR
        ctx.filter = 'contrast(120%) grayscale(100%)';
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setImageSrc(dataUrl);
        setOcrResult(null);
        setConfidence(null);
        setError(null);
        setIsWebcamOpen(false);
      }
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setImageSrc(e.target?.result as string);
      setOcrResult(null);
      setConfidence(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const processImage = async () => {
    if (!imageSrc) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Usando tesseract.js no lado do cliente
      const worker = await createWorker('eng');
      
      // Força a IA a procurar apenas letras, números e traços (ignora símbolos bizarros)
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-',
      });
      
      const { data } = await worker.recognize(imageSrc);
      
      // Limpeza básica: removemos espaços extras e pegamos apenas letras/números
      const cleanText = data.text.trim();
      
      setOcrResult(cleanText || "Nenhum texto detectado.");
      setConfidence(data.confidence);
      
      await worker.terminate();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao processar imagem.");
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAll = () => {
    setImageSrc(null);
    setOcrResult(null);
    setConfidence(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <PageTitle title="Leitura de Tatuagem (Lab)" description="Validação e testes de extração de texto via OCR de tatuagens.">
        <Link href="/" passHref>
          <Button variant="outline"><Undo2 className="mr-2 h-4 w-4" />Voltar ao Painel</Button>
        </Link>
      </PageTitle>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
        {/* ENTRADA DE IMAGEM */}
        <Card className="shadow-lg border-2 border-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Camera className="h-5 w-5 text-primary" /> Entrada de Imagem</CardTitle>
            <CardDescription>
                Faça o upload ou tire uma foto da tatuagem para testar o algoritmo de leitura.<br/>
                <strong className="text-red-500">DICA DE OURO:</strong> Tente focar apenas no número. Fundos grandes confundem a IA.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex flex-col items-center">
            
            <div className="w-full aspect-video bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center overflow-hidden relative">
              {imageSrc ? (
                <img src={imageSrc} alt="Preview" className="w-full h-full object-contain" />
              ) : (
                <div className="text-center text-slate-400 p-6">
                  <Upload className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma imagem carregada.</p>
                </div>
              )}
            </div>

            <div className="flex w-full gap-2 flex-wrap sm:flex-nowrap">
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                className="hidden" 
              />
              <Button onClick={() => fileInputRef.current?.click()} className="flex-1" variant="outline">
                <Upload className="mr-2 h-4 w-4" /> Galeria / Arquivo
              </Button>
              <Button onClick={() => setIsWebcamOpen(true)} className="flex-1" variant="outline">
                <Camera className="mr-2 h-4 w-4" /> Usar Câmera
              </Button>
            </div>
            {imageSrc && (
              <Button onClick={processImage} disabled={isProcessing} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
                {isProcessing ? 'Lendo...' : 'Extrair Texto'}
              </Button>
            )}
            
            {imageSrc && (
              <Button onClick={clearAll} variant="ghost" className="text-red-500 hover:text-red-600 w-full">
                <RefreshCw className="mr-2 h-4 w-4" /> Limpar e Recomeçar
              </Button>
            )}

          </CardContent>
        </Card>

        {/* RESULTADO DO OCR */}
        <Card className="shadow-lg border-2 border-slate-100 min-h-[400px]">
          <CardHeader className="bg-slate-50/50 border-b pb-4">
             <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5 text-indigo-500" /> Resultado da Leitura</CardTitle>
             <CardDescription>Dados extraídos pela inteligência artificial (Tesseract.js).</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            
            {isProcessing ? (
               <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
                  <p className="font-bold tracking-widest uppercase text-xs text-slate-500">Analisando pixels...</p>
               </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center py-10 text-red-500 space-y-3">
                  <AlertTriangle className="h-10 w-10" />
                  <p className="font-medium text-center">{error}</p>
                </div>
            ) : ocrResult ? (
              <div className="space-y-6">
                <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 text-center">
                  <p className="text-sm text-indigo-400 font-bold uppercase mb-2">Texto Extraído Bruto:</p>
                  <p className="text-4xl font-mono font-black text-indigo-700 tracking-widest">{ocrResult}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg bg-slate-50 text-center">
                    <p className="text-xs text-slate-500 font-bold uppercase mb-1">Confiança da IA</p>
                    <p className="text-2xl font-bold text-slate-700">
                      {confidence ? `${confidence.toFixed(1)}%` : 'N/A'}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg bg-slate-50 text-center flex flex-col justify-center">
                    <p className="text-xs text-slate-500 font-bold uppercase mb-1">Status para Busca</p>
                    {confidence && confidence > 75 ? (
                      <Badge variant="default" className="bg-emerald-500 mx-auto">Adequado</Badge>
                    ) : (
                      <Badge variant="destructive" className="mx-auto">Baixa Confiança</Badge>
                    )}
                  </div>
                </div>

                <div className="text-xs text-slate-500 italic p-4 bg-slate-50 rounded-lg border border-dashed">
                  <strong>Dica de Validação:</strong> Se os resultados forem insatisfatórios de forma consistente, a migração para a API de Visão do Google Cloud será necessária para o módulo de produção.
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-300 opacity-50 space-y-4">
                  <ScanLine className="h-16 w-16" />
                  <p className="font-medium italic text-center px-8">Carregue ou capture uma imagem para processar a leitura.</p>
              </div>
            )}

          </CardContent>
        </Card>
      </div>

      {/* WEBCAM DIALOG */}
      <Dialog open={isWebcamOpen} onOpenChange={setIsWebcamOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Câmera para Tatuagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {videoDevices.length > 1 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
                  Selecionar Câmera
                </Label>
                <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Escolha a câmera..." />
                  </SelectTrigger>
                  <SelectContent>
                    {videoDevices.map((device, index) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label || `Câmera ${index + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="aspect-video bg-black rounded-lg overflow-hidden relative flex items-center justify-center border-2 border-slate-800">
              <video 
                ref={videoRef} 
                className="w-full h-full object-cover" 
                autoPlay 
                playsInline 
                muted 
              />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                 <div className="w-48 h-16 border-2 border-dashed border-green-500/70 rounded-md"></div>
              </div>
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsWebcamOpen(false)}>Cancelar</Button>
              <Button onClick={captureFrame} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Camera className="w-4 h-4 mr-2" />
                Capturar e Analisar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Simple Badge component mockup since we didn't import it from standard lib
function Badge({ children, className, variant = 'default' }: { children: React.ReactNode, className?: string, variant?: 'default' | 'destructive' }) {
  const base = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  const variants = {
    default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
    destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
  };
  return <div className={`${base} ${variants[variant]} ${className}`}>{children}</div>;
}
