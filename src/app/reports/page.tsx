"use client";

import * as React from 'react';
import { FileText, Users, Building, Beaker, FileSpreadsheet, Download, Undo2, ArrowUpDown, Stethoscope } from 'lucide-react';

import { PageTitle } from '@/components/layout/page-title';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { useLeituras } from '@/hooks/use-leituras';
import { usePatients } from '@/hooks/use-patients';
import { useHealthPlans } from '@/hooks/use-health-plans';
import { useExams } from '@/hooks/use-exams';
import { useUsers } from '@/hooks/use-user-management';
import { useMedicos } from '@/hooks/use-medicos';
import { useMovement } from '@/hooks/use-movement';
import { format } from 'date-fns';
import { exportToCSV, exportToJSON, exportToTXT, exportToXML, exportToPDF } from '@/lib/export-utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';

// --- Sorting Helpers ---
type SortConfig = {
    key: string;
    direction: 'ascending' | 'descending';
};

function sortData<T extends Record<string, any>>(data: T[], config: SortConfig | null): T[] {
    if (!config) return data;
    return [...data].sort((a, b) => {
        const valA = String(a[config.key] ?? '');
        const valB = String(b[config.key] ?? '');
        if (valA < valB) return config.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return config.direction === 'ascending' ? 1 : -1;
        return 0;
    });
}

// --- Sortable Table Head Component ---
function SortableHead({ label, sortKey, sortConfig, onSort }: {
    label: string;
    sortKey: string;
    sortConfig: SortConfig | null;
    onSort: (key: string) => void;
}) {
    const isActive = sortConfig?.key === sortKey;
    return (
        <TableHead>
            <Button variant="ghost" className="px-1 h-8 -ml-1 font-medium" onClick={() => onSort(sortKey)}>
                {label}
                {isActive
                    ? <span className="ml-1.5 text-xs">{sortConfig?.direction === 'ascending' ? '▲' : '▼'}</span>
                    : <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 opacity-30" />
                }
            </Button>
        </TableHead>
    );
}

