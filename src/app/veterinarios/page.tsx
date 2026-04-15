"use client";

import * as React from 'react';
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusCircle, Trash2, Edit, ArrowUpDown, UserX, Stethoscope, Undo2, Upload } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

import { Veterinario } from '@/lib/types';
import { useVeterinarios, VeterinarioFormValues } from '@/hooks/use-veterinarios';
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

const veterinarioSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  crmv: z.string().min(1, "CRMV é obrigatório"),
  email: z.string().email("E-mail inválido").or(z.literal('')).optional().default(''),
  telefone: z.string().optional().default(''),
  codVet: z.string().optional(),
});

function VeterinarioList({ veterinarios, isLoaded, onEdit, onDelete }: { veterinarios: Veterinario[], isLoaded: boolean, onEdit: (vet: Veterinario) => void, onDelete: (id: string) => void }) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Médicos Veterinários Cadastrados</CardTitle>
        <CardDescription>Gerencie o corpo clínico da sua clínica pet.</CardDescription>
      </CardHeader>
      <CardContent>
        {sortedVets.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>CRMV</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedVets.map((vet) => (
                <TableRow key={vet.id}>
                  <TableCell>{vet.codVet}</TableCell>
                  <TableCell className="font-medium">{vet.nome}</TableCell>
                  <TableCell>{vet.crmv}</TableCell>
                  <TableCell>{vet.email || '-'}</TableCell>
                  <TableCell>{vet.telefone || '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(vet)}><Edit className="h-4 w-4" /></Button>
                    <AlertDialog>
                       <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
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
  const [activeTab, setActiveTab] = React.useState("list");
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
        <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="list">Listar Veterinários</TabsTrigger>
          <TabsTrigger value="register">Novo Veterinário</TabsTrigger>
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
            <CardHeader><CardTitle>Cadastro de Veterinário</CardTitle></CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
                  <FormField control={form.control} name="nome" render={({ field }) => (
                    <FormItem><FormLabel>Nome do Profissional</FormLabel><FormControl><Input placeholder="Dr. Nome Completo" {...field} ref={nameInputRef} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="crmv" render={({ field }) => (
                      <FormItem><FormLabel>CRMV</FormLabel><FormControl><Input placeholder="12345/UF" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem><FormLabel>E-mail</FormLabel><FormControl><Input type="email" placeholder="email@clinica.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="telefone" render={({ field }) => (
                      <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input placeholder="(00) 00000-0000" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <Button type="submit" disabled={form.formState.isSubmitting}>Cadastrar Veterinário</Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Veterinário</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
              <FormField control={form.control} name="nome" render={({ field }) => (
                <FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="crmv" render={({ field }) => (
                <FormItem><FormLabel>CRMV</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>E-mail</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="telefone" render={({ field }) => (
                <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="flex flex-col md:flex-row gap-3">
                <Button type="submit">Salvar Alterações</Button>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Voltar</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
