-- Adiciona a coluna id_exame na tabela exames se ela não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'exames'
        AND column_name = 'id_exame'
    ) THEN
        ALTER TABLE public.exames
        ADD COLUMN id_exame TEXT;
    END IF;
END $$;
