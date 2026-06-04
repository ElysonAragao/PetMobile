import * as React from 'react';
import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface PrecoExame {
  id: string;
  plano_id: string;
  exame_id: string;
  preco_atual: number;
  data_preco_atual: string;
  preco_anterior: number | null;
  data_preco_anterior: string | null;
  preco_urgencia: number | null;
  preco_urgencia_anterior: number | null;
}

export function usePrecos() {
  const supabase = React.useMemo(() => createClient(), []);
  const [precos, setPrecos] = useState<PrecoExame[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPrecos = useCallback(async (planoId?: string) => {
    setIsLoading(true);
    try {
      let query = supabase.from('precos_exames').select('*');
      if (planoId) {
        query = query.eq('plano_id', planoId);
      }
      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setPrecos(data || []);
      setIsLoaded(true);
      return { success: true, data };
    } catch (err: any) {
      setError(err);
      return { success: false, message: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  const savePreco = useCallback(async (planoId: string, exameId: string, novoPreco: number, novoPrecoUrgencia: number | null) => {
    try {
      const { data: existing, error: searchError } = await supabase
        .from('precos_exames')
        .select('*')
        .eq('plano_id', planoId)
        .eq('exame_id', exameId)
        .maybeSingle();

      if (searchError) throw searchError;

      if (existing) {
        const isPrecoAtualChanged = Number(existing.preco_atual) !== Number(novoPreco);
        const isPrecoUrgenciaChanged = existing.preco_urgencia !== novoPrecoUrgencia && !(existing.preco_urgencia == null && novoPrecoUrgencia == null);

        if (isPrecoAtualChanged || isPrecoUrgenciaChanged) {
           const updateData: any = {
             updated_at: new Date().toISOString()
           };

           if (isPrecoAtualChanged) {
             updateData.preco_anterior = existing.preco_atual;
             updateData.data_preco_anterior = existing.data_preco_atual;
             updateData.preco_atual = novoPreco;
             updateData.data_preco_atual = new Date().toISOString();
           }

           if (isPrecoUrgenciaChanged) {
             updateData.preco_urgencia_anterior = existing.preco_urgencia;
             updateData.preco_urgencia = novoPrecoUrgencia;
           }

           const { error: updateError } = await supabase
            .from('precos_exames')
            .update(updateData)
            .eq('id', existing.id);
            if (updateError) throw updateError;
        }
      } else {
        const { error: insertError } = await supabase
          .from('precos_exames')
          .insert([{
             plano_id: planoId,
             exame_id: exameId,
             preco_atual: novoPreco,
             data_preco_atual: new Date().toISOString(),
             preco_urgencia: novoPrecoUrgencia
          }]);
        if (insertError) throw insertError;
      }
      
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }, [supabase]);

  const savePrecosBatch = useCallback(async (planoId: string, updates: { exameId: string, price: number, priceUrgencia: number | null }[]) => {
    setIsLoading(true);
    let successCount = 0;
    let failCount = 0;

    for (const update of updates) {
      const res = await savePreco(planoId, update.exameId, update.price, update.priceUrgencia);
      if (res.success) successCount++;
      else failCount++;
    }

    await fetchPrecos(planoId);
    setIsLoading(false);
    return { success: true, successCount, failCount };
  }, [savePreco, fetchPrecos]);

  const fetchPrecosBatch = useCallback(async (planoIds: string[]) => {
    setIsLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('precos_exames')
        .select('*')
        .in('plano_id', planoIds);
      if (fetchError) throw fetchError;
      setPrecos(data || []);
      setIsLoaded(true);
      return { success: true, data };
    } catch (err: any) {
      setError(err);
      return { success: false, message: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  return {
    precos,
    isLoaded,
    isLoading,
    error,
    fetchPrecos,
    fetchPrecosBatch,
    savePreco,
    savePrecosBatch
  };
}
