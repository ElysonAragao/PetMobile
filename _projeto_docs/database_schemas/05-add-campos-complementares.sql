-- Script para adicionar campos complementares na tabela pet_pets
-- Execute este comando no painel SQL Editor do Supabase.

ALTER TABLE public.pet_pets 
ADD COLUMN IF NOT EXISTS id_registro text,
ADD COLUMN IF NOT EXISTS dados_familiares_ativo boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pai_nome text,
ADD COLUMN IF NOT EXISTS pai_registro text,
ADD COLUMN IF NOT EXISTS pai_inseminacao boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS semen_registro text,
ADD COLUMN IF NOT EXISTS mae_nome text,
ADD COLUMN IF NOT EXISTS mae_registro text,
ADD COLUMN IF NOT EXISTS pai_pedigree text,
ADD COLUMN IF NOT EXISTS mae_pedigree text,
ADD COLUMN IF NOT EXISTS dados_movimentacao_ativo boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pesagens jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS status_reprodutivo text,
ADD COLUMN IF NOT EXISTS filhos jsonb DEFAULT '[]'::jsonb;
