"use client";

import { useCallback, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { HealthPlan } from '@/lib/types';
import { useSession } from '@/context/session-context';
import { z } from "zod";

const healthPlanSchema = z.object({
    codPlano: z.string().optional(),
    idPlano: z.string().optional().default(''),
    nome: z.string().min(1, "Nome é obrigatório"),
});

export type HealthPlanFormValues = z.infer<typeof healthPlanSchema>;

async function getNextHealthPlanCode(supabase: any): Promise<string> {
    const prefix = 'PLA';

    // Using ans_code as the storage for codPlano to keep compatibility with the SQL schema
    // if a specific cod_plano column wasn't created.
    const { data, error } = await supabase
        .from('planos_saude')
        .select('nome, ans_code')
        .order('created_at', { ascending: false })
        .limit(10); // Check recent to find highest, a real sequence is better in PG

    if (error || !data || data.length === 0) {
        return `${prefix}001`;
    }

    // Try to find the highest code
    let maxNumber = 0;
    data.forEach((row: any) => {
        const code = row.ans_code;
        if (code && code.startsWith(prefix)) {
            try {
                const numberPart = parseInt(code.substring(prefix.length));
                if (!isNaN(numberPart) && numberPart > maxNumber) {
                    maxNumber = numberPart;
                }
            } catch (e) {
                // ignore
            }
        }
    });

    const nextNumber = maxNumber + 1;
    return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
}

export function useHealthPlans() {
    const supabase = createClient();
    const { selectedEmpresaId } = useSession();
    const [healthPlans, setHealthPlans] = useState<HealthPlan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchHealthPlans = useCallback(async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('planos_saude')
                .select('*')
                .order('nome');

            if (selectedEmpresaId) {
                query = query.eq('empresa_id', selectedEmpresaId);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Map DB cols (nome, ans_code) to Frontend interface (nome, codPlano, idPlano)
            // ans_code was used to store codPlano in this adaptation
            const mappedData: HealthPlan[] = data.map((row: any) => ({
                id: row.id,
                nome: row.nome,
                codPlano: row.ans_code,
                idPlano: row.ans_code // Fallback mapping based on legacy usage
            }));

            setHealthPlans(mappedData);
        } catch (err: any) {
            console.error("Error loading health plans: ", err);
            setError(err);
        } finally {
            setIsLoading(false);
        }
    }, [supabase, selectedEmpresaId]);

    useEffect(() => {
        fetchHealthPlans();
    }, [fetchHealthPlans]);

    const addHealthPlan = useCallback(async (planData: Omit<HealthPlanFormValues, 'codPlano'>): Promise<{ success: boolean, message?: string, newPlanId?: string }> => {
        try {
            // Check for existing plan with the same name to avoid duplicates
            const { data: existingData } = await supabase
                .from('planos_saude')
                .select('id')
                .eq('nome', planData.nome)
                .limit(1);

            if (existingData && existingData.length > 0) {
                return { success: false, message: 'Já existe um plano de saúde com este nome.' };
            }

            const nextCode = await getNextHealthPlanCode(supabase);

            // Para o Master atuando em nome de uma empresa (ou o próprio Admin), o ID correto vem da sessão
            if (!selectedEmpresaId) {
                return { success: false, message: 'Nenhuma clínica selecionada ou vinculada.' };
            }

            // Map frontend to DB
            const finalPlanData = {
                nome: planData.nome,
                ans_code: nextCode,
                empresa_id: selectedEmpresaId
            };

            const { data, error: insertError } = await supabase
                .from('planos_saude')
                .insert(finalPlanData)
                .select('id')
                .single();

            if (insertError) throw insertError;

            fetchHealthPlans();
            return { success: true, newPlanId: data.id };
        } catch (e: any) {
            console.error("Error adding health plan: ", e);
            return { success: false, message: e.message || 'Falha ao adicionar plano de saúde.' };
        }
    }, [supabase, fetchHealthPlans, selectedEmpresaId]);

    const updateHealthPlan = useCallback(async (planId: string, planData: Partial<HealthPlanFormValues>): Promise<{ success: boolean, message?: string }> => {
        try {
            const dataToUpdate: any = {};
            if (planData.nome) dataToUpdate.nome = planData.nome;
            // Code is not updatable by design from legacy code

            if (Object.keys(dataToUpdate).length === 0) return { success: true };

            const { error: updateError } = await supabase
                .from('planos_saude')
                .update(dataToUpdate)
                .eq('id', planId);

            if (updateError) throw updateError;

            fetchHealthPlans();
            return { success: true };
        } catch (e: any) {
            console.error("Error updating health plan: ", e);
            return { success: false, message: e.message || 'Falha ao atualizar plano de saúde.' };
        }
    }, [supabase, fetchHealthPlans]);

    const deleteHealthPlan = useCallback(async (planId: string) => {
        try {
            const { error } = await supabase
                .from('planos_saude')
                .delete()
                .eq('id', planId);

            if (error) throw error;
            fetchHealthPlans();
        } catch (e) {
            console.error("Error deleting health plan: ", e);
        }
    }, [supabase, fetchHealthPlans]);

    return { healthPlans, addHealthPlan, updateHealthPlan, deleteHealthPlan, isLoaded: !isLoading, error, getNextHealthPlanCode: async () => getNextHealthPlanCode(supabase) };
}
