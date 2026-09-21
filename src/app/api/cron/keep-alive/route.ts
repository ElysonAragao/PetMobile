import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json(
      { 
        status: 'ok', 
        message: 'Keep-alive executado com sucesso',
        timestamp: new Date().toISOString() 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro no endpoint de keep-alive:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Falha ao executar o keep-alive' 
      },
      { status: 500 }
    );
  }
}
