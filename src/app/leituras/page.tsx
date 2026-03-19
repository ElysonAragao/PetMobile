"use client";

import * as React from 'react';
import { PageTitle } from '@/components/layout/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Undo2, Loader2, FileText, Trash2, Eye, Search } from 'lucide-react';
import { useLeituras } from '@/hooks/use-leituras';
import { Leitura } from '@/lib/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function LeiturasPage() {
    const { leituras, deleteLeitura, isLoaded } = useLeituras();
    const { toast } = useToast();
    const [search, setSearch] = React.useState('');
    const [selectedLeitura, setSelectedLeitura] = React.useState<Leitura | null>(null);

    // Helper to get display values from either snake_case (Supabase) or camelCase fields
    const getCod = (l: Leitura) => l.cod_leitura || l.codLeitura || '';
    const getPacNome = (l: Leitura) => l.pacientes?.nome || l.pacienteNome || '';
    const getMedNome = (l: Leitura) => l.medicos?.nome || l.medicoNome || '';
    const getMovId = (l: Leitura) => (l.metadata as any)?.movimentoId || l.movimentoId || '';
    const getDataLeitura = (l: Leitura) => l.data_leitura || l.dataLeitura || '';
    const getUsuNome = (l: Leitura) => l.usuarios?.nome || l.usuarioNome || '';
    const getPacCpf = (l: Leitura) => l.pacientes?.cpf || l.pacienteCpf || '';
    const getPacTel = (l: Leitura) => l.pacientes?.telefone || l.pacienteTelefone || '';
    const getPlanName = (l: Leitura) => (l.metadata as any)?.pacienteHealthPlanName || l.pacienteHealthPlanName || '';
    const getPlanCode = (l: Leitura) => (l.metadata as any)?.pacienteHealthPlanCode || l.pacienteHealthPlanCode || '';
    const getMatricula = (l: Leitura) => l.pacientes?.matricula || l.pacienteMatricula || '';
    const getMedCrm = (l: Leitura) => l.medicos?.crm_uf || l.medicoCrm || '';
    const getPacIdade = (l: Leitura) => l.pacientes?.idade || (l.metadata as any)?.pacienteIdade || '';
    const getPacGenero = (l: Leitura) => l.pacientes?.genero || (l.metadata as any)?.pacienteGenero || '';

    const filteredLeituras = React.useMemo(() => {
        if (!search) return leituras;
        const searchLower = search.toLowerCase();
        return leituras.filter(l =>
            getCod(l).toLowerCase().includes(searchLower) ||
            getPacNome(l).toLowerCase().includes(searchLower) ||
            getMovId(l).toLowerCase().includes(searchLower) ||
            getMedNome(l).toLowerCase().includes(searchLower)
        );
    }, [leituras, search]);

    const sortedLeituras = React.useMemo(() => {
        return [...filteredLeituras].sort((a, b) => {
            const codA = getCod(a);
            const codB = getCod(b);
            return codB.localeCompare(codA);
        });
    }, [filteredLeituras]);

    const handleDelete = async (leituraId: string) => {
        await deleteLeitura(leituraId);
        toast({ title: 'Leitura excluída', description: 'O registro de leitura foi removido.' });
        if (selectedLeitura?.id === leituraId) {
            setSelectedLeitura(null);
        }
    };

    const handleViewPdf = (leitura: Leitura) => {
        window.open(
            `/print/${getMovId(leitura)}?tipo=leitura&codLeitura=${getCod(leitura)}&dataLeitura=${encodeURIComponent(getDataLeitura(leitura))}`,
            '_blank'
        );
    };

    if (!isLoaded) {
        return (
            <>
                <PageTitle title="Relatório de Leituras" description="Visualize todas as leituras de QR Code realizadas." />
                <div className="flex items-center justify-center text-muted-foreground gap-2">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <p>Carregando leituras...</p>
                </div>
            </>
        );
    }

    return (
        <>
            <PageTitle title="Relatório de Leituras" description="Visualize todas as leituras de QR Code realizadas no sistema.">
                <Link href="/" passHref>
                    <Button variant="outline">
                        <Undo2 className="mr-2 h-4 w-4" />
                        Voltar ao Menu
                    </Button>
                </Link>
            </PageTitle>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Lista de Leituras */}
                <Card>
                    <CardHeader>
                        <CardTitle>Leituras Realizadas ({leituras.length})</CardTitle>
                        <CardDescription>
                            Clique em uma leitura para visualizar os detalhes.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Filtrar por código, paciente, médico ou movimentação..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-10"
                                />
                            </div>

                            {sortedLeituras.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <FileText className="mx-auto h-12 w-12" />
                                    <p className="mt-4">
                                        {search ? 'Nenhuma leitura encontrada para o filtro.' : 'Nenhuma leitura registrada ainda.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                                    {sortedLeituras.map(l => (
                                        <div
                                            key={l.id}
                                            className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-primary/50 hover:bg-muted/50 ${selectedLeitura?.id === l.id ? 'border-primary bg-primary/5' : ''}`}
                                            onClick={() => setSelectedLeitura(l)}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-bold text-sm text-primary">{getCod(l)}</p>
                                                    <p className="text-sm font-medium">{getPacNome(l)}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Mov: {getMovId(l)} | {getDataLeitura(l) ? new Date(getDataLeitura(l)).toLocaleString('pt-BR') : '-'}
                                                    </p>
                                                </div>
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => { e.stopPropagation(); handleViewPdf(l); }}
                                                        title="Gerar PDF"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-destructive hover:text-destructive"
                                                                onClick={(e) => e.stopPropagation()}
                                                                title="Excluir"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Excluir Leitura</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Tem certeza que deseja excluir a leitura <strong>{getCod(l)}</strong>? Esta ação não pode ser desfeita.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDelete(l.id)}>
                                                                    Excluir
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Detalhes da Leitura Selecionada */}
                <Card>
                    <CardHeader>
                        <CardTitle>Detalhes da Leitura</CardTitle>
                        <CardDescription>
                            Selecione uma leitura na lista para ver os detalhes completos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {selectedLeitura ? (
                            <div className="space-y-4">
                                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm font-bold text-primary">{getCod(selectedLeitura)}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {getDataLeitura(selectedLeitura) ? new Date(getDataLeitura(selectedLeitura)).toLocaleString('pt-BR') : '-'}
                                        </p>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Movimentação: {getMovId(selectedLeitura)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Lido por: {getUsuNome(selectedLeitura)}
                                    </p>
                                </div>

                                <Separator />

                                <div>
                                    <h4 className="font-semibold text-sm mb-2">Paciente</h4>
                                    <div className="text-sm space-y-1 pl-4">
                                        <p><strong>Nome:</strong> {getPacNome(selectedLeitura)}</p>
                                        <p><strong>CPF:</strong> {getPacCpf(selectedLeitura)}</p>
                                        <p><strong>Telefone:</strong> {getPacTel(selectedLeitura)}</p>
                                        <p><strong>Plano:</strong> {getPlanName(selectedLeitura)} ({getPlanCode(selectedLeitura)})</p>
                                        <p><strong>Matrícula:</strong> {getMatricula(selectedLeitura) || 'N/A'}</p>
                                        <p><strong>Idade:</strong> {getPacIdade(selectedLeitura) || '-'}</p>
                                        <p><strong>Gênero:</strong> {getPacGenero(selectedLeitura) || '-'}</p>
                                    </div>
                                </div>

                                <Separator />

                                <div>
                                    <h4 className="font-semibold text-sm mb-2">Médico</h4>
                                    <div className="text-sm space-y-1 pl-4">
                                        <p><strong>Nome:</strong> Dr(a). {getMedNome(selectedLeitura)}</p>
                                        <p><strong>CRM:</strong> {getMedCrm(selectedLeitura)}</p>
                                    </div>
                                </div>

                                <Separator />

                                <div>
                                    <h4 className="font-semibold text-sm mb-2">Exames ({selectedLeitura.exames?.length || 0})</h4>
                                    <div className="grid grid-cols-2 gap-1 pl-4">
                                        {(selectedLeitura.exames || []).map((exam, idx) => (
                                            <p key={idx} className="text-sm">
                                                • <strong>{exam.examCode}</strong> - {exam.name}
                                            </p>
                                        ))}
                                    </div>
                                </div>

                                <Separator />

                                <Button onClick={() => handleViewPdf(selectedLeitura)} className="w-full">
                                    <FileText className="mr-2 h-4 w-4" />
                                    Gerar PDF desta Leitura
                                </Button>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                <FileText className="mx-auto h-12 w-12" />
                                <p className="mt-4">Selecione uma leitura para ver os detalhes.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
