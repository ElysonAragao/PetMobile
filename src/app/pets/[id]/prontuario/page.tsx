"use client";

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Undo2, Plus, FileText, Activity, CalendarDays, Download, Stethoscope, Edit2, FilePlus, QrCode, UploadCloud, Printer, Trash2, Image as ImageIcon, X } from 'lucide-react';
import { useForm } from "react-hook-form";
import { format, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { PageTitle } from '@/components/layout/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from "@/hooks/use-toast";

import { usePets } from '@/hooks/use-pets';
import { useUsers } from '@/hooks/use-user-management';
import { useProntuarios, ProntuarioInsert, Prontuario } from '@/hooks/use-prontuarios';
import { useDocumentos, DocumentoInsert } from '@/hooks/use-documentos';
import { useModelos } from '@/hooks/use-modelos';
import { useSession } from '@/context/session-context';
import { exportToCSV, exportToPDF, exportToTXT } from '@/lib/export-utils';
import { createClient } from '@/lib/supabase/client';
import imageCompression from 'browser-image-compression';

function numeroPorExtenso(numero: number): string {
    const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
    const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
    const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

    if (numero === 0) return "zero";
    if (numero === 100) return "cem";

    let extenso = "";
    
    let reais = Math.floor(numero);
    let centavos = Math.round((numero - reais) * 100);

    const parseBlock = (n: number) => {
        if (n === 0) return "";
        if (n === 100) return "cem";
        let str = "";
        const c = Math.floor(n / 100);
        const rest = n % 100;
        if (c > 0) {
            str += centenas[c];
            if (rest > 0) str += " e ";
        }
        if (rest > 0) {
            if (rest < 20) {
                str += unidades[rest];
            } else {
                const d = Math.floor(rest / 10);
                const u = rest % 10;
                str += dezenas[d];
                if (u > 0) str += " e " + unidades[u];
            }
        }
        return str;
    };

    if (reais > 0) {
        const milhares = Math.floor(reais / 1000);
        const resto = reais % 1000;
        
        if (milhares > 0) {
            if (milhares === 1) extenso += "um mil";
            else extenso += parseBlock(milhares) + " mil";
            
            if (resto > 0) {
                if (resto <= 100 || resto % 100 === 0) extenso += " e ";
                else extenso += " ";
            }
        }
        
        if (resto > 0) {
            extenso += parseBlock(resto);
        }
        
        extenso += reais === 1 ? " real" : " reais";
    }

    if (centavos > 0) {
        if (reais > 0) extenso += " e ";
        extenso += parseBlock(centavos);
        extenso += centavos === 1 ? " centavo" : " centavos";
    }

    return extenso || "zero reais";
}

export default function ProntuarioPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { pets, isLoaded: petsLoaded } = usePets();
  const { users, isLoaded: usersLoaded } = useUsers();
  const { prontuarios, isLoaded: prontLoaded, addProntuario, updateProntuario, deleteProntuario } = useProntuarios(id);
  const { documentos, isLoaded: docsLoaded, addDocumento } = useDocumentos();
  const { modelos, isLoaded: modelosLoaded } = useModelos();
  const { user, isMaster } = useSession();
  const { toast } = useToast();

  const [isProntuarioOpen, setIsProntuarioOpen] = React.useState(false);
  const [isDocOpen, setIsDocOpen] = React.useState(false);
  const [isReciboOpen, setIsReciboOpen] = React.useState(false);
  const [submitAction, setSubmitAction] = React.useState<'save' | 'save_and_exams'>('save');
  const [reciboData, setReciboData] = React.useState({
      medico_id: '',
      valor: '',
      referente: 'Consulta médica realizada nesta data.',
      cidadeEstado: 'Aracaju/SE'
  });
  const [editingProntuario, setEditingProntuario] = React.useState<Prontuario | null>(null);
  const [editMode, setEditMode] = React.useState<'edit' | 'adendo' | 'new'>('new');
  const [medicoFilter, setMedicoFilter] = React.useState<string>('all');
  
  const [isUploading, setIsUploading] = React.useState(false);
  const [prontuarioImages, setProntuarioImages] = React.useState<any[]>([]);
  
  const supabase = React.useMemo(() => createClient(), []);

  const pet = pets.find(p => p.id === id);

  const veterinarios = React.useMemo(() => {
    return (users || []).filter(u => 
        u.status === 'MedicoVet' || 
        u.status === 'MedicoVet Geral'
    );
  }, [users]);
  
  const canSelectMedico = user?.status === 'Administrador' || user?.status === 'Master' || user?.status === 'Secretária' || user?.status === 'Secretária Geral' || user?.status === 'MedicoVet Geral';

  const formProntuario = useForm<ProntuarioInsert>({
    defaultValues: {
      pet_id: id,
      medico_id: '',
      tipo_atendimento: 'Consulta',
      queixa_principal: '',
      descricao_livre: '',
      prescricao_medica: '',
      status_retorno: 'Ativo',
      data_atendimento: new Date().toISOString().substring(0, 16)
    }
  });

  const formDoc = useForm<DocumentoInsert>({
    defaultValues: {
      prontuario_id: '',
      tipo_documento: 'Receita',
      conteudo: '',
      metadata: {}
    }
  });

  const applyModelo = (modeloId: string, isProntuario: boolean) => {
      const modelo = modelos.find(m => m.id === modeloId);
      if (!modelo) return;
      
      let text = modelo.conteudo;
      text = text.replace(/\{pet\}|\[pet\]|\{nome\}|\[nome\]|\{paciente\}|\[paciente\]/gi, pet?.nome || '');
      text = text.replace(/\{data\}|\[data\]/gi, format(new Date(), 'dd/MM/yyyy'));
      text = text.replace(/\{tutor\}|\[tutor\]/gi, pet?.tutorNome || '');
      text = text.replace(/\{cpf\}|\[cpf\]/gi, pet?.tutorCpf || '');
      text = text.replace(/\{especie\}|\[especie\]/gi, pet?.especie || '');
      
      if (isProntuario) {
          formProntuario.setValue('descricao_livre', text);
      } else {
          formDoc.setValue('conteudo', text);
      }
  };

  React.useEffect(() => {
    if (user?.id && !editingProntuario && !canSelectMedico) {
      formProntuario.setValue('medico_id', user.id);
    }
  }, [user, formProntuario, editingProntuario, canSelectMedico]);

  const petProntuarioIds = React.useMemo(() => prontuarios.map(p => p.id), [prontuarios]);
  const petDocumentos = React.useMemo(() => documentos.filter(d => petProntuarioIds.includes(d.prontuario_id)), [documentos, petProntuarioIds]);

  // Filtragem por médico
  const filteredProntuarios = React.useMemo(() => {
    if (medicoFilter === 'all') return prontuarios;
    return prontuarios.filter(p => p.medico_id === medicoFilter);
  }, [prontuarios, medicoFilter]);

  // Separação em duas listas
  const consultas = React.useMemo(() => filteredProntuarios.filter(p => p.tipo_atendimento.includes('Consulta')), [filteredProntuarios]);
  const demaisAtendimentos = React.useMemo(() => filteredProntuarios.filter(p => !p.tipo_atendimento.includes('Consulta')), [filteredProntuarios]);

  const handleExport = async (formatType: 'pdf' | 'csv' | 'txt') => {
      if (!pet) return;
      
      const rows = filteredProntuarios.map(pront => {
          const med = users.find(v => v.id === pront.medico_id);
          return {
              'Data': format(new Date(pront.data_atendimento), 'dd/MM/yyyy HH:mm'),
              'Tipo': pront.tipo_atendimento,
              'Médico': med?.nome || 'Não informado',
              'Descrição': pront.descricao_livre || '-',
              'Prescrição': pront.prescricao_medica || '-'
          };
      });

      const filename = `prontuario_${pet.nome.toLowerCase().replace(/\s/g, '_')}`;
      const title = `Histórico Clínico: ${pet.nome} (${pet.especie})`;

      if (formatType === 'csv') {
          await exportToCSV(filename, rows);
      } else if (formatType === 'txt') {
          await exportToTXT(filename, rows);
      } else {
          await exportToPDF(filename, title, rows);
      }
  };

  if (!petsLoaded || !prontLoaded || !docsLoaded || !usersLoaded || !modelosLoaded) {
    return <div className="p-8 text-center"><Activity className="animate-spin h-8 w-8 mx-auto mb-4" />Carregando prontuário...</div>;
  }

  if (!pet) {
    return <div className="p-8 text-center text-red-500">Pet não encontrado.</div>;
  }

  const openNewProntuario = () => {
    setEditingProntuario(null);
    setEditMode('new');
    formProntuario.reset({
      pet_id: id,
      medico_id: !canSelectMedico ? (user?.id || '') : '',
      tipo_atendimento: 'Consulta',
      queixa_principal: '',
      descricao_livre: '',
      prescricao_medica: '',
      status_retorno: 'Ativo',
      data_atendimento: new Date().toISOString().substring(0, 16)
    });
    setProntuarioImages([]);
    setIsProntuarioOpen(true);
  };

  const verifyEditPermission = (pront: Prontuario) => {
      const isOwner = user?.id === pront.medico_id;
      const isAuthor = user?.id === (pront as any).autor_registro_id;
      const isSpecial = user?.status === 'Master' || user?.status === 'Administrador';
      
      if (!isOwner && !isAuthor && !isSpecial) return null; 

      const dataAtendimento = new Date(pront.created_at || pront.data_atendimento);
      const hoursDiff = differenceInHours(new Date(), dataAtendimento);

      return hoursDiff <= 2 || isSpecial ? 'edit' : 'adendo';
  };

  const handleEditClick = (pront: Prontuario) => {
    const mode = verifyEditPermission(pront);
    if (!mode) return;

    setEditingProntuario(pront);
    setEditMode(mode);
    
    let baseText = pront.descricao_livre || '';
    if (mode === 'adendo') {
        baseText += `\n\n--- ADENDO (${format(new Date(), 'dd/MM HH:mm')}) ---\n`;
    }

    formProntuario.reset({
      pet_id: pront.pet_id,
      medico_id: pront.medico_id || user?.id || '',
      tipo_atendimento: pront.tipo_atendimento,
      queixa_principal: pront.queixa_principal || '',
      descricao_livre: baseText,
      prescricao_medica: pront.prescricao_medica || '',
      status_retorno: pront.status_retorno,
      data_atendimento: new Date(pront.data_atendimento).toISOString().substring(0, 16)
    });

    fetchImages(pront.id);
    setIsProntuarioOpen(true);
  };

  const fetchImages = async (prontId: string) => {
    try {
        const { data, error } = await supabase.storage.from('prontuarios').list(prontId);
        if (data) {
            setProntuarioImages(data.filter((f: any) => f.name !== '.emptyFolderPlaceholder'));
        }
    } catch (e) {
        console.error("Erro ao buscar imagens:", e);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editingProntuario) return;

      try {
          setIsUploading(true);
          const options = {
              maxSizeMB: 1,
              maxWidthOrHeight: 1920,
              useWebWorker: true,
          };
          
          const compressedFile = await imageCompression(file, options);
          
          const fileName = `${editingProntuario.id}/${Date.now()}_${file.name}`;
          
          const { error } = await supabase.storage
              .from('prontuarios')
              .upload(fileName, compressedFile);
              
          if (error) throw error;
          
          toast({ title: 'Sucesso', description: 'Imagem anexada com sucesso.' });
          fetchImages(editingProntuario.id);
      } catch (error: any) {
          toast({ title: 'Erro no Upload', description: error.message || 'Falha ao enviar imagem', variant: 'destructive' });
      } finally {
          setIsUploading(false);
          if (e.target) e.target.value = '';
      }
  };

  const handleDeleteImage = async (fileName: string) => {
      if (!editingProntuario || !window.confirm("Remover esta imagem?")) return;
      try {
          const { error } = await supabase.storage.from('prontuarios').remove([`${editingProntuario.id}/${fileName}`]);
          if (error) throw error;
          fetchImages(editingProntuario.id);
      } catch (error) {
          toast({ title: 'Erro', description: 'Não foi possível remover.', variant: 'destructive' });
      }
  };

  const onSubmitProntuario = async (values: ProntuarioInsert) => {
    if (editingProntuario && editMode !== 'new') {
        const res = await updateProntuario(editingProntuario.id, {
            queixa_principal: values.queixa_principal,
            descricao_livre: values.descricao_livre,
            prescricao_medica: values.prescricao_medica,
        });
        if (res.success) {
            toast({ title: 'Sucesso', description: editMode === 'adendo' ? 'Adendo registrado.' : 'Atendimento alterado.' });
            setIsProntuarioOpen(false);
        } else {
            toast({ title: 'Erro', description: res.message, variant: 'destructive' });
        }
        return;
    }

    const res = await addProntuario(values);
    if (res.success) {
      toast({ title: 'Sucesso', description: 'Prontuário adicionado com sucesso.' });
      setIsProntuarioOpen(false);
      
      if (submitAction === 'save_and_exams' && pet) {
          router.push(`/movement?mode=guia&newPetId=${pet.id}&from=prontuario`);
      }
    } else {
      toast({ title: 'Erro', description: res.message, variant: 'destructive' });
    }
  };

  const onSubmitDoc = async (values: DocumentoInsert) => {
    if (!values.prontuario_id) {
       toast({ title: 'Atenção', description: 'Selecione um prontuário para vincular o documento.', variant: 'destructive' });
       return;
    }
    const res = await addDocumento(values);
    if (res.success) {
      toast({ title: 'Sucesso', description: 'Documento gerado com sucesso.' });
      setIsDocOpen(false);
      formDoc.reset({ ...values, conteudo: '' });
    } else {
      toast({ title: 'Erro', description: res.message, variant: 'destructive' });
    }
  };

  const handleGerarRecibo = async () => {
      const numValor = parseFloat(reciboData.valor.replace(',', '.'));
      if (isNaN(numValor) || numValor <= 0) {
          toast({ title: 'Atenção', description: 'Informe um valor numérico válido.', variant: 'destructive' });
          return;
      }
      if (!reciboData.medico_id) {
          toast({ title: 'Atenção', description: 'Selecione um médico.', variant: 'destructive' });
          return;
      }

      const vet = users.find(u => u.id === reciboData.medico_id);
      const vetName = vet?.nome || '';
      const vetCrmv = vet?.crmvUf ? `CRMV: ${vet.crmvUf}` : '';
      
      const extenso = numeroPorExtenso(numValor);
      const dataHoje = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      
      const conteudoRecibo = `RECIBO

Valor: R$ ${numValor.toFixed(2).replace('.', ',')}

Recebi(emos) de ${pet?.tutorNome || '_________________________'}, portador(a) do CPF/CNPJ ${pet?.tutorCpf || '_________________'}, a importância de R$ ${numValor.toFixed(2).replace('.', ',')} (${extenso}), referente a ${reciboData.referente}.

Para maior clareza, firmo o presente recibo.

${reciboData.cidadeEstado}, ${dataHoje}`;

      const res = await addDocumento({
          prontuario_id: prontuarios.length > 0 ? prontuarios[0].id : '',
          tipo_documento: 'Recibo',
          conteudo: conteudoRecibo,
          metadata: { valor: numValor, extenso, referente: reciboData.referente }
      });

      if (res.success) {
          toast({ title: 'Sucesso', description: 'Recibo gerado com sucesso.' });
          setIsReciboOpen(false);
          // Opcional: já abrir a janela de impressão
          if (res.data?.id) window.open(`/print/doc/${res.data.id}`, '_blank');
      } else {
          toast({ title: 'Erro', description: res.message, variant: 'destructive' });
      }
  };

  const handleDeleteClick = async (id: string) => {
      if (window.confirm("Atenção! Tem certeza de que deseja excluir DEFINITIVAMENTE este atendimento do sistema?")) {
          const res = await deleteProntuario(id);
          if (res.success) {
              toast({ title: 'Sucesso', description: 'Atendimento apagado.' });
          } else {
              toast({ title: 'Erro', description: res.message, variant: 'destructive' });
          }
      }
  };

  const handleUploadPlaceholder = () => {
    toast({ title: "Upload Indisponível", description: "O módulo de Anexos/Arquivos (imagens e pdf) será liberado em breve, pois requer configuração do Storage.", variant: "default" });
  };

  return (
    <>
      <PageTitle title={`Prontuário: ${pet.nome}`} description={`CPF: ${pet.tutorCpf || 'N/A'} | Idade: ${pet.idade || 'N/A'} | Plano: ${pet.healthPlanName || 'PARTICULAR'}`}>
        <div className="flex gap-2">
          <Button onClick={() => router.push(`/movement?mode=guia&newPetId=${pet.id}&from=prontuario`)} variant="default" className="bg-[#008f5d] hover:bg-[#007b50] text-white rounded-md shadow-sm">
            <QrCode className="mr-2 h-4 w-4" /> Solicitar Guia de Exames
          </Button>
          <Button variant="outline" className="bg-white shadow-sm" onClick={() => router.back()}>
            <Undo2 className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </div>
      </PageTitle>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
        <Card className="md:col-span-1 border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Resumo do Paciente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm text-slate-700">
            <div>
              <p className="text-slate-500 mb-1">Gênero / Idade</p>
              <p className="font-medium">{pet.sexo === 'M' ? 'Masculino' : 'Feminino'} - {pet.idade || 'N/A'}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Plano de Saúde</p>
              <p className="font-medium uppercase">{pet.healthPlanName || 'PARTICULAR'}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Contato</p>
              <p className="font-medium">{pet.tutorTelefone || 'Sem telefone'}<br/>{pet.tutorEmail || 'Sem e-mail'}</p>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-3">
          {/* Action Buttons Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 mb-6">
             <Button variant="default" className="bg-blue-600 hover:bg-blue-700 text-white w-full shadow-sm text-[11px] lg:text-xs h-9 px-2" onClick={openNewProntuario}>
                <Activity className="w-3.5 h-3.5 mr-1.5" /> Nova Consulta
             </Button>
             <Button variant="outline" className="bg-white text-blue-600 border-blue-200 hover:bg-blue-50 w-full shadow-sm text-[11px] lg:text-xs h-9 px-2" onClick={() => {
                openNewProntuario();
                formProntuario.setValue('tipo_atendimento', 'Retorno');
             }}>
                <Undo2 className="w-3.5 h-3.5 mr-1.5" /> Registrar Retorno
             </Button>
             <Button variant="outline" className="bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50 w-full shadow-sm text-[11px] lg:text-xs h-9 px-2" onClick={() => router.push(`/movement?newPetId=${pet.id}`)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Solicitar Exames
             </Button>
             <Button variant="outline" className="bg-white text-slate-600 w-full shadow-sm text-[11px] lg:text-xs h-9 px-2" onClick={() => {
                openNewProntuario();
                formProntuario.setValue('tipo_atendimento', 'Procedimento');
             }}>
                <Activity className="w-3.5 h-3.5 mr-1.5" /> Procedimento
             </Button>
             <Button variant="outline" className="bg-white text-slate-600 w-full shadow-sm text-[11px] lg:text-xs h-9 px-2" onClick={() => {
                formDoc.setValue('tipo_documento', 'Atestado');
                setIsDocOpen(true);
             }}>
                <FileText className="w-3.5 h-3.5 mr-1.5" /> Laudo / Atestado
             </Button>
             <Button variant="outline" className="bg-white text-slate-600 w-full shadow-sm text-[11px] lg:text-xs h-9 px-2" onClick={() => {
                formDoc.setValue('tipo_documento', 'Guia de Internação');
                setIsDocOpen(true);
             }}>
                <FilePlus className="w-3.5 h-3.5 mr-1.5" /> Encaminhamento
             </Button>
             <Button variant="outline" className="bg-white text-slate-600 col-span-2 md:col-span-3 xl:col-span-6 w-full shadow-sm h-9" onClick={() => {
                setReciboData(prev => ({ ...prev, medico_id: user?.id || '' }));
                setIsReciboOpen(true);
             }}>
                <FileText className="w-4 h-4 mr-2" /> Emitir Recibo
             </Button>
          </div>

          <Tabs defaultValue="historico" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none px-4 h-12 bg-transparent mb-4">
              <TabsTrigger value="historico" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none shadow-none text-sm border-b-2 border-transparent text-slate-500 hover:text-slate-800 pb-3">
                <Activity className="w-4 h-4 mr-2" /> Histórico Clínico
              </TabsTrigger>
              <TabsTrigger value="documentos" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none shadow-none text-sm border-b-2 border-transparent text-slate-500 hover:text-slate-800 pb-3">
                <FileText className="w-4 h-4 mr-2" /> Documentos Emitidos
              </TabsTrigger>
              <TabsTrigger value="galeria" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none shadow-none text-sm border-b-2 border-transparent text-slate-500 hover:text-slate-800 pb-3">
                <FileText className="w-4 h-4 mr-2" /> Galeria de Imagens
              </TabsTrigger>
            </TabsList>

            <TabsContent value="historico" className="space-y-4">
              <div className="bg-white border rounded-lg shadow-sm p-4">
                  <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b pb-4 mb-4">
                    <h3 className="text-[15px] font-semibold flex items-center gap-2 text-slate-800"><CalendarDays className="w-5 h-5 text-blue-500" /> Painel de Atendimentos</h3>
                    <div className="flex flex-wrap gap-2 items-center">
                        <Select value={medicoFilter} onValueChange={setMedicoFilter}>
                            <SelectTrigger className="w-[160px] h-9 bg-white text-xs">
                                <SelectValue placeholder="Todos os Médicos" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os Médicos</SelectItem>
                                {veterinarios.map(v => (
                                    <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        
                        <Select defaultValue="all">
                            <SelectTrigger className="w-[140px] h-9 bg-white text-xs">
                                <SelectValue placeholder="Todos os Tipos" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os Tipos</SelectItem>
                                <SelectItem value="consulta">Consulta</SelectItem>
                                <SelectItem value="exame">Exame</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="flex items-center gap-2 border rounded-md px-3 h-9 bg-white text-xs text-slate-500">
                            <span>De: dd/mm/aaaa</span> <CalendarDays className="w-3.5 h-3.5 opacity-50" />
                            <span className="mx-1 font-semibold text-slate-300">|</span>
                            <span>Até: dd/mm/aaaa</span> <CalendarDays className="w-3.5 h-3.5 opacity-50" />
                        </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mb-4">
                        <Button variant="default" size="sm" className="h-8 px-4 bg-slate-800 hover:bg-slate-700 text-white text-xs" onClick={() => handleExport('pdf')} title="Gerar Dossiê Completo">
                            <FileText className="w-3.5 h-3.5 mr-2" /> Dossiê PDF
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 px-4 bg-white text-xs" onClick={() => handleExport('pdf')}>
                            Tabela PDF
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 px-4 bg-white text-xs" onClick={() => handleExport('csv')}>
                            CSV
                        </Button>
                  </div>

                  {prontuarios.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg bg-slate-50">
                      <Stethoscope className="w-8 h-8 mx-auto mb-4 opacity-30" />
                      <p className="text-sm">Nenhum atendimento clínico registrado para o pet.</p>
                    </div>
                  ) : (
                      <div className="overflow-x-auto border rounded-md">
                        <table className="w-full text-sm text-left text-slate-600">
                            <thead className="text-[11px] text-slate-500 bg-slate-50 border-b">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Data/Hora</th>
                                    <th className="px-4 py-3 font-medium">Tipo</th>
                                    <th className="px-4 py-3 font-medium">Profissional</th>
                                    <th className="px-4 py-3 font-medium text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredProntuarios.map((pront) => {
                                    const med = users.find(u => u.id === pront.medico_id);
                                    const mode = verifyEditPermission(pront);
                                    return (
                                        <tr key={pront.id} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-800">{format(new Date(pront.data_atendimento), 'dd/MM/yyyy HH:mm')}</div>
                                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">PRT-{pront.id.split('-')[0]}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2 text-emerald-600 font-medium text-xs">
                                                    <Activity className="w-3.5 h-3.5" /> {pront.tipo_atendimento}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-700 text-xs">{med?.nome || pront.medico_id || 'N/A'}</td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button variant="outline" size="sm" className="h-7 px-3 text-blue-600 bg-blue-50/30 border-blue-100 hover:bg-blue-50 text-xs" onClick={() => handleEditClick(pront)}>
                                                        <Activity className="w-3 h-3 mr-1.5" /> Detalhes
                                                    </Button>
                                                    {mode && (
                                                        <>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-500 hover:text-amber-600 hover:bg-amber-50" onClick={() => handleEditClick(pront)}>
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                            {mode === 'edit' && (
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteClick(pront.id)}>
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                      </div>
                  )}
              </div>
            </TabsContent>

            <TabsContent value="documentos" className="space-y-4">
               <div className="flex justify-between items-center mb-6">
                <h3 className="text-[15px] font-semibold flex items-center gap-2 text-slate-800"><FileText className="w-5 h-5 text-blue-500" /> Documentos Emitidos</h3>
                <Button variant="secondary" className="bg-slate-100 hover:bg-slate-200 text-slate-800" onClick={() => {
                    if (prontuarios.length > 0) {
                        formDoc.setValue('prontuario_id', prontuarios[0].id);
                    }
                    setIsDocOpen(true);
                }}>
                  <Plus className="w-4 h-4 mr-2" /> Gerar Documento / Em branco
                </Button>
               </div>

               {petDocumentos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg bg-slate-50">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>Nenhum documento emitido para este pet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {petDocumentos.map(doc => (
                        <Card key={doc.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-2 bg-slate-50">
                                <CardTitle className="text-sm font-bold flex items-center justify-between">
                                    <span className="flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> {doc.tipo_documento}</span>
                                    <span className="text-xs text-slate-500 font-mono">{doc.codigo_documento || 'Vazio'}</span>
                                </CardTitle>
                                <CardDescription className="text-xs">Emitido em {format(new Date(doc.created_at), "dd/MM/yy 'às' HH:mm")}</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="p-3 text-slate-500 rounded text-xs whitespace-pre-wrap h-[100px] overflow-hidden mask-bottom shadow-inner border border-slate-100 bg-white">
                                    {doc.conteudo || <span className="italic">Vazio</span>}
                                </div>
                                <Button className="w-full mt-4" variant="outline" onClick={() => {
                                    window.open(`/print/doc/${doc.id}`, '_blank');
                                }}>
                                    <Printer className="w-4 h-4 mr-2" /> Imprimir Via
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="galeria" className="space-y-4">
               <div className="flex justify-between items-center mb-6">
                <h3 className="text-[15px] font-semibold flex items-center gap-2 text-slate-800"><UploadCloud className="w-5 h-5 text-blue-500" /> Galeria de Imagens</h3>
                <Button variant="secondary" className="bg-slate-100 hover:bg-slate-200 text-slate-800" onClick={handleUploadPlaceholder}>
                  <Plus className="w-4 h-4 mr-2" /> Adicionar Arquivo
                </Button>
               </div>
               
               <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg bg-slate-50">
                  <UploadCloud className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>Nenhuma imagem ou anexo registrado para este pet.</p>
               </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

        {/* Modal de Prontuário */}
      <Dialog open={isProntuarioOpen} onOpenChange={setIsProntuarioOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
                {editMode === 'new' ? 'Registrar Novo Atendimento' : (editMode === 'edit' ? 'Alterar Atendimento Recente' : 'Inserir Adendo a Prontuário')}
            </DialogTitle>
          </DialogHeader>
          <Form {...formProntuario}>
            <form onSubmit={formProntuario.handleSubmit(onSubmitProntuario)} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={formProntuario.control}
                  name="data_atendimento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data/Hora</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} disabled={editMode !== 'new'} className={editMode !== 'new' ? 'opacity-50' : ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                    control={formProntuario.control}
                    name="tipo_atendimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={editMode !== 'new'}>
                          <FormControl>
                            <SelectTrigger className={editMode !== 'new' ? 'opacity-50' : ''}><SelectValue placeholder="Selecione" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Consulta">Consulta</SelectItem>
                            <SelectItem value="Exame">Exame Geral</SelectItem>
                            <SelectItem value="Procedimento">Procedimento / Cirurgia</SelectItem>
                            <SelectItem value="Retorno">Retorno</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>

              {canSelectMedico && editMode === 'new' && (
                  <FormField
                      control={formProntuario.control}
                      name="medico_id"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Registrar em nome de (Médico)</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || undefined}>
                                  <FormControl>
                                      <SelectTrigger><SelectValue placeholder="Selecione o Médico Veterinário" /></SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                      {veterinarios.map(v => (
                                          <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                                      ))}
                                  </SelectContent>
                              </Select>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
              )}
              
              <FormField
                control={formProntuario.control}
                name="queixa_principal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Queixa Principal / Motivo</FormLabel>
                    <FormControl>
                      <Input placeholder="Qual o motivo da consulta?" className="font-medium bg-slate-50" {...field} value={field.value || ''} />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={formProntuario.control}
                name="descricao_livre"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-center mt-2">
                        <FormLabel className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Evolução Clínica</FormLabel>
                        <Select onValueChange={(val) => applyModelo(val, true)}>
                            <SelectTrigger className="w-[180px] h-7 text-xs border-dashed bg-slate-50"><SelectValue placeholder="Usar Modelo Padrão" /></SelectTrigger>
                            <SelectContent>
                                {modelos.filter(m => ['Laudo', 'Outros', 'Atestado'].includes(m.tipo)).map(m => (
                                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <FormControl>
                      <Textarea placeholder="Descreva sinais, anamneses..." className={`min-h-[120px] font-medium leading-relaxed bg-slate-50 ${editMode==='adendo' ? 'bg-amber-50 focus-visible:ring-amber-400 border-amber-200' : ''}`} {...field} value={field.value || ''} />
                    </FormControl>
                    {editMode === 'adendo' && <p className="text-xs text-amber-600 font-bold mt-1">Como você está editando fora do prazo de 2 horas, adicione novas informações no final do texto.</p>}
                  </FormItem>
                )}
              />

              <FormField
                control={formProntuario.control}
                name="prescricao_medica"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prescrição Médica (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descreva os medicamentos, receitas e indicações..." className="min-h-[100px] font-medium leading-relaxed" {...field} value={field.value || ''} />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <div className="border rounded-lg p-4 bg-slate-50/50 mt-4">
                  <div className="flex items-center justify-between mb-4">
                      <div>
                          <h4 className="text-[13px] font-bold text-slate-800 flex items-center gap-2">
                              <ImageIcon className="w-4 h-4 text-blue-500" /> Imagens e Diagnósticos
                          </h4>
                          <p className="text-[11px] text-slate-500">Anexe radiografias, fotos e exames para acompanhar a evolução.</p>
                      </div>
                      <div className="relative">
                          <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" disabled={isUploading || !editingProntuario} title={!editingProntuario ? "Salve o prontuário primeiro antes de anexar imagens" : ""} />
                          <Button type="button" variant="default" className="bg-blue-600 hover:bg-blue-700 h-8 text-xs px-3 shadow-sm" disabled={isUploading || !editingProntuario}>
                              {isUploading ? <Activity className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                              Anexar Imagem
                          </Button>
                      </div>
                  </div>
                  
                  {!editingProntuario && (
                      <div className="text-[11px] text-amber-600 bg-amber-50 p-2 rounded border border-amber-100 font-medium">
                          Para anexar imagens, primeiro salve este novo atendimento e depois clique em editar.
                      </div>
                  )}

                  {editingProntuario && prontuarioImages.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                          {prontuarioImages.map((img) => (
                              <div key={img.name} className="relative group border rounded-md overflow-hidden aspect-video bg-slate-100 flex items-center justify-center">
                                  <img 
                                      src={supabase.storage.from('prontuarios').getPublicUrl(`${editingProntuario.id}/${img.name}`).data.publicUrl} 
                                      alt={img.name} 
                                      className="object-cover w-full h-full"
                                  />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <Button type="button" variant="destructive" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleDeleteImage(img.name)}>
                                          <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
              
              <div className="flex justify-between items-center pt-4 border-t mt-6">
                <div>
                  {editingProntuario && (
                    <span className="text-xs text-slate-500 font-mono font-medium">Ref: PRT-{editingProntuario.id.split('-')[0]}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {editingProntuario && (
                    <Button type="button" variant="outline" className="text-slate-600 border-slate-200 h-9 shadow-sm" onClick={() => {
                        formDoc.setValue('prontuario_id', editingProntuario.id);
                        setIsDocOpen(true);
                    }}>
                        <FilePlus className="w-4 h-4 mr-2" /> Emitir Documento
                    </Button>
                  )}
                  <Button type="button" variant="outline" className="h-9" onClick={() => setIsProntuarioOpen(false)}>Cancelar</Button>
                  
                  {editMode === 'new' && (
                    <Button type="submit" variant="outline" className="h-9 text-blue-600 border-blue-200 hover:bg-blue-50 font-medium" onClick={() => setSubmitAction('save_and_exams')}>
                        Salvar e Solicitar Exames
                    </Button>
                  )}
                  
                  <Button type="submit" variant={editMode === 'adendo' ? 'secondary' : 'default'} className={`h-9 ${editMode === 'adendo' ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 font-bold' : 'bg-blue-600 hover:bg-blue-700 text-white'}`} onClick={() => setSubmitAction('save')}>
                      {editMode === 'new' ? 'Finalizar Atendimento' : 'Confirmar Atualização'}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Modal Emitir Documento */}
      <Dialog open={isDocOpen} onOpenChange={setIsDocOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
            <DialogTitle>Emitir Documento (Receita, Atestado, etc)</DialogTitle>
        </DialogHeader>
        <Form {...formDoc}>
            <form onSubmit={formDoc.handleSubmit(onSubmitDoc)} className="space-y-4 mt-4">
            <FormField
                control={formDoc.control}
                name="prontuario_id"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Vincular ao Atendimento Base (Ref)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione um atendimento" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {prontuarios.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                                {format(new Date(p.data_atendimento), 'dd/MM/yy HH:mm')} - {p.tipo_atendimento}
                            </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={formDoc.control}
                name="tipo_documento"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Tipo do Papel/Impressão</FormLabel>
                    <Select onValueChange={(val) => {
                        field.onChange(val);
                        if (val === 'Receita') formDoc.setValue('conteudo', 'MEDICAMENTO:\nPOSOLOGIA:\nUSO:\n\nVIA:\n');
                        if (val === 'Atestado') formDoc.setValue('conteudo', `Atesto para os devidos fins que o animal ${pet.nome}, da espécie ${pet.especie}, sob responsabilidade de ${pet.tutorNome}, foi atendido nesta clínica...\n\nRecomendações:\n`);
                    }} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione o formato" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="Receita">Receita Simples / Especial</SelectItem>
                        <SelectItem value="Atestado">Atestado Médico-Veterinário</SelectItem>
                        <SelectItem value="Guia de Internação">Guia de Encaminhamento</SelectItem>
                        <SelectItem value="Recibo">Recibo</SelectItem>
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={formDoc.control}
                name="conteudo"
                render={({ field }) => (
                <FormItem>
                    <div className="flex justify-between items-center">
                        <FormLabel>Texto Completo (Sairá exatamente assim na Impressão)</FormLabel>
                        <Select onValueChange={(val) => applyModelo(val, false)}>
                            <SelectTrigger className="w-[180px] h-7 text-xs border-dashed bg-slate-50"><SelectValue placeholder="Usar Modelo Padrão" /></SelectTrigger>
                            <SelectContent>
                                {modelos.filter(m => ['Receita', 'Atestado', 'Encaminhamento', 'Outros'].includes(m.tipo)).map(m => (
                                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <FormControl>
                    <Textarea placeholder="Digite o conteúdo aqui..." className="min-h-[250px] font-mono text-sm leading-relaxed whitespace-pre-wrap bg-slate-50" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                <Button type="button" variant="outline" onClick={() => setIsDocOpen(false)}>Cancelar</Button>
                <Button type="submit" variant="default" className="bg-blue-600 hover:bg-blue-700 text-white">
                    <FileText className="w-4 h-4 mr-2" /> Gerar Documento
                </Button>
            </div>
            </form>
        </Form>
        </DialogContent>
      </Dialog>
      
      {/* Modal Emitir Recibo */}
      <Dialog open={isReciboOpen} onOpenChange={setIsReciboOpen}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle>Gerar Recibo Médico</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Emitir em nome de (Médico)</label>
                    <Select value={reciboData.medico_id} onValueChange={(val) => setReciboData(prev => ({ ...prev, medico_id: val }))}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione o Médico" />
                        </SelectTrigger>
                        <SelectContent>
                            {veterinarios.map(v => (
                                <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                
                <div className="space-y-2">
                    <label className="text-sm font-medium">Valor (R$)</label>
                    <Input 
                        placeholder="Ex: 350,00" 
                        value={reciboData.valor} 
                        onChange={(e) => setReciboData(prev => ({ ...prev, valor: e.target.value.replace(/[^0-9,.]/g, '') }))} 
                    />
                    <p className="text-[10px] text-muted-foreground leading-tight mt-1">O sistema escreverá este valor por extenso automaticamente no corpo do recibo.</p>
                </div>
                
                <div className="space-y-2">
                    <label className="text-sm font-medium">Referente a:</label>
                    <Textarea 
                        className="resize-none h-20"
                        value={reciboData.referente} 
                        onChange={(e) => setReciboData(prev => ({ ...prev, referente: e.target.value }))} 
                    />
                </div>
                
                <div className="space-y-2">
                    <label className="text-sm font-medium">Cidade/Estado</label>
                    <Input 
                        value={reciboData.cidadeEstado} 
                        onChange={(e) => setReciboData(prev => ({ ...prev, cidadeEstado: e.target.value }))} 
                    />
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={() => setIsReciboOpen(false)}>Cancelar</Button>
                    <Button type="button" variant="default" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleGerarRecibo}>
                        Gerar Recibo em PDF
                    </Button>
                </div>
            </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
