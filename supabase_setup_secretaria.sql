-- Tabela de vínculo entre Secretária e Veterinário(s)
CREATE TABLE public.secretaria_veterinario (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    secretaria_id uuid NOT NULL REFERENCES public.pet_usuarios(id) ON DELETE CASCADE,
    veterinario_id uuid NOT NULL REFERENCES public.pet_usuarios(id) ON DELETE CASCADE,
    empresa_id uuid NOT NULL REFERENCES public.pet_empresas(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(secretaria_id, veterinario_id)
);

-- Políticas RLS (Row Level Security) - Ajuste conforme sua política padrão
ALTER TABLE public.secretaria_veterinario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visualização liberada para autenticados" 
ON public.secretaria_veterinario FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Master e Admin podem gerenciar vínculos" 
ON public.secretaria_veterinario FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.pet_usuarios 
    WHERE id = auth.uid() 
    AND status IN ('Master', 'Administrador', 'Administrador Auxiliar')
  )
);
