"use client";

import * as React from 'react';
import jsQR from 'jsqr';
import Tesseract from 'tesseract.js';
import Fuse from 'fuse.js';
import { createClient } from '@/lib/supabase/client';
import { 
  FileCheck2, Loader2, AlertTriangle, VideoOff, Printer, RefreshCw, 
  Camera, SwitchCamera, Undo2, Download, FileJson, FileCode, FileType, 
  Search, Edit, Info, PawPrint, Stethoscope, FileText, User, Sparkles, Upload, ScanFace, PlusCircle, Video
} from 'lucide-react';
import { PageTitle } from '@/components/layout/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Pet, Veterinario, Exam } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useSession } from '@/context/session-context';
import { useLeituras, LeituraInput } from '@/hooks/use-leituras';
import { usePets } from '@/hooks/use-pets';
import { useUsers } from '@/hooks/use-user-management';
import { useExams } from '@/hooks/use-exams';
import { useMovement } from '@/hooks/use-movement';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';

interface DecodedGuideData {
  movimentoId: string;
  data: string;
  pet: any; // Allow raw DB data
  veterinario: Veterinario;
  exams: Exam[];
}

export default function ScanPage() {
  const supabase = createClient();
  const { user } = useSession();
  const { addLeitura } = useLeituras();
  const { createMovimento, isLoading: movementApiLoading } = useMovement();
  const { pets } = usePets();
  const { users } = useUsers();
  const { exams } = useExams();
  
  const [decodedData, setDecodedData] = React.useState<DecodedGuideData | null>(null);
  const [codLeitura, setCodLeitura] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = React.useState(false);

  // Manual Input States
  const [isManualModalOpen, setIsManualModalOpen] = React.useState(false);
  const [manualPetId, setManualPetId] = React.useState('');
  const [manualVetId, setManualVetId] = React.useState('');
  const [manualExamIds, setManualExamIds] = React.useState<string[]>([]);
  const [manualPetSearch, setManualPetSearch] = React.useState('');
  const [manualVetSearch, setManualVetSearch] = React.useState('');
  const [manualExamSearch, setManualExamSearch] = React.useState('');
  const [showAllExams, setShowAllExams] = React.useState(false);
  const [identifiedExamIds, setIdentifiedExamIds] = React.useState<string[]>([]);

  // OCR state
  const [isOcrProcessing, setIsOcrProcessing] = React.useState(false);
  const [ocrProgress, setOcrProgress] = React.useState(0);
  const [ocrStatusText, setOcrStatusText] = React.useState('');
  const ocrFileInputRef = React.useRef<HTMLInputElement>(null);

  const [videoDevices, setVideoDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string>('');
  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
  const { toast } = useToast();

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const switchingRef = React.useRef(false);
  const scanIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const isScanActiveRef = React.useRef(true);

  const [mounted, setMounted] = React.useState(false);

  const refreshDevices = React.useCallback(async () => {
    try {
      // Pedimos permissão primeiro para garantir que os nomes (labels) das câmeras apareçam
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach(track => track.stop());
      const foundDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = foundDevices.filter(device => device.kind === 'videoinput');
      setVideoDevices(videoInputs);
    } catch (err) {
      console.error("Erro ao listar dispositivos de vídeo:", err);
    }
  }, []);

  React.useEffect(() => {
    setMounted(true);
    refreshDevices();
  }, [refreshDevices]);

  // Efeito para definir a câmera inicial assim que a lista for carregada
  React.useEffect(() => {
    if (videoDevices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(videoDevices[0].deviceId);
    }
  }, [videoDevices, selectedDeviceId]);

  const stopScan = React.useCallback(() => {
    isScanActiveRef.current = false;
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const fetchGuiaData = React.useCallback(async (movimentoId: string): Promise<DecodedGuideData> => {
    const { data: movData, error: movError } = await supabase
      .from('pet_movimentacoes')
      .select('*')
      .eq('movimento_id', movimentoId)
      .single();

    if (movError || !movData) throw new Error("Guia de movimentação não encontrada.");

    const { data: petDataSB, error: petError } = await supabase
      .from('pet_pets')
      .select('*')
      .eq('id', movData.paciente_id)
      .single();
    if (petError || !petDataSB) throw new Error("Animal não encontrado.");
    
    const { data: vetDataSB, error: vetError } = await supabase
      .from('pet_usuarios')
      .select('id, nome, crmv_uf, telefone, codigo')
      .eq('id', movData.medico_id)
      .single();
    if (vetError || !vetDataSB) throw new Error("Veterinário não encontrado.");

    let examsData: Exam[] = [];
    if (movData.exame_ids && movData.exame_ids.length > 0) {
      const { data: examsDataSB } = await supabase
        .from('pet_exames')
        .select('id, name:nome, description:descricao, type:tipo, examCode:codigo, idExame:id_exame, isUrgency:is_urgency')
        .in('id', movData.exame_ids);
      if (examsDataSB) examsData = examsDataSB as unknown as Exam[];
    }

    return {
      movimentoId: movData.movimento_id,
      data: movData.data,
      pet: petDataSB as any,
      veterinario: {
        id: vetDataSB.id,
        nome: vetDataSB.nome,
        crmv: vetDataSB.crmv_uf,
        email: '',
        telefone: vetDataSB.telefone,
        codVet: vetDataSB.codigo
      },
      exams: examsData
    };
  }, [supabase]);

  const saveLeitura = React.useCallback(async (data: DecodedGuideData): Promise<{ success: boolean; codLeitura?: string; message?: string } | null> => {
    if (!user) return null;

    const leituraInput: LeituraInput = {
      movimentoId: data.movimentoId,
      dataLeitura: new Date().toISOString(),
      usuarioNome: user.nome,
      usuarioId: user.id,
      petId: data.pet.id, // Explicit ID for better linking
      pacienteNome: data.pet.nome,
      pacienteCpf: data.pet.tutor_nome || data.pet.tutor_cpf || '',
      pacienteTelefone: data.pet.tutor_telefone || '',
      pacienteIdade: data.pet.idade || '',
      medicoNome: data.veterinario.nome,
      medicoCrm: data.veterinario.crmv,
      medicoId: data.veterinario.id,
      exames: data.exams.map(e => ({
        examCode: e.examCode,
        idExame: e.idExame || e.examCode,
        name: e.name,
        description: e.description,
        type: e.type,
      })),
    };

    return await addLeitura(leituraInput);
  }, [user, addLeitura]);

  const processScannedData = React.useCallback(async (scannedId: string) => {
    stopScan();
    setIsProcessing(true);
    setError(null);

    try {
      const fullData = await fetchGuiaData(scannedId);
      setDecodedData(fullData);

      const result: any = await saveLeitura(fullData);
      
      if (!result || !result.success) {
        throw new Error(result?.message || "Erro desconhecido ao registrar leitura.");
      }

      if (result.codLeitura) {
        setCodLeitura(result.codLeitura);
        toast({ title: "Leitura Registrada!", description: `Guia registrada com sucesso (Cód: ${result.codLeitura})` });
        // setShowSuccessDialog(true); // Removido para não atrapalhar o clique em Gerar PDF
      }
    } catch (e: any) {
      setError(e.message || "Erro ao processar.");
      toast({ variant: "destructive", title: "Erro na Leitura", description: e.message });
      isScanActiveRef.current = true;
    } finally {
      setIsProcessing(false);
    }
  }, [stopScan, fetchGuiaData, saveLeitura, toast]);

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
    
    // Pequena pausa para garantir que o hardware anterior seja liberado pelo SO
    stopScan();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    isScanActiveRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      streamRef.current = stream;
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play();
        scanIntervalRef.current = setInterval(tick, 250);
      }
    } catch (err: any) {
      console.error("Erro ao iniciar câmera específica:", err);
      
      // Fallback para qualquer configuração daquela câmera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { deviceId: { exact: deviceId } } 
        });
        streamRef.current = stream;
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => videoRef.current?.play();
          scanIntervalRef.current = setInterval(tick, 250);
        }
      } catch (err2: any) {
        setHasCameraPermission(false);
        const msg = err2.name === 'NotReadableError' || err2.name === 'TrackStartError'
          ? "Câmera em uso por outro programa."
          : "Câmera não autorizada ou indisponível.";
        toast({ variant: "destructive", title: "Erro na Câmera", description: msg });
      }
    } finally {
      switchingRef.current = false;
    }
  }, [stopScan, tick, toast]);

  // OCR and Manual Filter Logic
  const filteredPets = React.useMemo(() => {
    if (!manualPetSearch) return pets;
    return pets.filter(p => p.nome.toLowerCase().includes(manualPetSearch.toLowerCase()) || p.tutorNome.toLowerCase().includes(manualPetSearch.toLowerCase()));
  }, [pets, manualPetSearch]);

  const filteredVets = React.useMemo(() => {
    const veterinarios = (users || []).filter(u => u.status === 'MedicoVet' || u.status === 'Administrador' || u.status === 'Master');
    if (!manualVetSearch) return veterinarios;
    return veterinarios.filter(v => v.nome.toLowerCase().includes(manualVetSearch.toLowerCase()));
  }, [users, manualVetSearch]);

  const currentPetData = React.useMemo(() => pets.find(p => p.id === manualPetId), [pets, manualPetId]);

  const filteredExams = React.useMemo(() => {
    let baseExams = exams;

    // Se temos exames identificados via OCR e NÃO estamos mostrando todos, mostra apenas os identificados
    if (identifiedExamIds.length > 0 && !showAllExams) {
      baseExams = exams.filter(e => identifiedExamIds.includes(e.id));
    } else {
      // Caso contrário, aplica filtro por Plano de Saúde se não estiver mostrando tudo
      if (currentPetData && currentPetData.healthPlanName && !showAllExams) {
        baseExams = exams.filter(e => !e.healthPlanName || e.healthPlanName.trim() === '' || e.healthPlanName.trim().toLowerCase() === currentPetData.healthPlanName.trim().toLowerCase());
      }
    }

    if (!manualExamSearch) return baseExams;
    const s = manualExamSearch.toLowerCase();
    return baseExams.filter(e => e.name.toLowerCase().includes(s) || (e.idExame && e.idExame.toLowerCase().includes(s)));
  }, [exams, manualExamSearch, currentPetData, showAllExams, identifiedExamIds]);

  const handleManualSubmit = async () => {
    if (!manualPetId || !manualVetId || manualExamIds.length === 0) {
      toast({ title: "Dados incompletos", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      const result = await createMovimento(manualPetId, manualVetId, manualExamIds);
      if (result.success && result.movimentoId) {
        setIsManualModalOpen(false);
        setManualPetId('');
        setManualVetId('');
        setManualExamIds([]);
        setManualPetSearch('');
        setManualVetSearch('');
        setManualExamSearch('');
        setIdentifiedExamIds([]);
        setShowAllExams(false);
        if (ocrFileInputRef.current) ocrFileInputRef.current.value = '';
        await processScannedData(result.movimentoId);
      } else {
        toast({ title: "Erro ao criar guia", description: result.message, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro Fatal", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOcrImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    stopScan();
    setIsOcrProcessing(true);
    setOcrStatusText('Iniciando análise inteligente (IA)...');
    
    try {
      let extractedText = '';

      if (file.type === 'application/pdf') {
        setOcrStatusText('Lendo documento PDF original...');
        if (!(window as any).pdfjsLib) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
              (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
              resolve(true);
            };
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        
        const arrayBuffer = await file.arrayBuffer();
        const pdfLib = (window as any).pdfjsLib;
        const pdf = await pdfLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          extractedText += content.items.map((item: any) => item.str).join(' ') + '\n';
        }
        
      } else if (file.type === 'text/plain') {
        setOcrStatusText('Lendo conteúdo do arquivo de texto...');
        extractedText = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });

      } else if (file.type.startsWith('image/')) {
        setOcrStatusText('Iniciando análise inteligente da imagem...');
        const { data: { text } } = await Tesseract.recognize(file, 'por', {
           logger: m => {
              if (m.status === 'recognizing text') {
                 setOcrProgress(Math.floor(m.progress * 100));
                 setOcrStatusText('Lendo texto da guia...');
              } else {
                 setOcrStatusText('Afinando motor visual...');
              }
           }
        });
        extractedText = text;
      } else {
        throw new Error("Formato de arquivo não suportado.");
      }
      
      setOcrStatusText('Procurando exames correspondentes...');

      const fuse = new Fuse(exams, {
        keys: [
          { name: 'name', weight: 0.6 },
          { name: 'description', weight: 0.2 },
          { name: 'examCode', weight: 1.0 },
          { name: 'idExame', weight: 1.0 }
        ],
        threshold: 0.2,
        includeScore: true,
        ignoreLocation: true,
      });
      
      const matchedExamIds = new Set<string>();
      
      const cleanText = extractedText
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/\s*[\u2013\u2014]\s*/g, " - ")
        .replace(/\s{2,}/g, " ");
        
      const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
      
      lines.forEach(line => {
        const words = line.split(/[\s,;\-]+/).filter(w => w.length >= 3);
        let foundByExactCode = false;

        // 1. Tenta Match Exato por Código Primeiro (Alta Precisão)
        for (const word of words) {
          const exactMatch = exams.find(e => 
            (e.examCode && e.examCode.toUpperCase() === word.toUpperCase()) || 
            (e.idExame && e.idExame.toUpperCase() === word.toUpperCase())
          );
          
          if (exactMatch) {
            matchedExamIds.add(exactMatch.id);
            foundByExactCode = true;
          }
        }

        // 2. Se NÃO encontrou por código exato, tenta busca difusa na linha
        if (!foundByExactCode) {
          const results = fuse.search(line);
          if (results.length > 0 && results[0].score !== undefined && results[0].score < 0.2) {
             matchedExamIds.add(results[0].item.id);
          }
        }
      });

      if (matchedExamIds.size > 0) {
        const matchedArray = Array.from(matchedExamIds);
        setManualExamIds(matchedArray);
        setIdentifiedExamIds(matchedArray); // Armazena o que foi identificado
        setShowAllExams(false); // Garante que a visão inicial seja apenas do que foi lido
        toast({ title: "Leitura Concluída", description: `Encontramos ${matchedExamIds.size} possível(is) exame(s). Audite a seleção.` });
      } else {
        toast({ title: "Aviso", description: "O sistema leu a imagem/PDF, mas não detectou nomes iguais aos seus códigos." });
      }
      setIsManualModalOpen(true);
    } catch (err: any) {
      toast({ title: "Aviso do Sistema", description: err.message || "Erro na IA ao tentar ler o arquivo.", variant: "destructive" });
    } finally {
      setIsOcrProcessing(false);
      setOcrProgress(0);
    }
  };

  React.useEffect(() => {
    if (selectedDeviceId) {
      startCameraStream(selectedDeviceId);
    }
    return () => stopScan();
  }, [selectedDeviceId, startCameraStream, stopScan]);

  if (!mounted) return null;

  return (
    <>
      <PageTitle title="Escaneamento de Guias" description="Inicie o atendimento do Pet lendo o QR Code da solicitação.">
        <Button variant="outline" asChild><Link href="/"><Undo2 className="mr-2 h-4 w-4" />Voltar ao Menu</Link></Button>
      </PageTitle>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SCANNER */}
        <Card className="shadow-lg border-2 border-slate-100">
          <CardHeader>
            <CardTitle>Scanner</CardTitle>
            <CardDescription>Aponte a câmera para o QR Code ou utilize as opções abaixo (PDF, TXT e Imagem).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="aspect-video w-full bg-slate-900 rounded-xl flex flex-col items-center justify-center text-slate-500 overflow-hidden relative border-4 border-slate-200 shadow-inner group">
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              {isProcessing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
                  <Loader2 className="h-12 w-12 animate-spin mb-4" />
                  <p className="font-bold tracking-widest uppercase text-xs">Processando...</p>
                </div>
              )}
              <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href="/cameras">
                   <Button size="sm" variant="secondary" className="bg-white/80 backdrop-blur text-[10px] h-7 px-2 font-bold uppercase tracking-tight">
                      <Video className="w-3 h-3 mr-1" /> Tela Cheia
                   </Button>
                </Link>
              </div>
            </div>

            {videoDevices.length > 1 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
                  <Camera className="w-3 h-3" /> Selecionar Câmera
                </Label>
                <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                  <SelectTrigger className="h-10 bg-slate-50 border-slate-200">
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

            <div className="grid grid-cols-2 gap-3">
              <Button onClick={refreshDevices} variant="outline" className="h-12 border-slate-200 hover:bg-slate-50">
                <RefreshCw className="mr-2 h-4 w-4" /> Atualizar Câmeras
              </Button>
              <Button onClick={() => { setDecodedData(null); setCodLeitura(null); startCameraStream(selectedDeviceId); }} variant="outline" className="h-12 border-slate-200 hover:bg-slate-50 text-blue-600 font-medium">
                <RefreshCw className="mr-2 h-4 w-4" /> Ler Nova Guia
              </Button>
            </div>
            
            <div className="pt-4 space-y-4">
              <p className="text-xs font-medium text-muted-foreground">Leitura Inteligente (PDF/TXT e Imagem) e Digitação:</p>
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => { 
                  setManualPetId(''); setManualVetId(''); setManualExamIds([]); setManualPetSearch(''); setManualVetSearch(''); setManualExamSearch('');
                  setIdentifiedExamIds([]); setShowAllExams(false);
                  setIsManualModalOpen(true); 
                }} className="h-12 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200" variant="outline">
                  <Edit className="mr-2 h-5 w-5" /> Digitar Manualmente
                </Button>
                <Button onClick={() => { 
                  setManualPetId(''); setManualVetId(''); setManualExamIds([]); setManualPetSearch(''); setManualVetSearch(''); setManualExamSearch('');
                  setIdentifiedExamIds([]); setShowAllExams(false);
                  if (ocrFileInputRef.current) ocrFileInputRef.current.value = '';
                  setIsManualModalOpen(true); 
                }} className="h-12 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md">
                  <Sparkles className="mr-2 h-5 w-5" />
                  Leitura Inteligente
                </Button>
              </div>
              <input type="file" ref={ocrFileInputRef} className="hidden" accept="image/*,application/pdf,text/plain" onChange={handleOcrImageUpload} />
            </div>
          </CardContent>
        </Card>

        {/* RESULTADOS */}
        <Card className="shadow-lg border-2 border-slate-100 min-h-[500px] flex flex-col">
          <CardHeader className="bg-slate-50/50 border-b pb-4">
             <div className="flex justify-between items-center">
                <div><CardTitle>Dados Decodificados</CardTitle><CardDescription>As informações do QR Code aparecerão aqui.</CardDescription></div>
                {codLeitura && <Button variant="outline" size="sm" onClick={() => { setDecodedData(null); setCodLeitura(null); }} className="h-8 text-[10px]"><RefreshCw className="mr-1 w-3 h-3"/> Nova Leitura</Button>}
             </div>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {decodedData ? (
              <div className="divide-y divide-slate-100 overflow-y-auto">
                <div className="p-5 flex justify-between items-start bg-blue-50/30">
                  <div className="space-y-1">
                    <p className="text-[8pt] text-slate-400 uppercase font-bold">Leitura: {codLeitura || 'PENDENTE'}</p>
                    <p className="text-[10pt] font-mono">Guia: {decodedData.movimentoId}</p>
                  </div>
                  <div className="text-[8pt] text-right text-slate-400">Data Guia: {new Date(decodedData.data).toLocaleDateString('pt-BR')}</div>
                </div>

                <div className="p-5">
                  <div className="text-[9pt] font-bold text-blue-500 uppercase tracking-wider mb-3 flex items-center gap-2"><User className="w-4 h-4" /> Informações do Paciente</div>
                  <div className="space-y-1 text-sm grid grid-cols-2">
                    <p><strong>Nome:</strong> {decodedData.pet.nome}</p>
                    <p><strong>Espécie:</strong> {decodedData.pet.especie}</p>
                    <p><strong>Tutor:</strong> {decodedData.pet.tutor_nome}</p>
                    <p><strong>Plano:</strong> {decodedData.pet.health_plan_name || 'PARTICULAR'}</p>
                  </div>
                </div>

                <div className="p-5">
                  <div className="text-[9pt] font-bold text-blue-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Stethoscope className="w-4 h-4" /> Médico Veterinário</div>
                  <div className="space-y-1 text-sm grid grid-cols-2">
                    <p><strong>Nome:</strong> {decodedData.veterinario.nome}</p>
                    <p><strong>CRMV:</strong> {decodedData.veterinario.crmv}</p>
                  </div>
                </div>

                <div className="p-5">
                  <div className="text-[9pt] font-bold text-blue-500 uppercase tracking-wider mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> Exames Solicitados ({decodedData.exams.length})</div>
                  <div className="space-y-4">
                    {/* Exames de Urgência */}
                    {decodedData.exams.filter(e => e.isUrgency).length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[8pt] font-black text-red-600 uppercase flex items-center gap-1.5 mb-1 px-1">
                          <AlertTriangle className="w-3 h-3" /> Exames de Urgência
                        </div>
                        {decodedData.exams.filter(e => e.isUrgency).map(e => (
                          <div key={e.id} className="text-sm border-l-4 border-red-500 pl-3 py-2 bg-red-50/30 rounded-r-md">
                            <div className="font-bold flex justify-between">
                              <span>{e.idExame || e.examCode} — {e.name}</span>
                            </div>
                            {e.description && <p className="text-[11px] text-red-700/70 mt-0.5 italic">{e.description}</p>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Exames Normais */}
                    {decodedData.exams.filter(e => !e.isUrgency).length > 0 && (
                      <div className="space-y-2">
                        {decodedData.exams.filter(e => e.isUrgency).length > 0 && <div className="text-[8pt] font-black text-slate-400 uppercase mt-2 px-1">Exames Normais</div>}
                        {decodedData.exams.filter(e => !e.isUrgency).map(e => (
                          <div key={e.id} className="text-sm border-l-4 border-blue-400 pl-3 py-2 bg-slate-50/50 rounded-r-md">
                            <div className="font-bold flex justify-between">
                              <span>{e.idExame || e.examCode} — {e.name}</span>
                            </div>
                            {e.description && <p className="text-[11px] text-slate-500 mt-0.5 italic">{e.description}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-300 opacity-50 space-y-4"><Search className="h-16 w-16" /><p className="font-medium italic text-center px-8">As informações da guia aparecerão aqui após o escaneamento ou entrada manual.</p></div>
            )}
          </CardContent>

          {decodedData && (
            <div className="p-4 bg-slate-50 border-t space-y-3">
              <Button onClick={() => window.open(`/print/${decodedData.movimentoId}?origin=scan&codLeitura=${codLeitura || ''}`, '_blank')} className="w-full bg-blue-600 hover:bg-blue-700 shadow-md">
                <Printer className="mr-2 h-4 w-4" /> Gerar PDF de leitura
              </Button>
              <div className="grid grid-cols-3 shadow-sm border rounded-lg overflow-hidden">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="rounded-none border-r hover:bg-slate-100 py-6 h-auto flex flex-col gap-1"
                  onClick={() => {
                    const data = {
                      "Cód_Leitura": codLeitura,
                      "Data_Leitura": new Date().toLocaleDateString('pt-BR'),
                      "Referente_a": decodedData.movimentoId,
                      "Paciente": decodedData.pet.nome,
                      "Tutor": decodedData.pet.tutor_nome,
                      "Veterinario_Responsavel": decodedData.veterinario.nome,
                      "Exames_Solicitados": decodedData.exams.map((e: any) => `${e.idExame || e.examCode} - ${e.name}${e.description ? ` (${e.description})` : ''}`)
                    };
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Leitura_${codLeitura || 'JSON'}.json`;
                    a.click();
                  }}
                >
                  <FileJson className="h-5 w-5 text-amber-600" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">JSON</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="rounded-none border-r hover:bg-slate-100 py-6 h-auto flex flex-col gap-1"
                  onClick={() => {
                    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Leitura>
  <Cod_Leitura>${codLeitura}</Cod_Leitura>
  <Data_Leitura>${new Date().toLocaleDateString('pt-BR')}</Data_Leitura>
  <Referente_a>${decodedData.movimentoId}</Referente_a>
  <Paciente>${decodedData.pet.nome}</Paciente>
  <Tutor>${decodedData.pet.tutor_nome || ''}</Tutor>
  <Veterinario_Responsavel>${decodedData.veterinario.nome}</Veterinario_Responsavel>
  <Exames_Solicitados>
${decodedData.exams.map((e: any) => `    <Exame>${e.idExame || e.examCode} - ${e.name}${e.description ? ` (${e.description})` : ''}</Exame>`).join('\n')}
  </Exames_Solicitados>
</Leitura>`;
                    const blob = new Blob([xml], { type: 'application/xml' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Leitura_${codLeitura || 'XML'}.xml`;
                    a.click();
                  }}
                >
                  <FileCode className="h-5 w-5 text-blue-600" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">XML</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="rounded-none hover:bg-slate-100 py-6 h-auto flex flex-col gap-1"
                  onClick={() => {
                    const examsUrgent = decodedData.exams.filter(e => e.isUrgency);
                    const examsNormal = decodedData.exams.filter(e => !e.isUrgency);
                    
                    let examesTxt = '';
                    if (examsUrgent.length > 0) {
                      examesTxt += `Exames Urgentes - (${examsUrgent.length})\n${examsUrgent.map(e => `- ${e.idExame || e.examCode} - ${e.name}${e.description ? ` (${e.description})` : ''}`).join('\n')}\n\n`;
                    }
                    if (examsNormal.length > 0) {
                      examesTxt += `Exames Normais - (${examsNormal.length})\n${examsNormal.map(e => `- ${e.idExame || e.examCode} - ${e.name}${e.description ? ` (${e.description})` : ''}`).join('\n')}`;
                    }

                    const txt = `Cód_Leitura: ${codLeitura} - Data Leitura: ${new Date().toLocaleDateString('pt-BR')}\nReferente a: ${decodedData.movimentoId}\n\nPaciente: ${decodedData.pet.nome}\nTutor: ${decodedData.pet.tutor_nome || ''}\nVeterinário: ${decodedData.veterinario.nome}\n\n${examesTxt}`;
                    const blob = new Blob([txt], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Leitura_${codLeitura || 'TXT'}.txt`;
                    a.click();
                  }}
                >
                  <FileType className="h-5 w-5 text-gray-600" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">TXT</span>
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* MODAL MANUAL (Igual PacienteMobile) */}
      <Dialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen}>
        <DialogContent className="max-w-[800px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2 text-xl"><Edit className="w-6 h-6 text-blue-600" /> Registro Manual / Auditoria IA</DialogTitle>
            <DialogDescription>Utilize esta tela para registrar uma leitura sem QR Code ou validar o que a IA leu.</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {/* PET */}
               <div className="space-y-2">
                  <Label>Pet / Paciente</Label>
                  <Input placeholder="Filtrar animal..." value={manualPetSearch} onChange={e => setManualPetSearch(e.target.value)} className="mb-2" />
                  <Select value={manualPetId} onValueChange={setManualPetId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o animal..." /></SelectTrigger>
                    <SelectContent>
                      {filteredPets.map(p => <SelectItem key={p.id} value={p.id}>{p.nome} ({p.tutorNome})</SelectItem>)}
                    </SelectContent>
                  </Select>
               </div>
               {/* VET */}
               <div className="space-y-2">
                  <Label>Veterinário Responsável</Label>
                  <Input placeholder="Filtrar médico..." value={manualVetSearch} onChange={e => setManualVetSearch(e.target.value)} className="mb-2" />
                  <Select value={manualVetId} onValueChange={setManualVetId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o veterinário..." /></SelectTrigger>
                    <SelectContent>
                      {filteredVets.map(v => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
               </div>
            </div>

            <Separator />

            {/* LEITURA INTELIGENTE (UPLOAD) */}
            <div className={`p-4 rounded-lg border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors ${manualPetId && manualVetId ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200 opacity-70'}`}>
               <div className="text-sm">
                  <span className="font-bold flex items-center gap-1"><Sparkles className="w-4 h-4 text-indigo-600"/> Leitura Inteligente (Recepção)</span>
                  <p className="text-slate-600 mt-1">
                     {!manualPetId || !manualVetId 
                        ? 'Selecione o Pet e o Veterinário Acima para liberar o envio do arquivo.'
                        : 'Importe o PDF, Imagem ou TXT para a IA processar os exames.'}
                  </p>
               </div>
               <Button 
                onClick={() => ocrFileInputRef.current?.click()} 
                disabled={!manualPetId || !manualVetId || isOcrProcessing}
                className="bg-indigo-600 hover:bg-indigo-700 text-white w-full md:w-auto shadow-sm"
               >
                 {isOcrProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileType className="mr-2 h-4 w-4" />}
                 Selecionar Arquivo
               </Button>
            </div>

            <Separator />

            {/* EXAMES */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-100/50 p-3 rounded-lg border">
                <Label className="text-base font-bold flex items-center gap-2">
                   <FileText className="w-5 h-5 text-blue-600"/>
                   Exames ({manualExamIds.length})
                </Label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2 bg-white p-1 rounded-md border shadow-sm">
                    <Button 
                      variant={!showAllExams ? "default" : "ghost"} 
                      size="sm" 
                      type="button"
                      onClick={() => setShowAllExams(false)}
                      className="h-8 text-xs px-3"
                    >
                      {identifiedExamIds.length > 0 ? 'Identificados' : 'Por Plano'}
                    </Button>
                    <Button 
                      variant={showAllExams ? "default" : "ghost"} 
                      size="sm" 
                      type="button"
                      onClick={() => setShowAllExams(true)}
                      className="h-8 text-xs px-3"
                    >
                      Catálogo Completo
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar exame no catálogo..." value={manualExamSearch} onChange={e => setManualExamSearch(e.target.value)} className="pl-9" />
                </div>

                <ScrollArea className="h-[250px] border rounded-md p-4 bg-slate-50/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredExams.map(exam => (
                      <div key={exam.id} className={`flex items-start space-x-3 p-2 hover:bg-white rounded-md transition-shadow border ${manualExamIds.includes(exam.id) ? 'border-blue-200 bg-blue-50/20' : 'border-transparent'}`}>
                        <Checkbox id={exam.id} checked={manualExamIds.includes(exam.id)} onCheckedChange={checked => {
                          if (checked) {
                            setManualExamIds([...manualExamIds, exam.id]);
                            // Se estivermos no modo "Apenas lidos", e o usuário marcar um novo manual, adicionamos ao identified para ele não sumir
                            if (identifiedExamIds.length > 0 && !identifiedExamIds.includes(exam.id)) {
                               setIdentifiedExamIds([...identifiedExamIds, exam.id]);
                            }
                          } else {
                            setManualExamIds(manualExamIds.filter(id => id !== exam.id));
                          }
                        }} />
                        <label htmlFor={exam.id} className="text-sm leading-none cursor-pointer flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-blue-600">{exam.idExame || exam.examCode}</span>
                            {identifiedExamIds.includes(exam.id) && <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1 rounded flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5"/> Lido</span>}
                          </div>
                          <div className="font-medium text-[13px]">{exam.name}</div>
                          {exam.description && <div className="text-[11px] text-muted-foreground italic mt-0.5 leading-tight">{exam.description}</div>}
                        </label>
                      </div>
                    ))}
                    {filteredExams.length === 0 && (
                      <div className="col-span-full py-10 text-center text-muted-foreground italic text-sm">
                        Nenhum exame encontrado para os filtros atuais.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t gap-2">
            <Button variant="outline" onClick={() => setIsManualModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleManualSubmit} disabled={movementApiLoading} className="bg-blue-600 hover:bg-blue-700 min-w-[150px]">
              {movementApiLoading ? <Loader2 className="animate-spin mr-2"/> : <FileCheck2 className="mr-2" />}
              Registrar Guia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Diálogo de Ação Concluída */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="bg-green-100 p-1.5 rounded-full">
                <FileCheck2 className="h-5 w-5 text-green-600" />
              </div>
              Ação Concluída
            </DialogTitle>
            <DialogDescription className="py-2 text-base text-slate-600">
              Sua leitura foi registrada com sucesso. Deseja realizar a leitura de uma nova guia agora?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex sm:justify-between items-center gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowSuccessDialog(false)} className="flex-1">
              Não, manter nesta tela
            </Button>
            <Button onClick={() => { setShowSuccessDialog(false); setDecodedData(null); setCodLeitura(null); startCameraStream(selectedDeviceId); }} className="bg-indigo-600 hover:bg-indigo-700 flex-1 text-white shadow-md">
              Sim, Nova Leitura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
