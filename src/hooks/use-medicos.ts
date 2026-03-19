"use client";

import * as React from 'react';
import { useCallback, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Medico } from '@/lib/types';
import { useSession } from '@/context/session-context';
import { z } from "zod";

const medicoSchema = z.object({
    codMed: z.string().optional(),
    name: z.string().min(1, "Nome é obrigatório"),
    crm: z.string().min(1, "CRM é obrigatório"),
    email: z.string().email("E-mail inválido").or(z.literal('')).optional().default(''),
    telefone: z.string().optional().default(''),
});

export type MedicoFormValues = z.infer<typeof medicoSchema>;

async function getNextMedicoCode(supabase: any): Promise<string> {
    const prefix = 'MED';

    const { data, error } = await supabase
        .from('usuarios')
        .select('codigo')
        .in('status', ['Medico', 'Medico Geral'])
        .order('codigo', { ascending: false })
        .limit(1);

    if (error || !data || data.length === 0) {
        return `${prefix}001`;
    }

    const lastCode = data[0].codigo as string;
    if (lastCode && lastCode.startsWith(prefix)) {
        const numberPart = parseInt(lastCode.substring(prefix.length));
        if (!isNaN(numberPart)) {
            const nextNumber = numberPart + 1;
            return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
        }
    }

    return `${prefix}001`;
}

export function useMedicos() {
    const supabase = React.useMemo(() => createClient(), []);
    const { selectedEmpresaId, isLoading: sessionLoading } = useSession();
    const [medicos, setMedicos] = useState<Medico[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
 
    const fetchInProgress = React.useRef(false);
    const isLoadedRef = React.useRef(false);

    const fetchMedicos = useCallback(async () => {
        if (fetchInProgress.current) return;
        fetchInProgress.current = true;
        
        if (!isLoadedRef.current) {
            setIsLoading(true);
        }
        try {
            console.log("Buscando médicos para empresa:", selectedEmpresaId);
            let query = supabase
                .from('usuarios')
                .select('id, empresa_id, name:nome, crm:crm_uf, email, telefone, codMed:codigo, created_at')
                .in('status', ['Medico', 'Medico Geral'])
                .not('nome', 'is', null)
                .neq('nome', '')
                .not('crm_uf', 'is', null)
                .neq('crm_uf', '');
 
            if (selectedEmpresaId) {
                query = query.eq('empresa_id', selectedEmpresaId);
            }
 
            query = query.order('nome');
 
            const { data, error } = await query;
            if (error) throw error;
            console.log(`Médicos carregados: ${data?.length || 0}`);
            setMedicos(data as Medico[]);
        } catch (err: any) {
            console.error("Error loading medicos: ", err);
            setError(err);
        } finally {
            isLoadedRef.current = true;
            setIsLoaded(true);
            setIsLoading(false);
            fetchInProgress.current = false;
        }
    }, [supabase, selectedEmpresaId]);
 
    useEffect(() => {
        if (!sessionLoading && !isLoadedRef.current) {
            fetchMedicos();
        }
    }, [fetchMedicos, sessionLoading]);

    const addMedico = useCallback(async (medicoData: Omit<MedicoFormValues, 'codMed'>): Promise<{ success: boolean, message?: string, newMedicoId?: string }> => {
        try {
            // Check for existing crm
            const { data: existingData } = await supabase
                .from('usuarios')
                .select('id')
                .eq('crm_uf', medicoData.crm)
                .in('status', ['Medico', 'Medico Geral'])
                .limit(1);

            if (existingData && existingData.length > 0) {
                return { success: false, message: 'CRM já cadastrado.' };
            }

            const nextCode = await getNextMedicoCode(supabase);

            if (!selectedEmpresaId) {
                return { success: false, message: 'Usuário não vinculado a nenhuma empresa selecionada.' };
            }

            const medicoEmail = medicoData.email || `medico.${nextCode.toLowerCase()}@clinica.local`;

            // Use the admin API to create Auth user + profile atomically
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;

            if (!token) {
                return { success: false, message: 'Sessão expirada. Faça login novamente.' };
            }

            const response = await fetch('/api/admin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    action: 'create_user',
                    nome: medicoData.name,
                    email: medicoEmail,
                    status: 'Medico',
                    crm_uf: medicoData.crm,
                    telefone: medicoData.telefone || null,
                    empresaId: selectedEmpresaId,
                }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Falha ao criar médico.');
            }

            // Update the codigo field for the newly created user
            const { error: updateError } = await supabase
                .from('usuarios')
                .update({ codigo: nextCode })
                .eq('id', result.userId);

            if (updateError) {
                console.error("Error updating medico code:", updateError);
            }

            fetchMedicos();
            return { success: true, newMedicoId: result.userId };
        } catch (e: any) {
            console.error("Error adding medico: ", e);
            return { success: false, message: e.message || 'Falha ao adicionar médico.' };
        }
    }, [supabase, fetchMedicos, selectedEmpresaId]);

    const updateMedico = useCallback(async (medicoId: string, medicoData: Partial<MedicoFormValues>): Promise<{ success: boolean, message?: string }> => {
        try {
            const dataToUpdate: any = {
                nome: medicoData.name,
                crm_uf: medicoData.crm,
                telefone: medicoData.telefone,
            };
            if (medicoData.email) dataToUpdate.email = medicoData.email;

            if (dataToUpdate.nome === undefined) delete dataToUpdate.nome;
            if (dataToUpdate.crm_uf === undefined) delete dataToUpdate.crm_uf;
            if (dataToUpdate.telefone === undefined) delete dataToUpdate.telefone;

            const { error: updateError } = await supabase
                .from('usuarios')
                .update(dataToUpdate)
                .eq('id', medicoId);

            if (updateError) throw updateError;

            fetchMedicos();
            return { success: true };
        } catch (e: any) {
            console.error("Error updating medico: ", e);
            return { success: false, message: e.message || 'Falha ao atualizar médico.' };
        }
    }, [supabase, fetchMedicos]);

    const deleteMedico = useCallback(async (medicoId: string) => {
        try {
            const { error } = await supabase
                .from('usuarios')
                .delete()
                .eq('id', medicoId)
                .in('status', ['Medico', 'Medico Geral']);

            if (error) throw error;
            fetchMedicos();
        } catch (e) {
            console.error("Error deleting medico: ", e);
        }
    }, [supabase, fetchMedicos]);

    return { medicos, addMedico, updateMedico, deleteMedico, isLoaded, isLoading, error, getNextMedicoCode: async () => getNextMedicoCode(supabase) };
}
