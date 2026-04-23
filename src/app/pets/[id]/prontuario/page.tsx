"use client";

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Undo2, Plus, FileText, Activity, CalendarDays, Download, Stethoscope, Edit2, FilePlus, QrCode, UploadCloud, Printer, Trash2 } from 'lucide-react';
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
import { useSession } from '@/context/session-context';

export default function ProntuarioPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { pets, isLoaded: petsLoaded } = usePets();
  const { users, isLoaded: usersLoaded } = useUsers();
  const { prontuarios, isLoaded: prontLoaded, addProntuario, updateProntuario, deleteProntuario } = useProntuarios(id);
  const { documentos, isLoaded: docsLoaded, addDocumento } = useDocumentos();
  const { user, isMaster } = useSession();
  const { toast } = useToast();

  const [isProntuarioOpen, setIsProntuarioOpen] = React.useState(false);
  const [isDocOpen, setIsDocOpen] = React.useState(false);
  const [editingProntuario, setEditingProntuario] = React.useState<Prontuario | null>(null);
  const [editMode, setEditMode] = React.useState<'edit' | 'adendo' | 'new'>('new');

  const pet = pets.find(p => p.id === id);

  const veterinarios = React.useMemo(() => {
    return (users || []).filter(u => 
        u.status === 'MedicoVet' || 
        u.status === 'Administrador' || 
        u.status === 'Master'
    );
  }, [users]);
  
  const canSelectMedico = user?.status === 'Administrador' || user?.status === 'Master' || user?.status === 'Secretária' || user?.status === 'Secretária Geral' || user?.status === 'MedicoVet Geral';

  const formProntuario = useForm<ProntuarioInsert>({
    defaultValues: {
      pet_id: id,
      medico_id: '',
      tipo_atendimento: 'Consulta',
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

  React.useEffect(() => {
    if (user?.id && !editingProntuario && !canSelectMedico) {
      formProntuario.setValue('medico_id', user.id);
    }
  }, [user, formProntuario, editingProntuario, canSelectMedico]);

  if (!petsLoaded || !prontLoaded || !docsLoaded || !usersLoaded) {
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
      descricao_livre: '',
      prescricao_medica: '',
      status_retorno: 'Ativo',
      data_atendimento: new Date().toISOString().substring(0, 16)
    });
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
      descricao_livre: baseText,
      prescricao_medica: pront.prescricao_medica || '',
      status_retorno: pront.status_retorno,
      data_atendimento: new Date(pront.data_atendimento).toISOString().substring(0, 16)
    });

    setIsProntuarioOpen(true);
  };

  const onSubmitProntuario = async (values: ProntuarioInsert) => {
    if (editingProntuario && editMode !== 'new') {
        const res = await updateProntuario(editingProntuario.id, {
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

  const petProntuarioIds = prontuarios.map(p => p.id);
  const petDocumentos = documentos.filter(d => petProntuarioIds.includes(d.prontuario_id));

  // Separação em duas listas
  const consultas = prontuarios.filter(p => p.tipo_atendimento.includes('Consulta'));
  const demaisAtendimentos = prontuarios.filter(p => !p.tipo_atendimento.includes('Consulta'));

  return (
    <>
      <PageTitle title={`Prontuário: ${pet.nome}`} description={`${pet.especie} ${pet.raca ? `- ${pet.raca}` : ''} | Tutor: ${pet.tutorNome} (${pet.tutorCpf})`}>
        <div className="flex gap-2">
          <Button onClick={() => router.push(`/movement?newPetId=${pet.id}`)} variant="default" className="bg-emerald-600 hover:bg-emerald-700">
            <QrCode className="mr-2 h-4 w-4" /> Solicitar Guia de Exames
          </Button>
          <Link href="/movement?mode=prontuario" passHref>
            <Button variant="outline"><Undo2 className="mr-2 h-4 w-4" />Voltar</Button>
          </Link>
        </div>
      </PageTitle>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Resumo do Paciente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground font-semibold">Idade / Sexo</p>
              <p>{pet.idade || 'N/A'} - {pet.sexo === 'M' ? 'Macho' : 'Fêmea'}</p>
            </div>
            <div>
              <p className="text-muted-foreground font-semibold">Plano de Saúde</p>
              <p>{pet.healthPlanName || 'Particular'}</p>
            </div>
            <div>
              <p className="text-muted-foreground font-semibold">Tutor / Contato</p>
              <p>{pet.tutorNome}<br/>{pet.tutorTelefone || 'Sem tel'}</p>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-3">
          <Tabs defaultValue="historico" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none px-4 h-12 bg-transparent mb-4">
              <TabsTrigger value="historico" className="data-[state=active]:bg-primary/5 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none text-base border-b-2 border-transparent">
                <Activity className="w-4 h-4 mr-2" /> Histórico Clínico Misto
              </TabsTrigger>
              <TabsTrigger value="documentos" className="data-[state=active]:bg-primary/5 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none text-base border-b-2 border-transparent">
                <FileText className="w-4 h-4 mr-2" /> Documentos e Arquivos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="historico" className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold flex items-center gap-2"><CalendarDays className="w-5 h-5" /> Painel de Atendimentos</h3>
                <Button onClick={openNewProntuario}><Plus className="w-4 h-4 mr-2" /> Registrar Evolução</Button>
              </div>

              {prontuarios.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/20">
                  <Stethoscope className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum atendimento clínico registrado para o pet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
                  
                  {/* COLUNA ESQUERDA: CONSULTAS */}
                  <div className="space-y-4">
                      <div className="border-b-2 border-blue-200 pb-2 mb-4">
                          <h4 className="font-bold text-blue-800 text-lg flex items-center"><Stethoscope className="w-5 h-5 mr-2" /> Evoluções / Consultas</h4>
                      </div>
                      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-blue-200 before:to-transparent">
                          {consultas.length === 0 && <p className="text-sm text-gray-400 italic py-4">Nenhuma consulta registrada.</p>}
                          {consultas.map((pront) => {
                             const mode = verifyEditPermission(pront);
                             return (
                                <div key={pront.id} className="relative flex items-center group is-active">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-blue-100 text-blue-600 shadow shrink-0 z-10 mr-4">
                                    <Stethoscope className="w-5 h-5" />
                                </div>
                                <div className="flex-1 p-4 rounded border border-slate-200 shadow bg-white hover:border-blue-400 transition-colors">
                                    <div className="flex items-center justify-between space-x-2 mb-2">
                                        <div className="font-bold text-slate-900">{pront.tipo_atendimento}</div>
                                        <time className="font-caveat font-medium text-blue-600 text-[15px]">
                                            {format(new Date(pront.data_atendimento), "dd MMM, yy HH:mm", { locale: ptBR })}
                                        </time>
                                    </div>
                                    <div className="text-slate-600 text-sm mb-3 whitespace-pre-wrap leading-relaxed">{pront.descricao_livre || <span className="italic opacity-50">Sem descrição...</span>}</div>
                                    
                                    <div className="mt-3 text-xs text-slate-400 flex flex-wrap gap-2 justify-between items-center border-t pt-2">
                                        <div className="flex gap-2">
                                            <span className="text-xs text-blue-500/70 font-mono font-bold self-center border rounded px-1.5 py-0.5 bg-blue-50/50 mr-1">{pront.codigo_prontuario || `PRT-${pront.id.split('-')[0]}`}</span>
                                            <Button variant="outline" size="sm" className="h-7 text-xs bg-slate-50" onClick={() => { formDoc.setValue('prontuario_id', pront.id); setIsDocOpen(true); }}><FilePlus className="w-3 h-3 mr-1"/> Emitir Via</Button>
                                        </div>
                                        {mode && (
                                            <div className="flex gap-1 border-l pl-2">
                                                {mode === 'edit' && (
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteClick(pront.id)}>
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" className="h-7 text-blue-600 focus:bg-blue-50" onClick={() => handleEditClick(pront)}>
                                                    {mode === 'edit' ? <><Edit2 className="w-3 h-3 mr-1"/> Editar</> : <><Plus className="w-3 h-3 mr-1"/> Adendo</>}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                </div>
                             )
                          })}
                      </div>
                  </div>

                  {/* COLUNA DIREITA: DEMAIS E EXAMES */}
                  <div className="space-y-4">
                      <div className="border-b-2 border-emerald-200 pb-2 mb-4">
                          <h4 className="font-bold text-emerald-800 text-lg flex items-center"><Activity className="w-5 h-5 mr-2" /> Exames / Procedimentos</h4>
                      </div>
                      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-emerald-200 before:to-transparent">
                          {demaisAtendimentos.length === 0 && <p className="text-sm text-gray-400 italic py-4">Nenhum laudo/exame nesta via.</p>}
                          {demaisAtendimentos.map((pront) => {
                             const mode = verifyEditPermission(pront);
                             return (
                                <div key={pront.id} className="relative flex items-center group is-active">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-emerald-100 text-emerald-600 shadow shrink-0 z-10 mr-4">
                                    <Activity className="w-5 h-5" />
                                </div>
                                <div className="flex-1 p-4 rounded border border-slate-200 shadow bg-white hover:border-emerald-400 transition-colors">
                                    <div className="flex items-center justify-between space-x-2 mb-2">
                                        <div className="font-bold text-slate-900">{pront.tipo_atendimento}</div>
                                        <time className="font-caveat font-medium text-emerald-700 text-[15px]">
                                            {format(new Date(pront.data_atendimento), "dd MMM, yy HH:mm", { locale: ptBR })}
                                        </time>
                                    </div>
                                    <div className="text-slate-600 text-sm mb-3 whitespace-pre-wrap leading-relaxed">{pront.descricao_livre || <span className="italic opacity-50">S/ Descrição</span>}</div>
                                    
                                    <div className="mt-3 text-xs text-slate-400 flex flex-wrap gap-2 justify-between items-center border-t pt-2">
                                        <div className="flex gap-2">
                                            <span className="text-xs text-emerald-500/70 font-mono font-bold self-center border rounded px-1.5 py-0.5 bg-emerald-50/50 mr-1">{pront.codigo_prontuario || `PRT-${pront.id.split('-')[0]}`}</span>
                                            <Button variant="outline" size="sm" className="h-7 text-xs bg-slate-50" onClick={() => { formDoc.setValue('prontuario_id', pront.id); setIsDocOpen(true); }}><FilePlus className="w-3 h-3 mr-1"/> Laudar / Emitir Recibo</Button>
                                        </div>
                                        {mode && (
                                            <div className="flex gap-1 border-l pl-2">
                                                {mode === 'edit' && (
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteClick(pront.id)}>
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" className="h-7 text-emerald-700 focus:bg-emerald-50" onClick={() => handleEditClick(pront)}>
                                                    {mode === 'edit' ? <><Edit2 className="w-3 h-3 mr-1"/> Msg</> : <><Plus className="w-3 h-3 mr-1"/> Adendo</>}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                </div>
                             )
                          })}
                      </div>
                  </div>

                </div>
              )}
            </TabsContent>

            <TabsContent value="documentos" className="space-y-4">
               <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold flex items-center gap-2"><FileText className="w-5 h-5" /> Impressos Emitidos</h3>
                <Button variant="secondary" onClick={() => {
                    if (prontuarios.length > 0) {
                        formDoc.setValue('prontuario_id', prontuarios[0].id);
                    }
                    setIsDocOpen(true);
                }}>
                  <Plus className="w-4 h-4 mr-2" /> Gerar Documento / Em branco
                </Button>
               </div>

               {petDocumentos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/20">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
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
                                <Button className="w-full mt-4" variant="default" onClick={() => {
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
                name="descricao_livre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Evolução Técnica / Laudo</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descreva sinais, anamneses..." className={`min-h-[150px] font-medium leading-relaxed ${editMode==='adendo' ? 'bg-amber-50 focus-visible:ring-amber-400 border-amber-200' : ''}`} {...field} value={field.value || ''} />
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
              
              <div className="flex justify-end pt-4">
                <Button type="submit" variant={editMode === 'adendo' ? 'secondary' : 'default'} className={editMode === 'adendo' ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 font-bold' : ''}>
                    {editMode === 'new' ? 'Salvar Registro' : 'Confirmar Atualização'}
                </Button>
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
                    <FormLabel>Texto Completo (Sairá exatamente assim na Impressão)</FormLabel>
                    <FormControl>
                    <Textarea placeholder="Digite o conteúdo aqui..." className="min-h-[250px] font-mono text-sm leading-relaxed whitespace-pre-wrap bg-slate-50" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <div className="flex justify-end pt-4">
                <Button type="submit"><Printer className="w-4 h-4 mr-2" /> Gerar Prédio Final</Button>
            </div>
            </form>
        </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
