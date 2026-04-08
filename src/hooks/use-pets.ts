"use client";

import * as React from 'react';
import { useCallback, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Pet } from '@/lib/types';
import { useSession } from '@/context/session-context';
import { z } from "zod";

const petSchema = z.object({
  codPet: z.string().optional(),
  nome: z.string().min(1, "Nome do pet é obrigatório"),
  especie: z.string().min(1, "Espécie é obrigatória (Cão, Gato, etc)"),
  raca: z.string().optional().or(z.literal('')),
  sexo: z.enum(['M', 'F'], { required_error: "Sexo é obrigatório" }),
  idade: z.string().optional().or(z.literal('')),
  dataNascimento: z.string().optional().or(z.literal('')).nullable(),
  tutorNome: z.string().min(1, "Nome do tutor é obrigatório"),
  tutorCpf: z.string().min(11, "CPF do tutor deve ter no mínimo 11 dígitos").max(14, "CPF inválido"),
  tutorEmail: z.string().email("E-mail inválido").or(z.literal('')).optional().default(''),
  tutorTelefone: z.string().min(1, "Telefone do tutor é obrigatório"),
  tutorEndereco: z.string().optional().or(z.literal('')),
  tutorCep: z.string().optional().or(z.literal('')),
  tutorBairro: z.string().optional().or(z.literal('')),
  tutorCidade: z.string().optional().or(z.literal('')),
  tutorUf: z.string().optional().or(z.literal('')),
  matricula: z.string().optional().or(z.literal('')), 
  healthPlanCode: z.string().optional().or(z.literal('')),
  healthPlanName: z.string().optional().or(z.literal('')),
});

export const calculateAge = (birthDate: string): string => {
  if (!birthDate) return '';
  const birth = new Date(birthDate);
  const now = new Date();
  
  let years = now.getFullYear() - birth.getUTCFullYear();
  let months = now.getMonth() - birth.getUTCMonth();
  
  if (now.getDate() < birth.getUTCDate()) {
    months--;
  }
  
  if (months < 0) {
    years--;
    months += 12;
  }
  
  if (years >= 1) {
    return `${years} ${years === 1 ? 'ano' : 'anos'}`;
  }
  
  if (months >= 1) {
    return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  }
  
  return 'Recém-nascido';
};

export type PetFormValues = z.infer<typeof petSchema>;

async function getNextPetCode(supabase: any): Promise<string> {
  const prefix = 'PET';

  const { data, error } = await supabase
    .from('pet_pets')
    .select('cod_pet')
    .order('cod_pet', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return `${prefix}00001`;
  }

  const lastCode = data[0].cod_pet as string;
  if (lastCode && lastCode.startsWith(prefix)) {
    const numberPart = parseInt(lastCode.substring(prefix.length));
    if (!isNaN(numberPart)) {
      const nextNumber = numberPart + 1;
      return `${prefix}${nextNumber.toString().padStart(5, '0')}`;
    }
  }

  return `${prefix}00001`; // fallback start
}

