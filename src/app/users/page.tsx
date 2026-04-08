"use client";

import * as React from 'react';
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusCircle, Trash2, Edit, ArrowUpDown, UserX, UserCog, Calendar as CalendarIcon, ShieldAlert, LogIn, Undo2, Key } from 'lucide-react';
import { format, addYears, parse } from 'date-fns';
import { useRouter } from 'next/navigation';
import Link from 'next/link';


import { Usuario } from '@/lib/types';
import { useUsers, UserFormValues } from '@/hooks/use-user-management';
import { forcarTrocaDeSenha } from '@/app/actions/usuarios';
import { PageTitle } from '@/components/layout/page-title';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSession } from '@/context/session-context';

type UserRole = 'Administrador' | 'Administrador Auxiliar' | 'Secretária' | 'Secretária Geral' | 'MedicoVet' | 'MedicoVet Geral' | 'Leitor' | 'Leitor Geral' | 'Relatórios';

const userFormSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido."),
  status: z.enum(['Administrador', 'Administrador Auxiliar', 'Secretária', 'Secretária Geral', 'MedicoVet', 'MedicoVet Geral', 'Leitor', 'Leitor Geral', 'Relatórios'], { required_error: "Status é obrigatório" }),
  dataValidade: z.date({ required_error: "Data de validade é obrigatória" }),
  telefone: z.string().optional().default(''),
});

const editUserSchema = userFormSchema.omit({ email: true });

type SortConfig = {
  key: keyof Usuario;
  direction: 'ascending' | 'descending';
};

const statusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status) {
    case 'Administrador': return 'default';
    case 'Administrador Auxiliar': return 'default';
    default: return 'secondary';
  }
};

function UserList({ users, isLoaded, onEdit, onDelete }: { users: Usuario[], isLoaded: boolean, onEdit: (user: Usuario) => void, onDelete: (id: string) => void }) {
  const [sortConfig, setSortConfig] = React.useState<SortConfig | null>(null);
  const { user: currentUser } = useSession();
  const router = useRouter();


  const visibleUsers = React.useMemo(() => {
    if (currentUser?.status === 'Master') return users;
    return users.filter(u => {
      // Sempre vê a si mesmo
      if (u.id === currentUser?.id) return true;
      // Perfil Administrador só visível para Master ou o próprio
      if (u.status === 'Administrador') return false;
      // Perfil Administrador Auxiliar visível para Master, Adm ou o próprio
      if (u.status === 'Administrador Auxiliar' && currentUser?.status !== 'Administrador') return false;
      return true;
    });
  }, [users, currentUser]);

  const sortedUsers = React.useMemo(() => {
    let sortableItems = [...visibleUsers];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const valA: string = String(a[sortConfig.key] ?? '');
        const valB: string = String(b[sortConfig.key] ?? '');
        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [users, sortConfig]);

  const requestSort = (key: keyof Usuario) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: keyof Usuario) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    return sortConfig.direction === 'ascending' ? '▲' : '▼';
  };

  const handleProceedToLogin = () => {
    window.location.href = '/login';
  };

  const getFormattedDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Ilimitada';
    try {
      const parsed = parse(dateString, 'yyyy-MM-dd', new Date());
      // Check if the parsed date is valid
      if (isNaN(parsed.getTime())) {
        return 'Inválida';
      }
      return format(parsed, 'dd/MM/yyyy');
    } catch {
      return 'Inválida';
    }
  };

  // Supervisor/AdminAuxiliar só pode editar/excluir usuários que ele tem permissão (não Adm nem Super). Master pode tudo.
  const canManageUser = (targetUser: Usuario) => {
    if (currentUser?.status === 'Master' || currentUser?.status === 'Administrador') return true;
    if (currentUser?.status === 'Administrador Auxiliar') {
      return !['Administrador', 'Administrador Auxiliar', 'Master'].includes(targetUser.status);
    }
    return false;
  };


  if (!isLoaded) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuários Cadastrados</CardTitle>
        <CardDescription>Visualize e gerencie todos os usuários do sistema.</CardDescription>
      </CardHeader>
      <CardContent>


        {sortedUsers.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><Button variant="ghost" onClick={() => requestSort('numUsuario')}>Número{getSortIndicator('numUsuario')}</Button></TableHead>
                <TableHead><Button variant="ghost" onClick={() => requestSort('nome')}>Nome{getSortIndicator('nome')}</Button></TableHead>
                <TableHead><Button variant="ghost" onClick={() => requestSort('email')}>Email{getSortIndicator('email')}</Button></TableHead>
                <TableHead><Button variant="ghost" onClick={() => requestSort('status')}>Status{getSortIndicator('status')}</Button></TableHead>
                <TableHead><Button variant="ghost" onClick={() => requestSort('dataValidade')}>Validade{getSortIndicator('dataValidade')}</Button></TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead><Button variant="ghost" onClick={() => requestSort('dataCadastro')}>Cadastro{getSortIndicator('dataCadastro')}</Button></TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.numUsuario}</TableCell>
                  <TableCell className="font-medium">{user.nome}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(user.status)}>
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{getFormattedDate(user.dataValidade)}</TableCell>
                  <TableCell>{user.telefone || '-'}</TableCell>
                  <TableCell>{format(new Date(user.dataCadastro), 'dd/MM/yyyy HH:mm')}</TableCell>
                  <TableCell className="text-right">
                    {canManageUser(user) && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => onEdit(user)}><Edit className="h-4 w-4" /><span className="sr-only">Editar</span></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /><span className="sr-only">Excluir</span></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Você tem certeza?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita. Isso irá excluir permanentemente o usuário &quot;{user.nome}&quot;.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(user.id)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12"><UserX className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">Nenhum usuário encontrado</h3><p className="mt-1 text-sm text-muted-foreground">Comece cadastrando um novo usuário na aba &quot;Cadastrar&quot;.</p></div>
        )}
      </CardContent>
    </Card>
  );
}

