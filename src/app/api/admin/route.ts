import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Cliente Admin (service_role) — só deve ser usado no server-side
function createAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

// Verifica se o usuário que fez a requisição tem permissões
async function checkPermissions(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        console.log("Admin API: Sem header de autorização.");
        return { isAuthorized: false };
    }

    const token = authHeader.substring(7);
    const adminClient = createAdminClient();

    const { data: { user }, error } = await adminClient.auth.getUser(token);
    if (error || !user) {
        console.log("Admin API: Falha ao validar token Auth:", error?.message);
        return { isAuthorized: false };
    }

    console.log(`Admin API: Buscando perfil para UUID: ${user.id}`);

    // DIAGNÓSTICO: Ver quais tabelas o servidor está enxergando
    const { data: tableCheck, error: tableError } = await adminClient.from('pet_usuarios').select('id').limit(1);
    console.log(`Admin API (DIAGNÓSTICO): Teste de conexão tabela 'usuarios' ->`, tableError ? `ERRO: ${tableError.message}` : "OK ✅");

    const { data: tablesRaw, error: tablesError } = await adminClient.rpc('get_tables_info'); // Se tiver o RPC, ou tentamos um select cru
    if (tablesError) {
        console.log("Admin API (DIAGNÓSTICO): Não foi possível listar tabelas via RPC. Prosseguindo...");
    }

    const { data: profile, error: profileError } = await adminClient
        .from('pet_usuarios')
        .select('*') // Selecionamos tudo para não depender de nomes exatos de colunas agora
        .eq('id', user.id)
        .maybeSingle();

    if (profileError || !profile) {
        console.log(`Admin API: Perfil NÃO encontrado para o UUID ${user.id} na tabela 'usuarios'.`);
        return { isAuthorized: false };
    }

    const role = profile.status;
    const isMaster = role === 'Master';
    const isEmpresaAdmin = role === 'Administrador' || role === 'Administrador Auxiliar';

    console.log(`Admin API: Usuário=${user.email}, Role=${role}, isMaster=${isMaster}, isAuthorized=${isMaster || isEmpresaAdmin}`);

    return {
        isAuthorized: isMaster || isEmpresaAdmin,
        isMaster,
        role,
        empresaId: profile.empresa_id,
        userId: user.id,
        validade: profile.validade
    };
}

const DEFAULT_PASSWORD = '123456';

