-- Adicionar coluna data_nascimento na tabela patients
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS data_nascimento date;
