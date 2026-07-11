"use client";

import * as React from "react";
import { useSession } from "@/context/session-context";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
    Building2, Users, PlusCircle, Trash2, Edit, KeyRound, Undo2,
    Loader2, ArrowUpDown, Shield, RotateCcw, UploadCloud, Stethoscope, Download,
    Database, HardDrive, Activity
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import * as xlsx from "xlsx";

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

// ─────────── Importações Tab ───────────
function ImportacoesTab() {
    const [empresas, setEmpresas] = React.useState<Empresa[]>([]);
    const [selectedEmpresa, setSelectedEmpresa] = React.useState<string>("");
    const [file, setFile] = React.useState<File | null>(null);
    const [importing, setImporting] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        adminApi("GET", undefined, "resource=empresas").then(res => {
            if (res.data) setEmpresas(res.data);
        });
    }, []);

    const handleImport = async () => {
        if (!selectedEmpresa) {
            toast({ title: "Erro", description: "Selecione a empresa de destino.", variant: "destructive" });
            return;
        }
        if (!file) {
            toast({ title: "Erro", description: "Selecione o arquivo Excel.", variant: "destructive" });
            return;
        }

        setImporting(true);
        try {
            const buffer = await file.arrayBuffer();
            const workbook = xlsx.read(buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(sheet);
            
            const res = await adminApi("POST", { action: "import_exams", empresaId: selectedEmpresa, data });
            
            if (res.success) {
                toast({ title: "Sucesso", description: `Foram importados ${res.count} registros com sucesso para a empresa.` });
                setFile(null);
                const fileInput = document.getElementById('excel-file') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
            } else {
                toast({ title: "Erro na importação", description: res.error || "Ocorreu um erro no servidor.", variant: "destructive" });
            }

        } catch (error) {
            toast({ title: "Erro na leitura", description: "Verifique o formato do arquivo e tente novamente.", variant: "destructive" });
        } finally {
            setImporting(false);
        }
    };

    return (
        <Card className="border-indigo-100 shadow-sm">
            <CardHeader className="bg-indigo-50/50 rounded-t-xl border-b border-indigo-100">
                <CardTitle className="text-indigo-800 flex items-center text-lg">
                    <UploadCloud className="w-5 h-5 mr-2" />
                    Importação de Catálogo TUSS/ANS
                </CardTitle>
                <CardDescription>
                    Faça o upload da tabela oficial de exames (Excel) para carregar os códigos e nomes diretamente para uma clínica.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label>Empresa / Clínica de Destino *</Label>
                        <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a empresa" />
                            </SelectTrigger>
                            <SelectContent>
                                {empresas.map(emp => (
                                    <SelectItem key={emp.id} value={emp.id}>{emp.nome_fantasia}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                            O catálogo de exames será importado e vinculado apenas a esta empresa.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label>Arquivo Excel (.xlsx) *</Label>
                        <Input 
                            id="excel-file"
                            type="file" 
                            accept=".xlsx, .xls"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            O arquivo deve conter as colunas "Código" (ou Termo) e "Nome" (ou Descrição).
                        </p>
                    </div>
                </div>
                
                <div className="flex justify-end pt-4 border-t">
                    <Button 
                        className="bg-indigo-400 hover:bg-indigo-500 text-white" 
                        onClick={handleImport} 
                        disabled={importing}
                    >
                        {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando...</> : <><UploadCloud className="w-4 h-4 mr-2" /> Iniciar Importação</>}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

// ─────────── Manutenção Tab ───────────
function ManutencaoTab() {
    const { toast } = useToast();
    const [loading, setLoading] = React.useState<string | null>(null);
    const [empresas, setEmpresas] = React.useState<Empresa[]>([]);
    const [selectedEmpresa, setSelectedEmpresa] = React.useState<string>("");

    React.useEffect(() => {
        adminApi("GET", undefined, "resource=empresas").then(res => {
            if (res.data) setEmpresas(res.data);
        });
    }, []);

    const handleMaintenanceAction = async (actionId: string, actionName: string) => {
        if (!selectedEmpresa) {
            toast({ title: "Atenção", description: "Selecione uma empresa para aplicar a ação.", variant: "destructive" });
            return;
        }

        setLoading(actionId);
        try {
            const res = await adminApi("POST", { action: actionId, empresaId: selectedEmpresa });
            
            if (res.success) {
                toast({ title: "Ação Concluída", description: `A ação "${actionName}" foi realizada com sucesso na empresa selecionada.` });
            } else {
                toast({ title: "Erro", description: res.error || "Não foi possível concluir a ação.", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Erro", description: "Ocorreu um erro ao conectar com o servidor.", variant: "destructive" });
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-2 text-orange-800 mb-2">
                    <Shield className="w-5 h-5" />
                    <h3 className="font-semibold text-lg">Área de Risco - Selecione a Empresa Alvo</h3>
                </div>
                <p className="text-orange-700 text-sm mb-4">
                    As ações abaixo são destrutivas. Selecione cuidadosamente a empresa na qual deseja executar a limpeza de dados.
                </p>
                <div className="max-w-md">
                    <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
                        <SelectTrigger className="bg-white border-orange-300">
                            <SelectValue placeholder="Selecione a Empresa" />
                        </SelectTrigger>
                        <SelectContent>
                            {empresas.map(emp => (
                                <SelectItem key={emp.id} value={emp.id}>{emp.nome_fantasia}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Zerar Movimentações */}
                <Card className="border-red-100 hover:border-red-200 transition-colors">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-red-700 flex items-center text-lg">
                            <RotateCcw className="w-5 h-5 mr-2" />
                            Zerar Movimentações / Faturamento
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Esta ação excluirá permanentemente TODAS as guias de movimentação geradas no sistema para a empresa selecionada.
                        </p>
                        <p className="text-xs text-red-600/80 font-medium">
                            Aviso: A estrutura da tabela e as configurações do sistema permanecerão intactas. Apenas os registros de dados serão limpos. Esta ação não pode ser desfeita.
                        </p>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button className="w-full bg-red-600 hover:bg-red-700 text-white" disabled={!selectedEmpresa || loading === 'reset_movements'}>
                                    {loading === 'reset_movements' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                    Zerar Movimentações
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Isto apagará permanentemente todos os registros de <b>movimentação e faturamento</b> da empresa selecionada.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleMaintenanceAction('reset_movements', 'Zerar Movimentações')}>Confirmar Exclusão</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardContent>
                </Card>

                {/* Zerar Leituras */}
                <Card className="border-red-100 hover:border-red-200 transition-colors">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-red-700 flex items-center text-lg">
                            <RotateCcw className="w-5 h-5 mr-2" />
                            Zerar Leituras
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Esta ação excluirá permanentemente TODAS as leituras de exames registradas para a empresa selecionada.
                        </p>
                        <p className="text-xs text-red-600/80 font-medium">
                            Aviso: A estrutura da tabela e as configurações do sistema permanecerão intactas. Apenas os registros de dados serão limpos. Esta ação não pode ser desfeita.
                        </p>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button className="w-full bg-red-600 hover:bg-red-700 text-white" disabled={!selectedEmpresa || loading === 'reset_leituras'}>
                                    {loading === 'reset_leituras' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                    Zerar Leituras
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Isto apagará permanentemente todos os registros de <b>leituras de exames</b> da empresa selecionada.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleMaintenanceAction('reset_leituras', 'Zerar Leituras')}>Confirmar Exclusão</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardContent>
                </Card>

                {/* Zerar Exames / Procedimentos */}
                <Card className="border-red-100 hover:border-red-200 transition-colors">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-red-700 flex items-center text-lg">
                            <RotateCcw className="w-5 h-5 mr-2" />
                            Zerar Exames / Procedimentos
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Esta ação excluirá permanentemente TODOS os exames e procedimentos cadastrados no catálogo da empresa.
                        </p>
                        <p className="text-xs text-red-600/80 font-medium">
                            Aviso: A estrutura da tabela e as configurações do sistema permanecerão intactas. Apenas os registros de dados serão limpos. Esta ação não pode ser desfeita.
                        </p>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button className="w-full bg-red-600 hover:bg-red-700 text-white" disabled={!selectedEmpresa || loading === 'reset_exames'}>
                                    {loading === 'reset_exames' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                    Zerar Exames
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Isto apagará permanentemente todo o <b>catálogo de exames e procedimentos</b> da empresa selecionada.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleMaintenanceAction('reset_exames', 'Zerar Exames')}>Confirmar Exclusão</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardContent>
                </Card>

                {/* Zerar Orçamentos */}
                <Card className="border-red-100 hover:border-red-200 transition-colors">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-red-700 flex items-center text-lg">
                            <RotateCcw className="w-5 h-5 mr-2" />
                            Zerar Orçamentos
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Esta ação excluirá permanentemente TODOS os orçamentos e itens vinculados emitidos pela empresa selecionada.
                        </p>
                        <p className="text-xs text-red-600/80 font-medium">
                            Aviso: A estrutura da tabela e as configurações do sistema permanecerão intactas. Apenas os registros de dados serão limpos. Esta ação não pode ser desfeita.
                        </p>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button className="w-full bg-red-600 hover:bg-red-700 text-white" disabled={!selectedEmpresa || loading === 'reset_orcamentos'}>
                                    {loading === 'reset_orcamentos' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                    Zerar Orçamentos
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Isto apagará permanentemente todos os <b>orçamentos emitidos</b> da empresa selecionada.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleMaintenanceAction('reset_orcamentos', 'Zerar Orçamentos')}>Confirmar Exclusão</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ─────────── Especialidades Tab ───────────
function EspecialidadesTab() {
    const { toast } = useToast();
    const [especialidades, setEspecialidades] = React.useState<{id: string, nome: string}[]>([]);
    const [novaEspecialidade, setNovaEspecialidade] = React.useState("");
    const [loading, setLoading] = React.useState(true);
    const [adding, setAdding] = React.useState(false);
    const [importing, setImporting] = React.useState(false);

    const fetchEspecialidades = React.useCallback(async () => {
        setLoading(true);
        try {
            const supabase = createClient();
            const { data, error } = await supabase.from('pet_especialidades').select('*').order('nome');
            if (error) {
                if (error.code === '42P01') {
                    setEspecialidades([
                        { id: '1', nome: 'Cardiologia' },
                        { id: '2', nome: 'Clínica Médica' }
                    ]);
                }
            } else {
                setEspecialidades(data || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchEspecialidades();
    }, [fetchEspecialidades]);

    const handleAdd = async () => {
        if (!novaEspecialidade.trim()) return;
        setAdding(true);
        
        try {
            const supabase = createClient();
            const { error } = await supabase.from('pet_especialidades').insert([{ nome: novaEspecialidade }]);
            
            if (error) {
                if (error.code === '42P01') {
                     setEspecialidades(prev => [...prev, { id: Date.now().toString(), nome: novaEspecialidade }]);
                } else {
                     throw error;
                }
            } else {
                fetchEspecialidades();
            }
            
            toast({ title: "Sucesso", description: "Especialidade adicionada com sucesso." });
            setNovaEspecialidade("");
        } catch (e: any) {
            toast({ title: "Erro", description: "Não foi possível adicionar. Verifique se a tabela existe.", variant: "destructive" });
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (id: string, nome: string) => {
        try {
            const supabase = createClient();
            const { error } = await supabase.from('pet_especialidades').delete().eq('id', id);
            
            if (error) {
                 if (error.code === '42P01') {
                     setEspecialidades(prev => prev.filter(e => e.id !== id));
                 } else {
                     throw error;
                 }
            } else {
                 fetchEspecialidades();
            }
            toast({ title: "Sucesso", description: `Especialidade ${nome} removida.` });
        } catch (e: any) {
            toast({ title: "Erro", description: "Não foi possível remover.", variant: "destructive" });
        }
    };

    const handleExport = (format: 'xlsx' | 'csv') => {
        if (especialidades.length === 0) {
            toast({ title: "Atenção", description: "Não há especialidades para exportar." });
            return;
        }

        const dataToExport = especialidades.map(esp => ({ Especialidade: esp.nome }));
        const worksheet = xlsx.utils.json_to_sheet(dataToExport);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "Especialidades");

        if (format === 'csv') {
            const csvData = xlsx.utils.sheet_to_csv(worksheet);
            const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", "especialidades.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            xlsx.writeFile(workbook, "especialidades.xlsx");
        }
    };

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        try {
            const buffer = await file.arrayBuffer();
            const workbook = xlsx.read(buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const data: any[] = xlsx.utils.sheet_to_json(sheet);

            if (data.length === 0) {
                toast({ title: "Erro", description: "O arquivo está vazio.", variant: "destructive" });
                return;
            }

            const supabase = createClient();
            let count = 0;

            for (const row of data) {
                const nome = row['Especialidade'] || row['especialidade'] || row['Nome'] || row['nome'];
                if (nome && typeof nome === 'string' && nome.trim() !== '') {
                    // Try to insert, ignoring duplicates
                    const { error } = await supabase.from('pet_especialidades').insert([{ nome: nome.trim() }]);
                    if (!error) count++;
                }
            }

            if (count > 0) {
                toast({ title: "Importação Concluída", description: `${count} especialidades foram importadas com sucesso.` });
                fetchEspecialidades();
            } else {
                toast({ title: "Aviso", description: "Nenhuma especialidade nova foi importada (podem ser duplicadas)." });
            }
        } catch (error) {
            toast({ title: "Erro na importação", description: "Falha ao processar o arquivo. Verifique o formato.", variant: "destructive" });
        } finally {
            setImporting(false);
            if (e.target) e.target.value = ''; // Reset file input
        }
    };

    return (
        <Card className="max-w-4xl">
            <CardHeader>
                <CardTitle className="text-xl">Especialidades Médicas</CardTitle>
                <CardDescription>Gerencie as especialidades que aparecerão no cadastro de médicos.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 mb-8 justify-between items-start sm:items-center">
                    <div className="flex gap-2 w-full sm:w-auto flex-1">
                        <Input 
                            placeholder="Nova Especialidade (ex: Neurologia)" 
                            value={novaEspecialidade}
                            onChange={(e) => setNovaEspecialidade(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                            className="max-w-xs"
                        />
                        <Button onClick={handleAdd} disabled={adding || !novaEspecialidade.trim()} className="bg-indigo-500 hover:bg-indigo-600 text-white">
                            {adding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlusCircle className="w-4 h-4 mr-2" />}
                            Adicionar
                        </Button>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                        <input 
                            type="file" 
                            id="import-especialidades" 
                            className="hidden" 
                            accept=".csv, .xlsx, .xls" 
                            onChange={handleImportFile}
                            disabled={importing}
                        />
                        <Button 
                            variant="outline" 
                            onClick={() => document.getElementById('import-especialidades')?.click()}
                            disabled={importing}
                        >
                            {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
                            Importar
                        </Button>
                        
                        <Select onValueChange={(val: 'csv' | 'xlsx') => handleExport(val)}>
                            <SelectTrigger className="w-[140px]">
                                <Download className="w-4 h-4 mr-2" />
                                <SelectValue placeholder="Exportar" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                                <SelectItem value="csv">CSV (.csv)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome da Especialidade</TableHead>
                                <TableHead className="w-24 text-center">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center h-24">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ) : especialidades.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center h-24 text-muted-foreground">
                                        Nenhuma especialidade cadastrada.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                especialidades.map((esp) => (
                                    <TableRow key={esp.id}>
                                        <TableCell className="font-medium">{esp.nome}</TableCell>
                                        <TableCell className="text-center">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => handleDelete(esp.id, esp.nome)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

// ─────────── Auditoria Tab ───────────
function AuditoriaTab() {
    const { toast } = useToast();
    const [loading, setLoading] = React.useState(true);
    const [metrics, setMetrics] = React.useState<any>(null);

    React.useEffect(() => {
        const fetchMetrics = async () => {
            setLoading(true);
            try {
                const res = await adminApi("POST", { action: "get_audit_metrics" });
                if (res.success) {
                    setMetrics(res.metrics);
                } else {
                    toast({ title: "Aviso de Auditoria", description: res.error, variant: "destructive" });
                }
            } catch (error) {
                toast({ title: "Erro", description: "Falha ao buscar métricas.", variant: "destructive" });
            } finally {
                setLoading(false);
            }
        };
        fetchMetrics();
    }, [toast]);

    const formatBytes = (bytes: number) => {
        if (!bytes) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    if (loading) {
        return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    }

    if (!metrics) {
        return (
            <div className="p-8 text-center border border-dashed rounded-xl bg-slate-50">
                <Database className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <h3 className="font-semibold text-slate-700">Métricas Indisponíveis</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto mt-2">
                    A função SQL "get_audit_metrics" não foi encontrada no seu banco de dados. 
                    Por favor, execute o script SQL fornecido pelo suporte para habilitar este painel.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-blue-100 shadow-sm">
                    <CardHeader className="bg-blue-50/50 pb-3 rounded-t-xl border-b border-blue-100">
                        <CardTitle className="flex items-center text-blue-800 text-lg">
                            <Database className="w-5 h-5 mr-2" /> Banco de Dados (Postgres)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-sm text-muted-foreground">Tamanho Total Ocupado</p>
                                <h2 className="text-3xl font-bold text-slate-800">{formatBytes(metrics.total_db_bytes || 0)}</h2>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-muted-foreground">Limite Gratuito: ~500 MB</p>
                                <div className="w-24 h-2 bg-slate-100 rounded-full mt-2 overflow-hidden ml-auto">
                                    <div className="h-full bg-blue-500" style={{ width: `${Math.min(((metrics.total_db_bytes || 0) / (500 * 1024 * 1024)) * 100, 100)}%` }} />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                
                <Card className="border-purple-100 shadow-sm">
                    <CardHeader className="bg-purple-50/50 pb-3 rounded-t-xl border-b border-purple-100">
                        <CardTitle className="flex items-center text-purple-800 text-lg">
                            <HardDrive className="w-5 h-5 mr-2" /> Armazenamento (Storage)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-sm text-muted-foreground">Arquivos e Imagens</p>
                                <h2 className="text-3xl font-bold text-slate-800">{formatBytes(metrics.total_storage_bytes || 0)}</h2>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-muted-foreground">Limite Gratuito: 1 GB</p>
                                <div className="w-24 h-2 bg-slate-100 rounded-full mt-2 overflow-hidden ml-auto">
                                    <div className="h-full bg-purple-500" style={{ width: `${Math.min(((metrics.total_storage_bytes || 0) / (1024 * 1024 * 1024)) * 100, 100)}%` }} />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Consumo por Empresa (Clínica)</CardTitle>
                    <CardDescription>Detalhamento de registros e imagens armazenadas por cada cliente.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Empresa</TableHead>
                                    <TableHead className="text-right">Pets</TableHead>
                                    <TableHead className="text-right">Prontuários</TableHead>
                                    <TableHead className="text-right">Movimentações</TableHead>
                                    <TableHead className="text-right">Usuários</TableHead>
                                    <TableHead className="text-right font-bold text-purple-700">Storage (Imagens)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {metrics.empresas?.sort((a:any, b:any) => b.storage_bytes - a.storage_bytes).map((emp: any) => (
                                    <TableRow key={emp.empresa_id}>
                                        <TableCell className="font-medium">{emp.nome}</TableCell>
                                        <TableCell className="text-right">{emp.pets}</TableCell>
                                        <TableCell className="text-right">{emp.prontuarios}</TableCell>
                                        <TableCell className="text-right">{emp.movimentacoes}</TableCell>
                                        <TableCell className="text-right">{emp.usuarios}</TableCell>
                                        <TableCell className="text-right font-mono font-bold text-purple-700">{formatBytes(emp.storage_bytes)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
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
                <TabsList className="flex flex-wrap justify-start w-full md:w-auto md:inline-flex md:h-10 bg-muted p-1 rounded-lg gap-1 overflow-x-auto">
                    <TabsTrigger value="empresas">
                        <Building2 className="mr-2 h-4 w-4" />Empresas
                    </TabsTrigger>
                    <TabsTrigger value="usuarios">
                        <Users className="mr-2 h-4 w-4" />Usuários
                    </TabsTrigger>
                    <TabsTrigger value="importacoes">
                        <UploadCloud className="mr-2 h-4 w-4" />Importações
                    </TabsTrigger>
                    <TabsTrigger value="manutencao">
                        <Shield className="mr-2 h-4 w-4" />Manutenção
                    </TabsTrigger>
                    <TabsTrigger value="especialidades">
                        <Stethoscope className="mr-2 h-4 w-4" />Especialidades
                    </TabsTrigger>
                    <TabsTrigger value="auditoria">
                        <Activity className="mr-2 h-4 w-4" />Auditoria
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="empresas" className="mt-6">
                    <EmpresasTab />
                </TabsContent>

                <TabsContent value="usuarios" className="mt-6">
                    <UsuariosTab />
                </TabsContent>

                <TabsContent value="importacoes" className="mt-6">
                    <ImportacoesTab />
                </TabsContent>

                <TabsContent value="manutencao" className="mt-6">
                    <ManutencaoTab />
                </TabsContent>

                <TabsContent value="especialidades" className="mt-6">
                    <EspecialidadesTab />
                </TabsContent>
                
                <TabsContent value="auditoria" className="mt-6">
                    <AuditoriaTab />
                </TabsContent>
            </Tabs>
        </>
    );
}
