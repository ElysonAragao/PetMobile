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
            const { nome, email, status, validade, cpf, crmv_uf, crm_uf, telefone, empresaId, especialidade, prontuario_liberado, validade_prontuario } = body;
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
            } else if (caller.role === 'Administrador') {
                // Administrador não pode criar outro Administrador
                if (finalStatus === 'Administrador') {
                    return NextResponse.json({ error: 'Apenas o Master pode criar outro Administrador.' }, { status: 403 });
                }
            } else if (caller.role === 'Administrador Auxiliar') {
                // Adm Auxiliar não pode criar Administrador nem Adm Auxiliar
                if (finalStatus === 'Administrador' || finalStatus === 'Administrador Auxiliar') {
                    return NextResponse.json({ error: 'Você não tem permissão para criar administradores.' }, { status: 403 });
                }
            }

            // TRAVA DE VALIDADE: Se o criador tem uma validade limite, ele não pode dar validade infinita ou maior.
            let finalValidade = validade;
            if (!caller.isMaster && caller.validade) {
                const callerValidadeDate = new Date(caller.validade);
                if (!validade) {
                    // Se tentar criar sem validade (infinito), força a validade do criador
                    finalValidade = caller.validade;
                } else {
                    const novaValidadeDate = new Date(validade);
                    if (novaValidadeDate > callerValidadeDate) {
                        return NextResponse.json({ error: 'A data de validade não pode exceder a sua própria validade.' }, { status: 403 });
                    }
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
                    validade: finalValidade || null,
                    cpf: cpf || null,
                    crmv_uf: finalCrmv || null,
                    telefone: telefone || null,
                    especialidade: especialidade || null,
                    prontuario_liberado: prontuario_liberado || false,
                    validade_prontuario: validade_prontuario || null,
                });

            if (profileError) {
                // Rollback: deletar usuário Auth criado
                await adminClient.auth.admin.deleteUser(authData.user.id);
                return NextResponse.json({ error: `Erro ao criar perfil: ${profileError.message}` }, { status: 500 });
            }

            // 3. Vincular médicos se for Secretária
            if (finalStatus === 'Secretária' || finalStatus === 'Secretária Geral') {
                const { medicosVinculados } = body;
                if (medicosVinculados && Array.isArray(medicosVinculados) && medicosVinculados.length > 0) {
                    const vinculacoes = medicosVinculados.map((vetId: string) => ({
                        secretaria_id: authData.user.id,
                        veterinario_id: vetId,
                        empresa_id: target_empresa_id
                    }));
                    await adminClient.from('secretaria_veterinario').insert(vinculacoes);
                }
            }

            return NextResponse.json({ success: true, userId: authData.user.id });
        }

        // ─── ATUALIZAR USUÁRIO (Apenas Perfil) ───
        if (action === 'update_user') {
            const { userId, userData } = body;

            if (!userId) {
                return NextResponse.json({ error: 'ID do usuário é obrigatório.' }, { status: 400 });
            }

            let target_empresa_id = caller.empresaId;
            let targetUser = null;

            // Para update, sempre pegamos os dados reais do banco para garantir segurança e consistência
            const { data: fetchedUser } = await adminClient.from('pet_usuarios').select('empresa_id, status').eq('id', userId).single();
            targetUser = fetchedUser;

            if (caller.isMaster) {
                // Master usa a empresa atual do usuário sendo editado, se não vier no payload
                target_empresa_id = userData.empresa_id || targetUser?.empresa_id;
            } else {
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
                } else if (caller.role === 'Administrador') {
                    // Administrador não pode transformar alguém em Administrador
                    if (userData.status === 'Administrador' && targetUser.status !== 'Administrador') {
                         return NextResponse.json({ error: 'Apenas o Master pode promover usuários a Administrador.' }, { status: 403 });
                    }
                }

                // TRAVA DE VALIDADE NA ATUALIZAÇÃO
                if (caller.validade) {
                    const callerValidadeDate = new Date(caller.validade);
                    if (!userData.validade) {
                        userData.validade = caller.validade; // Força limite máximo se tentar colocar infinito
                    } else {
                        const novaValidadeDate = new Date(userData.validade);
                        if (novaValidadeDate > callerValidadeDate) {
                            return NextResponse.json({ error: 'A data de validade não pode exceder a sua própria validade.' }, { status: 403 });
                        }
                    }
                }
            }

            // Remove campos que não pertencem à tabela pet_usuarios
            const { email, id, medicosVinculados, ...updatePayload } = userData;
            
            updatePayload.empresa_id = userData.status === 'Master' ? null : target_empresa_id;

            const { error: profileError } = await adminClient
                .from('pet_usuarios')
                .update(updatePayload)
                .eq('id', userId);

            if (profileError) {
                return NextResponse.json({ error: `Erro ao atualizar perfil: ${profileError.message}` }, { status: 500 });
            }

            // 3. Atualizar vínculos se for Secretária
            if (userData.status === 'Secretária' || userData.status === 'Secretária Geral') {
                if (medicosVinculados !== undefined && Array.isArray(medicosVinculados)) {
                    // Remove os vínculos antigos
                    await adminClient.from('secretaria_veterinario').delete().eq('secretaria_id', userId);
                    // Insere os novos
                    if (medicosVinculados.length > 0) {
                        const vinculacoes = medicosVinculados.map((vetId: string) => ({
                            secretaria_id: userId,
                            veterinario_id: vetId,
                            empresa_id: target_empresa_id
                        }));
                        const { error: vincError } = await adminClient.from('secretaria_veterinario').insert(vinculacoes);
                        if (vincError) {
                            console.error("Erro ao vincular médicos:", vincError);
                            return NextResponse.json({ error: `Erro ao vincular médicos: ${vincError.message}` }, { status: 500 });
                        }
                    }
                }
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

        // ─── ZERAR MOVIMENTAÇÕES ───
        if (action === 'reset_movements') {
            if (!caller.isMaster) return NextResponse.json({ error: 'Apenas Master pode zerar movimentações.' }, { status: 403 });
            const { empresaId } = body;
            if (!empresaId) return NextResponse.json({ error: 'ID da empresa é obrigatório.' }, { status: 400 });

            // 1. Deletar faturamentos
            const { error: faturamentoError } = await adminClient
                .from('pet_faturamento')
                .delete()
                .eq('empresa_id', empresaId);

            if (faturamentoError) return NextResponse.json({ error: `Erro ao limpar faturamento: ${faturamentoError.message}` }, { status: 500 });

            // 2. Deletar leituras
            const { error: leiturasError } = await adminClient
                .from('pet_leituras')
                .delete()
                .eq('empresa_id', empresaId);

            if (leiturasError) return NextResponse.json({ error: `Erro ao limpar leituras: ${leiturasError.message}` }, { status: 500 });

            // 3. Deletar movimentações
            const { error: movimentacoesError } = await adminClient
                .from('pet_movimentacoes')
                .delete()
                .eq('empresa_id', empresaId);

            if (movimentacoesError) return NextResponse.json({ error: `Erro ao limpar movimentações: ${movimentacoesError.message}` }, { status: 500 });

            return NextResponse.json({ success: true, message: 'Toda a movimentação, leituras e faturamento da empresa foram zerados.' });
        }

        // ─── ZERAR LEITURAS ───
        if (action === 'reset_leituras') {
            if (!caller.isMaster) return NextResponse.json({ error: 'Apenas Master pode zerar leituras.' }, { status: 403 });
            const { empresaId } = body;
            if (!empresaId) return NextResponse.json({ error: 'ID da empresa é obrigatório.' }, { status: 400 });

            const { error: leiturasError } = await adminClient
                .from('pet_leituras')
                .delete()
                .eq('empresa_id', empresaId);

            if (leiturasError) return NextResponse.json({ error: `Erro ao limpar leituras: ${leiturasError.message}` }, { status: 500 });
            return NextResponse.json({ success: true, message: 'Leituras da empresa foram zeradas.' });
        }

        // ─── ZERAR EXAMES ───
        if (action === 'reset_exames') {
            if (!caller.isMaster) return NextResponse.json({ error: 'Apenas Master pode zerar exames.' }, { status: 403 });
            const { empresaId } = body;
            if (!empresaId) return NextResponse.json({ error: 'ID da empresa é obrigatório.' }, { status: 400 });

            const { error: examesError } = await adminClient
                .from('pet_exames')
                .delete()
                .eq('empresa_id', empresaId);

            if (examesError) return NextResponse.json({ error: `Erro ao limpar exames: ${examesError.message}` }, { status: 500 });
            return NextResponse.json({ success: true, message: 'Exames da empresa foram zerados.' });
        }

        // ─── ZERAR ORÇAMENTOS ───
        if (action === 'reset_orcamentos') {
            if (!caller.isMaster) return NextResponse.json({ error: 'Apenas Master pode zerar orçamentos.' }, { status: 403 });
            const { empresaId } = body;
            if (!empresaId) return NextResponse.json({ error: 'ID da empresa é obrigatório.' }, { status: 400 });

            const { error: orcamentosError } = await adminClient
                .from('pet_orcamentos')
                .delete()
                .eq('empresa_id', empresaId);

            if (orcamentosError) return NextResponse.json({ error: `Erro ao limpar orçamentos: ${orcamentosError.message}` }, { status: 500 });
            return NextResponse.json({ success: true, message: 'Orçamentos da empresa foram zerados.' });
        }

        // ─── IMPORTAR EXAMES (TUSS/ANS) ───
        if (action === 'import_exams') {
            if (!caller.isMaster) return NextResponse.json({ error: 'Apenas Master pode importar exames.' }, { status: 403 });
            const { empresaId, data } = body;
            
            if (!empresaId || !data || !Array.isArray(data)) {
                return NextResponse.json({ error: 'Dados inválidos para importação.' }, { status: 400 });
            }

            const examesToInsert = data.map((row: any) => ({
                empresa_id: empresaId,
                codigo: row['Código'] || row['codigo'] || row['Termo'] || row['termo'] || null,
                nome: row['Nome'] || row['nome'] || row['Descrição'] || row['descricao'] || 'Exame Sem Nome',
                tipo: 'Exame',
                valor_base: 0
            })).filter(exame => exame.nome && exame.nome !== 'Exame Sem Nome');

            if (examesToInsert.length === 0) {
                 return NextResponse.json({ error: 'Nenhum registro válido encontrado para importação.' }, { status: 400 });
            }

            const { error: importError } = await adminClient
                .from('pet_exames')
                .insert(examesToInsert);

            if (importError) return NextResponse.json({ error: `Erro na importação: ${importError.message}` }, { status: 500 });

            return NextResponse.json({ success: true, count: examesToInsert.length });
        }

        // ─── AUDITORIA DE BANCO DE DADOS E STORAGE ───
        if (action === 'get_audit_metrics') {
            if (!caller.isMaster) return NextResponse.json({ error: 'Apenas Master pode visualizar auditoria.' }, { status: 403 });
            
            const { data, error } = await adminClient.rpc('get_audit_metrics');
            if (error) {
                console.error("Erro no RPC get_audit_metrics:", error.message);
                return NextResponse.json({ error: `Função SQL get_audit_metrics não encontrada ou falhou: ${error.message}. Você já criou a função no Supabase?` }, { status: 500 });
            }
            
            return NextResponse.json({ success: true, metrics: data });
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
