"use client";

import { useCallback, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Usuario } from '@/lib/types';
import { z } from "zod";
import { format } from 'date-fns';
import { useSession } from '@/context/session-context';

const baseUserFormSchema = z.object({
    nome: z.string().min(1, "Nome é obrigatório"),
    email: z.string().email("E-mail inválido."),
    status: z.enum(['Administrador', 'Administrador Auxiliar', 'Medico', 'Medico Geral', 'Secretária', 'Secretária Geral', 'Leitor', 'Leitor Geral', 'Relatórios'], { required_error: "Status é obrigatório" }),
    dataValidade: z.date().optional(),
});

const refineValidade = (data: { status: string; dataValidade?: Date }, ctx: z.RefinementCtx) => {
    if (data.status !== 'Administrador' && !data.dataValidade) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Data de validade é obrigatória para este perfil.",
            path: ["dataValidade"],
        });
    }
};

const userFormSchema = baseUserFormSchema.superRefine(refineValidade);
const editUserSchema = baseUserFormSchema.omit({ email: true }).superRefine(refineValidade);

export type UserFormValues = z.infer<typeof userFormSchema>;
export type EditUserFormValues = z.infer<typeof editUserSchema>;

// Mock definition, using API to manage real auth users will require a server action or edge function
// in a true SaaS environment, but here we store profile data in public.usuarios
export function useUsers() {
    const supabase = createClient();
    const { selectedEmpresaId } = useSession();
    const [users, setUsers] = useState<Usuario[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            // Se o usuário Master ainda não tem uma empresa selecionada, não trazemos nada ou podemos trazer tudo dependendo da decisão,
            // mas logica coerente é trazer os usuários da empresa selecionada.
            let query = supabase
                .from('usuarios')
                .select('id, empresa_id, numUsuario:codigo, nome, cpf, crm_uf, email, telefone, status, dataValidade:validade, dataCadastro:created_at')
                .order('nome');

            if (selectedEmpresaId) {
                query = query.eq('empresa_id', selectedEmpresaId);
            }

            const { data, error } = await query;

            if (error) throw error;
            setUsers(data as Usuario[]);
        } catch (err: any) {
            console.error("Error loading users: ", err);
            setError(err);
        } finally {
            setIsLoading(false);
        }
    }, [supabase, selectedEmpresaId]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const addUser = useCallback(async (userData: UserFormValues): Promise<{ success: boolean, message?: string }> => {
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;

            const response = await fetch('/api/admin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'create_user',
                    nome: userData.nome,
                    email: userData.email,
                    status: userData.status,
                    validade: userData.status === 'Administrador' ? null : (userData.dataValidade ? format(userData.dataValidade, 'yyyy-MM-dd') : null),
                    empresaId: selectedEmpresaId
                    // Se for Master, manda o selectedEmpresaId que o backend usará; 
                    // Se for Adm/AdmAux, o selectedEmpresaId já será o mesmo ID real do criador e o backend validará.
                })
            });

            const result = await response.json();

            if (!response.ok) {
                return { success: false, message: result.error || 'Falha ao adicionar usuário.' };
            }

            fetchUsers();
            return { success: true };
        } catch (e: any) {
            console.error("Error adding user record: ", e);
            return { success: false, message: e.message || 'Erro inesperado.' };
        }
    }, [supabase, fetchUsers]);

    const updateUser = useCallback(async (userId: string, userData: EditUserFormValues): Promise<{ success: boolean, message?: string }> => {
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;

            const response = await fetch('/api/admin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'update_user',
                    userId: userId,
                    userData: {
                        nome: userData.nome,
                        status: userData.status,
                        validade: userData.status === 'Administrador' ? null : (userData.dataValidade ? format(userData.dataValidade, 'yyyy-MM-dd') : null),
                    }
                })
            });

            const result = await response.json();

            if (!response.ok) {
                return { success: false, message: result.error || 'Falha ao atualizar usuário.' };
            }

            fetchUsers();
            return { success: true };
        } catch (e: any) {
            console.error("Error updating user: ", e);
            return { success: false, message: e.message || 'Falha ao atualizar usuário.' };
        }
    }, [supabase, fetchUsers]);

    const deleteUser = useCallback(async (userId: string): Promise<{ success: boolean, message?: string }> => {
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;

            const response = await fetch('/api/admin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'delete_user',
                    userId: userId
                })
            });

            const result = await response.json();

            if (!response.ok) {
                return { success: false, message: result.error || "Falha ao excluir registro do usuário." };
            }

            fetchUsers();
            return { success: true };
        } catch (e: any) {
            console.error("Error deleting user record: ", e);
            return { success: false, message: e.message || "Falha ao excluir registro do usuário." };
        }
    }, [supabase, fetchUsers]);

    return { users, addUser, updateUser, deleteUser, isLoaded: !isLoading, error };
}

