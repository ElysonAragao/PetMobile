-- ==========================================
-- CRIAR TABELA MOVIMENTACOES (Guias)
-- Execute este script no Supabase SQL Editor
-- ==========================================

-- 1. Criar a tabela
CREATE TABLE IF NOT EXISTS public.movimentacoes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  "movimentoId" text NOT NULL UNIQUE,
  "pacienteId" uuid REFERENCES public.pacientes(id) ON DELETE CASCADE NOT NULL,
  "medicoId" uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  "exameIds" uuid[] DEFAULT '{}',
  data timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar RLS
ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de RLS (mesmo padrão das outras tabelas)
CREATE POLICY "Movimentacoes Select" ON public.movimentacoes FOR SELECT USING (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "Movimentacoes Insert" ON public.movimentacoes FOR INSERT WITH CHECK (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "Movimentacoes Update" ON public.movimentacoes FOR UPDATE USING (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "Movimentacoes Delete" ON public.movimentacoes FOR DELETE USING (public.is_master() OR empresa_id = public.empresa_atual());
