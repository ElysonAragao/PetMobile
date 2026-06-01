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

  const fetchAgenda = useCallback(async (filters?: { startDate?: string; endDate?: string; medicoId?: string }) => {
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
          created_at,
          medico:pet_usuarios(nome, crmv_uf),
          pet:pet_pets(nome, cod_pet)
        `)
        .eq('empresa_id', selectedEmpresaId);

      if (filters?.medicoId && filters.medicoId !== 'all') {
        query = query.eq('medico_id', filters.medicoId);
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
        createdAt: row.created_at,
        medico: row.medico ? { nome: row.medico.nome, crmv_uf: row.medico.crmv_uf } : undefined,
        pet: row.pet ? { nome: row.pet.nome, codPet: row.pet.cod_pet } : undefined
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
  }): Promise<{ success: boolean; message?: string }> => {
    try {
      if (!selectedEmpresaId) {
        return { success: false, message: 'Clínica não selecionada ou sessão expirada.' };
      }

      const payload = {
        empresa_id: selectedEmpresaId,
        medico_id: agendaData.medicoId || null,
        data_agendamento: agendaData.dataAgendamento,
        pet_id: agendaData.petId || null,
        tutor_cpf: agendaData.tutorCpf.trim(),
        tutor_nome: agendaData.tutorNome.trim(),
        pet_nome: agendaData.petNome.trim(),
        tutor_telefone: agendaData.tutorTelefone?.trim() || null,
        status: 'Agendado'
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
    updateAgendaStatus,
    deleteAgenda,
    searchPetByCpfOrCode
  };
}
