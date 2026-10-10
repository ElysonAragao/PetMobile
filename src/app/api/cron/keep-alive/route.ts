import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  try {
    // Realiza uma consulta simples para manter o banco de dados ativo.
    // O Supabase requer atividade no banco (não apenas no servidor) para evitar a pausa.
    const { error } = await supabaseAdmin.from('companies').select('id').limit(1);

    if (error) {
      throw error;
    }

    return NextResponse.json(
      { 
        status: 'ok', 
        message: 'Keep-alive executado com sucesso e banco de dados consultado',
        timestamp: new Date().toISOString() 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro no endpoint de keep-alive:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Falha ao executar o keep-alive',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
