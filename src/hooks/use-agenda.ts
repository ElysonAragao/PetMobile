"use client";

import * as React from 'react';
import { useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AgendaItem, Pet } from '@/lib/types';
import { useSession } from '@/context/session-context';

export function useAgenda() {
  const supabase = React.useMemo(() => createClient(), []);
  const { selectedEmpresaId } = useSession();
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAgenda = useCallback(async (filters?: { startDate?: string; endDate?: string; medicoId?: string; tipo?: string }) => {
    if (!selectedEmpresaId) return;
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('pet_agenda')
        .select(`
          id,
          empresa_id,
          medico_id,
          data_agendamento,
          pet_id,
          tutor_cpf,
          tutor_nome,
          pet_nome,
          tutor_telefone,
          status,
          tipo,
          local,
          created_at,
          created_by,
          medico:pet_usuarios!pet_agenda_medico_id_fkey(nome, crmv_uf),
          criador:pet_usuarios!fk_agenda_created_by(nome),
          pet:pet_pets(nome, cod_pet)
        `)
        .eq('empresa_id', selectedEmpresaId);

      if (filters?.medicoId && filters.medicoId !== 'all') {
        query = query.eq('medico_id', filters.medicoId);
      }

      if (filters?.tipo && filters.tipo !== 'all') {
        query = query.eq('tipo', filters.tipo);
      }

      if (filters?.startDate) {
        query = query.gte('data_agendamento', filters.startDate);
      }

      if (filters?.endDate) {
        // Para abranger o dia inteiro da data final, podemos filtrar até o fim do dia
        query = query.lte('data_agendamento', filters.endDate);
      }

      // Ordenar por data de agendamento ascendente
      query = query.order('data_agendamento', { ascending: true });

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      const mappedData: AgendaItem[] = (data || []).map((row: any) => ({
        id: row.id,
        empresaId: row.empresa_id,
        medicoId: row.medico_id,
        dataAgendamento: row.data_agendamento,
        petId: row.pet_id,
        tutorCpf: row.tutor_cpf,
        tutorNome: row.tutor_nome,
        petNome: row.pet_nome,
        tutorTelefone: row.tutor_telefone,
        status: row.status,
        tipo: row.tipo || 'Consulta',
        local: row.local || null,
        createdAt: row.created_at,
        createdBy: row.created_by,
        medico: row.medico ? { nome: row.medico.nome, crmv_uf: row.medico.crmv_uf } : undefined,
        pet: row.pet ? { nome: row.pet.nome, codPet: row.pet.cod_pet } : undefined,
        criador: row.criador ? { nome: row.criador.nome } : undefined
      }));

      setAgenda(mappedData);
    } catch (err: any) {
      console.error("Error loading agenda: ", err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, selectedEmpresaId]);

  const addAgenda = useCallback(async (agendaData: {
    medicoId: string | null;
    dataAgendamento: string;
    petId: string | null;
    tutorCpf: string;
    tutorNome: string;
    petNome: string;
    tutorTelefone: string;
    tipo?: 'Consulta' | 'Retorno' | 'Exame' | 'Cirurgia';
    local?: string;
    status?: 'Agendado' | 'Bloqueado';
  }): Promise<{ success: boolean; message?: string; isBlocked?: boolean }> => {
    try {
      if (!selectedEmpresaId) {
        return { success: false, message: 'Clínica não selecionada ou sessão expirada.' };
      }

      // VALIDAÇÃO DE BLOQUEIOS
      if (agendaData.status !== 'Bloqueado') {
        const appDate = new Date(agendaData.dataAgendamento);
        // Considerando fuso horário local para a string de data
        const appDateStr = appDate.toISOString().split('T')[0];
        const appTimeStr = appDate.toTimeString().substring(0, 5); // formato HH:mm

        const { data: bloqueios, error: blockError } = await supabase
          .from('pet_agenda_bloqueios')
          .select('*')
          .eq('empresa_id', selectedEmpresaId)
          .lte('data_inicio', appDateStr)
          .gte('data_fim', appDateStr);

        if (!blockError && bloqueios && bloqueios.length > 0) {
          const isBlocked = bloqueios.some(b => {
            if (b.medico_id && b.medico_id !== agendaData.medicoId) return false;
            
            if (b.tipo_bloqueio === 'dia' || b.tipo_bloqueio === 'semana' || b.tipo_bloqueio === 'mes') return true;
            if (b.tipo_bloqueio === 'hora' && b.hora_inicio && b.hora_fim) {
              return appTimeStr >= b.hora_inicio && appTimeStr <= b.hora_fim;
            }
            if (b.tipo_bloqueio === 'manha') {
              return appTimeStr >= '06:00' && appTimeStr <= '12:00';
            }
            if (b.tipo_bloqueio === 'tarde') {
              return appTimeStr > '12:00' && appTimeStr <= '18:00';
            }
            return false;
          });

          if (isBlocked) {
            return { 
              success: false, 
              message: 'Horário indisponível: Existe um bloqueio ativo para este médico neste horário.',
              isBlocked: true
            };
          }
        }
      }

      // Buscar usuário logado
      const { data: { user } } = await supabase.auth.getUser();
      const usuarioId = user?.id;

      const payload = {
        empresa_id: selectedEmpresaId,
        medico_id: agendaData.medicoId || null,
        data_agendamento: agendaData.dataAgendamento,
        pet_id: agendaData.petId || null,
        tutor_cpf: agendaData.tutorCpf.trim(),
        tutor_nome: agendaData.tutorNome.trim(),
        pet_nome: agendaData.petNome.trim(),
        tutor_telefone: agendaData.tutorTelefone?.trim() || null,
        status: agendaData.status || 'Agendado',
        tipo: agendaData.tipo || 'Consulta',
        local: agendaData.local || null,
        created_by: usuarioId || null
      };

      const { error: insertError } = await supabase
        .from('pet_agenda')
        .insert(payload);

      if (insertError) throw insertError;

      return { success: true };
    } catch (e: any) {
      console.error("Error adding agenda: ", e);
      return { success: false, message: e.message || 'Falha ao realizar agendamento.' };
    }
  }, [supabase, selectedEmpresaId]);

  const fetchBloqueios = useCallback(async (medicoId?: string) => {
    if (!selectedEmpresaId) return [];
    try {
      let query = supabase
        .from('pet_agenda_bloqueios')
        .select(`*, medico:pet_usuarios(nome)`)
        .eq('empresa_id', selectedEmpresaId)
        .gte('data_fim', new Date().toISOString().split('T')[0]) // Só pegar bloqueios ativos hoje em diante
        .order('data_inicio', { ascending: true });

      if (medicoId && medicoId !== 'all') {
        query = query.eq('medico_id', medicoId);
      }

      const { data, error } = await query;
      console.log("[fetchBloqueios] Data from Supabase:", data, "Error:", error);
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error("Error fetching blocks: ", e);
      return [];
    }
  }, [supabase, selectedEmpresaId]);

  const addAgendaBloqueio = useCallback(async (bloqueioData: {
    medicoId: string | null;
    tipoBloqueio: 'hora' | 'dia' | 'manha' | 'tarde' | 'semana' | 'mes';
    dataInicio: string;
    dataFim: string;
    horaInicio: string | null;
    horaFim: string | null;
    local: string | null;
  }): Promise<{ success: boolean; message?: string }> => {
    try {
      if (!selectedEmpresaId) return { success: false, message: 'Clínica não selecionada' };
      
      const payload = {
        empresa_id: selectedEmpresaId,
        medico_id: bloqueioData.medicoId,
        tipo_bloqueio: bloqueioData.tipoBloqueio,
        data_inicio: bloqueioData.dataInicio,
        data_fim: bloqueioData.dataFim,
        hora_inicio: bloqueioData.horaInicio,
        hora_fim: bloqueioData.horaFim,
        local: bloqueioData.local
      };

      const { error } = await supabase.from('pet_agenda_bloqueios').insert(payload);
      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      console.error("Error adding block: ", e);
      return { success: false, message: e.message || 'Falha ao registrar bloqueio.' };
    }
  }, [supabase, selectedEmpresaId]);

  const deleteAgendaBloqueio = useCallback(async (id: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const { error: deleteError } = await supabase
        .from('pet_agenda_bloqueios')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      return { success: true };
    } catch (e: any) {
      console.error("Error deleting block: ", e);
      return { success: false, message: e.message || 'Falha ao excluir bloqueio.' };
    }
  }, [supabase]);

  const updateAgenda = useCallback(async (id: string, agendaData: {
    medicoId: string | null;
    dataAgendamento: string;
    petId: string | null;
    tutorCpf: string;
    tutorNome: string;
    petNome: string;
    tutorTelefone: string;
    status?: 'Agendado' | 'Cancelado' | 'Realizado' | 'Bloqueado';
    tipo?: 'Consulta' | 'Retorno' | 'Exame' | 'Cirurgia';
    local?: string;
  }): Promise<{ success: boolean; message?: string; isBlocked?: boolean }> => {
    try {
      const payload: any = {
        medico_id: agendaData.medicoId || null,
        data_agendamento: agendaData.dataAgendamento,
        pet_id: agendaData.petId || null,
        tutor_cpf: agendaData.tutorCpf.trim(),
        tutor_nome: agendaData.tutorNome.trim(),
        pet_nome: agendaData.petNome.trim(),
        tutor_telefone: agendaData.tutorTelefone?.trim() || null,
      };

      if (agendaData.status) {
        payload.status = agendaData.status;
      }

      if (agendaData.tipo) {
        payload.tipo = agendaData.tipo;
      }

      if (agendaData.local !== undefined) {
        payload.local = agendaData.local;
      }

      const { error: updateError } = await supabase
        .from('pet_agenda')
        .update(payload)
        .eq('id', id);

      if (updateError) throw updateError;

      return { success: true };
    } catch (e: any) {
      console.error("Error updating agenda: ", e);
      return { success: false, message: e.message || 'Falha ao atualizar agendamento.' };
    }
  }, [supabase]);

  const updateAgendaStatus = useCallback(async (id: string, status: 'Agendado' | 'Cancelado' | 'Realizado'): Promise<{ success: boolean; message?: string }> => {
    try {
      const { error: updateError } = await supabase
        .from('pet_agenda')
        .update({ status })
        .eq('id', id);

      if (updateError) throw updateError;

      return { success: true };
    } catch (e: any) {
      console.error("Error updating agenda status: ", e);
      return { success: false, message: e.message || 'Falha ao atualizar status do agendamento.' };
    }
  }, [supabase]);

  const deleteAgenda = useCallback(async (id: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const { error: deleteError } = await supabase
        .from('pet_agenda')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      return { success: true };
    } catch (e: any) {
      console.error("Error deleting agenda: ", e);
      return { success: false, message: e.message || 'Falha ao excluir agendamento.' };
    }
  }, [supabase]);

  const searchPetByCpfOrCode = useCallback(async (query: string): Promise<Pet[]> => {
    if (!selectedEmpresaId || !query || query.trim().length < 3) return [];
    
    try {
      const cleanQuery = query.trim();
      let dbQuery = supabase
        .from('pet_pets')
        .select('*')
        .eq('empresa_id', selectedEmpresaId);

      // Se a query parece CPF (apenas números ou tamanho compatível), ou contém código (PET...)
      if (cleanQuery.toUpperCase().startsWith('PET')) {
        dbQuery = dbQuery.eq('cod_pet', cleanQuery.toUpperCase());
      } else {
        // Tenta buscar por CPF exato ou código
        dbQuery = dbQuery.or(`tutor_cpf.eq.${cleanQuery},cod_pet.eq.${cleanQuery}`);
      }

      const { data, error: searchError } = await dbQuery;
      if (searchError) throw searchError;

      return (data || []).map((row: any) => ({
        id: row.id,
        codPet: row.cod_pet,
        nome: row.nome,
        especie: row.especie,
        raca: row.raca,
        sexo: row.sexo,
        idade: row.idade,
        dataNascimento: row.data_nascimento,
        tutorNome: row.tutor_nome,
        tutorCpf: row.tutor_cpf,
        tutorEmail: row.tutor_email,
        tutorTelefone: row.tutor_telefone,
        tutorEndereco: row.tutor_endereco,
        tutorCep: row.tutor_cep,
        tutorBairro: row.tutor_bairro,
        tutorCidade: row.tutor_cidade,
        tutorUf: row.tutor_uf,
        healthPlanCode: row.health_plan_code,
        healthPlanName: row.health_plan_name,
        matricula: row.matricula
      }));
    } catch (err) {
      console.error("Error searching pet: ", err);
      return [];
    }
  }, [supabase, selectedEmpresaId]);

  return {
    agenda,
    isLoading,
    error,
    fetchAgenda,
    addAgenda,
    addAgendaBloqueio,
    fetchBloqueios,
    deleteAgendaBloqueio,
    updateAgenda,
    updateAgendaStatus,
    deleteAgenda,
    searchPetByCpfOrCode
  };
}
