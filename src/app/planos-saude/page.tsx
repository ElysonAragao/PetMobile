
"use client";

import * as React from 'react';
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HeartPulse, PlusCircle, Trash2, Edit, ArrowUpDown, FileX, Undo2 } from 'lucide-react';
import Link from 'next/link';

import { HealthPlan } from '@/lib/types';
import { useHealthPlans, HealthPlanFormValues } from '@/hooks/use-health-plans';
import { PageTitle } from '@/components/layout/page-title';
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
import { useToast } from "@/hooks/use-toast";

const healthPlanSchema = z.object({
  codPlano: z.string().optional(),
  idPlano: z.string().optional().default(''),
  nome: z.string().min(1, "Nome é obrigatório"),
});

type SortConfig = {
  key: keyof HealthPlan;
  direction: 'ascending' | 'descending';
};

function HealthPlanList({ plans, isLoaded, onEdit, onDelete }: { plans: HealthPlan[], isLoaded: boolean, onEdit: (plan: HealthPlan) => void, onDelete: (id: string) => void }) {
  const [sortConfig, setSortConfig] = React.useState<SortConfig | null>(null);

  const sortedPlans = React.useMemo(() => {
    let sortableItems = [...plans];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [plans, sortConfig]);

  const requestSort = (key: keyof HealthPlan) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: keyof HealthPlan) => {
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
      <CardHeader>
        <CardTitle>Planos Cadastrados</CardTitle>
        <CardDescription>Visualize e gerencie todos os planos de saúde e convênios.</CardDescription>
      </CardHeader>
      <CardContent>
        {sortedPlans.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button variant="ghost" onClick={() => requestSort('codPlano')}>
                    Código
                    {getSortIndicator('codPlano')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => requestSort('nome')}>
                    Nome
                    {getSortIndicator('nome')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => requestSort('idPlano')}>
                    ID-Plano
                    {getSortIndicator('idPlano')}
                  </Button>
                </TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPlans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>{plan.codPlano}</TableCell>
                  <TableCell className="font-medium">{plan.nome}</TableCell>
                  <TableCell className="font-mono text-sm">{plan.idPlano || plan.codPlano}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(plan)}>
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
                            Esta ação não pode ser desfeita. Isso irá excluir permanentemente o plano "{plan.nome}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(plan.id)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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
            <h3 className="mt-4 text-lg font-semibold">Nenhum plano encontrado</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Comece cadastrando um novo plano de saúde na aba "Cadastrar".
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HealthPlanForm({ onFormSubmit, initialData, getNextHealthPlanCode }: { onFormSubmit: (values: HealthPlanFormValues) => Promise<any>, initialData?: Partial<HealthPlanFormValues>, getNextHealthPlanCode: () => Promise<string> }) {
  const form = useForm<HealthPlanFormValues>({
    resolver: zodResolver(healthPlanSchema),
    defaultValues: initialData || { codPlano: "", idPlano: "", nome: "" },
  });

  const isEditMode = !!initialData?.nome;

  React.useEffect(() => {
    async function setupForm() {
      if (isEditMode) {
        form.reset(initialData);
      } else {
        const code = await getNextHealthPlanCode();
        form.reset({ nome: "", codPlano: code, idPlano: "" });
      }
    }
    setupForm();
  }, [initialData, form, isEditMode, getNextHealthPlanCode]);

  async function onSubmit(values: HealthPlanFormValues) {
    await onFormSubmit(values);
    if (!isEditMode) {
      // Form will be reset by parent to get new code
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="codPlano"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Código do Plano</FormLabel>
              <FormControl>
                <Input placeholder="Gerando..." {...field} disabled />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Plano</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Unimed, SulAmérica, etc." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="idPlano"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ID-Plano (Empresa)</FormLabel>
              <FormControl>
                <Input placeholder="Deixe vazio para usar o código sequencial" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full md:w-auto" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Salvando...' : (
            <>
              <PlusCircle className="mr-2 h-4 w-4" />
              {initialData?.nome ? 'Salvar Alterações' : 'Cadastrar Plano'}
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

export default function HealthPlansPage() {
  const { healthPlans, addHealthPlan, updateHealthPlan, deleteHealthPlan, isLoaded, error, getNextHealthPlanCode } = useHealthPlans();
  const [activeTab, setActiveTab] = React.useState("list");
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [selectedPlan, setSelectedPlan] = React.useState<HealthPlan | null>(null);
  const { toast } = useToast();
  const tabsListRef = React.useRef<HTMLDivElement>(null);

  const handlePlanAdded = () => {
    // Keep user on the "register" tab to allow continuous registration
    // setActiveTab("list");
  }

  const handleDeletePlan = async (id: string) => {
    await deleteHealthPlan(id);
    toast({
      title: "Plano Excluído",
      description: "O registro do plano de saúde foi removido.",
    });
  }

  const handleOpenEditDialog = (plan: HealthPlan) => {
    setSelectedPlan(plan);
    setIsEditDialogOpen(true);
  }

  const handleAddPlan = async (values: HealthPlanFormValues) => {
    const result = await addHealthPlan(values);
    if (result.success) {
      toast({
        title: "Sucesso!",
        description: "Plano de saúde cadastrado com sucesso.",
      });
      handlePlanAdded();
    } else {
      toast({
        title: "Erro",
        description: result.message,
        variant: "destructive",
      });
    }
  }

  const handleUpdatePlan = async (values: HealthPlanFormValues) => {
    if (!selectedPlan) return;
    const result = await updateHealthPlan(selectedPlan.id, values);
    if (result.success) {
      toast({
        title: "Sucesso!",
        description: "Plano de saúde atualizado com sucesso.",
      });
      setIsEditDialogOpen(false);
      setSelectedPlan(null);
    } else {
      toast({
        title: "Erro",
        description: result.message,
        variant: "destructive",
      });
    }
  };

  if (error) {
    return <div className="text-red-500">Erro ao carregar planos de saúde: {error.message}</div>
  }

  return (
    <>
      <PageTitle title="Gerenciamento de Planos de Saúde" description="Adicione, visualize e gerencie os convênios disponíveis.">
        <Link href="/" passHref>
          <Button variant="outline">
            <Undo2 className="mr-2 h-4 w-4" />
            Voltar ao Menu
          </Button>
        </Link>
      </PageTitle>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList ref={tabsListRef} className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="list"><HeartPulse className="mr-2 h-4 w-4" />Listar Planos</TabsTrigger>
          <TabsTrigger value="register"><PlusCircle className="mr-2 h-4 w-4" />Cadastrar</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-6">
          <HealthPlanList plans={healthPlans} isLoaded={isLoaded} onEdit={handleOpenEditDialog} onDelete={handleDeletePlan} />
        </TabsContent>
        <TabsContent value="register" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Novo Plano de Saúde</CardTitle>
              <CardDescription>Preencha os campos abaixo para registrar um novo convênio.</CardDescription>
            </CardHeader>
            <CardContent>
              <HealthPlanForm onFormSubmit={handleAddPlan} getNextHealthPlanCode={getNextHealthPlanCode} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => {
        setIsEditDialogOpen(isOpen);
        if (!isOpen) {
          setSelectedPlan(null);
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Plano de Saúde</DialogTitle>
            <DialogDescription>
              Modifique os dados do plano abaixo. O código não pode ser alterado.
            </DialogDescription>
          </DialogHeader>
          <HealthPlanForm onFormSubmit={handleUpdatePlan} initialData={selectedPlan ?? undefined} getNextHealthPlanCode={getNextHealthPlanCode} />
        </DialogContent>
      </Dialog>
    </>
  );
}
