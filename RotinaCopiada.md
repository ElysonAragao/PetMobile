Branding sync
"use client";

import * as React from 'react';
import jsQR from 'jsqr';
import Tesseract from 'tesseract.js';
import Fuse from 'fuse.js';
import { createClient } from '@/lib/supabase/client';
import { FileCheck2, Loader2, AlertTriangle, VideoOff, User, FileText, Stethoscope, RefreshCw, Camera, Upload, SwitchCamera, Undo2, Download, FileJson, FileCode, FileType, Search, PlusCircle, Edit, Info, Sparkles, ScanFace } from 'lucide-react';
import { PageTitle } from '@/components/layout/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Patient, Medico, Exam, Movimentacao } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useSession } from '@/context/session-context';
import { useLeituras, LeituraInput } from '@/hooks/use-leituras';
import { usePatients } from '@/hooks/use-patients';
import { useMedicos } from '@/hooks/use-medicos';
import { useExams } from '@/hooks/use-exams';
import { useMovement } from '@/hooks/use-movement';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';

interface DecodedGuideData {
  movimentoId: string;
  data: string;
  patient: Patient;
  medico: Medico;
  exams: Exam[];
}

export default function ScanPage() {
  const supabase = createClient();
  const { user } = useSession();
  const { addLeitura } = useLeituras();
  const { createMovimento, isLoading: movementApiLoading } = useMovement();
  const { patients } = usePatients();
  const { medicos } = useMedicos();
  const { exams } = useExams();
  
  const [decodedData, setDecodedData] = React.useState<DecodedGuideData | null>(null);
  const [codLeitura, setCodLeitura] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Manual Input States
  const [isManualModalOpen, setIsManualModalOpen] = React.useState(false);
  const [manualPatientId, setManualPatientId] = React.useState('');
  const [manualMedicoId, setManualMedicoId] = React.useState('');
  const [manualExamIds, setManualExamIds] = React.useState<string[]>([]);
  const [manualPatientSearch, setManualPatientSearch] = React.useState('');
  const [manualMedicoSearch, setManualMedicoSearch] = React.useState('');
  const [manualExamSearch, setManualExamSearch] = React.useState('');
  const [showAllExams, setShowAllExams] = React.useState(false);

  // OCR States
  const [isOcrProcessing, setIsOcrProcessing] = React.useState(false);
  const [ocrProgress, setOcrProgress] = React.useState(0);
  const [ocrStatusText, setOcrStatusText] = React.useState('');
  const ocrFileInputRef = React.useRef<HTMLInputElement>(null);


  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [facingMode, setFacingMode] = React.useState<'environment' | 'user'>('environment');

  const { toast } = useToast();

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const scanIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const isScanActiveRef = React.useRef(true);

  // Hydration fix
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // New state for post-action UX
  const [showPostActionDialog, setShowPostActionDialog] = React.useState(false);


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
    const attemptFetch = async () => {
      const { data, error } = await supabase
        .from('movimentacoes')
        .select('*')
        .eq('movimentoId', movimentoId)
        .single();
      return { data, error };
    };

    let result = await attemptFetch();

    if (result.error || !result.data) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      result = await attemptFetch();
    }

    if (result.error || !result.data) {
      throw new Error("Guia de movimentaÃ§Ã£o nÃ£o encontrada no banco de dados.");
    }

    const movData = result.data;

    const { data: patientDataSB, error: patientError } = await supabase
      .from('pacientes')
      .select('id, name:nome, cpf, telefone, email, endereco, matricula, idade, genero, dataNascimento:data_nascimento, codPaciente:cod_paciente, healthPlanCode:health_plan_code, healthPlanName:health_plan_name')
      .eq('id', movData.pacienteId)
      .single();
    if (patientError || !patientDataSB) throw new Error("Paciente nÃ£o encontrado.");
    const patientData = patientDataSB as unknown as Patient;

    const { data: medicoDataSB, error: medicoError } = await supabase
      .from('usuarios')
      .select('id, name:nome, crm:crm_uf, telefone, codMed:codigo')
      .eq('id', movData.medicoId)
      .single();
    if (medicoError || !medicoDataSB) throw new Error("MÃ©dico nÃ£o encontrado.");
    const medicoData = medicoDataSB as unknown as Medico;

    let examsData: Exam[] = [];
    if (movData.exameIds && movData.exameIds.length > 0) {
      const { data: examsDataSB, error: examsError } = await supabase
        .from('exames')
        .select('id, name:nome, description:descricao, type:tipo, examCode:codigo, idExame:id_exame')
        .in('id', movData.exameIds);
      if (!examsError && examsDataSB) {
        examsData = examsDataSB as unknown as Exam[];
      }
    }

    return {
      movimentoId: movData.movimentoId,
      data: movData.data,
      patient: patientData,
      medico: medicoData,
      exams: examsData
    };
  }, [supabase]);

  const saveLeitura = React.useCallback(async (data: DecodedGuideData): Promise<string | null> => {
    if (!user) {
      console.warn("UsuÃ¡rio nÃ£o autenticado para salvar leitura.");
      return null;
    }

    const leituraInput: LeituraInput = {
      movimentoId: data.movimentoId,
      dataLeitura: new Date().toISOString(),
      usuarioNome: user.nome,
      usuarioId: user.id,
      pacienteNome: data.patient.name,
      pacienteCpf: data.patient.cpf,
      pacienteTelefone: data.patient.telefone || '',
      pacienteHealthPlanCode: data.patient.healthPlanCode,
      pacienteHealthPlanName: data.patient.healthPlanName,
      pacienteMatricula: data.patient.matricula || '',
      pacienteIdade: data.patient.idade || '',
      pacienteGenero: data.patient.genero || '',
      medicoNome: data.medico.name,
      medicoCrm: data.medico.crm,
      exames: data.exams.map(e => ({
        examCode: e.examCode,
        idExame: e.idExame || e.examCode,
        name: e.name,
        description: e.description,
        type: e.type,
      })),
    };

    const result = await addLeitura(leituraInput);
    if (result.success && result.codLeitura) {
      return result.codLeitura;
    }
    return null;
  }, [user, addLeitura]);


  const processScannedData = React.useCallback(async (scannedId: string) => {
    stopScan();
    setIsProcessing(true);
    setError(null);

    try {
      const fullData = await fetchGuiaData(scannedId);
      setDecodedData(fullData);

      // Salvar leitura no Firestore
      const codigo = await saveLeitura(fullData);
      if (codigo) {
        setCodLeitura(codigo);
        toast({
          title: "Leitura Registrada!",
          description: `Guia lida e registrada com cÃ³digo ${codigo}.`,
        });
      } else {
        toast({
          title: "Sucesso!",
          description: "Guia lida e processada.",
        });
      }

    } catch (e: any) {
      setError(e.message || "Formato de dados invÃ¡lido ou erro ao processar.");
      toast({
        variant: "destructive",
        title: "Erro na Leitura",
        description: e.message || "NÃ£o foi possÃ­vel processar o QR Code."
      })
      isScanActiveRef.current = true;
    } finally {
      setIsProcessing(false);
    }
  }, [stopScan, fetchGuiaData, saveLeitura, toast]);

  const tick = React.useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!isScanActiveRef.current) {
      return;
    }

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
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

  // Filtering Logic for Manual Modal
  const filteredPatients = React.useMemo(() => {
    if (!manualPatientSearch) return patients;
    return patients.filter(p =>
      p.name.toLowerCase().includes(manualPatientSearch.toLowerCase())
    );
  }, [patients, manualPatientSearch]);

  const filteredMedicos = React.useMemo(() => {
    if (!manualMedicoSearch) return medicos;
    return medicos.filter(m =>
      m.name.toLowerCase().includes(manualMedicoSearch.toLowerCase())
    );
  }, [medicos, manualMedicoSearch]);

  const currentPatient = React.useMemo(() => {
    return patients.find(p => p.id === manualPatientId);
  }, [patients, manualPatientId]);

  const filteredExams = React.useMemo(() => {
    let baseExams = exams;

    if (currentPatient && currentPatient.healthPlanName && !showAllExams) {
      baseExams = exams.filter(e =>
        !e.healthPlanName ||
        e.healthPlanName.trim() === '' ||
        e.healthPlanName.trim().toLowerCase() === currentPatient.healthPlanName.trim().toLowerCase()
      );
    }

    if (!manualExamSearch) return baseExams;

    const searchLower = manualExamSearch.toLowerCase();
    return baseExams.filter(e =>
      e.name.toLowerCase().includes(searchLower) ||
      (e.idExame && e.idExame.toLowerCase().includes(searchLower)) ||
      e.examCode.toLowerCase().includes(searchLower)
    );
  }, [exams, manualExamSearch, currentPatient, showAllExams]);

  const handleManualSubmit = async () => {
    if (!manualPatientId || !manualMedicoId || manualExamIds.length === 0) {
      toast({ title: "Dados incompletos", variant: "destructive", description: "Por favor, preencha todos os campos obrigatÃ³rios." });
      return;
    }

    setIsProcessing(true);
    try {
      const result = await createMovimento(manualPatientId, manualMedicoId, manualExamIds, true);
      if (result.success && result.movimentoId) {
        setIsManualModalOpen(false);
        // Limpar estados manuais
        setManualPatientId('');
        setManualMedicoId('');
        setManualExamIds([]);
        setManualPatientSearch('');
        setManualMedicoSearch('');
        setManualExamSearch('');

        // Agora processa como se fosse um QR Code lido
        await processScannedData(result.movimentoId);
      } else {
        toast({ title: "Erro ao criar guia", description: result.message, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro Fatal", description: e.message || "Ocorreu um erro ao registrar a guia manual.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

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
        title: "CÃ¢mera nÃ£o autorizada",
        description: "Por favor, autorize o acesso Ã  cÃ¢mera para ler QR Codes."
      });
    }
  }, [stopScan, tick, toast]);

  const handleOcrImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    stopScan();
    setError(null);
    setDecodedData(null);
    setCodLeitura(null);
    setIsOcrProcessing(true);
    setOcrStatusText('Iniciando anÃ¡lise inteligente da imagem...');
    
    try {
      let extractedText = '';

      if (file.type === 'application/pdf') {
        setOcrStatusText('Lendo documento PDF original...');
        // Para evitar conflitos de compilaÃ§Ã£o com o Next.js e o Webpack (DOMMatrix error),
        // carregamos a biblioteca PDF.js dinamicamente e de forma segura via CDN.
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
        setOcrStatusText('Lendo conteÃºdo do arquivo de texto...');
        extractedText = await file.text();

      } else {
        // Fallback to fallback image OCR (Tesseract)
        setOcrStatusText('Iniciando anÃ¡lise inteligente da imagem...');
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
      }
      
      console.log("TEXTO LIDO/EXTRAÃDO:", extractedText);
      setOcrStatusText('Procurando exames correspondentes...');

      // 2. Analisar o texto com fuse.js usando os exames cadastrados da clÃ­nica
      // A flexibilidade (threshold) foi aumentada para tolerar caligrafia lida de forma imperfeita
      const fuse = new Fuse(exams, {
        keys: ['name', 'examCode', 'idExame'],
        threshold: 0.6, // Extremamente flexÃ­vel para OCR manuscrito
        includeScore: true,
        ignoreLocation: true,
      });
      
      const matchedExamIds = new Set<string>();
      
      // Normaliza o texto (remove acentos e caracteres muito estranhos que o OCR cospe)
      // Ajuste para colar hÃ­fens curtos e longos (travessÃµes do Word) e nÃ£o quebrar exames como CA-15.3
      const cleanText = extractedText
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/\s*[-\u2013\u2014_]\s*/g, "-")
        .replace(/\s{2,}/g, " ");
        
      const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
      
      lines.forEach(line => {
        const results = fuse.search(line);
        // CorrespondÃªncia por linha inteira (score < 0.5)
        if (results.length > 0 && results[0].score !== undefined && results[0].score < 0.55) {
           matchedExamIds.add(results[0].item.id);
        }
        
        // CorrespondÃªncia palavra por palavra ou palavra isolada (score < 0.45)
        // Reduzido para w.length > 2 para aceitar siglas curtas como TSH, FSH, HIV, TGO, TGP
        // Evitado o particionamento por hÃ­fen
        const words = line.split(/[\s,;]+/).filter(w => w.length > 2);
        words.forEach(word => {
            const wordResults = fuse.search(word);
            if (wordResults.length > 0 && wordResults[0].score !== undefined && wordResults[0].score < 0.45) {
               matchedExamIds.add(wordResults[0].item.id);
            }
        });
      });

      // 3. Apresentar os resultados na mesma janela Manual
      if (matchedExamIds.size > 0) {
        setManualExamIds(Array.from(matchedExamIds));
        toast({ title: "Leitura Inteligente ConcluÃ­da", description: `Encontramos ${matchedExamIds.size} possÃ­veis exame(s). Por favor, audite a seleÃ§Ã£o.`, variant: "default" });
      } else {
        toast({ title: "Aviso", description: "O OCR leu a imagem, mas nÃ£o encontrou exames cadastrados correspondentes. VocÃª pode marcÃ¡-los manualmente.", variant: "default" });
      }
      
      // Abre o modal manual
      setIsManualModalOpen(true);
      setShowAllExams(true); // Mostrar todos para o caso dos exames nÃ£o fazerem parte do plano padrÃ£o
      
    } catch (err: any) {
      console.error("Erro no OCR:", err);
      toast({ title: "Erro na Leitura", description: "Falha ao analisar a imagem inteligente.", variant: "destructive" });
    } finally {
      setIsOcrProcessing(false);
      setOcrProgress(0);
      if (ocrFileInputRef.current) ocrFileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    stopScan();
    setError(null);
    setDecodedData(null);
    setCodLeitura(null);
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
    setCodLeitura(null);
    setError(null);
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    startCameraStream(facingMode);
  }

  // --- Export Functions ---
  const buildExportData = () => {
    if (!decodedData) return null;
    return {
      leitura: {
        codigo: codLeitura || 'N/A',
        dataLeitura: new Date().toLocaleString('pt-BR'),
      },
      movimentacao: {
        movimentoId: decodedData.movimentoId,
        dataMovimentacao: new Date(decodedData.data).toLocaleString('pt-BR'),
      },
      paciente: {
        nome: decodedData.patient.name,
        cpf: decodedData.patient.cpf,
        telefone: decodedData.patient.telefone,
        planoId: decodedData.patient.healthPlanCode,
        planoNome: decodedData.patient.healthPlanName,
        matricula: decodedData.patient.matricula || 'N/A',
        idade: decodedData.patient.idade || 'N/A',
        genero: decodedData.patient.genero || 'N/A',
      },
      medico: {
        nome: decodedData.medico.name,
        crm: decodedData.medico.crm,
      },
      exames: decodedData.exams.map(e => ({
        codigo: e.idExame || e.examCode, // Exportando id-exame corretamente
        nome: e.name,
        descricao: e.description,
        tipo: e.type,
      })),
    };
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getBaseFilename = () => {
    const cod = codLeitura || 'LEITURA';
    const pacNome = decodedData?.patient.name.replace(/\s+/g, '_') || 'paciente';
    const dataStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    return `${cod}_${pacNome}_${dataStr}`;
  };

  const handleExportJSON = () => {
    const data = buildExportData();
    if (!data) return;
    const content = JSON.stringify(data, null, 2);
    downloadFile(content, `${getBaseFilename()}.json`, 'application/json');
    toast({ title: 'Exportado!', description: 'Arquivo JSON baixado com sucesso.' });
    setShowPostActionDialog(true);
  };

  const handleExportXML = () => {
    const data = buildExportData();
    if (!data) return;

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<guia>\n';
    xml += `  <leitura>\n`;
    xml += `    <codigo>${data.leitura.codigo}</codigo>\n`;
    xml += `    <dataLeitura>${data.leitura.dataLeitura}</dataLeitura>\n`;
    xml += `  </leitura>\n`;
    xml += `  <movimentacao>\n`;
    xml += `    <movimentoId>${data.movimentacao.movimentoId}</movimentoId>\n`;
    xml += `    <dataMovimentacao>${data.movimentacao.dataMovimentacao}</dataMovimentacao>\n`;
    xml += `  </movimentacao>\n`;
    xml += `  <paciente>\n`;
    xml += `    <nome>${escapeXml(data.paciente.nome)}</nome>\n`;
    xml += `    <cpf>${data.paciente.cpf}</cpf>\n`;
    xml += `    <telefone>${data.paciente.telefone}</telefone>\n`;
    xml += `    <planoId>${data.paciente.planoId}</planoId>\n`;
    xml += `    <planoNome>${escapeXml(data.paciente.planoNome)}</planoNome>\n`;
    xml += `    <matricula>${data.paciente.matricula}</matricula>\n`;
    xml += `    <idade>${data.paciente.idade}</idade>\n`;
    xml += `    <genero>${data.paciente.genero}</genero>\n`;
    xml += `  </paciente>\n`;
    xml += `  <medico>\n`;
    xml += `    <nome>${escapeXml(data.medico.nome)}</nome>\n`;
    xml += `    <crm>${data.medico.crm}</crm>\n`;
    xml += `  </medico>\n`;
    xml += `  <exames>\n`;
    data.exames.forEach(e => {
      xml += `    <exame>\n`;
      xml += `      <codigo>${e.codigo}</codigo>\n`;
      xml += `      <nome>${escapeXml(e.nome)}</nome>\n`;
      xml += `      <descricao>${escapeXml(e.descricao)}</descricao>\n`;
      xml += `      <tipo>${e.tipo}</tipo>\n`;
      xml += `    </exame>\n`;
    });
    xml += `  </exames>\n`;
    xml += '</guia>\n';

    downloadFile(xml, `${getBaseFilename()}.xml`, 'application/xml');
    toast({ title: 'Exportado!', description: 'Arquivo XML baixado com sucesso.' });
    setShowPostActionDialog(true);
  };

  const handleExportTXT = () => {
    const data = buildExportData();
    if (!data) return;

    let txt = '=== GUIA DE LEITURA ===\n\n';
    txt += `CÃ³digo Leitura: ${data.leitura.codigo}\n`;
    txt += `Data Leitura: ${data.leitura.dataLeitura}\n`;
    txt += `MovimentaÃ§Ã£o: ${data.movimentacao.movimentoId}\n`;
    txt += `Data MovimentaÃ§Ã£o: ${data.movimentacao.dataMovimentacao}\n\n`;
    txt += '--- PACIENTE ---\n';
    txt += `Nome: ${data.paciente.nome}\n`;
    txt += `CPF: ${data.paciente.cpf}\n`;
    txt += `Telefone: ${data.paciente.telefone}\n`;
    txt += `Plano ID: ${data.paciente.planoId}\n`;
    txt += `Plano: ${data.paciente.planoNome}\n`;
    txt += `MatrÃ­cula: ${data.paciente.matricula}\n`;
    txt += `Idade: ${data.paciente.idade}\n`;
    txt += `GÃªnero: ${data.paciente.genero}\n\n`;
    txt += '--- MÃ‰DICO ---\n';
    txt += `Nome: ${data.medico.nome}\n`;
    txt += `CRM: ${data.medico.crm}\n\n`;
    txt += '--- EXAMES SOLICITADOS ---\n';
    data.exames.forEach((e, i) => {
      txt += `${i + 1}. ${e.codigo} - ${e.nome} (${e.tipo})\n`;
      txt += `   DescriÃ§Ã£o: ${e.descricao}\n`;
    });

    downloadFile(txt, `${getBaseFilename()}.txt`, 'text/plain');
    toast({ title: 'Exportado!', description: 'Arquivo TXT baixado com sucesso.' });
    setShowPostActionDialog(true);
  };

  const handlePrintLeitura = () => {
    if (!decodedData) return;

    // Open the official print route in a new tab to ensure it looks EXACTLY like the doctor's generated guide,
    // including the QR code, formatting, and layout.
    window.open(`/print/${encodeURIComponent(decodedData.movimentoId)}?origin=scan`, '_blank');
    
    // We can also trigger the post-action dialog
    setShowPostActionDialog(true);
  };

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Carregando Scanner...</p>
      </div>
    );
  }

  return (
    <>
      <PageTitle title="Leitura de QR Code" description="Aponte a cÃ¢mera para um QR Code ou envie um arquivo de imagem.">
        <Button variant="outline" asChild>
          <Link href="/">
            <Undo2 className="mr-2 h-4 w-4" />
            Voltar ao Menu
          </Link>
        </Button>
      </PageTitle>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Scanner</CardTitle>
            <CardDescription>
              Aponte a cÃ¢mera para o QR Code ou utilize as opÃ§Ãµes abaixo.
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
                  <p className="mt-4 font-semibold">Acesso Ã  cÃ¢mera negado</p>
                  <p className="text-sm text-center mt-2">Por favor, habilite a permissÃ£o de cÃ¢mera no seu navegador ou envie um arquivo.</p>
                  <Button onClick={() => startCameraStream(facingMode)} variant="secondary" className="mt-4">
                    <Camera className="mr-2" />
                    Tentar Novamente
                  </Button>
                </div>
              )}
              {hasCameraPermission === null && !isProcessing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
                  <Loader2 className="h-16 w-16 mx-auto animate-spin" />
                  <p className="mt-4 font-semibold">Aguardando cÃ¢mera...</p>
                </div>
              )}
            </div>
            <div className="mt-4 space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={handleSwitchCamera} className="flex-1" variant="outline" disabled={!hasCameraPermission}>
                  <SwitchCamera className="mr-2 h-4 w-4" />
                  Trocar CÃ¢mera
                </Button>
                {(decodedData || error) && (
                  <Button onClick={resetStateAndScan} className="flex-1" variant="outline">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Ler Nova Guia
                  </Button>
                )}
              </div>
              <div className="grid w-full items-center gap-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">Entrada Externa / Sem QR Code:</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => setIsManualModalOpen(true)} className="w-full h-12" variant="secondary">
                    <Edit className="mr-2 h-5 w-5" />
                    Digitar Manualmente
                  </Button>
                  
                  <Button onClick={() => ocrFileInputRef.current?.click()} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md relative overflow-hidden" disabled={isOcrProcessing || isProcessing}>
                    <Input id="ocr-picture" type="file" accept="image/*,.pdf,text/plain" capture="environment" className="hidden" ref={ocrFileInputRef} onChange={handleOcrImageUpload} disabled={isOcrProcessing || isProcessing} />
                    {isOcrProcessing ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <ScanFace className="mr-2 h-5 w-5" />
                        Leitura Inteligente
                        <Sparkles className="absolute top-1.5 right-1.5 h-3 w-3 text-indigo-200" />
                      </>
                    )}
                  </Button>
                </div>
                
                {isOcrProcessing && (
                  <div className="mt-2 w-full p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-center flex flex-col items-center justify-center shadow-inner">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mb-2" />
                    <p className="text-sm font-semibold text-indigo-800">{ocrStatusText}</p>
                    {ocrProgress > 0 && ocrProgress < 100 && (
                      <div className="w-full bg-slate-200 rounded-full h-2 mt-3 overflow-hidden">
                        <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300" style={{ width: `${ocrProgress}%` }}></div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Ou Arquivo
                  </span>
                </div>
              </div>

              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="qr-picture">Enviar Imagem do QR Code</Label>
                <Input id="qr-picture" type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} disabled={isProcessing} />
              </div>

            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Dados Decodificados</CardTitle>
                <CardDescription>As informaÃ§Ãµes do QR Code aparecerÃ£o aqui.</CardDescription>
              </div>
              {(decodedData || error) && (
                <Button onClick={resetStateAndScan} variant="outline" size="sm">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Nova Leitura
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {error && !decodedData && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erro na Leitura</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {decodedData ? (
              <div className="space-y-6">
                {/* CabeÃ§alho da Leitura */}
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex justify-between items-center">
                    {codLeitura && (
                      <p className="text-sm font-bold text-primary">CÃ³digo: {codLeitura}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      <strong>Leitura:</strong> {new Date().toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs text-muted-foreground">
                      <strong>MovimentaÃ§Ã£o:</strong> {decodedData.movimentoId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <strong>Data Mov.:</strong> {new Date(decodedData.data).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>

                <Separator />
                <div>
                  <h3 className="text-lg font-semibold text-primary flex items-center gap-2"><User />InformaÃ§Ãµes do Paciente</h3>
                  <div className="mt-2 space-y-1 text-sm pl-8">
                    <p><strong>Nome:</strong> {decodedData.patient.name}</p>
                    <p><strong>CPF:</strong> {decodedData.patient.cpf}</p>
                    <p><strong>Telefone:</strong> {decodedData.patient.telefone}</p>
                    <p><strong>ID Plano:</strong> {decodedData.patient.healthPlanCode}</p>
                    <p><strong>Plano:</strong> {decodedData.patient.healthPlanName}</p>
                    <p><strong>MatrÃ­cula:</strong> {decodedData.patient.matricula || 'N/A'}</p>
                    <p><strong>Idade:</strong> {decodedData.patient.idade || '-'}</p>
                    <p><strong>GÃªnero:</strong> {decodedData.patient.genero || '-'}</p>
                  </div>
                </div>
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold text-primary flex items-center gap-2"><Stethoscope />MÃ©dico ResponsÃ¡vel</h3>
                  <div className="mt-2 space-y-1 text-sm pl-8">
                    <p><strong>Nome:</strong> Dr(a). {decodedData.medico.name}</p>
                    <p><strong>CRM:</strong> {decodedData.medico.crm}</p>
                  </div>
                </div>
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold text-primary flex items-center gap-2"><FileText />Exames Solicitados ({decodedData.exams.length})</h3>
                  <div className="mt-2 space-y-2 pl-8">
                    {decodedData.exams.length > 0 ? decodedData.exams.map(exam => (
                      <div key={exam.id} className="p-2 border rounded-md text-sm">
                        <p className="font-semibold">{exam.idExame || ''} - {exam.name}</p>
                        <p className="text-xs text-muted-foreground">{exam.description}</p>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground italic">Nenhum exame encontrado para esta movimentaÃ§Ã£o.</p>
                    )}
                  </div>
                </div>

                {/* AÃ§Ãµes: PDF e ExportaÃ§Ã£o */}
                <Separator />
                <div className="flex flex-col items-center justify-center p-4 bg-white border border-dashed border-gray-300 rounded-lg">
                  <p className="text-sm font-bold text-gray-500 mb-2 uppercase">QR Code da Guia</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=${encodeURIComponent(decodedData.movimentoId)}`}
                    width={160}
                    height={160}
                    alt={`QR Code para a guia ${decodedData.movimentoId}`}
                    className="opacity-90 hover:opacity-100 transition-opacity"
                  />
                  <p className="text-[10px] text-muted-foreground mt-2 text-center">Este cÃ³digo pode ser lido por outros dispositivos na clÃ­nica para acesso rÃ¡pido Ã  guia.</p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                    <Download /> AÃ§Ãµes
                  </h3>

                  <Button onClick={handlePrintLeitura} className="w-full" variant="default">
                    <FileText className="mr-2 h-4 w-4" />
                    Gerar PDF da Leitura
                  </Button>

                  <div className="grid grid-cols-3 gap-2">
                    <Button onClick={handleExportJSON} variant="outline" size="sm">
                      <FileJson className="mr-2 h-4 w-4" />
                      JSON
                    </Button>
                    <Button onClick={handleExportXML} variant="outline" size="sm">
                      <FileCode className="mr-2 h-4 w-4" />
                      XML
                    </Button>
                    <Button onClick={handleExportTXT} variant="outline" size="sm">
                      <FileType className="mr-2 h-4 w-4" />
                      TXT
                    </Button>
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

      <AlertDialog open={showPostActionDialog} onOpenChange={setShowPostActionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>AÃ§Ã£o ConcluÃ­da</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo/PDF foi gerado com sucesso. Deseja realizar a leitura de uma nova guia agora?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>NÃ£o, manter tela atual</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowPostActionDialog(false);
              resetStateAndScan();
            }}>
              Sim, Nova Leitura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manual Input Modal */}
      <Dialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" />
              Guia Externa / Manual
            </DialogTitle>
            <DialogDescription>
              Preencha os dados da guia fÃ­sica para gerar o movimento digital.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="space-y-6 pt-2">
              {/* Paciente */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Paciente</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pl-0.5" />
                  <Input
                    placeholder="Filtrar por nome..."
                    value={manualPatientSearch}
                    onChange={(e) => setManualPatientSearch(e.target.value)}
                    className="pl-10 text-sm h-9"
                  />
                </div>
                <Select value={manualPatientId} onValueChange={setManualPatientId}>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Selecione o paciente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredPatients.length > 0 ? filteredPatients.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    )) : (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        Nenhum paciente encontrado.
                        <Button asChild variant="link" size="sm" className="mt-1 block mx-auto">
                          <Link href="/patients?tab=register">Cadastrar Novo</Link>
                        </Button>
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* MÃ©dico */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">MÃ©dico ResponsÃ¡vel</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pl-0.5" />
                  <Input
                    placeholder="Filtrar por nome..."
                    value={manualMedicoSearch}
                    onChange={(e) => setManualMedicoSearch(e.target.value)}
                    className="pl-10 text-sm h-9"
                  />
                </div>
                <Select value={manualMedicoId} onValueChange={setManualMedicoId}>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Selecione o mÃ©dico..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredMedicos.length > 0 ? filteredMedicos.map((m) => (
                      <SelectItem key={m.id} value={m.id}>Dr(a). {m.name}</SelectItem>
                    )) : (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        Nenhum mÃ©dico encontrado.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Exames */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Exames Solicitados</Label>
                  <div className="flex items-center gap-1.5 bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">
                    <Checkbox
                      id="show-all-exams"
                      className="h-3.5 w-3.5"
                      checked={showAllExams}
                      onCheckedChange={(c) => setShowAllExams(!!c)}
                    />
                    <label htmlFor="show-all-exams" className="text-[11px] cursor-pointer font-medium text-primary">Mostrar Todos</label>
                  </div>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pl-0.5" />
                  <Input
                    placeholder="Filtrar exames..."
                    value={manualExamSearch}
                    onChange={(e) => setManualExamSearch(e.target.value)}
                    className="pl-10 text-sm h-9"
                  />
                </div>

                {currentPatient?.healthPlanName && !showAllExams && (
                  <p className="text-[10px] text-amber-600 font-medium px-1 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Filtrando para o plano: {currentPatient.healthPlanName}
                  </p>
                )}

                <div className="border rounded-md p-3 space-y-3 mt-2 h-48 overflow-y-auto bg-slate-50/30">
                  {/* Loading State for Exams */}
                  {!exams.length && (
                    <div className="flex flex-col items-center justify-center h-full py-4 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mb-2" />
                      <p className="text-[10px]">Carregando exames da clÃ­nica...</p>
                    </div>
                  )}

                  {exams.length > 0 && filteredExams.length > 0 ? filteredExams.map((exam) => (
                    <div key={exam.id} className="flex items-center space-x-2 py-0.5">
                      <Checkbox
                        id={`manual-exam-${exam.id}`}
                        checked={manualExamIds.includes(exam.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setManualExamIds(prev => [...prev, exam.id]);
                          } else {
                            setManualExamIds(prev => prev.filter(id => id !== exam.id));
                          }
                        }}
                      />
                      <label 
                        htmlFor={`manual-exam-${exam.id}`}
                        className="text-sm leading-tight cursor-pointer select-none flex-1"
                      >
                        <span className="font-bold text-[11px] text-primary">{exam.idExame || exam.examCode}</span> - {exam.name}
                      </label>
                    </div>
                  )) : exams.length > 0 && (
                    <div className="text-center py-8 px-4">
                      <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500 opacity-50" />
                      <p className="text-xs font-bold text-slate-700">Nenhum exame encontrado.</p>
                      {currentPatient?.healthPlanName && !showAllExams ? (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Este paciente possui convÃªnio. Tente ativar o botÃ£o <b>"Mostrar Todos"</b> no topo desta lista.
                        </p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Nenhum exame corresponde Ã  sua busca ou os dados ainda estÃ£o sendo processados.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 pt-2 bg-slate-50 dark:bg-slate-900/50 border-t">
            <Button variant="ghost" onClick={() => setIsManualModalOpen(false)} disabled={isProcessing}>
              Cancelar
            </Button>
            <Button onClick={handleManualSubmit} disabled={isProcessing || !manualPatientId || !manualMedicoId || manualExamIds.length === 0}>
              {movementApiLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <FileCheck2 className="mr-2 h-4 w-4" />
                  Registrar e Decodificar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
