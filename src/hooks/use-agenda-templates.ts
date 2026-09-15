"use client";

import { useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AgendaTemplate, AgendaTemplateEtapa } from '@/lib/types';
import { useSession } from '@/context/session-context';

export function useAgendaTemplates() {
  const supabase = createClient();
  const { selectedEmpresaId } = useSession();
  const [templates, setTemplates] = useState<AgendaTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!selectedEmpresaId) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('pet_agenda_templates')
        .select(`
          id,
          empresa_id,
          nome,
          pular_finais_de_semana,
          created_at,
          pet_agenda_template_etapas (
            id,
            template_id,
            ordem,
            nome_etapa,
            dias_apos_anterior
          )
        `)
        .eq('empresa_id', selectedEmpresaId)
        .order('nome', { ascending: true });

      if (fetchError) throw fetchError;

      const mappedData: AgendaTemplate[] = (data || []).map((row: any) => ({
        id: row.id,
        empresaId: row.empresa_id,
        nome: row.nome,
        pularFinaisDeSemana: row.pular_finais_de_semana,
        createdAt: row.created_at,
        etapas: (row.pet_agenda_template_etapas || [])
          .map((e: any) => ({
            id: e.id,
            templateId: e.template_id,
            ordem: e.ordem,
            nomeEtapa: e.nome_etapa,
            diasAposAnterior: e.dias_apos_anterior
          }))
          .sort((a: any, b: any) => a.ordem - b.ordem)
      }));

      setTemplates(mappedData);
    } catch (err: any) {
      console.error("Error loading templates: ", err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, selectedEmpresaId]);

  const saveTemplate = useCallback(async (
    templateData: {
      id?: string;
      nome: string;
      pularFinaisDeSemana: boolean;
      etapas: { ordem: number; nomeEtapa: string; diasAposAnterior: number }[];
    }
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      if (!selectedEmpresaId) throw new Error("Clínica não selecionada.");

      let templateId = templateData.id;

      if (templateId) {
        // Atualizar existente
        const { error: updateError } = await supabase
          .from('pet_agenda_templates')
          .update({
            nome: templateData.nome,
            pular_finais_de_semana: templateData.pularFinaisDeSemana
          })
          .eq('id', templateId);
        if (updateError) throw updateError;

        // Deletar etapas antigas (cascade ou delete manual)
        await supabase.from('pet_agenda_template_etapas').delete().eq('template_id', templateId);
      } else {
        // Criar novo
        const { data, error: insertError } = await supabase
          .from('pet_agenda_templates')
          .insert({
            empresa_id: selectedEmpresaId,
            nome: templateData.nome,
            pular_finais_de_semana: templateData.pularFinaisDeSemana
          })
          .select('id')
          .single();
        if (insertError) throw insertError;
        templateId = data.id;
      }

      // Inserir etapas
      if (templateData.etapas.length > 0) {
        const etapasPayload = templateData.etapas.map(e => ({
          template_id: templateId,
          ordem: e.ordem,
          nome_etapa: e.nomeEtapa,
          dias_apos_anterior: e.diasAposAnterior
        }));

        const { error: etapasError } = await supabase
          .from('pet_agenda_template_etapas')
          .insert(etapasPayload);
        
        if (etapasError) throw etapasError;
      }

      await fetchTemplates();
      return { success: true };
    } catch (err: any) {
      console.error("Error saving template: ", err);
      return { success: false, message: err.message };
    }
  }, [supabase, selectedEmpresaId, fetchTemplates]);

  const deleteTemplate = useCallback(async (id: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const { error } = await supabase.from('pet_agenda_templates').delete().eq('id', id);
      if (error) throw error;
      
      setTemplates(prev => prev.filter(t => t.id !== id));
      return { success: true };
    } catch (err: any) {
      console.error("Error deleting template: ", err);
      return { success: false, message: err.message };
    }
  }, [supabase]);

  return {
    templates,
    isLoading,
    error,
    fetchTemplates,
    saveTemplate,
    deleteTemplate
  };
}
