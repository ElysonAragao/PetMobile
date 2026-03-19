-- 1. Adicionar colunas em patients
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS cod_paciente text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS endereco text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS matricula text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS health_plan_code text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS health_plan_name text;

-- Renomear phone para telefone se ainda existir
DO $$
BEGIN
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='patients' and column_name='phone') THEN
    ALTER TABLE public.patients RENAME COLUMN phone TO telefone;
  END IF;
END $$;

-- 2. Adicionar colunas em medicos
ALTER TABLE public.medicos ADD COLUMN IF NOT EXISTS email text;

-- 3. Deletar duplicatas em patients (mantendo a mais antiga)
DELETE FROM public.patients a USING public.patients b WHERE a.cpf = b.cpf AND a.created_at > b.created_at;

-- Deletar duplicatas em medicos
DELETE FROM public.medicos a USING public.medicos b WHERE a.crm = b.crm AND a.created_at > b.created_at;

-- Deletar duplicatas em exames
-- Note: 'type' wasn't used in deletion condition to avoid grouping different exams with same name but maybe they are all duplicates anyway. Let's use name AND type.
DELETE FROM public.exams a USING public.exams b WHERE a.name = b.name AND a.type = b.type AND a.created_at > b.created_at;

-- Deletar duplicatas em planos
DELETE FROM public.health_plans a USING public.health_plans b WHERE a.name = b.name AND a.created_at > b.created_at;