export function usePets() {
  const supabase = React.useMemo(() => createClient(), []);
  const { selectedEmpresaId, isLoading: sessionLoading } = useSession();
  const [pets, setPets] = useState<Pet[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchInProgress = React.useRef(false);
  const isLoadedRef = React.useRef(false);

  const fetchPets = useCallback(async () => {
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;
    
    if (!isLoadedRef.current) {
      setIsLoading(true);
    }
    try {
      console.log("Iniciando busca de pets para clínica:", selectedEmpresaId);
      let query = supabase
        .from('pet_pets')
        .select(`
          id, 
          nome, 
          especie, 
          raca, 
          sexo, 
          idade, 
          data_nascimento, 
          tutor_nome, 
          tutor_cpf, 
          tutor_email, 
          tutor_telefone, 
          tutor_endereco, 
          tutor_cep,
          tutor_bairro,
          tutor_cidade,
          tutor_uf,
          matricula, 
          cod_pet, 
          health_plan_code, 
          health_plan_name, 
          created_at
        `)
        .order('nome');

      if (selectedEmpresaId) {
        query = query.eq('empresa_id', selectedEmpresaId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Map DB cols to Frontend interface
      const mappedData: Pet[] = (data || []).map((row: any) => ({
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

      console.log(`Pets carregados: ${mappedData.length}`);
      setPets(mappedData);
    } catch (err: any) {
      console.error("Error loading pets: ", err);
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
      fetchPets();
    }
  }, [fetchPets, sessionLoading]);

  const findPetByTutorCpf = useCallback(async (tutorCpf: string): Promise<Pet[]> => {
    let query = supabase
      .from('pet_pets')
      .select('*')
      .eq('tutor_cpf', tutorCpf);

    if (selectedEmpresaId) {
      query = query.eq('empresa_id', selectedEmpresaId);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    
    return data.map((row: any) => ({
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
  }, [supabase, selectedEmpresaId]);


  const addPet = useCallback(async (petData: PetFormValues): Promise<{ success: boolean, message?: string, newPetId?: string }> => {
    try {
      const nextCode = await getNextPetCode(supabase);

      if (!selectedEmpresaId) {
        return { success: false, message: 'Usuário ou sistema não vinculado a nenhuma clínica.' };
      }

      const finalPetData = {
        nome: petData.nome,
        especie: petData.especie,
        raca: petData.raca || null,
        sexo: petData.sexo,
        tutor_nome: petData.tutorNome,
        tutor_cpf: petData.tutorCpf,
        tutor_email: petData.tutorEmail,
        tutor_telefone: petData.tutorTelefone,
        tutor_endereco: petData.tutorEndereco,
        tutor_cep: petData.tutorCep || null,
        tutor_bairro: petData.tutorBairro || null,
        tutor_cidade: petData.tutorCidade || null,
        tutor_uf: petData.tutorUf || null,
        data_nascimento: petData.dataNascimento || null,
        idade: petData.dataNascimento ? calculateAge(petData.dataNascimento) : (petData.idade || null),
        matricula: petData.matricula,
        cod_pet: nextCode,
        health_plan_code: petData.healthPlanCode,
        health_plan_name: petData.healthPlanName,
        empresa_id: selectedEmpresaId
      };

      const { data, error: insertError } = await supabase
        .from('pet_pets')
        .insert(finalPetData)
        .select('id')
        .single();

      if (insertError) throw insertError;

      fetchPets();
      return { success: true, newPetId: data.id };
    } catch (e: any) {
      console.error("Error adding pet: ", e);
      return { success: false, message: e.message || 'Falha ao adicionar pet.' };
    }
  }, [supabase, fetchPets, selectedEmpresaId]);

  const updatePet = useCallback(async (petId: string, petData: Partial<PetFormValues>): Promise<{ success: boolean, message?: string }> => {
    try {
      const dataToUpdate: any = {};
      
      if (petData.nome !== undefined) dataToUpdate.nome = petData.nome;
      if (petData.especie !== undefined) dataToUpdate.especie = petData.especie;
      if (petData.raca !== undefined) dataToUpdate.raca = petData.raca;
      if (petData.sexo !== undefined) dataToUpdate.sexo = petData.sexo;
      if (petData.tutorNome !== undefined) dataToUpdate.tutor_nome = petData.tutorNome;
      if (petData.tutorCpf !== undefined) dataToUpdate.tutor_cpf = petData.tutorCpf;
      if (petData.tutorEmail !== undefined) dataToUpdate.tutor_email = petData.tutorEmail;
      if (petData.tutorTelefone !== undefined) dataToUpdate.tutor_telefone = petData.tutorTelefone;
      if (petData.tutorEndereco !== undefined) dataToUpdate.tutor_endereco = petData.tutorEndereco;
      if (petData.tutorCep !== undefined) dataToUpdate.tutor_cep = petData.tutorCep;
      if (petData.tutorBairro !== undefined) dataToUpdate.tutor_bairro = petData.tutorBairro;
      if (petData.tutorCidade !== undefined) dataToUpdate.tutor_cidade = petData.tutorCidade;
      if (petData.tutorUf !== undefined) dataToUpdate.tutor_uf = petData.tutorUf;
      if (petData.matricula !== undefined) dataToUpdate.matricula = petData.matricula;
      
      if (petData.dataNascimento !== undefined) {
        dataToUpdate.data_nascimento = petData.dataNascimento || null;
        if (dataToUpdate.data_nascimento) {
          dataToUpdate.idade = calculateAge(dataToUpdate.data_nascimento);
        }
      } else if (petData.idade !== undefined) {
          dataToUpdate.idade = petData.idade;
      }

      if (petData.healthPlanCode !== undefined) dataToUpdate.health_plan_code = petData.healthPlanCode;
      if (petData.healthPlanName !== undefined) dataToUpdate.health_plan_name = petData.healthPlanName;

      const { error: updateError } = await supabase
        .from('pet_pets')
        .update(dataToUpdate)
        .eq('id', petId);

      if (updateError) throw updateError;

      fetchPets();
      return { success: true };
    } catch (e: any) {
      console.error("Error updating pet: ", e);
      return { success: false, message: e.message || 'Falha ao atualizar pet.' };
    }
  }, [supabase, fetchPets]);

  const deletePet = useCallback(async (petId: string) => {
    try {
      const { error } = await supabase
        .from('pet_pets')
        .delete()
        .eq('id', petId);
      if (error) throw error;
      fetchPets();
    } catch (e) {
      console.error("Error deleting pet: ", e);
    }
  }, [supabase, fetchPets]);

  return { pets, addPet, updatePet, deletePet, findPetByTutorCpf, isLoaded, isLoading, error };
}
