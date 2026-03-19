"use client";

import * as React from 'react';
import jsQR from 'jsqr';
import { jsPDF } from 'jspdf';
import { createClient } from '@/lib/supabase/client';
import { FileCheck2, Loader2, AlertTriangle, VideoOff, User, FileText, Stethoscope, RefreshCw, Camera, Upload, SwitchCamera, Undo2, Download, FileJson, FileCode, FileType } from 'lucide-react';
import { PageTitle } from '@/components/layout/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Patient, Medico, Exam, Movimentacao } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useSession } from '@/context/session-context';
import { useLeituras, LeituraInput } from '@/hooks/use-leituras';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
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
  const [decodedData, setDecodedData] = React.useState<DecodedGuideData | null>(null);
  const [codLeitura, setCodLeitura] = React.useState<string | null>(null);
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
      throw new Error("Guia de movimentação não encontrada no banco de dados.");
    }

    const movData = result.data;

    const { data: patientDataSB, error: patientError } = await supabase
      .from('pacientes')
      .select('id, name:nome, cpf, telefone, email, endereco, matricula, idade, genero, dataNascimento:data_nascimento, codPaciente:cod_paciente, healthPlanCode:health_plan_code, healthPlanName:health_plan_name')
      .eq('id', movData.pacienteId)
      .single();
    if (patientError || !patientDataSB) throw new Error("Paciente não encontrado.");
    const patientData = patientDataSB as unknown as Patient;

    const { data: medicoDataSB, error: medicoError } = await supabase
      .from('usuarios')
      .select('id, name:nome, crm:crm_uf, telefone, codMed:codigo')
      .eq('id', movData.medicoId)
      .single();
    if (medicoError || !medicoDataSB) throw new Error("Médico não encontrado.");
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
      console.warn("Usuário não autenticado para salvar leitura.");
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
          description: `Guia lida e registrada com código ${codigo}.`,
        });
      } else {
        toast({
          title: "Sucesso!",
          description: "Guia lida e processada.",
        });
      }

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
    txt += `Código Leitura: ${data.leitura.codigo}\n`;
    txt += `Data Leitura: ${data.leitura.dataLeitura}\n`;
    txt += `Movimentação: ${data.movimentacao.movimentoId}\n`;
    txt += `Data Movimentação: ${data.movimentacao.dataMovimentacao}\n\n`;
    txt += '--- PACIENTE ---\n';
    txt += `Nome: ${data.paciente.nome}\n`;
    txt += `CPF: ${data.paciente.cpf}\n`;
    txt += `Telefone: ${data.paciente.telefone}\n`;
    txt += `Plano ID: ${data.paciente.planoId}\n`;
    txt += `Plano: ${data.paciente.planoNome}\n`;
    txt += `Matrícula: ${data.paciente.matricula}\n`;
    txt += `Idade: ${data.paciente.idade}\n`;
    txt += `Gênero: ${data.paciente.genero}\n\n`;
    txt += '--- MÉDICO ---\n';
    txt += `Nome: ${data.medico.nome}\n`;
    txt += `CRM: ${data.medico.crm}\n\n`;
    txt += '--- EXAMES SOLICITADOS ---\n';
    data.exames.forEach((e, i) => {
      txt += `${i + 1}. ${e.codigo} - ${e.nome} (${e.tipo})\n`;
      txt += `   Descrição: ${e.descricao}\n`;
    });

    downloadFile(txt, `${getBaseFilename()}.txt`, 'text/plain');
    toast({ title: 'Exportado!', description: 'Arquivo TXT baixado com sucesso.' });
    setShowPostActionDialog(true);
  };

  const handlePrintLeitura = () => {
    if (!decodedData) return;

    // Using jsPDF to generate the PDF purely on the client side,
    // avoiding ANY router navigation or iframe focus bugs.
    // This behaves EXACTLY like the "Gerar TXT" button.
    try {
      const doc = new jsPDF();
      const margin = 15;
      let y = margin;

      // Header
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("PacienteMobile - Relatório de Leitura", margin, y);

      y += 10;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Código Leitura: ${codLeitura || 'N/A'}   |   Data Leitura: ${new Date().toLocaleString('pt-BR')}`, margin, y);

      y += 6;
      doc.text(`Movimentação: ${decodedData.movimentoId}`, margin, y);

      y += 6;
      doc.text(`Data do Pedido Original: ${new Date(decodedData.data).toLocaleString('pt-BR')}`, margin, y);

      doc.line(margin, y + 4, 210 - margin, y + 4);
      y += 12;

      // Paciente
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Dados do Paciente", margin, y);

      y += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Nome: ${decodedData.patient.name}`, margin, y);
      doc.text(`CPF: ${decodedData.patient.cpf}`, margin + 90, y);

      y += 6;
      doc.text(`Telefone: ${decodedData.patient.telefone || 'N/A'}`, margin, y);
      doc.text(`Plano: ${decodedData.patient.healthPlanName} (${decodedData.patient.healthPlanCode})`, margin + 90, y);

      y += 6;
      doc.text(`Matrícula: ${decodedData.patient.matricula || 'N/A'}`, margin, y);
      doc.text(`Idade: ${decodedData.patient.idade || 'N/A'}`, margin + 60, y);
      doc.text(`Gênero: ${decodedData.patient.genero || 'N/A'}`, margin + 120, y);

      doc.line(margin, y + 4, 210 - margin, y + 4);
      y += 12;

      // Medico
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Médico Responsável", margin, y);

      y += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Nome: Dr(a). ${decodedData.medico.name}`, margin, y);
      doc.text(`CRM: ${decodedData.medico.crm}`, margin + 90, y);

      doc.line(margin, y + 4, 210 - margin, y + 4);
      y += 12;

      // Exames
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Exames Solicitados (${decodedData.exams.length})`, margin, y);

      y += 8;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      decodedData.exams.forEach((exam, index) => {
        // Add new page if we are too low
        if (y > 270) {
          doc.addPage();
          y = margin + 10;
        }

        doc.setFont("helvetica", "bold");
        doc.text(`${index + 1}. ${exam.idExame || ''} - ${exam.name}`, margin, y);
        y += 5;

        doc.setFont("helvetica", "normal");
        const splitDesc = doc.splitTextToSize(`Descrição: ${exam.description}`, 180);
        doc.text(splitDesc, margin + 5, y);
        y += (splitDesc.length * 5) + 3;
      });

      // Save the PDF
      doc.save(`${getBaseFilename()}.pdf`);
      toast({ title: 'PDF Exportado!', description: 'O arquivo PDF foi baixado com sucesso.' });
      setShowPostActionDialog(true);

    } catch (e) {
      console.error("Erro ao gerar PDF local: ", e);
      toast({ variant: "destructive", title: 'Erro', description: 'Ocorreu um erro ao gerar o PDF.' });
    }
  };

  return (
    <>
      <PageTitle title="Leitura de QR Code" description="Aponte a câmera para um QR Code ou envie um arquivo de imagem.">
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
                    <Camera className="mr-2" />
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
                  <SwitchCamera className="mr-2 h-4 w-4" />
                  Trocar Câmera
                </Button>
                {(decodedData || error) && (
                  <Button onClick={resetStateAndScan} className="flex-1" variant="outline">
                    <RefreshCw className="mr-2 h-4 w-4" />
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
                <CardDescription>As informações do QR Code aparecerão aqui.</CardDescription>
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
                {/* Cabeçalho da Leitura */}
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex justify-between items-center">
                    {codLeitura && (
                      <p className="text-sm font-bold text-primary">Código: {codLeitura}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      <strong>Leitura:</strong> {new Date().toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs text-muted-foreground">
                      <strong>Movimentação:</strong> {decodedData.movimentoId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <strong>Data Mov.:</strong> {new Date(decodedData.data).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>

                <Separator />
                <div>
                  <h3 className="text-lg font-semibold text-primary flex items-center gap-2"><User />Informações do Paciente</h3>
                  <div className="mt-2 space-y-1 text-sm pl-8">
                    <p><strong>Nome:</strong> {decodedData.patient.name}</p>
                    <p><strong>CPF:</strong> {decodedData.patient.cpf}</p>
                    <p><strong>Telefone:</strong> {decodedData.patient.telefone}</p>
                    <p><strong>ID Plano:</strong> {decodedData.patient.healthPlanCode}</p>
                    <p><strong>Plano:</strong> {decodedData.patient.healthPlanName}</p>
                    <p><strong>Matrícula:</strong> {decodedData.patient.matricula || 'N/A'}</p>
                    <p><strong>Idade:</strong> {decodedData.patient.idade || '-'}</p>
                    <p><strong>Gênero:</strong> {decodedData.patient.genero || '-'}</p>
                  </div>
                </div>
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold text-primary flex items-center gap-2"><Stethoscope />Médico Responsável</h3>
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
                      <p className="text-sm text-muted-foreground italic">Nenhum exame encontrado para esta movimentação.</p>
                    )}
                  </div>
                </div>

                {/* Ações: PDF e Exportação */}
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                    <Download /> Ações
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
            <AlertDialogTitle>Ação Concluída</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo/PDF foi gerado com sucesso. Deseja realizar a leitura de uma nova guia agora?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não, manter tela atual</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowPostActionDialog(false);
              resetStateAndScan();
            }}>
              Sim, Nova Leitura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
