"use client";

import * as React from 'react';
import { useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/context/session-context';
import { Movimentacao } from '@/lib/types';

export function useMovement() {
    const supabase = React.useMemo(() => createClient(), []);
    const { selectedEmpresaId } = useSession();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const getNextMovimentoId = useCallback(async (isManual: boolean = false): Promise<string> => {
        const year = new Date().getFullYear().toString();

        try {
            let codEmpresa = 'PET'; // Default to PET if nothing found
            if (selectedEmpresaId) {
                console.log("DEBUG: Gerando ID para Empresa ID:", selectedEmpresaId);
                const { data: empData, error: empError } = await supabase
                    .from('pet_empresas')
                    .select('codigo')
                    .eq('id', selectedEmpresaId)
                    .single();
                
                if (empError) console.error("DEBUG: Erro ao buscar código da empresa:", empError.message);
                
                if (empData?.codigo) {
                    console.log("DEBUG: Código encontrado no banco:", empData.codigo);
                    codEmpresa = empData.codigo;
                } else {
                    console.log("DEBUG: Empresa não tem código cadastrado, usando PET.");
                }
            }

            const prefix = isManual ? `R${codEmpresa}${year}` : `G${codEmpresa}${year}`;

            const { data, error: seqError } = await supabase
                .from('pet_movimentacoes')
                .select('movimento_id')
                .like('movimento_id', `${prefix}%`)
                .order('movimento_id', { ascending: false })
                .limit(1);

            if (seqError || !data || data.length === 0) {
                return `${prefix}00001`;
            }

            const lastId = data[0].movimento_id as string;
            if (lastId && lastId.startsWith(prefix)) {
                const seqPart = lastId.substring(prefix.length);
                const numberPart = parseInt(seqPart);
                if (!isNaN(numberPart)) {
                    const nextNumber = numberPart + 1;
                    return `${prefix}${nextNumber.toString().padStart(5, '0')}`;
                }
            }

            return `${prefix}00001`;
        } catch (e) {
            console.error("Erro ao gerar ID de movimento:", e);
            return `M${Date.now()}`;
        }
    }, [supabase, selectedEmpresaId]);

    const createMovimento = useCallback(async (
        petId: string,
        veterinarioId: string,
        exameIds: string[],
        isManual: boolean = false
    ): Promise<{ success: boolean; movimentoId?: string; message?: string }> => {
        setIsLoading(true);
        setError(null);

        try {
            if (!selectedEmpresaId) {
                throw new Error("Sessão expirada ou clínica não selecionada.");
            }

            const movimentoId = await getNextMovimentoId(isManual);
            const dataHora = new Date().toISOString();

            const { data, error: insertError } = await supabase
                .from('pet_movimentacoes')
                .insert({
                    movimento_id: movimentoId,
                    paciente_id: petId,
                    medico_id: veterinarioId,
                    exame_ids: exameIds,
                    data: dataHora,
                    empresa_id: selectedEmpresaId
                })
                .select('movimento_id')
                .maybeSingle();

            if (insertError) throw insertError;
            
            return { success: true, movimentoId: data?.movimento_id };

        } catch (e: any) {
            console.error("Erro fatal em createMovimento:", e);
            setError(e);
            return { success: false, message: e.message || 'Falha ao salvar.' };
        } finally {
            setIsLoading(false);
        }
    }, [supabase, selectedEmpresaId, getNextMovimentoId]);

    const fetchMovimentacoes = useCallback(async (): Promise<Movimentacao[]> => {
        setIsLoading(true);
        setError(null);
        try {
            let query = supabase
                .from('pet_movimentacoes')
                .select('*')
                .order('data', { ascending: false });

            if (selectedEmpresaId) {
                query = query.eq('empresa_id', selectedEmpresaId);
            }

            const { data, error: fetchError } = await query;
            if (fetchError) throw fetchError;

            return (data || []).map((row: any) => ({
                id: row.id,
                movimentoId: row.movimento_id,
                petId: row.paciente_id,
                veterinarioId: row.medico_id,
                exameIds: row.exame_ids,
                data: row.data
            }));
        } catch (e: any) {
            setError(e);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [supabase, selectedEmpresaId]);

    return {
        createMovimento,
        fetchMovimentacoes,
        isLoading,
        error
    };
}
