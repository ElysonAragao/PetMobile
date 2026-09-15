-- ==============================================================================
-- 1. CRIAÇÃO DA TABELA DE TEMPLATES DE AGENDA (Protocolos Principais)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.pet_agenda_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.pet_empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  pular_finais_de_semana BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 2. CRIAÇÃO DA TABELA DE ETAPAS DO TEMPLATE (Subsequentes)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.pet_agenda_template_etapas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.pet_agenda_templates(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  nome_etapa TEXT NOT NULL,
  dias_apos_anterior INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. ALTERAÇÃO DA TABELA EXISTENTE DE AGENDAMENTOS
-- Adicionando colunas para vincular o agendamento à cascata e permitir o efeito dominó
-- ==============================================================================
ALTER TABLE public.pet_agenda
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.pet_agenda_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS etapa_ordem INTEGER,
  ADD COLUMN IF NOT EXISTS grupo_id UUID,
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.pet_agenda(id) ON DELETE CASCADE;

-- ==============================================================================
-- 4. POLÍTICAS DE RLS (Row Level Security) - AGENDA TEMPLATES
-- ==============================================================================
ALTER TABLE public.pet_agenda_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver templates da propria empresa" 
ON public.pet_agenda_templates 
FOR SELECT 
USING (
  empresa_id IN (
    SELECT empresa_id FROM public.pet_usuarios WHERE id = auth.uid()
  ) OR 
  (SELECT status FROM public.pet_usuarios WHERE id = auth.uid()) = 'Master'
);

CREATE POLICY "Modificar templates da propria empresa" 
ON public.pet_agenda_templates 
FOR ALL 
USING (
  empresa_id IN (
    SELECT empresa_id FROM public.pet_usuarios WHERE id = auth.uid()
  ) OR 
  (SELECT status FROM public.pet_usuarios WHERE id = auth.uid()) = 'Master'
);

-- ==============================================================================
-- 5. POLÍTICAS DE RLS (Row Level Security) - AGENDA TEMPLATE ETAPAS
-- ==============================================================================
ALTER TABLE public.pet_agenda_template_etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver etapas da propria empresa" 
ON public.pet_agenda_template_etapas 
FOR SELECT 
USING (
  template_id IN (
    SELECT id FROM public.pet_agenda_templates WHERE empresa_id IN (
      SELECT empresa_id FROM public.pet_usuarios WHERE id = auth.uid()
    ) OR (SELECT status FROM public.pet_usuarios WHERE id = auth.uid()) = 'Master'
  )
);

CREATE POLICY "Modificar etapas da propria empresa" 
ON public.pet_agenda_template_etapas 
FOR ALL 
USING (
  template_id IN (
    SELECT id FROM public.pet_agenda_templates WHERE empresa_id IN (
      SELECT empresa_id FROM public.pet_usuarios WHERE id = auth.uid()
    ) OR (SELECT status FROM public.pet_usuarios WHERE id = auth.uid()) = 'Master'
  )
);
