"use client";

import * as React from 'react';
import { FileText, PawPrint, Building, Beaker, FileSpreadsheet, Download, Undo2, ArrowUpDown, Stethoscope, Users, CheckCircle2, Clock } from 'lucide-react';

import { PageTitle } from '@/components/layout/page-title';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { useLeituras } from '@/hooks/use-leituras';
import { usePets } from '@/hooks/use-pets';
import { useExams } from '@/hooks/use-exams';
import { useUsers } from '@/hooks/use-user-management';
import { useMovement } from '@/hooks/use-movement';
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
    const { fetchMovimentacoes } = useMovement();
    const { leituras, isLoaded: leiturasLoaded } = useLeituras();

    const [movimentacoes, setMovimentacoes] = React.useState<any[]>([]);
    const [movsLoaded, setMovsLoaded] = React.useState(false);

    const [filterPlan, setFilterPlan] = React.useState("");
    const [filterName, setFilterName] = React.useState("");
    const [filterVet, setFilterVet] = React.useState("");
    const [filterDateFrom, setFilterDateFrom] = React.useState("");
    const [filterDateTo, setFilterDateTo] = React.useState("");
    const [sortConfig, setSortConfig] = React.useState<SortConfig | null>(null);

    const requestSort = (key: string) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig?.key === key && sortConfig.direction === 'ascending') direction = 'descending';
        setSortConfig({ key, direction });
    };

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        setSortConfig(null);
        setFilterName("");
        setFilterPlan("");
        setFilterVet("");
        setFilterDateFrom("");
        setFilterDateTo("");
    };

    React.useEffect(() => {
        if (activeTab === 'movements' && !movsLoaded) {
            fetchMovimentacoes().then(data => { setMovimentacoes(data); setMovsLoaded(true); });
        }
    }, [activeTab, movsLoaded, fetchMovimentacoes]);

    const uniqueVets = React.useMemo(() => {
        const names = (users || []).filter(u => u.status === 'MedicoVet' || u.status === 'MedicoVet Geral').map(u => u.nome);
        return [...new Set(names)].sort();
    }, [users]);

    const isDateInRange = (dateStr: string) => {
        if (!filterDateFrom && !filterDateTo) return true;
        if (!dateStr) return false;
        const parts = dateStr.split(' ')[0].split('/');
        const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        if (filterDateFrom && isoDate < filterDateFrom) return false;
        if (filterDateTo && isoDate > filterDateTo) return false;
        return true;
    };

    // Coletores de Dados
    const getPetsData = () => {
        let filtered = pets;
        if (filterPlan && filterPlan !== "_all") filtered = filtered.filter(p => p.healthPlanName === filterPlan);
        return filtered.map(p => ({
            "Nome Pet": p.nome,
            "Tutor": p.tutorNome,
            "Telefone": p.tutorTelefone || "",
            "Espécie": p.especie,
            "Raça": p.raca || "-",
            "Código": p.codPet || ""
        }));
    };

    const getMovementsData = () => {
        let result = movimentacoes.map(m => {
            // FIX: use petId and veterinarioId as mapped by useMovement hook
            const pet = pets.find(p => p.id === m.petId);
            const vet = users.find(u => u.id === m.veterinarioId);
            return {
                "Guia": m.movimentoId,
                "Data": m.data ? format(new Date(m.data), 'dd/MM/yyyy HH:mm') : "",
                "Pet": pet?.nome || "Desconhecido",
                "Tutor": pet?.tutorNome || "",
                "Veterinário": vet?.nome || "Desconhecido",
                "Qtd Exames": m.exameIds?.length || 0
            };
        });
        if (filterVet) result = result.filter(r => r.Veterinário === filterVet);
        if (filterDateFrom || filterDateTo) result = result.filter(r => isDateInRange(r.Data));
        return result;
    };

    const getLeiturasData = () => {
        let result = (leituras || []).map((l: any) => {
            const petName = l.pets?.nome || l.metadata?.pacienteNome || "Desconhecido";
            const tutorName = l.pets?.tutor_nome || l.metadata?.pacienteNome || ""; // Use pet name as fallback if tutor missing
            const vetName = l.medicos?.nome || l.metadata?.medicoNome || "Desconhecido";
            const movimentoId = l.metadata?.movimentoId || "-";

            return {
                "Cod Leitura": l.cod_leitura,
                "Guia Original": movimentoId,
                "Data Atendimento": l.data_leitura ? format(new Date(l.data_leitura), 'dd/MM/yyyy HH:mm') : "",
                "Pet": petName,
                "Tutor": tutorName,
                "Veterinário": vetName
            };
        });
        if (filterDateFrom || filterDateTo) result = result.filter(r => isDateInRange(r["Data Atendimento"]));
        return result;
    };

    const getVetsData = () => {
        return (users || []).filter(u => u.status === 'MedicoVet' || u.status === 'MedicoVet Geral').map(v => ({
            "Nome": v.nome,
            "CRMV/UF": v.crmvUf || "-",
            "E-mail": v.email,
            "Status": "Ativo"
        }));
    };

    const ExportMenu = ({ title, getData, disabled }: { title: string, getData: () => object[], disabled: boolean }) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild><Button disabled={disabled}><Download className="mr-2 h-4 w-4" /> Exportar</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportToCSV(`Relatorio_${title}`, getData())}>Excel (CSV)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportToPDF(`Relatorio_${title}`, title.toUpperCase(), getData())}>PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportToJSON(`Relatorio_${title}`, getData())}>JSON</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    return (
        <div className="pb-10">
            <PageTitle title="Relatórios e Auditoria" description="Extração de dados clínica e exportação de movimentações.">
                <Link href="/" passHref><Button variant="outline"><Undo2 className="mr-2 h-4 w-4" />Voltar ao Menu</Button></Link>
            </PageTitle>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="grid w-full grid-cols-4 h-12 mb-6">
                    <TabsTrigger value="pets"><PawPrint className="mr-2 h-4 w-4" />Pets/Tutores</TabsTrigger>
                    <TabsTrigger value="movements"><FileText className="mr-2 h-4 w-4" />Guias Emitidas</TabsTrigger>
                    <TabsTrigger value="readings"><CheckCircle2 className="mr-2 h-4 w-4" />Atendimentos</TabsTrigger>
                    <TabsTrigger value="vets"><Stethoscope className="mr-2 h-4 w-4" />Equipe Vet</TabsTrigger>
                </TabsList>

                {/* ABA PETS */}
                <TabsContent value="pets">
                    <Card>
                        <CardHeader className="flex flex-row justify-between items-center">
                            <div><CardTitle>Base de Pacientes</CardTitle><CardDescription>{pets.length} animais registrados.</CardDescription></div>
                            <div className="flex gap-2">
                                <ExportMenu title="Pets" getData={getPetsData} disabled={!petsLoaded} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <SortableHead label="Pet" sortKey="Nome Pet" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Tutor" sortKey="Tutor" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Telefone" sortKey="Telefone" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Espécie" sortKey="Espécie" sortConfig={sortConfig} onSort={requestSort} />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortData(getPetsData(), sortConfig).slice(0, 50).map((p, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-bold text-primary">{p["Nome Pet"]}</TableCell>
                                            <TableCell>{p.Tutor}</TableCell>
                                            <TableCell>{p.Telefone}</TableCell>
                                            <TableCell>{p.Espécie} ({p["Raça"]})</TableCell>
                                        </TableRow>
                                    ))}
                                    {getPetsData().length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Nenhum pet encontrado.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ABA EMISSÕES */}
                <TabsContent value="movements">
                    <Card>
                        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div><CardTitle>Histórico de Emissões</CardTitle><CardDescription>Solicitações de exames geradas.</CardDescription></div>
                            <div className="flex flex-wrap gap-2">
                                <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-36" />
                                <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-36" />
                                <ExportMenu title="Emissoes" getData={getMovementsData} disabled={!movsLoaded} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <SortableHead label="Guia ID" sortKey="Guia" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Data" sortKey="Data" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Pet" sortKey="Pet" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Veterinário" sortKey="Veterinário" sortConfig={sortConfig} onSort={requestSort} />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortData(getMovementsData(), sortConfig).slice(0, 50).map((m, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-mono text-xs">{m.Guia}</TableCell>
                                            <TableCell>{m.Data}</TableCell>
                                            <TableCell className="font-bold">{m.Pet}</TableCell>
                                            <TableCell>{m.Veterinário}</TableCell>
                                        </TableRow>
                                    ))}
                                    {getMovementsData().length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Nenhuma guia encontrada.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ABA ATENDIMENTOS (LEITURAS) */}
                <TabsContent value="readings">
                    <Card>
                        <CardHeader className="flex flex-row justify-between items-center">
                            <div><CardTitle>Atendimentos Realizados (Leituras)</CardTitle><CardDescription>Registros de entrada de exames.</CardDescription></div>
                            <ExportMenu title="Atendimentos" getData={getLeiturasData} disabled={!leiturasLoaded} />
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <SortableHead label="Cod Leitura" sortKey="Cod Leitura" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Data" sortKey="Data Atendimento" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Pet" sortKey="Pet" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="Guia Orig." sortKey="Guia Original" sortConfig={sortConfig} onSort={requestSort} />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortData(getLeiturasData(), sortConfig).slice(0, 50).map((l, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-mono text-xs text-blue-600 font-bold">{l["Cod Leitura"]}</TableCell>
                                            <TableCell>{l["Data Atendimento"]}</TableCell>
                                            <TableCell className="font-bold">{l.Pet}</TableCell>
                                            <TableCell className="font-mono text-xs">{l["Guia Original"]}</TableCell>
                                        </TableRow>
                                    ))}
                                    {getLeiturasData().length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Nenhum atendimento registrado.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ABA EQUIPE VET */}
                <TabsContent value="vets">
                    <Card>
                        <CardHeader className="flex flex-row justify-between items-center">
                            <div><CardTitle>Equipe Veterinária</CardTitle><CardDescription>Profissionais vinculados à clínica.</CardDescription></div>
                             <ExportMenu title="Equipe" getData={getVetsData} disabled={!usersLoaded} />
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <SortableHead label="Nome" sortKey="Nome" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="CRMV/UF" sortKey="CRMV/UF" sortConfig={sortConfig} onSort={requestSort} />
                                        <SortableHead label="E-mail" sortKey="E-mail" sortConfig={sortConfig} onSort={requestSort} />
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortData(getVetsData(), sortConfig).map((v, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-bold">{v.Nome}</TableCell>
                                            <TableCell>{v["CRMV/UF"]}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{v["E-mail"]}</TableCell>
                                            <TableCell><span className="flex items-center gap-1.5 text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full w-min"><CheckCircle2 size={12}/> Ativo</span></TableCell>
                                        </TableRow>
                                    ))}
                                    {getVetsData().length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Nenhum profissional listado.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
