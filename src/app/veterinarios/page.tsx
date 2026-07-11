"use client";

import * as React from 'react';
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusCircle, Trash2, Edit, ArrowUpDown, UserX, Stethoscope, Undo2, Upload, Download, FileText, CheckCircle2, XCircle, Clock, Printer } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

import { Veterinario } from '@/lib/types';
import { useVeterinarios, VeterinarioFormValues } from '@/hooks/use-veterinarios';
import { exportToCSV } from '@/lib/export-utils';
import { ModelosManager } from '@/components/modelos/modelos-manager';
import { PageTitle } from '@/components/layout/page-title';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
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

const veterinarioSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  crmv: z.string().min(1, "CRMV é obrigatório"),
  email: z.string().email("E-mail inválido").or(z.literal('')).optional().default(''),
  telefone: z.string().optional().default(''),
  codVet: z.string().optional(),
  especialidade: z.string().optional().default('Geral'),
  prontuario_liberado: z.boolean().optional().default(false),
  validade_prontuario: z.string().or(z.literal('')).nullable().optional().default(''),
  validade_acesso: z.string().or(z.literal('')).nullable().optional().default(''),
});

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

function isDateExpired(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function VeterinarioList({ veterinarios, isLoaded, onEdit, onDelete }: { veterinarios: Veterinario[], isLoaded: boolean, onEdit: (vet: Veterinario) => void, onDelete: (id: string) => void }) {
  const router = useRouter();
  const [sortConfig, setSortConfig] = React.useState<{key: keyof Veterinario, direction: 'asc' | 'desc'} | null>(null);

  const sortedVets = React.useMemo(() => {
    let items = [...veterinarios];
    if (sortConfig) {
      items.sort((a, b) => {
        const valA = String(a[sortConfig.key] || '');
        const valB = String(b[sortConfig.key] || '');
        return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }
    return items;
  }, [veterinarios, sortConfig]);

  if (!isLoaded) return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;

  const ProntuarioBadge = ({ vet }: { vet: Veterinario }) => {
    if (!vet.prontuario_liberado) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <XCircle className="h-3.5 w-3.5 text-red-400" /> Não
        </span>
      );
    }
    const expired = isDateExpired(vet.validade_prontuario);
    const dateLabel = vet.validade_prontuario ? formatDate(vet.validade_prontuario) : 'Indeterminado';
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${
        expired ? 'text-red-500' : 'text-emerald-600'
      }`}>
        {expired ? <Clock className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        {expired ? `Expirado (${dateLabel})` : dateLabel}
      </span>
    );
  };

  const ValidadeAcessoBadge = ({ vet }: { vet: Veterinario }) => {
    if (!vet.validade_acesso) return <span className="text-xs text-muted-foreground">-</span>;
    const expired = isDateExpired(vet.validade_acesso);
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${
        expired ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'
      }`}>
        {expired && <Clock className="h-3.5 w-3.5" />}
        {formatDate(vet.validade_acesso)}
        {expired && <span className="text-red-400">(exp.)</span>}
      </span>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Médicos Veterinários Cadastrados</CardTitle>
          <CardDescription>Gerencie o corpo clínico da sua clínica pet.</CardDescription>
        </div>
        <div className="flex gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => {
            const exportData = veterinarios.map(v => ({
              'Nome': v.nome,
              'CRMV': v.crmv,
              'Email': v.email || '',
              'Telefone': v.telefone || '',
              'Codigo_Vet_Antigo': v.codVet || ''
            }));
            
            const dataToExport = exportData.length > 0 ? exportData : [{
              'Nome': 'Dr. Exemplo',
              'CRMV': '12345/SP',
              'Email': 'dr@email.com',
              'Telefone': '(00) 00000-0000',
              'Codigo_Vet_Antigo': 'VET001'
            }];
            
            exportToCSV('modelo_importacao_veterinarios', dataToExport);
          }}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV (Modelo)
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => {
            const reportData = {
              title: "Relação do Corpo Clínico",
              subtitle: "Lista de médicos veterinários cadastrados",
              headers: ["Código", "Nome", "CRMV", "Especialidade", "E-mail", "Telefone", "Validade Acesso", "Prontuário"],
              rows: sortedVets.map(v => [
                v.codVet,
                v.nome,
                v.crmv,
                v.especialidade || 'Geral',
                v.email || '-',
                v.telefone || '-',
                v.validade_acesso ? formatDate(v.validade_acesso) : '-',
                !v.prontuario_liberado ? 'Não' : (v.validade_prontuario ? (isDateExpired(v.validade_prontuario) ? `Expirado (${formatDate(v.validade_prontuario)})` : formatDate(v.validade_prontuario)) : 'Indeterminado')
              ]),
              backUrl: '/veterinarios'
            };
            localStorage.setItem('print-report-data', JSON.stringify(reportData));
            router.push('/print/report');
          }}
        >
          <Printer className="mr-2 h-4 w-4" />
          Imprimir PDF
        </Button>
        </div>
      </CardHeader>
      <CardContent>
        {sortedVets.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>CRMV</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Validade Acesso</TableHead>
                <TableHead>Prontuário</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedVets.map((vet) => (
                <TableRow key={vet.id}>
                  <TableCell>{vet.codVet}</TableCell>
                  <TableCell className="font-medium">{vet.nome}</TableCell>
                  <TableCell>{vet.crmv}</TableCell>
                  <TableCell>{vet.especialidade || 'Geral'}</TableCell>
                  <TableCell>{vet.email || '-'}</TableCell>
                  <TableCell>{vet.telefone || '-'}</TableCell>
                  <TableCell><ValidadeAcessoBadge vet={vet} /></TableCell>
                  <TableCell><ProntuarioBadge vet={vet} /></TableCell>
                  <TableCell className="text-right flex items-center justify-end gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      title="Gerenciar Modelos"
                      onClick={() => router.push(`/veterinarios?tab=modelos&medicoId=${vet.id}`)}
                    >
                      <FileText className="h-4 w-4 text-blue-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onEdit(vet)} title="Editar"><Edit className="h-4 w-4" /></Button>
                    <AlertDialog>
                       <AlertDialogTrigger asChild><Button variant="ghost" size="icon" title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                       <AlertDialogContent>
                         <AlertDialogHeader>
                           <AlertDialogTitle>Excluir Veterinário?</AlertDialogTitle>
                           <AlertDialogDescription>Deseja remover "{vet.nome}" do sistema?</AlertDialogDescription>
                         </AlertDialogHeader>
                         <AlertDialogFooter>
                           <AlertDialogCancel>Cancelar</AlertDialogCancel>
                           <AlertDialogAction onClick={() => onDelete(vet.id)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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
            <h3 className="mt-4 text-lg font-semibold">Nenhum veterinário encontrado</h3>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function VeterinariosPage() {
  const { veterinarios, addVeterinario, updateVeterinario, deleteVeterinario, isLoaded, error, getNextVeterinarioCode } = useVeterinarios();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = React.useState(searchParams.get("tab") || "list");
  
  React.useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [selectedVet, setSelectedVet] = React.useState<Veterinario | null>(null);
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<VeterinarioFormValues>({
    resolver: zodResolver(veterinarioSchema),
    defaultValues: { codVet: "", nome: "", crmv: "", email: "", telefone: "" },
  });

  const handleFormSubmit = async (values: VeterinarioFormValues) => {
    let result;
    if (selectedVet) {
      result = await updateVeterinario(selectedVet.id, values);
    } else {
      result = await addVeterinario(values);
    }

    if (result.success) {
      toast({ title: "Sucesso!", description: selectedVet ? "Veterinário atualizado." : "Veterinário cadastrado." });
      form.reset({ codVet: "", nome: "", crmv: "", email: "", telefone: "" });
      
      if (!selectedVet) {
        // Continuous registration: Keep user on form and focus name
        setTimeout(() => nameInputRef.current?.focus(), 100);
      } else {
        setActiveTab("list");
        setIsEditDialogOpen(false);
        setSelectedVet(null);
      }
    } else {
      toast({ title: "Erro", description: result.message, variant: "destructive" });
    }
  };

  if (error) return <div className="text-red-500">Erro: {error.message}</div>;

  return (
    <>
      <PageTitle title="Corpo Clínico Veterinário" description="Gestão de Médicos Veterinários e seus registros (CRMV).">
        <Link href="/" passHref><Button variant="outline"><Undo2 className="mr-2 h-4 w-4" />Voltar</Button></Link>
      </PageTitle>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:w-[600px]">
          <TabsTrigger value="list"><Stethoscope className="mr-2 h-4 w-4" />Listar Veterinários</TabsTrigger>
          <TabsTrigger value="register"><PlusCircle className="mr-2 h-4 w-4" />Novo Veterinário</TabsTrigger>
          <TabsTrigger value="modelos"><FileText className="mr-2 h-4 w-4" />Modelos</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-6">
          <VeterinarioList 
            veterinarios={veterinarios} 
            isLoaded={isLoaded} 
            onEdit={(vet) => { setSelectedVet(vet); setIsEditDialogOpen(true); form.reset(vet); }} 
            onDelete={deleteVeterinario} 
          />
        </TabsContent>
        <TabsContent value="register" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Novo Veterinário</CardTitle>
              <CardDescription>Preencha os campos abaixo para registrar um novo veterinário.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <FormField control={form.control} name="codVet" render={({ field }) => (
                      <FormItem className="col-span-1 md:col-span-1"><FormLabel>Código do Veterinário</FormLabel><FormControl><Input placeholder="Automático" disabled {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="nome" render={({ field }) => (
                      <FormItem className="col-span-1 md:col-span-3"><FormLabel>Nome do Veterinário</FormLabel><FormControl><Input placeholder="Dr. Nome Completo" {...field} ref={nameInputRef} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="crmv" render={({ field }) => (
                      <FormItem><FormLabel>CRMV</FormLabel><FormControl><Input placeholder="12345/UF" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="especialidade" render={({ field }) => (
                      <FormItem><FormLabel>Especialidade</FormLabel><FormControl><Input placeholder="Ex: Cardiologia" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem><FormLabel>E-mail</FormLabel><FormControl><Input type="email" placeholder="email@clinica.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="telefone" render={({ field }) => (
                      <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input placeholder="(00) 00000-0000" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  
                  <div className="border border-amber-200/50 bg-amber-50/20 dark:bg-amber-950/10 dark:border-amber-900/30 rounded-xl p-5 space-y-4 my-4">
                    <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wider">Acesso e Permissões</h4>
                    <div className="grid grid-cols-1 gap-6 items-end">
                      <FormField control={form.control} name="validade_acesso" render={({ field }) => (
                        <FormItem className="md:w-1/2"><FormLabel>Validade de Acesso do Veterinário no Sistema</FormLabel><FormControl><Input type="date" className="bg-white/50 border-input h-11" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                      <FormField control={form.control} name="prontuario_liberado" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-input p-3 bg-white/50 dark:bg-slate-900/50 shadow-sm h-11">
                          <div className="space-y-0.5"><FormLabel className="text-sm font-medium cursor-pointer">Prontuário Liberado (Módulo Completo)</FormLabel></div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="validade_prontuario" render={({ field }) => (
                        <FormItem><FormLabel>Validade da Liberação do Prontuário</FormLabel><FormControl><Input type="date" className="bg-white/50 border-input h-11" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <Button type="button" variant="outline" onClick={() => form.reset()}>Cancelar</Button>
                    <Button type="submit" disabled={form.formState.isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">Cadastrar Veterinário</Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="modelos" className="mt-6">
          <ModelosManager />
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col p-0">
          <div className="p-6 pb-2">
            <DialogHeader><DialogTitle>Editar Veterinário</DialogTitle></DialogHeader>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 space-y-6 pb-2">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <FormField control={form.control} name="codVet" render={({ field }) => (
                    <FormItem className="col-span-1 md:col-span-1"><FormLabel>Código do Veterinário</FormLabel><FormControl><Input disabled {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="nome" render={({ field }) => (
                    <FormItem className="col-span-1 md:col-span-3"><FormLabel>Nome do Veterinário</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="crmv" render={({ field }) => (
                    <FormItem><FormLabel>CRMV</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="especialidade" render={({ field }) => (
                    <FormItem><FormLabel>Especialidade</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>E-mail</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="telefone" render={({ field }) => (
                    <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                
                <div className="border border-amber-200/50 bg-amber-50/20 dark:bg-amber-950/10 dark:border-amber-900/30 rounded-xl p-5 space-y-4 my-4">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wider">Acesso e Permissões</h4>
                  <div className="grid grid-cols-1 gap-6 items-end">
                    <FormField control={form.control} name="validade_acesso" render={({ field }) => (
                      <FormItem className="md:w-1/2"><FormLabel>Validade de Acesso do Veterinário no Sistema</FormLabel><FormControl><Input type="date" className="bg-white/50 border-input h-11" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <FormField control={form.control} name="prontuario_liberado" render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-input p-3 bg-white/50 dark:bg-slate-900/50 shadow-sm h-11">
                        <div className="space-y-0.5"><FormLabel className="text-sm font-medium cursor-pointer">Prontuário Liberado (Módulo Completo)</FormLabel></div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="validade_prontuario" render={({ field }) => (
                      <FormItem><FormLabel>Validade da Liberação do Prontuário</FormLabel><FormControl><Input type="date" className="bg-white/50 border-input h-11" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                </div>
              </div>
              <div className="flex flex-col md:flex-row justify-end gap-3 p-6 pt-4 border-t bg-slate-50 dark:bg-slate-900 mt-auto">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Salvar Alterações</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
