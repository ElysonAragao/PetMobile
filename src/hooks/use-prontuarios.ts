import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/context/session-context';

export interface Prontuario {
  id: string;
  empresa_id: string;
  pet_id: string;
  medico_id: string | null;
  data_atendimento: string;
  tipo_atendimento: 'Consulta' | 'Exame' | 'Procedimento' | 'Retorno';
  descricao_livre: string | null;
  prescricao_medica: string | null;
  status_retorno: 'Ativo' | 'Expirado' | 'Concluído';
  data_retorno_limite: string | null;
  codigo_prontuario?: string | null;
  autor_registro_id?: string | null;
  created_at: string;
}

export type ProntuarioInsert = Omit<Prontuario, 'id' | 'empresa_id' | 'created_at' | 'codigo_prontuario' | 'autor_registro_id'>;

async function getNextProntCode(supabase: any, empresaId: string): Promise<string> {
    const { data } = await supabase
        .from('pet_prontuarios')
        .select('codigo_prontuario')
        .eq('empresa_id', empresaId)
        .order('codigo_prontuario', { ascending: false })
        .limit(1);
        
    if (!data || data.length === 0 || !data[0].codigo_prontuario) return 'PRT-000001';
    const match = data[0].codigo_prontuario.match(/PRT-(\d+)/);
    if (match) return `PRT-${String(parseInt(match[1]) + 1).padStart(6, '0')}`;
    return 'PRT-000001';
}

export function useProntuarios(petId?: string) {
  const supabase = useMemo(() => createClient(), []);
  const [prontuarios, setProntuarios] = useState<Prontuario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { selectedEmpresaId, isLoading: sessionLoading, user } = useSession();
  
  const fetchInProgress = useRef(false);
  const prevPetId = useRef(petId);

  const fetchProntuarios = useCallback(async () => {
    if (fetchInProgress.current || !selectedEmpresaId) {
      if (!selectedEmpresaId && !sessionLoading) setIsLoading(false);
      return;
    }
    
    fetchInProgress.current = true;
    setIsLoading(true);

    try {
      let query = supabase
        .from('pet_prontuarios')
        .select('*')
        .eq('empresa_id', selectedEmpresaId)
        .order('data_atendimento', { ascending: false });

      if (petId) {
        query = query.eq('pet_id', petId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setProntuarios(data || []);
    } catch (error) {
      console.error('Erro ao buscar prontuários:', error);
    } finally {
      setIsLoading(false);
      fetchInProgress.current = false;
    }
  }, [selectedEmpresaId, petId, sessionLoading, supabase]);

  useEffect(() => {
    // Buscar se a sessão carregou E (tem empresa_id OU o pet mudou)
    if (!sessionLoading && selectedEmpresaId) {
       // Se for a primeira vez ou se o petId mudou, force reloding
       if (prevPetId.current !== petId) {
           prevPetId.current = petId;
       }
       fetchProntuarios();
    }
  }, [fetchProntuarios, sessionLoading, selectedEmpresaId, petId]);

  const addProntuario = async (prontuarioInfo: ProntuarioInsert) => {
    if (!user?.id || !selectedEmpresaId) return { success: false, message: 'Não autenticado ou sem clínica.' };
    
    try {
      const novaDataAtendimento = prontuarioInfo.data_atendimento || new Date().toISOString();
      let dataLimiteObj = null;
      if (prontuarioInfo.tipo_atendimento.includes('Consulta')) {
        let dateObj = new Date(novaDataAtendimento);
        dateObj.setDate(dateObj.getDate() + 30);
        dataLimiteObj = dateObj.toISOString();
      }

      const nextCode = await getNextProntCode(supabase, selectedEmpresaId);

      const dataToInsert = {
        ...prontuarioInfo,
        medico_id: prontuarioInfo.medico_id ? prontuarioInfo.medico_id : null,
        autor_registro_id: user?.id,
        codigo_prontuario: nextCode,
        descricao_livre: prontuarioInfo.descricao_livre ? prontuarioInfo.descricao_livre : null,
        prescricao_medica: prontuarioInfo.prescricao_medica ? prontuarioInfo.prescricao_medica : null,
        data_atendimento: novaDataAtendimento,
        empresa_id: selectedEmpresaId,
        data_retorno_limite: dataLimiteObj
      };

      const { error } = await supabase.from('pet_prontuarios').insert([dataToInsert]);
      
      if (error) throw error;
      
      await fetchProntuarios();
      return { success: true, message: 'Prontuário salvo com sucesso.' };
    } catch (error: any) {
      console.error('Erro ao adicionar prontuario:', error);
      return { success: false, message: error.message };
    }
  };

  const updateProntuario = async (id: string, updates: Partial<ProntuarioInsert>) => {
    try {
      const { error } = await supabase
        .from('pet_prontuarios')
        .update(updates)
        .eq('id', id);
        
      if (error) throw error;
      
      await fetchProntuarios();
      return { success: true, message: 'Prontuário atualizado.' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  };

  const deleteProntuario = async (id: string) => {
    try {
      const { error } = await supabase.from('pet_prontuarios').delete().eq('id', id);
      if (error) throw error;
      
      await fetchProntuarios();
      return { success: true, message: 'Prontuário excluído.' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  };

  return { prontuarios, isLoaded: !isLoading, addProntuario, updateProntuario, deleteProntuario, refreshProntuarios: fetchProntuarios };
}