export async function POST(req: NextRequest) {
    try {
        const caller = await checkPermissions(req);
        if (!caller.isAuthorized) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const body = await req.json();
        const { action } = body;

        console.log(`Admin API ACTION: ${action} - CORPO:`, JSON.stringify(body, null, 2));

        const adminClient = createAdminClient();

        // ─── CRIAR EMPRESA ───
        if (action === 'create_empresa') {
            if (!caller.isMaster) return NextResponse.json({ error: 'Apenas Master pode criar empresa.' }, { status: 403 });
            const { empresaData: rawData } = body;
            
            // SANITIZAÇÃO: Mapeamos apenas o que o banco TêM para evitar erros de colunas extras (contatos, tenants, etc)
            const cleanData = {
                razao_social: rawData.razao_social || rawData.razaoSocial,
                nome_fantasia: rawData.nome_fantasia || rawData.nomeFantasia,
                cnpj: rawData.cnpj,
                codigo: rawData.codigo,
                email: rawData.email,
                telefone: rawData.telefone,
                contato: rawData.nome_contato || rawData.contato || rawData.nomeContato,
                cep: rawData.cep,
                cidade: rawData.cidade,
                estado: rawData.estado,
                logo_url: rawData.logo_url
            };

            if (!cleanData.razao_social || !cleanData.nome_fantasia) {
                return NextResponse.json({ error: 'Razão Social e Nome Fantasia são obrigatórios.' }, { status: 400 });
            }

            const { data, error } = await adminClient
                .from('pet_empresas')
                .insert(cleanData)
                .select()
                .single();

            if (error) {
                console.error("Admin API ERROR (Insert Empresa):", error.message);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
            return NextResponse.json({ success: true, empresa: data });
        }

        // ─── ATUALIZAR EMPRESA ───
        if (action === 'update_empresa') {
            if (!caller.isMaster && caller.empresaId !== body.empresaId) {
                return NextResponse.json({ error: 'Acesso negado à empresa.' }, { status: 403 });
            }
            const { empresaId, empresaData } = body;
            if (!empresaId) return NextResponse.json({ error: 'ID da empresa é obrigatório.' }, { status: 400 });

            const { data, error } = await adminClient
                .from('pet_empresas')
                .update(empresaData)
                .eq('id', empresaId)
                .select()
                .single();

            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true, empresa: data });
        }

        // ─── DELETAR EMPRESA ───
        if (action === 'delete_empresa') {
            if (!caller.isMaster) return NextResponse.json({ error: 'Apenas Master pode deletar empresa.' }, { status: 403 });
            const { empresaId } = body;
            if (!empresaId) return NextResponse.json({ error: 'ID da empresa é obrigatório.' }, { status: 400 });

            const { error } = await adminClient
                .from('pet_empresas')
                .delete()
                .eq('id', empresaId);

            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true });
        }

        // ─── CRIAR USUÁRIO (Auth + Perfil) ───
        if (action === 'create_user') {
            const { nome, email, status, validade, cpf, crmv_uf, crm_uf, telefone, empresaId } = body;
            const finalCrmv = crmv_uf || crm_uf; // Para manter compatibilidade

            // Administradores e Auxiliares impõem a própria empresa. Master recebe do body (empresaId selecionada).
            const target_empresa_id = caller.isMaster ? empresaId : caller.empresaId;

            if (!nome || !email || !status) {
                return NextResponse.json({ error: 'Nome, email e status são obrigatórios.' }, { status: 400 });
            }

            if (status !== 'Master' && !target_empresa_id) {
                return NextResponse.json({ error: 'Empresa é obrigatória para usuários não-Master.' }, { status: 400 });
            }

            // NORMALIZAÇÃO: Padronizar variações para o banco
            let finalStatus = status;
            if (status === 'Médico' || status === 'Medico' || status === 'Veterinário') finalStatus = 'MedicoVet';
            if (status === 'Médico Geral' || status === 'Medico Geral' || status === 'Veterinário Geral') finalStatus = 'MedicoVet Geral';

            // REGRAS DE HIERARQUIA
            if (caller.isMaster) {
                // Master cadastra apenas Administrador de cada empresa
                if (finalStatus !== 'Administrador') {
                    return NextResponse.json({ error: 'O Master pode cadastrar apenas o perfil Administrador.' }, { status: 403 });
                }
            } else if (caller.role === 'Administrador Auxiliar') {
                // Adm Auxiliar não pode criar Administrador nem Adm Auxiliar
                if (finalStatus === 'Administrador' || finalStatus === 'Administrador Auxiliar') {
                    return NextResponse.json({ error: 'Você não tem permissão para criar administradores.' }, { status: 403 });
                }
            }
            // Administrador 'puro' pode criar qualquer perfil (exceto Master, que já não está no body)

            if (!caller.isMaster && validade && caller.validade) {
                const novaValidadeDate = new Date(validade);
                const callerValidadeDate = new Date(caller.validade);
                if (novaValidadeDate > callerValidadeDate) {
                    return NextResponse.json({ error: 'A data de validade não pode exceder a sua própria validade.' }, { status: 403 });
                }
            }

            const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
                email,
                password: DEFAULT_PASSWORD,
                email_confirm: true,
            });

            if (authError) {
                return NextResponse.json({ error: `Erro ao criar conta: ${authError.message}` }, { status: 500 });
            }

            // 2. Criar perfil em usuarios
            const { error: profileError } = await adminClient
                .from('pet_usuarios')
                .insert({
                    id: authData.user.id,
                    nome,
                    email,
                    status: finalStatus,
                    empresa_id: finalStatus === 'Master' ? null : target_empresa_id,
                    validade: validade || null,
                    cpf: cpf || null,
                    crmv_uf: finalCrmv || null,
                    telefone: telefone || null,
                });

            if (profileError) {
                // Rollback: deletar usuário Auth criado
                await adminClient.auth.admin.deleteUser(authData.user.id);
                return NextResponse.json({ error: `Erro ao criar perfil: ${profileError.message}` }, { status: 500 });
            }

            return NextResponse.json({ success: true, userId: authData.user.id });
        }

        // ─── ATUALIZAR USUÁRIO (Apenas Perfil) ───
        if (action === 'update_user') {
            const { userId, userData } = body;

            if (!userId) {
                return NextResponse.json({ error: 'ID do usuário é obrigatório.' }, { status: 400 });
            }

            const target_empresa_id = caller.isMaster ? userData.empresa_id : caller.empresaId;

            if (userData.status !== 'Master' && !target_empresa_id) {
                return NextResponse.json({ error: 'Empresa é obrigatória para usuários não-Master.' }, { status: 400 });
            }

            // Validar permissão para alteração
            if (!caller.isMaster) {
                const { data: targetUser } = await adminClient.from('pet_usuarios').select('empresa_id, status').eq('id', userId).single();
                if (!targetUser || targetUser.empresa_id !== caller.empresaId) {
                    return NextResponse.json({ error: 'Acesso negado ao usuário.' }, { status: 403 });
                }

                if (caller.role === 'Administrador Auxiliar') {
                    if (targetUser.status === 'Administrador' || targetUser.status === 'Administrador Auxiliar') {
                        return NextResponse.json({ error: 'Você não pode editar administradores.' }, { status: 403 });
                    }
                    if (userData.status === 'Administrador' || userData.status === 'Administrador Auxiliar') {
                        return NextResponse.json({ error: 'Você não pode promover para administrador.' }, { status: 403 });
                    }
                }

                if (userData.validade && caller.validade) {
                    const novaValidadeDate = new Date(userData.validade);
                    const callerValidadeDate = new Date(caller.validade);
                    if (novaValidadeDate > callerValidadeDate) {
                        return NextResponse.json({ error: 'A data de validade não pode exceder a sua própria validade.' }, { status: 403 });
                    }
                }
            }

            // Remove email para evitar problemas de atualização de credenciais - editado via outro fluxo se necessário
            const { email, id, ...updatePayload } = userData;
            updatePayload.empresa_id = userData.status === 'Master' ? null : target_empresa_id;

            const { error: profileError } = await adminClient
                .from('pet_usuarios')
                .update(updatePayload)
                .eq('id', userId);

            if (profileError) {
                return NextResponse.json({ error: `Erro ao atualizar perfil: ${profileError.message}` }, { status: 500 });
            }

            return NextResponse.json({ success: true });
        }

        // ─── RESETAR SENHA ───
        if (action === 'reset_password') {
            const { userId } = body;
            if (!userId) return NextResponse.json({ error: 'ID do usuário é obrigatório.' }, { status: 400 });

            const { error } = await adminClient.auth.admin.updateUserById(userId, {
                password: DEFAULT_PASSWORD,
            });

            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true });
        }

        // ─── DELETAR USUÁRIO (Auth + Perfil) ───
        if (action === 'delete_user') {
            const { userId } = body;
            if (!userId) return NextResponse.json({ error: 'ID do usuário é obrigatório.' }, { status: 400 });

            if (!caller.isMaster) {
                const { data: targetUser } = await adminClient.from('pet_usuarios').select('empresa_id, status').eq('id', userId).single();
                if (!targetUser || targetUser.empresa_id !== caller.empresaId) {
                    return NextResponse.json({ error: 'Acesso negado ao usuário.' }, { status: 403 });
                }
                if (caller.role === 'Administrador Auxiliar' && (targetUser.status === 'Administrador' || targetUser.status === 'Administrador Auxiliar')) {
                    return NextResponse.json({ error: 'Você não tem permissão para deletar administradores.' }, { status: 403 });
                }
            }

            // Deletar do Auth (CASCADE deletará da tabela usuarios automaticamente)
            const { error } = await adminClient.auth.admin.deleteUser(userId);
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Ação não reconhecida.' }, { status: 400 });

    } catch (error: any) {
        console.error('Admin API error:', error);
        return NextResponse.json({ error: error.message || 'Erro interno.' }, { status: 500 });
    }
}