function UserForm({ onFormSubmit, isEditMode = false, initialData }: { onFormSubmit: (values: any) => Promise<any>, isEditMode?: boolean, initialData?: Partial<Usuario & { dataValidade: Date | string }> }) {
  const { user: currentUser } = useSession();

  const form = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(isEditMode ? editUserSchema : userFormSchema) as any,
    defaultValues: { nome: "", email: "", status: undefined as any, dataValidade: undefined, telefone: "" },
  });

  const status = form.watch('status');

  // Roles disponíveis baseado no usuário logado
  const availableRoles: { value: UserRole; label: string }[] = React.useMemo(() => {
    if (currentUser?.status === 'Administrador Auxiliar') {
      return [
        { value: 'Secretária', label: 'Secretária' },
        { value: 'Secretária Geral', label: 'Secretária Geral' },
        { value: 'MedicoVet', label: 'Médico Veterinário' },
        { value: 'MedicoVet Geral', label: 'Médico Vet. Geral' },
        { value: 'Leitor', label: 'Leitor' },
        { value: 'Leitor Geral', label: 'Leitor Geral' },
        { value: 'Relatórios', label: 'Relatórios' },
      ];
    }
    // Administrador (e o Master agindo pela Empresa) pode criar todos os perfis abaixo dele
    return [
      { value: 'Administrador', label: 'Administrador Empresarial' },
      { value: 'Administrador Auxiliar', label: 'Administrador Auxiliar' },
      { value: 'Secretária', label: 'Secretária' },
      { value: 'Secretária Geral', label: 'Secretária Geral' },
      { value: 'MedicoVet', label: 'Médico Veterinário' },
      { value: 'MedicoVet Geral', label: 'Médico Vet. Geral' },
      { value: 'Leitor', label: 'Leitor' },
      { value: 'Leitor Geral', label: 'Leitor Geral' },
      { value: 'Relatórios', label: 'Relatórios' },
    ];
  }, [currentUser?.status]);

  // Data máxima de validade: para Administrador Auxiliar, é sua própria validade
  const maxValidityDate: Date | undefined = React.useMemo(() => {
    if ((currentUser?.status === 'Administrador Auxiliar' || currentUser?.status === 'Administrador') && currentUser.dataValidade) {
      try {
        const parsed = parse(currentUser.dataValidade, 'yyyy-MM-dd', new Date());
        if (!isNaN(parsed.getTime())) return parsed;
      } catch { /* fallback */ }
    }
    return undefined;
  }, [currentUser]);

  React.useEffect(() => {
    if (!isEditMode && status && !form.getValues('dataValidade')) {
      // Para novo usuário, default 1 ano. Se supervisor, limita à sua validade
      const defaultDate = addYears(new Date(), 1);
      if (maxValidityDate && defaultDate > maxValidityDate) {
        form.setValue('dataValidade', maxValidityDate);
      } else {
        form.setValue('dataValidade', defaultDate);
      }
    }
  }, [status, form, isEditMode, maxValidityDate]);


  React.useEffect(() => {
    if (isEditMode && initialData) {
      let parsedDate = new Date(); // Default fallback
      if (initialData.dataValidade && typeof initialData.dataValidade === 'string') {
        try {
          const parsed = parse(initialData.dataValidade, 'yyyy-MM-dd', new Date());
          if (!isNaN(parsed.getTime())) {
            parsedDate = parsed;
          }
        } catch (e) {
          // Fallback to `new Date()` is already set
        }
      } else if ((initialData.dataValidade as unknown) instanceof Date) {
        // If it's already a date, use it directly
        parsedDate = initialData.dataValidade as unknown as Date;
      }

      form.reset({
        nome: initialData.nome,
        status: initialData.status as any,
        dataValidade: parsedDate,
        email: initialData.email,
        telefone: initialData.telefone || ""
      });
    } else {
      form.reset({
        nome: "", email: "", status: undefined as any, dataValidade: undefined, telefone: ""
      })
    }
  }, [initialData, isEditMode, form]);

  async function onSubmit(values: z.infer<typeof userFormSchema | typeof editUserSchema>) {
    await onFormSubmit(values);
    if (!isEditMode) {
      form.reset({ nome: "", email: "", status: undefined as any, dataValidade: undefined, telefone: "" });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Alert variant="default" className="bg-blue-50 border-blue-200">
          <ShieldAlert className="h-4 w-4 text-blue-700" />
          <AlertTitle className="text-blue-800">Senha Padrão</AlertTitle>
          <AlertDescription className="text-blue-700">
            {isEditMode
              ? "Para alterar a senha deste usuário sem confirmação, utilize o painel 'Forçar Troca de Senha' abaixo deste formulário."
              : "O novo usuário receberá a senha padrão \"123\". No primeiro login, será solicitado que defina uma nova senha."}
          </AlertDescription>
        </Alert>
        <FormField
          control={form.control}
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome ou Apelido</FormLabel>
              <FormControl><Input placeholder="Ex: João Silva" {...field} /></FormControl>
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
                <FormControl><Input placeholder="usuario@email.com" {...field} disabled={isEditMode} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Perfil de Acesso</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione o perfil" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {availableRoles.map(role => (
                      <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                    ))}
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
            name="dataValidade"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Data de Validade {maxValidityDate ? <span className="text-xs text-muted-foreground">(Máx: {format(maxValidityDate, 'dd/MM/yyyy')})</span> : <span className="text-xs text-muted-foreground">(Opcional)</span>}</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                        {field.value ? format(field.value, "PPP") : <span>Escolha uma data (Ilimitado se vazio)</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => {
                        const isBeforeToday = date < new Date() && date.toDateString() !== new Date().toDateString();
                        const isAfterMaxValidity = maxValidityDate ? date > maxValidityDate : false;
                        return isBeforeToday || isAfterMaxValidity;
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
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
                <FormControl><Input placeholder="(00) 00000-0000" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full md:w-auto" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Salvando...' : (<>{isEditMode ? 'Salvar Alterações' : 'Cadastrar Usuário'}</>)}
        </Button>
      </form>
    </Form>
  );
}

