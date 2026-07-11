-- Criação da tabela de Especialidades
CREATE TABLE IF NOT EXISTS public.pet_especialidades (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    nome text NOT NULL UNIQUE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.pet_especialidades ENABLE ROW LEVEL SECURITY;

-- Permite que qualquer usuário autenticado leia as especialidades (para aparecer em selects)
CREATE POLICY "Leitura liberada para autenticados" 
ON public.pet_especialidades FOR SELECT 
TO authenticated 
USING (true);

-- Permite que Master/Admin gerenciem (insiram, atualizem, deletem)
CREATE POLICY "Master e Admin gerenciam especialidades" 
ON public.pet_especialidades FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.pet_usuarios 
    WHERE id = auth.uid() 
    AND status IN ('Master', 'Administrador', 'Administrador Auxiliar')
  )
);
