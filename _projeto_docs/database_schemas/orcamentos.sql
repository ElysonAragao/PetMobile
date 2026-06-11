-- pet_orcamentos table
-- Tabela para salvar orçamentos emitidos para leitura posterior

CREATE TABLE IF NOT EXISTS public.pet_orcamentos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    codigo VARCHAR(255) UNIQUE NOT NULL,
    empresa_id UUID NOT NULL,
    data_emissao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    validade TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Dados do Cliente
    cliente_nome VARCHAR(255) NOT NULL,
    cliente_cpl VARCHAR(255),
    
    -- Plano / Convênio
    plano_nome VARCHAR(255) NOT NULL,
    
    -- Itens (salvos como JSONB para simplificar leitura e evitar problemas se o item original for apagado)
    exames JSONB DEFAULT '[]'::jsonb NOT NULL,
    materiais JSONB DEFAULT '[]'::jsonb NOT NULL,
    
    -- Valor Final Estimado
    total_estimado NUMERIC(10, 2) NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Opcional, desativado inicialmente para testes, ou habilitado com políticas)
ALTER TABLE public.pet_orcamentos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Orçamentos visíveis apenas para mesma empresa"
    ON public.pet_orcamentos
    FOR ALL
    USING (empresa_id = auth.uid()); -- Modifique se o esquema de empresa_id for diferente
    
-- Para testes iniciais caso a empresa_id não seja mapeada pro auth.uid() diretamente:
-- ALTER TABLE public.pet_orcamentos DISABLE ROW LEVEL SECURITY;
