-- SCRIPT DE CRIAÇÃO DA TABELA DE AGENDA (AGENDAMENTOS)
-- ===================================================

CREATE TABLE IF NOT EXISTS public.pet_agenda (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid REFERENCES public.pet_empresas(id) ON DELETE CASCADE NOT NULL,
  medico_id uuid REFERENCES public.pet_usuarios(id) ON DELETE SET NULL,
  data_agendamento timestamp with time zone NOT NULL,
  
  -- Para agendamento: o tutor e o pet podem ou não estar cadastrados ainda.
  -- Se já estiver cadastrado, associamos pet_id:
  pet_id uuid REFERENCES public.pet_pets(id) ON DELETE SET NULL,
  
  -- Dados informados para o agendamento (que podem ser preenchidos manualmente ou buscados)
  tutor_cpf text NOT NULL,
  tutor_nome text NOT NULL,
  pet_nome text NOT NULL,
  tutor_telefone text,
  
  status text DEFAULT 'Agendado' CHECK (status IN ('Agendado', 'Cancelado', 'Realizado')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.pet_agenda ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS DE RLS
-- Qualquer usuário autenticado na mesma empresa pode ver, criar, atualizar e deletar os agendamentos da própria empresa.
-- Master pode fazer tudo.

CREATE POLICY "Agenda Select" ON public.pet_agenda FOR SELECT USING (
  public.is_master() OR empresa_id = public.empresa_atual()
);

CREATE POLICY "Agenda Insert" ON public.pet_agenda FOR INSERT WITH CHECK (
  public.is_master() OR empresa_id = public.empresa_atual()
);

CREATE POLICY "Agenda Update" ON public.pet_agenda FOR UPDATE USING (
  public.is_master() OR empresa_id = public.empresa_atual()
);

CREATE POLICY "Agenda Delete" ON public.pet_agenda FOR DELETE USING (
  public.is_master() OR empresa_id = public.empresa_atual()
);

-- ÍNDICES para performance
CREATE INDEX IF NOT EXISTS idx_pet_agenda_empresa ON public.pet_agenda(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pet_agenda_data ON public.pet_agenda(data_agendamento);
CREATE INDEX IF NOT EXISTS idx_pet_agenda_medico ON public.pet_agenda(medico_id);
