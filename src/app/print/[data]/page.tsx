"use client";

import * as React from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Beaker, Loader2, AlertTriangle, Printer, Info, PawPrint, Undo2 } from 'lucide-react';

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

    const isLeitura = searchParams.get('origin') === 'scan';
    const codLeitura = searchParams.get('codLeitura');

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
                            descricao: e.descricao || e.description
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
                    healthPlanName: petRow.health_plan_name
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
                        descricao: e.descricao
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
        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem(`print-data-${movimentoId}`);
            } catch (e) {}
            window.location.href = isLeitura ? `/?reset=${Date.now()}&completed=true` : `/movement?reset=${Date.now()}&completed=true`;
        }
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
    if (error || !guia || !guia.pet) return <div className="p-10 text-center text-red-500"><AlertTriangle className="mx-auto mb-4" /> Erro: {error || 'Dados não encontrados'}</div>;

    const titulo = isLeitura ? "Comprovante de Atendimento / Leitura" : "Guia de Solicitação Veterinária";
    const half = Math.ceil(guia.exams.length / 2);
    const examsCol1 = guia.exams.slice(0, half);
    const examsCol2 = guia.exams.slice(half);

    return (
        <div className="bg-white text-black max-w-4xl mx-auto p-8 print-container font-sans">
            <header className="flex justify-between items-center mb-4 no-print border-b pb-4">
                <h1 className="text-xl font-bold text-primary flex items-center gap-2"><PawPrint className="w-6 h-6" /> PetMobile</h1>
                <div className="flex gap-3">
                    <Button onClick={handlePrint} className="font-bold text-base bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all">
                        <Printer className="mr-2 h-5 w-5" /> Gerar PDF / Imprimir
                    </Button>
                    <Button onClick={handleClose} className="font-bold text-base border-2 hover:bg-gray-50 transition-all font-sans tracking-wide" variant="outline">
                        <Undo2 className="mr-2 h-5 w-5" /> VOLTAR
                    </Button>
                </div>
            </header>

            <div className="no-print my-6">
                <Alert variant="default" className="text-left"><Info className="h-4 w-4" /><AlertTitle>Como Salvar ou Enviar?</AlertTitle><AlertDescription>Escolha &quot;Salvar como PDF&quot; na janela de impressão para salvar no seu dispositivo.</AlertDescription></Alert>
            </div>

            <h1 className="text-center text-2xl font-bold mb-4">{titulo}</h1>

            <section className="flex justify-between items-center mb-1 text-sm text-gray-600">
                <div>
                    {isLeitura && codLeitura && <><strong>Cód. Leitura:</strong> {codLeitura} &nbsp;|&nbsp; </>}
                    <strong>Data:</strong> {new Date(guia.data).toLocaleString('pt-BR')}
                </div>
                <div><strong>ID Guia:</strong> {guia.movimentoId}</div>
            </section>

            <section className="mb-4 text-[10.5pt] border-y border-black py-1 px-0 space-y-1">
                <div className="space-y-0.5">
                    <div className="text-[9pt] font-bold text-gray-500 uppercase tracking-wider">Dados do Animal / Pet</div>
                    <div className="grid grid-cols-12 gap-x-2">
                        <div className="col-span-5"><strong>NOME:</strong> {guia.pet.nome}</div>
                        <div className="col-span-3"><strong>NASC.:</strong> {guia.pet.dataNascimento ? new Date(guia.pet.dataNascimento).toLocaleDateString('pt-BR') : '-'}</div>
                        <div className="col-span-4"><strong>IDADE:</strong> {guia.pet.idade || '-'}</div>
                    </div>
                    <div className="grid grid-cols-12 gap-x-2 border-b border-dotted border-gray-400 pb-0.5">
                        <div className="col-span-5"><strong>ESPÉCIE:</strong> {guia.pet.especie}</div>
                        <div className="col-span-3"><strong>RAÇA:</strong> {guia.pet.raca || '-'}</div>
                        <div className="col-span-4"><strong>CÓD. PET:</strong> {guia.pet.codPet || '-'}</div>
                    </div>
                </div>

                <div className="space-y-0.5">
                    <div className="text-[9pt] font-bold text-gray-500 uppercase tracking-wider">Dados do Responsável / Tutor</div>
                    <div className="grid grid-cols-12 gap-x-2 border-b border-dotted border-gray-400 pb-0.5">
                        <div className="col-span-5"><strong>TUTOR:</strong> {guia.pet.tutorNome}</div>
                        <div className="col-span-3"><strong>CPF:</strong> {guia.pet.tutorCpf || '-'}</div>
                        <div className="col-span-4"><strong>TELEFONE:</strong> {guia.pet.tutorTelefone || '-'}</div>
                    </div>
                </div>

                <div className="space-y-0.5">
                    <div className="text-[9pt] font-bold text-gray-500 uppercase tracking-wider">Solicitação Médica</div>
                    <div className="grid grid-cols-12 gap-x-2">
                        <div className="col-span-8"><strong>MEDICO(A) VETERINÁRIO(A):</strong> {guia.veterinario.nome}</div>
                        <div className="col-span-4"><strong>CRMV/UF:</strong> {guia.veterinario.crmv}</div>
                    </div>
                </div>
            </section>

            <section className="flex flex-col items-center justify-center my-8">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(guia.movimentoId)}`} width={160} height={160} alt="QR Code" className="border-4 p-1 rounded-sm border-black" />
            </section>

            <section>
                <h2 className="text-lg font-bold mb-3 flex items-center gap-2 border-t border-black pt-3"><Beaker size={20} /> Exames Solicitados ({guia.exams.length})</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    <div className="space-y-1">
                        {examsCol1.map((exam: any) => (
                            <div key={exam.id} className="text-sm">
                                • <strong>{exam.id_exame || ''}</strong> - {exam.nome}
                                {exam.descricao && <p className="text-[10pt] text-gray-600 italic ml-4">{exam.descricao}</p>}
                            </div>
                        ))}
                    </div>
                    <div className="space-y-1">
                        {examsCol2.map((exam: any) => (
                            <div key={exam.id} className="text-sm">
                                • <strong>{exam.id_exame || ''}</strong> - {exam.nome}
                                {exam.descricao && <p className="text-[10pt] text-gray-600 italic ml-4">{exam.descricao}</p>}
                            </div>
                        ))}
                    </div>
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
