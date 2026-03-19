-- Migração 1: Estrutura Base Multi-tenant

-- 1. Criação da tabela de Tenants (Empresas)
CREATE TABLE public.tenants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar RLS (Segurança Mínima)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 3. Criação da tabela auxiliar de Vínculo de Usuário x Tenant
-- Como o Supabase Auth guarda os usuários no schema auth.users, criamos uma tabela
-- pública para sabermos qual usuário pertence a qual empresa.
CREATE TABLE public.user_tenants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, tenant_id)
);

ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

-- 4. Funções auxiliares para RLS
-- Esta função descobre os tenants que o usuário atual tem acesso
CREATE OR REPLACE FUNCTION public.user_tenant_ids()
RETURNS TABLE (tenant_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()
$$;

-- 5. Tabelas Operacionais (todas agora com tenant_id)

-- Médicos
CREATE TABLE public.medicos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  crm text,
  specialty text,
  phone text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Pacientes
CREATE TABLE public.patients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  cpf text,
  birth_date date,
  phone text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Planos de Saúde
CREATE TABLE public.health_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  ans_code text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Exames
CREATE TABLE public.exams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  medico_id uuid REFERENCES public.medicos(id) ON DELETE SET NULL,
  date timestamp with time zone NOT NULL,
  type text NOT NULL,
  status text DEFAULT 'scheduled',
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Leituras (QR Codes/Scans)
CREATE TABLE public.leituras (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  exam_id uuid REFERENCES public.exams(id) ON DELETE SET NULL,
  qr_code_data text NOT NULL,
  scanned_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Habilitar RLS em todas as tabelas operacionais
ALTER TABLE public.medicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leituras ENABLE ROW LEVEL SECURITY;

-- 7. Políticas (Policies) baseadas em Tenant
-- Garante que operações SELECT/INSERT/UPDATE/DELETE só afetem linhas do próprio tenant do usuário.

-- Politíca Genérica: Você só pode ver se o seu uid() estiver vinculado ao tenant_id da linha
-- Aplica-se às 5 tabelas principais
CREATE POLICY "Tenant Isolation Select" ON public.medicos FOR SELECT USING (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Insert" ON public.medicos FOR INSERT WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Update" ON public.medicos FOR UPDATE USING (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Delete" ON public.medicos FOR DELETE USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "Tenant Isolation Select" ON public.patients FOR SELECT USING (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Insert" ON public.patients FOR INSERT WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Update" ON public.patients FOR UPDATE USING (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Delete" ON public.patients FOR DELETE USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "Tenant Isolation Select" ON public.health_plans FOR SELECT USING (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Insert" ON public.health_plans FOR INSERT WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Update" ON public.health_plans FOR UPDATE USING (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Delete" ON public.health_plans FOR DELETE USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "Tenant Isolation Select" ON public.exams FOR SELECT USING (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Insert" ON public.exams FOR INSERT WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Update" ON public.exams FOR UPDATE USING (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Delete" ON public.exams FOR DELETE USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "Tenant Isolation Select" ON public.leituras FOR SELECT USING (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Insert" ON public.leituras FOR INSERT WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Update" ON public.leituras FOR UPDATE USING (tenant_id IN (SELECT public.user_tenant_ids()));
CREATE POLICY "Tenant Isolation Delete" ON public.leituras FOR DELETE USING (tenant_id IN (SELECT public.user_tenant_ids()));

-- 8. Política para o próprio vínculo user_tenant (O usuário só enxerga seus vínculos)
CREATE POLICY "Users can see their own tenant linkages" ON public.user_tenants FOR SELECT USING (user_id = auth.uid());

-- 9. Política para a tabela de Tenants (O usuário só enxerga tenants aos quais ele pertence)
CREATE POLICY "Users can view their tenants" ON public.tenants FOR SELECT USING (
  id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid())
);
