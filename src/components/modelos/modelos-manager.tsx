"use client";

import * as React from 'react';
import { Plus, Search, FileText, Trash2, Edit2, Star, Save, Filter, Printer, Undo2 } from 'lucide-react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter, useSearchParams } from 'next/navigation';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from "@/hooks/use-toast";

import { useModelos } from '@/hooks/use-modelos';
import { useVeterinarios } from '@/hooks/use-veterinarios';
import { useExams } from '@/hooks/use-exams';
import { useSession } from '@/context/session-context';
import { Modelo } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

const modeloSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  tipo: z.enum(['Exame_Lab', 'Exame_Img', 'Atestado', 'Laudo', 'Encaminhamento/Internação', 'Outros']),
  conteudo: z.string().min(1, "Conteúdo é obrigatório"),
  is_favorite: z.boolean().default(false),
  medico_id: z.string().optional().nullable(),
});

type ModeloFormValues = z.infer<typeof modeloSchema>;

export function ModelosManager() {
  const searchParams = useSearchParams();
  const { modelos, isLoaded, addModelo, updateModelo, deleteModelo } = useModelos();
  const { user, selectedEmpresaId } = useSession();
  const { toast } = useToast();
  const { veterinarios } = useVeterinarios();
  const { exams } = useExams();
  const isGeralRole = ['Master', 'Administrador', 'Administrador Auxiliar', 'Secretária Geral'].includes(user?.status || '');
  
  const [searchTerm, setSearchTerm] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [medicoFilter, setMedicoFilter] = React.useState<string>(searchParams.get('medicoId') || "all");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  React.useEffect(() => {
    const medicoId = searchParams.get('medicoId');
    if (medicoId) setMedicoFilter(medicoId);
  }, [searchParams]);
  const [editingModelo, setEditingModelo] = React.useState<Modelo | null>(null);
  const router = useRouter();
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  // States for Exam selection mode
  const [examSearch, setExamSearch] = React.useState("");
  const [selectedExamIds, setSelectedExamIds] = React.useState<string[]>([]);

  const form = useForm<ModeloFormValues>({
    resolver: zodResolver(modeloSchema),
    defaultValues: {
      nome: "",
      tipo: "Exame_Lab",
      conteudo: "",
      is_favorite: false,
      medico_id: "global",
    },
  });

  const handleInsertKey = React.useCallback((key: string) => {
    const currentContent = form.getValues('conteudo') || '';
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newContent = currentContent.substring(0, start) + key + currentContent.substring(end);
      form.setValue('conteudo', newContent, { shouldDirty: true, shouldValidate: true });
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + key.length, start + key.length);
      }, 0);
    } else {
      form.setValue('conteudo', currentContent + (currentContent && !currentContent.endsWith(' ') ? ' ' : '') + key, { shouldDirty: true, shouldValidate: true });
    }
  }, [form]);

  const selectedTipo = form.watch("tipo");

  // Filter exams based on search and sort selected ones at top
  const filteredExams = React.useMemo(() => {
    let baseExams = exams;
    if (examSearch) {
      const lower = examSearch.toLowerCase();
      baseExams = exams.filter(e => 
        e.name.toLowerCase().includes(lower) || 
        e.idExame?.toLowerCase().includes(lower) || 
        e.examCode?.toLowerCase().includes(lower)
      );
    }
    
    const selected = baseExams.filter(e => selectedExamIds.includes(e.id));
    const unselected = baseExams.filter(e => !selectedExamIds.includes(e.id));
    return [...selected, ...unselected];
  }, [exams, examSearch, selectedExamIds]);

  // Update conteudo when selectedExamIds change (only if tipo is Exame_Lab or Exame_Img)
  React.useEffect(() => {
    if (['Exame_Lab', 'Exame_Img'].includes(selectedTipo)) {
      const selectedExams = exams.filter(e => selectedExamIds.includes(e.id));
      const content = selectedExams.map(e => e.idExame || e.examCode).join('\n');
      form.setValue('conteudo', content || ' '); // Set space to pass validation if empty but we want validation to fail if truly empty
    }
  }, [selectedExamIds, selectedTipo, exams, form]);

  const filteredModelos = React.useMemo(() => {
    return modelos.filter(m => {
      // Role-based visibility
      if (!isGeralRole && m.medico_id && m.medico_id !== 'global' && m.medico_id !== user?.id) {
        return false;
      }

      // Medico filter (for admins)
      if (isGeralRole && medicoFilter !== 'all') {
        const mId = m.medico_id || 'global';
        if (mId !== medicoFilter) return false;
      }

      const matchesSearch = m.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             m.conteudo.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === "all" || m.tipo === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [modelos, searchTerm, typeFilter, isGeralRole, medicoFilter, user]);

  const onSubmit = async (values: ModeloFormValues) => {
    if (!selectedEmpresaId || !user) return;

    const targetMedicoId = isGeralRole ? (values.medico_id === 'global' ? null : (values.medico_id || null)) : user.id;

    if (editingModelo) {
      const res = await updateModelo(editingModelo.id, {
        ...values,
        medico_id: targetMedicoId
      });
      if (res.success) {
        toast({ title: "Sucesso", description: "Modelo atualizado com sucesso." });
        setIsDialogOpen(false);
        setEditingModelo(null);
        form.reset();
        setSelectedExamIds([]);
      } else {
        toast({ title: "Erro", description: res.message, variant: "destructive" });
      }
    } else {
      const res = await addModelo({
        ...values,
        medico_id: targetMedicoId,
        empresa_id: selectedEmpresaId!,
      });
      if (res.success) {
        toast({ title: "Sucesso", description: "Modelo criado com sucesso." });
        setIsDialogOpen(false);
        form.reset();
        setSelectedExamIds([]);
      } else {
        toast({ title: "Erro", description: res.message, variant: "destructive" });
      }
    }
  };

  const handleEdit = (modelo: Modelo) => {
    setEditingModelo(modelo);
    form.reset({
      nome: modelo.nome,
      tipo: modelo.tipo,
      conteudo: modelo.conteudo,
      is_favorite: modelo.is_favorite || false,
      medico_id: modelo.medico_id || 'global',
    });

    if (['Exame_Lab', 'Exame_Img'].includes(modelo.tipo as any)) {
      const lines = modelo.conteudo.split('\n').map(l => l.trim()).filter(Boolean);
      const ids = exams.filter(e => 
        lines.includes(e.idExame || '') || 
        lines.includes(e.examCode || '')
      ).map(e => e.id);
      setSelectedExamIds(ids);
    } else {
      setSelectedExamIds([]);
    }
    
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este modelo?")) {
      const res = await deleteModelo(id);
      if (res.success) {
        toast({ title: "Sucesso", description: "Modelo excluído." });
      } else {
        toast({ title: "Erro", description: res.message, variant: "destructive" });
      }
    }
  };

  const handleToggleFavorite = async (modelo: Modelo) => {
    const res = await updateModelo(modelo.id, { is_favorite: !modelo.is_favorite });
    if (!res.success) {
      toast({ title: "Erro", description: res.message, variant: "destructive" });
    }
  };

  if (!isLoaded) {
    return <div className="p-8 text-center text-muted-foreground">Carregando modelos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Gerenciar Modelos</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/veterinarios?tab=list')}>
            <Undo2 className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => { setEditingModelo(null); form.reset(); setSelectedExamIds([]); setIsDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Novo Modelo
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
        <div className="relative w-full md:w-1/2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome ou conteúdo..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 border-slate-200"
          />
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {isGeralRole && (
            <Select value={medicoFilter} onValueChange={setMedicoFilter}>
              <SelectTrigger className="w-[180px] border-slate-200">
                <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Médico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Médicos</SelectItem>
                <SelectItem value="global">Global (Todos)</SelectItem>
                {veterinarios.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px] border-slate-200">
              <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="Exame_Lab">Exames</SelectItem>
              <SelectItem value="Exame_Img">Imagens</SelectItem>
              <SelectItem value="Atestado">Atestado</SelectItem>
              <SelectItem value="Laudo">Laudo</SelectItem>
              <SelectItem value="Encaminhamento/Internação">Encaminhamento</SelectItem>
              <SelectItem value="Outros">Outros</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-50">
              <TableHead className="w-[150px] font-semibold text-slate-600">Tipo</TableHead>
              <TableHead className="font-semibold text-slate-600">Nome do Modelo</TableHead>
              <TableHead className="font-semibold text-slate-600">Médico / Global</TableHead>
              <TableHead className="text-right font-semibold text-slate-600">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredModelos.map((modelo) => {
              const medicoNome = modelo.medico_id === 'global' || !modelo.medico_id 
                ? 'Global' 
                : veterinarios.find(v => v.id === modelo.medico_id)?.nome || 'Desconhecido';
                
              const displayTipo = ['Exame_Lab', 'Exame_Img'].includes(modelo.tipo) ? 'Exames' : modelo.tipo;

              return (
                <TableRow key={modelo.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                  <TableCell>
                    <Badge variant={
                      ['Exame_Lab', 'Exame_Img'].includes(modelo.tipo) ? 'default' :
                      modelo.tipo === 'Atestado' ? 'secondary' :
                      modelo.tipo === 'Encaminhamento/Internação' ? 'destructive' : 'outline'
                    } className={['Exame_Lab', 'Exame_Img'].includes(modelo.tipo) ? 'bg-blue-500 hover:bg-blue-600' : ''}>
                      {displayTipo}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      <button onClick={() => handleToggleFavorite(modelo)} className="focus:outline-none mt-0.5">
                        <Star className={`h-4 w-4 ${modelo.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-slate-200 hover:text-amber-400'}`} />
                      </button>
                      <span className="text-slate-700 dark:text-slate-300">{modelo.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400">
                    {medicoNome}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Imprimir" onClick={() => {
                        const reportData = {
                          title: `Modelo: ${modelo.nome}`,
                          subtitle: `Tipo: ${displayTipo} | Médico: ${medicoNome}`,
                          headers: ["Conteúdo do Modelo"],
                          rows: [[modelo.conteudo]],
                          backUrl: '/veterinarios?tab=modelos'
                        };
                        localStorage.setItem('print-report-data', JSON.stringify(reportData));
                        router.push('/print/report');
                      }}>
                        <Printer className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(modelo)}>
                        <Edit2 className="h-4 w-4 text-slate-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(modelo.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            
            {filteredModelos.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-40 text-center">
                  <FileText className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">Nenhum modelo encontrado.</p>
                  <Button variant="link" className="mt-2 text-blue-500" onClick={() => { setEditingModelo(null); form.reset(); setSelectedExamIds([]); setIsDialogOpen(true); }}>
                    Criar novo modelo
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
          <div className="p-6 pb-2">
            <DialogHeader>
              <DialogTitle>{editingModelo ? 'Editar Modelo' : 'Novo Modelo'}</DialogTitle>
              <DialogDescription>
                {['Exame_Lab', 'Exame_Img'].includes(selectedTipo)
                  ? 'Selecione os exames que compõem este kit favorito.' 
                  : 'Crie um modelo reutilizável de texto para seus atendimentos.'}
              </DialogDescription>
            </DialogHeader>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 space-y-4 pb-2">
              {isGeralRole && (
                <FormField
                  control={form.control}
                  name="medico_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Atribuir a (Opcional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'global'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione para quem..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="global">Global (Todos os Veterinários)</SelectItem>
                          {veterinarios.map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Selecione um veterinário específico ou deixe global.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Modelo / Kit</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Kit Pré-Operatório" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Documento</FormLabel>
                      <Select 
                        onValueChange={(val: any) => {
                          field.onChange(val);
                          if (['Exame_Lab', 'Exame_Img'].includes(val)) {
                            setSelectedExamIds([]);
                          } else if (!form.getValues('conteudo') || form.getValues('conteudo').trim() === '') {
                            if (val === 'Atestado') form.setValue('conteudo', 'Atesto para os devidos fins que o paciente foi atendido nesta data...');
                          }
                        }} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Exame_Lab">Exame_Lab</SelectItem>
                          <SelectItem value="Exame_Img">Exame_Img</SelectItem>
                          <SelectItem value="Atestado">Atestado</SelectItem>
                          <SelectItem value="Laudo">Laudo</SelectItem>
                          <SelectItem value="Encaminhamento/Internação">Encaminhamento / Internação</SelectItem>
                          <SelectItem value="Outros">Outros</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {['Exame_Lab', 'Exame_Img'].includes(selectedTipo) ? (
                <div className="space-y-4 border p-4 rounded-lg bg-muted/20">
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-base">Selecionar Exames do Kit</FormLabel>
                    <Badge variant="outline">{selectedExamIds.length} selecionados</Badge>
                  </div>
                  
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Filtrar exames..." 
                      value={examSearch}
                      onChange={(e) => setExamSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <ScrollArea className="h-[300px] rounded-md border bg-background p-4">
                    <div className="space-y-3">
                      {filteredExams.map((exam) => (
                        <div key={exam.id} className="flex items-start space-x-3 group">
                          <Checkbox 
                            id={`exam-${exam.id}`}
                            checked={selectedExamIds.includes(exam.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedExamIds(prev => [...prev, exam.id]);
                              } else {
                                setSelectedExamIds(prev => prev.filter(id => id !== exam.id));
                              }
                            }}
                          />
                          <label 
                            htmlFor={`exam-${exam.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                          >
                            <span className="font-mono text-primary font-bold mr-2">
                              {exam.idExame || exam.examCode}
                            </span>
                            {exam.name}
                          </label>
                        </div>
                      ))}
                      {filteredExams.length === 0 && (
                        <p className="text-center text-muted-foreground py-10">Nenhum exame encontrado.</p>
                      )}
                    </div>
                  </ScrollArea>
                  
                  <FormField
                    control={form.control}
                    name="conteudo"
                    render={({ field }) => (
                      <FormItem className="hidden">
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {form.formState.errors.conteudo && (
                    <p className="text-sm font-medium text-destructive">Selecione ao menos um exame para o kit.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="conteudo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Conteúdo do Template</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            ref={(e) => {
                              field.ref(e);
                              textareaRef.current = e;
                            }}
                            placeholder="Digite aqui o texto que será carregado..." 
                            className="min-h-[250px] font-mono text-sm resize-y" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Chaves de Busca (Variáveis de Preenchimento)</h4>
                    <p className="text-xs text-slate-500 mb-3">Clique em uma variável abaixo para inseri-la no texto. Elas serão substituídas pelos dados reais ao usar este modelo.</p>
                    <div className="flex flex-wrap gap-2">
                      {['{Nome do Pet}', '{Espécie}', '{Raça}', '{Idade}', '{Nome do Tutor}', '{CPF do Tutor}', '{Nome do Veterinário}', '{Data Atual}'].map(key => (
                        <Badge 
                          key={key} 
                          variant="outline" 
                          className="cursor-pointer bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 transition-colors"
                          onClick={() => handleInsertKey(key)}
                        >
                          {key}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <FormField
                control={form.control}
                name="is_favorite"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Marcar como Favorito</FormLabel>
                      <FormDescription>
                        Aparecerá com destaque nas buscas.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              </div>
              <div className="flex justify-end p-6 pt-4 gap-2 border-t bg-slate-50 dark:bg-slate-900 mt-auto">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit">
                  <Save className="mr-2 h-4 w-4" /> {editingModelo ? 'Salvar Alterações' : 'Criar Modelo'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
