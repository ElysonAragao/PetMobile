
"use client";

import * as React from 'react';
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusCircle, Trash2, Edit, ArrowUpDown, UserX, Stethoscope, Undo2, Upload } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';


import { Medico } from '@/lib/types';
import { useMedicos, MedicoFormValues } from '@/hooks/use-medicos';
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


const medicoSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  crm: z.string().min(1, "CRM é obrigatório"),
  email: z.string().email("E-mail inválido").or(z.literal('')).optional().default(''),
  telefone: z.string().optional().default(''),
  codMed: z.string().optional(),
});

type SortConfig = {
  key: keyof Medico;
  direction: 'ascending' | 'descending';
};

function MedicoList({ medicos, isLoaded, onEdit, onDelete }: { medicos: Medico[], isLoaded: boolean, onEdit: (medico: Medico) => void, onDelete: (id: string) => void }) {
  const [sortConfig, setSortConfig] = React.useState<SortConfig | null>(null);

  const sortedMedicos = React.useMemo(() => {
    let sortableItems = [...medicos];
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
  }, [medicos, sortConfig]);

  const requestSort = (key: keyof Medico) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: keyof Medico) => {
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
        <CardTitle>Médicos Cadastrados</CardTitle>
        <CardDescription>Visualize e gerencie todos os médicos disponíveis.</CardDescription>
      </CardHeader>
      <CardContent>
        {sortedMedicos.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button variant="ghost" onClick={() => requestSort('codMed')}>
                    Código
                    {getSortIndicator('codMed')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => requestSort('name')}>
                    Nome
                    {getSortIndicator('name')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => requestSort('crm')}>
                    CRM
                    {getSortIndicator('crm')}
                  </Button>
                </TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMedicos.map((medico) => (
                <TableRow key={medico.id}>
                  <TableCell>{medico.codMed}</TableCell>
                  <TableCell className="font-medium">{medico.name}</TableCell>
                  <TableCell>{medico.crm}</TableCell>
                  <TableCell>{medico.email || '-'}</TableCell>
                  <TableCell>{medico.telefone || '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(medico)}>
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
                            Esta ação não pode ser desfeita. Isso irá excluir permanentemente o médico "{medico.name}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(medico.id)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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
            <UserX className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum médico encontrado</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Comece cadastrando um novo médico na aba "Cadastrar".
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MedicoForm({ onFormSubmit, initialData, getNextMedicoCode, resetKey }: { onFormSubmit: (values: MedicoFormValues) => Promise<any>, initialData?: Partial<MedicoFormValues>, getNextMedicoCode: () => Promise<string>, resetKey?: number }) {
  const form = useForm<MedicoFormValues>({
    resolver: zodResolver(medicoSchema),
    defaultValues: initialData || { codMed: "", name: "", crm: "", email: "", telefone: "" },
  });
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <React.Suspense fallback={<div>Carregando formulário...</div>}>
      <MedicoFormContent
        onFormSubmit={onFormSubmit}
        initialData={initialData}
        getNextMedicoCode={getNextMedicoCode}
        resetKey={resetKey}
        form={form}
        nameInputRef={nameInputRef}
      />
    </React.Suspense>
  )
}

function MedicoFormContent({ onFormSubmit, initialData, getNextMedicoCode, resetKey, form, nameInputRef }: any) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isEditMode = !!initialData?.name;

  React.useEffect(() => {
    async function setupForm() {
      if (isEditMode) {
        form.reset(initialData);
      } else {
        const code = await getNextMedicoCode();
        const nameFromQuery = searchParams.get('name');
        form.reset({ name: nameFromQuery || "", crm: "", codMed: code, email: "", telefone: "" });
        nameInputRef.current?.focus();
      }
    }
    setupForm();
  }, [initialData, form, isEditMode, getNextMedicoCode, searchParams, resetKey]);


  async function onSubmit(values: MedicoFormValues) {
    const result = await onFormSubmit(values);
    const redirectUrl = searchParams.get('redirect');

    if (!isEditMode && result && result.success && redirectUrl && result.newMedicoId) {
      router.push(`${redirectUrl}?newMedicoId=${result.newMedicoId}`);
      return;
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="codMed"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código do Médico</FormLabel>
                <FormControl>
                  <Input placeholder="Gerando..." {...field} disabled />
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
                <FormLabel>Nome do Médico</FormLabel>
                <FormControl>
                  <Input placeholder="Dr. John Smith" {...field} ref={nameInputRef} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="crm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>CRM</FormLabel>
              <FormControl>
                <Input placeholder="123456/SP" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input placeholder="medico@email.com" type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="telefone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl>
                  <Input placeholder="(00) 00000-0000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" className="w-full md:w-auto" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Salvando...' : (
            <>
              <PlusCircle className="mr-2 h-4 w-4" />
              {isEditMode ? 'Salvar Alterações' : 'Cadastrar Médico'}
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

export default function MedicosPage() {
  return (
    <React.Suspense fallback={<div className="flex justify-center p-12 text-muted-foreground">Carregando painel de médicos...</div>}>
      <MedicosContent />
    </React.Suspense>
  )
}

function MedicosContent() {
  const { medicos, addMedico, updateMedico, deleteMedico, isLoaded, error, getNextMedicoCode } = useMedicos();
  const [activeTab, setActiveTab] = React.useState("register");
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [selectedMedico, setSelectedMedico] = React.useState<Medico | null>(null);
  const [resetKey, setResetKey] = React.useState(0);
  const { toast } = useToast();
  const tabsListRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = React.useState(false);

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

      // Parse header dynamically
      const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
      const headerCols = lines[0].split(/[;,\t]/).map(h => normalize(h));

      const findCol = (...aliases: string[]) => {
        for (const alias of aliases) {
          const idx = headerCols.findIndex(h => h.includes(normalize(alias)));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const colNome = findCol('nome');
      const colCrm = findCol('crm', 'crm/uf', 'crmuf');
      const colEmail = findCol('email', 'e-mail');
      const colTelefone = findCol('telefone', 'fone', 'tel');

      if (colNome === -1 || colCrm === -1) {
        toast({ title: "Erro no CSV", description: "Cabeçalho obrigatório não encontrado: 'Nome' e 'CRM/UF'. Verifique o arquivo.", variant: "destructive" });
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(/[;,\t]/);
        const nome = cols[colNome]?.trim() || '';
        const crm = colCrm !== -1 ? cols[colCrm]?.trim() || '' : '';
        const email = colEmail !== -1 ? cols[colEmail]?.trim() || '' : '';
        const telefone = colTelefone !== -1 ? cols[colTelefone]?.trim() || '' : '';

        if (!nome || !crm) continue;

        try {
          const result = await addMedico({
            name: nome,
            crm: crm,
            email: email,
            telefone: telefone,
          });
          if (result.success) {
            successCount++;
          } else {
            failCount++;
            if (result.message) errors.push(`${nome}: ${result.message}`);
          }
        } catch (err) {
          failCount++;
        }
      }

      toast({
        title: "Importação Concluída",
        description: `${successCount} médicos importados com sucesso.${failCount > 0 ? ` ${failCount} falhas.` : ''}${errors.length > 0 ? ' ' + errors.slice(0, 3).join('; ') : ''}`,
        variant: failCount > 0 ? "destructive" : "default",
        duration: 8000,
      });

      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setResetKey(prev => prev + 1);
    };
    reader.onerror = () => setIsImporting(false);
    reader.readAsText(file, "UTF-8");
  };

  const handleDeleteMedico = async (id: string) => {
    await deleteMedico(id);
    toast({
      title: "Médico Excluído",
      description: "O registro do médico foi removido.",
    });
  }

  const handleOpenEditDialog = (medico: Medico) => {
    setSelectedMedico(medico);
    setIsEditDialogOpen(true);
  }

  const handleAddMedico = async (values: MedicoFormValues) => {
    const result = await addMedico(values);
    if (result.success) {
      toast({
        title: "Sucesso!",
        description: "Médico cadastrado com sucesso.",
      });
      setResetKey(prev => prev + 1);
    } else {
      toast({
        title: "Erro",
        description: result.message,
        variant: "destructive",
      });
    }
    return result;
  }

  const handleUpdateMedico = async (values: MedicoFormValues) => {
    if (!selectedMedico) return;
    const result = await updateMedico(selectedMedico.id, values);
    if (result.success) {
      toast({
        title: "Sucesso!",
        description: "Médico atualizado com sucesso.",
      });
      setIsEditDialogOpen(false);
      setSelectedMedico(null);
    } else {
      toast({
        title: "Erro",
        description: result.message,
        variant: "destructive",
      });
    }
  };

  if (error) {
    return <div className="text-red-500">Erro ao carregar médicos: {error.message}</div>
  }

  return (
    <>
      <PageTitle title="Gerenciamento de Médicos" description="Adicione, visualize e gerencie os médicos.">
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
            {isImporting ? 'Importando...' : 'Importar Médicos'}
          </Button>
          <Link href="/" passHref>
            <Button variant="outline">
              <Undo2 className="mr-2 h-4 w-4" />
              Voltar ao Menu
            </Button>
          </Link>
        </div>
      </PageTitle>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList ref={tabsListRef} className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="list"><Stethoscope className="mr-2 h-4 w-4" />Listar Médicos</TabsTrigger>
          <TabsTrigger value="register"><PlusCircle className="mr-2 h-4 w-4" />Cadastrar</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-6">
          <MedicoList medicos={medicos} isLoaded={isLoaded} onEdit={handleOpenEditDialog} onDelete={handleDeleteMedico} />
        </TabsContent>
        <TabsContent value="register" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Novo Médico</CardTitle>
              <CardDescription>Preencha os campos abaixo para registrar um novo médico.</CardDescription>
            </CardHeader>
            <CardContent>
              <MedicoForm onFormSubmit={handleAddMedico} getNextMedicoCode={getNextMedicoCode} resetKey={resetKey} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => {
        setIsEditDialogOpen(isOpen);
        if (!isOpen) {
          setSelectedMedico(null);
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Médico</DialogTitle>
            <DialogDescription>
              Modifique os dados do médico abaixo. O código não pode ser alterado.
            </DialogDescription>
          </DialogHeader>
          <MedicoForm onFormSubmit={handleUpdateMedico} initialData={selectedMedico ?? undefined} getNextMedicoCode={getNextMedicoCode} />
        </DialogContent>
      </Dialog>
    </>
  );
}
