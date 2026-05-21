import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Modelo } from '@/lib/types';
import { useSession } from '@/context/session-context';

export function useModelos() {
    const supabase = React.useMemo(() => createClient(), []);
    const { user, selectedEmpresaId } = useSession();
    const [modelos, setModelos] = useState<Modelo[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchModelos = useCallback(async () => {
        if (!selectedEmpresaId) return;
        setIsLoading(true);
        try {
            let query = supabase
                .from('pet_modelos')
                .select('*')
                .eq('empresa_id', selectedEmpresaId)
                .order('nome');

            const isGeralRole = ['Master', 'Administrador', 'Administrador Auxiliar', 'Secretária Geral'].includes(user?.status || '');
            
            if (!isGeralRole) {
                query = query.or(`medico_id.eq.${user?.id},medico_id.is.null`);
            }

            const { data, error: fetchError } = await query;

            if (fetchError) throw fetchError;
            setModelos(data || []);
            setIsLoaded(true);
        } catch (err: any) {
            setError(err);
            console.error("Error loading modelos:", err);
        } finally {
            setIsLoading(false);
        }
    }, [supabase, user, selectedEmpresaId]);

    useEffect(() => {
        fetchModelos();
    }, [fetchModelos]);

    const addModelo = useCallback(async (modeloData: Omit<Modelo, 'id' | 'created_at'>) => {
        try {
            const { data, error: insertError } = await supabase
                .from('pet_modelos')
                .insert([{
                    ...modeloData,
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (insertError) throw insertError;
            setModelos(prev => [...prev, data]);
            return { success: true, data };
        } catch (err: any) {
            return { success: false, message: err.message };
        }
    }, [supabase]);

    const updateModelo = useCallback(async (id: string, modeloData: Partial<Modelo>) => {
        try {
            const { data, error: updateError } = await supabase
                .from('pet_modelos')
                .update(modeloData)
                .eq('id', id)
                .select()
                .single();

            if (updateError) throw updateError;
            setModelos(prev => prev.map(m => m.id === id ? data : m));
            return { success: true, data };
        } catch (err: any) {
            return { success: false, message: err.message };
        }
    }, [supabase]);

    const deleteModelo = useCallback(async (id: string) => {
        try {
            const { error: deleteError } = await supabase
                .from('pet_modelos')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;
            setModelos(prev => prev.filter(m => m.id !== id));
            return { success: true };
        } catch (err: any) {
            return { success: false, message: err.message };
        }
    }, [supabase]);

    return {
        modelos,
        isLoaded,
        isLoading,
        error,
        fetchModelos,
        addModelo,
        updateModelo,
        deleteModelo
    };
}
