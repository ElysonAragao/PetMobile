import * as React from 'react';
import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/context/session-context';

export interface OrcamentoSaveInput {
    codigo: string;
    dataEmissao: string;
    validade: string;
    cliente: {
        nome: string;
        telefone?: string;
        cpl?: string;
    };
    plano: string;
    exames: any[];
    materiais: any[];
    totalEstimado: number;
}

export function useOrcamentos() {
    const supabase = React.useMemo(() => createClient(), []);
    const { selectedEmpresaId } = useSession();

    const getNextOrcamentoCode = useCallback(async (empresaCodigo: string): Promise<{ codigo: string, leitura: string }> => {
        const anoAtual = new Date().getFullYear();
        const prefixo = `O${empresaCodigo}${anoAtual}`;

        const { data, error } = await supabase
            .from('pet_orcamentos')
            .select('codigo')
            .eq('empresa_id', selectedEmpresaId)
            .like('codigo', `${prefixo}%`)
            .order('codigo', { ascending: false })
            .limit(1);

        let nextSeq = 1;

        if (!error && data && data.length > 0) {
            const lastCode = data[0].codigo as string;
            try {
                const seqString = lastCode.replace(prefixo, '');
                const lastSeq = parseInt(seqString, 10);
                if (!isNaN(lastSeq)) {
                    nextSeq = lastSeq + 1;
                }
            } catch (e) { }
        }

        const seqFormatada = String(nextSeq).padStart(5, '0');
        return {
            codigo: `${prefixo}${seqFormatada}`,
            leitura: `LO${empresaCodigo}${anoAtual}${seqFormatada}`
        };
    }, [supabase, selectedEmpresaId]);

    const saveOrcamento = useCallback(async (data: OrcamentoSaveInput) => {
        if (!selectedEmpresaId) {
            return { success: false, message: "Empresa não selecionada." };
        }

        try {
            const { error } = await supabase
                .from('pet_orcamentos')
                .insert([{
                    codigo: data.codigo,
                    empresa_id: selectedEmpresaId,
                    data_emissao: data.dataEmissao,
                    validade: data.validade,
                    cliente_nome: data.cliente.nome,
                    cliente_telefone: data.cliente.telefone || null,
                    cliente_cpl: data.cliente.cpl || null,
                    plano_nome: data.plano,
                    exames: data.exames,
                    materiais: data.materiais,
                    total_estimado: data.totalEstimado
                }]);

            if (error) throw error;
            return { success: true };
        } catch (err: any) {
            console.error("Erro ao salvar orçamento no banco:", err);
            return { success: false, message: err.message || "Erro desconhecido ao salvar o orçamento." };
        }
    }, [supabase, selectedEmpresaId]);

    const getOrcamentoByCodigo = useCallback(async (codigo: string) => {
        try {
            const { data, error } = await supabase
                .from('pet_orcamentos')
                .select('*')
                .eq('codigo', codigo)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    throw new Error("Orçamento não encontrado no banco de dados. Verifique se ele foi salvo corretamente.");
                }
                throw error;
            }
            return { success: true, data };
        } catch (err: any) {
            console.error("Erro ao buscar orçamento:", err);
            return { success: false, message: err.message };
        }
    }, [supabase]);

    return {
        saveOrcamento,
        getOrcamentoByCodigo,
        getNextOrcamentoCode
    };
}
