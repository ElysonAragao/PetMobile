-- Migração 2: Tabela Pública de Usuários

-- Como a aplicação original baseava sua lógica de perfis num documento 'usuarios' do Firestore,
-- nós vamos criar uma tabela espelho aqui para guardar (Nome, Email, Status/Role) 
-- vinculada ao auth.users do Supabase.

CREATE TABLE public.usuarios (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome text NOT NULL,
  email text UNIQUE NOT NULL,
  status text NOT NULL CHECK (status IN ('Administrador', 'Supervisor', 'Secretária', 'Médico', 'Leitor')),
  data_validade date,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (temporário: todos os logados podem ler para a interface funcionar)
CREATE POLICY "Usuários logados podem ver perfis" 
ON public.usuarios FOR SELECT 
USING (auth.role() = 'authenticated');

-- Apenas admins podem modificar (Separado para evitar recursão infinita no SELECT)
CREATE POLICY "Apenas admins podem inserir" ON public.usuarios FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT id FROM public.usuarios WHERE status = 'Administrador')
);

CREATE POLICY "Apenas admins podem atualizar" ON public.usuarios FOR UPDATE USING (
  auth.uid() IN (SELECT id FROM public.usuarios WHERE status = 'Administrador')
);

CREATE POLICY "Apenas admins podem deletar" ON public.usuarios FOR DELETE USING (
  auth.uid() IN (SELECT id FROM public.usuarios WHERE status = 'Administrador')
);

-- GARANTIA DE TENANT:
-- Este script garante que exista uma Clínica Mestre e que os usuários administradores estejam nela.
INSERT INTO public.tenants (id, name)
SELECT '00000000-0000-0000-0000-000000000001', 'Minha Clínica'
WHERE NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = '00000000-0000-0000-0000-000000000001');

INSERT INTO public.user_tenants (user_id, tenant_id, role)
SELECT id, '00000000-0000-0000-0000-000000000001', 'admin'
FROM auth.users
ON CONFLICT (user_id, tenant_id) DO NOTHING;
