"use client";

import * as React from 'react';
import { useCallback, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Patient } from '@/lib/types';
import { useSession } from '@/context/session-context';
import { z } from "zod";

const patientSchema = z.object({
  codPaciente: z.string().optional(),
  cpf: z.string().min(11, "CPF deve ter no mínimo 11 dígitos").max(14, "CPF inválido"), // Allow masks
  name: z.string().min(1, "Nome é obrigatório"), // Mantivemos o nome obrigatório na UI para listagem
  email: z.string().email("E-mail inválido").or(z.literal('')).optional().default(''),
  endereco: z.string().optional().or(z.literal('')),
  telefone: z.string().optional().or(z.literal('')),
  dataNascimento: z.string().optional().or(z.literal('')),
  idade: z.string().optional().or(z.literal('')),
  genero: z.string().optional().or(z.literal('')),
  matricula: z.string().optional().or(z.literal('')),
  healthPlanCode: z.string().min(1, "Plano de saúde é obrigatório"),
  healthPlanName: z.string().min(1, "Plano de saúde é obrigatório"),
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

export type PatientFormValues = z.infer<typeof patientSchema>;

async function getNextPatientCode(supabase: any): Promise<string> {
  const prefix = 'PAC';

  const { data, error } = await supabase
    .from('pacientes')
    .select('cod_paciente')
    .order('cod_paciente', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return `${prefix}00001`;
  }

  const lastCode = data[0].cod_paciente as string;
  if (lastCode && lastCode.startsWith(prefix)) {
    const numberPart = parseInt(lastCode.substring(prefix.length));
    if (!isNaN(numberPart)) {
      const nextNumber = numberPart + 1;
      return `${prefix}${nextNumber.toString().padStart(5, '0')}`;
    }
  }

  return `${prefix}00001`; // fallback start
}

export function usePatients() {
  const supabase = React.useMemo(() => createClient(), []);
  const { selectedEmpresaId, isLoading: sessionLoading } = useSession();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchInProgress = React.useRef(false);
  const isLoadedRef = React.useRef(false);

  const fetchPatients = useCallback(async () => {
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;
    
    if (!isLoadedRef.current) {
      setIsLoading(true);
    }
    try {
      console.log("Iniciando busca de pacientes para empresa:", selectedEmpresaId);
      let query = supabase
        .from('pacientes')
        .select('id, name:nome, cpf, telefone, email, endereco, matricula, dataNascimento:data_nascimento, idade, genero, codPaciente:cod_paciente, healthPlanCode:health_plan_code, healthPlanName:health_plan_name, created_at')
        .order('nome');

      if (selectedEmpresaId) {
        query = query.eq('empresa_id', selectedEmpresaId);
      }

      const { data, error } = await query;
      if (error) throw error;

      console.log(`Pacientes carregados: ${data?.length || 0}`);
      setPatients(data as unknown as Patient[]);
    } catch (err: any) {
      console.error("Error loading patients: ", err);
      setError(err);
    } finally {
      isLoadedRef.current = true;
      setIsLoaded(true);
      setIsLoading(false);
      fetchInProgress.current = false;
    }
  }, [supabase, selectedEmpresaId]);

  useEffect(() => {
    // Dispara a busca sempre que o hook é montado, desde que a sessão já esteja pronta
    // e os dados ainda não tenham sido carregados.
    if (!sessionLoading && !isLoadedRef.current) {
      fetchPatients();
    }
  }, [fetchPatients, sessionLoading]);

  const findPatientByCpf = useCallback(async (cpf: string): Promise<Patient | null> => {
    let query = supabase
      .from('pacientes')
      .select('id, name:nome, cpf, telefone, email, endereco, matricula, dataNascimento:data_nascimento, idade, genero, codPaciente:cod_paciente, healthPlanCode:health_plan_code, healthPlanName:health_plan_name, created_at')
      .eq('cpf', cpf);

    if (selectedEmpresaId) {
      query = query.eq('empresa_id', selectedEmpresaId);
    }

    const { data, error } = await query.limit(1);

    if (error || !data || data.length === 0) return null;
    return data[0] as Patient;
  }, [supabase, selectedEmpresaId]);


  const addPatient = useCallback(async (patientData: PatientFormValues): Promise<{ success: boolean, message?: string, newPatientId?: string }> => {
    try {
      // Check for existing patient with the same CPF
      const existingPatient = await findPatientByCpf(patientData.cpf);
      if (existingPatient) {
        return { success: false, message: 'CPF já cadastrado no sistema.' };
      }

      const nextCode = await getNextPatientCode(supabase);

      if (!selectedEmpresaId) {
        return { success: false, message: 'Usuário ou sistema não vinculado a nenhuma empresa.' };
      }

      const finalPatientData = {
        nome: patientData.name,
        cpf: patientData.cpf,
        telefone: patientData.telefone,
        email: patientData.email,
        endereco: patientData.endereco,
        data_nascimento: patientData.dataNascimento || null,
        idade: patientData.dataNascimento ? calculateAge(patientData.dataNascimento) : (patientData.idade || null),
        genero: patientData.genero || null,
        matricula: patientData.matricula,
        cod_paciente: nextCode,
        health_plan_code: patientData.healthPlanCode,
        health_plan_name: patientData.healthPlanName,
        empresa_id: selectedEmpresaId
      };

      const { data, error: insertError } = await supabase
        .from('pacientes')
        .insert(finalPatientData)
        .select('id')
        .single();

      if (insertError) throw insertError;

      fetchPatients();
      return { success: true, newPatientId: data.id };
    } catch (e: any) {
      console.error("Error adding patient: ", e);
      return { success: false, message: e.message || 'Falha ao adicionar paciente.' };
    }
  }, [supabase, findPatientByCpf, fetchPatients, selectedEmpresaId]);

  const updatePatient = useCallback(async (patientId: string, patientData: Partial<PatientFormValues>): Promise<{ success: boolean, message?: string }> => {
    try {
      const dataToUpdate: any = { ...patientData };
      delete dataToUpdate.cpf;
      delete dataToUpdate.codPaciente;

      // map name to nome
      if (dataToUpdate.name !== undefined) {
        dataToUpdate.nome = dataToUpdate.name;
        delete dataToUpdate.name;
      }

      // map dataNascimento to data_nascimento for update
      if (dataToUpdate.dataNascimento !== undefined) {
        dataToUpdate.data_nascimento = dataToUpdate.dataNascimento || null;
        if (dataToUpdate.data_nascimento) {
          dataToUpdate.idade = calculateAge(dataToUpdate.data_nascimento);
        }
        delete dataToUpdate.dataNascimento;
      }
      if (dataToUpdate.healthPlanCode !== undefined) {
        dataToUpdate.health_plan_code = dataToUpdate.healthPlanCode;
        delete dataToUpdate.healthPlanCode;
      }
      if (dataToUpdate.healthPlanName !== undefined) {
        dataToUpdate.health_plan_name = dataToUpdate.healthPlanName;
        delete dataToUpdate.healthPlanName;
      }

      const { error: updateError } = await supabase
        .from('pacientes')
        .update(dataToUpdate)
        .eq('id', patientId);

      if (updateError) throw updateError;

      fetchPatients();
      return { success: true };
    } catch (e: any) {
      console.error("Error updating patient: ", e);
      return { success: false, message: e.message || 'Falha ao atualizar paciente.' };
    }
  }, [supabase, fetchPatients]);

  const deletePatient = useCallback(async (patientId: string) => {
    try {
      const { error } = await supabase
        .from('pacientes')
        .delete()
        .eq('id', patientId);
      if (error) throw error;
      fetchPatients();
    } catch (e) {
      console.error("Error deleting patient: ", e);
    }
  }, [supabase, fetchPatients]);

  return { patients, addPatient, updatePatient, deletePatient, findPatientByCpf, isLoaded, isLoading, error };
}
