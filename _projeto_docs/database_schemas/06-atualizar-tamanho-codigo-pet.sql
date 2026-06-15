-- Este script serve para atualizar os códigos já existentes (ex: PET00001) 
-- para o novo formato de 6 dígitos numéricos (ex: PET000001).
-- Isso garante que a ordenação no banco de dados e a geração de novos códigos continue funcionando.

UPDATE public.pet_pets
SET cod_pet = 'PET' || LPAD(SUBSTRING(cod_pet FROM 4), 6, '0')
WHERE cod_pet LIKE 'PET%';
