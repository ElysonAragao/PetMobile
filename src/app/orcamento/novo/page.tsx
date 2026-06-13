"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { QrCode, Calculator, Download, Printer, Undo2, Search, CheckCircle2, Box, Beaker, FileText, Calendar as CalendarIcon, Phone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, addDays } from 'date-fns';
import { createClient } from '@/lib/supabase/client';

import { PageTitle } from '@/components/layout/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useExams } from '@/hooks/use-exams';
import { useMateriais } from '@/hooks/use-materiais';
import { useHealthPlans } from '@/hooks/use-health-plans';
import { usePrecos } from '@/hooks/use-precos';
import { useSession } from '@/context/session-context';
import { useOrcamentos } from '@/hooks/use-orcamentos';
import { useToast } from '@/hooks/use-toast';

const orcamentoSchema = z.object({
  nomePessoa: z.string().min(1, 'O nome do tutor/cliente é obrigatório.'),
  telefone: z.string().optional(),
  cpl: z.string().optional(),
  planoId: z.string().min(1, 'Obrigatório selecionar um plano/convênio.'),
  validadeDias: z.string().default('15'),
  examIds: z.array(z.string()).default([]),
  materialIds: z.array(z.string()).default([]),
}).refine(data => data.examIds.length > 0 || data.materialIds.length > 0, {
  message: "Selecione ao menos um exame ou material.",
  path: ["examIds"],
});

type OrcamentoFormValues = z.infer<typeof orcamentoSchema>;

