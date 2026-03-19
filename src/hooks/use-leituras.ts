"use client";

import { useCallback, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Leitura } from '@/lib/types';
import { useSession } from '@/context/session-context';

async function getNextLeituraCode(supabase: any, empresaId: string | null): Promise<string> {
    const year = new Date().getFullYear().toString();

    // 1. Buscar o código da empresa (ex: E001)
    let codEmpresa = 'E00';
    if (empresaId) {
        const { data: empData } = await supabase
            .from('empresas')
            .select('codigo')
            .eq('id', empresaId)
            .single();
        if (empData?.codigo) {
            codEmpresa = empData.codigo;
        }
    }

    // Prefixo: CodEmpresa + Ano (ex: E00120260001)
    const prefix = `${codEmpresa}${year}`;

    const { data, error } = await supabase
        .from('leituras')
        .select('cod_leitura')
        .like('cod_leitura', `${prefix}%`)
        .order('created_at', { ascending: false })
        .limit(1);

    if (error || !data || data.length === 0) {
        return `${prefix}0001`;
    }

    const lastCode = data[0].cod_leitura as string;
    if (lastCode && lastCode.startsWith(prefix)) {
        const seqPart = lastCode.substring(prefix.length);
        const numberPart = parseInt(seqPart);
        if (!isNaN(numberPart)) {
            const nextNumber = numberPart + 1;
            return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
        }
    }

    return `${prefix}0001`;
}

export interface LeituraInput {
    movimentoId: string;
    dataLeitura: string;
    usuarioNome: string;
    usuarioId: string;
    pacienteNome: string;
    pacienteCpf: string;
    pacienteTelefone: string;
    pacienteHealthPlanCode: string;
    pacienteHealthPlanName: string;
    pacienteMatricula: string;
    pacienteIdade: string;
    pacienteGenero: string;
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
            // Relational fetch strategy
            let query = supabase
                .from('leituras')
                .select(`
                    id,
                    cod_leitura,
                    data_leitura,
                    metadata,
                    paciente_id,
                    medico_id,
                    pacientes (nome, cpf, telefone, matricula, idade, genero),
                    medicos:usuarios!medico_id (nome, crm_uf),
                    usuarios:usuarios!usuario_id (nome)
                `);

            if (selectedEmpresaId) {
                query = query.eq('empresa_id', selectedEmpresaId);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;

            setLeituras(data as any[]);
        } catch (err: any) {
            console.error("Error loading leituras: ", err);
            setError(err);
        } finally {
            setIsLoading(false);
        }
    }, [supabase, selectedEmpresaId]);

    useEffect(() => {
        fetchLeituras();
    }, [fetchLeituras]);

    const addLeitura = useCallback(async (leituraData: LeituraInput): Promise<{ success: boolean; message?: string; codLeitura?: string }> => {
        try {
            const { data: userData } = await supabase.from('usuarios').select('id').eq('id', (await supabase.auth.getUser()).data.user?.id).limit(1);
            const usuarioId = userData?.[0]?.id;

            if (!selectedEmpresaId) {
                return { success: false, message: 'Sistema não vinculado a nenhuma empresa no momento.' };
            }

            // 1. Resolve Patient ID by CPF
            let pacienteId = null;
            if (leituraData.pacienteCpf) {
                const { data: pData } = await supabase.from('pacientes').select('id').eq('cpf', leituraData.pacienteCpf).limit(1);
                if (pData && pData.length > 0) pacienteId = pData[0].id;
            }

            // 2. Resolve Medico ID by CRM
            let medicoId = null;
            if (leituraData.medicoCrm) {
                const { data: mData } = await supabase.from('usuarios').select('id').eq('crm_uf', leituraData.medicoCrm).in('status', ['Medico', 'Médico', 'Medico Geral']).limit(1);
                if (mData && mData.length > 0) medicoId = mData[0].id;
            }

            // Fallback for missing ids
            if (!pacienteId) {
                console.warn("Patient not found in DB for CPF", leituraData.pacienteCpf);
                return { success: false, message: 'Paciente não encontrado no banco relacional.' };
            }
            if (!medicoId) {
                return { success: false, message: 'Médico não encontrado no banco relacional.' };
            }

            const nextCode = await getNextLeituraCode(supabase, selectedEmpresaId);

            const insertPayload = {
                empresa_id: selectedEmpresaId,
                usuario_id: usuarioId || leituraData.usuarioId,
                paciente_id: pacienteId,
                medico_id: medicoId,
                cod_leitura: nextCode,
                data_leitura: leituraData.dataLeitura,
                status: 'Realizado',
                // If there were other raw fields we wanted to keep in a JSONB column 'metadata':
                metadata: {
                    pacienteHealthPlanCode: leituraData.pacienteHealthPlanCode,
                    pacienteHealthPlanName: leituraData.pacienteHealthPlanName,
                    pacienteIdade: leituraData.pacienteIdade,
                    pacienteGenero: leituraData.pacienteGenero,
                    movimentoId: leituraData.movimentoId
                }
            };

            const { data: novaLeitura, error: insertError } = await supabase
                .from('leituras')
                .insert(insertPayload)
                .select('id')
                .single();

            if (insertError) throw insertError;

            // 3. Insert Exams relations
            if (leituraData.exames && leituraData.exames.length > 0) {
                const examLinks = [];
                for (const ex of leituraData.exames) {
                    // resolve exam id by code
                    const { data: eData } = await supabase.from('exames').select('id').eq('codigo', ex.examCode || ex.idExame).limit(1);
                    if (eData && eData.length > 0) {
                        examLinks.push({
                            leitura_id: novaLeitura.id,
                            exame_id: eData[0].id,
                            empresa_id: selectedEmpresaId
                        });
                    }
                }

                if (examLinks.length > 0) {
                    await supabase.from('leitura_exames').insert(examLinks);
                }
            }

            fetchLeituras();
            return { success: true, codLeitura: nextCode };
        } catch (e: any) {
            console.error("Error adding leitura: ", e);
            return { success: false, message: e.message || 'Falha ao registrar leitura.' };
        }
    }, [supabase, fetchLeituras, selectedEmpresaId]);

    const deleteLeitura = useCallback(async (leituraId: string) => {
        try {
            // Let Supabase handle ON DELETE CASCADE for leitura_exames
            const { error } = await supabase
                .from('leituras')
                .delete()
                .eq('id', leituraId);

            if (error) throw error;
            fetchLeituras();
        } catch (e) {
            console.error("Error deleting leitura: ", e);
        }
    }, [supabase, fetchLeituras]);

    return {
        leituras,
        addLeitura,
        deleteLeitura,
        isLoaded: !isLoading,
        error
    };
}
