-- ==========================================
-- SCRIPT DE CRIAÇÃO DO BANCO MULTI-TENANT
-- ==========================================

-- CUIDADO: O código abaixo dropa as tabelas antigas. Faça isso num banco de testes ou novo.
DROP TABLE IF EXISTS public.leituras CASCADE;
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

-- 1. EMPRESAS
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

-- 2. USUARIOS (Centraliza usuários e médicos)
CREATE TABLE public.usuarios (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE, -- NULL para Master
  codigo text,
  nome text NOT NULL,
  cpf text,
  crmv_uf text,
  email text UNIQUE NOT NULL,
  telefone text,
  status text NOT NULL CHECK (status IN ('Master', 'Administrador', 'Administrador Auxiliar', 'MedicoVet', 'MedicoVet Geral', 'Secretária', 'Secretária Geral', 'Leitor', 'Leitor Geral', 'Relatórios')),
  validade date,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Função: verifica se o usuário logado é Master
CREATE OR REPLACE FUNCTION public.is_master()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND status = 'Master')
$$;

-- Função: retorna a empresa_id do usuário logado (NULL para Master)
CREATE OR REPLACE FUNCTION public.empresa_atual()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()
$$;

-- 3. PACIENTES
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

-- 4. PLANOS_SAUDE
CREATE TABLE public.planos_saude (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  ans_code text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. EXAMES
CREATE TABLE public.exames (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  codigo text,
  tipo text,
  descricao text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. EXAMES_PRECOS
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


-- 7. LEITURAS (Scans)
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

-- Relacionamento Leituras <-> Exames (Muitos para Muitos)
CREATE TABLE public.leitura_exames (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  leitura_id uuid REFERENCES public.leituras(id) ON DELETE CASCADE NOT NULL,
  exame_id uuid REFERENCES public.exames(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- HABILITAR RLS (Row Level Security)
-- ==========================================
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planos_saude ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exames_precos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leituras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leitura_exames ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- POLÍTICAS DE RLS (Master tem acesso total)
-- ==========================================

-- EMPRESAS: Master vê todas; demais veem a própria
CREATE POLICY "Empresas Select" ON public.empresas FOR SELECT USING (
  public.is_master() OR id = public.empresa_atual()
);
CREATE POLICY "Empresas Insert" ON public.empresas FOR INSERT WITH CHECK (public.is_master());
CREATE POLICY "Empresas Update" ON public.empresas FOR UPDATE USING (public.is_master());
CREATE POLICY "Empresas Delete" ON public.empresas FOR DELETE USING (public.is_master());

-- USUARIOS: Master vê todos; demais veem da sua empresa + a si mesmo
CREATE POLICY "Usuarios Select" ON public.usuarios FOR SELECT USING (
  public.is_master() OR empresa_id = public.empresa_atual() OR id = auth.uid()
);
CREATE POLICY "Usuarios Insert" ON public.usuarios FOR INSERT WITH CHECK (
  public.is_master() OR empresa_id = public.empresa_atual()
);
CREATE POLICY "Usuarios Update" ON public.usuarios FOR UPDATE USING (
  public.is_master() OR empresa_id = public.empresa_atual()
);
CREATE POLICY "Usuarios Delete" ON public.usuarios FOR DELETE USING (
  public.is_master() OR empresa_id = public.empresa_atual()
);

-- PACIENTES: Master vê todos; demais veem da sua empresa
CREATE POLICY "Pacientes Select" ON public.pacientes FOR SELECT USING (
  public.is_master() OR empresa_id = public.empresa_atual()
);
CREATE POLICY "Pacientes Insert" ON public.pacientes FOR INSERT WITH CHECK (
  public.is_master() OR empresa_id = public.empresa_atual()
);
CREATE POLICY "Pacientes Update" ON public.pacientes FOR UPDATE USING (
  public.is_master() OR empresa_id = public.empresa_atual()
);
CREATE POLICY "Pacientes Delete" ON public.pacientes FOR DELETE USING (
  public.is_master() OR empresa_id = public.empresa_atual()
);

-- PLANOS_SAUDE
CREATE POLICY "Planos Select" ON public.planos_saude FOR SELECT USING (
  public.is_master() OR empresa_id = public.empresa_atual()
);
CREATE POLICY "Planos Insert" ON public.planos_saude FOR INSERT WITH CHECK (
  public.is_master() OR empresa_id = public.empresa_atual()
);
CREATE POLICY "Planos Update" ON public.planos_saude FOR UPDATE USING (
  public.is_master() OR empresa_id = public.empresa_atual()
);
CREATE POLICY "Planos Delete" ON public.planos_saude FOR DELETE USING (
  public.is_master() OR empresa_id = public.empresa_atual()
);

-- EXAMES
CREATE POLICY "Exames Select" ON public.exames FOR SELECT USING (
  public.is_master() OR empresa_id = public.empresa_atual()
);
CREATE POLICY "Exames Insert" ON public.exames FOR INSERT WITH CHECK (
  public.is_master() OR empresa_id = public.empresa_atual()
);
CREATE POLICY "Exames Update" ON public.exames FOR UPDATE USING (
  public.is_master() OR empresa_id = public.empresa_atual()
);
CREATE POLICY "Exames Delete" ON public.exames FOR DELETE USING (
  public.is_master() OR empresa_id = public.empresa_atual()
);

-- EXAMES_PRECOS
CREATE POLICY "Precos Select" ON public.exames_precos FOR SELECT USING (
  public.is_master() OR empresa_id = public.empresa_atual()
);
CREATE POLICY "Precos Insert" ON public.exames_precos FOR INSERT WITH CHECK (
  public.is_master() OR empresa_id = public.empresa_atual()
);
CREATE POLICY "Precos Update" ON public.exames_precos FOR UPDATE USING (
  public.is_master() OR empresa_id = public.empresa_atual()
);
CREATE POLICY "Precos Delete" ON public.exames_precos FOR DELETE USING (
  public.is_master() OR empresa_id = public.empresa_atual()
);

-- LEITURAS
CREATE POLICY "Leituras Select" ON public.leituras FOR SELECT USING (
  public.is_master() OR empresa_id = public.empresa_atual()
);
CREATE POLICY "Leituras Insert" ON public.leituras FOR INSERT WITH CHECK (
  public.is_master() OR empresa_id = public.empresa_atual()
);
CREATE POLICY "Leituras Update" ON public.leituras FOR UPDATE USING (
  public.is_master() OR empresa_id = public.empresa_atual()
);
CREATE POLICY "Leituras Delete" ON public.leituras FOR DELETE USING (
  public.is_master() OR empresa_id = public.empresa_atual()
);

-- LEITURA_EXAMES
CREATE POLICY "LeituraExames Select" ON public.leitura_exames FOR SELECT USING (
  public.is_master() OR empresa_id = public.empresa_atual()
);
CREATE POLICY "LeituraExames Insert" ON public.leitura_exames FOR INSERT WITH CHECK (
  public.is_master() OR empresa_id = public.empresa_atual()
);
CREATE POLICY "LeituraExames Update" ON public.leitura_exames FOR UPDATE USING (
  public.is_master() OR empresa_id = public.empresa_atual()
);
CREATE POLICY "LeituraExames Delete" ON public.leitura_exames FOR DELETE USING (
  public.is_master() OR empresa_id = public.empresa_atual()
);

-- ==========================================
-- DADOS INICIAIS (SEED)
-- ==========================================
-- NOTA: Após rodar este script, você precisa criar um usuário Master.
-- 1. Crie a conta no Supabase Auth (Dashboard -> Authentication -> Users -> Add user)
-- 2. Depois insira o perfil Master:
--    INSERT INTO public.usuarios (id, nome, email, status)
--    VALUES ('<UUID_DO_AUTH>', 'Admin Master', 'seu@email.com', 'Master');