export default function OrcamentoPage() {
  const router = useRouter();
  const { selectedEmpresaId } = useSession();
  const { exams, isLoaded: examsLoaded } = useExams();
  const { materiais, isLoaded: materiaisLoaded } = useMateriais();
  const { healthPlans, isLoaded: plansLoaded } = useHealthPlans();
  const { precos, fetchPrecos } = usePrecos();
  const { saveOrcamento, getNextOrcamentoCode } = useOrcamentos();
  const { toast } = useToast();
  
  const [searchTermExams, setSearchTermExams] = React.useState('');
  const [searchTermMateriais, setSearchTermMateriais] = React.useState('');
  const [selectedCategoriaMaterial, setSelectedCategoriaMaterial] = React.useState('all');
  const [materialQuantities, setMaterialQuantities] = React.useState<Record<string, number>>({});
  const [empresaCodigo, setEmpresaCodigo] = React.useState('000');
  
  const [generatedOrcamento, setGeneratedOrcamento] = React.useState<any | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const form = useForm<OrcamentoFormValues>({
    resolver: zodResolver(orcamentoSchema),
    defaultValues: {
      nomePessoa: '',
      telefone: '',
      cpl: '',
      planoId: '',
      validadeDias: '15',
      examIds: [],
      materialIds: [],
    },
  });

  const selectedPlanoId = form.watch('planoId');
  const selectedExamIds = form.watch('examIds') || [];
  const selectedMaterialIds = form.watch('materialIds') || [];

  React.useEffect(() => {
    async function getEmpresaCode() {
      if (selectedEmpresaId) {
        const supabase = createClient();
        const { data } = await supabase.from('pet_empresas').select('codigo').eq('id', selectedEmpresaId).single();
        if (data?.codigo) setEmpresaCodigo(data.codigo);
      }
    }
    getEmpresaCode();
  }, [selectedEmpresaId]);

  React.useEffect(() => {
    if (selectedPlanoId) {
      fetchPrecos(selectedPlanoId);
    }
  }, [selectedPlanoId, fetchPrecos]);

  const handleQuantityChange = (id: string, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      setMaterialQuantities(prev => ({ ...prev, [id]: num }));
    } else if (value === '') {
      setMaterialQuantities(prev => ({ ...prev, [id]: 1 }));
    }
  };

  const onSubmit = async (values: OrcamentoFormValues) => {
    setIsSaving(true);
    try {
      const codes = await getNextOrcamentoCode(empresaCodigo || 'Pet001');
      const codigoOrcamento = codes.codigo;
      const codigoLeitura = codes.leitura;
    
    const validadeDate = addDays(new Date(), parseInt(values.validadeDias, 10));
    
    const selectedExamsData = exams.filter(e => values.examIds.includes(e.id)).map(exam => {
      const precoInfo = precos.find(p => p.exame_id === exam.id);
      return {
        ...exam,
        precoCalculado: precoInfo?.preco_atual || 0
      };
    });
    const selectedMateriaisData = materiais.filter(m => values.materialIds.includes(m.id)).map(mat => {
      const qte = materialQuantities[mat.id] || 1;
      return {
        ...mat,
        quantidade: qte,
        totalItem: (mat.precoUnitario || 0) * qte
      };
    });

    const materiaisTotal = selectedMateriaisData.reduce((acc, m) => acc + (m.totalItem || 0), 0);
    const examesTotal = selectedExamsData.reduce((acc, e) => acc + (e.precoCalculado || 0), 0);
    const totalGeral = materiaisTotal + examesTotal;
    
    const planoSelecionado = healthPlans.find(p => p.id === values.planoId);
    
    const orcamentoData = {
      codigo: codigoOrcamento,
      codigoLeitura: codigoLeitura,
      dataEmissao: new Date().toISOString(),
      validade: validadeDate.toISOString(),
      cliente: {
        nome: values.nomePessoa,
        telefone: values.telefone,
        cpl: values.cpl,
      },
      plano: planoSelecionado?.nome || 'Particular',
      exames: selectedExamsData,
      materiais: selectedMateriaisData,
      totalEstimado: totalGeral
    };

    setGeneratedOrcamento(orcamentoData);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = async () => {
    if (!generatedOrcamento) return;
    
    setIsSaving(true);
    const result = await saveOrcamento(generatedOrcamento);
    setIsSaving(false);

    if (!result.success) {
       toast({ title: "Aviso", description: "O orçamento foi gerado mas houve erro ao salvar no sistema: " + result.message, variant: "destructive" });
    }

    localStorage.setItem(`print-orcamento-${generatedOrcamento.codigo}`, JSON.stringify(generatedOrcamento));
    router.push(`/print/orcamento/${generatedOrcamento.codigo}?origin=novo`);
  };

  const resetForm = () => {
    setGeneratedOrcamento(null);
    form.reset();
    setMaterialQuantities({});
  };

  // Filtros e ordenação: Selecionados sempre no topo
  const sortedAndFilteredExams = React.useMemo(() => {
    const filtered = exams.filter(e => 
      e.name.toLowerCase().includes(searchTermExams.toLowerCase()) || 
      e.examCode?.toLowerCase().includes(searchTermExams.toLowerCase()) ||
      e.idExame?.toLowerCase().includes(searchTermExams.toLowerCase())
    );
    return filtered.sort((a, b) => {
      const aSel = selectedExamIds.includes(a.id);
      const bSel = selectedExamIds.includes(b.id);
      if (aSel && !bSel) return -1;
      if (!aSel && bSel) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [exams, searchTermExams, selectedExamIds]);

  const sortedAndFilteredMateriais = React.useMemo(() => {
    const filtered = materiais.filter(m => {
      const matchSearch = m.descricao.toLowerCase().includes(searchTermMateriais.toLowerCase()) || m.codigo?.toLowerCase().includes(searchTermMateriais.toLowerCase());
      const matchCat = selectedCategoriaMaterial === 'all' || m.categoria === selectedCategoriaMaterial;
      return matchSearch && matchCat;
    });
    return filtered.sort((a, b) => {
      const aSel = selectedMaterialIds.includes(a.id);
      const bSel = selectedMaterialIds.includes(b.id);
      if (aSel && !bSel) return -1;
      if (!aSel && bSel) return 1;
      return a.descricao.localeCompare(b.descricao);
    });
  }, [materiais, searchTermMateriais, selectedCategoriaMaterial, selectedMaterialIds]);

  const categoriasMateriais = [
    'Alimento', 'Material', 'Medicamento/Suplemento', 
    'Equipamento', 'Insumo', 'Outro'
  ];

  if (!examsLoaded || !materiaisLoaded || !plansLoaded) {
    return <div className="p-8 text-center"><Calculator className="w-8 h-8 animate-pulse mx-auto" /></div>;
  }

  // Cálculos dinâmicos em tempo real para exibir
  const examesTotal = selectedExamIds.reduce((acc, id) => {
    const preco = precos.find(p => p.exame_id === id)?.preco_atual || 0;
    return acc + preco;
  }, 0);
  
  const materiaisTotal = selectedMaterialIds.reduce((acc, id) => {
    const mat = materiais.find(m => m.id === id);
    const qte = materialQuantities[id] || 1;
    return acc + ((mat?.precoUnitario || 0) * qte);
  }, 0);
  const totalGeralEmTempoReal = examesTotal + materiaisTotal;

  return (
    <>
      <PageTitle title="Novo Orçamento" description="Gere orçamentos de exames e materiais com QR Code para seus clientes.">
        <Link href="/orcamento" passHref>
          <Button variant="outline">
            <Undo2 className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </Link>
      </PageTitle>

      {!generatedOrcamento ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Dados do Cliente</CardTitle>
                <CardDescription>Informações básicas para emissão do orçamento.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <FormField control={form.control} name="nomePessoa" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Nome do Cliente / Tutor</FormLabel>
                    <FormControl><Input placeholder="Ex: João da Silva" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="telefone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl><Input placeholder="Ex: (11) 99999-9999" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="cpl" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Complemento (CPL)</FormLabel>
                    <FormControl><Input placeholder="Ex: Apto 101" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="planoId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plano de Saúde / Convênio</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione o plano" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {healthPlans.map(plan => (
                          <SelectItem key={plan.id} value={plan.id}>{plan.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="validadeDias" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Validade (Dias)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="5">5 Dias</SelectItem>
                        <SelectItem value="10">10 Dias</SelectItem>
                        <SelectItem value="15">15 Dias</SelectItem>
                        <SelectItem value="30">30 Dias</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <Tabs defaultValue="exames" className="w-full">
              <div className="flex flex-col md:flex-row items-center bg-muted/20 p-2 rounded-xl border relative justify-center">
                <TabsList className="bg-transparent border-none h-auto z-10">
                  <TabsTrigger value="exames" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-8 py-2.5 text-base font-bold shadow-sm">
                    <Beaker className="mr-2 h-5 w-5" /> Exames ({selectedExamIds.length})
                  </TabsTrigger>
                  <TabsTrigger value="materiais" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-8 py-2.5 text-base font-bold shadow-sm">
                    <Box className="mr-2 h-5 w-5" /> Materiais ({selectedMaterialIds.length})
                  </TabsTrigger>
                </TabsList>
                
                <div className="md:absolute md:right-2 mt-4 md:mt-0 w-full md:w-auto z-20">
                  <Button type="submit" size="default" disabled={isSaving || (selectedExamIds.length === 0 && selectedMaterialIds.length === 0)} className="shadow-md shadow-primary/20 bg-primary hover:bg-primary/90 w-full md:w-auto h-10 px-6 font-semibold">
                    <QrCode className="mr-2 h-4 w-4" /> Gerar QR Code
                  </Button>
                </div>
              </div>
              
              <TabsContent value="exames" className="mt-0">
                <Card className="flex flex-col h-[500px]">
                  <CardHeader className="pb-3">
                    <div className="relative mt-2">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Buscar exame..." className="pl-8" value={searchTermExams} onChange={e => setSearchTermExams(e.target.value)} />
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-hidden p-0">
                    <ScrollArea className="h-full px-6">
                      <FormField control={form.control} name="examIds" render={() => (
                        <FormItem>
                          {sortedAndFilteredExams.map((exam) => (
                            <FormField key={exam.id} control={form.control} name="examIds" render={({ field }) => {
                              const isChecked = field.value?.includes(exam.id);
                              const precoItem = selectedPlanoId ? (precos.find(p => p.exame_id === exam.id)?.preco_atual || 0) : 0;
                              return (
                                <FormItem key={exam.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-md hover:bg-muted/30 border border-transparent hover:border-border transition-colors">
                                  <div className="flex items-start space-x-3 flex-1">
                                    <FormControl>
                                      <Checkbox
                                        id={`exam-${exam.id}`}
                                        checked={isChecked}
                                        onCheckedChange={(checked) => {
                                          if (checked) { field.onChange([...(field.value || []), exam.id]); } 
                                          else { field.onChange(field.value?.filter((v) => v !== exam.id)); }
                                        }}
                                      />
                                    </FormControl>
                                    <label htmlFor={`exam-${exam.id}`} className="text-sm font-medium leading-none cursor-pointer flex flex-wrap items-center gap-2">
                                      <span className="font-mono text-primary font-bold">{exam.idExame || exam.examCode}</span> — {exam.name}
                                      {exam.isUrgency && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 text-[10px] h-5 px-1 py-0">Padrão: Urgente</Badge>}
                                    </label>
                                  </div>
                                  <div className="mt-2 sm:mt-0 pl-7 sm:pl-0 text-right">
                                    {isChecked && (
                                      <span className="text-sm font-bold text-primary">
                                        R$ {precoItem.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </FormItem>
                              )
                            }} />
                          ))}
                        </FormItem>
                      )} />
                    </ScrollArea>
                  </CardContent>
                  <CardFooter className="bg-muted/10 border-t justify-end p-4">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Total Exames</p>
                      <p className="text-lg font-bold text-primary">R$ {examesTotal.toFixed(2)}</p>
                    </div>
                  </CardFooter>
                </Card>
              </TabsContent>

              <TabsContent value="materiais" className="mt-4">
                <Card className="flex flex-col h-[500px]">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row gap-2 mt-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Buscar material..." className="pl-8" value={searchTermMateriais} onChange={e => setSearchTermMateriais(e.target.value)} />
                      </div>
                      <Select value={selectedCategoriaMaterial} onValueChange={setSelectedCategoriaMaterial}>
                        <SelectTrigger className="h-10 md:w-[200px]">
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          {categoriasMateriais.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-hidden p-0">
                    <ScrollArea className="h-full px-6">
                      <FormField control={form.control} name="materialIds" render={() => (
                        <FormItem>
                          {sortedAndFilteredMateriais.map((mat) => (
                            <FormField key={mat.id} control={form.control} name="materialIds" render={({ field }) => {
                              const isChecked = field.value?.includes(mat.id);
                              const qte = materialQuantities[mat.id] || 1;
                              const precoUnit = mat.precoUnitario || 0;
                              const totalItem = precoUnit * qte;
                              return (
                                <FormItem key={mat.id} className="flex flex-col p-2 rounded-md hover:bg-muted/30 border border-transparent hover:border-border transition-colors">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                                    <div className="flex items-start space-x-3 flex-1">
                                      <FormControl>
                                        <Checkbox
                                          id={`mat-${mat.id}`}
                                          checked={isChecked}
                                          onCheckedChange={(checked) => {
                                            if (checked) { field.onChange([...(field.value || []), mat.id]); } 
                                            else { field.onChange(field.value?.filter((v) => v !== mat.id)); }
                                          }}
                                        />
                                      </FormControl>
                                      <label htmlFor={`mat-${mat.id}`} className="text-sm font-medium leading-none cursor-pointer flex flex-wrap items-center gap-2">
                                        <span className="font-mono text-primary font-bold">{mat.idMaterial || mat.codigo || 'S/C'}</span> — {mat.descricao}
                                      </label>
                                    </div>
                                  </div>
                                  
                                  {isChecked && (
                                    <div className="flex items-center gap-6 self-end sm:self-auto ml-7 sm:ml-0 bg-background p-2 rounded-lg border mt-2 w-max">
                                      <div className="flex flex-col items-end">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preço Unit.</span>
                                        <span className="text-base font-medium">R$ {precoUnit.toFixed(2)}</span>
                                      </div>
                                      <div className="flex flex-col items-center">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Qtd.</span>
                                        <Input 
                                          type="number" 
                                          min="1" 
                                          className="w-20 h-9 text-center font-bold text-lg" 
                                          value={materialQuantities[mat.id] || 1}
                                          onChange={(e) => handleQuantityChange(mat.id, e.target.value)}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      </div>
                                      <div className="flex flex-col items-end min-w-[100px]">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Item</span>
                                        <span className="text-lg font-black text-primary">R$ {totalItem.toFixed(2)}</span>
                                      </div>
                                    </div>
                                  )}
                                </FormItem>
                              )
                            }} />
                          ))}
                        </FormItem>
                      )} />
                    </ScrollArea>
                  </CardContent>
                  <CardFooter className="bg-muted/10 border-t justify-end p-4">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Total Materiais</p>
                      <p className="text-lg font-bold text-primary">R$ {materiaisTotal.toFixed(2)}</p>
                    </div>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
            
            <div className="flex items-center justify-between bg-muted/20 p-4 rounded-xl border">
              <span className="text-lg font-medium">Total Geral do Orçamento:</span>
              <span className="text-2xl font-black text-primary">R$ {totalGeralEmTempoReal.toFixed(2)}</span>
            </div>

            {form.formState.errors.examIds && (
                <p className="text-sm font-medium text-destructive text-center">{form.formState.errors.examIds.message}</p>
            )}
          </form>
        </Form>
      ) : (
        <Card className="max-w-2xl mx-auto border-primary/20 shadow-lg">
          <CardHeader className="text-center bg-primary/5 pb-8">
            <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
            <CardTitle className="text-3xl font-bold text-primary">Orçamento Gerado</CardTitle>
            <CardDescription className="text-lg">
              Código: <strong className="text-foreground">{generatedOrcamento.codigo}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl border shadow-inner gap-3">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(generatedOrcamento.codigoLeitura)}`} width={200} height={200} alt="QR Code" className="border-4 p-1 rounded-sm border-black" />
                <p className="text-xs text-muted-foreground font-mono">Leia este QR Code para consultar o orçamento</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm bg-muted/10 p-4 rounded-lg border">
                <div><span className="text-muted-foreground">Cliente:</span> <p className="font-medium">{generatedOrcamento.cliente.nome}</p></div>
                {generatedOrcamento.cliente.telefone && (
                  <div><span className="text-muted-foreground">Telefone:</span> <p className="font-medium">{generatedOrcamento.cliente.telefone}</p></div>
                )}
                <div><span className="text-muted-foreground">Validade:</span> <p className="font-medium">{format(new Date(generatedOrcamento.validade), 'dd/MM/yyyy')}</p></div>
                <div><span className="text-muted-foreground">Plano Selecionado:</span> <p className="font-medium">{generatedOrcamento.plano}</p></div>
                <div className="col-span-2 mt-2 pt-2 border-t"><span className="text-muted-foreground">Total Estimado:</span> <p className="font-bold text-primary text-2xl">R$ {generatedOrcamento.totalEstimado?.toFixed(2)}</p></div>
            </div>

            <div className="space-y-4 pt-2">
                {generatedOrcamento.exames.length > 0 && (
                    <div className="border rounded-md p-3">
                        <p className="font-semibold text-sm mb-2 text-slate-700 flex justify-between">Exames ({generatedOrcamento.exames.length})</p>
                        <ul className="space-y-1 max-h-32 overflow-y-auto pr-2">
                            {generatedOrcamento.exames.map((ex: any) => (
                                <li key={ex.id} className="text-xs text-slate-600 flex justify-between border-b pb-1 last:border-0">
                                    <span><strong className="font-mono">{ex.idExame || ex.examCode}</strong> — {ex.name}</span>
                                    <span>R$ {ex.precoCalculado?.toFixed(2)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {generatedOrcamento.materiais.length > 0 && (
                    <div className="border rounded-md p-3">
                        <p className="font-semibold text-sm mb-2 text-slate-700 flex justify-between">Materiais ({generatedOrcamento.materiais.length})</p>
                        <ul className="space-y-1 max-h-32 overflow-y-auto pr-2">
                            {generatedOrcamento.materiais.map((mat: any) => (
                                <li key={mat.id} className="text-xs text-slate-600 flex justify-between border-b pb-1 last:border-0">
                                    <span><strong className="font-mono">{mat.idMaterial || mat.codigo || 'S/C'}</strong> — {mat.descricao}</span>
                                    <span>{mat.quantidade > 1 ? `${mat.quantidade}x ` : ''}R$ {(mat.precoCalculado || (mat.precoUnitario * mat.quantidade)).toFixed(2)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-3 bg-muted/20 pt-6">
            <Button variant="outline" className="w-full" onClick={handlePrint} disabled={isSaving}>
              {isSaving ? <span className="animate-pulse">Salvando...</span> : <><Printer className="mr-2 h-4 w-4" /> Imprimir / PDF</>}
            </Button>
            <Button className="w-full" onClick={resetForm} disabled={isSaving}>
              <Calculator className="mr-2 h-4 w-4" /> Novo Orçamento
            </Button>
          </CardFooter>
        </Card>
      )}
    </>
  );
}

