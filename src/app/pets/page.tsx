"use client";

import * as React from 'react';
import { z } from "zod";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusCircle, Plus, Trash2, PawPrint, Edit, ArrowUpDown, Loader2, HeartPulse, Undo2, Download } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

import { Pet, HealthPlan } from '@/lib/types';
import { usePets, PetFormValues, calculateAge } from '@/hooks/use-pets';
import { useHealthPlans } from '@/hooks/use-health-plans';
import { useEspecies, Especie } from '@/hooks/use-especies';
import { exportToCSV } from '@/lib/export-utils';
import { PageTitle } from '@/components/layout/page-title';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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

const petSchema = z.object({
  codPet: z.string().optional(),
  nome: z.string().min(1, "Nome do pet é obrigatório"),
  especie: z.string().min(1, "Espécie é obrigatória"),
  raca: z.string().optional().or(z.literal('')),
  sexo: z.enum(['M', 'F'], { required_error: "Sexo é obrigatório" }),
  idade: z.string().optional().or(z.literal('')),
  dataNascimento: z.string().optional().or(z.literal('')).nullable(),
  tutorNome: z.string().min(1, "Nome do tutor é obrigatório"),
  tutorCpf: z.string().min(11, "CPF deve ter no mínimo 11 dígitos"),
  tutorEmail: z.string().email("E-mail inválido").or(z.literal('')).optional().default(''),
  tutorTelefone: z.string().min(1, "Telefone é obrigatório"), // Mantemos obrigatório para novos e correções
  tutorEndereco: z.string().optional().or(z.literal('')),
  tutorCep: z.string().optional().or(z.literal('')),
  tutorBairro: z.string().optional().or(z.literal('')),
  tutorCidade: z.string().optional().or(z.literal('')),
  tutorUf: z.string().optional().or(z.literal('')),
  matricula: z.string().optional().or(z.literal('')),
  healthPlanCode: z.string().optional().or(z.literal('')),
  healthPlanName: z.string().optional().or(z.literal('')),
});

