import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL ou Key não encontradas nas variáveis de ambiente.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    // 1. Consulta pet_especies (leitura pública liberada no RLS, garante retorno de linhas mesmo com ANON_KEY)
    const { data: especiesData, error: especiesError } = await supabase
      .from('pet_especies')
      .select('id')
      .limit(1);

    // 2. Consulta pet_empresas (retorna linhas com SERVICE_ROLE_KEY)
    const { data: empresasData, error: empresasError } = await supabase
      .from('pet_empresas')
      .select('id')
      .limit(1);

    // 3. Executa função RPC diretamente no motor PostgreSQL (impossível de ser retornado por cache HTTP)
    const { data: rpcData, error: rpcError } = await supabase.rpc('is_master');

    if (especiesError && empresasError) {
      throw new Error(`Erro nas consultas: pet_especies (${especiesError.message}) | pet_empresas (${empresasError.message})`);
    }

    const rowsReturned = (especiesData?.length || 0) + (empresasData?.length || 0);

    return NextResponse.json(
      {
        status: 'ok',
        message: 'Keep-alive executado com sucesso no PostgreSQL (pet_especies + pet_empresas + RPC)',
        rowsReturned,
        especiesCount: especiesData?.length || 0,
        empresasCount: empresasData?.length || 0,
        rpcExecuted: !rpcError,
        rpcResult: rpcData ?? null,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    console.error('Erro no endpoint de keep-alive do Supabase:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Falha ao executar o keep-alive no banco de dados',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
