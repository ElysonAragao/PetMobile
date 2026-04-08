"use client";

import * as React from 'react';
import { PageTitle } from '@/components/layout/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Undo2, Loader2, FileText, Trash2, Eye, Search, PawPrint, Stethoscope, Printer } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
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

    /**
     * Helpers de Extração de Dados (Padrão PacienteMobile Adaptado)
     * Lida com nomes vindos do Supabase (pets.nome) ou do metadados
     */
    const getCod = (l: Leitura) => l.cod_leitura || l.codLeitura || '';
    const getPetNome = (l: Leitura) => l.pets?.nome || l.petNome || l.pacienteNome || '';
    const getTutorNome = (l: Leitura) => l.pets?.tutor_nome || l.tutorNome || '';
    const getVetNome = (l: Leitura) => l.veterinarios?.nome || l.veterinarioNome || l.medicoNome || '';
    const getMovId = (l: Leitura) => (l.metadata as any)?.movimentoId || l.movimentoId || '';
    const getDataLeitura = (l: Leitura) => l.data_leitura || l.dataLeitura || '';
    const getUsuNome = (l: Leitura) => (l as any).usuarios?.nome || l.usuarioNome || '';
    const getPetEspecie = (l: Leitura) => l.pets?.especie || (l.metadata as any)?.petEspecie || '';
    const getPetRaca = (l: Leitura) => l.pets?.raca || (l.metadata as any)?.petRaca || '';
    const getPlanName = (l: Leitura) => (l.metadata as any)?.petHealthPlanName || (l.metadata as any)?.pacienteHealthPlanName || 'Particular';

    const filteredLeituras = React.useMemo(() => {
        if (!search) return leituras;
        const searchLower = search.toLowerCase();
        return leituras.filter(l =>
            getCod(l).toLowerCase().includes(searchLower) ||
            getPetNome(l).toLowerCase().includes(searchLower) ||
            getTutorNome(l).toLowerCase().includes(searchLower) ||
            getMovId(l).toLowerCase().includes(searchLower)
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
        toast({ title: 'Leitura excluída', description: 'O registro foi removido.' });
        if (selectedLeitura?.id === leituraId) setSelectedLeitura(null);
    };

    const handleViewPdf = (leitura: Leitura) => {
        window.open(
            `/print/${getMovId(leitura)}?tipo=leitura&codLeitura=${getCod(leitura)}&dataLeitura=${encodeURIComponent(getDataLeitura(leitura))}`,
            '_blank'
        );
    };

    if (!isLoaded) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Carregando relatório de leituras...</p>
            </div>
        );
    }

    return (
        <>
            <PageTitle title="Relatório de Leituras Veterinárias" description="Visualize e gerencie todos os atendimentos realizados via QR Code.">
                <Link href="/" passHref><Button variant="outline"><Undo2 className="mr-2 h-4 w-4" />Voltar</Button></Link>
            </PageTitle>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* LISTA DE LEITURAS (Esquerda) */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                            Histórico de Leituras
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{leituras.length} registros</span>
                        </CardTitle>
                        <div className="pt-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Código, pet, tutor ou ID da guia..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {sortedLeituras.length === 0 ? (
                            <div className="text-center py-20 text-muted-foreground"><FileText className="mx-auto h-12 w-12 opacity-20 mb-4" /><p>Nenhum registro encontrado.</p></div>
                        ) : (
                            <ScrollArea className="h-[600px] pr-4">
                                <div className="space-y-3">
                                    {sortedLeituras.map(l => (
                                        <div
                                            key={l.id}
                                            className={`p-4 border rounded-xl cursor-pointer transition-all hover:shadow-md ${selectedLeitura?.id === l.id ? 'border-primary ring-1 ring-primary bg-primary/5' : 'hover:border-primary/40'}`}
                                            onClick={() => setSelectedLeitura(l)}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1">
                                                    <p className="font-bold text-primary flex items-center gap-1"><FileText size={14}/> {getCod(l)}</p>
                                                    <p className="font-semibold text-sm flex items-center gap-1"><PawPrint size={14} className="text-muted-foreground"/> {getPetNome(l)}</p>
                                                    <p className="text-xs text-muted-foreground">Mov: {getMovId(l)} | {new Date(getDataLeitura(l)).toLocaleString('pt-BR')}</p>
                                                </div>
                                                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                                    <Button variant="ghost" size="sm" onClick={() => handleViewPdf(l)}><Eye className="h-4 w-4" /></Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader><AlertDialogTitle>Excluir Registro?</AlertDialogTitle><AlertDialogDescription>Deseja remover a leitura {getCod(l)}? Isso não apagará a guia de origem.</AlertDialogDescription></AlertDialogHeader>
                                                            <AlertDialogFooter><AlertDialogCancel>Não</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(l.id)}>Sim, Excluir</AlertDialogAction></AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </CardContent>
                </Card>

                {/* DETALHES (Direita) */}
                <Card className="sticky top-6">
                    <CardHeader><CardTitle>Detalhes do Atendimento</CardTitle><CardDescription>Informações cruzadas da leitura selecionada.</CardDescription></CardHeader>
                    <CardContent>
                        {selectedLeitura ? (
                            <div className="space-y-6">
                                <div className="bg-muted/40 p-4 rounded-xl border space-y-2">
                                    <div className="flex justify-between font-bold text-primary"><span>{getCod(selectedLeitura)}</span><span>{new Date(getDataLeitura(selectedLeitura)).toLocaleDateString('pt-BR')}</span></div>
                                    <Separator className="bg-primary/10" />
                                    <p className="text-xs text-muted-foreground uppercase font-bold">Lançado por: {getUsuNome(selectedLeitura)}</p>
                                </div>

                                <div>
                                    <h4 className="flex items-center gap-2 font-bold text-sm mb-3 text-gray-700"><PawPrint size={16} /> Animal e Tutor</h4>
                                    <div className="grid grid-cols-2 gap-y-2 text-sm pl-6">
                                        <p><strong>Nome Pet:</strong> {getPetNome(selectedLeitura)}</p>
                                        <p><strong>Espécie:</strong> {getPetEspecie(selectedLeitura)}</p>
                                        <p><strong>Raça:</strong> {getPetRaca(selectedLeitura)}</p>
                                        <p><strong>Tutor:</strong> {getTutorNome(selectedLeitura)}</p>
                                        <p className="col-span-2 text-xs font-medium text-primary bg-primary/5 p-1 rounded inline-block mt-1">Plano: {getPlanName(selectedLeitura)}</p>
                                    </div>
                                </div>

                                <Separator />

                                <div>
                                    <h4 className="flex items-center gap-2 font-bold text-sm mb-3 text-gray-700"><Stethoscope size={16} /> Médico Veterinário</h4>
                                    <div className="text-sm pl-6"><p><strong>Nome:</strong> {getVetNome(selectedLeitura)}</p></div>
                                </div>

                                <Separator />

                                <div>
                                    <h4 className="font-bold text-sm mb-3 text-gray-700">Exames Realizados</h4>
                                    <div className="grid grid-cols-1 gap-2 pl-6">
                                        {(selectedLeitura.exames || []).map((ex, i) => (
                                            <div key={i} className="text-sm bg-muted/20 p-2 rounded border border-dashed text-muted-foreground italic">
                                                • <span className="font-bold text-foreground not-italic">{ex.examCode}</span> - {ex.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <Button onClick={() => handleViewPdf(selectedLeitura)} className="w-full h-12 text-lg font-bold shadow-lg" variant="default">
                                    <Printer className="mr-2 h-5 w-5" /> Gerar PDF / Imprimir
                                </Button>
                            </div>
                        ) : (
                            <div className="text-center py-32 text-muted-foreground flex flex-col items-center gap-4">
                                <Eye className="h-16 w-16 opacity-10" />
                                <p>Selecione uma leitura na lista ao lado para ver os detalhes.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