function BotaoMudarSenha({ usuarioIdAlvo }: { usuarioIdAlvo: string }) {
  const [novaSenha, setNovaSenha] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const { toast } = useToast()

  const handleTrocarSenha = async () => {
    if (novaSenha.length < 6) {
      toast({ title: "Aviso", description: "A senha deve ter no mínimo 6 caracteres!", variant: "destructive" })
      return
    }
    
    setLoading(true)
    const resultado = await forcarTrocaDeSenha(usuarioIdAlvo, novaSenha)
    
    if (resultado.sucesso) {
      toast({ title: "Sucesso!", description: resultado.mensagem })
      setNovaSenha('')
    } else {
      toast({ title: "Erro", description: resultado.erro, variant: "destructive" })
    }
    setLoading(false)
  }

  return (
    <Card className="border-red-200 bg-red-50/50 mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-red-700 flex items-center gap-2 text-base"><Key className="w-4 h-4" /> Forçar Troca de Senha</CardTitle>
        <CardDescription className="text-xs">Redefine a senha deste usuário imediatamente.</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2 items-center">
        <Input 
          type="password" 
          placeholder="Nova senha (min 6 carac.)"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          className="bg-white h-9"
        />
        <Button 
          type="button"
          onClick={handleTrocarSenha} 
          disabled={loading || novaSenha.length < 6}
          variant="destructive"
          className="h-9 whitespace-nowrap"
        >
          {loading ? 'Salvando...' : 'Atualizar'}
        </Button>
      </CardContent>
    </Card>
  )
}

