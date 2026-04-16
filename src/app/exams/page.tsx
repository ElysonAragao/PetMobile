"use client";

import * as React from 'react';
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, FileX, PlusCircle, Trash2, Edit, ArrowUpDown, Beaker, Scan, AlertTriangle, Undo2, Upload, DollarSign, CheckCircle2, Info, Download } from 'lucide-react';
import Link from 'next/link';

import { Exam } from '@/lib/types';
import { useExams, ExamFormValues } from '@/hooks/use-exams';
import { useHealthPlans } from '@/hooks/use-health-plans';
import { usePrecos } from '@/hooks/use-precos';
import { exportToCSV } from '@/lib/export-utils';
import { format } from 'date-fns';
import { PageTitle } from '@/components/layout/page-title';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

const examSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().min(1, "Descrição é obrigatória"),
  type: z.enum(['Laboratório', 'Imagem'], { required_error: "Tipo de exame é obrigatório" }),
  examCode: z.string().optional(),
  idExame: z.string().optional().default(''),
  healthPlanId: z.string().optional().nullable(),
  healthPlanName: z.string().optional().nullable(),
  isUrgency: z.boolean().optional().default(false),
});

type SortConfig = {
  key: keyof Exam;
  direction: 'ascending' | 'descending';
};

function ExamList({ exams, isLoaded, onEdit, onDelete }: { exams: Exam[], isLoaded: boolean, onEdit: (exam: Exam) => void, onDelete: (id: string) => void }) {
  const [sortConfig, setSortConfig] = React.useState<SortConfig | null>(null);

  const sortedExams = React.useMemo(() => {
    let sortableItems = [...exams];
    if (sortConfig !== null && sortConfig.key) {
      sortableItems.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];

        if (valA === undefined || valA === null || valB === undefined || valB === null) return 0;

        if (valA < valB) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (valA > valB) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [exams, sortConfig]);

  const requestSort = (key: keyof Exam) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: keyof Exam) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    }
    return sortConfig.direction === 'ascending' ? '▲' : '▼';
  };

  if (!isLoaded) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
        <div>
          <CardTitle>Exames Cadastrados</CardTitle>
          <CardDescription>Visualize e gerencie todos os exames disponíveis.</CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => {
            const exportData = exams.map(e => ({
              'Nome_Exame': e.name,
              'Tipo': e.type,
              'Descricao': e.description,
              'ID_Exame': e.idExame || '',
              'Plano_Saude': e.healthPlanName || 'Particular',
              'Urgente': e.isUrgency ? 'Sim' : 'Não',
              'Codigo_Sequencial': e.examCode || ''
            }));
            
            const dataToExport = exportData.length > 0 ? exportData : [{
              'Nome_Exame': 'Ex: Hemograma',
              'Tipo': 'Laboratório',
              'Descricao': 'Coleta de sangue...',
              'ID_Exame': 'LAB001',
              'Plano_Saude': 'Todos',
              'Urgente': 'Não',
              'Codigo_Sequencial': 'EX00001'
            }];
            
            exportToCSV('modelo_importacao_exames', dataToExport);
          }}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV (Modelo)
        </Button>
      </CardHeader>
      <CardContent>
        {sortedExams.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button variant="ghost" onClick={() => requestSort('examCode')}>
                    Código
                    {getSortIndicator('examCode')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => requestSort('type')}>
                    Tipo
                    {getSortIndicator('type')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => requestSort('name')}>
                    Nome
                    {getSortIndicator('name')}
                  </Button>
                </TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => requestSort('idExame')}>
                    ID-Exame
                    {getSortIndicator('idExame')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => requestSort('healthPlanName')}>
                    Plano de Saúde
                    {getSortIndicator('healthPlanName')}
                  </Button>
                </TableHead>
                <TableHead className="text-center">Urgente</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedExams.map((exam) => (
                <TableRow key={exam.id}>
                  <TableCell className="font-mono">{exam.examCode}</TableCell>
                  <TableCell>
                    <Badge variant={exam.type === 'Laboratório' ? 'secondary' : 'outline'}>
                      {exam.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{exam.name}</TableCell>
                  <TableCell className="max-w-[300px] truncate">{exam.description}</TableCell>
                  <TableCell className="font-mono text-sm">{exam.idExame || exam.examCode}</TableCell>
                  <TableCell>{exam.healthPlanName || 'Particular/Sem Plano'}</TableCell>
                  <TableCell className="text-center">
                    {exam.isUrgency ? (
                      <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">Sim 🚨</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs italic">Não</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(exam)}>
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Editar</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">Excluir</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Isso irá excluir permanentemente o exame "{exam.name}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(exam.id)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12">
            <FileX className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum exame encontrado</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Comece cadastrando um novo exame na aba "Cadastrar".
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExamForm({ onFormSubmit, initialData, getNextExamCode, onCancel }: { onFormSubmit: (values: ExamFormValues) => Promise<any>, initialData?: Partial<ExamFormValues>, getNextExamCode: (type: 'Laboratório' | 'Imagem') => Promise<string>, onCancel?: () => void }) {
  const { healthPlans } = useHealthPlans();
  const nameInputRef = React.useRef<HTMLInputElement | null>(null);

  const form = useForm<ExamFormValues>({
    resolver: zodResolver(examSchema),
    defaultValues: initialData || { name: "", description: "", type: undefined, examCode: "", idExame: "", healthPlanId: null, healthPlanName: null, isUrgency: false },
  });

  const examType = form.watch('type');

  React.useEffect(() => {
    form.reset(initialData || { name: "", description: "", type: undefined, examCode: "", idExame: "", healthPlanId: null, healthPlanName: null, isUrgency: false });
  }, [initialData, form]);

  React.useEffect(() => {
    if (examType && !initialData?.examCode) { // Only generate for new exams
      getNextExamCode(examType).then(code => {
        form.setValue('examCode', code);
      });
    }
  }, [examType, getNextExamCode, form, initialData]);

  async function onSubmit(values: ExamFormValues) {
    await onFormSubmit(values);
    if (!initialData) {
      form.reset({ name: "", description: "", type: undefined, examCode: "", idExame: "", healthPlanId: null, healthPlanName: null, isUrgency: false });
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }

  const isEditMode = !!initialData?.name;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Tipo de Exame</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="flex flex-col md:flex-row gap-4"
                  disabled={isEditMode}
                >
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="Laboratório" />
                    </FormControl>
                    <FormLabel className="font-normal flex items-center gap-2">
                      <Beaker className="w-4 h-4" /> Laboratório
                    </FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="Imagem" />
                    </FormControl>
                    <FormLabel className="font-normal flex items-center gap-2">
                      <Scan className="w-4 h-4" /> Imagem
                    </FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isUrgency"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-red-50/30 border-red-100/50">
              <div className="space-y-0.5">
                <FormLabel className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-4 h-4" /> Solicitação Urgente?
                </FormLabel>
                <div className="text-[0.8rem] text-muted-foreground italic">
                  Se marcado, este exame aparecerá no filtro de "Urgente" na geração de guias.
                </div>
              </div>
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="examCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código do Exame</FormLabel>
                <FormControl>
                  <Input placeholder="Selecione um tipo..." {...field} disabled />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Nome do Exame</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Ex: Hemograma Completo" 
                    {...field} 
                    ref={(e) => {
                      field.ref(e);
                      if (e) nameInputRef.current = e;
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="idExame"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ID-Exame (Manual)</FormLabel>
                <FormControl>
                  <Input placeholder="Deixe vazio para sequencial" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="healthPlanId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Plano de Saúde (Opcional)</FormLabel>
                <Select
                  value={field.value || "none"}
                  onValueChange={(val) => {
                    if (val === "none") {
                      field.onChange(null);
                      form.setValue('healthPlanName', null);
                    } else {
                      field.onChange(val);
                      const selectedPlan = healthPlans.find(p => p.id === val);
                      if (selectedPlan) {
                        form.setValue('healthPlanName', selectedPlan.nome);
                      }
                    }
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sem Plano / Particular" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Sem Plano / Particular</SelectItem>
                    {healthPlans.map(hp => (
                      <SelectItem key={hp.id} value={hp.id}>{hp.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Textarea placeholder="Descreva brevemente o exame..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col md:flex-row gap-3">
          <Button type="submit" className="w-full md:w-auto" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Salvando...' : (
              <>
                <PlusCircle className="mr-2 h-4 w-4" />
                {isEditMode ? 'Salvar Alterações' : 'Cadastrar Exame'}
              </>
            )}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" className="w-full md:w-auto" onClick={onCancel}>
              Voltar
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}

export default function ExamsPage() {
  const { exams, addExam, updateExam, deleteExam, deleteAllExams, isLoaded, error, getNextExamCode } = useExams();
  const { healthPlans } = useHealthPlans();
  const [activeTab, setActiveTab] = React.useState("list");
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [selectedExam, setSelectedExam] = React.useState<Exam | null>(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const { toast } = useToast();
  const tabsListRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const ExamPrices = React.useMemo(() => function ExamPricesComp({ examsList, plansList }: { examsList: Exam[], plansList: import('@/lib/types').HealthPlan[] }) {
    const { precos, fetchPrecos, savePrecosBatch, isLoading } = usePrecos();
    const [selectedPlanId, setSelectedPlanId] = React.useState<string>("sem_plano");
    const [bulkPrices, setBulkPrices] = React.useState<Record<string, string>>({});
    const [hasChanges, setHasChanges] = React.useState(false);
    const [isImportingPrices, setIsImportingPrices] = React.useState(false);
    const priceInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
    const csvPriceInputRef = React.useRef<HTMLInputElement>(null);

    // When a plan is selected, fetch prices and auto-enter edit mode
    React.useEffect(() => {
      if (selectedPlanId !== "sem_plano") {
        fetchPrecos(selectedPlanId).then(() => {
          setHasChanges(false);
        });
      } else {
        setBulkPrices({});
        setHasChanges(false);
      }
    }, [selectedPlanId, fetchPrecos]);

    // When precos change, init the bulk prices map
    React.useEffect(() => {
      const initial: Record<string, string> = {};
      examsList.forEach(exam => {
        const p = precos.find(price => price.exame_id === exam.id);
        initial[exam.id] = p?.preco_atual != null ? String(p.preco_atual) : "";
      });
      setBulkPrices(initial);
    }, [precos, examsList]);

    // Auto-focus first price input when plan is selected and data is loaded
    React.useEffect(() => {
      if (selectedPlanId !== "sem_plano" && examsList.length > 0) {
        const timer = setTimeout(() => {
          const firstExamId = examsList[0]?.id;
          if (firstExamId && priceInputRefs.current[firstExamId]) {
            priceInputRefs.current[firstExamId]?.focus();
            priceInputRefs.current[firstExamId]?.select();
          }
        }, 300);
        return () => clearTimeout(timer);
      }
    }, [selectedPlanId, examsList, precos]);

    const handleBulkPriceChange = (examId: string, value: string) => {
      setBulkPrices(prev => ({ ...prev, [examId]: value }));
      setHasChanges(true);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentExamId: string) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Find next exam in the list
        const currentIndex = examsList.findIndex(ex => ex.id === currentExamId);
        if (currentIndex >= 0 && currentIndex < examsList.length - 1) {
          const nextExamId = examsList[currentIndex + 1].id;
          priceInputRefs.current[nextExamId]?.focus();
          priceInputRefs.current[nextExamId]?.select();
        }
      }
    };

    const handleSaveBulk = async () => {
      const updates = Object.entries(bulkPrices)
        .filter(([_, price]) => price.trim() !== "")
        .map(([exameId, price]) => ({
          exameId,
          price: parseFloat(price.replace(',', '.'))
        }))
        .filter(u => !isNaN(u.price));

      if (updates.length > 0) {
        const res = await savePrecosBatch(selectedPlanId, updates);
        if (res.success) {
          toast({ title: "Sucesso!", description: `${res.successCount} preço(s) atualizado(s).` });
          setHasChanges(false);
        }
      } else {
        toast({ title: "Aviso", description: "Nenhum preço válido para salvar.", variant: "destructive" });
      }
    };

    // CSV Price Import Handler
    const handleImportPriceCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setIsImportingPrices(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          setIsImportingPrices(false);
          return;
        }

        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) {
          toast({ title: "Erro", description: "Arquivo CSV vazio ou sem dados.", variant: "destructive" });
          setIsImportingPrices(false);
          return;
        }

        const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
        const headerCols = lines[0].split(/[;,\t]/).map(h => normalize(h));

        const findCol = (...aliases: string[]) => {
          for (const alias of aliases) {
            const idx = headerCols.findIndex(h => h.includes(normalize(alias)));
            if (idx !== -1) return idx;
          }
          return -1;
        };

        const colEmpresa = findCol('id_empresa', 'idempresa', 'empresa');
        const colPlano = findCol('id_plano', 'idplano', 'plano');
        const colExame = findCol('id_exame', 'idexame', 'exame');
        const colPreco = findCol('preco_atual', 'precoatual', 'preco', 'valor');

        if (colPlano === -1 || colExame === -1 || colPreco === -1) {
          toast({
            title: "Erro no CSV de Preços",
            description: "Cabeçalho obrigatório não encontrado. Colunas necessárias: Id_Plano, ID_Exame, Preço Atual.",
            variant: "destructive"
          });
          setIsImportingPrices(false);
          if (csvPriceInputRef.current) csvPriceInputRef.current.value = "";
          return;
        }

        let successCount = 0;
        let failCount = 0;
        let skippedCount = 0;

        // Group updates by plano
        const updatesByPlano: Record<string, { exameId: string; price: number }[]> = {};

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const cols = line.split(/[;,\t]/);
          const planoIdCsv = colPlano !== -1 ? cols[colPlano]?.trim() : '';
          const exameIdCsv = colExame !== -1 ? cols[colExame]?.trim() : '';
          const precoStr = colPreco !== -1 ? cols[colPreco]?.trim().replace(',', '.') : '';

          if (!planoIdCsv || !exameIdCsv || !precoStr) {
            skippedCount++;
            continue;
          }

          const precoVal = parseFloat(precoStr);
          if (isNaN(precoVal)) {
            skippedCount++;
            continue;
          }

          // Resolve plano: try UUID first, then by codPlano/idPlano/nome
          let resolvedPlanoId = plansList.find(p => p.id === planoIdCsv)?.id;
          if (!resolvedPlanoId) {
            resolvedPlanoId = plansList.find(p =>
              p.codPlano === planoIdCsv || p.idPlano === planoIdCsv || p.nome.toLowerCase() === planoIdCsv.toLowerCase()
            )?.id;
          }

          // Resolve exame: try UUID first, then by idExame/examCode/name
          let resolvedExameId = examsList.find(ex => ex.id === exameIdCsv)?.id;
          if (!resolvedExameId) {
            resolvedExameId = examsList.find(ex =>
              ex.idExame === exameIdCsv || ex.examCode === exameIdCsv || ex.name.toLowerCase() === exameIdCsv.toLowerCase()
            )?.id;
          }

          if (!resolvedPlanoId || !resolvedExameId) {
            failCount++;
            continue;
          }

          if (!updatesByPlano[resolvedPlanoId]) {
            updatesByPlano[resolvedPlanoId] = [];
          }
          updatesByPlano[resolvedPlanoId].push({ exameId: resolvedExameId, price: precoVal });
        }

        // Process all updates
        for (const [planoId, updates] of Object.entries(updatesByPlano)) {
          const res = await savePrecosBatch(planoId, updates);
          if (res.success) {
            successCount += res.successCount || 0;
            failCount += res.failCount || 0;
          } else {
            failCount += updates.length;
          }
        }

        // Refresh current plan if it was affected
        if (selectedPlanId !== "sem_plano") {
          await fetchPrecos(selectedPlanId);
        }

        toast({
          title: "Importação de Preços Concluída",
          description: `${successCount} preço(s) atualizado(s).${failCount > 0 ? ` ${failCount} falha(s).` : ''}${skippedCount > 0 ? ` ${skippedCount} linha(s) ignorada(s).` : ''}`,
          variant: failCount > 0 ? "destructive" : "default"
        });

        setIsImportingPrices(false);
        if (csvPriceInputRef.current) csvPriceInputRef.current.value = "";
      };
      reader.onerror = () => setIsImportingPrices(false);
      reader.readAsText(file, "UTF-8");
    };

    const formatCurrency = (val: number | null | undefined) => {
      if (val === null || val === undefined) return "-";
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };
    const formatDate = (dateStr: string | null | undefined) => {
      if (!dateStr) return "-";
      return format(new Date(dateStr), 'dd/MM/yyyy HH:mm');
    };

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
          <div>
            <CardTitle>Tabela de Preços por Plano</CardTitle>
            <CardDescription>Selecione um plano para editar os preços. Navegue com Enter ou Tab entre os campos.</CardDescription>
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              accept=".csv, .txt"
              ref={csvPriceInputRef}
              onChange={handleImportPriceCSV}
              className="hidden"
            />
            <Button onClick={() => csvPriceInputRef.current?.click()} variant="outline" size="sm" disabled={isImportingPrices}>
              <Upload className="mr-2 h-4 w-4" />
              {isImportingPrices ? 'Importando...' : 'Importar Preços (CSV)'}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                const currentEmpresa = examsList[0]?.id_empresa || '001';
                
                let exportData = [];
                
                if (selectedPlanId !== "sem_plano") {
                  // If a plan is selected, export current prices for that plan
                  exportData = examsList.map(exam => {
                    const price = bulkPrices[exam.id] || '';
                    return {
                      'ID_Empresa': currentEmpresa,
                      'Id_Plano': selectedPlanId,
                      'ID_Exame': exam.idExame || exam.examCode,
                      'Preco_Atual': price
                    };
                  });
                } else {
                  // Template with some examples if no plan selected
                  exportData = examsList.slice(0, 5).map(exam => ({
                    'ID_Empresa': currentEmpresa,
                    'Id_Plano': plansList[0]?.id || 'PLANO_EXEMPLO',
                    'ID_Exame': exam.idExame || exam.examCode,
                    'Preco_Atual': '0.00'
                  }));
                }
                
                if (exportData.length === 0) {
                  exportData = [{
                    'ID_Empresa': '001',
                    'Id_Plano': 'PLANO_ABC',
                    'ID_Exame': 'EX001',
                    'Preco_Atual': '125.50'
                  }];
                }
                
                exportToCSV('modelo_importacao_precos', exportData);
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV (Modelo)
            </Button>
            {hasChanges && selectedPlanId !== "sem_plano" && (
              <Button onClick={handleSaveBulk} size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={isLoading}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> {isLoading ? 'Salvando...' : 'Confirmar Preços'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="max-w-sm">
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger><SelectValue placeholder="Selecione o Plano" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sem_plano">Selecione um Plano...</SelectItem>
                {plansList.map(hp => <SelectItem key={hp.id} value={hp.id}>{hp.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {selectedPlanId !== "sem_plano" ? (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 flex items-center gap-2">
                <Info className="h-4 w-4 flex-shrink-0" />
                <span>Edite os preços diretamente nos campos abaixo. Use <kbd className="px-1 py-0.5 bg-white rounded border text-xs font-mono">Enter</kbd> para avançar ao próximo exame. Ao finalizar, clique em <strong>Confirmar Preços</strong>.</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Exame</TableHead>
                    <TableHead className="w-[140px]">Preço (R$)</TableHead>
                    <TableHead>Preço Anterior</TableHead>
                    <TableHead>Data Anterior</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {examsList.map((exam, idx) => {
                    const precoInfo = precos.find(p => p.exame_id === exam.id);
                    return (
                      <TableRow key={exam.id} className="hover:bg-blue-50/30 transition-colors">
                        <TableCell className="text-xs text-muted-foreground font-mono">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="font-bold text-sm">{exam.name}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[250px]">{exam.idExame || exam.examCode} — {exam.description}</div>
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0,00"
                            value={bulkPrices[exam.id] || ""}
                            onChange={e => handleBulkPriceChange(exam.id, e.target.value)}
                            onKeyDown={e => handleKeyDown(e, exam.id)}
                            onFocus={e => e.target.select()}
                            ref={el => { priceInputRefs.current[exam.id] = el; }}
                            className="w-[120px] h-9 text-right font-mono font-semibold"
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatCurrency(precoInfo?.preco_anterior)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(precoInfo?.data_preco_anterior)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </>
          ) : (
             <div className="py-10 text-center text-muted-foreground">Por favor, selecione um plano acima para listar e editar os valores.</div>
          )}

          {/* CSV Template Info */}
          <div className="bg-slate-50 border rounded-lg p-4 text-sm space-y-2">
            <p className="font-bold text-slate-700 flex items-center gap-2"><Upload className="h-4 w-4" /> Modelo CSV para Importação de Preços:</p>
            <code className="block bg-white p-2 rounded border text-xs font-mono text-slate-600 whitespace-pre">ID_Empresa;Id_Plano;ID_Exame;Preco_Atual{'\n'}001;PLANO_ABC;EX001;125.50{'\n'}001;PLANO_ABC;EX002;89.00</code>
            <p className="text-xs text-muted-foreground italic">Os campos Id_Plano e ID_Exame aceitam UUID, código ou nome. O sistema moverá o preço existente para &quot;Preço Anterior&quot; automaticamente.</p>
          </div>
        </CardContent>
      </Card>
    );
  }, []);

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result;
      if (typeof text !== 'string') {
        setIsImporting(false);
        return;
      }

      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        toast({ title: "Erro", description: "Arquivo CSV vazio ou sem dados.", variant: "destructive" });
        setIsImporting(false);
        return;
      }

      // --- Parse header to detect column positions dynamically ---
      const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
      const headerCols = lines[0].split(/[;,\t]/).map(h => normalize(h));

      // Map known column names to indices — supports multiple aliases
      const findCol = (...aliases: string[]) => {
        for (const alias of aliases) {
          const idx = headerCols.findIndex(h => h.includes(normalize(alias)));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const colTipo = findCol('tipo');
      const colIdExame = findCol('id-exame', 'idexame', 'id_exame', 'id exame');
      const colNome = findCol('nome do exame', 'nome_exame', 'nomeexame', 'nome');
      const colDescricao = findCol('descricao', 'descrição');
      const colPlano = findCol('plano de saude', 'plano_saude', 'planosaud', 'plano');

      if (colNome === -1) {
        toast({ title: "Erro no CSV", description: "Cabeçalho não encontrado: 'Nome do Exame' ou 'Nome'. Verifique o arquivo.", variant: "destructive" });
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(/[;,\t]/);
        const nome = colNome !== -1 ? cols[colNome]?.trim() : '';
        const tipoRaw = colTipo !== -1 ? cols[colTipo]?.trim() : '';
        const idExame = colIdExame !== -1 ? cols[colIdExame]?.trim() : '';
        const descricao = colDescricao !== -1 ? cols[colDescricao]?.trim() : nome;
        const planoSaudeNome = colPlano !== -1 ? cols[colPlano]?.trim() : '';

        if (!nome) continue; // Skip empty rows

        // Try to find health plan ID
        let healthPlanId: string | null = null;
        let healthPlanName: string | null = null;
        if (planoSaudeNome) {
          const hp = healthPlans.find(p => p.nome.toLowerCase() === planoSaudeNome.toLowerCase());
          if (hp) {
            healthPlanId = hp.id;
            healthPlanName = hp.nome;
          }
        }

        // Map tipo: default to Laboratório if not recognized
        const tipo = (normalize(tipoRaw) === 'imagem') ? 'Imagem' as const : 'Laboratório' as const;

        try {
          await addExam({
            name: nome,
            type: tipo,
            idExame: idExame,
            description: descricao || nome,
            healthPlanId: healthPlanId,
            healthPlanName: healthPlanName,
            isUrgency: false
          });
          successCount++;
        } catch (err) {
          failCount++;
        }
      }

      toast({
        title: "Importação Concluída",
        description: `${successCount} exames importados com sucesso.${failCount > 0 ? ` ${failCount} falhas.` : ''}`,
        variant: failCount > 0 ? "destructive" : "default"
      });

      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.onerror = () => setIsImporting(false);
    reader.readAsText(file, "UTF-8");
  };

  const handleExamAdded = () => {
    // Keep user on the "register" tab to allow continuous registration
    // setActiveTab("list");
  }

  const handleDeleteExam = async (id: string) => {
    await deleteExam(id);
    toast({
      title: "Exame Excluído",
      description: "O registro do exame foi removido.",
    });
  }

  const handleDeleteAllExams = async () => {
    const result = await deleteAllExams();
    if (result.success) {
      toast({
        title: "Sucesso!",
        description: "Todos os exames foram excluídos."
      });
    } else {
      toast({
        title: "Erro",
        description: result.message,
        variant: "destructive",
      });
    }
  }

  const handleOpenEditDialog = (exam: Exam) => {
    setSelectedExam(exam);
    setIsEditDialogOpen(true);
  }

  const handleAddExam = async (values: ExamFormValues) => {
    const result = await addExam(values);
    if (result.success) {
      toast({
        title: "Sucesso!",
        description: "Exame cadastrado com sucesso.",
      });
      handleExamAdded();
    } else {
      toast({
        title: "Erro",
        description: result.message,
        variant: "destructive",
      });
    }
  }

  const handleUpdateExam = async (values: ExamFormValues) => {
    if (!selectedExam) return;
    const result = await updateExam(selectedExam.id, values);
    if (result.success) {
      toast({
        title: "Sucesso!",
        description: "Exame atualizado com sucesso.",
      });
      setIsEditDialogOpen(false);
      setSelectedExam(null);
    } else {
      toast({
        title: "Erro",
        description: result.message,
        variant: "destructive",
      });
    }
  };

  if (error) {
    return <div className="text-red-500">Erro ao carregar exames: {error.message}</div>
  }

  return (
    <>
      <PageTitle title="Gerenciamento de Exames" description="Adicione, visualize e gerencie os tipos de exames.">
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".csv, .txt"
            ref={fileInputRef}
            onChange={handleImportCSV}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            <Upload className="mr-2 h-4 w-4" />
            {isImporting ? 'Importando...' : 'Importar Dados'}
          </Button>
          <Link href="/" passHref>
            <Button variant="outline">
              <Undo2 className="mr-2 h-4 w-4" />
              Voltar ao Menu
            </Button>
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Zerar Cadastros
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                  <div className="flex items-center gap-4 bg-destructive/10 p-4 rounded-lg">
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                    <span>
                      Esta ação é irreversível e irá <strong>excluir permanentemente todos os exames</strong> cadastrados.
                      Continue apenas se você tem certeza do que está fazendo.
                    </span>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAllExams} className="bg-destructive hover:bg-destructive/90">
                  Sim, excluir tudo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </PageTitle>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList ref={tabsListRef} className="grid w-full grid-cols-3 md:w-[600px]">
          <TabsTrigger value="list"><FileText className="mr-2 h-4 w-4" />Listar Exames</TabsTrigger>
          <TabsTrigger value="register"><PlusCircle className="mr-2 h-4 w-4" />Cadastrar</TabsTrigger>
          <TabsTrigger value="prices"><DollarSign className="mr-2 h-4 w-4" />Tabela de Preços</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-6">
          <ExamList exams={exams} isLoaded={isLoaded} onEdit={handleOpenEditDialog} onDelete={handleDeleteExam} />
        </TabsContent>
        <TabsContent value="prices" className="mt-6">
          <ExamPrices examsList={exams} plansList={healthPlans} />
        </TabsContent>
        <TabsContent value="register" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Novo Exame</CardTitle>
              <CardDescription>Preencha os campos abaixo para registrar um novo tipo de exame.</CardDescription>
            </CardHeader>
            <CardContent>
              <ExamForm onFormSubmit={handleAddExam} getNextExamCode={getNextExamCode} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => {
        setIsEditDialogOpen(isOpen);
        if (!isOpen) {
          setSelectedExam(null);
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Exame</DialogTitle>
            <DialogDescription>
              Modifique os dados do exame abaixo. O código e o tipo não podem ser alterados.
            </DialogDescription>
          </DialogHeader>
          <ExamForm onFormSubmit={handleUpdateExam} initialData={selectedExam ?? undefined} getNextExamCode={getNextExamCode} onCancel={() => setIsEditDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
