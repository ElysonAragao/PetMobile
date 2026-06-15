-- 08-add-campos-reproducao.sql

-- Adiciona os novos campos solicitados para controle reprodutivo e de filhotes
ALTER TABLE public.pet_pets
ADD COLUMN IF NOT EXISTS data_ultima_cria text,
ADD COLUMN IF NOT EXISTS data_inseminacao text,
ADD COLUMN IF NOT EXISTS quantidade_filhos text;

-- Comentários para documentação
COMMENT ON COLUMN public.pet_pets.data_ultima_cria IS 'Data do último parto/cria do pet';
COMMENT ON COLUMN public.pet_pets.data_inseminacao IS 'Data da última inseminação ou cobertura do touro/macho';
COMMENT ON COLUMN public.pet_pets.quantidade_filhos IS 'Quantidade de filhos da ninhada atual ou total histórico';
