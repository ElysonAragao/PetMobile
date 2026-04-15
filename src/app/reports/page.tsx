"use client";

import * as React from 'react';
import { FileText, PawPrint, Building, Beaker, FileSpreadsheet, Download, Undo2, ArrowUpDown, Stethoscope, Users, CheckCircle2, Clock, DollarSign, Filter, Search } from 'lucide-react';

import { PageTitle } from '@/components/layout/page-title';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { useLeituras } from '@/hooks/use-leituras';
import { usePets } from '@/hooks/use-pets';
import { useExams } from '@/hooks/use-exams';
import { useHealthPlans } from '@/hooks/use-health-plans';
import { useUsers } from '@/hooks/use-user-management';
import { useMovement } from '@/hooks/use-movement';
import { useFaturamento } from '@/hooks/use-faturamento';
import { format } from 'date-fns';
import { exportToCSV, exportToJSON, exportToTXT, exportToXML, exportToPDF } from '@/lib/export-utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';

type SortConfig = { key: string; direction: 'ascending' | 'descending'; };
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

function SortableHead({ label, sortKey, sortConfig, onSort }: { label: string; sortKey: string; sortConfig: SortConfig | null; onSort: (key: string) => void; }) {
    const isActive = sortConfig?.key === sortKey;
    return (
        <TableHead>
            <Button variant="ghost" className="px-1 h-8 -ml-1 font-medium" onClick={() => onSort(sortKey)}>
                {label}
                {isActive ? <span className="ml-1.5 text-xs">{sortConfig?.direction === 'ascending' ? '▲' : '▼'}</span> : <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 opacity-30" />}
            </Button>
        </TableHead>
    );
}

export default function ReportsPage() {
    const [activeTab, setActiveTab] = React.useState("pets");

    const { pets, isLoaded: petsLoaded } = usePets();
    const { exams, isLoaded: examsLoaded } = useExams();
    const { users, isLoaded: usersLoaded } = useUsers();
    const { healthPlans, isLoaded: plansLoaded } = useHealthPlans();
    const { fetchMovimentacoes } = useMovement();
    const { leituras, isLoaded: leiturasLoaded } = useLeituras();

    const [movimentacoes, setMovimentacoes] = React.useState<any[]>([]);
    const [movsLoaded, setMovsLoaded] = React.useState(false);

    const { data: faturamento, fetchFaturamento, loading: faturamentoLoading } = useFaturamento();
    const [fatLoaded, setFatLoaded] = React.useState(false);

    const [filterName, setFilterName] = React.useState("");
    const [filterDateFrom, setFilterDateFrom] = React.useState("");
    const [filterDateTo, setFilterDateTo] = React.useState("");
    const [filterVetId, setFilterVetId] = React.useState<string>("all");
    const [filterCodLeitura, setFilterCodLeitura] = React.useState("");
    const [billingSubTab, setBillingSubTab] = React.useState<'leituras' | 'guias'>('leituras');
    const [billingViewMode, setBillingViewMode] = React.useState<'resumida' | 'detalhada'>('resumida');
    const [sortConfig, setSortConfig] = React.useState<SortConfig | null>(null);

    // Lista de veterinários para filtros
    const veterinarios = React.useMemo(() => {
        return (users || []).filter(u => u.status === 'MedicoVet' || u.status === 'MedicoVet Geral' || u.status === 'Administrador');
    }, [users]);

    const requestSort = (key: string) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig?.key === key && sortConfig.direction === 'ascending') direction = 'descending';
        setSortConfig({ key, direction });
    };

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        setSortConfig(null);
        setFilterName("");
        setFilterDateFrom("");
        setFilterDateTo("");
        setFilterVetId("all");
        setFilterCodLeitura("");
        setBillingSubTab('leituras');
        setBillingViewMode('resumida');
    };

    React.useEffect(() => {
        if (activeTab === 'movements' && !movsLoaded) {
            fetchMovimentacoes().then(data => { setMovimentacoes(data); setMovsLoaded(true); });
        }
        // Carregar faturamento para abas que mostram totais financeiros
        if (['billing', 'readings', 'movements'].includes(activeTab) && !fatLoaded) {
            fetchFaturamento().then(() => setFatLoaded(true));
        }
    }, [activeTab, movsLoaded, fatLoaded, fetchMovimentacoes, fetchFaturamento]);

    const isDateInRange = (dateStr: string) => {
        if (!filterDateFrom && !filterDateTo) return true;
        if (!dateStr) return false;
        
        let dateObj: Date;
        if (dateStr.includes('/')) {
            const parts = dateStr.split(' ')[0].split('/');
            dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        } else {
            dateObj = new Date(dateStr);
        }
        
        const isoDate = dateObj.toISOString().split('T')[0];
        if (filterDateFrom && isoDate < filterDateFrom) return false;
        if (filterDateTo && isoDate > filterDateTo) return false;
        return true;
    };

    // Coletores de Dados (Padrão para Importação)
    const getPetsData = () => {
        return pets.map(p => ({
            "Nome_Pet": p.nome,
            "Código_Pet": p.codPet || "",
            "Tutor_Nome": p.tutorNome,
            "Tutor_CPF": p.tutorCpf,
            "Tutor_Telefone": p.tutorTelefone || "",
            "Espécie": p.especie,
            "Raça": p.raca || "-",
            "Sexo": p.sexo,
            "Nascimento": p.dataNascimento || "",
            "Plano_Saúde": p.healthPlanName || "Particular",
            "Matricula": p.matricula || ""
        }));
    };

    const getExamsData = () => {
        return exams.map(e => ({
            "Código_Exame": e.examCode,
            "ID_Empresa": e.idExame || "",
            "Nome_Exame": e.name,
            "Tipo": e.type,
            "Descrição": e.description,
            "Urgência": e.isUrgency ? "Sim" : "Não",
            "Plano_Restrito": e.healthPlanName || "Todos"
        }));
    };

    const getPlansData = () => {
        return healthPlans.map(p => ({
            "Código_Plano": p.codPlano,
            "Nome_Plano": p.nome,
            "ID_Interno": p.id
        }));
    };

    const getVetsData = () => {
        return (users || []).filter(u => u.status === 'MedicoVet' || u.status === 'MedicoVet Geral').map(v => ({
            "Nome_Veterinário": v.nome,
            "CRMV_UF": v.crmvUf || "-",
            "Email": v.email,
            "Telefone": v.telefone || "-",
            "Perfil": v.status === 'MedicoVet Geral' ? 'Geral' : 'Especialista',
            "Validade": v.dataValidade ? format(new Date(v.dataValidade + 'T00:00:00'), 'dd/MM/yyyy') : "-"
        }));
    };

    const getMovementsData = () => {
        let result = movimentacoes.map(m => {
            const pet = pets.find(p => p.id === m.petId);
            const vet = users.find(u => u.id === m.veterinarioId);
            return {
                "ID_Guia": m.movimentoId,
                "Data_Emissão": m.data ? format(new Date(m.data), 'dd/MM/yyyy HH:mm') : "",
                "Nome_Pet": pet?.nome || "Desconhecido",
                "Código_Pet": pet?.codPet || "",
                "Tutor": pet?.tutorNome || "",
                "Veterinário_Nome": vet?.nome || "Desconhecido",
                "Veterinário_Id": m.veterinarioId || "",
                "Qtd_Exames": m.exameIds?.length || 0
            };
        });
        if (filterDateFrom || filterDateTo) result = result.filter(r => isDateInRange(r.Data_Emissão));
        if (filterVetId !== "all") result = result.filter(r => r.Veterinário_Id === filterVetId);
        return result;
    };

    const getLeiturasData = () => {
        return (leituras || []).map((l: any) => {
            // In-memory join with pets and users arrays
            const pet = (pets || []).find(p => p.id === l.paciente_id);
            const medico = (users || []).find(u => u.id === l.medico_id);
            const operador = (users || []).find(u => u.id === l.usuario_id);

            const petName = pet?.nome || l.metadata?.pacienteNome || "Desconhecido";
            const tutorName = pet?.tutorNome || "-";
            const vetName = medico?.nome || l.metadata?.medicoNome || "Desconhecido";
            const operadorName = operador?.nome || "-";
            const movimentoId = l.metadata?.movimentoId || "-";

            const dateStr = l.data_leitura || l.created_at || "";
            let formattedDate = "-";
            if (dateStr) {
                try {
                    const d = new Date(dateStr);
                    if (!isNaN(d.getTime())) {
                        formattedDate = format(d, 'dd/MM/yyyy HH:mm');
                    }
                } catch (e) {
                    formattedDate = dateStr;
                }
            }

            return {
                "Código_Leitura": l.cod_leitura || "-",
                "Data_Atendimento": formattedDate,
                "ID_Guia_Original": movimentoId,
                "Nome_Pet": petName,
                "Tutor_Nome": tutorName,
                "Veterinário_Nome": vetName,
                "Veterinário_Id": l.medico_id || "",
                "Operador": operadorName,
                "Qtd_Exames": l.metadata?.exames?.length || 0
            };
        }).filter((r: any) => isDateInRange(r.Data_Atendimento))
          .filter((r: any) => filterVetId === "all" || r.Veterinário_Id === filterVetId);
    };

    const getBillingData = () => {
        let result = faturamento.map(item => ({
            "Data_Hora": item.data_faturamento ? format(new Date(item.data_faturamento), 'dd/MM/yyyy HH:mm') : "",
            "Código_Leitura": item.cod_leitura || "-",
            "Código_Guia": item.movimento_codigo || "-",
            "Médico_Veterinário": item.medico_nome,
            "Médico_Id": item.medicovet_id || "",
            "Exame_Realizado": item.exame_nome,
            "Plano_Saúde": item.plano_nome,
            "Preço_Aplicado": item.preco_aplicado
        }));
        if (filterDateFrom || filterDateTo) result = result.filter(r => isDateInRange(r.Data_Hora));
        if (filterVetId !== "all") result = result.filter(r => r.Médico_Id === filterVetId);
        return result;
    };

    // Fat. Leituras: somente registros COM leitura realizada
    const getBillingLeituraData = () => {
        let data = getBillingData().filter(r => r.Código_Leitura !== '-');
        if (filterCodLeitura) data = data.filter(r => r.Código_Leitura.toLowerCase().includes(filterCodLeitura.toLowerCase()));
        return data;
    };

    // Fat. Guias: TODOS os registros (faturamento potencial)
    const getBillingGuiaData = () => {
        let data = getBillingData();
        if (filterCodLeitura) data = data.filter(r => (r.Código_Guia || '').toLowerCase().includes(filterCodLeitura.toLowerCase()));
        return data;
    };

    // Dados ativos conforme sub-aba selecionada
    const getActiveBillingData = () => billingSubTab === 'leituras' ? getBillingLeituraData() : getBillingGuiaData();

    // Agrupamento genérico por código (inclui array de exames para visão detalhada)
    const getBillingGrouped = (data: ReturnType<typeof getBillingData>, groupByField: string) => {
        const groups: Record<string, { key: string; cod_leitura: string; cod_guia: string; data: string; medico: string; total: number; qtd_exames: number; exames: any[] }> = {};
        data.forEach(item => {
            const key = (item as any)[groupByField] || '-';
            if (!groups[key]) {
                groups[key] = { key, cod_leitura: item.Código_Leitura, cod_guia: item.Código_Guia, data: item.Data_Hora, medico: item.Médico_Veterinário || '-', total: 0, qtd_exames: 0, exames: [] };
            }
            groups[key].total += Number(item.Preço_Aplicado) || 0;
            groups[key].qtd_exames += 1;
            groups[key].exames.push(item);
        });
        return Object.values(groups);
    };

    const getActiveBillingGrouped = () => {
        const groupField = billingSubTab === 'leituras' ? 'Código_Leitura' : 'Código_Guia';
        return getBillingGrouped(getActiveBillingData(), groupField);
    };

    // Nome do arquivo de exportação com data
    const getBillingExportTitle = () => {
        const dateStr = format(new Date(), 'dd-MM-yyyy');
        return billingSubTab === 'leituras' ? `Faturamento_Leitura_${dateStr}` : `Faturamento_Guias_${dateStr}`;
    };

    // Dados para exportação com linha de resumo ao final
    const getBillingExportData = () => {
        const data = getActiveBillingData();
        const total = data.reduce((acc, curr) => acc + (Number(curr.Preço_Aplicado) || 0), 0);
        const emptyRow: any = {};
        if (data.length > 0) Object.keys(data[0]).forEach(k => { emptyRow[k] = ''; });
        return [
            ...data,
            emptyRow,
            { ...emptyRow, "Data_Hora": "TOTAL DO RELATÓRIO", "Exame_Realizado": `${data.length} exame(s)`, "Preço_Aplicado": total }
        ];
    };
    const getAllUsersData = () => {
        return (users || []).map(u => ({
            "Nome_Usuário": u.nome,
            "Email": u.email,
            "Telefone": u.telefone || "-",
            "Perfil": u.status,
            "Status": "Ativo"
        }));
    };

    const ExportMenu = ({ title, getData, disabled }: { title: string, getData: () => object[], disabled: boolean }) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild><Button disabled={disabled} variant="default" className="bg-primary hover:bg-primary/90 shadow-md transition-all"><Download className="mr-2 h-4 w-4" /> Exportar Dados</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => exportToCSV(`Relatorio_${title}`, getData())} className="cursor-pointer">Excel (CSV)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportToPDF(`Relatorio_${title}`, title.toUpperCase(), getData())} className="cursor-pointer">Documento (PDF)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportToTXT(`Relatorio_${title}`, getData())} className="cursor-pointer">Texto (TXT)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportToJSON(`Relatorio_${title}`, getData())} className="cursor-pointer">Dados (JSON)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportToXML(`Relatorio_${title}`, getData())} className="cursor-pointer">Intercâmbio (XML)</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    const SummaryCards = ({ totalValue, qtyExams, qtyMain, mainLabel }: { totalValue: number, qtyExams: number, qtyMain: number, mainLabel: string }) => (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-green-50 border-green-200 shadow-sm">
                <CardHeader className="pb-2"><CardDescription className="text-green-700 font-bold uppercase text-[10px]">Total Período</CardDescription></CardHeader>
                <CardContent><p className="text-2xl font-bold text-green-700">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
                </p></CardContent>
            </Card>
            <Card className="shadow-sm">
                <CardHeader className="pb-2"><CardDescription className="uppercase text-[10px]">Qtd. Exames</CardDescription></CardHeader>
                <CardContent><p className="text-2xl font-bold">{qtyExams}</p></CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-200 shadow-sm">
                <CardHeader className="pb-2"><CardDescription className="text-blue-700 font-bold uppercase text-[10px]">{mainLabel}</CardDescription></CardHeader>
                <CardContent><p className="text-2xl font-bold text-blue-700">{qtyMain}</p></CardContent>
            </Card>
        </div>
    );

    return (
        <div className="pb-10">
            <PageTitle title="Relatórios e Auditoria" description="Extração de dados clínica e exportação de movimentações v2.9">
                <Link href="/" passHref><Button variant="outline"><Undo2 className="mr-2 h-4 w-4" />Voltar ao Menu</Button></Link>
            </PageTitle>


            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <div className="overflow-x-auto pb-2 mb-6">
                    <TabsList className="inline-flex h-12 items-center justify-start rounded-none border-b bg-transparent p-0 w-full min-w-max gap-6">
                        <TabsTrigger value="pets" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 font-semibold text-muted-foreground data-[state=active]:text-primary transition-all">Pets/Tutor</TabsTrigger>
                        <TabsTrigger value="exams" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 font-semibold text-muted-foreground data-[state=active]:text-primary transition-all">Exames</TabsTrigger>
                        <TabsTrigger value="plans" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 font-semibold text-muted-foreground data-[state=active]:text-primary transition-all">Convênios</TabsTrigger>
                        <TabsTrigger value="vets" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 font-semibold text-muted-foreground data-[state=active]:text-primary transition-all">Corpo Clínico</TabsTrigger>
                        <TabsTrigger value="movements" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 font-semibold text-muted-foreground data-[state=active]:text-primary transition-all">Guias Emitidas</TabsTrigger>
                        <TabsTrigger value="readings" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 font-semibold text-muted-foreground data-[state=active]:text-primary transition-all">Leituras Realizadas</TabsTrigger>
                        <TabsTrigger value="billing" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 font-semibold text-muted-foreground data-[state=active]:text-primary transition-all">Faturamento</TabsTrigger>
                        <TabsTrigger value="users" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 font-semibold text-muted-foreground data-[state=active]:text-primary transition-all">Usuários da Empresa</TabsTrigger>
                    </TabsList>
                </div>

                {/* ABA PETS */}
                <TabsContent value="pets">
                    <Card>
                        <CardHeader className="flex flex-row justify-between items-center">
                            <div><CardTitle>Base de Pacientes</CardTitle><CardDescription>{pets.length} animais registrados.</CardDescription></div>
                            <ExportMenu title="Pets_Tutores" getData={getPetsData} disabled={!petsLoaded} />
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <SortableHead label="Pet" sortKey="Nome_Pet" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Código" sortKey="Código_Pet" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Tutor" sortKey="Tutor_Nome" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Telefone" sortKey="Tutor_Telefone" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Espécie" sortKey="Espécie" sortConfig={sortConfig} onSort={requestSort} />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortData(getPetsData(), sortConfig).slice(0, 50).map((p, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-bold text-primary">{p.Nome_Pet}</TableCell>
                                            <TableCell className="font-mono text-xs">{p.Código_Pet}</TableCell>
                                            <TableCell>{p.Tutor_Nome}</TableCell>
                                            <TableCell className="text-sm">{p.Tutor_Telefone || "-"}</TableCell>
                                            <TableCell>{p.Espécie} ({p.Raça})</TableCell>
                                        </TableRow>
                                    ))}
                                    {getPetsData().length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Nenhum pet encontrado.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ABA EXAMES */}
                <TabsContent value="exams">
                    <Card>
                        <CardHeader className="flex flex-row justify-between items-center">
                            <div><CardTitle>Catálogo de Exames</CardTitle><CardDescription>{exams.length} tipos de exames cadastrados.</CardDescription></div>
                            <ExportMenu title="Exames" getData={getExamsData} disabled={!examsLoaded} />
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <SortableHead label="Código" sortKey="Código_Exame" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Nome" sortKey="Nome_Exame" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Tipo" sortKey="Tipo" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Urgência" sortKey="Urgência" sortConfig={sortConfig} onSort={requestSort} />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortData(getExamsData(), sortConfig).map((e, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-mono text-xs">{e.Código_Exame}</TableCell>
                                            <TableCell className="font-bold">{e.Nome_Exame}</TableCell>
                                            <TableCell>{e.Tipo}</TableCell>
                                            <TableCell>{e.Urgência === "Sim" ? <span className="text-red-500 font-bold italic">Sim</span> : "Não"}</TableCell>
                                        </TableRow>
                                    ))}
                                    {getExamsData().length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Nenhum exame encontrado.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ABA CONVÊNIOS */}
                <TabsContent value="plans">
                    <Card>
                        <CardHeader className="flex flex-row justify-between items-center">
                            <div><CardTitle>Planos e Convênios</CardTitle><CardDescription>{healthPlans.length} convênios ativos.</CardDescription></div>
                            <ExportMenu title="Convenios" getData={getPlansData} disabled={!plansLoaded} />
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <SortableHead label="Código" sortKey="Código_Plano" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Nome do Plano" sortKey="Nome_Plano" sortConfig={sortConfig} onSort={requestSort} />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortData(getPlansData(), sortConfig).map((p, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-mono text-xs font-bold">{p.Código_Plano}</TableCell>
                                            <TableCell>{p.Nome_Plano}</TableCell>
                                        </TableRow>
                                    ))}
                                    {getPlansData().length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-10 text-muted-foreground">Nenhum convênio registrado.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ABA CORPO CLÍNICO */}
                <TabsContent value="vets">
                    <Card>
                        <CardHeader className="flex flex-row justify-between items-center">
                            <div><CardTitle>Corpo Clínico</CardTitle><CardDescription>Médicos Veterinários vinculados.</CardDescription></div>
                             <ExportMenu title="Corpo_Clinico" getData={getVetsData} disabled={!usersLoaded} />
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <SortableHead label="Nome" sortKey="Nome_Veterinário" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="CRMV/UF" sortKey="CRMV_UF" sortConfig={sortConfig} onSort={requestSort} />
                                        <TableHead>Telefone</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Perfil</TableHead>
                                        <SortableHead label="Validade" sortKey="Validade" sortConfig={sortConfig} onSort={requestSort} />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortData(getVetsData(), sortConfig).map((v, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-bold">{v.Nome_Veterinário}</TableCell>
                                            <TableCell>{v.CRMV_UF}</TableCell>
                                            <TableCell className="text-xs">{v.Telefone}</TableCell>
                                            <TableCell className="text-xs">{v.Email}</TableCell>
                                            <TableCell>{v.Perfil}</TableCell>
                                            <TableCell className="text-xs font-mono">{v.Validade}</TableCell>
                                        </TableRow>
                                    ))}
                                    {getVetsData().length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum profissional listado.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ABA GUIAS EMITIDAS */}
                <TabsContent value="movements">
                    <Card>
                        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div><CardTitle>Histórico de Guias Emitidas</CardTitle><CardDescription>Auditoria de solicitações enviadas.</CardDescription></div>
                            <div className="flex flex-wrap gap-2 items-center">
                                <Select value={filterVetId} onValueChange={setFilterVetId}>
                                    <SelectTrigger className="w-[200px] h-9">
                                        <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                                        <SelectValue placeholder="Filtrar Veterinário" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos os Veterinários</SelectItem>
                                        {veterinarios.map(v => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-36 h-9" />
                                <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-36 h-9" />
                                <ExportMenu title="Guias_Emitidas" getData={getMovementsData} disabled={!movsLoaded} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <SummaryCards 
                                totalValue={getBillingGuiaData().reduce((acc, curr) => acc + (Number(curr.Preço_Aplicado) || 0), 0)}
                                qtyExams={getMovementsData().reduce((acc, curr) => acc + (Number(curr.Qtd_Exames) || 0), 0)}
                                qtyMain={getMovementsData().length}
                                mainLabel="Guias"
                            />
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <SortableHead label="Nº Guia" sortKey="ID_Guia" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Data" sortKey="Data_Emissão" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Pet" sortKey="Nome_Pet" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Tutor" sortKey="Tutor" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Veterinário" sortKey="Veterinário_Nome" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Exames" sortKey="Qtd_Exames" sortConfig={sortConfig} onSort={requestSort} />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortData(getMovementsData(), sortConfig).slice(0, 100).map((m, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-mono text-xs">{m.ID_Guia}</TableCell>
                                            <TableCell className="text-xs">{m.Data_Emissão}</TableCell>
                                            <TableCell className="font-bold">{m.Nome_Pet}</TableCell>
                                            <TableCell className="text-sm">{m.Tutor}</TableCell>
                                            <TableCell>{m.Veterinário_Nome}</TableCell>
                                            <TableCell className="text-center font-mono">{m.Qtd_Exames}</TableCell>
                                        </TableRow>
                                    ))}
                                    {getMovementsData().length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhuma guia encontrada para o filtro selecionado.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ABA LEITURAS REALIZADAS */}
                <TabsContent value="readings">
                    <Card>
                        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div><CardTitle>Leituras e Atendimentos</CardTitle><CardDescription>{getLeiturasData().length} registros de processamento de exames.</CardDescription></div>
                            <div className="flex flex-wrap gap-2 items-center">
                                <Select value={filterVetId} onValueChange={setFilterVetId}>
                                    <SelectTrigger className="w-[200px] h-9">
                                        <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                                        <SelectValue placeholder="Filtrar Veterinário" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos os Veterinários</SelectItem>
                                        {veterinarios.map(v => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-36 h-9" />
                                <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-36 h-9" />
                                <ExportMenu title="Leituras_Realizadas" getData={getLeiturasData} disabled={!leiturasLoaded} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <SummaryCards 
                                totalValue={getBillingLeituraData().reduce((acc, curr) => acc + (Number(curr.Preço_Aplicado) || 0), 0)}
                                qtyExams={getLeiturasData().reduce((acc, curr) => acc + (Number(curr.Qtd_Exames) || 0), 0)}
                                qtyMain={getLeiturasData().length}
                                mainLabel="Leituras"
                            />
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <SortableHead label="Cod Leitura" sortKey="Código_Leitura" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Data" sortKey="Data_Atendimento" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Guia Orig." sortKey="ID_Guia_Original" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Pet" sortKey="Nome_Pet" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Tutor" sortKey="Tutor_Nome" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Veterinário" sortKey="Veterinário_Nome" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Operador" sortKey="Operador" sortConfig={sortConfig} onSort={requestSort} />
                                        <TableHead className="text-center">Exames</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortData(getLeiturasData(), sortConfig).slice(0, 100).map((l, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-mono text-xs text-blue-600 font-bold">{l.Código_Leitura}</TableCell>
                                            <TableCell className="text-xs">{l.Data_Atendimento}</TableCell>
                                            <TableCell className="font-mono text-xs">{l.ID_Guia_Original}</TableCell>
                                            <TableCell className="font-bold">{l.Nome_Pet}</TableCell>
                                            <TableCell className="text-sm">{l.Tutor_Nome}</TableCell>
                                            <TableCell>{l.Veterinário_Nome}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{l.Operador}</TableCell>
                                            <TableCell className="text-center font-mono">{l.Qtd_Exames}</TableCell>
                                        </TableRow>
                                    ))}
                                    {getLeiturasData().length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Nenhum atendimento registrado.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ABA FATURAMENTO */}
                <TabsContent value="billing">
                    <Card>
                        <CardHeader className="flex flex-col gap-4">
                            {/* Título e Exportar */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <CardTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-600"/> Faturamento e Produtividade</CardTitle>
                                    <CardDescription>
                                        {billingSubTab === 'leituras'
                                            ? 'Faturamento efetivo — somente leituras confirmadas.'
                                            : 'Faturamento potencial — todas as guias emitidas.'}
                                        {filterVetId !== 'all' && ` — ${veterinarios.find(v => v.id === filterVetId)?.nome || ''}`}
                                    </CardDescription>
                                </div>
                                <ExportMenu title={getBillingExportTitle()} getData={getBillingExportData} disabled={faturamentoLoading} />
                            </div>

                            {/* Controles: Sub-abas + Filtros */}
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex rounded-lg border overflow-hidden shadow-sm">
                                    <button className={`px-4 py-2 text-sm font-medium transition-colors ${billingSubTab === 'leituras' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                                        onClick={() => { setBillingSubTab('leituras'); setFilterCodLeitura(''); setSortConfig(null); }}
                                    >Fat. Leituras</button>
                                    <button className={`px-4 py-2 text-sm font-medium transition-colors ${billingSubTab === 'guias' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                                        onClick={() => { setBillingSubTab('guias'); setFilterCodLeitura(''); setSortConfig(null); }}
                                    >Fat. Guias</button>
                                </div>

                                <Select value={filterVetId} onValueChange={v => { setFilterVetId(v); setBillingViewMode('resumida'); }}>
                                    <SelectTrigger className="w-[200px] h-9">
                                        <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                                        <SelectValue placeholder="Filtrar Veterinário" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos os Veterinários</SelectItem>
                                        {veterinarios.map(v => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
                                    </SelectContent>
                                </Select>

                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input placeholder={billingSubTab === 'leituras' ? 'Buscar Cód. Leitura...' : 'Buscar Cód. Guia...'}
                                        value={filterCodLeitura} onChange={e => setFilterCodLeitura(e.target.value)} className="w-[180px] h-9 pl-8" />
                                </div>

                                <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-36 h-9" />
                                <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-36 h-9" />

                                {filterVetId !== "all" && (
                                    <div className="flex rounded-lg border overflow-hidden shadow-sm">
                                        <button className={`px-3 py-1.5 text-xs font-medium transition-colors ${billingViewMode === 'resumida' ? 'bg-blue-600 text-white' : 'bg-background hover:bg-muted'}`}
                                            onClick={() => setBillingViewMode('resumida')}>Resumida</button>
                                        <button className={`px-3 py-1.5 text-xs font-medium transition-colors ${billingViewMode === 'detalhada' ? 'bg-blue-600 text-white' : 'bg-background hover:bg-muted'}`}
                                            onClick={() => setBillingViewMode('detalhada')}>Detalhada</button>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {/* KPI Cards */}
                            <SummaryCards 
                                totalValue={getActiveBillingData().reduce((acc, curr) => acc + (Number(curr.Preço_Aplicado) || 0), 0)}
                                qtyExams={getActiveBillingData().length}
                                qtyMain={getActiveBillingGrouped().length}
                                mainLabel={billingSubTab === 'leituras' ? 'Leituras' : 'Guias'}
                            />

                            {/* Tabela */}
                            {filterVetId !== "all" ? (
                                <div className="rounded-md border">
                                    <div className="bg-blue-50 border-b p-3 text-sm text-blue-700 flex items-center gap-2">
                                        <Stethoscope className="h-4 w-4" />
                                        <span>
                                            {billingViewMode === 'resumida'
                                                ? <>Visão <strong>resumida</strong> por {billingSubTab === 'leituras' ? 'Leitura' : 'Guia'} — valor total de cada atendimento.</>
                                                : <>Visão <strong>detalhada</strong> — cada exame de cada {billingSubTab === 'leituras' ? 'Leitura' : 'Guia'}.</>
                                            }
                                        </span>
                                    </div>

                                    {billingViewMode === 'resumida' ? (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>#</TableHead>
                                                    <TableHead>Veterinário</TableHead>
                                                    <TableHead>{billingSubTab === 'leituras' ? 'Cód. Leitura' : 'Cód. Guia'}</TableHead>
                                                    <TableHead>{billingSubTab === 'leituras' ? 'Cód. Guia' : 'Cód. Leitura'}</TableHead>
                                                    <TableHead>Data</TableHead>
                                                    <TableHead className="text-center">Qtd. Exames</TableHead>
                                                    <TableHead>Valor Total</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {getActiveBillingGrouped().map((group, i) => (
                                                    <TableRow key={i} className="hover:bg-blue-50/30">
                                                        <TableCell className="text-xs text-muted-foreground font-mono">{i + 1}</TableCell>
                                                        <TableCell className="font-medium">{group.medico}</TableCell>
                                                        <TableCell className="font-mono text-xs text-blue-600 font-bold">{billingSubTab === 'leituras' ? group.cod_leitura : group.cod_guia}</TableCell>
                                                        <TableCell className="font-mono text-xs">{billingSubTab === 'leituras' ? group.cod_guia : group.cod_leitura}</TableCell>
                                                        <TableCell className="text-xs">{group.data}</TableCell>
                                                        <TableCell className="text-center font-mono">{group.qtd_exames}</TableCell>
                                                        <TableCell className="font-bold text-green-700 text-base">
                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(group.total)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {getActiveBillingGrouped().length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum registro para o filtro selecionado.</TableCell></TableRow>}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        /* Visão Detalhada — cada exame agrupado sob seu Código */
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>{billingSubTab === 'leituras' ? 'Cód. Leitura' : 'Cód. Guia'}</TableHead>
                                                    <TableHead>Veterinário</TableHead>
                                                    <TableHead>Data</TableHead>
                                                    <TableHead>Exame</TableHead>
                                                    <TableHead>Plano</TableHead>
                                                    <TableHead>Valor</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {getActiveBillingGrouped().map((group, gi) => (
                                                    <React.Fragment key={gi}>
                                                        {group.exames.map((exam: any, ei: number) => (
                                                            <TableRow key={`${gi}-${ei}`} className={ei === 0 ? 'border-t-2 border-blue-200' : ''}>
                                                                {ei === 0 && (
                                                                    <TableCell rowSpan={group.exames.length} className="font-mono text-xs text-blue-600 font-bold align-top border-r bg-blue-50/30">
                                                                        {billingSubTab === 'leituras' ? group.cod_leitura : group.cod_guia}
                                                                        <div className="text-[10px] text-green-700 font-bold mt-1">
                                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(group.total)}
                                                                        </div>
                                                                        <div className="text-[10px] text-muted-foreground mt-0.5">{group.qtd_exames} exame(s)</div>
                                                                    </TableCell>
                                                                )}
                                                                <TableCell className="font-medium text-sm">{exam.Médico_Veterinário}</TableCell>
                                                                <TableCell className="text-xs">{exam.Data_Hora}</TableCell>
                                                                <TableCell className="text-xs">{exam.Exame_Realizado}</TableCell>
                                                                <TableCell><span className="text-xs px-2 py-0.5 rounded-full bg-slate-100">{exam.Plano_Saúde}</span></TableCell>
                                                                <TableCell className="font-bold text-green-700">
                                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(exam.Preço_Aplicado))}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </React.Fragment>
                                                ))}
                                                {getActiveBillingGrouped().length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum registro para o filtro selecionado.</TableCell></TableRow>}
                                            </TableBody>
                                        </Table>
                                    )}
                                </div>
                            ) : (
                                /* MODO GERAL (sem vet selecionado) — tabela detalhada completa */
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <SortableHead label="Data" sortKey="Data_Hora" sortConfig={sortConfig} onSort={requestSort} />
                                                <SortableHead label={billingSubTab === 'leituras' ? 'Cód. Leitura' : 'Cód. Guia'} sortKey={billingSubTab === 'leituras' ? 'Código_Leitura' : 'Código_Guia'} sortConfig={sortConfig} onSort={requestSort} />
                                                <SortableHead label="Veterinário" sortKey="Médico_Veterinário" sortConfig={sortConfig} onSort={requestSort} />
                                                <SortableHead label="Exame" sortKey="Exame_Realizado" sortConfig={sortConfig} onSort={requestSort} />
                                                <SortableHead label="Plano" sortKey="Plano_Saúde" sortConfig={sortConfig} onSort={requestSort} />
                                                <SortableHead label="Valor" sortKey="Preço_Aplicado" sortConfig={sortConfig} onSort={requestSort} />
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {sortData(getActiveBillingData(), sortConfig).map((item, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="text-xs">{item.Data_Hora}</TableCell>
                                                    <TableCell className="font-mono text-xs text-blue-600 font-bold">{billingSubTab === 'leituras' ? item.Código_Leitura : item.Código_Guia}</TableCell>
                                                    <TableCell className="font-medium">{item.Médico_Veterinário}</TableCell>
                                                    <TableCell className="text-xs">{item.Exame_Realizado}</TableCell>
                                                    <TableCell><span className="text-xs px-2 py-0.5 rounded-full bg-slate-100">{item.Plano_Saúde}</span></TableCell>
                                                    <TableCell className="font-bold text-green-700">
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.Preço_Aplicado))}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {getActiveBillingData().length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum registro de faturamento para o filtro selecionado.</TableCell></TableRow>}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ABA USUÁRIOS DA EMPRESA */}
                <TabsContent value="users">
                    <Card>
                        <CardHeader className="flex flex-row justify-between items-center">
                            <div><CardTitle>Usuários da Empresa</CardTitle><CardDescription>Todos os colaboradores com acesso ao sistema.</CardDescription></div>
                             <ExportMenu title="Usuarios_Empresa" getData={getAllUsersData} disabled={!usersLoaded} />
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <SortableHead label="Nome" sortKey="Nome_Usuário" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="E-mail" sortKey="Email" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Perfil" sortKey="Perfil" sortConfig={sortConfig} onSort={requestSort} />
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortData(getAllUsersData(), sortConfig).map((u, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-bold">{u.Nome_Usuário}</TableCell>
                                            <TableCell className="text-sm">{u.Email}</TableCell>
                                            <TableCell>{u.Perfil}</TableCell>
                                            <TableCell><span className="flex items-center gap-1.5 text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full w-min"><CheckCircle2 size={12}/> Ativo</span></TableCell>
                                        </TableRow>
                                    ))}
                                    {getAllUsersData().length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Nenhum usuário encontrado.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
