"use client";

import * as React from "react";
import { useSession } from "@/context/session-context";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
    Building2, Users, PlusCircle, Trash2, Edit, KeyRound, Undo2,
    Loader2, ArrowUpDown, Shield, RotateCcw
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

import { PageTitle } from "@/components/layout/page-title";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
    AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

// ─────────── Types ───────────
interface Empresa {
    id: string;
    codigo?: string;
    razao_social: string;
    nome_fantasia: string;
    cnpj?: string;
    email?: string;
    telefone?: string;
    cidade?: string;
    estado?: string;
    contato?: string;
    cep?: string;
    validade?: string;
    created_at: string;
}

interface AdminUser {
    id: string;
    nome: string;
    email: string;
    telefone?: string;
    status: string;
    cpf?: string;
    crmv_uf?: string;
    empresa_id: string | null;
    validade?: string;
    created_at: string;
    empresas?: { nome_fantasia: string; codigo: string } | null;
}

// ─────────── API Helper ───────────
async function adminApi(method: "GET" | "POST", body?: any, params?: string) {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const url = params ? `/api/admin?${params}` : "/api/admin";
    const res = await fetch(url, {
        method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: method === "POST" ? JSON.stringify(body) : undefined,
    });

    return res.json();
}

// ─────────── Empresas Tab ───────────
function EmpresasTab() {
    const [empresas, setEmpresas] = React.useState<Empresa[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [showForm, setShowForm] = React.useState(false);
    const [editingEmpresa, setEditingEmpresa] = React.useState<Empresa | null>(null);
    const [sortConfig, setSortConfig] = React.useState<{ key: keyof Empresa; direction: "asc" | "desc" } | null>({ key: "nome_fantasia", direction: "asc" });
    const { toast } = useToast();

    const sortedEmpresas = React.useMemo(() => {
        let sortable = [...empresas];
        if (sortConfig !== null) {
            sortable.sort((a, b) => {
                const aVal = String(a[sortConfig.key] || "").toLowerCase();
                const bVal = String(b[sortConfig.key] || "").toLowerCase();
                if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
                return 0;
            });
        }
        return sortable;
    }, [empresas, sortConfig]);

    const requestSort = (key: keyof Empresa) => {
        let direction: "asc" | "desc" = "asc";
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
        setSortConfig({ key, direction });
    };

    // Form state
    const [form, setForm] = React.useState({
        razao_social: "", nome_fantasia: "", cnpj: "", email: "",
        telefone: "", cidade: "", estado: "", codigo: "", contato: "", cep: "",
    });
    const [saving, setSaving] = React.useState(false);

    const fetchEmpresas = React.useCallback(async () => {
        setLoading(true);
        const res = await adminApi("GET", undefined, "resource=empresas");
        if (res.data) setEmpresas(res.data);
        setLoading(false);
    }, []);

    React.useEffect(() => { fetchEmpresas(); }, [fetchEmpresas]);

    const resetForm = () => {
        setForm({ razao_social: "", nome_fantasia: "", cnpj: "", email: "", telefone: "", cidade: "", estado: "", codigo: "", contato: "", cep: "" });
        setEditingEmpresa(null);
        setShowForm(false);
    };

    const handleSave = async () => {
        if (!form.razao_social || !form.nome_fantasia) {
            toast({ title: "Erro", description: "Razão Social e Nome Fantasia são obrigatórios.", variant: "destructive" });
            return;
        }
        setSaving(true);

        const action = editingEmpresa ? "update_empresa" : "create_empresa";
        const body = editingEmpresa
            ? { action, empresaId: editingEmpresa.id, empresaData: form }
            : { action, empresaData: form };

        const res = await adminApi("POST", body);
        setSaving(false);

        if (res.success) {
            toast({ title: "Sucesso!", description: editingEmpresa ? "Empresa atualizada." : "Empresa criada." });
            resetForm();
            fetchEmpresas();
        } else {
            toast({ title: "Erro", description: res.error, variant: "destructive" });
        }
    };

    const handleDelete = async (id: string) => {
        const res = await adminApi("POST", { action: "delete_empresa", empresaId: id });
        if (res.success) {
            toast({ title: "Empresa excluída." });
            fetchEmpresas();
        } else {
            toast({ title: "Erro", description: res.error, variant: "destructive" });
        }
    };

    const handleResetMovements = async (id: string, name: string) => {
        const res = await adminApi("POST", { action: "reset_movements", empresaId: id });
        if (res.success) {
            toast({ title: "Movimentação zerada!", description: `Todo o histórico de ${name} foi removido.` });
        } else {
            toast({ title: "Erro", description: res.error, variant: "destructive" });
        }
    };

    const handleEdit = (empresa: Empresa) => {
        setEditingEmpresa(empresa);
        setForm({
            razao_social: empresa.razao_social || "",
            nome_fantasia: empresa.nome_fantasia || "",
            cnpj: empresa.cnpj || "",
            email: empresa.email || "",
            telefone: empresa.telefone || "",
            cidade: empresa.cidade || "",
            estado: empresa.estado || "",
            codigo: empresa.codigo || "",
            contato: empresa.contato || "",
            cep: empresa.cep || "",
        });
        setShowForm(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Empresas / Clínicas</h3>
                <Button onClick={() => { resetForm(); setShowForm(true); }}>
                    <PlusCircle className="mr-2 h-4 w-4" />Nova Empresa
                </Button>
            </div>

            {/* Form Dialog */}
            <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingEmpresa ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
                        <DialogDescription>Preencha os dados da empresa/clínica.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Razão Social *</Label>
                            <Input value={form.razao_social} onChange={e => setForm({ ...form, razao_social: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Nome Fantasia *</Label>
                            <Input value={form.nome_fantasia} onChange={e => setForm({ ...form, nome_fantasia: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>CNPJ</Label>
                            <Input value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
                        </div>
                        <div className="space-y-2">
                            <Label>Código</Label>
                            <Input value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} placeholder="Ex: pet001" />
                        </div>
                        <div className="space-y-2">
                            <Label>E-mail</Label>
                            <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" />
                        </div>
                        <div className="space-y-2">
                            <Label>Telefone</Label>
                            <Input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Nome do Contato</Label>
                            <Input value={form.contato} onChange={e => setForm({ ...form, contato: e.target.value })} placeholder="Ex: Maria" />
                        </div>
                        <div className="space-y-2">
                            <Label>CEP</Label>
                            <Input value={form.cep} onChange={e => setForm({ ...form, cep: e.target.value })} placeholder="00000-000" />
                        </div>
                        <div className="space-y-2">
                            <Label>Cidade</Label>
                            <Input value={form.cidade} onChange={e => setForm({ ...form, cidade: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Estado (UF)</Label>
                            <Input value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} placeholder="Ex: SP" maxLength={2} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={resetForm}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? "Salvando..." : (editingEmpresa ? "Salvar Alterações" : "Criar Empresa")}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Table */}
            <Card>
                <CardContent className="pt-6">
                    {loading ? (
                        <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
                    ) : empresas.length === 0 ? (
                        <div className="text-center py-12">
                            <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 text-lg font-semibold">Nenhuma empresa cadastrada</h3>
                            <p className="mt-1 text-sm text-muted-foreground">Clique em &quot;Nova Empresa&quot; para começar.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('codigo')}>
                                        <div className="flex items-center">Código <ArrowUpDown className="ml-2 h-4 w-4" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('nome_fantasia')}>
                                        <div className="flex items-center">Nome Fantasia <ArrowUpDown className="ml-2 h-4 w-4" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('cnpj')}>
                                        <div className="flex items-center">CNPJ <ArrowUpDown className="ml-2 h-4 w-4" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('cidade')}>
                                        <div className="flex items-center">Cidade/UF <ArrowUpDown className="ml-2 h-4 w-4" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('contato')}>
                                        <div className="flex items-center">Contato <ArrowUpDown className="ml-2 h-4 w-4" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('telefone')}>
                                        <div className="flex items-center">Telefone <ArrowUpDown className="ml-2 h-4 w-4" /></div>
                                    </TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedEmpresas.map(empresa => (
                                    <TableRow key={empresa.id}>
                                        <TableCell>{empresa.codigo || "—"}</TableCell>
                                        <TableCell className="font-medium">{empresa.nome_fantasia}</TableCell>
                                        <TableCell>{empresa.cnpj || "—"}</TableCell>
                                        <TableCell>{[empresa.cidade, empresa.estado].filter(Boolean).join("/") || "—"}</TableCell>
                                        <TableCell>{empresa.contato || "—"}</TableCell>
                                        <TableCell>{empresa.telefone || "—"}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(empresa)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="outline" size="sm" className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700" title="Zerar Movimentação">
                                                        <RotateCcw className="h-4 w-4 mr-1" />
                                                        Zerar
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Zerar Movimentação de &quot;{empresa.nome_fantasia}&quot;?</AlertDialogTitle>
                                                        <AlertDialogDescription className="text-destructive font-bold">
                                                            ATENÇÃO: Isso excluirá permanentemente TODAS as guias emitidas, leituras realizadas e dados de faturamento desta empresa.
                                                        </AlertDialogDescription>
                                                        <AlertDialogDescription>
                                                            Pacientes, exames e usuários NÃO serão afetados. Esta ação é irreversível.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleResetMovements(empresa.id, empresa.nome_fantasia)} className="bg-orange-600 hover:bg-orange-700">Zerar Movimentação</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Isso excluirá a empresa &quot;{empresa.nome_fantasia}&quot; e TODOS os dados vinculados (usuários, pacientes, exames, leituras). Esta ação não pode ser desfeita.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(empresa.id)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ─────────── Usuários Tab ───────────
function UsuariosTab() {
    const [users, setUsers] = React.useState<AdminUser[]>([]);
    const [empresas, setEmpresas] = React.useState<Empresa[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [showForm, setShowForm] = React.useState(false);
    const [editingUser, setEditingUser] = React.useState<AdminUser | null>(null);
    const [sortConfig, setSortConfig] = React.useState<{ key: keyof AdminUser | 'empresas'; direction: "asc" | "desc" } | null>({ key: "nome", direction: "asc" });
    const { toast } = useToast();

    // Form state
    const [form, setForm] = React.useState({
        nome: "", email: "", telefone: "", status: "", empresa_id: "", validade: "",
        cpf: "", crmv_uf: "",
    });
    const [saving, setSaving] = React.useState(false);

    const sortedUsers = React.useMemo(() => {
        let sortable = [...users];
        if (sortConfig !== null) {
            sortable.sort((a, b) => {
                let aVal = String(a[sortConfig.key as keyof AdminUser] || "").toLowerCase();
                let bVal = String(b[sortConfig.key as keyof AdminUser] || "").toLowerCase();
                if (sortConfig.key === "empresas") {
                    aVal = String(a.empresas?.nome_fantasia || "").toLowerCase();
                    bVal = String(b.empresas?.nome_fantasia || "").toLowerCase();
                }

                if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
                return 0;
            });
        }
        return sortable;
    }, [users, sortConfig]);

    const requestSort = (key: keyof AdminUser | 'empresas') => {
        let direction: "asc" | "desc" = "asc";
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
        setSortConfig({ key, direction });
    };

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        const [usersRes, empresasRes] = await Promise.all([
            adminApi("GET", undefined, "resource=usuarios"),
            adminApi("GET", undefined, "resource=empresas"),
        ]);
        if (usersRes.data) setUsers(usersRes.data);
        if (empresasRes.data) setEmpresas(empresasRes.data);
        setLoading(false);
    }, []);

    React.useEffect(() => { fetchData(); }, [fetchData]);

    const resetForm = () => {
        setForm({ nome: "", email: "", telefone: "", status: "", empresa_id: "", validade: "", cpf: "", crmv_uf: "" });
        setEditingUser(null);
        setShowForm(false);
    };

    const handleSaveUser = async () => {
        if (!form.nome || !form.email || !form.status) {
            toast({ title: "Erro", description: "Nome, email e status são obrigatórios.", variant: "destructive" });
            return;
        }
        if (form.status !== "Master" && !form.empresa_id) {
            toast({ title: "Erro", description: "Empresa é obrigatória para este perfil.", variant: "destructive" });
            return;
        }

        setSaving(true);
        const action = editingUser ? "update_user" : "create_user";

        const formattedValidade = form.status === "Administrador" ? null : (form.validade || null);

        const body = editingUser
            ? {
                action,
                userId: editingUser.id,
                userData: {
                    ...form,
                    validade: formattedValidade,
                    empresa_id: form.status === "Master" ? null : form.empresa_id
                }
            }
            : {
                action,
                ...form,
                validade: formattedValidade,
                empresaId: form.status === "Master" ? null : form.empresa_id
            };

        const res = await adminApi("POST", body);
        setSaving(false);

        if (res.success) {
            toast({ title: "Sucesso!", description: editingUser ? "Usuário salvo com sucesso!" : `Usuário criado. Senha provisória: 123456` });
            resetForm();
            fetchData();
        } else {
            toast({ title: "Erro", description: res.error, variant: "destructive" });
        }
    };

    const handleEditUser = (user: AdminUser) => {
        setEditingUser(user);
        setForm({
            nome: user.nome || "",
            email: user.email || "",
            telefone: user.telefone || "",
            status: user.status || "",
            empresa_id: user.empresa_id || "",
            validade: user.validade || "",
            cpf: user.cpf || "",
            crmv_uf: user.crmv_uf || "",
        });
        setShowForm(true);
    };

    const handleResetPassword = async (userId: string, userName: string) => {
        const res = await adminApi("POST", { action: "reset_password", userId });
        if (res.success) {
            toast({ title: "Senha resetada", description: `A senha de "${userName}" foi redefinida para 123456.` });
        } else {
            toast({ title: "Erro", description: res.error, variant: "destructive" });
        }
    };

    const handleDeleteUser = async (userId: string) => {
        const res = await adminApi("POST", { action: "delete_user", userId });
        if (res.success) {
            toast({ title: "Usuário excluído." });
            fetchData();
        } else {
            toast({ title: "Erro", description: res.error, variant: "destructive" });
        }
    };

    const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
        Master: "destructive",
        Administrador: "default",
        "Administrador Auxiliar": "default",
        "Veterinário": "secondary",
        "Veterinário Geral": "secondary",
        "Secretária": "secondary",
        "Secretária Geral": "secondary",
        Leitor: "outline",
        "Relatórios": "outline",
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Usuários do Sistema</h3>
                <Button onClick={() => { resetForm(); setShowForm(true); }}>
                    <PlusCircle className="mr-2 h-4 w-4" />Novo Usuário
                </Button>
            </div>

            {/* Create User Dialog */}
            <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingUser ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
                        <DialogDescription>
                            {editingUser
                                ? "Altere as informações do usuário."
                                : "O usuário receberá a senha provisória 123456."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Nome *</Label>
                                <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: João Silva" />
                            </div>
                            <div className="space-y-2">
                                <Label>E-mail *</Label>
                                <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" placeholder="usuario@email.com" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Telefone</Label>
                                <Input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" />
                            </div>
                            <div className="space-y-2">
                                <Label>CPF</Label>
                                <Input value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Perfil *</Label>
                                <Select value={form.status} onValueChange={val => setForm({ ...form, status: val })}>
                                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Administrador">Administrador (Ilimitado)</SelectItem>
                                        {editingUser && (
                                            <>
                                                <SelectItem value="Master">Master</SelectItem>
                                                <SelectItem value="Administrador Auxiliar">Adm Auxiliar</SelectItem>
                                                <SelectItem value="Veterinário">Veterinário</SelectItem>
                                                <SelectItem value="Veterinário Geral">Veterinário Geral</SelectItem>
                                                <SelectItem value="Secretária">Secretária</SelectItem>
                                                <SelectItem value="Secretária Geral">Secretária Geral</SelectItem>
                                                <SelectItem value="Leitor">Leitor</SelectItem>
                                                <SelectItem value="Relatórios">Relatórios</SelectItem>
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Empresa {form.status !== "Master" && "*"}</Label>
                                <Select
                                    value={form.empresa_id}
                                    onValueChange={val => setForm({ ...form, empresa_id: val })}
                                    disabled={form.status === "Master"}
                                >
                                    <SelectTrigger><SelectValue placeholder={form.status === "Master" ? "N/A" : "Selecione"} /></SelectTrigger>
                                    <SelectContent>
                                        {empresas.map(emp => (
                                            <SelectItem key={emp.id} value={emp.id}>{emp.nome_fantasia}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {(form.status === "Veterinário" || form.status === "Veterinário Geral") && (
                            <div className="space-y-2">
                                <Label>CRMV / UF do Veterinário</Label>
                                <Input value={form.crmv_uf} onChange={e => setForm({ ...form, crmv_uf: e.target.value })} placeholder="Ex: 12345/SP" />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Data de Validade {form.status === 'Administrador' && <span className="text-xs text-muted-foreground">(Ilimitada)</span>}</Label>
                            {form.status === 'Administrador' ? (
                                <Input type="text" value="Ilimitada" disabled />
                            ) : (
                                <Input
                                    type="date"
                                    value={form.validade}
                                    onChange={e => setForm({ ...form, validade: e.target.value })}
                                />
                            )}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={resetForm}>Cancelar</Button>
                        <Button onClick={handleSaveUser} disabled={saving}>
                            {saving ? "Salvando..." : (editingUser ? "Salvar Alterações" : "Criar Usuário")}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Users Table */}
            <Card>
                <CardContent className="pt-6">
                    {loading ? (
                        <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-12">
                            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 text-lg font-semibold">Nenhum usuário cadastrado</h3>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('nome')}>
                                        <div className="flex items-center">Nome <ArrowUpDown className="ml-2 h-4 w-4" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('email')}>
                                        <div className="flex items-center">E-mail <ArrowUpDown className="ml-2 h-4 w-4" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('status')}>
                                        <div className="flex items-center">Perfil <ArrowUpDown className="ml-2 h-4 w-4" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('empresas')}>
                                        <div className="flex items-center">Empresa <ArrowUpDown className="ml-2 h-4 w-4" /></div>
                                    </TableHead>
                                    <TableHead>Cód. Empresa</TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('validade')}>
                                        <div className="flex items-center">Validade <ArrowUpDown className="ml-2 h-4 w-4" /></div>
                                    </TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedUsers.map(user => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.nome}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span>{user.email}</span>
                                                {user.telefone && <span className="text-xs text-muted-foreground">{user.telefone}</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={statusColors[user.status] || "secondary"}>
                                                {user.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{user.empresas?.nome_fantasia || (user.status === "Master" ? "—" : "Sem empresa")}</TableCell>
                                        <TableCell className="font-mono text-xs">{user.empresas?.codigo || "—"}</TableCell>
                                        <TableCell>{user.validade ? format(new Date(user.validade), "dd/MM/yyyy") : "—"}</TableCell>
                                        <TableCell className="text-right space-x-1">
                                            <Button variant="ghost" size="icon" title="Editar usuário" onClick={() => handleEditUser(user)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" title="Resetar senha">
                                                        <KeyRound className="h-4 w-4 text-amber-600" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Resetar senha?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            A senha de &quot;{user.nome}&quot; será redefinida para 123456.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleResetPassword(user.id, user.nome)}>Resetar</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" title="Excluir usuário">
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Isso removerá a conta de &quot;{user.nome}&quot; permanentemente.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ─────────── Main Page ───────────
export default function AdminPage() {
    const { user, isMaster } = useSession();
    const router = useRouter();

    if (!isMaster) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="text-center">
                    <Shield className="mx-auto h-16 w-16 text-muted-foreground" />
                    <h2 className="mt-4 text-xl font-semibold">Acesso Restrito</h2>
                    <p className="mt-2 text-muted-foreground">Esta página é exclusiva do Administrador Master.</p>
                    <Link href="/">
                        <Button className="mt-4" variant="outline">
                            <Undo2 className="mr-2 h-4 w-4" />Voltar ao Menu
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <>
            <PageTitle
                title="Painel Master"
                description="Gerencie empresas, crie contas de acesso e controle o sistema."
            >
                <Link href="/">
                    <Button variant="outline">
                        <Undo2 className="mr-2 h-4 w-4" />Voltar ao Menu
                    </Button>
                </Link>
            </PageTitle>

            <Tabs defaultValue="empresas" className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
                    <TabsTrigger value="empresas">
                        <Building2 className="mr-2 h-4 w-4" />Empresas
                    </TabsTrigger>
                    <TabsTrigger value="usuarios">
                        <Users className="mr-2 h-4 w-4" />Usuários
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="empresas" className="mt-6">
                    <EmpresasTab />
                </TabsContent>

                <TabsContent value="usuarios" className="mt-6">
                    <UsuariosTab />
                </TabsContent>
            </Tabs>
        </>
    );
}
