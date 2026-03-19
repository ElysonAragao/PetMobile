-- Adiciona colunas de Plano de Saúde na tabela exames se elas não existirem
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'exames'
        AND column_name = 'plano_saude_id'
    ) THEN
        ALTER TABLE public.exames
        ADD COLUMN plano_saude_id TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'exames'
        AND column_name = 'health_plan_name'
    ) THEN
        ALTER TABLE public.exames
        ADD COLUMN health_plan_name TEXT;
    END IF;

    -- Update existing records to loosely associate with 'Unimed' per user's request for now
    -- They will fix this later using the reports.
    -- Assuming a health_plan_name is sufficient for a loose association if IDs aren't strictly joined yet.
    UPDATE public.exames
    SET health_plan_name = 'Unimed'
    WHERE health_plan_name IS NULL;

END $$;
