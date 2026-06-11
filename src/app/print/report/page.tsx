"use client";

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Printer, Undo2, AlertTriangle, PawPrint, Info, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function PrintReportContent() {
    const router = useRouter();
    const [reportData, setReportData] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        try {
            const cachedRaw = localStorage.getItem('print-report-data');
            if (cachedRaw) {
                setReportData(JSON.parse(cachedRaw));
            } else {
                setError('Nenhum dado de relatório encontrado.');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const handlePrint = () => window.print();
    const handleClose = () => {
        if (reportData?.backUrl) {
            router.push(reportData.backUrl);
        } else {
            router.back();
        }
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
    if (error || !reportData) return <div className="p-10 text-center text-red-500"><AlertTriangle className="mx-auto mb-4" /> Erro: {error || 'Dados não encontrados'}</div>;

    const { title, subtitle, filters, headers, rows, kpis } = reportData;

    return (
        <div className="bg-white text-black max-w-5xl mx-auto p-8 print-container font-sans">
            <header className="flex justify-between items-center mb-4 no-print border-b pb-4">
                <h1 className="text-xl font-bold text-primary flex items-center gap-2"><PawPrint className="w-6 h-6" /> PetMobile</h1>
                <div className="flex gap-3">
                    <Button onClick={handlePrint} className="font-bold text-base bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all">
                        <Printer className="mr-2 h-5 w-5" /> Imprimir / Salvar PDF
                    </Button>
                    <Button onClick={handleClose} className="font-bold text-base border-2 hover:bg-gray-50 transition-all font-sans tracking-wide" variant="outline">
                        <Undo2 className="mr-2 h-5 w-5" /> VOLTAR
                    </Button>
                </div>
            </header>

            <div className="no-print my-6">
                <Alert variant="default" className="text-left"><Info className="h-4 w-4" /><AlertTitle>Como Salvar ou Enviar?</AlertTitle><AlertDescription>Escolha "Salvar como PDF" na janela de impressão para salvar no seu dispositivo.</AlertDescription></Alert>
            </div>

            <h1 className="text-center text-2xl font-black mb-1 uppercase tracking-tight">{title || 'Relatório'}</h1>
            {subtitle && <p className="text-center text-[9pt] text-gray-500 mb-6 italic">{subtitle}</p>}

            {filters && filters.length > 0 && (
                <section className="mb-4 text-[10.5pt] border-y border-black py-2 px-0 space-y-1">
                    <div className="text-[9pt] font-bold text-gray-500 uppercase tracking-wider mb-1">Filtros do Relatório</div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                        {filters.map((f: any, i: number) => (
                            <div key={i}><strong>{f.label}:</strong> {f.value}</div>
                        ))}
                    </div>
                </section>
            )}

            <section className="mt-6">
                <table className="w-full border-collapse text-[10pt] text-left">
                    <thead>
                        <tr className="border-b-2 border-black">
                            {headers?.map((h: string, i: number) => (
                                <th key={i} className="py-2 px-1 font-bold text-gray-800">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows?.map((row: any[], i: number) => (
                            <tr key={i} className="border-b border-gray-200">
                                {row.map((cell: any, j: number) => (
                                    <td key={j} className="py-2 px-1 text-gray-700">{cell || '-'}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            {kpis && kpis.length > 0 && (
                <section className="mt-8 pt-4 border-t-2 border-black">
                    <div className="flex flex-wrap justify-between gap-4">
                        {kpis.map((kpi: any, i: number) => (
                            <div key={i} className="flex-1 min-w-[120px] text-center">
                                <div className="text-[9pt] font-bold text-gray-500 uppercase tracking-wider">{kpi.label}</div>
                                <div className="text-xl font-black mt-1">{kpi.value}</div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <style jsx global>{`
                @media print {
                    .no-print { display: none !important; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff !important; }
                    @page { size: A4 landscape; margin: 1cm; }
                    .print-container { width: 100% !important; margin: 0 !important; padding: 0 !important; max-width: none !important; }
                }
            `}</style>
        </div>
    );
}

export default function PrintReportLayout() {
    return (
        <React.Suspense fallback={<div className="flex justify-center p-12 text-muted-foreground">Preparando relatório...</div>}>
            <PrintReportContent />
        </React.Suspense>
    );
}
