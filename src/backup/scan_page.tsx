
"use client";

import * as React from 'react';
import jsQR from 'jsqr';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { FileCheck2, Loader2, AlertTriangle, VideoOff, User, FileText, Stethoscope, RefreshCw, Camera, Upload, SwitchCamera, Undo2 } from 'lucide-react';
import { PageTitle } from '@/components/layout/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Patient, Medico, Exam, Movimentacao } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

interface DecodedGuideData {
    movimentoId: string;
    data: string;
    patient: Patient;
    medico: Medico;
    exams: Exam[];
}


export default function ScanPage() {
  const firestore = useFirestore();
  const [decodedData, setDecodedData] = React.useState<DecodedGuideData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [facingMode, setFacingMode] = React.useState<'environment' | 'user'>('environment');

  const { toast } = useToast();
  
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const scanIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const isScanActiveRef = React.useRef(true);


  const stopScan = React.useCallback(() => {
    isScanActiveRef.current = false;
    if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
    }
     if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const fetchGuiaData = React.useCallback(async (movimentoId: string): Promise<DecodedGuideData> => {
      if (!firestore) {
        throw new Error("Serviço indisponível.");
      }
      
      const attemptFetch = async () => {
          const movQuery = query(collection(firestore, 'movimentacoes'), where('movimentoId', '==', movimentoId), limit(1));
          return await getDocs(movQuery);
      }

      let movSnapshot = await attemptFetch();

      if (movSnapshot.empty) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          movSnapshot = await attemptFetch();
      }
      
      if (movSnapshot.empty) {
          throw new Error("Guia de movimentação não encontrada.");
      }
      
      const movDoc = movSnapshot.docs[0];
      const movData = movDoc.data() as Movimentacao;

      const patientDoc = await getDoc(doc(firestore, 'pacientes', movData.pacienteId));
      if (!patientDoc.exists()) throw new Error("Paciente não encontrado.");
      const patientData = { id: patientDoc.id, ...patientDoc.data() } as Patient;

      const medicoDoc = await getDoc(doc(firestore, 'medicos', movData.medicoId));
      if (!medicoDoc.exists()) throw new Error("Médico não encontrado.");
      const medicoData = { id: medicoDoc.id, ...medicoDoc.data() } as Medico;
      
      const examsData: Exam[] = [];
      for (const examId of movData.exameIds) {
          const examDoc = await getDoc(doc(firestore, 'exames', examId));
          if (examDoc.exists()) {
              examsData.push({ id: examDoc.id, ...examDoc.data() } as Exam);
          }
      }

      return {
          movimentoId: movData.movimentoId,
          data: movData.data,
          patient: patientData,
          medico: medicoData,
          exams: examsData
      };
  }, [firestore]);


  const processScannedData = React.useCallback(async (scannedId: string) => {
    stopScan();
    setIsProcessing(true);
    setError(null);
    
    try {
      const fullData = await fetchGuiaData(scannedId);
      setDecodedData(fullData);
      toast({
          title: "Sucesso!",
          description: "Guia lida e processada.",
      });

    } catch (e: any) {
      setError(e.message || "Formato de dados inválido ou erro ao processar.");
      toast({
        variant: "destructive",
        title: "Erro na Leitura",
        description: e.message || "Não foi possível processar o QR Code."
      })
      isScanActiveRef.current = true;
    } finally {
        setIsProcessing(false);
    }
  }, [stopScan, fetchGuiaData, toast]);
  
  const tick = React.useCallback(() => {
    if (!isScanActiveRef.current) {
        return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;

    // A verificação `if (video && canvas)` garante que não prosseguiremos se um deles for nulo.
    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        // A verificação `if (ctx)` garante que o contexto do canvas foi obtido com sucesso.
        if (ctx) {
            // A verificação anterior (video && canvas) garante que video não é nulo aqui.
            // A "afirmação de tipo" (as HTMLVideoElement) informa ao TypeScript para confiar em nós.
            canvas.height = (video as HTMLVideoElement).videoHeight;
            canvas.width = (video as HTMLVideoElement).videoWidth;
            ctx.drawImage((video as HTMLVideoElement), 0, 0, canvas.width, canvas.height);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
            });

            if (code && code.data) {
                processScannedData(code.data);
            }
        }
    }
  }, [processScannedData]);
  
 const startCameraStream = React.useCallback(async (mode: 'environment' | 'user') => {
    stopScan();
    isScanActiveRef.current = true;
    setHasCameraPermission(null);
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode } });
        setHasCameraPermission(true);

        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().catch(err => {
                  console.error("Video play error:", err);
              });
            };
            scanIntervalRef.current = setInterval(tick, 250);
        }
    } catch (err: any) {
        setHasCameraPermission(false);
        console.error("Camera permission error:", err);
        toast({
            variant: "destructive",
            title: "Câmera não autorizada",
            description: "Por favor, autorize o acesso à câmera para ler QR Codes."
        });
    }
  }, [stopScan, tick, toast]);

 const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    stopScan();
    setError(null);
    setDecodedData(null);
    setIsProcessing(true);

    try {
        const imageBitmap = await createImageBitmap(file);
        
        if (!canvasRef.current) {
            throw new Error("Canvas element not found.");
        }

        const canvas = canvasRef.current;
        canvas.width = imageBitmap.width;
        canvas.height = imageBitmap.height;
        
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
            throw new Error("Could not get canvas context.");
        }

        ctx.drawImage(imageBitmap, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "attemptBoth",
        });

        if (code && code.data) {
            await processScannedData(code.data);
        } else {
            throw new Error("Nenhum QR Code encontrado na imagem enviada.");
        }

    } catch (e: any) {
        setError(e.message || "Falha ao ler o arquivo de imagem.");
        toast({ variant: 'destructive', title: 'Falha na Leitura', description: e.message });
        isScanActiveRef.current = true;
    } finally {
        setIsProcessing(false);
    }
  };
  
  const handleSwitchCamera = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };
  
  React.useEffect(() => {
    startCameraStream(facingMode);
    return () => {
        stopScan();
    };
  }, [facingMode, startCameraStream, stopScan]);

  const resetStateAndScan = () => {
    setDecodedData(null);
    setError(null);
    setIsProcessing(false);
    if(fileInputRef.current) fileInputRef.current.value = "";
    startCameraStream(facingMode);
  }

  return (
    <>
      <PageTitle title="Leitura de QR Code" description="Aponte a câmera para um QR Code ou envie um arquivo de imagem.">
        <Link href="/" passHref>
          <Button variant="outline">
            <Undo2 className="mr-2 h-4 w-4" />
            Voltar ao Menu
          </Button>
        </Link>
      </PageTitle>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Scanner</CardTitle>
            <CardDescription>
              Aponte a câmera para o QR Code ou utilize as opções abaixo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-video w-full bg-slate-900 rounded-lg flex flex-col items-center justify-center text-slate-500 overflow-hidden relative">
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
               {isProcessing && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
                      <Loader2 className="h-16 w-16 mx-auto animate-spin" />
                      <p className="mt-4 font-semibold">Processando...</p>
                   </div>
              )}
              {hasCameraPermission === false && !decodedData && !isProcessing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white p-4">
                      <VideoOff className="h-16 w-16 mx-auto text-destructive" />
                      <p className="mt-4 font-semibold">Acesso à câmera negado</p>
                      <p className="text-sm text-center mt-2">Por favor, habilite a permissão de câmera no seu navegador ou envie um arquivo.</p>
                      <Button onClick={() => startCameraStream(facingMode)} variant="secondary" className="mt-4">
                        <Camera className="mr-2"/>
                        Tentar Novamente
                      </Button>
                  </div>
              )}
              {hasCameraPermission === null && !isProcessing && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
                      <Loader2 className="h-16 w-16 mx-auto animate-spin" />
                      <p className="mt-4 font-semibold">Aguardando câmera...</p>
                   </div>
              )}
            </div>
             <div className="mt-4 space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={handleSwitchCamera} className="flex-1" variant="outline" disabled={!hasCameraPermission}>
                        <SwitchCamera className="mr-2 h-4 w-4"/>
                        Trocar Câmera
                    </Button>
                    { (decodedData || error) && (
                        <Button onClick={resetStateAndScan} className="flex-1" variant="outline">
                            <RefreshCw className="mr-2 h-4 w-4"/>
                            Ler Nova Guia
                        </Button>
                    )}
                </div>
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                        Ou
                        </span>
                    </div>
                </div>

                <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="qr-picture">Enviar Imagem do QR Code</Label>
                    <Input id="qr-picture" type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} disabled={isProcessing}/>
                </div>

            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dados Decodificados</CardTitle>
            <CardDescription>As informações do QR Code aparecerão aqui.</CardDescription>
          </CardHeader>
          <CardContent>
            {error && !decodedData &&(
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erro na Leitura</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {decodedData ? (
              <div className="space-y-6">
                 <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <p><strong>Data:</strong> {new Date(decodedData.data).toLocaleString('pt-BR')}</p>
                    <p><strong>ID:</strong> {decodedData.movimentoId}</p>
                </div>
                <Separator/>
                <div>
                  <h3 className="text-lg font-semibold text-primary flex items-center gap-2"><User/>Informações do Paciente</h3>
                  <div className="mt-2 space-y-1 text-sm pl-8">
                    <p><strong>Nome:</strong> {decodedData.patient.name}</p>
                    <p><strong>CPF:</strong> {decodedData.patient.cpf}</p>
                    <p><strong>Telefone:</strong> {decodedData.patient.telefone}</p>
                    <p><strong>Endereço:</strong> {decodedData.patient.endereco}</p>
                    <p><strong>Plano:</strong> {decodedData.patient.healthPlanName} ({decodedData.patient.healthPlanCode})</p>
                  </div>
                </div>
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold text-primary flex items-center gap-2"><Stethoscope/>Médico Responsável</h3>
                  <div className="mt-2 space-y-1 text-sm pl-8">
                    <p><strong>Nome:</strong> Dr(a). {decodedData.medico.name}</p>
                    <p><strong>CRM:</strong> {decodedData.medico.crm}</p>
                  </div>
                </div>
                <Separator />
                 <div>
                  <h3 className="text-lg font-semibold text-primary flex items-center gap-2"><FileText/>Exames Solicitados</h3>
                  <div className="mt-2 space-y-2 pl-8">
                    {decodedData.exams.map(exam => (
                      <div key={exam.id} className="p-2 border rounded-md text-sm">
                        <p className="font-semibold">{exam.name}</p>
                        <p className="text-xs text-muted-foreground">{exam.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : !error && !isProcessing && (
              <div className="text-center py-12 text-muted-foreground">
                <FileCheck2 className="mx-auto h-12 w-12" />
                <p className="mt-4">Nenhum dado processado ainda.</p>
              </div>
            )}
            {isProcessing && !decodedData && (
                 <div className="text-center py-12 text-muted-foreground">
                      <Loader2 className="h-12 w-12 mx-auto animate-spin" />
                      <p className="mt-4 font-semibold">Processando...</p>
                   </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