// GET: Listar empresas e usuários (respeitando privilégios)
export async function GET(req: NextRequest) {
    try {
        const caller = await checkPermissions(req);
        if (!caller.isAuthorized) {
            return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
        }

        const adminClient = createAdminClient();
        const { searchParams } = new URL(req.url);
        const resource = searchParams.get('resource');

        if (resource === 'empresas') {
            let query = adminClient.from('pet_empresas').select('*').order('nome_fantasia');
            if (!caller.isMaster) {
                query = query.eq('id', caller.empresaId);
            }
            const { data, error } = await query;

            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ data });
        }

        if (resource === 'usuarios') {
            let query = adminClient
                .from('pet_usuarios')
                .select('id, empresa_id, codigo, nome, cpf, crmv_uf, email, telefone, status, validade, created_at, empresas:pet_empresas(nome_fantasia, codigo)')
                .order('nome');

            if (!caller.isMaster) {
                query = query.eq('empresa_id', caller.empresaId);
            }
            const { data, error } = await query;

            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ data });
        }

        return NextResponse.json({ error: 'Resource não reconhecido.' }, { status: 400 });

    } catch (error: any) {
        console.error('Admin API GET error:', error);
        return NextResponse.json({ error: error.message || 'Erro interno.' }, { status: 500 });
    }
}
