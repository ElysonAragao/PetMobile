"use client";

import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Beaker, Loader2, AlertTriangle, Printer, Info, PawPrint, Undo2, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, isAfter, startOfDay } from 'date-fns';

function PrintOrcamentoContent() {
    const { id } = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const origin = searchParams.get('origin');
    
    const [orcamento, setOrcamento] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [showExitDialog, setShowExitDialog] = React.useState(false);

    React.useEffect(() => {
        async function loadData() {
            if (!id) return;
            try {
                // Tenta carregar do localStorage
                const cachedRaw = localStorage.getItem(`print-orcamento-${id}`);
                if (cachedRaw) {
                    const cached = JSON.parse(cachedRaw);
                    setOrcamento(cached);
                } else {
                    throw new Error("Orçamento não encontrado na memória local.");
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [id]);

    const handlePrint = () => window.print();
    const handleClose = () => {
        setShowExitDialog(true);
    };

    const confirmExit = (action: 'new' | 'stay') => {
        if (action === 'stay') {
            setShowExitDialog(false);
            return;
        }
        
        try { localStorage.removeItem(`print-orcamento-${id}`); } catch (e) {}
        
        if (origin === 'scan') {
            router.push('/orcamento/scan');
        } else if (origin === 'novo') {
            router.push('/orcamento/novo');
        } else {
            router.push('/orcamento');
        }
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
    if (error || !orcamento) return <div className="p-10 text-center text-red-500"><AlertTriangle className="mx-auto mb-4" /> Erro: {error || 'Dados não encontrados'}</div>;

    const titulo = origin === 'scan' ? "LEITURA DO ORÇAMENTO" : "ORÇAMENTO DE SERVIÇOS / MATERIAIS";
    const subTitulo = origin === 'scan' 
        ? "Comprovante de verificação e leitura de orçamento."
        : "Estimativa de valores para exames, procedimentos e produtos médicos.";
        
    const isVencido = isAfter(startOfDay(new Date()), startOfDay(new Date(orcamento.validade)));

    return (
        <div className="bg-white text-black max-w-4xl mx-auto p-8 print-container font-sans">
            <header className="flex justify-between items-center mb-4 no-print border-b pb-4">
                <h1 className="text-xl font-bold text-primary flex items-center gap-2"><PawPrint className="w-6 h-6" /> PetMobile</h1>
                <div className="flex gap-3">
                    <Button onClick={handlePrint} className="font-bold text-base bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all">
                        <Printer className="mr-2 h-5 w-5" /> Imprimir / PDF
                    </Button>
                    <Button onClick={handleClose} className="font-bold text-base border-2 hover:bg-gray-50 transition-all font-sans tracking-wide" variant="outline">
                        <Undo2 className="mr-2 h-5 w-5" /> VOLTAR
                    </Button>
                </div>
            </header>

            <div className="no-print my-6">
                <Alert variant="default" className="text-left"><Info className="h-4 w-4" /><AlertTitle>Como Salvar ou Enviar?</AlertTitle><AlertDescription>Escolha "Salvar como PDF" na janela de impressão para salvar no seu dispositivo.</AlertDescription></Alert>
            </div>

            <h1 className="text-center text-2xl font-black mb-1 uppercase tracking-tight">{titulo}</h1>
            <p className="text-center text-[9pt] text-gray-500 mb-6 italic">{subTitulo}</p>

            <section className="flex justify-between items-end mb-2 border-b-2 border-black pb-3 pt-2">
                <div className="space-y-0.5">
                    <div className="text-[10pt]">
                        <strong>Data de Emissão:</strong> {format(new Date(orcamento.dataEmissao), 'dd/MM/yyyy')}
                    </div>
                    <div className={`text-[10pt] ${origin === 'scan' ? (isVencido ? 'text-red-600' : 'text-emerald-600') : 'text-red-600'}`}>
                        <strong>Validade:</strong> {format(new Date(orcamento.validade), 'dd/MM/yyyy')}
                        {origin === 'scan' && (
                            <span className="ml-2 font-black uppercase text-[10pt]">
                                {isVencido ? "(VENCIDO)" : "(NA VALIDADE)"}
                            </span>
                        )}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[9pt] text-gray-400 font-bold uppercase">Código do Orçamento</div>
                    <div className="text-lg font-mono font-bold leading-tight">{orcamento.codigo}</div>
                </div>
            </section>

            <section className="mb-4 text-[10.5pt] border-y border-black py-1 px-0 space-y-1">
                <div className="space-y-0.5">
                    <div className="text-[9pt] font-bold text-gray-500 uppercase tracking-wider">Paciente/Cliente</div>
                    <div className="grid grid-cols-12 gap-x-2">
                        <div className="col-span-5"><strong>NOME:</strong> {orcamento.cliente.nome}</div>
                        <div className="col-span-3"><strong>CPF:</strong> {orcamento.cliente.cpf || '-'}</div>
                        <div className="col-span-4"><strong>TELEFONE:</strong> {orcamento.cliente.telefone || '-'}</div>
                    </div>
                    <div className="grid grid-cols-12 gap-x-2 border-b border-dotted border-gray-400 pb-0.5 mt-1">
                        <div className="col-span-5"><strong>EMAIL:</strong> {orcamento.cliente.email || '-'}</div>
                        <div className="col-span-7"><strong>PLANO / CONVÊNIO:</strong> <span className="text-primary font-semibold">{orcamento.plano}</span></div>
                    </div>
                </div>
            </section>

            <section className="flex flex-col items-center justify-center my-8">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(orcamento.codigo)}`} width={160} height={160} alt="QR Code" className="border-4 p-1 rounded-sm border-black" />
                <p className="text-xs text-muted-foreground mt-2 font-mono">Leia este QR Code para consultar o orçamento</p>
            </section>

            <section className="border-t border-black pt-3">
                {orcamento.exames?.length > 0 && (
                    <div className="mb-4">
                        <h2 className="text-[11pt] font-bold mb-2 flex items-center gap-2">
                            <Beaker size={18} /> Exames Estimados ({orcamento.exames.length})
                        </h2>
                        <table className="w-full text-[10pt] border-collapse mb-2">
                            <thead className="print:table-header-group">
                                <tr className="hidden print:table-row">
                                    <td colSpan={3} className="text-[8pt] text-gray-400 pb-2 pt-4 italic">
                                        Continuação - {titulo} - {orcamento.codigo}
                                    </td>
                                </tr>
                                <tr className="border-b border-gray-300 text-left">
                                    <th className="py-1 w-[20px] text-gray-400">#</th>
                                    <th className="py-1">Descrição</th>
                                    <th className="py-1 text-right">Valor Estimado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orcamento.exames.map((exam: any, idx: number) => (
                                    <tr key={idx} className="border-b border-gray-100 last:border-0 print:break-inside-avoid">
                                        <td className="py-1 text-gray-400 font-mono text-xs">{idx + 1}</td>
                                        <td className="py-1"><span className="font-mono text-xs text-gray-600 font-bold">{exam.idExame || exam.examCode}</span> — {exam.name}</td>
                                        <td className="py-1 text-right">R$ {exam.precoCalculado?.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {orcamento.materiais?.length > 0 && (
                    <div className="mb-4">
                        <h2 className="text-[11pt] font-bold mb-2 flex items-center gap-2">
                            <Box size={18} /> Materiais e Produtos Estimados ({orcamento.materiais.length})
                        </h2>
                        <table className="w-full text-[10pt] border-collapse mb-2">
                            <thead className="print:table-header-group">
                                <tr className="hidden print:table-row">
                                    <td colSpan={3} className="text-[8pt] text-gray-400 pb-2 pt-4 italic">
                                        Continuação - {titulo} - {orcamento.codigo}
                                    </td>
                                </tr>
                                <tr className="border-b border-gray-300 text-left">
                                    <th className="py-1 w-[20px] text-gray-400">#</th>
                                    <th className="py-1">Descrição</th>
                                    <th className="py-1 text-right">Valor Estimado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orcamento.materiais.map((mat: any, idx: number) => (
                                    <tr key={idx} className="border-b border-gray-100 last:border-0 print:break-inside-avoid">
                                        <td className="py-1 text-gray-400 font-mono text-xs">{idx + 1}</td>
                                        <td className="py-1"><span className="font-mono text-xs text-gray-600 font-bold">{mat.idMaterial || mat.codigo || 'S/C'}</span> — {mat.descricao}</td>
                                        <td className="py-1 text-right">
                                           <span className="text-gray-500 text-[9pt] mr-2">
                                               {mat.quantidade || 1}x R$ {mat.precoUnitario?.toFixed(2)} =
                                           </span>
                                           R$ {(mat.totalItem || mat.precoCalculado || (mat.precoUnitario * (mat.quantidade || 1)))?.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                
                <div className="mt-6 border-t-2 border-black pt-2 flex justify-between items-center bg-gray-50 px-3 py-2 rounded">
                    <div className="text-sm font-bold text-gray-600">TOTAL GERAL ESTIMADO</div>
                    <div className="text-xl font-bold text-primary">R$ {orcamento.totalEstimado?.toFixed(2)}</div>
                </div>
            </section>

            <style jsx global>{`
                @media print {
                    .no-print { display: none !important; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff !important; }
                    @page { size: A4; margin: 1cm; }
                    .print-container { width: 100% !important; margin: 0 !important; padding: 0 !important; }
                }
            `}</style>
            
            <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="bg-green-100 p-1.5 rounded-full">
                                <PawPrint className="h-5 w-5 text-green-600" />
                            </div>
                            Orçamento Finalizado
                        </DialogTitle>
                        <DialogDescription className="py-2 text-base text-slate-600">
                            {origin === 'scan' 
                                ? "O orçamento foi visualizado com sucesso. Deseja realizar uma nova leitura agora?" 
                                : "O orçamento foi gerado com sucesso. Deseja iniciar um novo orçamento agora?"}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex sm:justify-between items-center gap-2 pt-2">
                        <Button variant="outline" onClick={() => confirmExit('stay')} className="flex-1">
                            Não, manter nesta tela
                        </Button>
                        <Button onClick={() => confirmExit('new')} className="bg-blue-600 hover:bg-blue-700 flex-1 text-white shadow-md">
                            {origin === 'scan' ? 'Sim, Nova Leitura' : 'Sim, Novo Orçamento'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function PrintOrcamentoLayout() {
    return (
        <React.Suspense fallback={<div className="flex justify-center p-12 text-muted-foreground">Preparando impressão...</div>}>
            <PrintOrcamentoContent />
        </React.Suspense>
    );
}
