-- SCRIPT UNIFICADO: ATUALIZAÇÕES DO CADASTRO DE PETS
-- Cole e execute tudo de uma vez no SQL Editor do Supabase.

-- 1. Permite que um Tutor (CPF) tenha múltiplos Pets (remove a restrição única)
ALTER TABLE public.pet_pets DROP CONSTRAINT IF EXISTS pet_pets_tutor_cpf_key;

-- 2. Adiciona os novos campos complementares (Tatuagem, Família e Saúde)
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

-- 3. Atualiza os códigos de Pets antigos (de 5 para 6 dígitos) para manter a sequência correta
UPDATE public.pet_pets
SET cod_pet = 'PET' || LPAD(SUBSTRING(cod_pet FROM 4), 6, '0')
WHERE cod_pet LIKE 'PET%';
