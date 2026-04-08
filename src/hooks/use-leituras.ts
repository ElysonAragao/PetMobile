"use client";

import { useCallback, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Leitura } from '@/lib/types';
import { useSession } from '@/context/session-context';

async function getNextLeituraCode(supabase: any, empresaId: string | null): Promise<string> {
    const year = new Date().getFullYear().toString();
    let codEmpresa = 'E00';
    if (empresaId) {
        const { data: empData } = await supabase.from('pet_empresas').select('codigo').eq('id', empresaId).single();
        if (empData?.codigo) codEmpresa = empData.codigo;
    }
    const prefix = `L${codEmpresa}${year}`;
    const { data, error } = await supabase
        .from('pet_leituras')
        .select('cod_leitura')
        .like('cod_leitura', `${prefix}%`)
        .order('created_at', { ascending: false })
        .limit(1);

    if (error || !data || data.length === 0) return `${prefix}00001`;
    const lastCode = data[0].cod_leitura as string;
    if (lastCode && lastCode.startsWith(prefix)) {
        const seqPart = lastCode.substring(prefix.length);
        const numberPart = parseInt(seqPart);
        if (!isNaN(numberPart)) {
            return `${prefix}${(numberPart + 1).toString().padStart(5, '0')}`;
        }
    }
    return `${prefix}00001`;
}

export interface LeituraInput {
    movimentoId: string;
    dataLeitura: string;
    usuarioNome: string;
    usuarioId: string;
    petId?: string; // Add optional direct ID
    pacienteNome: string;
    pacienteCpf: string;
    pacienteTelefone: string;
    pacienteHealthPlanCode?: string;
    pacienteHealthPlanName?: string;
    pacienteMatricula?: string;
    pacienteIdade?: string;
    pacienteGenero?: string;
    medicoNome: string;
    medicoCrm: string;
    exames: { examCode: string; idExame: string; name: string; description: string; type: string }[];
}

export function useLeituras() {
    const supabase = createClient();
    const { selectedEmpresaId } = useSession();
    const [leituras, setLeituras] = useState<Leitura[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchLeituras = useCallback(async () => {
        setIsLoading(true);
        try {
            console.log("Relatórios: Buscando leituras para empresa", selectedEmpresaId);
            let query = supabase
                .from('pet_leituras')
                .select(`
                    id,
                    cod_leitura,
                    data_leitura,
                    metadata,
                    pet_id,
                    medico_id,
                    pets:pet_pets!pet_id (nome, tutor_nome, tutor_telefone, matricula, idade, sexo),
                    medicos:pet_usuarios!medico_id (nome, crmv_uf),
                    usuarios:pet_usuarios!usuario_id (nome)
                `);

            if (selectedEmpresaId) {
                query = query.eq('empresa_id', selectedEmpresaId);
            }

            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;
            
            console.log(`Relatórios: ${data?.length || 0} leituras encontradas.`);
            setLeituras(data as any[]);
        } catch (err: any) {
            console.error("Error loading leituras: ", err);
            setError(err);
        } finally {
            setIsLoading(false);
        }
    }, [supabase, selectedEmpresaId]);

    useEffect(() => {
        if (selectedEmpresaId) fetchLeituras();
    }, [fetchLeituras, selectedEmpresaId]);

    const addLeitura = useCallback(async (leituraData: LeituraInput): Promise<{ success: boolean; message?: string; codLeitura?: string }> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const usuarioId = user?.id;

            if (!selectedEmpresaId) {
                return { success: false, message: 'Clínica não selecionada.' };
            }

            // PRIORITIZE DIRECT PET ID if provided
            let petId = leituraData.petId;
            if (!petId && leituraData.pacienteCpf) {
                const { data: pData } = await supabase.from('pet_pets').select('id').eq('tutor_cpf', leituraData.pacienteCpf).limit(1);
                if (pData && pData.length > 0) petId = pData[0].id;
            }

            let medicoId = null;
            if (leituraData.medicoCrm) {
                const { data: mData } = await supabase.from('pet_usuarios').select('id').eq('crmv_uf', leituraData.medicoCrm).limit(1);
                if (mData && mData.length > 0) medicoId = mData[0].id;
            }

            if (!petId) return { success: false, message: 'Pet não vinculado corretamente.' };
            if (!medicoId) return { success: false, message: 'Médico solicitante não identificado.' };

            const nextCode = await getNextLeituraCode(supabase, selectedEmpresaId);

            const insertPayload = {
                empresa_id: selectedEmpresaId,
                usuario_id: usuarioId || leituraData.usuarioId,
                pet_id: petId,
                medico_id: medicoId,
                cod_leitura: nextCode,
                data_leitura: leituraData.dataLeitura,
                status: 'Realizado',
                metadata: {
                    pacienteHealthPlanCode: leituraData.pacienteHealthPlanCode,
                    pacienteHealthPlanName: leituraData.pacienteHealthPlanName,
                    pacienteIdade: leituraData.pacienteIdade,
                    pacienteGenero: leituraData.pacienteGenero,
                    movimentoId: leituraData.movimentoId,
                    pacienteNome: leituraData.pacienteNome,
                    medicoNome: leituraData.medicoNome
                }
            };

            const { data: novaLeitura, error: insertError } = await supabase
                .from('pet_leituras')
                .insert(insertPayload)
                .select('id')
                .single();

            if (insertError) throw insertError;

            if (leituraData.exames && leituraData.exames.length > 0) {
                const examLinks = [];
                for (const ex of leituraData.exames) {
                    const { data: eData } = await supabase.from('pet_exames').select('id').eq('codigo', ex.examCode || ex.idExame).limit(1);
                    if (eData && eData.length > 0) {
                        examLinks.push({
                            leitura_id: novaLeitura.id,
                            exame_id: eData[0].id,
                            empresa_id: selectedEmpresaId
                        });
                    }
                }
                if (examLinks.length > 0) await supabase.from('pet_leitura_exames').insert(examLinks);
            }

            fetchLeituras();
            return { success: true, codLeitura: nextCode };
        } catch (e: any) {
            console.error("Error adding leitura: ", e);
            return { success: false, message: e.message || 'Erro ao registrar atendimento.' };
        }
    }, [supabase, fetchLeituras, selectedEmpresaId]);

    return { leituras, addLeitura, isLoaded: !isLoading, error, fetchLeituras };
}
