-- Migração: Prontuário Digital e Documentos Clínicos

DROP TABLE IF EXISTS public.pet_documentos_clinicos CASCADE;
DROP TABLE IF EXISTS public.pet_prontuarios CASCADE;

-- 1. Criação da tabela de Prontuários
CREATE TABLE public.pet_prontuarios (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid REFERENCES public.pet_empresas(id) ON DELETE CASCADE NOT NULL,
  pet_id uuid REFERENCES public.pet_pets(id) ON DELETE CASCADE NOT NULL,
  medico_id uuid REFERENCES public.pet_usuarios(id) ON DELETE SET NULL,
  data_atendimento timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  tipo_atendimento text NOT NULL CHECK (tipo_atendimento IN ('Consulta', 'Exame', 'Procedimento', 'Retorno')),
  descricao_livre text,
  prescricao_medica text,
  status_retorno text DEFAULT 'Ativo' CHECK (status_retorno IN ('Ativo', 'Expirado', 'Concluído')),
  data_retorno_limite timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS e criar políticas para Prontuários
ALTER TABLE public.pet_prontuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Isolamento Empresa Prontuario Select" ON public.pet_prontuarios FOR SELECT USING (
  empresa_id IN (SELECT empresa_id FROM public.pet_usuarios WHERE id = auth.uid())
);
CREATE POLICY "Isolamento Empresa Prontuario Insert" ON public.pet_prontuarios FOR INSERT WITH CHECK (
  empresa_id IN (SELECT empresa_id FROM public.pet_usuarios WHERE id = auth.uid()) 
  AND auth.uid() IN (SELECT id FROM public.pet_usuarios WHERE status = 'Médico' OR status = 'Administrador')
);
CREATE POLICY "Isolamento Empresa Prontuario Update" ON public.pet_prontuarios FOR UPDATE USING (
  empresa_id IN (SELECT empresa_id FROM public.pet_usuarios WHERE id = auth.uid())
  AND auth.uid() IN (SELECT id FROM public.pet_usuarios WHERE status = 'Médico' OR status = 'Administrador')
);
CREATE POLICY "Isolamento Empresa Prontuario Delete" ON public.pet_prontuarios FOR DELETE USING (
  empresa_id IN (SELECT empresa_id FROM public.pet_usuarios WHERE id = auth.uid())
  AND auth.uid() IN (SELECT id FROM public.pet_usuarios WHERE status = 'Médico' OR status = 'Administrador')
);

-- 2. Criação da tabela de Documentos Clínicos Genéricos
CREATE TABLE public.pet_documentos_clinicos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid REFERENCES public.pet_empresas(id) ON DELETE CASCADE NOT NULL,
  prontuario_id uuid REFERENCES public.pet_prontuarios(id) ON DELETE CASCADE NOT NULL,
  tipo_documento text NOT NULL CHECK (tipo_documento IN ('Receita', 'Atestado', 'Recibo', 'Guia de Internação')),
  conteudo text, -- Para salvar o markdown/texto do template formatado
  metadata jsonb, -- Para salvar respostas e metadados estruturados
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS e criar políticas para Documentos Clínicos
ALTER TABLE public.pet_documentos_clinicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Isolamento Empresa Docs Select" ON public.pet_documentos_clinicos FOR SELECT USING (
  empresa_id IN (SELECT empresa_id FROM public.pet_usuarios WHERE id = auth.uid())
);
CREATE POLICY "Isolamento Empresa Docs Insert" ON public.pet_documentos_clinicos FOR INSERT WITH CHECK (
  empresa_id IN (SELECT empresa_id FROM public.pet_usuarios WHERE id = auth.uid())
);
CREATE POLICY "Isolamento Empresa Docs Update" ON public.pet_documentos_clinicos FOR UPDATE USING (
  empresa_id IN (SELECT empresa_id FROM public.pet_usuarios WHERE id = auth.uid())
);
CREATE POLICY "Isolamento Empresa Docs Delete" ON public.pet_documentos_clinicos FOR DELETE USING (
  empresa_id IN (SELECT empresa_id FROM public.pet_usuarios WHERE id = auth.uid())
);

-- 3. Storage para Anexos
-- (Se necessário você pode criar a policy do storage diretamente via SUPABASE SQL Editor)
-- Configuração básica no Storage: Bucket "prontuarios" com restrições por role ou usuário autenticado.

-- Extra: Criar trigger ou função para atualizar "status_retorno" para expirado automaticamente quando data limite chegar? 
-- Talvez via aplicação (cron web) ou select on-the-fly.
