"use client";

import * as React from 'react';
import { useCallback, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Veterinario } from '@/lib/types';
import { useSession } from '@/context/session-context';
import { z } from "zod";

const veterinarioSchema = z.object({
    codVet: z.string().optional(),
    nome: z.string().min(1, "Nome é obrigatório"),
    crmv: z.string().min(1, "CRMV é obrigatório"),
    especialidade: z.string().optional().default('Geral'),
    email: z.string().email("E-mail inválido").or(z.literal('')).optional().default(''),
    telefone: z.string().optional().default(''),
    prontuario_liberado: z.boolean().optional().default(false),
    validade_prontuario: z.string().or(z.literal('')).nullable().optional().default(''),
    validade_acesso: z.string().or(z.literal('')).nullable().optional().default(''),
});

export type VeterinarioFormValues = z.infer<typeof veterinarioSchema>;

async function getNextVeterinarioCode(supabase: any): Promise<string> {
    const prefix = 'VET';

    const { data, error } = await supabase
        .from('pet_usuarios')
        .select('codigo')
        .in('status', ['MedicoVet', 'MedicoVet Geral'])
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

export function useVeterinarios() {
    const supabase = React.useMemo(() => createClient(), []);
    const { selectedEmpresaId, isLoading: sessionLoading } = useSession();
    const [veterinarios, setVeterinarios] = useState<Veterinario[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
 
    const fetchInProgress = React.useRef(false);
    const isLoadedRef = React.useRef(false);

    const fetchVeterinarios = useCallback(async () => {
        if (fetchInProgress.current) return;
        fetchInProgress.current = true;
        
        if (!isLoadedRef.current) {
            setIsLoading(true);
        }
        try {
            console.log("Buscando médicos veterinários para clínica:", selectedEmpresaId);
            let query = supabase
                .from('pet_usuarios')
                .select('id, empresa_id, nome, crmv_uf, especialidade, email, telefone, codVet:codigo, created_at, validade_acesso:validade, prontuario_liberado, validade_prontuario')
                .in('status', ['MedicoVet', 'MedicoVet Geral'])
                .not('nome', 'is', null)
                .neq('nome', '')
                .not('crmv_uf', 'is', null)
                .neq('crmv_uf', '');
 
            if (selectedEmpresaId) {
                query = query.eq('empresa_id', selectedEmpresaId);
            }
 
            query = query.order('nome');
 
            const { data, error } = await query;
            if (error) throw error;

            const mappedData: Veterinario[] = (data || []).map((row: any) => ({
                id: row.id,
                codVet: row.codVet,
                nome: row.nome,
                crmv: row.crmv_uf,
                especialidade: row.especialidade,
                email: row.email,
                telefone: row.telefone,
                validade_acesso: row.validade_acesso,
                prontuario_liberado: row.prontuario_liberado,
                validade_prontuario: row.validade_prontuario
            }));

            console.log(`Veterinários carregados: ${mappedData.length}`);
            setVeterinarios(mappedData);
        } catch (err: any) {
            console.error("Error loading veterinarios: ", err);
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
            fetchVeterinarios();
        }
    }, [fetchVeterinarios, sessionLoading]);

    const addVeterinario = useCallback(async (vetData: Omit<VeterinarioFormValues, 'codVet'>): Promise<{ success: boolean, message?: string, newVetId?: string }> => {
        try {
            // Check for existing crmv
            const { data: existingData } = await supabase
                .from('pet_usuarios')
                .select('id')
                .eq('crmv_uf', vetData.crmv)
                .in('status', ['MedicoVet', 'MedicoVet Geral'])
                .limit(1);

            if (existingData && existingData.length > 0) {
                return { success: false, message: 'CRMV já cadastrado.' };
            }

            const nextCode = await getNextVeterinarioCode(supabase);

            if (!selectedEmpresaId) {
                return { success: false, message: 'Usuário não vinculado a nenhuma clínica selecionada.' };
            }

            const vetEmail = vetData.email || `vet.${nextCode.toLowerCase()}@clinica.local`;

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
                    nome: vetData.nome,
                    email: vetEmail,
                    status: 'MedicoVet',
                    crmv_uf: vetData.crmv,
                    especialidade: vetData.especialidade || null,
                    telefone: vetData.telefone || null,
                    empresaId: selectedEmpresaId,
                    validade: vetData.validade_acesso || null,
                    prontuario_liberado: vetData.prontuario_liberado || false,
                    validade_prontuario: vetData.validade_prontuario || null,
                }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Falha ao criar veterinário.');
            }

            const { error: updateError } = await supabase
                .from('pet_usuarios')
                .update({ codigo: nextCode })
                .eq('id', result.userId);

            if (updateError) {
                console.error("Error updating veterinario code:", updateError);
            }

            fetchVeterinarios();
            return { success: true, newVetId: result.userId };
        } catch (e: any) {
            console.error("Error adding veterinario: ", e);
            return { success: false, message: e.message || 'Falha ao adicionar médico veterinário.' };
        }
    }, [supabase, fetchVeterinarios, selectedEmpresaId]);

    const updateVeterinario = useCallback(async (vetId: string, vetData: Partial<VeterinarioFormValues>): Promise<{ success: boolean, message?: string }> => {
        try {
            const dataToUpdate: any = {
                nome: vetData.nome,
                crmv_uf: vetData.crmv,
                especialidade: vetData.especialidade,
                telefone: vetData.telefone,
                prontuario_liberado: vetData.prontuario_liberado !== undefined ? vetData.prontuario_liberado : undefined,
                validade_prontuario: vetData.validade_prontuario !== undefined ? (vetData.validade_prontuario || null) : undefined,
            };
            if (vetData.email) dataToUpdate.email = vetData.email;

            if (dataToUpdate.nome === undefined) delete dataToUpdate.nome;
            if (dataToUpdate.crmv_uf === undefined) delete dataToUpdate.crmv_uf;
            if (dataToUpdate.telefone === undefined) delete dataToUpdate.telefone;
            if (dataToUpdate.prontuario_liberado === undefined) delete dataToUpdate.prontuario_liberado;
            if (dataToUpdate.validade_prontuario === undefined) delete dataToUpdate.validade_prontuario;

            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;

            if (!token) {
                return { success: false, message: 'Sessão expirada. Faça login novamente.' };
            }

            const { data: currentUserData } = await supabase
                .from('pet_usuarios')
                .select('status, validade')
                .eq('id', vetId)
                .single();

            const response = await fetch('/api/admin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'update_user',
                    userId: vetId,
                    userData: {
                        nome: dataToUpdate.nome,
                        status: currentUserData?.status || 'MedicoVet',
                        validade: vetData.validade_acesso !== undefined ? (vetData.validade_acesso || null) : (currentUserData?.validade || null),
                        crmv_uf: dataToUpdate.crmv_uf,
                        especialidade: dataToUpdate.especialidade,
                        telefone: dataToUpdate.telefone,
                        email: dataToUpdate.email,
                        prontuario_liberado: dataToUpdate.prontuario_liberado,
                        validade_prontuario: dataToUpdate.validade_prontuario
                    }
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Falha ao atualizar médico veterinário.');
            }

            fetchVeterinarios();
            return { success: true };
        } catch (e: any) {
            console.error("Error updating veterinario: ", e);
            return { success: false, message: e.message || 'Falha ao atualizar médico veterinário.' };
        }
    }, [supabase, fetchVeterinarios]);

    const deleteVeterinario = useCallback(async (vetId: string) => {
        try {
            const { error } = await supabase
                .from('pet_usuarios')
                .delete()
                .eq('id', vetId)
                .in('status', ['MedicoVet', 'MedicoVet Geral']);

            if (error) throw error;
            fetchVeterinarios();
        } catch (e) {
            console.error("Error deleting veterinario: ", e);
        }
    }, [supabase, fetchVeterinarios]);

    return { veterinarios, addVeterinario, updateVeterinario, deleteVeterinario, isLoaded, isLoading, error, getNextVeterinarioCode: async () => getNextVeterinarioCode(supabase) };
}
