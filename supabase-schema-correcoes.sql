-- Migração 3: Correções para compatibilidade com o Frontend existente
-- O Frontend trata "Exames" como um catálogo de Procedimentos/Exames (Nome, Tipo, Código).
-- O Frontend trata "Leituras" como os atendimentos que contêm 1 paciente, 1 médico, N exames.

-- 1. Recriar a tabela exams como um Catálogo de Exames em vez de agendamento:
DROP TABLE IF EXISTS public.leituras CASCADE;
DROP TABLE IF EXISTS public.exams CASCADE;

CREATE TABLE public.exams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('Laboratório', 'Imagem')),
  code text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation Select" ON public.exams FOR SELECT USING (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Insert" ON public.exams FOR INSERT WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Update" ON public.exams FOR UPDATE USING (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Delete" ON public.exams FOR DELETE USING (tenant_id IN (SELECT public.user_tenant_ids()));

-- 2. Recriar Leituras armazenando campos diretos ou via JOIN
-- Como o frontend salva 'exames' como um JSON ou array no Firebase,
-- no Postgres vamos usar uma tabela associativa 'leitura_exames' E 'metadata' como JSONB 
-- para campos adicionais flexíveis.
CREATE TABLE public.leituras (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  paciente_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  medico_id uuid REFERENCES public.medicos(id) ON DELETE SET NULL,
  cod_leitura text NOT NULL,
  data_leitura timestamp with time zone NOT NULL,
  status text DEFAULT 'Realizado',
  metadata jsonb, -- Guarda plano de saúde na hora, etc.
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.leituras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation Select" ON public.leituras FOR SELECT USING (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Insert" ON public.leituras FOR INSERT WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Update" ON public.leituras FOR UPDATE USING (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Delete" ON public.leituras FOR DELETE USING (tenant_id IN (SELECT public.user_tenant_ids()));

-- Tabela associativa: 1 Leitura = N Exames
CREATE TABLE public.leitura_exames (
  leitura_id uuid REFERENCES public.leituras(id) ON DELETE CASCADE NOT NULL,
  exam_id uuid REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (leitura_id, exam_id)
);

ALTER TABLE public.leitura_exames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolation Select" ON public.leitura_exames FOR SELECT USING (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Insert" ON public.leitura_exames FOR INSERT WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Update" ON public.leitura_exames FOR UPDATE USING (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Delete" ON public.leitura_exames FOR DELETE USING (tenant_id IN (SELECT public.user_tenant_ids()));
