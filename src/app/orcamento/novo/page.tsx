"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { QrCode, Calculator, Download, Printer, Undo2, Search, CheckCircle2, Box, Beaker, FileText, Calendar as CalendarIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, addDays } from 'date-fns';

import { PageTitle } from '@/components/layout/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useExams } from '@/hooks/use-exams';
import { useMateriais } from '@/hooks/use-materiais';
import { useHealthPlans } from '@/hooks/use-health-plans';
import { usePrecos } from '@/hooks/use-precos';
import { useSession } from '@/context/session-context';
import { useOrcamentos } from '@/hooks/use-orcamentos';
import { useToast } from '@/hooks/use-toast';

const orcamentoSchema = z.object({
  nomePessoa: z.string().min(1, 'O nome do tutor/cliente é obrigatório.'),
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
  const { saveOrcamento } = useOrcamentos();
  const { toast } = useToast();
  
  const [searchTermExams, setSearchTermExams] = React.useState('');
  const [searchTermMateriais, setSearchTermMateriais] = React.useState('');
  const [selectedCategoriaMaterial, setSelectedCategoriaMaterial] = React.useState('all');
  
  const [generatedOrcamento, setGeneratedOrcamento] = React.useState<any | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const form = useForm<OrcamentoFormValues>({
    resolver: zodResolver(orcamentoSchema),
    defaultValues: {
      nomePessoa: '',
      cpl: '',
      planoId: '',
      validadeDias: '15',
      examIds: [],
      materialIds: [],
    },
  });

  const selectedPlanoId = form.watch('planoId');

  React.useEffect(() => {
    if (selectedPlanoId) {
      fetchPrecos(selectedPlanoId);
    }
  }, [selectedPlanoId, fetchPrecos]);

  const onSubmit = async (values: OrcamentoFormValues) => {
    const anoAtual = new Date().getFullYear();
    const randomSeq = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const codigoOrcamento = `OPet${anoAtual}${randomSeq}`;
    
    const validadeDate = addDays(new Date(), parseInt(values.validadeDias, 10));
    
    const selectedExamsData = exams.filter(e => values.examIds.includes(e.id)).map(exam => {
      const precoInfo = precos.find(p => p.exame_id === exam.id);
      return {
        ...exam,
        precoCalculado: precoInfo?.preco_atual || 0
      };
    });
    const selectedMateriaisData = materiais.filter(m => values.materialIds.includes(m.id));

    const materiaisTotal = selectedMateriaisData.reduce((acc, m) => acc + (m.precoUnitario || 0), 0);
    const examesTotal = selectedExamsData.reduce((acc, e) => acc + (e.precoCalculado || 0), 0);
    const totalGeral = materiaisTotal + examesTotal;
    
    const planoSelecionado = healthPlans.find(p => p.id === values.planoId);
    
    const orcamentoData = {
      codigo: codigoOrcamento,
      dataEmissao: new Date().toISOString(),
      validade: validadeDate.toISOString(),
      cliente: {
        nome: values.nomePessoa,
        cpl: values.cpl,
      },
      plano: planoSelecionado?.nome || 'Particular',
      exames: selectedExamsData,
      materiais: selectedMateriaisData,
      totalEstimado: totalGeral
    };

    setGeneratedOrcamento(orcamentoData);
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
  };

  const filteredExams = React.useMemo(() => {
    return exams.filter(e => e.name.toLowerCase().includes(searchTermExams.toLowerCase()) || e.examCode?.toLowerCase().includes(searchTermExams.toLowerCase()));
  }, [exams, searchTermExams]);

  const filteredMateriais = React.useMemo(() => {
    return materiais.filter(m => {
      const matchSearch = m.descricao.toLowerCase().includes(searchTermMateriais.toLowerCase()) || m.codigo?.toLowerCase().includes(searchTermMateriais.toLowerCase());
      const matchCat = selectedCategoriaMaterial === 'all' || m.categoria === selectedCategoriaMaterial;
      return matchSearch && matchCat;
    });
  }, [materiais, searchTermMateriais, selectedCategoriaMaterial]);

  const categoriasMateriais = [
    'Medicamentos e Suplementos', 'Nutrição Clínica', 'Higiene e Estética', 
    'Acessórios de Proteção', 'Insumos Clínicos e Descartáveis', 'EPIs', 'Diagnóstico Rápido', 'Outros'
  ];

  if (!examsLoaded || !materiaisLoaded || !plansLoaded) {
    return <div className="p-8 text-center"><Calculator className="w-8 h-8 animate-pulse mx-auto" /></div>;
  }

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
              <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <FormField control={form.control} name="nomePessoa" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Nome do Cliente / Tutor</FormLabel>
                    <FormControl><Input placeholder="Ex: João da Silva" {...field} /></FormControl>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Seleção de Exames */}
              <Card className="flex flex-col h-[500px]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2"><Beaker className="w-5 h-5 text-primary" /> Exames</CardTitle>
                    <Badge variant="secondary">{form.watch('examIds').length} selecionados</Badge>
                  </div>
                  <div className="relative mt-2">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar exame..." className="pl-8" value={searchTermExams} onChange={e => setSearchTermExams(e.target.value)} />
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                  <ScrollArea className="h-full px-6">
                    <FormField control={form.control} name="examIds" render={() => (
                      <FormItem>
                        {filteredExams.map((exam) => (
                          <FormField key={exam.id} control={form.control} name="examIds" render={({ field }) => {
                            return (
                              <FormItem key={exam.id} className="flex flex-row items-start space-x-3 space-y-0 p-3 hover:bg-muted/50 rounded-lg transition-colors border-b last:border-0">
                                <FormControl>
                                  <Checkbox checked={field.value?.includes(exam.id)} onCheckedChange={(checked) => {
                                    return checked ? field.onChange([...field.value, exam.id]) : field.onChange(field.value?.filter((value) => value !== exam.id))
                                  }} />
                                </FormControl>
                                <div className="space-y-1 leading-none flex-1 cursor-pointer" onClick={() => {
                                    const isChecked = field.value?.includes(exam.id);
                                    if (isChecked) { field.onChange(field.value?.filter((v) => v !== exam.id)); } 
                                    else { field.onChange([...field.value, exam.id]); }
                                }}>
                                  <div className="flex justify-between w-full">
                                    <FormLabel className="font-medium cursor-pointer">{exam.name}</FormLabel>
                                    <span className="text-xs font-semibold text-primary">
                                      {selectedPlanoId ? `R$ ${(precos.find(p => p.exame_id === exam.id)?.preco_atual || 0).toFixed(2)}` : '-'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">{exam.type} • Cód: {exam.examCode}</p>
                                </div>
                              </FormItem>
                            )
                          }} />
                        ))}
                      </FormItem>
                    )} />
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Seleção de Materiais */}
              <Card className="flex flex-col h-[500px]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2"><Box className="w-5 h-5 text-primary" /> Materiais</CardTitle>
                    <Badge variant="secondary">{form.watch('materialIds').length} selecionados</Badge>
                  </div>
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Buscar material..." className="pl-8" value={searchTermMateriais} onChange={e => setSearchTermMateriais(e.target.value)} />
                    </div>
                    <Select value={selectedCategoriaMaterial} onValueChange={setSelectedCategoriaMaterial}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Filtrar por Categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as Categorias</SelectItem>
                        {categoriasMateriais.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                  <ScrollArea className="h-full px-6">
                    <FormField control={form.control} name="materialIds" render={() => (
                      <FormItem>
                        {filteredMateriais.map((mat) => (
                          <FormField key={mat.id} control={form.control} name="materialIds" render={({ field }) => {
                            return (
                              <FormItem key={mat.id} className="flex flex-row items-start space-x-3 space-y-0 p-3 hover:bg-muted/50 rounded-lg transition-colors border-b last:border-0">
                                <FormControl>
                                  <Checkbox checked={field.value?.includes(mat.id)} onCheckedChange={(checked) => {
                                    return checked ? field.onChange([...field.value, mat.id]) : field.onChange(field.value?.filter((value) => value !== mat.id))
                                  }} />
                                </FormControl>
                                <div className="space-y-1 leading-none flex-1 cursor-pointer" onClick={() => {
                                    const isChecked = field.value?.includes(mat.id);
                                    if (isChecked) { field.onChange(field.value?.filter((v) => v !== mat.id)); } 
                                    else { field.onChange([...field.value, mat.id]); }
                                }}>
                                  <div className="flex justify-between w-full">
                                    <FormLabel className="font-medium cursor-pointer">{mat.descricao}</FormLabel>
                                    <span className="text-xs font-semibold text-primary">R$ {mat.precoUnitario?.toFixed(2)}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">{mat.categoria} • Cód: {mat.codigo}</p>
                                </div>
                              </FormItem>
                            )
                          }} />
                        ))}
                      </FormItem>
                    )} />
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
            
            {form.formState.errors.examIds && (
                <p className="text-sm font-medium text-destructive text-center">{form.formState.errors.examIds.message}</p>
            )}

            <div className="flex justify-end">
              <Button type="submit" size="lg" className="w-full md:w-auto text-lg px-8 py-6 h-auto">
                <QrCode className="mr-2 h-6 w-6" /> Gerar Orçamento com QR Code
              </Button>
            </div>
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
            <div className="flex items-center justify-center p-8 bg-white rounded-xl border-2 border-dashed border-gray-200">
                <QrCode className="w-48 h-48 text-gray-800" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Cliente:</span> <p className="font-medium">{generatedOrcamento.cliente.nome}</p></div>
                <div><span className="text-muted-foreground">Validade:</span> <p className="font-medium">{format(new Date(generatedOrcamento.validade), 'dd/MM/yyyy')}</p></div>
                <div><span className="text-muted-foreground">Plano Selecionado:</span> <p className="font-medium">{generatedOrcamento.plano}</p></div>
                <div><span className="text-muted-foreground">Total Estimado:</span> <p className="font-bold text-primary text-lg">R$ {generatedOrcamento.totalEstimado?.toFixed(2)}</p></div>
                <div><span className="text-muted-foreground">Exames:</span> <p className="font-medium">{generatedOrcamento.exames.length} itens</p></div>
                <div><span className="text-muted-foreground">Materiais:</span> <p className="font-medium">{generatedOrcamento.materiais.length} itens</p></div>
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
