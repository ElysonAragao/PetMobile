"use client";

import * as React from 'react';
import jsQR from 'jsqr';
import Tesseract from 'tesseract.js';
import Fuse from 'fuse.js';
import { createClient } from '@/lib/supabase/client';
import { 
  FileCheck2, Loader2, AlertTriangle, VideoOff, Printer, RefreshCw, 
  Camera, SwitchCamera, Undo2, Download, FileJson, FileCode, FileType, 
  Search, Edit, Info, PawPrint, Stethoscope, FileText, User, Sparkles, Upload, ScanFace, PlusCircle
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
  pet: Pet;
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

  // Manual Input States
  const [isManualModalOpen, setIsManualModalOpen] = React.useState(false);
  const [manualPetId, setManualPetId] = React.useState('');
  const [manualVetId, setManualVetId] = React.useState('');
  const [manualExamIds, setManualExamIds] = React.useState<string[]>([]);
  const [manualPetSearch, setManualPetSearch] = React.useState('');
  const [manualVetSearch, setManualVetSearch] = React.useState('');
  const [manualExamSearch, setManualExamSearch] = React.useState('');
  const [showAllExams, setShowAllExams] = React.useState(false);

  // OCR state
  const [isOcrProcessing, setIsOcrProcessing] = React.useState(false);
  const [ocrProgress, setOcrProgress] = React.useState(0);
  const [ocrStatusText, setOcrStatusText] = React.useState('');
  const ocrFileInputRef = React.useRef<HTMLInputElement>(null);

  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
  const [facingMode, setFacingMode] = React.useState<'environment' | 'user'>('environment');
  const { toast } = useToast();

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const isScanActiveRef = React.useRef(true);

  // Hydration fix
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

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
        .select('id, nome, description:descricao, type:tipo, examCode:codigo, idExame:id_exame')
        .in('id', movData.exame_ids);
      if (examsDataSB) examsData = examsDataSB as unknown as Exam[];
    }

    return {
      movimentoId: movData.movimento_id,
      data: movData.data,
      pet: petDataSB,
      veterinario: {
        id: vetDataSB.id,
        nome: vetDataSB.nome,
        crmv: vetDataSB.crmv_uf,
        telefone: vetDataSB.telefone,
        codVet: vetDataSB.codigo
      },
      exams: examsData
    };
  }, [supabase]);

  const saveLeitura = React.useCallback(async (data: DecodedGuideData): Promise<string | null> => {
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
      exames: data.exams.map(e => ({
        examCode: e.examCode,
        idExame: e.idExame || e.examCode,
        name: e.name,
        description: e.description,
        type: e.type,
      })),
    };

    const result = await addLeitura(leituraInput);
    return result.success ? result.codLeitura : null;
  }, [user, addLeitura]);

  const processScannedData = React.useCallback(async (scannedId: string) => {
    stopScan();
    setIsProcessing(true);
    setError(null);

    try {
      const fullData = await fetchGuiaData(scannedId);
      setDecodedData(fullData);

      const codigo = await saveLeitura(fullData);
      if (codigo) {
        setCodLeitura(codigo);
        toast({ title: "Leitura Registrada!", description: `Guia registrada com sucesso (Cód: ${codigo})` });
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

  const startCameraStream = React.useCallback(async (mode: 'environment' | 'user') => {
    stopScan();
    isScanActiveRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode } });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play();
        scanIntervalRef.current = setInterval(tick, 250);
      }
    } catch (err) {
      setHasCameraPermission(false);
      toast({ variant: "destructive", title: "Câmera não autorizada" });
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
    if (currentPetData && currentPetData.healthPlanName && !showAllExams) {
      baseExams = exams.filter(e => !e.healthPlanName || e.healthPlanName.trim() === '' || e.healthPlanName.trim().toLowerCase() === currentPetData.healthPlanName.trim().toLowerCase());
    }
    if (!manualExamSearch) return baseExams;
    const s = manualExamSearch.toLowerCase();
    return baseExams.filter(e => e.name.toLowerCase().includes(s) || (e.idExame && e.idExame.toLowerCase().includes(s)));
  }, [exams, manualExamSearch, currentPetData, showAllExams]);

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
      const { data: { text } } = await Tesseract.recognize(file, 'por', {
        logger: m => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.floor(m.progress * 100));
            setOcrStatusText('Lendo texto da guia...');
          }
        }
      });
      
      const fuse = new Fuse(exams, { keys: ['name', 'examCode', 'idExame'], threshold: 0.5 });
      const matchedIds = new Set<string>();
      text.split('\n').forEach(line => {
        const results = fuse.search(line);
        if (results.length > 0 && results[0].score! < 0.45) matchedIds.add(results[0].item.id);
      });

      if (matchedIds.size > 0) {
        setManualExamIds(Array.from(matchedIds));
        toast({ title: "Motor de IA Concluído", description: `${matchedIds.size} exames detectados.` });
      } else {
        toast({ title: "Aviso", description: "IA leu a imagem mas não encontrou exames cadastrados." });
      }
      setIsManualModalOpen(true);
    } catch (err) {
      toast({ title: "Erro na IA", variant: "destructive" });
    } finally {
      setIsOcrProcessing(false);
      setOcrProgress(0);
    }
  };

  React.useEffect(() => {
    startCameraStream(facingMode);
    return () => stopScan();
  }, [facingMode, startCameraStream, stopScan]);

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
            <div className="aspect-video w-full bg-slate-900 rounded-xl flex flex-col items-center justify-center text-slate-500 overflow-hidden relative border-4 border-slate-200 shadow-inner">
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              {isProcessing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
                  <Loader2 className="h-12 w-12 animate-spin mb-4" />
                  <p className="font-bold tracking-widest uppercase text-xs">Processando...</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => setFacingMode(m => m === 'environment' ? 'user' : 'environment')} variant="outline" className="h-12">
                <SwitchCamera className="mr-2 h-4 w-4" /> Trocar Câmera
              </Button>
              <Button onClick={() => { setDecodedData(null); setCodLeitura(null); startCameraStream(facingMode); }} variant="outline" className="h-12">
                <RefreshCw className="mr-2 h-4 w-4" /> Ler Nova Guia
              </Button>
            </div>
            
            <div className="pt-4 space-y-4">
              <p className="text-xs font-medium text-muted-foreground">Leitura Inteligente (PDF/TXT e Imagem) e Digitação:</p>
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => setIsManualModalOpen(true)} className="h-12 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200" variant="outline">
                  <Edit className="mr-2 h-5 w-5" /> Digitar Manualmente
                </Button>
                <Button onClick={() => ocrFileInputRef.current?.click()} className="h-12 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md" disabled={isOcrProcessing}>
                  {isOcrProcessing ? <Loader2 className="h-5 w-5 animate-spin"/> : <Sparkles className="mr-2 h-5 w-5" />}
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
                  <div className="space-y-2">
                    {decodedData.exams.map(e => (
                      <div key={e.id} className="text-sm border-l-4 border-blue-400 pl-3 py-1 bg-slate-50">{e.idExame || e.examCode} — {e.name}</div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-300 opacity-50 space-y-4"><Search className="h-16 w-16" /><p className="font-medium italic text-center px-8">As informações da guia aparecerão aqui após o escaneamento ou entrada manual.</p></div>
            )}
          </CardContent>

          {decodedData && (
            <div className="p-4 bg-slate-50 border-t space-y-3">
              <Button onClick={() => window.open(`/print/${decodedData.movimentoId}?origin=scan`, '_blank')} className="w-full bg-blue-600 hover:bg-blue-700 shadow-md">
                <Printer className="mr-2 h-4 w-4" /> Gerar PDF de leitura
              </Button>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" className="text-[10px]"><FileJson className="mr-1 w-3 h-3"/> JSON</Button>
                <Button variant="outline" size="sm" className="text-[10px]"><FileCode className="mr-1 w-3 h-3"/> XML</Button>
                <Button variant="outline" size="sm" className="text-[10px]"><FileType className="mr-1 w-3 h-3"/> TXT</Button>
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

            {/* EXAMES */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-base font-bold">Exames Detectados / Selecionados ({manualExamIds.length})</Label>
                <div className="flex items-center gap-2">
                  <Checkbox id="showAll" checked={showAllExams} onCheckedChange={(c) => setShowAllExams(!!c)} />
                  <label htmlFor="showAll" className="text-xs cursor-pointer">Mostrar todos do catálogo</label>
                </div>
              </div>
              <Input placeholder="Buscar exame no catálogo..." value={manualExamSearch} onChange={e => setManualExamSearch(e.target.value)} />
              <ScrollArea className="h-[250px] border rounded-md p-4 bg-slate-50/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredExams.map(exam => (
                    <div key={exam.id} className="flex items-start space-x-3 p-2 hover:bg-white rounded-md transition-shadow">
                      <Checkbox id={exam.id} checked={manualExamIds.includes(exam.id)} onCheckedChange={checked => checked ? setManualExamIds([...manualExamIds, exam.id]) : setManualExamIds(manualExamIds.filter(id => id !== exam.id))} />
                      <label htmlFor={exam.id} className="text-sm leading-none cursor-pointer">
                        <span className="font-bold text-blue-600 block mb-1">{exam.idExame || exam.examCode}</span>
                        {exam.name}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
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
    </>
  );
}
