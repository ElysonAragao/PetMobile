
"use client";

import * as React from 'react';
import { z } from "zod";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusCircle, Trash2, User, UserX, Edit, ArrowUpDown, Loader2, HeartPulse, Undo2 } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';


import { Patient, HealthPlan } from '@/lib/types';
import { usePatients, PatientFormValues, calculateAge } from '@/hooks/use-patients';
import { useHealthPlans } from '@/hooks/use-health-plans';
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
  DialogTitle
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

import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const patientSchema = z.object({
  codPaciente: z.string().optional(),
  cpf: z.string().min(11, "CPF deve ter no mínimo 11 dígitos").max(14, "CPF inválido"), // Allow masks
  name: z.string().min(1, "Nome é obrigatório"), // Mantivemos o nome obrigatório na UI para listagem
  email: z.string().email("E-mail inválido").or(z.literal('')).optional().default(''),
  endereco: z.string().optional().or(z.literal('')),
  telefone: z.string().optional().or(z.literal('')),
  dataNascimento: z.string().optional().or(z.literal('')),
  idade: z.string().optional().or(z.literal('')),
  genero: z.string().optional().or(z.literal('')),
  matricula: z.string().optional().or(z.literal('')),
  healthPlanCode: z.string().min(1, "Plano de saúde é obrigatório"),
  healthPlanName: z.string().min(1, "Plano de saúde é obrigatório"),
});

function PatientForm({
  form,
  onFormSubmit,
  initialData,
  isEdit = false,
  onCpfBlur,
  onHealthPlanChange,
  healthPlans,
  cpfInputRef
}: {
  form: UseFormReturn<PatientFormValues>,
  onFormSubmit: (values: PatientFormValues, patientId?: string) => Promise<any>,
  initialData?: Partial<Patient> | null,
  isEdit?: boolean,
  onCpfBlur?: (e: React.FocusEvent<HTMLInputElement>) => void,
  onHealthPlanChange: (planId: string) => void,
  healthPlans: HealthPlan[],
  cpfInputRef?: React.RefObject<HTMLInputElement>
}) {
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <React.Suspense fallback={<div>Carregando...</div>}>
      <PatientFormContent
        form={form}
        onFormSubmit={onFormSubmit}
        initialData={initialData}
        isEdit={isEdit}
        onCpfBlur={onCpfBlur}
        onHealthPlanChange={onHealthPlanChange}
        healthPlans={healthPlans}
        cpfInputRef={cpfInputRef}
        nameInputRef={nameInputRef}
      />
    </React.Suspense>
  )
}

