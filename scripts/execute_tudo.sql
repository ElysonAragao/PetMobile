-- ==========================================
-- SCRIPT DE CRIAÇÃO DO BANCO MULTI-TENANT E USUÁRIO MASTER
-- ==========================================

-- 1. DROP DAS TABELAS ANTIGAS (APAGA TUDO)
DROP TABLE IF EXISTS public.leituras CASCADE;
DROP TABLE IF EXISTS public.movimentacoes CASCADE;
DROP TABLE IF EXISTS public.leitura_exames CASCADE;
DROP TABLE IF EXISTS public.exams CASCADE;
DROP TABLE IF EXISTS public.exames CASCADE;
DROP TABLE IF EXISTS public.exames_precos CASCADE;
DROP TABLE IF EXISTS public.health_plans CASCADE;
DROP TABLE IF EXISTS public.planos_saude CASCADE;
DROP TABLE IF EXISTS public.patients CASCADE;
DROP TABLE IF EXISTS public.pacientes CASCADE;
DROP TABLE IF EXISTS public.medicos CASCADE;
DROP TABLE IF EXISTS public.user_tenants CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;
DROP TABLE IF EXISTS public.empresas CASCADE;

-- 2. FUNÇÕES E SEQUÊNCIAS GLOBAIS
CREATE SEQUENCE IF NOT EXISTS public.empresa_codigo_seq START 1;

