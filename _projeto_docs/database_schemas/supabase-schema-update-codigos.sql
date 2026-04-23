-- Adição de códigos sequenciais legíveis humanos para Prontuários e Documentos

ALTER TABLE public.pet_prontuarios ADD COLUMN IF NOT EXISTS codigo_prontuario text;
ALTER TABLE public.pet_documentos_clinicos ADD COLUMN IF NOT EXISTS codigo_documento text;

ALTER TABLE public.pet_prontuarios ADD COLUMN IF NOT EXISTS autor_registro_id uuid REFERENCES public.pet_usuarios(id) ON DELETE SET NULL;
ALTER TABLE public.pet_documentos_clinicos ADD COLUMN IF NOT EXISTS autor_registro_id uuid REFERENCES public.pet_usuarios(id) ON DELETE SET NULL;
