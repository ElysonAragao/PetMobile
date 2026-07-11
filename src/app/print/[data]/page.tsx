"use client";

import * as React from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Beaker, Loader2, AlertTriangle, Printer, Info, PawPrint, Undo2, ScanLine, Home, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function PrintContent() {
    const { data: movimentoId } = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const supabase = createClient();
    
    const [guia, setGuia] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const isLeitura = searchParams.get('origin') === 'scan' || searchParams.get('tipo') === 'leitura';
    const codLeitura = searchParams.get('codLeitura');
    const dataLeituraParam = searchParams.get('dataLeitura');
    const [showExitDialog, setShowExitDialog] = React.useState(false);

    React.useEffect(() => {
        async function loadData() {
            if (!movimentoId) return;
            try {
                // Tenta carregar do localStorage
                const cachedRaw = localStorage.getItem(`print-data-${movimentoId}`);
                if (cachedRaw) {
                    const cached = JSON.parse(cachedRaw);
                    // Normaliza exames do cache (camelCase -> snake_case para o componente)
                    if (cached.exams) {
                        cached.exams = cached.exams.map((e: any) => ({
                            id: e.id,
                            nome: e.nome || e.name,
                            id_exame: e.id_exame || e.idExame || e.examCode || e.codigo,
                            descricao: e.descricao || e.description,
                            is_urgency: cached.urgentExams ? cached.urgentExams.includes(e.id) : (e.is_urgency || e.isUrgency || false)
                        }));
                    }
                    setGuia(cached);
                    setLoading(false);
                    return;
                }

                // Fallback para Supabase
                const { data: mov, error: movErr } = await supabase
                    .from('pet_movimentacoes')
                    .select('*')
                    .eq('movimento_id', movimentoId)
                    .single();

                if (movErr || !mov) throw new Error("Guia não encontrada.");

                const { data: petRow } = await supabase.from('pet_pets').select('*').eq('id', mov.paciente_id).single();
                const { data: vetRow } = await supabase.from('pet_usuarios').select('nome, crmv_uf').eq('id', mov.medico_id).single();
                const { data: examsRows } = await supabase.from('pet_exames').select('*').in('id', mov.exame_ids);

                const pet = petRow ? {
                    id: petRow.id,
                    nome: petRow.nome,
                    especie: petRow.especie,
                    raca: petRow.raca,
                    sexo: petRow.sexo,
                    idade: petRow.idade,
                    dataNascimento: petRow.data_nascimento,
                    tutorNome: petRow.tutor_nome,
                    tutorCpf: petRow.tutor_cpf,
                    tutorTelefone: petRow.tutor_telefone,
                    codPet: petRow.cod_pet,
                    healthPlanName: petRow.health_plan_name,
                    healthPlanCode: petRow.health_plan_code
                } : null;

                const fullData = {
                    movimentoId: mov.movimento_id,
                    data: mov.data,
                    pet: pet,
                    veterinario: { nome: vetRow?.nome, crmv: vetRow?.crmv_uf },
                    exams: (examsRows || []).map((e: any) => ({
                        id: e.id,
                        nome: e.nome,
                        id_exame: e.id_exame || e.codigo,
                        descricao: e.descricao,
                        is_urgency: mov.urgent_exame_ids ? mov.urgent_exame_ids.includes(e.id) : (e.is_urgency || false)
                    }))
                };

                setGuia(fullData);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [movimentoId, supabase]);

    const handlePrint = () => window.print();
    const handleClose = () => {
        setShowExitDialog(true);
    };

    const confirmExit = (action: 'new' | 'stay') => {
        if (action === 'stay') {
            setShowExitDialog(false);
            return;
        }
        // Action = 'new' → redirect based on origin
        try { localStorage.removeItem(`print-data-${movimentoId}`); } catch (e) {}
        if (isLeitura) {
            router.push('/scan');
        } else {
            router.push('/movement?mode=guia&focus=newGuide');
        }
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
    if (error || !guia || !guia.pet) return <div className="p-10 text-center text-red-500"><AlertTriangle className="mx-auto mb-4" /> Erro: {error || 'Dados não encontrados'}</div>;

    const titulo = isLeitura ? "Comprovante de Leitura de Exames" : "Guia de Solicitação de Exame";
    const subTitulo = isLeitura ? "Este documento comprova a leitura e registro dos exames." : "Solicitação oficial para realização de exames complementares.";
    const examsNormal = guia.exams.filter((e: any) => !e.is_urgency);
    const examsUrgency = guia.exams.filter((e: any) => e.is_urgency);

    const formatData = (dateStr: string | null) => {
        if (!dateStr) return new Date().toLocaleDateString('pt-BR');
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('pt-BR');
        } catch (e) {
            return dateStr;
        }
    };

    return (
        <div className="bg-white text-black max-w-4xl mx-auto p-8 print-container font-sans">
            <header className="flex justify-between items-center mb-8 no-print border-b pb-4">
                <h1 className="text-xl font-bold text-blue-600">Visualização da Guia</h1>
                <div className="flex gap-3">
                    <Button onClick={handlePrint} className="font-bold text-sm bg-blue-500 hover:bg-blue-600 text-white shadow-sm transition-all">
                        <Printer className="mr-2 h-4 w-4" /> Gerar PDF / Imprimir
                    </Button>
                    <Button onClick={handleClose} className="font-bold text-sm bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all uppercase" variant="outline">
                        <Undo2 className="mr-2 h-4 w-4" /> VOLTAR
                    </Button>
                </div>
            </header>

            <h1 className="text-center text-[16pt] font-bold mb-8">{titulo}</h1>

            <section className="mb-8">
                <div className="flex justify-between items-end mb-1 text-[10pt] font-bold text-gray-900">
                    <div>Data: {formatData(guia.data)}, {guia.data ? new Date(guia.data).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit', second:'2-digit'}) : ''}</div>
                    <div>Guia Original: {guia.movimentoId}</div>
                </div>
                <hr className="border-black border-t-[1.5px] mb-4" />

                <div className="flex justify-between items-center mb-4">
                    <div className="w-[70%] text-[10pt] font-bold space-y-2 text-gray-900">
                        <div>Paciente: <span className="font-normal">{guia.pet.nome}</span></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>Data Nasc.: <span className="font-normal">{guia.pet.dataNascimento ? new Date(guia.pet.dataNascimento).toLocaleDateString('pt-BR') : '-'}</span></div>
                            <div>Idade: <span className="font-normal">{guia.pet.idade || '-'}</span></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>Espécie/Sexo: <span className="font-normal">{guia.pet.especie} / {guia.pet.sexo || '-'}</span></div>
                            <div>Raça: <span className="font-normal">{guia.pet.raca || '-'}</span></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>Tutor: <span className="font-normal">{guia.pet.tutorNome}</span></div>
                            <div>CPF: <span className="font-normal">{guia.pet.tutorCpf || '-'}</span></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>Telefones: <span className="font-normal">{guia.pet.tutorTelefone || 'N/A'}</span></div>
                            <div>Plano: <span className="font-normal">{guia.pet.healthPlanName || 'N/A'}</span></div>
                        </div>
                        <div>Cód. Pet: <span className="font-normal">{guia.pet.codPet || '-'}</span></div>
                        <div>Médico(a): <span className="font-normal">Dr(a). {guia.veterinario.nome} (CRMV: {guia.veterinario.crmv || '-'})</span></div>
                    </div>
                    
                    <div className="w-[30%] flex flex-col items-end justify-center pt-2 pr-4">
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(guia.movimentoId)}`} width={130} height={130} alt="QR Code" className="border-4 p-1 border-black" />
                        <div className="text-[7pt] font-bold mt-1 text-center font-sans tracking-tight">{guia.movimentoId}</div>
                    </div>
                </div>
            </section>
            
            <section>
                <hr className="border-black border-t-[1.5px] mb-2" />
                <h2 className="text-[12pt] font-bold flex items-center gap-2 mb-2 text-gray-900">
                    <FileText className="w-5 h-5" /> Exames Solicitados ({guia.exams.length})
                </h2>
                <hr className="border-black border-t-[1.5px] mb-4" />

                <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-[9pt] font-bold text-gray-900 pr-4">
                    {guia.exams.map((exam: any) => (
                        <div key={exam.id} className="flex flex-col break-inside-avoid">
                            <div className="flex items-start gap-1.5 leading-snug">
                                <span className="text-[14pt] leading-[0.5] mt-1.5">•</span> 
                                <span>{exam.id_exame || ''} - {exam.nome}</span>
                            </div>
                            {exam.descricao && <div className="text-gray-500 font-normal text-[7.5pt] ml-4 mt-0.5 italic leading-tight">{exam.descricao}</div>}
                        </div>
                    ))}
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
                            Ação Concluída
                        </DialogTitle>
                        <DialogDescription className="py-2 text-base text-slate-600">
                            {isLeitura 
                                ? "Sua guia foi gerada com sucesso. Deseja realizar a leitura de uma nova guia agora?" 
                                : "Sua guia foi gerada com sucesso. Deseja iniciar uma nova movimentação agora?"}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex sm:justify-between items-center gap-2 pt-2">
                        <Button variant="outline" onClick={() => confirmExit('stay')} className="flex-1">
                            Não, manter nesta tela
                        </Button>
                        <Button onClick={() => confirmExit('new')} className="bg-indigo-600 hover:bg-indigo-700 flex-1 text-white shadow-md">
                            {isLeitura ? 'Sim, Nova Leitura' : 'Sim, Nova Movimentação'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function PrintLayout() {
    return (
        <React.Suspense fallback={<div className="flex justify-center p-12 text-muted-foreground">Preparando impressão...</div>}>
            <PrintContent />
        </React.Suspense>
    );
}
