import * as React from 'react';
import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface FaturamentoRecord {
  id: string;
  movimento_id?: string; // UUID FK to pet_movimentacoes
  movimento_codigo?: string; // The human-readable movement code e.g. GPet202600001
  medicovet_id?: string;
  empresa_id?: string;
  plano_id?: string;
  exame_id?: string;
  preco_aplicado: number;
  data_faturamento: string;
  // Join data
  medico_nome?: string;
  exame_nome?: string;
  plano_nome?: string;
  cod_leitura?: string; // Reading code linked to this movement
}

export function useFaturamento() {
  const supabase = React.useMemo(() => createClient(), []);
  const [data, setData] = useState<FaturamentoRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchFaturamento = useCallback(async (filters?: { dateFrom?: string, dateTo?: string }) => {
    setLoading(true);
    try {
      // Query simples — sem join com pet_movimentacoes (que causa falha)
      let query = supabase
        .from('pet_faturamento')
        .select(`
          *,
          pet_usuarios!pet_faturamento_medicovet_id_fkey(nome),
          pet_exames(nome),
          pet_planos_saude(nome)
        `);

      if (filters?.dateFrom) {
        query = query.gte('data_faturamento', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('data_faturamento', `${filters.dateTo}T23:59:59`);
      }

      const { data: res, error: fetchError } = await query.order('data_faturamento', { ascending: false });
      if (fetchError) throw fetchError;

      // Buscar códigos de movimentação separadamente
      const movUuids = new Set<string>();
      (res || []).forEach((item: any) => {
        if (item.movimento_id) movUuids.add(item.movimento_id);
      });

      let movMap: Record<string, string> = {}; // UUID -> movimento_id code
      if (movUuids.size > 0) {
        const { data: movRows } = await supabase
          .from('pet_movimentacoes')
          .select('id, movimento_id')
          .in('id', Array.from(movUuids));
        if (movRows) {
          movRows.forEach((m: any) => { movMap[m.id] = m.movimento_id; });
        }
      }

      // Buscar leituras para vincular cod_leitura via metadata.movimentoId
      let leiturasMap: Record<string, string> = {};
      const { data: leiturasData } = await supabase
        .from('pet_leituras')
        .select('cod_leitura, metadata')
        .order('created_at', { ascending: false });
      
      if (leiturasData) {
        for (const leit of leiturasData) {
          const movId = (leit.metadata as any)?.movimentoId;
          if (movId && !leiturasMap[movId]) {
            leiturasMap[movId] = leit.cod_leitura;
          }
        }
      }

      const mapped: FaturamentoRecord[] = (res || []).map((item: any) => {
        const movCodigo = movMap[item.movimento_id] || '';
        return {
          id: item.id,
          movimento_id: item.movimento_id,
          movimento_codigo: movCodigo,
          medicovet_id: item.medicovet_id,
          empresa_id: item.empresa_id,
          plano_id: item.plano_id,
          exame_id: item.exame_id,
          preco_aplicado: Number(item.preco_aplicado),
          data_faturamento: item.data_faturamento,
          medico_nome: item.pet_usuarios?.nome || 'Não Informado',
          exame_nome: item.pet_exames?.nome || 'Exame Excluído',
          plano_nome: item.pet_planos_saude?.nome || 'Particular',
          cod_leitura: leiturasMap[movCodigo] || '-'
        };
      });

      setData(mapped);
      return mapped;
    } catch (err: any) {
      console.error("Erro ao carregar faturamento:", err);
      setError(err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    data,
    loading,
    error,
    fetchFaturamento
  };
}
