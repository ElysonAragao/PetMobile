import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase credentials missing' }, { status: 500 });
    }

    const timestamp = Date.now();
    const response = await fetch(`${supabaseUrl}/rest/v1/?_t=${timestamp}`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Supabase ping failed: ${response.statusText}`);
    }

    return NextResponse.json({ success: true, timestamp }, { status: 200 });
  } catch (error: any) {
    console.error('Keep-alive error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}