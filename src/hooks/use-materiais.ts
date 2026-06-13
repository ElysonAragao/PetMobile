"use client";

import * as React from 'react';
import { useCallback, useState, useEffect } from 'react';
import { Material } from '@/lib/types';
import { useSession } from '@/context/session-context';
import { createClient } from '@/lib/supabase/client';
import { z } from "zod";

export const materialSchema = z.object({
    codigo: z.string().optional(),
    idMaterial: z.string().optional(),
    descricao: z.string().min(1, "A descrição é obrigatória"),
    categoria: z.string().min(1, "A categoria é obrigatória"),
    precoUnitario: z.number().min(0, "O preço deve ser maior ou igual a zero"),
    unidade: z.string().min(1, "A unidade é obrigatória"),
    estoque: z.number().min(0, "O estoque deve ser maior ou igual a zero").int(),
});

export type MaterialFormValues = z.infer<typeof materialSchema>;

export function useMateriais() {
    const supabase = React.useMemo(() => createClient(), []);
    const { selectedEmpresaId, isLoading: sessionLoading } = useSession();
    const [materiais, setMateriais] = useState<Material[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchMateriais = useCallback(async () => {
        if (!selectedEmpresaId) return;
        setIsLoading(true);
        try {
            const { data, error: fetchError } = await supabase
                .from('pet_materiais')
                .select('*')
                .eq('empresa_id', selectedEmpresaId)
                .order('descricao');

            if (fetchError) throw fetchError;

            const mappedData: Material[] = data.map((row: any) => ({
                id: row.id,
                empresaId: row.empresa_id,
                codigo: row.codigo,
                idMaterial: row.id_material,
                descricao: row.descricao,
                categoria: row.categoria,
                precoUnitario: row.preco_unitario,
                unidade: row.unidade,
                estoque: row.estoque,
                createdAt: row.created_at
            }));

            setMateriais(mappedData);
        } catch (err: any) {
            setError(err);
            console.error("Error loading materials: ", err);
        } finally {
            setIsLoaded(true);
            setIsLoading(false);
        }
    }, [supabase, selectedEmpresaId]);

    useEffect(() => {
        if (!sessionLoading) {
            fetchMateriais();
        }
    }, [fetchMateriais, sessionLoading]);

    const getNextMaterialCode = useCallback(async (): Promise<string> => {
        if (!selectedEmpresaId) return 'MAT001';
        
        const { data, error } = await supabase
            .from('pet_materiais')
            .select('codigo')
            .eq('empresa_id', selectedEmpresaId)
            .order('codigo', { ascending: false })
            .limit(1);

        if (error || !data || data.length === 0) {
            return 'MAT001';
        }

        const lastCode = data[0].codigo as string;
        if (lastCode && lastCode.startsWith('MAT')) {
            try {
                const numberPart = parseInt(lastCode.substring(3), 10);
                if (!isNaN(numberPart)) {
                    return `MAT${String(numberPart + 1).padStart(3, '0')}`;
                }
            } catch (e) {
                // Ignore
            }
        }
        return `MAT${(Math.random() * 1000).toFixed(0).padStart(3, '0')}`;
    }, [supabase, selectedEmpresaId]);

    const addMaterial = useCallback(async (data: MaterialFormValues): Promise<{ success: boolean, message?: string }> => {
        if (!selectedEmpresaId) return { success: false, message: 'Nenhuma clínica selecionada.' };
        
        try {
            const nextCode = data.codigo?.trim() || await getNextMaterialCode();
            
            const insertData = {
                empresa_id: selectedEmpresaId,
                codigo: nextCode,
                id_material: data.idMaterial?.trim() || nextCode,
                descricao: data.descricao,
                categoria: data.categoria,
                preco_unitario: data.precoUnitario,
                unidade: data.unidade,
                estoque: data.estoque,
            };

            const { error: insertError } = await supabase
                .from('pet_materiais')
                .insert([insertData]);

            if (insertError) throw insertError;
            
            fetchMateriais();
            return { success: true };
        } catch (err: any) {
            return { success: false, message: err.message };
        }
    }, [supabase, selectedEmpresaId, getNextMaterialCode, fetchMateriais]);

    const updateMaterial = useCallback(async (id: string, data: Partial<MaterialFormValues>): Promise<{ success: boolean, message?: string }> => {
        if (!selectedEmpresaId) return { success: false, message: 'Nenhuma clínica selecionada.' };

        try {
            const updateData: any = {};
            if (data.codigo !== undefined) updateData.codigo = data.codigo;
            if (data.idMaterial !== undefined) updateData.id_material = data.idMaterial?.trim() || data.codigo;
            if (data.descricao !== undefined) updateData.descricao = data.descricao;
            if (data.categoria !== undefined) updateData.categoria = data.categoria;
            if (data.precoUnitario !== undefined) updateData.preco_unitario = data.precoUnitario;
            if (data.unidade !== undefined) updateData.unidade = data.unidade;
            if (data.estoque !== undefined) updateData.estoque = data.estoque;

            const { error: updateError } = await supabase
                .from('pet_materiais')
                .update(updateData)
                .eq('id', id);

            if (updateError) throw updateError;

            fetchMateriais();
            return { success: true };
        } catch (err: any) {
            return { success: false, message: err.message };
        }
    }, [supabase, selectedEmpresaId, fetchMateriais]);

    const deleteMaterial = useCallback(async (id: string): Promise<{ success: boolean, message?: string }> => {
        if (!selectedEmpresaId) return { success: false, message: 'Nenhuma clínica selecionada.' };

        try {
            const { error: deleteError } = await supabase
                .from('pet_materiais')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;
            
            fetchMateriais();
            return { success: true };
        } catch (err: any) {
            return { success: false, message: err.message };
        }
    }, [supabase, selectedEmpresaId, fetchMateriais]);

    return {
        materiais,
        isLoaded,
        isLoading,
        error,
        fetchMateriais,
        addMaterial,
        updateMaterial,
        deleteMaterial,
        getNextMaterialCode
    };
}