function PatientFormContent({
  form,
  onFormSubmit,
  initialData,
  isEdit = false,
  onCpfBlur,
  onHealthPlanChange,
  healthPlans,
  cpfInputRef,
  nameInputRef
}: {
  form: UseFormReturn<PatientFormValues>,
  onFormSubmit: (values: PatientFormValues, patientId?: string) => Promise<any>,
  initialData?: Partial<Patient> | null,
  isEdit?: boolean,
  onCpfBlur?: (e: React.FocusEvent<HTMLInputElement>) => void,
  onHealthPlanChange: (planId: string) => void,
  healthPlans: HealthPlan[],
  cpfInputRef?: React.RefObject<HTMLInputElement>,
  nameInputRef: React.RefObject<HTMLInputElement>
}) {
  const searchParams = useSearchParams();

  React.useEffect(() => {
    const nameFromQuery = searchParams.get('name');
    const defaultValues = initialData || {
      codPaciente: "",
      cpf: "",
      name: "",
      email: "",
      endereco: "",
      telefone: "",
      dataNascimento: "",
      idade: "",
      genero: "",
      healthPlanCode: "",
      healthPlanName: "",
      matricula: "",
    };

    if (nameFromQuery && !defaultValues.name) {
      defaultValues.name = nameFromQuery;
    }

    form.reset(defaultValues);

    if (initialData?.cpf && !initialData.name) {
      nameInputRef.current?.focus();
    }
  }, [initialData, form, searchParams]);

  const birthDate = form.watch('dataNascimento');
  React.useEffect(() => {
    if (birthDate) {
      const age = calculateAge(birthDate);
      form.setValue('idade', age, { shouldValidate: true });
    }
  }, [birthDate, form]);

  async function onSubmit(values: PatientFormValues) {
    const patientId = initialData && 'id' in initialData ? initialData.id : undefined;
    await onFormSubmit(values, patientId);
  }

  const selectedPlanId = healthPlans.find(p => p.codPlano === form.watch('healthPlanCode'))?.id;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="cpf"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CPF</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Digite o CPF para buscar ou cadastrar"
                    {...field}
                    disabled={isEdit}
                    onBlur={onCpfBlur}
                    ref={cpfInputRef}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {isEdit && (
            <FormField
              control={form.control}
              name="codPaciente"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código do Paciente</FormLabel>
                  <FormControl>
                    <Input {...field} disabled />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome Completo</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} ref={nameInputRef} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="dataNascimento"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de Nascimento</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input placeholder="paciente@email.com" type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="idade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Idade (Calculada automaticamente se Data Nasc. preenchida)</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: 25 anos ou 5 meses" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="genero"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gênero</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o gênero" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Feminino">Feminino</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                    <SelectItem value="Não informado">Não informado</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="telefone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone (Recomendado)</FormLabel>
                <FormControl>
                  <Input placeholder="(00) 00000-0000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endereco"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Endereço</FormLabel>
                <FormControl>
                  <Input placeholder="Rua, Número, Bairro, Cidade - Estado" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="border p-4 rounded-md space-y-4">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">Plano de Saúde</h3>
          </div>
          {healthPlans.length > 0 ? (
            <Select onValueChange={onHealthPlanChange} value={selectedPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um plano de saúde" />
              </SelectTrigger>
              <SelectContent>
                {healthPlans.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nome} ({p.codPlano})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum plano de saúde cadastrado.</p>
          )}
          <FormField
            control={form.control}
            name="matricula"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Matrícula do Plano</FormLabel>
                <FormControl>
                  <Input placeholder="Nº da matrícula no plano" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="healthPlanName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Plano</FormLabel>
                  <FormControl>
                    <Input disabled {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="healthPlanCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código do Plano</FormLabel>
                  <FormControl>
                    <Input disabled {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Button type="submit" className="w-full md:w-auto" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Salvando...' : (
            <>
              <PlusCircle className="mr-2 h-4 w-4" />
              {isEdit ? 'Salvar Alterações' : 'Cadastrar Paciente'}
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

type SortConfig = {
  key: keyof Patient;
  direction: 'ascending' | 'descending';
};

function PatientList({ patients, isLoaded, onEdit, onDelete }: { patients: Patient[], isLoaded: boolean, onEdit: (patient: Patient) => void, onDelete: (id: string) => void }) {
  const [sortConfig, setSortConfig] = React.useState<SortConfig | null>(null);

  const sortedPatients = React.useMemo(() => {
    let sortableItems = [...patients];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const valA = String(a[sortConfig.key] ?? '');
        const valB = String(b[sortConfig.key] ?? '');
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
  }, [patients, sortConfig]);

  const requestSort = (key: keyof Patient) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: keyof Patient) => {
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
        <CardTitle>Pacientes Cadastrados</CardTitle>
        <CardDescription>Visualize e gerencie todos os pacientes registrados no sistema.</CardDescription>
      </CardHeader>
      <CardContent>
        {sortedPatients.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button variant="ghost" onClick={() => requestSort('codPaciente')}>
                    Código
                    {getSortIndicator('codPaciente')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => requestSort('name')}>
                    Nome
                    {getSortIndicator('name')}
                  </Button>
                </TableHead>
                 <TableHead>
                  <Button variant="ghost" onClick={() => requestSort('cpf')}>
                    CPF
                    {getSortIndicator('cpf')}
                  </Button>
                </TableHead>
                <TableHead>Data de Nasc.</TableHead>
                <TableHead>Idade</TableHead>
                <TableHead>Gênero</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => requestSort('healthPlanName')}>
                    Plano de Saúde
                    {getSortIndicator('healthPlanName')}
                  </Button>
                </TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPatients.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell>{patient.codPaciente}</TableCell>
                  <TableCell className="font-medium">{patient.name}</TableCell>
                  <TableCell>{patient.cpf}</TableCell>
                   <TableCell>{patient.dataNascimento ? new Date(patient.dataNascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}</TableCell>
                  <TableCell>{patient.idade || '-'}</TableCell>
                  <TableCell>{patient.genero || '-'}</TableCell>
                  <TableCell>{patient.telefone}</TableCell>
                  <TableCell>{patient.email || '-'}</TableCell>
                  <TableCell className="text-xs">{patient.endereco}</TableCell>
                  <TableCell>{patient.healthPlanName}</TableCell>
                  <TableCell>{patient.matricula}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(patient)}>
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
                            Esta ação não pode ser desfeita. Isso irá excluir permanentemente o paciente "{patient.name}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(patient.id)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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
            <h3 className="mt-4 text-lg font-semibold">Nenhum paciente encontrado</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Vá para a aba "Cadastrar / Editar" para começar.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RegisterPatientTab() {
  const { addPatient, updatePatient, findPatientByCpf } = usePatients();
  const { healthPlans, isLoaded: healthPlansLoaded } = useHealthPlans();
  const { toast } = useToast();
  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: { codPaciente: '', cpf: '', name: '', email: '', endereco: '', telefone: '', dataNascimento: '', idade: '', genero: '', healthPlanCode: '', healthPlanName: '', matricula: '' },
    mode: 'onChange' // Validate on change to enable button
  });

  return (
    <React.Suspense fallback={<div className="flex justify-center p-12 text-muted-foreground">Carregando formulário...</div>}>
      <RegisterPatientContent
        addPatient={addPatient}
        updatePatient={updatePatient}
        findPatientByCpf={findPatientByCpf}
        healthPlans={healthPlans}
        healthPlansLoaded={healthPlansLoaded}
        toast={toast}
        form={form}
      />
    </React.Suspense>
  )
}

function RegisterPatientContent({
  addPatient,
  updatePatient,
  findPatientByCpf,
  healthPlans,
  healthPlansLoaded,
  toast,
  form
}: any) {
  const [foundPatient, setFoundPatient] = React.useState<Patient | null>(null);
  const [currentCpf, setCurrentCpf] = React.useState('');
  const [isSearching, setIsSearching] = React.useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const cpfInputRef = React.useRef<HTMLInputElement>(null);

  const handleCpfBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cpf = e.target.value.trim();
    if (cpf.length < 11 || cpf === currentCpf) return;

    setIsSearching(true);
    const patient = await findPatientByCpf(cpf);
    setIsSearching(false);

    if (patient) {
      setFoundPatient(patient);
      form.reset(patient); // Use reset to update all form values
      toast({ title: "Paciente Encontrado", description: "Os dados foram carregados para edição." });
    } else {
      setFoundPatient(null);
      // Keep the CPF, reset others
      const currentValues = form.getValues();
      form.reset({ ...currentValues, name: '', email: '', endereco: '', telefone: '', dataNascimento: '', idade: '', genero: '', healthPlanCode: '', healthPlanName: '', matricula: '' });
      toast({ title: "CPF não encontrado", description: "Prossiga com o cadastro de um novo paciente." });
    }
    setCurrentCpf(cpf);
  };

  const handleHealthPlanChange = (planId: string) => {
    const selectedPlan = healthPlans.find((p: any) => p.id === planId);
    if (selectedPlan) {
      form.setValue('healthPlanName', selectedPlan.nome, { shouldValidate: true });
      form.setValue('healthPlanCode', selectedPlan.codPlano, { shouldValidate: true });
    }
  };

  const handleFormSubmit = async (values: PatientFormValues) => {
    const redirectUrl = searchParams.get('redirect');
    let result;
    if (foundPatient) {
      result = await updatePatient(foundPatient.id, values);
      if (result.success) {
        toast({ title: "Sucesso!", description: "Paciente atualizado com sucesso." });
        if (redirectUrl) {
          router.push(`${redirectUrl}?newPatientId=${foundPatient.id}`);
          return;
        }
      }
    } else {
      result = await addPatient(values);
      if (result.success) {
        toast({ title: "Sucesso!", description: "Paciente cadastrado com sucesso.", duration: 2000 });
        if (redirectUrl && result.newPatientId) {
          router.push(`${redirectUrl}?newPatientId=${result.newPatientId}`);
          return;
        }
      }
    }

    if (!result.success) {
      toast({ title: "Erro", description: result.message, variant: "destructive" });
    } else {
      setFoundPatient(null);
      setCurrentCpf('');
      form.reset({ codPaciente: '', cpf: '', name: '', email: '', endereco: '', telefone: '', dataNascimento: '', idade: '', genero: '', healthPlanCode: '', healthPlanName: '', matricula: '' });
      setTimeout(() => {
        cpfInputRef.current?.focus();
      }, 100);
    }
  };

  const initialData = React.useMemo(() => {
    return foundPatient ? { ...foundPatient } : { cpf: currentCpf };
  }, [foundPatient, currentCpf]);


  return (
    <Card>
      <CardHeader>
        <CardTitle>Cadastrar ou Editar Paciente</CardTitle>
        <CardDescription>Digite um CPF para buscar e editar, ou preencha os campos para criar um novo paciente.</CardDescription>
      </CardHeader>
      <CardContent>
        {(isSearching || !healthPlansLoaded) && (
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{isSearching ? 'Buscando CPF...' : 'Carregando planos...'}</span>
          </div>
        )}
        <PatientFormContent
          form={form}
          onFormSubmit={handleFormSubmit}
          initialData={initialData}
          isEdit={!!foundPatient}
          onCpfBlur={handleCpfBlur}
          onHealthPlanChange={handleHealthPlanChange}
          healthPlans={healthPlans}
          cpfInputRef={cpfInputRef}
          nameInputRef={React.useRef<HTMLInputElement>(null)}
        />
      </CardContent>
    </Card>
  )
}

export default function PatientsPage() {
  return (
    <React.Suspense fallback={<div className="flex justify-center p-12 text-muted-foreground">Carregando painel de pacientes...</div>}>
      <PatientsContent />
    </React.Suspense>
  )
}

function PatientsContent() {
  const { patients, updatePatient, deletePatient, isLoaded, error } = usePatients();
  const { healthPlans, isLoaded: healthPlansLoaded } = useHealthPlans();
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialTab = searchParams.get('tab') || "list";
  const [activeTab, setActiveTab] = React.useState(initialTab);

  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [selectedPatient, setSelectedPatient] = React.useState<Patient | null>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.push('/patients', { scroll: false });
  }

  const editForm = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    mode: 'onChange',
  });

  const handleDeletePatient = async (id: string) => {
    await deletePatient(id);
    toast({
      title: "Paciente Excluído",
      description: "O registro do paciente foi removido.",
    });
  }

  const handleOpenEditDialog = (patient: Patient) => {
    setSelectedPatient(patient);
    editForm.reset(patient);
    setIsEditDialogOpen(true);
  };

  const handleUpdatePatient = async (values: PatientFormValues) => {
    if (!selectedPatient?.id) return;
    const result = await updatePatient(selectedPatient.id, values);
    if (result.success) {
      toast({
        title: "Sucesso!",
        description: "Paciente atualizado com sucesso.",
      });
      setIsEditDialogOpen(false);
      setSelectedPatient(null);
    } else {
      toast({
        title: "Erro",
        description: result.message,
        variant: "destructive",
      });
    }
  };

  const handleHealthPlanChangeInDialog = (planId: string) => {
    const selectedPlan = healthPlans.find(p => p.id === planId);
    if (selectedPlan) {
      editForm.setValue('healthPlanName', selectedPlan.nome, { shouldValidate: true });
      editForm.setValue('healthPlanCode', selectedPlan.codPlano, { shouldValidate: true });
    }
  };


  if (error) {
    return <div className="text-red-500">Erro ao carregar pacientes: {error.message}</div>
  }

  return (
    <>
      <PageTitle title="Gerenciamento de Pacientes" description="Adicione, visualize e gerencie os pacientes do sistema.">
        <Link href="/" passHref>
          <Button variant="outline">
            <Undo2 className="mr-2 h-4 w-4" />
            Voltar ao Menu
          </Button>
        </Link>
      </PageTitle>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="list"><User className="mr-2 h-4 w-4" />Listar Pacientes</TabsTrigger>
          <TabsTrigger value="register"><PlusCircle className="mr-2 h-4 w-4" />Cadastrar / Editar</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-6">
          <PatientList patients={patients} isLoaded={isLoaded && healthPlansLoaded} onEdit={handleOpenEditDialog} onDelete={handleDeletePatient} />
        </TabsContent>
        <TabsContent value="register" className="mt-6">
          <RegisterPatientTab />
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => {
        setIsEditDialogOpen(isOpen);
        if (!isOpen) {
          setSelectedPatient(null);
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Paciente</DialogTitle>
            <DialogDescription>
              Modifique os dados do paciente abaixo. O CPF e o Código não podem ser alterados.
            </DialogDescription>
          </DialogHeader>
          <PatientForm
            form={editForm}
            onFormSubmit={(values) => handleUpdatePatient(values)}
            initialData={selectedPatient}
            isEdit={true}
            healthPlans={healthPlans}
            onHealthPlanChange={handleHealthPlanChangeInDialog}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