CREATE OR REPLACE FUNCTION public.gerar_codigo_empresa()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := 'E' || lpad(nextval('public.empresa_codigo_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- 3. CRIAÇÃO DAS TABELAS

-- EMPRESAS
CREATE TABLE public.empresas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo text,
  razao_social text NOT NULL,
  nome_fantasia text NOT NULL,
  endereco text,
  cep text,
  cidade text,
  estado text,
  cnpj text,
  email text,
  telefone text,
  contato text,
  validade date,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TRIGGER trg_gerar_codigo_empresa
  BEFORE INSERT ON public.empresas
  FOR EACH ROW
  EXECUTE FUNCTION public.gerar_codigo_empresa();

-- USUARIOS
CREATE TABLE public.usuarios (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE, -- NULL para Master
  codigo text,
  nome text NOT NULL,
  cpf text,
  crm_uf text,
  email text UNIQUE NOT NULL,
  telefone text,
  status text NOT NULL CHECK (status IN ('Master', 'Administrador', 'Administrador Auxiliar', 'Medico', 'Secretária', 'Leitor', 'Relatórios')),
  validade date,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- FUNÇÕES AUXILIARES
CREATE OR REPLACE FUNCTION public.is_master()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND status = 'Master')
$$;

CREATE OR REPLACE FUNCTION public.empresa_atual()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()
$$;

-- PACIENTES
CREATE TABLE public.pacientes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  cpf text,
  data_nascimento date,
  telefone text,
  email text,
  endereco text,
  matricula text,
  cod_paciente text,
  health_plan_code text,
  health_plan_name text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- PLANOS_SAUDE
CREATE TABLE public.planos_saude (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  ans_code text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- EXAMES
CREATE TABLE public.exames (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  codigo text,
  tipo text,
  descricao text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- EXAMES_PRECOS
CREATE TABLE public.exames_precos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  exame_id uuid REFERENCES public.exames(id) ON DELETE CASCADE NOT NULL,
  plano_id uuid REFERENCES public.planos_saude(id) ON DELETE CASCADE,
  nome text,
  preco_unitario numeric(10,2) DEFAULT 0.00,
  data_preco_atual date,
  fator_reajuste numeric(10,2),
  data_reajuste date,
  valor_reajustado numeric(10,2),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- LEITURAS (Scans)
CREATE TABLE public.leituras (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  paciente_id uuid REFERENCES public.pacientes(id) ON DELETE CASCADE NOT NULL,
  medico_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  cod_leitura text NOT NULL,
  data_leitura timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  status text DEFAULT 'Realizado',
  metadata jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- LEITURA_EXAMES
CREATE TABLE public.leitura_exames (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  leitura_id uuid REFERENCES public.leituras(id) ON DELETE CASCADE NOT NULL,
  exame_id uuid REFERENCES public.exames(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- MOVIMENTACOES (Guias)
CREATE TABLE public.movimentacoes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  "movimentoId" text NOT NULL UNIQUE,
  "pacienteId" uuid REFERENCES public.pacientes(id) ON DELETE CASCADE NOT NULL,
  "medicoId" uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  "exameIds" uuid[] DEFAULT '{}',
  data timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. HABILITAR RLS
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planos_saude ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exames_precos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leituras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leitura_exames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS DE RLS (Master tem acesso total)

-- EMPRESAS
CREATE POLICY "Empresas Select" ON public.empresas FOR SELECT USING (public.is_master() OR id = public.empresa_atual());
CREATE POLICY "Empresas Insert" ON public.empresas FOR INSERT WITH CHECK (public.is_master());
CREATE POLICY "Empresas Update" ON public.empresas FOR UPDATE USING (public.is_master());
CREATE POLICY "Empresas Delete" ON public.empresas FOR DELETE USING (public.is_master());

-- USUARIOS
CREATE POLICY "Usuarios Select" ON public.usuarios FOR SELECT USING (public.is_master() OR empresa_id = public.empresa_atual() OR id = auth.uid());
CREATE POLICY "Usuarios Insert" ON public.usuarios FOR INSERT WITH CHECK (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "Usuarios Update" ON public.usuarios FOR UPDATE USING (public.is_master() OR (empresa_id = public.empresa_atual() OR id = auth.uid()));
CREATE POLICY "Usuarios Delete" ON public.usuarios FOR DELETE USING (public.is_master() OR empresa_id = public.empresa_atual());

-- PACIENTES
CREATE POLICY "Pacientes Select" ON public.pacientes FOR SELECT USING (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "Pacientes Insert" ON public.pacientes FOR INSERT WITH CHECK (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "Pacientes Update" ON public.pacientes FOR UPDATE USING (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "Pacientes Delete" ON public.pacientes FOR DELETE USING (public.is_master() OR empresa_id = public.empresa_atual());

-- PLANOS_SAUDE
CREATE POLICY "Planos Select" ON public.planos_saude FOR SELECT USING (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "Planos Insert" ON public.planos_saude FOR INSERT WITH CHECK (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "Planos Update" ON public.planos_saude FOR UPDATE USING (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "Planos Delete" ON public.planos_saude FOR DELETE USING (public.is_master() OR empresa_id = public.empresa_atual());

-- EXAMES
CREATE POLICY "Exames Select" ON public.exames FOR SELECT USING (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "Exames Insert" ON public.exames FOR INSERT WITH CHECK (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "Exames Update" ON public.exames FOR UPDATE USING (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "Exames Delete" ON public.exames FOR DELETE USING (public.is_master() OR empresa_id = public.empresa_atual());

-- EXAMES_PRECOS
CREATE POLICY "Precos Select" ON public.exames_precos FOR SELECT USING (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "Precos Insert" ON public.exames_precos FOR INSERT WITH CHECK (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "Precos Update" ON public.exames_precos FOR UPDATE USING (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "Precos Delete" ON public.exames_precos FOR DELETE USING (public.is_master() OR empresa_id = public.empresa_atual());

-- LEITURAS
CREATE POLICY "Leituras Select" ON public.leituras FOR SELECT USING (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "Leituras Insert" ON public.leituras FOR INSERT WITH CHECK (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "Leituras Update" ON public.leituras FOR UPDATE USING (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "Leituras Delete" ON public.leituras FOR DELETE USING (public.is_master() OR empresa_id = public.empresa_atual());

-- LEITURA_EXAMES
CREATE POLICY "LeituraExames Select" ON public.leitura_exames FOR SELECT USING (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "LeituraExames Insert" ON public.leitura_exames FOR INSERT WITH CHECK (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "LeituraExames Update" ON public.leitura_exames FOR UPDATE USING (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "LeituraExames Delete" ON public.leitura_exames FOR DELETE USING (public.is_master() OR empresa_id = public.empresa_atual());

-- MOVIMENTACOES
CREATE POLICY "Movimentacoes Select" ON public.movimentacoes FOR SELECT USING (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "Movimentacoes Insert" ON public.movimentacoes FOR INSERT WITH CHECK (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "Movimentacoes Update" ON public.movimentacoes FOR UPDATE USING (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "Movimentacoes Delete" ON public.movimentacoes FOR DELETE USING (public.is_master() OR empresa_id = public.empresa_atual());
CREATE POLICY "LeituraExames Delete" ON public.leitura_exames FOR DELETE USING (public.is_master() OR empresa_id = public.empresa_atual());

-- ==========================================
-- 5. CRIAÇÃO DO USUÁRIO MASTER
-- ==========================================

DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
  user_email text := 'elysonaragao@gmail.com';
  user_pass text := 'Admin1234';
BEGIN
  -- 1. Remove o usuário antigo do Auth se existir (para evitar erro de e-mail duplicado)
  DELETE FROM auth.users WHERE email = user_email;

  -- 2. Cria o usuário na tabela auth.users do Supabase
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', user_email, crypt(user_pass, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );

  -- 3. Adiciona na tabela auth.identities
  INSERT INTO auth.identities (
    id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), new_user_id::text, new_user_id, format('{"sub":"%s","email":"%s"}', new_user_id::text, user_email)::jsonb, 'email', now(), now(), now()
  );

  -- 4. Cria o perfil Master na nossa tabela public.usuarios
  INSERT INTO public.usuarios (id, nome, email, status, empresa_id)
  VALUES (new_user_id, 'Elyson Aragão', user_email, 'Master', null);
  
END $$;
