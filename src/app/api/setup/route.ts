import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function createAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

export async function GET() {
    try {
        const adminClient = createAdminClient();
        const { count, error } = await adminClient
            .from('pet_usuarios')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('Setup API GET error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ isEmpty: count === 0 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const adminClient = createAdminClient();
        
        // 1. Verificação de segurança: só permite se a tabela estiver REALMENTE vazia
        const { count } = await adminClient
            .from('pet_usuarios')
            .select('*', { count: 'exact', head: true });

        if (count && count > 0) {
            return NextResponse.json({ error: 'O sistema já possui usuários cadastrados. O setup não é permitido.' }, { status: 403 });
        }

        const { email, password, name } = await req.json();

        if (!email || !password || !name) {
            return NextResponse.json({ error: 'Todos os campos são obrigatórios.' }, { status: 400 });
        }

        // 2. Criar usuário no Auth do Supabase (ignora confirmação de e-mail)
        console.log(`Setup API: Tentando criar usuário no Auth: ${email}`);
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { role: 'Master' }
        });

        let targetId = authData.user?.id;

        if (authError) {
            if (authError.message.includes('already registered')) {
                console.log(`Setup API: Usuário já existe no Auth. Recuperando ID...`);
                const { data: searchData } = await adminClient.auth.admin.listUsers();
                const existingUser = searchData.users.find(u => u.email === email);
                if (existingUser) targetId = existingUser.id;
            } else {
                console.error(`Setup API ERROR (Auth):`, authError.message);
                return NextResponse.json({ error: `Falha no Auth: ${authError.message}` }, { status: 500 });
            }
        }

        if (!targetId) {
            console.error(`Setup API ERROR: Não foi possível obter ID para o usuário.`);
            return NextResponse.json({ error: "Falha ao identificar ID do usuário." }, { status: 500 });
        }

        console.log(`Setup API: Gravando PERFIL na tabela 'usuarios' para o ID: ${targetId}`);
        // 3. Criar perfil na tabela 'usuarios'
        const { data: profileResult, error: profileError } = await adminClient
            .from('pet_usuarios')
            .upsert({
                id: targetId,
                nome: name,
                email: email,
                status: 'Master',
                created_at: new Date().toISOString()
            })
            .select();

        if (profileError) {
            console.error(`Setup API ERROR (Profile Table):`, profileError.message);
            return NextResponse.json({ error: `Falha no Perfil: ${profileError.message}` }, { status: 500 });
        }

        console.log(`Setup API SUCCESS: Perfil gravado com sucesso para ${email}. Perfil retornado:`, profileResult);
        return NextResponse.json({ success: true, message: 'Usuário Master criado com sucesso!' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
