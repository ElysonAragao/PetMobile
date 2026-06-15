-- Script para remover a restrição única do campo tutor_cpf na tabela pet_pets
-- Execute este comando no painel SQL Editor do Supabase.

ALTER TABLE public.pet_pets DROP CONSTRAINT IF EXISTS pet_pets_tutor_cpf_key;

-- (Opcional) Caso não tenha certeza do nome da constraint, você pode rodar o código abaixo 
-- para buscar as constraints associadas à tabela pet_pets:
-- SELECT conname FROM pg_constraint WHERE conrelid = 'public.pet_pets'::regclass;