function PetForm({
  form,
  onFormSubmit,
  initialData,
  isEdit = false,
  onTutorCpfBlur,
  onHealthPlanChange,
  healthPlans,
  especies = [],
  tutorCpfInputRef,
  isCpfLocked = false,
  onClearLookup,
  onCancel
}: {
  form: UseFormReturn<PetFormValues>,
  onFormSubmit: (values: PetFormValues, petId?: string) => Promise<any>,
  initialData?: Partial<Pet> | null,
  isEdit?: boolean,
  onTutorCpfBlur?: (e: React.FocusEvent<HTMLInputElement>) => void,
  onHealthPlanChange: (planId: string) => void,
  healthPlans: HealthPlan[],
  especies: Especie[],
  tutorCpfInputRef?: React.RefObject<HTMLInputElement>,
  isCpfLocked?: boolean,
  onClearLookup?: () => void,
  onCancel?: () => void
}) {
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (initialData && especies.length > 0) {
      // Normalização inteligente de Espécie baseada na tabela de banco
      const rawEspecie = String(initialData.especie || '').trim().toLowerCase();
      
      // Tentar encontrar o match exato ou aproximado no banco
      let matchedEspecie = especies.find(e => e.nome.toLowerCase() === rawEspecie)?.nome;
      
      if (!matchedEspecie) {
        if (['canino', 'cachorro', 'cão', 'cao', 'dog', 'câo'].some(v => rawEspecie.includes(v))) {
          matchedEspecie = especies.find(e => e.nome === 'Cão')?.nome;
        } else if (['felino', 'gato', 'gata', 'cat', 'fel'].some(v => rawEspecie.includes(v))) {
          matchedEspecie = especies.find(e => e.nome === 'Gato')?.nome;
        } else if (['pássaro', 'passaro', 'pave', 'ave'].some(v => rawEspecie.includes(v))) {
          // Busca ultra-flexível para Pássaro
          matchedEspecie = especies.find(e => e.nome.includes('ássaro') || e.nome.includes('assaro'))?.nome;
        }
      }
      
      const especieNorm = matchedEspecie || especies.find(e => e.nome === 'Outro')?.nome || especies[0]?.nome || 'Outro';

      // Normalização ultra-robusta de Sexo
      const rawSexo = String(initialData.sexo || '').trim().toLowerCase();
      let sexoNorm = 'M';
      if (['f', 'fêmea', 'femea', 'feminino', 'female'].includes(rawSexo)) sexoNorm = 'F';

      form.reset({
        nome: initialData.nome || '',
        especie: especieNorm,
        raca: initialData.raca || '',
        sexo: sexoNorm,
        idade: initialData.idade || '',
        dataNascimento: initialData.dataNascimento || '',
        tutorNome: initialData.tutorNome || '',
        tutorCpf: initialData.tutorCpf || '',
        tutorTelefone: initialData.tutorTelefone || '',
        tutorEmail: initialData.tutorEmail || '',
        tutorEndereco: initialData.tutorEndereco || '',
        tutorCep: initialData.tutorCep || '',
        tutorBairro: initialData.tutorBairro || '',
        tutorCidade: initialData.tutorCidade || '',
        tutorUf: initialData.tutorUf || '',
        healthPlanCode: initialData.healthPlanCode || '',
        healthPlanName: initialData.healthPlanName || '',
        matricula: initialData.matricula || '',
        codPet: initialData.codPet || '',
      } as any);

      // Sincronizar manualmente para garantir o visual imediato
      setTimeout(() => {
        form.setValue('especie', especieNorm);
        form.setValue('sexo', sexoNorm as 'M' | 'F');
      }, 0);
    }
  }, [initialData, form, especies]);

  const birthDate = form.watch('dataNascimento');
  React.useEffect(() => {
    if (birthDate) {
      const age = calculateAge(birthDate);
      form.setValue('idade', age, { shouldValidate: true });
    }
  }, [birthDate, form]);

  async function onSubmit(values: PetFormValues) {
    const petId = initialData && 'id' in initialData ? initialData.id : undefined;
    await onFormSubmit(values, petId);
  }

  const selectedPlanId = healthPlans.find(p => p.codPlano === form.watch('healthPlanCode'))?.id;

  return (
    <Form {...form}>
      <form 
        key={initialData && 'id' in initialData ? initialData.id : 'new-pet'}
        onSubmit={form.handleSubmit(onSubmit)} 
        className="space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="tutorCpf"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CPF do Tutor</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input
                      placeholder="000.000.000-00"
                      {...field}
                      disabled={isEdit || isCpfLocked}
                      onBlur={onTutorCpfBlur}
                      ref={tutorCpfInputRef}
                    />
                  </FormControl>
                  {isCpfLocked && (
                    <Button type="button" variant="ghost" size="sm" onClick={onClearLookup} className="h-10">Limpar</Button>
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tutorNome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do Tutor</FormLabel>
                <FormControl>
                  <Input placeholder="Nome do Responsável" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="tutorTelefone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone do Tutor (Obrigatório)</FormLabel>
                <FormControl>
                  <Input placeholder="(00) 00000-0000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tutorEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail do Tutor</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="email@exemplo.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="nome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do Pet</FormLabel>
                <FormControl>
                  <Input placeholder="Bidu, Pipoca..." {...field} ref={nameInputRef} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="codPet"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código do Pet (Automático)</FormLabel>
                <FormControl>
                  <Input placeholder="PET-XXXX" {...field} disabled />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="dataNascimento"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de Nascimento (Pet)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="idade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Idade</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: 3 anos" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="especie"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Espécie</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {especies.map(e => (
                      <SelectItem key={e.id} value={e.nome}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="raca"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Raça</FormLabel>
                <FormControl>
                  <Input placeholder="Vira-lata, Persa..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sexo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sexo</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Macho / Fêmea" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="M">Macho</SelectItem>
                    <SelectItem value="F">Fêmea</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 border-t pt-6">
          <FormField
            control={form.control}
            name="tutorCep"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CEP</FormLabel>
                <FormControl>
                  <Input placeholder="00000-000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tutorEndereco"
            render={({ field }) => (
              <FormItem className="md:col-span-3">
                <FormLabel>Endereço</FormLabel>
                <FormControl>
                  <Input placeholder="Rua, Número..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="tutorBairro"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bairro</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Centro" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tutorCidade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cidade</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: São Paulo" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tutorUf"
            render={({ field }) => (
              <FormItem>
                <FormLabel>UF</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: SP" maxLength={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="border p-4 rounded-md space-y-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">Convênio / Plano Pet</h3>
          </div>
          {healthPlans.length > 0 ? (
            <Select onValueChange={onHealthPlanChange} value={selectedPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um plano" />
              </SelectTrigger>
              <SelectContent>
                {healthPlans.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nome} ({p.codPlano})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum plano cadastrado.</p>
          )}
          <FormField
            control={form.control}
            name="matricula"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nº Matrícula (Opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Identificação no convênio" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <Button type="submit" className="w-full md:w-auto" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Salvando...' : (
              <>
                <PlusCircle className="mr-2 h-4 w-4" />
                {isEdit ? 'Salvar Alterações' : 'Cadastrar Pet'}
              </>
            )}
          </Button>
          
          {onCancel && (
            <Button 
              type="button" 
              variant="outline" 
              className="w-full md:w-auto"
              onClick={onCancel}
            >
              Voltar
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}

function PetList({ pets, isLoaded, onEdit, onDelete }: { pets: Pet[], isLoaded: boolean, onEdit: (pet: Pet) => void, onDelete: (id: string) => void }) {
  const [sortConfig, setSortConfig] = React.useState<{key: keyof Pet, direction: 'asc' | 'desc'} | null>(null);

  const sortedPets = React.useMemo(() => {
    let sortableItems = [...pets];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const valA = String(a[sortConfig.key] ?? '');
        const valB = String(b[sortConfig.key] ?? '');
        return sortConfig.direction === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      });
    }
    return sortableItems;
  }, [pets, sortConfig]);

  const requestSort = (key: keyof Pet) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: keyof Pet) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    }
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

  if (!isLoaded) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Pets Cadastrados</CardTitle>
          <CardDescription>Visualize e gerencie todos os animais registrados na clínica.</CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => {
            const exportData = pets.map(p => ({
              'Nome_Pet': p.nome,
              'Especie': p.especie,
              'Raca': p.raca || '',
              'Sexo_MF': p.sexo,
              'Data_Nascimento': p.dataNascimento || '',
              'Tutor_Nome': p.tutorNome,
              'Tutor_CPF': p.tutorCpf,
              'Tutor_Email': p.tutorEmail || '',
              'Tutor_Telefone': p.tutorTelefone || '',
              'CEP': p.tutorCep || '',
              'Endereco': p.tutorEndereco || '',
              'Bairro': p.tutorBairro || '',
              'Cidade': p.tutorCidade || '',
              'UF': p.tutorUf || '',
              'Codigo_Plano': p.healthPlanCode || '',
              'Matricula_Plano': p.matricula || '',
              'Codigo_Pet_Antigo': p.codPet || ''
            }));
            
            // If list is empty, export a header-only template
            const dataToExport = exportData.length > 0 ? exportData : [{
              'Nome_Pet': 'Ex: Bidu',
              'Especie': 'Cão',
              'Raca': 'Vira-lata',
              'Sexo_MF': 'M',
              'Data_Nascimento': '2020-01-01',
              'Tutor_Nome': 'João Silva',
              'Tutor_CPF': '000.000.000-00',
              'Tutor_Email': 'joao@email.com',
              'Tutor_Telefone': '(00) 00000-0000',
              'CEP': '00000-000',
              'Endereco': 'Rua Exemplo, 123',
              'Bairro': 'Centro',
              'Cidade': 'São Paulo',
              'UF': 'SP',
              'Codigo_Plano': '',
              'Matricula_Plano': '',
              'Codigo_Pet_Antigo': ''
            }];
            
            exportToCSV('modelo_importacao_pets', dataToExport);
          }}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV (Modelo)
        </Button>
      </CardHeader>
      <CardContent>
        {sortedPets.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button variant="ghost" onClick={() => requestSort('codPet')} className="hover:bg-transparent p-0 font-bold">
                    Código
                    {getSortIndicator('codPet')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => requestSort('nome')} className="hover:bg-transparent p-0 font-bold">
                    Nome
                    {getSortIndicator('nome')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => requestSort('especie')} className="hover:bg-transparent p-0 font-bold">
                    Espécie/Raça
                    {getSortIndicator('especie')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => requestSort('tutorNome')} className="hover:bg-transparent p-0 font-bold">
                    Tutor
                    {getSortIndicator('tutorNome')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => requestSort('tutorCpf')} className="hover:bg-transparent p-0 font-bold">
                    CPF Tutor
                    {getSortIndicator('tutorCpf')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => requestSort('healthPlanName')} className="hover:bg-transparent p-0 font-bold">
                    Plano
                    {getSortIndicator('healthPlanName')}
                  </Button>
                </TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPets.map((pet) => (
                <TableRow key={pet.id}>
                  <TableCell>{pet.codPet}</TableCell>
                  <TableCell className="font-medium">{pet.nome}</TableCell>
                  <TableCell>{pet.especie}{pet.raca ? ` / ${pet.raca}` : ''}</TableCell>
                  <TableCell>{pet.tutorNome}</TableCell>
                  <TableCell>{pet.tutorCpf}</TableCell>
                  <TableCell>{pet.healthPlanName}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(pet)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(pet.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12">
            <PawPrint className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum pet encontrado</h3>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PetsPage() {
  const { pets, addPet, updatePet, deletePet, findPetByTutorCpf, isLoaded } = usePets();
  const { healthPlans, isLoaded: healthPlansLoaded } = useHealthPlans();
  const { especies, isLoaded: especiesLoaded, addEspecie, updateEspecie, deleteEspecie, isLoading: especiesLoading } = useEspecies();
  const [newEspecieNome, setNewEspecieNome] = React.useState('');
  const [editingEspecieId, setEditingEspecieId] = React.useState<string | null>(null);
  const [editingEspecieNome, setEditingEspecieNome] = React.useState('');
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = React.useState(searchParams.get('tab') || "list");
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [selectedPet, setSelectedPet] = React.useState<Pet | null>(null);
  const [isCpfLocked, setIsCpfLocked] = React.useState(false);
  const tutorCpfInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<PetFormValues>({
    resolver: zodResolver(petSchema),
    defaultValues: { 
      nome: '', especie: '', raca: '', sexo: 'M', 
      tutorNome: '', tutorCpf: '', tutorEmail: '', tutorTelefone: '', 
      tutorEndereco: '', tutorCep: '', tutorBairro: '', tutorCidade: '', tutorUf: '',
      healthPlanCode: '', healthPlanName: '' 
    }
  });

  const handleTutorCpfBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cpf = e.target.value.trim();
    if (cpf.length < 11) return;
    const foundPets = await findPetByTutorCpf(cpf);
    if (foundPets.length > 0) {
      const p = foundPets[0];
      toast({ title: "Tutor encontrado", description: "Dados do tutor carregados. CPF bloqueado para edição." });
      setIsCpfLocked(true);
      form.setValue('tutorNome', p.tutorNome);
      form.setValue('tutorTelefone', p.tutorTelefone || '');
      form.setValue('tutorEmail', p.tutorEmail || '');
      form.setValue('tutorEndereco', p.tutorEndereco || '');
      form.setValue('tutorCep', p.tutorCep || '');
      form.setValue('tutorBairro', p.tutorBairro || '');
      form.setValue('tutorCidade', p.tutorCidade || '');
      form.setValue('tutorUf', p.tutorUf || '');
    }
  };

  const handleClearCpfLookup = () => {
    setIsCpfLocked(false);
    form.reset({ 
      nome: '', especie: '', raca: '', sexo: 'M', 
      tutorNome: '', tutorCpf: '', tutorEmail: '', tutorTelefone: '', 
      tutorEndereco: '', tutorCep: '', tutorBairro: '', tutorCidade: '', tutorUf: '',
      healthPlanCode: '', healthPlanName: '', matricula: ''
    });
    setTimeout(() => tutorCpfInputRef.current?.focus(), 100);
  };

  const handleFormSubmit = async (values: PetFormValues, petId?: string) => {
    let result;
    if (petId) {
      result = await updatePet(petId, values);
    } else {
      result = await addPet(values);
    }

    if (result.success) {
      toast({ title: "Sucesso!", description: petId ? "Pet atualizado." : "Pet cadastrado." });
      setIsCpfLocked(false);
      form.reset({ 
        nome: '', especie: '', raca: '', sexo: 'M', 
        tutorNome: '', tutorCpf: '', tutorEmail: '', tutorTelefone: '', 
        tutorEndereco: '', tutorCep: '', tutorBairro: '', tutorCidade: '', tutorUf: '',
        healthPlanCode: '', healthPlanName: '', matricula: ''
      });
      
      if (!petId) {
        setTimeout(() => tutorCpfInputRef.current?.focus(), 100);
      } else {
        setActiveTab("list");
        setIsEditDialogOpen(false);
      }
    } else {
      toast({ title: "Erro", description: result.message, variant: "destructive" });
    }
  };

  return (
    <>
      <PageTitle title="Gerenciamento de Pets" description="Controle de prontuários, tutores e planos veterinários.">
        <Link href="/" passHref><Button variant="outline"><Undo2 className="mr-2 h-4 w-4" />Voltar</Button></Link>
      </PageTitle>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:w-[600px]">
          <TabsTrigger value="list">Listar Pets</TabsTrigger>
          <TabsTrigger value="register">Novo Pet</TabsTrigger>
          <TabsTrigger value="especies">Gerenciar Espécies</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-6">
          <PetList 
            pets={pets} 
            isLoaded={isLoaded && healthPlansLoaded} 
            onEdit={(pet) => { setSelectedPet(pet); setIsEditDialogOpen(true); }} 
            onDelete={deletePet} 
          />
        </TabsContent>
        <TabsContent value="register" className="mt-6">
          <Card>
            <CardHeader><CardTitle>Cadastro de Novo Pet</CardTitle></CardHeader>
            <CardContent>
              <PetForm 
                form={form} 
                onFormSubmit={handleFormSubmit} 
                onHealthPlanChange={(id) => {
                  const p = healthPlans.find(pl => pl.id === id);
                  if (p) { form.setValue('healthPlanName', p.nome); form.setValue('healthPlanCode', p.codPlano); }
                }}
                onTutorCpfBlur={handleTutorCpfBlur}
                healthPlans={healthPlans}
                especies={especies}
                tutorCpfInputRef={tutorCpfInputRef}
                isCpfLocked={isCpfLocked}
                onClearLookup={handleClearCpfLookup}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="especies" className="mt-6">
          <Card>
            <CardHeader><CardTitle>Cadastro de Espécies</CardTitle><CardDescription>Adicione as espécies de animais que sua clínica atende.</CardDescription></CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-8">
                <Input 
                  placeholder="Nome da Espécie (ex: Hamster, Tartaruga)" 
                  value={newEspecieNome} 
                  onChange={(e) => setNewEspecieNome(e.target.value)} 
                />
                <Button disabled={especiesLoading || !newEspecieNome} onClick={async () => {
                  const res = await addEspecie(newEspecieNome);
                  if (res.success) { toast({ title: "Sucesso!", description: "Espécie adicionada." }); setNewEspecieNome(''); }
                  else { toast({ title: "Erro na espécie", description: "Nome já existe ou inválido", variant: "destructive" }); }
                }}><Plus className="w-4 h-4 mr-2" />Adicionar</Button>
              </div>

              <Table>
                <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  {especies.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {editingEspecieId === e.id ? (
                          <div className="flex gap-2">
                            <Input 
                              size={30}
                              value={editingEspecieNome} 
                              onChange={(e) => setEditingEspecieNome(e.target.value)}
                              className="h-8"
                            />
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 px-2 text-green-600"
                              onClick={async () => {
                                const res = await updateEspecie(e.id, editingEspecieNome);
                                if (res.success) {
                                  toast({ title: "Sucesso", description: "Espécie atualizada." });
                                  setEditingEspecieId(null);
                                } else {
                                  toast({ title: "Erro", description: res.message, variant: "destructive" });
                                }
                              }}
                            >Salvar</Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 px-2 text-muted-foreground"
                              onClick={() => setEditingEspecieId(null)}
                            >Cancelar</Button>
                          </div>
                        ) : e.nome}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => {
                            setEditingEspecieId(e.id);
                            setEditingEspecieNome(e.nome);
                          }}
                        ><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteEspecie(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {especies.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">Nenhuma espécie cadastrada.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Dados do Pet</DialogTitle></DialogHeader>
          <PetForm 
            form={form} 
            isEdit={true}
            initialData={selectedPet}
            onFormSubmit={handleFormSubmit}
            onHealthPlanChange={(id) => {
              const p = healthPlans.find(pl => pl.id === id);
              if (p) { form.setValue('healthPlanName', p.nome); form.setValue('healthPlanCode', p.codPlano); }
            }}
            healthPlans={healthPlans}
            especies={especies}
            tutorCpfInputRef={tutorCpfInputRef}
            isCpfLocked={isCpfLocked}
            onClearLookup={handleClearCpfLookup}
            onCancel={() => setIsEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