export default function UsersPage() {
  const { users, addUser, updateUser, deleteUser, isLoaded, error } = useUsers();
  const [activeTab, setActiveTab] = React.useState("list");
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<Usuario | null>(null);
  const { toast } = useToast();
  const tabsListRef = React.useRef<HTMLDivElement>(null);
  const { user: sessionUser } = useSession();

  // Sempre iniciar na lista
  React.useEffect(() => {
    setActiveTab('list');
  }, []);

  const handleUserAdded = () => {
    // Keep user on the "register" tab to allow continuous registration
    // setActiveTab("list");
  };

  const handleDeleteUser = async (id: string) => {
    toast({ title: "Aguarde", description: "Excluindo usuário..." });
    const result = await deleteUser(id);
    if (result.success) {
      toast({ title: "Usuário Excluído", description: "O registro do usuário foi removido." });
    } else {
      toast({ title: "Erro", description: result.message, variant: "destructive" });
    }
  };

  const handleOpenEditDialog = (user: Usuario) => {
    setSelectedUser(user);
    setIsEditDialogOpen(true);
  };

  const handleAddUser = async (values: z.infer<typeof userFormSchema>) => {
    toast({ title: "Aguarde", description: "Criando novo usuário..." });
    const result = await addUser(values);
    if (result.success) {
      toast({ title: "Sucesso!", description: "Usuário cadastrado com sucesso. Senha padrão: 123" });
      handleUserAdded();
    } else {
      toast({ title: "Erro", description: result.message, variant: "destructive" });
    }
  };

  const handleUpdateUser = async (values: z.infer<typeof editUserSchema>) => {
    if (!selectedUser) return;
    const result = await updateUser(selectedUser.id, values);
    if (result.success) {
      toast({ title: "Sucesso!", description: "Usuário atualizado com sucesso." });
      setIsEditDialogOpen(false);
      setSelectedUser(null);
    } else {
      toast({ title: "Erro", description: result.message, variant: "destructive" });
    }
  };

  if (error) return <div className="text-red-500">Erro ao carregar usuários: {error.message}</div>;

  return (
    <>
      <PageTitle
        title="Gerenciamento de Usuários"
        description="Adicione, visualize e gerencie os usuários do sistema."
      >
        <Link href="/" passHref>
          <Button variant="outline">
            <Undo2 className="mr-2 h-4 w-4" />
            Voltar ao Menu
          </Button>
        </Link>
      </PageTitle>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList ref={tabsListRef} className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="list"><UserCog className="mr-2 h-4 w-4" />Listar Usuários</TabsTrigger>
          <TabsTrigger value="register"><PlusCircle className="mr-2 h-4 w-4" />Cadastrar</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-6">
          <UserList users={users} isLoaded={isLoaded} onEdit={handleOpenEditDialog} onDelete={handleDeleteUser} />
        </TabsContent>
        <TabsContent value="register" className="mt-6">
          <Card>
            <CardHeader><CardTitle>Novo Usuário</CardTitle><CardDescription>Preencha os campos abaixo para registrar um novo usuário no sistema.</CardDescription></CardHeader>
            <CardContent><UserForm onFormSubmit={handleAddUser} /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) setSelectedUser(null); setIsEditDialogOpen(isOpen); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Usuário</DialogTitle><DialogDescription>Modifique os dados do usuário abaixo. O e-mail não pode ser alterado.</DialogDescription></DialogHeader>
          <UserForm onFormSubmit={handleUpdateUser} isEditMode={true} initialData={selectedUser || undefined} />
          {selectedUser && (
             <BotaoMudarSenha usuarioIdAlvo={selectedUser.id} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
