"use client";

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, AlertTriangle, Printer, Info, PawPrint, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function PrintDocumentContent() {
    const { id: documentoId } = useParams() as { id: string };
    const router = useRouter();
    const supabase = createClient();
    
    const [docData, setDocData] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        async function loadData() {
            if (!documentoId) return;
            try {
                // Fetch document
                const { data: doc, error: docErr } = await supabase
                    .from('pet_documentos_clinicos')
                    .select('*')
                    .eq('id', documentoId)
                    .single();

                if (docErr || !doc) throw new Error("Documento não encontrado.");

                // Fetch prontuário
                const { data: pront, error: prontErr } = await supabase
                    .from('pet_prontuarios')
                    .select('pet_id, medico_id, data_atendimento')
                    .eq('id', doc.prontuario_id)
                    .single();
                
                if (prontErr || !pront) throw new Error("Prontuário vinculado não encontrado.");

                // Fetch pet and medico
                const { data: petRow } = await supabase.from('pet_pets').select('*').eq('id', pront.pet_id).single();
                const { data: vetRow } = await supabase.from('pet_usuarios').select('nome, crmv_uf').eq('id', pront.medico_id).single();

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
                } : null;

                setDocData({
                    id: doc.id,
                    codigo_documento: doc.codigo_documento,
                    tipo: doc.tipo_documento,
                    conteudo: doc.conteudo,
                    dataEmissao: doc.created_at,
                    dataAtendimento: pront.data_atendimento,
                    pet: pet,
                    veterinario: { nome: vetRow?.nome, crmv: vetRow?.crmv_uf }
                });
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [documentoId, supabase]);

    const handlePrint = () => window.print();
    const handleClose = () => {
        router.back();
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
    if (error || !docData || !docData.pet) return <div className="p-10 text-center text-red-500"><AlertTriangle className="mx-auto mb-4" /> Erro: {error || 'Dados não encontrados'}</div>;

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
                <Alert variant="default" className="text-left"><Info className="h-4 w-4" /><AlertTitle>Dica de Impressão</AlertTitle><AlertDescription>Este documento está no mesmo padrão visual corporativo das guias de exames.</AlertDescription></Alert>
            </div>

            <h1 className="text-center text-2xl font-black mb-1 uppercase tracking-tight">{docData.tipo}</h1>
            <p className="text-center text-[9pt] text-gray-500 mb-6 italic">Documento Clínico Oficial</p>

            <section className="flex justify-between items-end mb-2 border-b-2 border-black pb-3 pt-2">
                <div className="space-y-0.5">
                    <div className="text-[10pt]">
                        <strong>Data da Emissão:</strong> {formatData(docData.dataEmissao)}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[9pt] text-gray-400 font-bold uppercase">Código do Documento</div>
                    <div className="text-lg font-mono font-bold leading-tight">{docData.codigo_documento || docData.id.split('-')[0]}</div>
                </div>
            </section>

            <section className="mb-4 text-[10.5pt] border-y border-black py-1 px-0 space-y-1">
                <div className="space-y-0.5">
                    <div className="text-[9pt] font-bold text-gray-500 uppercase tracking-wider">Dados do Animal / Pet</div>
                    <div className="grid grid-cols-12 gap-x-2">
                        <div className="col-span-5"><strong>NOME:</strong> {docData.pet.nome}</div>
                        <div className="col-span-3"><strong>NASC.:</strong> {docData.pet.dataNascimento ? new Date(docData.pet.dataNascimento).toLocaleDateString('pt-BR') : '-'}</div>
                        <div className="col-span-4"><strong>IDADE:</strong> {docData.pet.idade || '-'}</div>
                    </div>
                    <div className="grid grid-cols-12 gap-x-2 border-b border-dotted border-gray-400 pb-0.5">
                        <div className="col-span-5"><strong>ESPÉCIE:</strong> {docData.pet.especie}</div>
                        <div className="col-span-3"><strong>RAÇA:</strong> {docData.pet.raca || '-'}</div>
                        <div className="col-span-4"><strong>CÓD. PET:</strong> {docData.pet.codPet || '-'}</div>
                    </div>
                </div>

                <div className="space-y-0.5">
                    <div className="text-[9pt] font-bold text-gray-500 uppercase tracking-wider">Dados do Responsável / Tutor</div>
                    <div className="grid grid-cols-12 gap-x-2 border-b border-dotted border-gray-400 pb-0.5">
                        <div className="col-span-5"><strong>TUTOR:</strong> {docData.pet.tutorNome}</div>
                        <div className="col-span-3"><strong>CPF:</strong> {docData.pet.tutorCpf || '-'}</div>
                        <div className="col-span-4"><strong>TELEFONE:</strong> {docData.pet.tutorTelefone || '-'}</div>
                    </div>
                </div>

                <div className="space-y-0.5">
                    <div className="text-[9pt] font-bold text-gray-500 uppercase tracking-wider">Emissor do Documento</div>
                    <div className="grid grid-cols-12 gap-x-2">
                        <div className="col-span-8"><strong>MEDICO(A) VETERINÁRIO(A):</strong> {docData.veterinario.nome}</div>
                        <div className="col-span-4"><strong>CRMV/UF:</strong> {docData.veterinario.crmv}</div>
                    </div>
                </div>
            </section>

            <section className="my-8 py-4 px-2 min-h-[300px] border border-gray-100 rounded text-sm leading-relaxed whitespace-pre-wrap font-serif">
                {docData.conteudo || <span className="italic text-gray-400">Documento em branco...</span>}
            </section>

            <section className="mt-20 pt-10 border-t border-black flex flex-col items-center">
                <div className="w-64 border-b border-black mb-2"></div>
                <div className="text-center font-bold text-sm">{docData.veterinario.nome}</div>
                <div className="text-center text-xs text-gray-600">CRMV: {docData.veterinario.crmv}</div>
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

export default function PrintDocLayout() {
    return (
        <React.Suspense fallback={<div className="flex justify-center p-12 text-muted-foreground">Preparando impressão...</div>}>
            <PrintDocumentContent />
        </React.Suspense>
    );
}
