"use client";

import * as React from 'react';
import { Camera, RefreshCw, Undo2, Video, VideoOff, Settings, Info, Laptop, Monitor, Loader2 } from 'lucide-react';
import { PageTitle } from '@/components/layout/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function CamerasPage() {
  const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string>('');
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [permissionError, setPermissionError] = React.useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = React.useState(false);
  const streamRef = React.useRef<MediaStream | null>(null);
  const switchingRef = React.useRef(false);

  const getDevices = React.useCallback(async () => {
    try {
      // Tenta pedir permissão. Se falhar, ainda tentamos listar o que for possível.
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        // IMPORTANTE: Parar o stream temporário imediatamente para liberar a câmera
        tempStream.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.warn("Permissão inicial negada, tentando listar dispositivos mesmo assim...");
      }
      
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
      setDevices(videoDevices);
      setPermissionError(null);
      
      if (videoDevices.length === 0) {
        setPermissionError("Nenhuma câmera detectada. Verifique se o cabo USB está bem conectado.");
      }
    } catch (err: any) {
      console.error("Erro fatal ao acessar dispositivos:", err);
      setPermissionError("Erro ao acessar hardware de vídeo. Reinicie o navegador.");
    }
  }, []);

  React.useEffect(() => {
    setMounted(true);
    getDevices();
  }, [getDevices]);

  // Efeito separado para definir a câmera inicial assim que a lista for carregada
  React.useEffect(() => {
    if (devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0].deviceId);
    }
  }, [devices, selectedDeviceId]);

  const startStream = React.useCallback(async (deviceId: string) => {
    if (!deviceId || switchingRef.current) return;
    switchingRef.current = true;
    
    // Limpa erros anteriores ao trocar de câmera
    setPermissionError(null);
    setIsStreaming(false);

    // Parar tracks atuais de forma agressiva usando o Ref
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Pausa mais longa para o SO liberar hardware USB
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      // Configurações mais flexíveis para evitar erros em webcams mais simples
      const constraints = {
        video: { 
          deviceId: { exact: deviceId },
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
      }
    } catch (err: any) {
      console.error("Erro ao iniciar stream:", err);
      
      if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setPermissionError("A câmera está sendo usada por outro programa ou aba.");
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionError("O acesso à câmera foi bloqueado pelo navegador.");
      } else {
        // Tentativa de fallback total (qualquer resolução)
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } } });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setIsStreaming(true);
            return;
          }
        } catch (e) {
          setPermissionError("Não foi possível iniciar o vídeo. Verifique a conexão da webcam.");
        }
      }
      setIsStreaming(false);
    } finally {
      switchingRef.current = false;
    }
  }, []);

  React.useEffect(() => {
    if (selectedDeviceId && mounted) {
      startStream(selectedDeviceId);
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [selectedDeviceId, startStream, mounted]);

  if (!mounted) return null;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50">
      <PageTitle 
        title="Visualizador de Câmeras" 
        description="Teste e configure suas câmeras (webcam USB e integrada do notebook)."
      >
        <Link href="/">
          <Button variant="outline" className="gap-2">
            <Undo2 className="w-4 h-4" /> Voltar ao Menu
          </Button>
        </Link>
      </PageTitle>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-1">
        {/* Painel de Controle */}
        <Card className="lg:col-span-1 border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="bg-white border-b pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              Configurações
            </CardTitle>
            <CardDescription>Gerencie seus dispositivos ativos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6 flex-1">
            <div className="space-y-3">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Câmera Ativa</Label>
              <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Selecione uma câmera" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((device, index) => (
                    <SelectItem key={device.deviceId} value={device.deviceId} className="py-2">
                      <div className="flex items-center gap-2">
                        {device.label.toLowerCase().includes('usb') ? <Monitor className="w-4 h-4 text-blue-500" /> : <Laptop className="w-4 h-4 text-slate-400" />}
                        <span className="truncate max-w-[180px]">{device.label || `Câmera ${index + 1}`}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
                onClick={getDevices} 
                variant="outline" 
                className="w-full gap-2 border-slate-200 hover:bg-white hover:text-blue-600 transition-all font-medium h-11"
            >
              <RefreshCw className="w-4 h-4" /> Atualizar Dispositivos
            </Button>

            <div className="pt-4 space-y-4 border-t border-dashed">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">Total Detectadas:</span>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 font-bold">{devices.length}</Badge>
                </div>
                {devices.map((device, i) => (
                    <div key={device.deviceId} className={`p-3 rounded-lg border-2 transition-all ${selectedDeviceId === device.deviceId ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-slate-100 bg-slate-50'}`}>
                        <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-md ${selectedDeviceId === device.deviceId ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                {device.label.toLowerCase().includes('usb') ? <Video className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate">{device.label || `Dispositivo ${i+1}`}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5 truncate font-mono uppercase">{device.deviceId.substring(0, 12)}...</p>
                                {selectedDeviceId === device.deviceId && (
                                    <div className="flex items-center gap-1.5 mt-2">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                        </span>
                                        <span className="text-[10px] font-bold text-green-600 uppercase tracking-tighter">Em transmissão</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
          </CardContent>
          <div className="p-4 bg-slate-50 border-t">
              <Link href="/scan">
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 shadow-md gap-2 h-11 font-bold">
                    <Video className="w-5 h-5" /> Ir para Escaneamento
                </Button>
              </Link>
          </div>
        </Card>

        {/* Visualizador Principal */}
        <Card className="lg:col-span-3 border-slate-200 shadow-xl overflow-hidden bg-slate-900 flex flex-col relative group">
          <CardHeader className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-6 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="flex justify-between items-center">
                <CardTitle className="text-white flex items-center gap-2">
                    <Video className="w-6 h-6" />
                    Preview em Tempo Real
                </CardTitle>
                <Badge className="bg-white/20 backdrop-blur-md border-white/30 text-white font-mono px-3 py-1">HD 1080p</Badge>
            </div>
          </CardHeader>
          
          <div className="flex-1 flex items-center justify-center p-0 min-h-[400px] lg:min-h-0 bg-black relative">
            {permissionError ? (
                <div className="text-center p-8 space-y-4">
                    <div className="bg-red-500/20 p-4 rounded-full w-fit mx-auto">
                        <VideoOff className="w-12 h-12 text-red-500" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-xl font-bold text-white">Falha no Acesso</h3>
                        <p className="text-red-400 max-w-xs mx-auto text-sm">{permissionError}</p>
                    </div>
                    <Button onClick={getDevices} variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10">
                        Tentar Novamente
                    </Button>
                </div>
            ) : (
                <>
                    {!isStreaming && (
                        <div className="text-center p-8 space-y-4 absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
                            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
                            <p className="text-slate-400 animate-pulse font-medium">Iniciando transmissão de vídeo...</p>
                        </div>
                    )}
                    <div className="w-full h-full flex items-center justify-center">
                        <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            muted 
                            className={`w-full h-full object-contain shadow-2xl transition-opacity duration-500 ${isStreaming ? 'opacity-100' : 'opacity-0'}`}
                        />
                    </div>
                </>
            )}
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full flex items-center gap-6 text-white text-xs font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span>Live</span>
                </div>
                <div className="h-4 w-px bg-white/20" />
                <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-400" />
                    <span>Visualize agora sua {devices.find(d => d.deviceId === selectedDeviceId)?.label || 'Câmera'}</span>
                </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
