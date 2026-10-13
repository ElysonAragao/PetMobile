import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

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

    // Realiza uma consulta real em tabelas existentes no banco do PetMobile para gerar atividade no PostgreSQL.
    // O Supabase requer leitura/escrita real no banco de dados para zerar o contador de inatividade de 7 dias.
    let tableUsed = 'pet_empresas';
    let { data, error } = await supabase.from('pet_empresas').select('id').limit(1);

    if (error) {
      console.warn('Consulta em pet_empresas retornou aviso/erro, tentando pet_especies:', error.message);
      tableUsed = 'pet_especies';
      const fallback = await supabase.from('pet_especies').select('id').limit(1);
      if (fallback.error) {
        throw fallback.error;
      }
      data = fallback.data;
    }

    return NextResponse.json(
      { 
        status: 'ok', 
        message: `Keep-alive executado com sucesso no PostgreSQL (tabela: ${tableUsed})`,
        rowsReturned: data ? data.length : 0,
        timestamp: new Date().toISOString() 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro no endpoint de keep-alive do Supabase:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Falha ao executar o keep-alive no banco de dados',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