export default function ReportsPage() {
    const [activeTab, setActiveTab] = React.useState("patients");

    const { patients, isLoaded: patientsLoaded } = usePatients();
    const { healthPlans, isLoaded: plansLoaded } = useHealthPlans();
    const { exams, isLoaded: examsLoaded } = useExams();
    const { users, isLoaded: usersLoaded } = useUsers();
    const { medicos, isLoaded: medicosLoaded } = useMedicos();
    const { fetchMovimentacoes } = useMovement();
    const { leituras, isLoaded: leiturasLoaded } = useLeituras();

    const [movimentacoes, setMovimentacoes] = React.useState<any[]>([]);
    const [movsLoaded, setMovsLoaded] = React.useState(false);

    // Filter states
    const [filterPlan, setFilterPlan] = React.useState("");
    const [filterName, setFilterName] = React.useState("");
    const [filterMedico, setFilterMedico] = React.useState("");
    const [filterDateFrom, setFilterDateFrom] = React.useState("");
    const [filterDateTo, setFilterDateTo] = React.useState("");

    // Sort state (shared, reset on tab change)
    const [sortConfig, setSortConfig] = React.useState<SortConfig | null>(null);

    const requestSort = (key: string) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    // Reset sort and filters when tab changes
    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        setSortConfig(null);
        setFilterName("");
        setFilterPlan("");
        setFilterMedico("");
        setFilterDateFrom("");
        setFilterDateTo("");
    };

    React.useEffect(() => {
        if (activeTab === 'movements' && !movsLoaded) {
            fetchMovimentacoes().then(data => {
                setMovimentacoes(data);
                setMovsLoaded(true);
            });
        }
    }, [activeTab, movsLoaded, fetchMovimentacoes]);

    // --- Unique medico names for dropdown filters ---
    const uniqueMedicosMovements = React.useMemo(() => {
        const names = movimentacoes.map(m => {
            const med = medicos.find(med => med.id === m.medicoId);
            return med?.name || null;
        }).filter(Boolean) as string[];
        return [...new Set(names)].sort();
    }, [movimentacoes, medicos]);

    const uniqueMedicosLeituras = React.useMemo(() => {
        const names = (leituras || []).map(l => l.medicos?.nome || null).filter(Boolean) as string[];
        return [...new Set(names)].sort();
    }, [leituras]);

    // --- Unique plano names for dropdown filters ---
    const uniquePlanosPatients = React.useMemo(() => {
        const names = patients.map(p => p.healthPlanName || null).filter(Boolean) as string[];
        return [...new Set(names)].sort();
    }, [patients]);

    const uniquePlanosMovements = React.useMemo(() => {
        const names = movimentacoes.map(m => {
            const pac = patients.find(p => p.id === m.pacienteId);
            return pac?.healthPlanName || null;
        }).filter(Boolean) as string[];
        return [...new Set(names)].sort();
    }, [movimentacoes, patients]);

    // --- Date filter helper ---
    const isDateInRange = (dateStr: string) => {
        if (!filterDateFrom && !filterDateTo) return true;
        if (!dateStr) return false;
        // Parse dd/MM/yyyy HH:mm to comparable format
        const parts = dateStr.split(' ')[0].split('/');
        if (parts.length !== 3) return false;
        const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        if (filterDateFrom && isoDate < filterDateFrom) return false;
        if (filterDateTo && isoDate > filterDateTo) return false;
        return true;
    };

    // --- Data getters (filtered) ---
    const getPatientsData = () => {
        let filtered = patients;
        if (filterPlan) filtered = filtered.filter(p => p.healthPlanName === filterPlan);
        return filtered.map(p => ({
            "Nome": p.name,
            "CPF": p.cpf,
            "E-mail": p.email,
            "Telefone": p.telefone || "",
            "Plano de Saúde": p.healthPlanName || "",
            "Matrícula": p.matricula || "",
        }));
    };

    const getPlansData = () => healthPlans.map(hp => ({
        "Nome do Plano": hp.nome,
        "Código ANS": hp.codPlano
    }));

    const getExamsData = () => {
        let filtered = exams;
        if (filterName) filtered = filtered.filter(e => e.name.toLowerCase().includes(filterName.toLowerCase()) || e.idExame?.toLowerCase().includes(filterName.toLowerCase()));
        if (filterPlan) filtered = filtered.filter(e => e.healthPlanName?.toLowerCase().includes(filterPlan.toLowerCase()));
        return filtered.map(e => ({
            "ID-Exame": e.idExame || e.examCode,
            "Nome do Exame": e.name,
            "Tipo": e.type,
            "Plano Associado": e.healthPlanName || "Particular / Sem plano"
        }));
    };

    const getMovementsData = () => {
        let filtered = movimentacoes;
        if (filterMedico) {
            filtered = filtered.filter(m => {
                const med = medicos.find(med => med.id === m.medicoId);
                return med?.name === filterMedico;
            });
        }
        if (filterPlan) {
            filtered = filtered.filter(m => {
                const pac = patients.find(p => p.id === m.pacienteId);
                return pac?.healthPlanName === filterPlan;
            });
        }
        // Build data first then filter by date (date is formatted)
        let result = filtered.map(m => {
            const pac = patients.find(p => p.id === m.pacienteId);
            const med = medicos.find(med => med.id === m.medicoId);
            return {
                "Guia": m.movimentoId,
                "Data": m.data ? format(new Date(m.data), 'dd/MM/yyyy HH:mm') : "",
                "Paciente": pac?.name || "Desconhecido",
                "CPF Paciente": pac?.cpf || "",
                "Plano de Saúde": pac?.healthPlanName || "Particular",
                "Médico": med?.name || "Desconhecido",
                "CRM": med?.crm || "",
                "Qtd Exames": m.exameIds?.length || 0
            };
        });
        if (filterDateFrom || filterDateTo) {
            result = result.filter(m => isDateInRange(m.Data));
        }
        return result;
    };

    const getLeiturasData = () => {
        let filtered = leituras || [];
        if (filterMedico) filtered = filtered.filter(l => l.medicos?.nome === filterMedico);
        if (filterPlan) filtered = filtered.filter(l => l.metadata?.pacienteHealthPlanName?.toLowerCase().includes(filterPlan.toLowerCase()));

        let result = filtered.map(l => ({
            "Cod Leitura": l.cod_leitura,
            "Movimento ID": (l.metadata as any)?.movimentoId || "-",
            "Data Leitura": l.data_leitura ? format(new Date(l.data_leitura), 'dd/MM/yyyy HH:mm') : "",
            "Paciente": l.pacientes?.nome || "Desconhecido",
            "Plano": (l.metadata as any)?.pacienteHealthPlanName || "-",
            "Médico": l.medicos?.nome || "Desconhecido",
            "Usuário Leitor": l.usuarios?.nome || "-"
        }));
        if (filterDateFrom || filterDateTo) {
            result = result.filter(l => isDateInRange(l["Data Leitura"]));
        }
        return result;
    };

    const getMedicosData = () => medicos.map(m => ({
        "Código": m.codMed,
        "Nome": m.name,
        "CRM": m.crm,
        "E-mail": m.email || "",
        "Telefone": m.telefone || ""
    }));

    const getUsersData = () => users.map(u => ({
        "Código": u.numUsuario,
        "Nome": u.nome,
        "E-mail": u.email,
        "Perfil": u.status,
        "Validade": u.dataValidade ? format(new Date(u.dataValidade), 'dd/MM/yyyy') : "Ilimitada",
        "Status": u.empresaId ? "Vinculado" : "Sistema",
        "Data Cadastro": u.dataCadastro ? format(new Date(u.dataCadastro), 'dd/MM/yyyy') : ""
    }));

    // Universal Extractor Component
    const ExportMenu = ({ title, getData, disabled }: { title: string, getData: () => object[], disabled: boolean }) => {
        const handleExport = async (format: 'csv' | 'pdf' | 'json' | 'txt' | 'xml') => {
            const data = getData();
            const safeTitle = title.replace(/\s+/g, '_');
            const filename = `Relatorio_${safeTitle}_${new Date().toISOString().split('T')[0]}`;

            if (format === 'csv') await exportToCSV(filename, data);
            if (format === 'json') await exportToJSON(filename, data);
            if (format === 'txt') await exportToTXT(filename, data);
            if (format === 'xml') await exportToXML(filename, data);
            if (format === 'pdf') await exportToPDF(filename, title.toUpperCase(), data);
        };

        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button disabled={disabled}>
                        <Download className="mr-2 h-4 w-4" /> Exportar Dados
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExport('csv')}>Excel (CSV)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('pdf')}>Formato PDF</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('txt')}>Texto (TXT)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('json')}>Dados JSON</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('xml')}>Estrutura XML</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    };

    // Medico Dropdown Filter Component
    const MedicoDropdownFilter = ({ medicoList }: { medicoList: string[] }) => (
        <Select value={filterMedico || "_all"} onValueChange={v => setFilterMedico(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-full md:w-52">
                <SelectValue placeholder="Filtrar por Médico" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="_all">Todos os Médicos</SelectItem>
                {medicoList.map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );

    // Plano Dropdown Filter Component
    const PlanoDropdownFilter = ({ planoList }: { planoList: string[] }) => (
        <Select value={filterPlan || "_all"} onValueChange={v => setFilterPlan(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-full md:w-52">
                <SelectValue placeholder="Filtrar por Plano" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="_all">Todos os Planos</SelectItem>
                {planoList.map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );

    // Date Range Filter Component
    const DateRangeFilter = () => (
        <>
            <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-full md:w-36" title="Data Inicial" />
            <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-full md:w-36" title="Data Final" />
        </>
    );

    // --- Sorted data memos ---
    const sortedPatientsData = React.useMemo(() => sortData(getPatientsData(), sortConfig), [patients, filterPlan, sortConfig]);
    const sortedPlansData = React.useMemo(() => sortData(getPlansData(), sortConfig), [healthPlans, sortConfig]);
    const sortedExamsData = React.useMemo(() => sortData(getExamsData(), sortConfig), [exams, filterName, filterPlan, sortConfig]);
    const sortedMedicosData = React.useMemo(() => sortData(getMedicosData(), sortConfig), [medicos, sortConfig]);
    const sortedMovementsData = React.useMemo(() => sortData(getMovementsData(), sortConfig), [movimentacoes, patients, medicos, filterMedico, filterPlan, filterDateFrom, filterDateTo, sortConfig]);
    const sortedLeiturasData = React.useMemo(() => sortData(getLeiturasData(), sortConfig), [leituras, filterMedico, filterPlan, filterDateFrom, filterDateTo, sortConfig]);
    const sortedUsersData = React.useMemo(() => sortData(getUsersData(), sortConfig), [users, sortConfig]);

    return (
        <>
            <PageTitle title="Relatórios e Extração de Dados" description="Gere relatórios sintéticos dos diversos módulos nos formatos PDF, TXT, XML e Planilha.">
                <Link href="/" passHref>
                    <Button variant="outline">
                        <Undo2 className="mr-2 h-4 w-4" />
                        Voltar ao Menu
                    </Button>
                </Link>
            </PageTitle>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="grid w-full grid-cols-4 md:grid-cols-7 h-auto md:h-12 mb-4">
                    <TabsTrigger value="patients"><Users className="mr-2 hidden md:block h-4 w-4" />Pacientes</TabsTrigger>
                    <TabsTrigger value="plans"><Building className="mr-2 hidden md:block h-4 w-4" />Planos</TabsTrigger>
                    <TabsTrigger value="exams"><Beaker className="mr-2 hidden md:block h-4 w-4" />Exames</TabsTrigger>
                    <TabsTrigger value="medicos"><Stethoscope className="mr-2 hidden md:block h-4 w-4" />Médicos</TabsTrigger>
                    <TabsTrigger value="movements"><FileText className="mr-2 hidden md:block h-4 w-4" />Emissões</TabsTrigger>
                    <TabsTrigger value="readings"><FileText className="mr-2 hidden md:block h-4 w-4" />Leituras</TabsTrigger>
                    <TabsTrigger value="users"><FileSpreadsheet className="mr-2 hidden md:block h-4 w-4" />Usuários</TabsTrigger>
                </TabsList>

                {/* ====== PACIENTES ====== */}
                <TabsContent value="patients">
                    <Card>
                        <CardHeader className="flex flex-col md:flex-row space-y-2 md:space-y-0 justify-between items-start md:items-center">
                            <div>
                                <CardTitle>Relatório de Pacientes</CardTitle>
                                <CardDescription>Total de {patients.length} pacientes cadastrados.</CardDescription>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <PlanoDropdownFilter planoList={uniquePlanosPatients} />
                                <ExportMenu title="Pacientes" getData={() => sortedPatientsData} disabled={!patientsLoaded || patients.length === 0} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-md max-h-[400px] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <SortableHead label="Nome" sortKey="Nome" sortConfig={sortConfig} onSort={requestSort} />
                                            <SortableHead label="CPF" sortKey="CPF" sortConfig={sortConfig} onSort={requestSort} />
                                            <SortableHead label="Plano de Saúde" sortKey="Plano de Saúde" sortConfig={sortConfig} onSort={requestSort} />
                                            <SortableHead label="Telefone" sortKey="Telefone" sortConfig={sortConfig} onSort={requestSort} />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedPatientsData.slice(0, 50).map((p, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-medium">{p.Nome}</TableCell>
                                                <TableCell>{p.CPF}</TableCell>
                                                <TableCell>{p["Plano de Saúde"] || '-'}</TableCell>
                                                <TableCell>{p.Telefone || '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {sortedPatientsData.length > 50 && <div className="p-4 text-center text-sm text-muted-foreground">E mais registros visíveis na exportação.</div>}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ====== PLANOS ====== */}
                <TabsContent value="plans">
                    <Card>
                        <CardHeader className="flex flex-row space-y-0 justify-between items-center">
                            <div>
                                <CardTitle>Relatório de Planos de Saúde</CardTitle>
                                <CardDescription>Total de {healthPlans.length} planos ativos.</CardDescription>
                            </div>
                            <ExportMenu title="Planos" getData={() => sortedPlansData} disabled={!plansLoaded || healthPlans.length === 0} />
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-md max-h-[400px] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <SortableHead label="Plano" sortKey="Nome do Plano" sortConfig={sortConfig} onSort={requestSort} />
                                            <SortableHead label="Código" sortKey="Código ANS" sortConfig={sortConfig} onSort={requestSort} />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedPlansData.map((hp, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-medium">{hp["Nome do Plano"]}</TableCell>
                                                <TableCell>{hp["Código ANS"]}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ====== EXAMES ====== */}
                <TabsContent value="exams">
                    <Card>
                        <CardHeader className="flex flex-col md:flex-row space-y-2 md:space-y-0 justify-between items-start md:items-center">
                            <div>
                                <CardTitle>Relatório de Exames</CardTitle>
                                <CardDescription>Total de {exams.length} exames cadastrados.</CardDescription>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <Input placeholder="Filtro de Nome/ID" value={filterName} onChange={e => setFilterName(e.target.value)} className="w-full md:w-40" />
                                <Input placeholder="Filtro de Plano" value={filterPlan} onChange={e => setFilterPlan(e.target.value)} className="w-full md:w-40" />
                                <ExportMenu title="Exames" getData={() => sortedExamsData} disabled={!examsLoaded || exams.length === 0} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-md max-h-[400px] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <SortableHead label="ID-Exame" sortKey="ID-Exame" sortConfig={sortConfig} onSort={requestSort} />
                                            <SortableHead label="Nome" sortKey="Nome do Exame" sortConfig={sortConfig} onSort={requestSort} />
                                            <SortableHead label="Plano Associado" sortKey="Plano Associado" sortConfig={sortConfig} onSort={requestSort} />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedExamsData.slice(0, 50).map((e, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-mono">{e["ID-Exame"]}</TableCell>
                                                <TableCell className="font-medium">{e["Nome do Exame"]}</TableCell>
                                                <TableCell>{e["Plano Associado"] || '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {sortedExamsData.length > 50 && <div className="p-4 text-center text-sm text-muted-foreground">E mais registros visíveis na exportação.</div>}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ====== EMISSÕES / MOVEMENTS ====== */}
                <TabsContent value="movements">
                    <Card>
                        <CardHeader className="flex flex-col md:flex-row space-y-2 md:space-y-0 justify-between items-start md:items-center">
                            <div>
                                <CardTitle>Relatório de Guias Emitidas</CardTitle>
                                <CardDescription>Histórico de {movimentacoes.length} emissões do sistema.</CardDescription>
                            </div>
                            <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                <DateRangeFilter />
                                <PlanoDropdownFilter planoList={uniquePlanosMovements} />
                                <MedicoDropdownFilter medicoList={uniqueMedicosMovements} />
                                <ExportMenu title="GuiasEmitidas" getData={() => sortedMovementsData} disabled={!movsLoaded || movimentacoes.length === 0} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-md max-h-[400px] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <SortableHead label="Guia" sortKey="Guia" sortConfig={sortConfig} onSort={requestSort} />
                                            <SortableHead label="Data" sortKey="Data" sortConfig={sortConfig} onSort={requestSort} />
                                            <SortableHead label="Paciente" sortKey="Paciente" sortConfig={sortConfig} onSort={requestSort} />
                                            <SortableHead label="Médico" sortKey="Médico" sortConfig={sortConfig} onSort={requestSort} />
                                            <SortableHead label="Exames" sortKey="Qtd Exames" sortConfig={sortConfig} onSort={requestSort} />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedMovementsData.slice(0, 50).map((m, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-mono">{m.Guia}</TableCell>
                                                <TableCell>{m.Data}</TableCell>
                                                <TableCell className="font-medium">{m.Paciente}</TableCell>
                                                <TableCell>{m.Médico}</TableCell>
                                                <TableCell className="text-right">{m["Qtd Exames"]}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {sortedMovementsData.length > 50 && <div className="p-4 text-center text-sm text-muted-foreground">E mais registros visíveis na exportação.</div>}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ====== LEITURAS ====== */}
                <TabsContent value="readings">
                    <Card>
                        <CardHeader className="flex flex-col md:flex-row space-y-2 md:space-y-0 justify-between items-start md:items-center">
                            <div>
                                <CardTitle>Relatório de Leituras Concluídas</CardTitle>
                                <CardDescription>Histórico de {leituras?.length || 0} recepções de guias.</CardDescription>
                            </div>
                            <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                <DateRangeFilter />
                                <Input placeholder="Filtro Plano..." value={filterPlan} onChange={e => setFilterPlan(e.target.value)} className="w-full md:w-32" />
                                <MedicoDropdownFilter medicoList={uniqueMedicosLeituras} />
                                <ExportMenu title="Leituras" getData={() => sortedLeiturasData} disabled={!leiturasLoaded || !leituras?.length} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-md max-h-[400px] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <SortableHead label="Cod. Leitura" sortKey="Cod Leitura" sortConfig={sortConfig} onSort={requestSort} />
                                            <SortableHead label="Emissão Vinculada" sortKey="Movimento ID" sortConfig={sortConfig} onSort={requestSort} />
                                            <SortableHead label="Data Recebimento" sortKey="Data Leitura" sortConfig={sortConfig} onSort={requestSort} />
                                            <SortableHead label="Plano de Saúde" sortKey="Plano" sortConfig={sortConfig} onSort={requestSort} />
                                            <TableHead>Médico Autor<br /><span className="text-xs text-muted-foreground">Recepção por</span></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedLeiturasData.slice(0, 50).map((l, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-mono">{l["Cod Leitura"]}</TableCell>
                                                <TableCell className="font-mono text-xs">{l["Movimento ID"]}</TableCell>
                                                <TableCell>{l["Data Leitura"]}</TableCell>
                                                <TableCell className="font-medium">{l.Plano}</TableCell>
                                                <TableCell>
                                                    {l.Médico}<br />
                                                    <span className="text-xs text-muted-foreground">{l["Usuário Leitor"]}</span>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {sortedLeiturasData.length > 50 && <div className="p-4 text-center text-sm text-muted-foreground">E mais registros visíveis na exportação.</div>}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ====== MÉDICOS ====== */}
                <TabsContent value="medicos">
                    <Card>
                        <CardHeader className="flex flex-row space-y-0 justify-between items-center">
                            <div>
                                <CardTitle>Relatório de Médicos</CardTitle>
                                <CardDescription>Total de {medicos.length} médicos cadastrados.</CardDescription>
                            </div>
                            <ExportMenu title="Medicos" getData={() => sortedMedicosData} disabled={!medicosLoaded || medicos.length === 0} />
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-md max-h-[400px] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <SortableHead label="Código" sortKey="Código" sortConfig={sortConfig} onSort={requestSort} />
                                            <SortableHead label="Nome" sortKey="Nome" sortConfig={sortConfig} onSort={requestSort} />
                                            <SortableHead label="CRM" sortKey="CRM" sortConfig={sortConfig} onSort={requestSort} />
                                            <SortableHead label="E-mail" sortKey="E-mail" sortConfig={sortConfig} onSort={requestSort} />
                                            <SortableHead label="Telefone" sortKey="Telefone" sortConfig={sortConfig} onSort={requestSort} />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedMedicosData.slice(0, 50).map((m, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-mono text-xs">{m.Código}</TableCell>
                                                <TableCell className="font-medium">{m.Nome}</TableCell>
                                                <TableCell>{m.CRM}</TableCell>
                                                <TableCell>{m["E-mail"] || '-'}</TableCell>
                                                <TableCell>{m.Telefone || '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {sortedMedicosData.length > 50 && <div className="p-4 text-center text-sm text-muted-foreground">E mais registros visíveis na exportação.</div>}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ====== USUÁRIOS ====== */}
                <TabsContent value="users">
                    <Card>
                        <CardHeader className="flex flex-row space-y-0 justify-between items-center">
                            <div>
                                <CardTitle>Relatório de Usuários</CardTitle>
                                <CardDescription>Equipe e acessos do sistema.</CardDescription>
                            </div>
                            <ExportMenu title="Usuarios" getData={() => sortedUsersData} disabled={!usersLoaded || users.length === 0} />
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-md max-h-[400px] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <SortableHead label="Código" sortKey="Código" sortConfig={sortConfig} onSort={requestSort} />
                                            <SortableHead label="Nome" sortKey="Nome" sortConfig={sortConfig} onSort={requestSort} />
                                            <SortableHead label="E-mail" sortKey="E-mail" sortConfig={sortConfig} onSort={requestSort} />
                                            <SortableHead label="Perfil" sortKey="Perfil" sortConfig={sortConfig} onSort={requestSort} />
                                            <SortableHead label="Validade" sortKey="Validade" sortConfig={sortConfig} onSort={requestSort} />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedUsersData.slice(0, 50).map((u, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-mono text-xs">{u.Código}</TableCell>
                                                <TableCell className="font-medium">{u.Nome}</TableCell>
                                                <TableCell>{u["E-mail"]}</TableCell>
                                                <TableCell>{u.Perfil}</TableCell>
                                                <TableCell>{u.Validade}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

            </Tabs>
        </>
    );
}
