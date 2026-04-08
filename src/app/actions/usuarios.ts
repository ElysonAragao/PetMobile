'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'

export async function forcarTrocaDeSenha(userId: string, novaSenha: string) {
  try {
    // IMPORTANTE: Aqui você pode adicionar lógica para validar sessão de administrador
    // ou checar se o usuário logado tem permissão para esta ação antes de prosseguir.

    // 1. Usamos o cliente 'admin' para chamar a API e forçar a senha, ignorando RLS
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: novaSenha }
    )

    // 2. Se a API falhar (ex: senha muito curta, id não existe), retorna a mensagem de erro
    if (error) {
       console.error("Erro interno do Supabase ao trocar senha:", error.message);
       return { sucesso: false, erro: error.message }
    }

    // 3. Caso dê tudo certo
    return { sucesso: true, mensagem: 'Senha do usuário atualizada com sucesso!' }
    
  } catch (err: any) {
    console.error("Erro inesperado na Action forcarTrocaDeSenha:", err)
    return { sucesso: false, erro: err.message || 'Erro inesperado durante a redefinição de senha.' }
  }
}
