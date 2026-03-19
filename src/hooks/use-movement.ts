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

    const getNextMovimentoId = useCallback(async (): Promise<string> => {
        const year = new Date().getFullYear().toString();

        try {
            // 1. Buscar o código da empresa (ex: E001) com timeout
            let codEmpresa = 'E00';
            if (selectedEmpresaId) {
                const getEmpresaPromise = supabase
                    .from('empresas')
                    .select('codigo')
                    .eq('id', selectedEmpresaId)
                    .single();
                
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("Tempo esgotado ao buscar dados da clínica.")), 4000)
                );

                const { data: empData } = await Promise.race([getEmpresaPromise, timeoutPromise]) as any;
                if (empData?.codigo) {
                    codEmpresa = empData.codigo;
                }
            }

            const prefix = `${codEmpresa}${year}`;

            // 2. Buscar o último movimentoId com timeout
            const getSequencePromise = supabase
                .from('movimentacoes')
                .select('movimentoId')
                .like('movimentoId', `${prefix}%`)
                .order('movimentoId', { ascending: false })
                .limit(1);

            const sequenceTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Tempo esgotado ao calcular sequência da guia.")), 4000)
            );

            const { data, error: seqError } = await Promise.race([getSequencePromise, sequenceTimeout]) as any;

            if (seqError || !data || data.length === 0) {
                return `${prefix}0001`;
            }

            const lastId = data[0].movimentoId as string;
            if (lastId && lastId.startsWith(prefix)) {
                const seqPart = lastId.substring(prefix.length);
                const numberPart = parseInt(seqPart);
                if (!isNaN(numberPart)) {
                    const nextNumber = numberPart + 1;
                    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
                }
            }

            return `${prefix}0001`;
        } catch (e) {
            console.error("Erro ao gerar ID de movimento:", e);
            // Fallback para UUID se o sequencial falhar (garante que o processo não pare)
            return `M${Date.now()}`;
        }
    }, [supabase, selectedEmpresaId]);

    const createMovimento = useCallback(async (
        pacienteId: string,
        medicoId: string,
        exameIds: string[]
    ): Promise<{ success: boolean; movimentoId?: string; message?: string }> => {
        setIsLoading(true);
        setError(null);
        console.log("createMovimento chamado para:", { pacienteId, medicoId, exames: exameIds.length });

        // Timeout global de 15 segundos para a operação completa
        const globalTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("A operação excedeu o tempo limite (15s). Verifique sua rede.")), 15000)
        );

        try {
            if (!selectedEmpresaId) {
                console.warn("createMovimento abortado: selectedEmpresaId ausente.");
                throw new Error("Sessão expirada ou clínica não selecionada. Por favor, saia e entre novamente.");
            }

            const operationPromise = (async () => {
                console.log("Calculando ID do movimento...");
                const movimentoId = await getNextMovimentoId();
                console.log("ID gerado:", movimentoId);

                const dataHora = new Date().toISOString();

                console.log("Executando insert no Supabase...");
                const { data, error: insertError } = await supabase
                    .from('movimentacoes')
                    .insert({
                        movimentoId,
                        pacienteId,
                        medicoId,
                        exameIds,
                        data: dataHora,
                        empresa_id: selectedEmpresaId
                    })
                    .select('movimentoId')
                    .maybeSingle();

                if (insertError) {
                    console.error("Erro no insert do Supabase:", insertError);
                    throw insertError;
                }
                
                if (!data) {
                    console.error("Insert concluído mas nenhum dado retornado.");
                    throw new Error("Falha ao confirmar criação da guia.");
                }

                console.log("Insert realizado com sucesso. ID retornado:", data.movimentoId);
                return data.movimentoId;
            })();

            const resultId = await Promise.race([operationPromise, globalTimeout]) as string;
            return { success: true, movimentoId: resultId };

        } catch (e: any) {
            console.error("Erro fatal em createMovimento:", e);
            setError(e);
            return { success: false, message: e.message || 'Falha ao salvar. Tente novamente.' };
        } finally {
            setIsLoading(false);
            console.log("createMovimento finalizado.");
        }
    }, [supabase, selectedEmpresaId, getNextMovimentoId]);

    const fetchMovimentacoes = useCallback(async (): Promise<Movimentacao[]> => {
        setIsLoading(true);
        setError(null);
        try {
            let query = supabase
                .from('movimentacoes')
                .select('*')
                .order('data', { ascending: false });

            if (selectedEmpresaId) {
                query = query.eq('empresa_id', selectedEmpresaId);
            }

            const { data, error: fetchError } = await query;
            if (fetchError) throw fetchError;

            return data.map((row: any) => ({
                id: row.id,
                movimentoId: row.movimentoId,
                pacienteId: row.pacienteId,
                medicoId: row.medicoId,
                exameIds: row.exameIds,
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
