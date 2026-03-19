
-- Primeiro, descobrimos o nome da constraint de check existente
DO $$ 
DECLARE 
    constraint_name_var text;
BEGIN 
    SELECT conname INTO constraint_name_var
    FROM pg_constraint 
    WHERE conrelid = 'public.usuarios'::regclass 
      AND contype = 'c' 
      AND pg_get_constraintdef(oid) LIKE '%status%';

    IF constraint_name_var IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.usuarios DROP CONSTRAINT ' || constraint_name_var;
    END IF;
END $$;

-- Adicionamos a nova constraint com os perfis atualizados
ALTER TABLE public.usuarios 
ADD CONSTRAINT usuarios_status_check 
CHECK (status IN (
    'Master', 
    'Administrador', 
    'Administrador Auxiliar', 
    'Medico', 
    'Medico Geral', 
    'Secretária', 
    'Secretária Geral', 
    'Leitor', 
    'Leitor Geral', 
    'Relatórios', 
    'Supervisor'
));

COMMENT ON CONSTRAINT usuarios_status_check ON public.usuarios IS 'Garante que o status do usuário seja um dos perfis válidos, incluindo os novos perfis Geral.';
