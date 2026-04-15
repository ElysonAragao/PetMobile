"use client";

import * as React from 'react';
import { useCallback, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Exam } from '@/lib/types';
import { useSession } from '@/context/session-context';
import { z } from "zod";

const examSchema = z.object({
    examCode: z.string().optional(),
    idExame: z.string().optional().default(''),
    name: z.string().min(1, "Nome é obrigatório"),
    description: z.string().min(1, "Descrição é obrigatória"),
    type: z.enum(['Laboratório', 'Imagem'], { required_error: "Tipo de exame é obrigatório" }),
    healthPlanId: z.string().optional().nullable(),
    healthPlanName: z.string().optional().nullable(),
    isUrgency: z.boolean().optional().default(false),
});

export type ExamFormValues = z.infer<typeof examSchema>;

async function getNextExamCode(supabase: any, type: 'Laboratório' | 'Imagem'): Promise<string> {
    const prefix = type === 'Laboratório' ? 'EL' : 'EI';

    const { data, error } = await supabase
        .from('pet_exames')
        .select('codigo')
        .eq('tipo', type)
        .order('codigo', { ascending: false })
        .limit(1);

    if (error || !data || data.length === 0) {
        return `${prefix}001`;
    }

    const lastCode = data[0].codigo as string;
    if (lastCode && lastCode.startsWith(prefix)) {
        try {
            const numberPart = parseInt(lastCode.substring(prefix.length));
            if (!isNaN(numberPart)) {
                const nextNumber = numberPart + 1;
                return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
            }
        } catch (e) {
            console.error("Could not parse last exam code:", lastCode, e);
        }
    }

    // Final fallback in case of parsing error
    return `${prefix}${(Math.random() * 1000).toFixed(0).padStart(3, '0')}`;
}

export function useExams() {
    const supabase = React.useMemo(() => createClient(), []);
    const { selectedEmpresaId, isLoading: sessionLoading } = useSession();
    const [exams, setExams] = useState<Exam[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
 
    const fetchInProgress = React.useRef(false);
    const isLoadedRef = React.useRef(false);

    const fetchExams = useCallback(async () => {
        if (fetchInProgress.current) return;
        fetchInProgress.current = true;
        
        if (!isLoadedRef.current) {
            setIsLoading(true);
        }
        try {
            console.log("Buscando exames para empresa:", selectedEmpresaId);
            let query = supabase
                .from('pet_exames')
                .select('*')
                .order('nome');
 
            if (selectedEmpresaId) {
                query = query.eq('empresa_id', selectedEmpresaId);
            }
 
            const { data, error } = await query;
            if (error) throw error;
 
            // Map DB cols to Frontend interface
            const mappedData: Exam[] = data.map((row: any) => ({
                id: row.id,
                name: row.nome,
                description: row.descricao,
                type: row.tipo,
                examCode: row.codigo, // The system's internal seq code
                idExame: row.id_exame || '', // The custom idExame from the company
                healthPlanId: row.plano_saude_id,
                healthPlanName: row.health_plan_name,
                isUrgency: row.is_urgency || false
            }));
 
            console.log(`Exames carregados: ${mappedData.length}`);
            setExams(mappedData);
        } catch (err: any) {
            console.error("Error loading exams: ", err);
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
            fetchExams();
        }
    }, [fetchExams, sessionLoading]);

    const addExam = useCallback(async (examData: ExamFormValues): Promise<{ success: boolean, message?: string, newExamId?: string }> => {
        try {
            const nextCode = await getNextExamCode(supabase, examData.type);

            if (!selectedEmpresaId) {
                return { success: false, message: 'Nenhuma clínica selecionada.' };
            }

            const finalExamData = {
                nome: examData.name,
                descricao: examData.description,
                tipo: examData.type,
                codigo: nextCode, // Internal sequencial
                id_exame: examData.idExame?.trim() || nextCode, // Assume custom ID or fallback to sequential
                plano_saude_id: examData.healthPlanId || null,
                health_plan_name: examData.healthPlanName || null,
                empresa_id: selectedEmpresaId,
                is_urgency: examData.isUrgency || false
            };

            const { data, error: insertError } = await supabase
                .from('pet_exames')
                .insert(finalExamData)
                .select('id')
                .single();

            if (insertError) throw insertError;

            fetchExams();
            return { success: true, newExamId: data.id };
        } catch (e: any) {
            console.error("Error adding exam: ", e);
            return { success: false, message: e.message || 'Falha ao adicionar exame.' };
        }
    }, [supabase, fetchExams, selectedEmpresaId]);

    const updateExam = useCallback(async (examId: string, examData: Partial<ExamFormValues>): Promise<{ success: boolean, message?: string }> => {
        try {
            const dataToUpdate: any = {};
            if (examData.name) dataToUpdate.nome = examData.name;
            if (examData.description) dataToUpdate.descricao = examData.description;
            // Allow update of custom id_exame
            if (examData.idExame !== undefined) {
                dataToUpdate.id_exame = examData.idExame.trim() || undefined; // If empty, could fallback to codigo but we leave DB to handle or UI to prevent
                if (dataToUpdate.id_exame === undefined) {
                    // For safety if they clear it out, let's keep it null or fallback
                    dataToUpdate.id_exame = examData.examCode; // Revert to internal code if cleared
                }
            }
            if (examData.healthPlanId !== undefined) {
                dataToUpdate.plano_saude_id = examData.healthPlanId || null;
            }
            if (examData.healthPlanName !== undefined) {
                dataToUpdate.health_plan_name = examData.healthPlanName || null;
            }
            if (examData.isUrgency !== undefined) {
                dataToUpdate.is_urgency = examData.isUrgency;
            }
            // examCode and type are not updatable by design

            if (Object.keys(dataToUpdate).length === 0) return { success: true };

            const { error: updateError } = await supabase
                .from('pet_exames')
                .update(dataToUpdate)
                .eq('id', examId);

            if (updateError) throw updateError;

            fetchExams();
            return { success: true };
        } catch (e: any) {
            console.error("Error updating exam: ", e);
            return { success: false, message: e.message || 'Falha ao atualizar exame.' };
        }
    }, [supabase, fetchExams]);

    const deleteExam = useCallback(async (examId: string) => {
        try {
            const { error } = await supabase
                .from('pet_exames')
                .delete()
                .eq('id', examId);

            if (error) throw error;
            fetchExams();
        } catch (e) {
            console.error("Error deleting exam: ", e);
        }
    }, [supabase, fetchExams]);

    const deleteAllExams = useCallback(async (): Promise<{ success: boolean, message?: string }> => {
        try {
            // In Supabase client we can't delete without a filter easily, but we can do a trick or an RPC
            // To prevent accidental deletion, we require explicit conditions.
            // If tenant isolation is active, we can just delete where id is not null.
            const { error } = await supabase
                .from('pet_exames')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // dummy condition to delete all accessible

            if (error) throw error;
            fetchExams();
            return { success: true };
        } catch (e: any) {
            console.error("Error deleting all exams: ", e);
            return { success: false, message: e.message || 'Falha ao excluir todos os exames.' };
        }
    }, [supabase, fetchExams]);

    return { exams, addExam, updateExam, deleteExam, deleteAllExams, isLoaded, isLoading, error, getNextExamCode: async (type: any) => getNextExamCode(supabase, type) };
}
