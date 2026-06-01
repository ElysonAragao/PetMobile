"use client";

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Calendar, 
  Clock, 
  User, 
  Plus, 
  Search, 
  Trash2, 
  Check, 
  X, 
  Download, 
  Printer, 
  Undo2, 
  AlertCircle, 
  Phone,
  UserCheck,
  CalendarDays,
  Filter,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Edit
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { useAgenda } from '@/hooks/use-agenda';
import { useVeterinarios } from '@/hooks/use-veterinarios';
import { useToast } from '@/hooks/use-toast';
import { PageTitle } from '@/components/layout/page-title';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AgendaItem } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';

export default function AgendaPage() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = React.useMemo(() => createClient(), []);
  
  // Custom hooks
  const { 
    agenda, 
    isLoading: agendaLoading, 
    error: agendaError,
    fetchAgenda, 
    addAgenda, 
    updateAgenda,
    updateAgendaStatus, 
    deleteAgenda,
    searchPetByCpfOrCode
  } = useAgenda();
  
  const { veterinarios, isLoaded: vetsLoaded } = useVeterinarios();

  // State variables
  const [activeTab, setActiveTab] = useState('diaria');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMedicoId, setSelectedMedicoId] = useState('all');
  const [selectedTipo, setSelectedTipo] = useState('all');
  
  // Navigation helpers for agenda diária
  const handlePreviousDay = () => {
    const date = new Date(selectedDate + 'T12:00:00');
    date.setDate(date.getDate() - 1);
    setSelectedDate(format(date, 'yyyy-MM-dd'));
  };

  const handleNextDay = () => {
    const date = new Date(selectedDate + 'T12:00:00');
    date.setDate(date.getDate() + 1);
    setSelectedDate(format(date, 'yyyy-MM-dd'));
  };
  
  // Search patient field in scheduling form
  const [lookupQuery, setLookupQuery] = useState('');
  const [isSearchingPet, setIsSearchingPet] = useState(false);
  const [foundPet, setFoundPet] = useState<any | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Scheduling Form State
  const [formMedicoId, setFormMedicoId] = useState('');
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formTime, setFormTime] = useState('09:00');
  const [formTipo, setFormTipo] = useState<'Consulta' | 'Retorno' | 'Exame' | 'Cirurgia'>('Consulta');
  const [formTutorCpf, setFormTutorCpf] = useState('');
  const [formTutorNome, setFormTutorNome] = useState('');
  const [formPetNome, setFormPetNome] = useState('');
  const [formTutorTelefone, setFormTutorTelefone] = useState('');

  // State for Editing Appointment Dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AgendaItem | null>(null);
  const [editMedicoId, setEditMedicoId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editTutorCpf, setEditTutorCpf] = useState('');
  const [editTutorNome, setEditTutorNome] = useState('');
  const [editPetNome, setEditPetNome] = useState('');
  const [editTutorTelefone, setEditTutorTelefone] = useState('');
  const [editStatus, setEditStatus] = useState<'Agendado' | 'Cancelado' | 'Realizado'>('Agendado');
  const [editTipo, setEditTipo] = useState<'Consulta' | 'Retorno' | 'Exame' | 'Cirurgia'>('Consulta');

  // Report Filters
  const [reportStartDate, setReportStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportEndDate, setReportEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportMedicoId, setReportMedicoId] = useState('all');
  const [reportStatus, setReportStatus] = useState('all');
  const [reportTipo, setReportTipo] = useState('all');

  // Trigger search on mount and when filters change
  useEffect(() => {
    // Para a agenda diária, filtramos pelo dia selecionado (das 00:00 às 23:59)
    const start = `${selectedDate}T00:00:00.000Z`;
    const end = `${selectedDate}T23:59:59.999Z`;
    fetchAgenda({ 
      startDate: start, 
      endDate: end, 
      medicoId: selectedMedicoId,
      tipo: selectedTipo
    });
  }, [selectedDate, selectedMedicoId, selectedTipo, fetchAgenda]);

  // Load report data
  const handleLoadReport = () => {
    const start = `${reportStartDate}T00:00:00.000Z`;
    const end = `${reportEndDate}T23:59:59.999Z`;
    fetchAgenda({ 
      startDate: start, 
      endDate: end, 
      medicoId: reportMedicoId,
      tipo: reportTipo
    });
    toast({
      title: "Relatório Atualizado",
      description: "Os dados foram carregados com base nos filtros informados."
    });
  };

  // Perform pet/tutor lookup
  const handlePetLookup = async () => {
    if (!lookupQuery.trim() || lookupQuery.trim().length < 3) {
      toast({
        title: "Busca muito curta",
        description: "Digite pelo menos 3 caracteres (ID do Pet ou CPF do tutor).",
        variant: "destructive"
      });
      return;
    }

    setIsSearchingPet(true);
    setHasSearched(true);
    setFoundPet(null);

    try {
      const results = await searchPetByCpfOrCode(lookupQuery);
      if (results && results.length > 0) {
        const pet = results[0];
        setFoundPet(pet);
        setFormTutorCpf(pet.tutorCpf || '');
        setFormTutorNome(pet.tutorNome || '');
        setFormPetNome(pet.nome || '');
        setFormTutorTelefone(pet.tutorTelefone || '');
        toast({
          title: "Paciente encontrado!",
          description: `Pet ${pet.nome} e tutor ${pet.tutorNome} localizados.`
        });
      } else {
        toast({
          title: "Paciente não cadastrado",
          description: "Nenhum pet encontrado com os dados informados. Digite os dados manualmente para agendar.",
          variant: "default"
        });
        // Se for um CPF válido digitado, preenchemos o campo CPF
        if (/^\d{11}$/.test(lookupQuery.replace(/\D/g, ''))) {
          setFormTutorCpf(lookupQuery.replace(/\D/g, ''));
        } else {
          setFormTutorCpf('');
        }
        setFormTutorNome('');
        setFormPetNome('');
        setFormTutorTelefone('');
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "Erro na busca",
        description: "Não foi possível verificar no banco de dados.",
        variant: "destructive"
      });
    } finally {
      setIsSearchingPet(false);
    }
  };

  // Clear lookup and reset form
  const handleClearLookup = () => {
    setLookupQuery('');
    setFoundPet(null);
    setHasSearched(false);
    setFormTutorCpf('');
    setFormTutorNome('');
    setFormPetNome('');
    setFormTutorTelefone('');
  };

  // Submit appointment
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formMedicoId) {
      toast({
        title: "Médico obrigatório",
        description: "Selecione o médico veterinário para vincular a agenda.",
        variant: "destructive"
      });
      return;
    }

    if (!formTutorNome.trim() || !formPetNome.trim() || !formTutorCpf.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o CPF do tutor, nome do tutor e nome do pet.",
        variant: "destructive"
      });
      return;
    }

    // Combine date and time
    const dateTimeIso = new Date(`${formDate}T${formTime}:00`).toISOString();

    const result = await addAgenda({
      medicoId: formMedicoId,
      dataAgendamento: dateTimeIso,
      petId: foundPet ? foundPet.id : null,
      tutorCpf: formTutorCpf,
      tutorNome: formTutorNome,
      petNome: formPetNome,
      tutorTelefone: formTutorTelefone,
      tipo: formTipo
    });

    if (result.success) {
      toast({
        title: "Agendamento realizado!",
        description: "A consulta foi agendada com sucesso."
      });
      // Reset form
      setFormMedicoId('');
      setFormTime('09:00');
      setFormTipo('Consulta');
      handleClearLookup();
      // Refresh list
      const start = `${selectedDate}T00:00:00.000Z`;
      const end = `${selectedDate}T23:59:59.999Z`;
      fetchAgenda({ startDate: start, endDate: end, medicoId: selectedMedicoId, tipo: selectedTipo });
      setActiveTab('diaria');
    } else {
      toast({
        title: "Falha ao agendar",
        description: result.message || "Ocorreu um erro no servidor.",
        variant: "destructive"
      });
    }
  };

  // Handle appointment click / arrival (Check-in flow)
  const handleCheckIn = async (item: AgendaItem) => {
    try {
      // 1. Verificar se o Pet já é cadastrado no banco (caso item.petId seja nulo)
      let finalPetId = item.petId;
      
      if (!finalPetId) {
        toast({
          title: "Buscando prontuário",
          description: "Verificando se o pet já possui cadastro..."
        });
        
        // Buscar por CPF do tutor e nome aproximado do Pet
        const { data: foundPets, error: searchError } = await supabase
          .from('pet_pets')
          .select('id')
          .eq('empresa_id', item.empresaId)
          .eq('tutor_cpf', item.tutorCpf)
          .ilike('nome', item.petNome.trim())
          .limit(1);

        if (searchError) {
          console.error("Erro ao buscar pet:", searchError);
        } else if (foundPets && foundPets.length > 0) {
          finalPetId = foundPets[0].id;
          
          // Atualiza a própria consulta na agenda para vincular o ID encontrado
          await supabase
            .from('pet_agenda')
            .update({ pet_id: finalPetId })
            .eq('id', item.id);
            
          toast({
            title: "Cadastro identificado!",
            description: `O pet ${item.petNome} já estava cadastrado.`
          });
        }
      }

      // 2. Atualizar o status para "Realizado"
      const res = await updateAgendaStatus(item.id, 'Realizado');
      if (!res.success) {
        toast({
          title: "Erro ao confirmar",
          description: res.message || "Não foi possível atualizar o status do agendamento.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Presença confirmada!",
        description: "Direcionando para a ficha cadastral do Pet..."
      });

      // 3. Redirecionar dependendo de o pet já estar cadastrado ou não
      if (finalPetId) {
        // Se já está cadastrado, abre no modo edição
        router.push(`/pets?editPetId=${finalPetId}`);
      } else {
        // Se é novo, redireciona preenchendo os dados coletados na agenda
        router.push(
          `/pets?prefill=true&tutorCpf=${encodeURIComponent(item.tutorCpf)}&tutorNome=${encodeURIComponent(item.tutorNome)}&tutorTelefone=${encodeURIComponent(item.tutorTelefone || '')}&petNome=${encodeURIComponent(item.petNome)}`
        );
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "Erro operacional",
        description: "Falha ao processar fluxo de chegada.",
        variant: "destructive"
      });
    }
  };

  const handleStartEdit = (item: AgendaItem) => {
    setEditingItem(item);
    const dateObj = parseISO(item.dataAgendamento);
    setEditMedicoId(item.medicoId || '');
    setEditDate(format(dateObj, 'yyyy-MM-dd'));
    setEditTime(format(dateObj, 'HH:mm'));
    setEditTutorCpf(item.tutorCpf || '');
    setEditTutorNome(item.tutorNome || '');
    setEditPetNome(item.petNome || '');
    setEditTutorTelefone(item.tutorTelefone || '');
    setEditStatus(item.status);
    setEditTipo(item.tipo || 'Consulta');
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (!editMedicoId) {
      toast({
        title: "Médico obrigatório",
        description: "Selecione o médico veterinário para o agendamento.",
        variant: "destructive"
      });
      return;
    }

    if (!editTutorNome.trim() || !editPetNome.trim() || !editTutorCpf.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o CPF do tutor, nome do tutor e nome do pet.",
        variant: "destructive"
      });
      return;
    }

    const dateTimeIso = new Date(`${editDate}T${editTime}:00`).toISOString();

    const result = await updateAgenda(editingItem.id, {
      medicoId: editMedicoId,
      dataAgendamento: dateTimeIso,
      petId: editingItem.petId,
      tutorCpf: editTutorCpf,
      tutorNome: editTutorNome,
      petNome: editPetNome,
      tutorTelefone: editTutorTelefone,
      status: editStatus,
      tipo: editTipo
    });

    if (result.success) {
      toast({
        title: "Agendamento atualizado!",
        description: "Os dados foram salvos com sucesso."
      });
      setIsEditDialogOpen(false);
      setEditingItem(null);
      
      // Refresh list
      const start = `${selectedDate}T00:00:00.000Z`;
      const end = `${selectedDate}T23:59:59.999Z`;
      fetchAgenda({ startDate: start, endDate: end, medicoId: selectedMedicoId, tipo: selectedTipo });
    } else {
      toast({
        title: "Falha ao atualizar",
        description: result.message || "Ocorreu um erro no servidor.",
        variant: "destructive"
      });
    }
  };

  // Export report to CSV
  const handleExportCSV = () => {
    if (agenda.length === 0) {
      toast({
        title: "Sem dados",
        description: "Não há agendamentos no período para exportar.",
        variant: "destructive"
      });
      return;
    }

    const headers = ['Data Agendamento', 'Hora', 'Tipo', 'Veterinario', 'CRMV', 'Pet', 'Tutor', 'CPF Tutor', 'Telefone', 'Status'];
    const rows = agenda.map(item => {
      const dateObj = parseISO(item.dataAgendamento);
      const dataFormatada = format(dateObj, 'dd/MM/yyyy');
      const horaFormatada = format(dateObj, 'HH:mm');
      return [
        dataFormatada,
        horaFormatada,
        item.tipo || 'Consulta',
        item.medico?.nome || 'Não Vinculado',
        item.medico?.crmv_uf || '',
        item.petNome,
        item.tutorNome,
        item.tutorCpf,
        item.tutorTelefone || '',
        item.status
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_agenda_${reportStartDate}_a_${reportEndDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print report
  const handlePrint = () => {
    window.print();
  };

  // Print daily agenda PDF
  const handlePrintDailyAgendaPDF = () => {
    if (agenda.length === 0) {
      toast({
        title: "Sem agendamentos",
        description: "Não há consultas agendadas para o dia selecionado.",
        variant: "destructive"
      });
      return;
    }

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      
      const parts = selectedDate.split('-');
      const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : selectedDate;

      const medicoObj = veterinarios.find(v => v.id === selectedMedicoId);
      const medicoLabel = medicoObj ? medicoObj.nome : 'todos';
      const tipoLabel = selectedTipo === 'all' ? 'todos' : selectedTipo;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(`Agenda do Dia - ${formattedDate}`, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text(`- Medico:  Selecionado ${medicoLabel}   |   Tipo: ${tipoLabel}`, doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' });

      const headers = [['Hora', 'Tipo', 'Nome do Pet', 'CPF Tutor', 'Nome Tutor', 'Médico', 'Situação', 'Ações']];

      const rows = agenda.map(item => {
        const horaStr = format(parseISO(item.dataAgendamento), 'HH:mm');
        const isNewPet = !item.petId;
        const petCell = `${item.petNome}\n${isNewPet ? 'Novo Paciente' : `Cadastrado (${item.pet?.codPet || ''})`}`;
        const tutorCell = `${item.tutorNome}${item.tutorTelefone ? `\n${item.tutorTelefone}` : ''}`;
        const medicoCell = `${item.medico?.nome || 'Não Vinculado'}${item.medico?.crmv_uf ? `\nCRMV: ${item.medico.crmv_uf}` : ''}`;
        
        return [
          horaStr,
          item.tipo || 'Consulta',
          petCell,
          item.tutorCpf || '',
          tutorCell,
          medicoCell,
          item.status || '',
          ''
        ];
      });

      autoTable(doc, {
        head: headers,
        body: rows,
        startY: 35,
        styles: { 
          fontSize: 9,
          cellPadding: 3,
          valign: 'middle',
          font: 'helvetica'
        },
        headStyles: { 
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 20 },
          2: { cellWidth: 30 },
          3: { cellWidth: 25 },
          4: { cellWidth: 30 },
          5: { cellWidth: 30 },
          6: { cellWidth: 20 },
          7: { cellWidth: 10 }
        }
      });

      // Generate blob URL to preview/print in a new tab
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      window.open(blobUrl, '_blank');
      
      toast({
        title: "Visualização do PDF aberta",
        description: "O PDF da agenda foi aberto em uma nova guia para visualização e impressão."
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o arquivo PDF.",
        variant: "destructive"
      });
    }
  };

  // Filtered agenda for report view (client-side filter for status if needed, dates/doctor/tipo are filtered at backend API query level)
  const filteredReportAgenda = useMemo(() => {
    if (reportStatus === 'all') return agenda;
    return agenda.filter(item => item.status === reportStatus);
  }, [agenda, reportStatus]);

  // Statistics/KPIs for reports
  const stats = useMemo(() => {
    const total = filteredReportAgenda.length;
    const realizados = filteredReportAgenda.filter(i => i.status === 'Realizado').length;
    const cancelados = filteredReportAgenda.filter(i => i.status === 'Cancelado').length;
    const agendados = filteredReportAgenda.filter(i => i.status === 'Agendado').length;

    return { total, realizados, cancelados, agendados };
  }, [filteredReportAgenda]);

  return (
    <>
      <div className="print:hidden">
        <PageTitle title="Agenda de Atendimentos" description="Gerencie a recepção, agendamentos de veterinários e a chegada de pacientes.">
          <Link href="/" passHref>
            <Button variant="outline">
              <Undo2 className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
        </PageTitle>
      </div>

      <div className="hidden print:block mb-8">
        <h1 className="text-2xl font-bold">PetMobile - Relatório de Agendamentos</h1>
        <p className="text-sm text-muted-foreground">
          Período: {format(parseISO(reportStartDate), 'dd/MM/yyyy')} a {format(parseISO(reportEndDate), 'dd/MM/yyyy')}
        </p>
        <p className="text-sm text-muted-foreground">
          Médico: {reportMedicoId === 'all' ? 'Todos' : veterinarios.find(v => v.id === reportMedicoId)?.nome || reportMedicoId}
        </p>
      </div>

      {agendaError && (
        <Alert variant="destructive" className="mb-6 print:hidden">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro de Conexão</AlertTitle>
          <AlertDescription>
            A tabela de agendamentos não pôde ser acessada. Verifique se executou a migração SQL no painel do Supabase.
            <br />
            <strong>Código de erro:</strong> {agendaError.message}
            <div className="mt-4">
              <Link href="/_projeto_docs/database_schemas" target="_blank">
                <Button variant="outline" size="sm" className="bg-destructive/10 hover:bg-destructive/20 text-destructive border-destructive/20">
                  Ver Scripts SQL
                </Button>
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full print:hidden">
        <TabsList className="grid w-full grid-cols-3 md:w-[600px] mb-6">
          <TabsTrigger value="diaria">
            <CalendarDays className="w-4 h-4 mr-2" />
            Agenda Diária
          </TabsTrigger>
          <TabsTrigger value="novo">
            <Plus className="w-4 h-4 mr-2" />
            Novo Agendamento
          </TabsTrigger>
          <TabsTrigger value="relatorio">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Relatórios
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB 1: AGENDA DIÁRIA ─── */}
        <TabsContent value="diaria" className="space-y-6">
          <Card className="border-primary/10 shadow-sm bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Filtros da Agenda</CardTitle>
                  <CardDescription>Escolha a data e o veterinário para visualizar as consultas programadas.</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium mr-1">Data:</span>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-9 w-9 shrink-0" 
                      onClick={handlePreviousDay}
                      title="Dia Anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Input 
                      type="date" 
                      value={selectedDate} 
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-[140px] h-9 shadow-sm"
                    />
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-9 w-9 shrink-0" 
                      onClick={handleNextDay}
                      title="Próximo Dia"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Médico:</span>
                    <Select value={selectedMedicoId} onValueChange={setSelectedMedicoId}>
                      <SelectTrigger className="w-[200px] h-9 shadow-sm">
                        <SelectValue placeholder="Todos os Médicos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os Médicos</SelectItem>
                        {veterinarios.map(v => (
                          <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Tipo:</span>
                    <Select value={selectedTipo} onValueChange={setSelectedTipo}>
                      <SelectTrigger className="w-[140px] h-9 shadow-sm">
                        <SelectValue placeholder="Todos os Tipos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os Tipos</SelectItem>
                        <SelectItem value="Consulta">Consulta</SelectItem>
                        <SelectItem value="Retorno">Retorno</SelectItem>
                        <SelectItem value="Exame">Exame</SelectItem>
                        <SelectItem value="Cirurgia">Cirurgia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    variant="outline" 
                    className="h-9 shadow-sm gap-2 border-primary/20 hover:bg-primary/5 text-primary"
                    onClick={handlePrintDailyAgendaPDF}
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir PDF da Agenda do Dia
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {agendaLoading ? (
                <div className="flex justify-center py-12">
                  <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></span>
                </div>
              ) : agenda.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-bold w-[100px]">Hora</TableHead>
                        <TableHead className="font-bold">Tipo</TableHead>
                        <TableHead className="font-bold">Nome do Pet</TableHead>
                        <TableHead className="font-bold">CPF Tutor</TableHead>
                        <TableHead className="font-bold">Nome Tutor</TableHead>
                        <TableHead className="font-bold">Médico</TableHead>
                        <TableHead className="font-bold text-center">Situação</TableHead>
                        <TableHead className="font-bold text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agenda.map((item) => {
                        const horaStr = format(parseISO(item.dataAgendamento), 'HH:mm');
                        const isNewPet = !item.petId;
                        
                        return (
                          <TableRow key={item.id} className={
                            item.status === 'Realizado' 
                              ? 'bg-green-500/5 hover:bg-green-500/10' 
                              : item.status === 'Cancelado' 
                              ? 'bg-red-500/5 hover:bg-red-500/10 opacity-70' 
                              : ''
                          }>
                            <TableCell className="font-semibold text-primary">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                                {horaStr}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={`text-[11px] px-2 py-0.5 font-medium ${
                                  item.tipo === 'Consulta' 
                                    ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                    : item.tipo === 'Retorno' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                    : item.tipo === 'Exame' 
                                    ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                    : item.tipo === 'Cirurgia' 
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-slate-50 text-slate-700 border-slate-200'
                                }`}
                              >
                                {item.tipo || 'Consulta'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-bold text-foreground">
                              <div className="flex flex-col gap-1">
                                <span>{item.petNome}</span>
                                {isNewPet ? (
                                  <Badge variant="outline" className="text-yellow-600 bg-yellow-55 border-yellow-200 font-normal w-fit text-[10px] px-1 py-0">
                                    Novo Paciente
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-green-600 bg-green-55 border-green-200 font-normal w-fit text-[10px] px-1 py-0">
                                    Cadastrado ({item.pet?.codPet})
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{item.tutorCpf}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{item.tutorNome}</span>
                                {item.tutorTelefone && (
                                  <a href={`tel:${item.tutorTelefone}`} className="flex items-center text-[11px] text-primary hover:underline gap-1 mt-0.5">
                                    <Phone className="w-3 h-3" />
                                    {item.tutorTelefone}
                                  </a>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground">{item.medico?.nome || 'Não Vinculado'}</span>
                                {item.medico?.crmv_uf && (
                                  <span className="text-[10px] text-muted-foreground">CRMV: {item.medico.crmv_uf}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant="outline"
                                className={`text-[11px] px-2 py-0.5 font-medium ${
                                  item.status === 'Realizado' 
                                    ? 'bg-green-50 text-green-600 border-green-200' 
                                    : item.status === 'Cancelado' 
                                    ? 'bg-red-50 text-red-600 border-red-200' 
                                    : 'bg-blue-50 text-blue-600 border-blue-200'
                                }`}
                              >
                                {item.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end items-center gap-1.5">
                                {item.status === 'Agendado' ? (
                                  <>
                                    <Button 
                                      size="sm" 
                                      className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm text-xs px-2.5"
                                      onClick={() => handleCheckIn(item)}
                                      title="Confirmar Chegada e Ir para Ficha"
                                    >
                                      <UserCheck className="w-3.5 h-3.5 mr-1" />
                                      Chegada
                                    </Button>
                                    
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200 h-8 text-xs px-2.5 shadow-sm"
                                      onClick={() => handleStartEdit(item)}
                                      title="Editar Agendamento"
                                    >
                                      <Edit className="w-3.5 h-3.5 mr-1" />
                                      Editar
                                    </Button>

                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 h-8 text-xs px-2.5 shadow-sm"
                                      onClick={async () => {
                                        if (confirm("Deseja realmente CANCELAR este agendamento?")) {
                                          const res = await updateAgendaStatus(item.id, 'Cancelado');
                                          if (res.success) {
                                            toast({ title: "Cancelado", description: "Agendamento cancelado com sucesso." });
                                            fetchAgenda({ 
                                              startDate: `${selectedDate}T00:00:00.000Z`, 
                                              endDate: `${selectedDate}T23:59:59.999Z`, 
                                              medicoId: selectedMedicoId,
                                              tipo: selectedTipo
                                            });
                                          }
                                        }
                                      }}
                                      title="Cancelar Agendamento"
                                    >
                                      <X className="w-3.5 h-3.5 mr-1" />
                                      Cancelar
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 text-xs text-muted-foreground hover:text-primary px-2"
                                      onClick={async () => {
                                        // Verificar se o Pet já foi cadastrado no banco
                                        let finalPetId = item.petId;
                                        if (!finalPetId) {
                                          const { data: foundPets } = await supabase
                                            .from('pet_pets')
                                            .select('id')
                                            .eq('empresa_id', item.empresaId)
                                            .eq('tutor_cpf', item.tutorCpf)
                                            .ilike('nome', item.petNome.trim())
                                            .limit(1);

                                          if (foundPets && foundPets.length > 0) {
                                            finalPetId = foundPets[0].id;
                                          }
                                        }
                                        
                                        if (finalPetId) {
                                          router.push(`/pets?editPetId=${finalPetId}`);
                                        } else {
                                          router.push(`/pets?prefill=true&tutorCpf=${item.tutorCpf}&tutorNome=${item.tutorNome}&tutorTelefone=${item.tutorTelefone || ''}&petNome=${item.petNome}`);
                                        }
                                      }}
                                    >
                                      Ficha
                                    </Button>

                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200 h-8 text-xs px-2.5 shadow-sm"
                                      onClick={() => handleStartEdit(item)}
                                      title="Editar Agendamento"
                                    >
                                      <Edit className="w-3.5 h-3.5 mr-1" />
                                      Editar
                                    </Button>

                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      className="text-red-500 hover:text-red-700 h-8 px-2"
                                      onClick={async () => {
                                        if (confirm("Excluir definitivamente este registro da agenda?")) {
                                          const res = await deleteAgenda(item.id);
                                          if (res.success) {
                                            toast({ title: "Excluído", description: "Agendamento removido." });
                                            fetchAgenda({ 
                                              startDate: `${selectedDate}T00:00:00.000Z`, 
                                              endDate: `${selectedDate}T23:59:59.999Z`, 
                                              medicoId: selectedMedicoId,
                                              tipo: selectedTipo
                                            });
                                          }
                                        }
                                      }}
                                      title="Excluir Registro"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-16 border-2 border-dashed border-muted rounded-xl bg-muted/10">
                  <Calendar className="mx-auto h-12 w-12 text-muted-foreground/60 mb-2" />
                  <h3 className="text-lg font-semibold text-foreground/80">Sem consultas para este dia</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
                    Não há atendimentos agendados na data ou médico informados. Clique em "Novo Agendamento" para adicionar.
                  </p>
                  <Button 
                    className="mt-4 bg-primary/90 hover:bg-primary"
                    onClick={() => setActiveTab('novo')}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agendar Consulta
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 2: NOVO AGENDAMENTO ─── */}
        <TabsContent value="novo">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Seção 1: Busca Rápida de Cadastro */}
            <Card className="lg:col-span-1 border-primary/10 shadow-sm bg-card/60">
              <CardHeader>
                <CardTitle>Identificação do Paciente</CardTitle>
                <CardDescription>
                  Busque pelo CPF do tutor ou ID do Pet para carregar os dados cadastrados.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <span className="text-sm font-medium">CPF do Tutor ou Código do Pet:</span>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Ex: 12345678901 ou PET001" 
                      value={lookupQuery}
                      onChange={(e) => setLookupQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handlePetLookup()}
                      className="shadow-sm"
                    />
                    <Button 
                      onClick={handlePetLookup} 
                      disabled={isSearchingPet}
                      variant="secondary"
                      className="shrink-0"
                    >
                      {isSearchingPet ? (
                        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></span>
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {hasSearched && (
                  <div className="pt-2 border-t">
                    {foundPet ? (
                      <Alert className="bg-green-500/10 border-green-200 text-green-800">
                        <Check className="h-4 w-4 text-green-600" />
                        <AlertTitle className="font-bold text-green-700">Pet Encontrado</AlertTitle>
                        <AlertDescription className="text-xs space-y-1 mt-1 text-green-900">
                          <p><strong>Código:</strong> {foundPet.codPet}</p>
                          <p><strong>Pet:</strong> {foundPet.nome}</p>
                          <p><strong>Tutor:</strong> {foundPet.tutorNome}</p>
                          <p><strong>Plano:</strong> {foundPet.healthPlanName || 'Particular'}</p>
                          <Button 
                            size="sm" 
                            variant="link" 
                            className="p-0 text-red-600 hover:text-red-700 h-auto font-semibold text-xs mt-2" 
                            onClick={handleClearLookup}
                          >
                            Limpar Cadastro Carregado
                          </Button>
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert className="bg-amber-500/10 border-amber-200 text-amber-800">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="font-bold text-amber-700">Novo Paciente</AlertTitle>
                        <AlertDescription className="text-xs space-y-2 text-amber-900 mt-1">
                          <p>Tutor e Pet não localizados no banco. Preencha os campos ao lado manualmente.</p>
                          <p>Após agendar, o check-in irá redirecionar para a tela de registro completo do Pet.</p>
                          <Button 
                            size="sm" 
                            variant="link" 
                            className="p-0 text-muted-foreground hover:text-foreground h-auto text-xs" 
                            onClick={handleClearLookup}
                          >
                            Limpar Busca
                          </Button>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Seção 2: Formulário de Agendamento */}
            <Card className="lg:col-span-2 border-primary/10 shadow-sm bg-card/60">
              <CardHeader>
                <CardTitle>Dados do Agendamento</CardTitle>
                <CardDescription>
                  Insira o médico, a data e valide as informações de contato do paciente.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleScheduleSubmit}>
                <CardContent className="space-y-4">
                  
                  {/* Seletor de Médico, Tipo, Data e Hora */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <span className="text-sm font-medium">Médico Veterinário:*</span>
                      <Select value={formMedicoId} onValueChange={setFormMedicoId}>
                        <SelectTrigger className="shadow-sm">
                          <SelectValue placeholder="Selecione o Médico" />
                        </SelectTrigger>
                        <SelectContent>
                          {veterinarios.map(v => (
                            <SelectItem key={v.id} value={v.id}>{v.nome} ({v.crmv || 'Sem CRMV'})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <span className="text-sm font-medium">Tipo:*</span>
                      <Select value={formTipo} onValueChange={(val: any) => setFormTipo(val)}>
                        <SelectTrigger className="shadow-sm">
                          <SelectValue placeholder="Tipo de Agendamento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Consulta">Consulta</SelectItem>
                          <SelectItem value="Retorno">Retorno</SelectItem>
                          <SelectItem value="Exame">Exame</SelectItem>
                          <SelectItem value="Cirurgia">Cirurgia</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Data e Hora */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <span className="text-sm font-medium">Data:*</span>
                        <Input 
                          type="date" 
                          value={formDate}
                          onChange={(e) => setFormDate(e.target.value)}
                          className="shadow-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <span className="text-sm font-medium">Horário:*</span>
                        <Input 
                          type="time" 
                          value={formTime}
                          onChange={(e) => setFormTime(e.target.value)}
                          className="shadow-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-4">
                    <h3 className="font-semibold text-foreground/80">Dados Cadastrais do Tutor e Pet</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <span className="text-sm font-medium">CPF do Tutor:*</span>
                        <Input 
                          placeholder="Digite apenas números (11 dígitos)" 
                          value={formTutorCpf}
                          onChange={(e) => setFormTutorCpf(e.target.value.replace(/\D/g, '').substring(0, 11))}
                          disabled={!!foundPet}
                          className="shadow-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <span className="text-sm font-medium">Nome do Tutor:*</span>
                        <Input 
                          placeholder="Nome completo do tutor" 
                          value={formTutorNome}
                          onChange={(e) => setFormTutorNome(e.target.value)}
                          disabled={!!foundPet}
                          className="shadow-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <span className="text-sm font-medium">Nome do Pet:*</span>
                        <Input 
                          placeholder="Nome do animal" 
                          value={formPetNome}
                          onChange={(e) => setFormPetNome(e.target.value)}
                          disabled={!!foundPet}
                          className="shadow-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <span className="text-sm font-medium">Telefone de Contato:</span>
                        <Input 
                          placeholder="(00) 00000-0000" 
                          value={formTutorTelefone}
                          onChange={(e) => setFormTutorTelefone(e.target.value)}
                          disabled={!!foundPet}
                          className="shadow-sm"
                        />
                      </div>
                    </div>
                  </div>

                </CardContent>
                <CardFooter className="border-t pt-4 flex gap-3 justify-end">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setActiveTab('diaria');
                      handleClearLookup();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/90">
                    Confirmar Agendamento
                  </Button>
                </CardFooter>
              </form>
            </Card>

          </div>
        </TabsContent>

        {/* ─── TAB 3: RELATÓRIOS ─── */}
        <TabsContent value="relatorio" className="space-y-6">
          
          {/* Barra de Filtros do Relatório */}
          <Card className="border-primary/10 shadow-sm bg-card/60">
            <CardHeader className="pb-4">
              <CardTitle>Filtrar Histórico de Agenda</CardTitle>
              <CardDescription>
                Selecione o período de agendamentos, o médico veterinário ou o status do compromisso.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                <div className="space-y-2">
                  <span className="text-sm font-medium">Data Inicial:</span>
                  <Input 
                    type="date" 
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    className="shadow-sm"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium">Data Final:</span>
                  <Input 
                    type="date" 
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    className="shadow-sm"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium">Médico:</span>
                  <Select value={reportMedicoId} onValueChange={setReportMedicoId}>
                    <SelectTrigger className="shadow-sm">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Médicos</SelectItem>
                      {veterinarios.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium">Tipo:</span>
                  <Select value={reportTipo} onValueChange={setReportTipo}>
                    <SelectTrigger className="shadow-sm">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Tipos</SelectItem>
                      <SelectItem value="Consulta">Consulta</SelectItem>
                      <SelectItem value="Retorno">Retorno</SelectItem>
                      <SelectItem value="Exame">Exame</SelectItem>
                      <SelectItem value="Cirurgia">Cirurgia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium">Situação:</span>
                  <Select value={reportStatus} onValueChange={setReportStatus}>
                    <SelectTrigger className="shadow-sm">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Status</SelectItem>
                      <SelectItem value="Agendado">Agendados</SelectItem>
                      <SelectItem value="Realizado">Realizados</SelectItem>
                      <SelectItem value="Cancelado">Cancelados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-between items-center gap-3 border-t pt-4">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleExportCSV}>
                    <Download className="w-4 h-4 mr-1.5" />
                    Exportar CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={handlePrint}>
                    <Printer className="w-4 h-4 mr-1.5" />
                    Imprimir Relatório
                  </Button>
                </div>
                <Button className="bg-primary hover:bg-primary/95" onClick={handleLoadReport}>
                  <Filter className="w-4 h-4 mr-1.5" />
                  Filtrar Agenda
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Cartões de KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-blue-100 shadow-sm bg-blue-50/20">
              <CardContent className="p-4 flex flex-col justify-center items-center">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Agendados</span>
                <span className="text-2xl font-bold text-blue-600 mt-1">{stats.total}</span>
              </CardContent>
            </Card>
            <Card className="border-yellow-100 shadow-sm bg-yellow-50/20">
              <CardContent className="p-4 flex flex-col justify-center items-center">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Pendentes</span>
                <span className="text-2xl font-bold text-yellow-600 mt-1">{stats.agendados}</span>
              </CardContent>
            </Card>
            <Card className="border-green-100 shadow-sm bg-green-50/20">
              <CardContent className="p-4 flex flex-col justify-center items-center">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Atendidos</span>
                <span className="text-2xl font-bold text-green-600 mt-1">{stats.realizados}</span>
              </CardContent>
            </Card>
            <Card className="border-red-100 shadow-sm bg-red-50/20">
              <CardContent className="p-4 flex flex-col justify-center items-center">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Cancelados</span>
                <span className="text-2xl font-bold text-red-600 mt-1">{stats.cancelados}</span>
              </CardContent>
            </Card>
          </div>

          {/* Listagem de Resultados do Relatório */}
          <Card className="border-muted shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle>Histórico de Agendamentos Filtrados</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredReportAgenda.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Médico</TableHead>
                      <TableHead>Pet</TableHead>
                      <TableHead>Tutor</TableHead>
                      <TableHead>CPF Tutor</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReportAgenda.map((item) => {
                      const dateObj = parseISO(item.dataAgendamento);
                      const dataStr = format(dateObj, 'dd/MM/yyyy HH:mm');
                      
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-semibold">{dataStr}</TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={`text-[11px] px-1.5 py-0.5 font-medium ${
                                item.tipo === 'Consulta' 
                                  ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                  : item.tipo === 'Retorno' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : item.tipo === 'Exame' 
                                  ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                  : item.tipo === 'Cirurgia' 
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              {item.tipo || 'Consulta'}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.medico?.nome || 'Não Vinculado'}</TableCell>
                          <TableCell className="font-bold">{item.petNome}</TableCell>
                          <TableCell>{item.tutorNome}</TableCell>
                          <TableCell>{item.tutorCpf}</TableCell>
                          <TableCell>{item.tutorTelefone || '-'}</TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline"
                              className={`text-[11px] px-1.5 py-0.5 font-medium ${
                                item.status === 'Realizado' 
                                  ? 'bg-green-50 text-green-600 border-green-200' 
                                  : item.status === 'Cancelado' 
                                  ? 'bg-red-50 text-red-600 border-red-200' 
                                  : 'bg-blue-50 text-blue-600 border-blue-200'
                              }`}
                            >
                              {item.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum registro correspondente aos filtros.
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>

      {/* ─── PRINT VIEW TABLE ─── */}
      <div className="hidden print:block mt-6">
        <table className="w-full border-collapse border border-slate-300 text-xs">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 p-2 text-left">Data/Hora</th>
              <th className="border border-slate-300 p-2 text-left">Tipo</th>
              <th className="border border-slate-300 p-2 text-left">Veterinário</th>
              <th className="border border-slate-300 p-2 text-left">Pet</th>
              <th className="border border-slate-300 p-2 text-left">Tutor</th>
              <th className="border border-slate-300 p-2 text-left">CPF Tutor</th>
              <th className="border border-slate-300 p-2 text-left">Telefone</th>
              <th className="border border-slate-300 p-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredReportAgenda.map((item) => {
              const dateObj = parseISO(item.dataAgendamento);
              const dataStr = format(dateObj, 'dd/MM/yyyy HH:mm');
              return (
                <tr key={item.id}>
                  <td className="border border-slate-300 p-2">{dataStr}</td>
                  <td className="border border-slate-300 p-2">{item.tipo || 'Consulta'}</td>
                  <td className="border border-slate-300 p-2">{item.medico?.nome || '-'}</td>
                  <td className="border border-slate-300 p-2 font-bold">{item.petNome}</td>
                  <td className="border border-slate-300 p-2">{item.tutorNome}</td>
                  <td className="border border-slate-300 p-2">{item.tutorCpf}</td>
                  <td className="border border-slate-300 p-2">{item.tutorTelefone || '-'}</td>
                  <td className="border border-slate-300 p-2">{item.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {/* KPI print summary */}
        <div className="mt-8 grid grid-cols-4 gap-4 text-xs border border-slate-300 p-4 rounded bg-slate-50">
          <div><strong>Total Agendamentos:</strong> {stats.total}</div>
          <div><strong>Atendidos:</strong> {stats.realizados}</div>
          <div><strong>Cancelados:</strong> {stats.cancelados}</div>
          <div><strong>Pendentes:</strong> {stats.agendados}</div>
        </div>
      </div>

      {/* ─── DIALOG: EDITAR AGENDAMENTO ─── */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] border-primary/10 bg-card">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-amber-600">
              <Edit className="w-5 h-5" />
              Editar Agendamento
            </DialogTitle>
            <DialogDescription>
              Altere o horário, data ou médico veterinário sem precisar redigitar os dados do tutor.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            {/* Seletor de Médico, Tipo, Data e Hora */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <span className="text-sm font-medium text-muted-foreground">Médico Veterinário:*</span>
                <Select value={editMedicoId} onValueChange={setEditMedicoId}>
                  <SelectTrigger className="shadow-sm">
                    <SelectValue placeholder="Selecione o Médico" />
                  </SelectTrigger>
                  <SelectContent>
                    {veterinarios.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.nome} ({v.crmv || 'Sem CRMV'})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium text-muted-foreground">Tipo:*</span>
                <Select value={editTipo} onValueChange={(val: any) => setEditTipo(val)}>
                  <SelectTrigger className="shadow-sm">
                    <SelectValue placeholder="Tipo de Agendamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Consulta">Consulta</SelectItem>
                    <SelectItem value="Retorno">Retorno</SelectItem>
                    <SelectItem value="Exame">Exame</SelectItem>
                    <SelectItem value="Cirurgia">Cirurgia</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Data e Hora */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">Data:*</span>
                  <Input 
                    type="date" 
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="shadow-sm"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">Horário:*</span>
                  <Input 
                    type="time" 
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Situação / Status */}
            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground">Situação do Agendamento:*</span>
              <Select value={editStatus} onValueChange={(val: any) => setEditStatus(val)}>
                <SelectTrigger className="shadow-sm">
                  <SelectValue placeholder="Situação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Agendado">Agendado</SelectItem>
                  <SelectItem value="Realizado">Realizado</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-4 space-y-4">
              <h3 className="font-semibold text-foreground/80">Dados Cadastrais do Tutor e Pet</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">CPF do Tutor:*</span>
                  <Input 
                    placeholder="Digite apenas números (11 dígitos)" 
                    value={editTutorCpf}
                    onChange={(e) => setEditTutorCpf(e.target.value.replace(/\D/g, '').substring(0, 11))}
                    className="shadow-sm"
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">Nome do Tutor:*</span>
                  <Input 
                    placeholder="Nome completo do tutor" 
                    value={editTutorNome}
                    onChange={(e) => setEditTutorNome(e.target.value)}
                    className="shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">Nome do Pet:*</span>
                  <Input 
                    placeholder="Nome do animal" 
                    value={editPetNome}
                    onChange={(e) => setEditPetNome(e.target.value)}
                    className="shadow-sm"
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">Telefone de Contato:</span>
                  <Input 
                    placeholder="(00) 00000-0000" 
                    value={editTutorTelefone}
                    onChange={(e) => setEditTutorTelefone(e.target.value)}
                    className="shadow-sm"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="border-t pt-4 flex gap-2 justify-end">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingItem(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90">
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
