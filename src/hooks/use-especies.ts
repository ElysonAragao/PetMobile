"use client";

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Especie {
  id: string;
  nome: string;
}

export function useEspecies() {
  const [especies, setEspecies] = React.useState<Especie[]>([]);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const supabase = React.useMemo(() => createClient(), []);

  const fetchEspecies = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('pet_especies')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      if (data) setEspecies(data as Especie[]);
    } catch (e) {
      console.error("Erro ao carregar espécies:", e);
    } finally {
      setIsLoaded(true);
    }
  }, [supabase]);

  const addEspecie = async (nome: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('pet_especies')
        .insert([{ nome: nome.trim() }])
        .select()
        .single();

      if (error) throw error;
      setEspecies(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    } finally {
      setIsLoading(false);
    }
  };

  const updateEspecie = async (id: string, nome: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('pet_especies')
        .update({ nome: nome.trim() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setEspecies(prev => prev.map(e => e.id === id ? (data as Especie) : e).sort((a, b) => a.nome.localeCompare(b.nome)));
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    } finally {
      setIsLoading(false);
    }
  };

  const deleteEspecie = async (id: string) => {
    try {
      const { error } = await supabase
        .from('pet_especies')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setEspecies(prev => prev.filter(e => e.id !== id));
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  React.useEffect(() => {
    fetchEspecies();
  }, [fetchEspecies]);

  return { especies, isLoaded, isLoading, addEspecie, updateEspecie, deleteEspecie, refresh: fetchEspecies };
}
