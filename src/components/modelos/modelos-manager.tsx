"use client";

import * as React from 'react';
import { Plus, Search, FileText, Trash2, Edit2, Star, Save, Filter } from 'lucide-react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

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
  tipo: z.enum(['Exames', 'Receita', 'Atestado', 'Laudo', 'Encaminhamento', 'Outros']),
  conteudo: z.string().min(1, "Conteúdo é obrigatório"),
  is_favorite: z.boolean().default(false),
  medico_id: z.string().optional().nullable(),
});

type ModeloFormValues = z.infer<typeof modeloSchema>;

export function ModelosManager() {
  const { modelos, isLoaded, addModelo, updateModelo, deleteModelo } = useModelos();
  const { user, selectedEmpresaId } = useSession();
  const { toast } = useToast();
  const { veterinarios } = useVeterinarios();
  const { exams } = useExams();
  const isGeralRole = ['Master', 'Administrador', 'Administrador Auxiliar', 'Secretária Geral'].includes(user?.status || '');
  
  const [searchTerm, setSearchTerm] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingModelo, setEditingModelo] = React.useState<Modelo | null>(null);

  // States for Exam selection mode
  const [examSearch, setExamSearch] = React.useState("");
  const [selectedExamIds, setSelectedExamIds] = React.useState<string[]>([]);

  const form = useForm<ModeloFormValues>({
    resolver: zodResolver(modeloSchema),
    defaultValues: {
      nome: "",
      tipo: "Exames",
      conteudo: "",
      is_favorite: false,
      medico_id: "global",
    },
  });

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

  // Update conteudo when selectedExamIds change (only if tipo is Exames)
  React.useEffect(() => {
    if (selectedTipo === 'Exames') {
      const selectedExams = exams.filter(e => selectedExamIds.includes(e.id));
      const content = selectedExams.map(e => e.idExame || e.examCode).join('\n');
      form.setValue('conteudo', content || ' '); // Set space to pass validation if empty but we want validation to fail if truly empty
    }
  }, [selectedExamIds, selectedTipo, exams, form]);

  const filteredModelos = React.useMemo(() => {
    return modelos.filter(m => {
      const matchesSearch = m.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             m.conteudo.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === "all" || m.tipo === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [modelos, searchTerm, typeFilter]);

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

    if (modelo.tipo === 'Exames') {
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
        <h3 className="text-lg font-medium">Gerenciar Modelos</h3>
        <Button onClick={() => { setEditingModelo(null); form.reset(); setSelectedExamIds([]); setIsDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo Modelo
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-muted/30 p-4 rounded-lg border">
        <div className="relative w-full md:w-1/2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome ou conteúdo..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="Exames">Exames</SelectItem>
              <SelectItem value="Receita">Receita</SelectItem>
              <SelectItem value="Atestado">Atestado</SelectItem>
              <SelectItem value="Laudo">Laudo</SelectItem>
              <SelectItem value="Encaminhamento">Encaminhamento</SelectItem>
              <SelectItem value="Outros">Outros</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredModelos.map((modelo) => (
          <Card key={modelo.id} className={`group relative transition-all hover:shadow-md ${modelo.is_favorite ? 'border-primary/40 bg-primary/5' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <Badge variant={
                  modelo.tipo === 'Exames' ? 'default' :
                  modelo.tipo === 'Receita' ? 'secondary' :
                  modelo.tipo === 'Atestado' ? 'outline' : 
                  modelo.tipo === 'Encaminhamento' ? 'destructive' : 'secondary'
                }>
                  {modelo.tipo}
                </Badge>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`h-8 w-8 ${modelo.is_favorite ? 'text-amber-500 hover:text-amber-600' : 'text-slate-300 hover:text-amber-400 opacity-0 group-hover:opacity-100'}`}
                  onClick={() => handleToggleFavorite(modelo)}
                >
                  <Star className={`h-5 w-5 ${modelo.is_favorite ? 'fill-current' : ''}`} />
                </Button>
              </div>
              <CardTitle className="text-lg mt-2 group-hover:text-primary transition-colors">{modelo.nome}</CardTitle>
              <CardDescription className="line-clamp-2 h-10 text-xs">
                {modelo.conteudo}
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-0 flex justify-end gap-2 border-t mt-4 pt-4">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(modelo)}>
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(modelo.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}

        {filteredModelos.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed rounded-xl bg-muted/20">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground font-medium">Nenhum modelo encontrado.</p>
            <p className="text-muted-foreground/60 text-sm mt-1">Crie um novo modelo para agilizar seu trabalho.</p>
            <Button variant="outline" className="mt-4" onClick={() => { setEditingModelo(null); form.reset(); setSelectedExamIds([]); setIsDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Criar Primeiro Modelo
            </Button>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
          <div className="p-6 pb-2">
            <DialogHeader>
              <DialogTitle>{editingModelo ? 'Editar Modelo' : 'Novo Modelo'}</DialogTitle>
              <DialogDescription>
                {selectedTipo === 'Exames' 
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
                          if (val === 'Exames') {
                            setSelectedExamIds([]);
                          } else if (!form.getValues('conteudo') || form.getValues('conteudo').trim() === '') {
                            if (val === 'Receita') form.setValue('conteudo', 'MEDICAMENTO:\nUSO:\nORIENTAÇÕES:');
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
                          <SelectItem value="Exames">Exames (Kit Favoritos)</SelectItem>
                          <SelectItem value="Receita">Receita</SelectItem>
                          <SelectItem value="Atestado">Atestado</SelectItem>
                          <SelectItem value="Laudo">Laudo</SelectItem>
                          <SelectItem value="Encaminhamento">Encaminhamento / Internação</SelectItem>
                          <SelectItem value="Outros">Outros</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {selectedTipo === 'Exames' ? (
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
                <FormField
                  control={form.control}
                  name="conteudo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conteúdo do Template</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Digite aqui o texto que será carregado..." 
                          className="min-h-[250px] font-mono text-sm" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Use este espaço para cadastrar o texto padrão do seu modelo.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
