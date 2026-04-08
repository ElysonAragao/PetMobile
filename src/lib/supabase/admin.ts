import { createClient } from '@supabase/supabase-js'

// Inicializa o cliente do Supabase passando a Service Role Key.
// Este cliente NÃO deve ser usado indiscriminadamente e NUNCA em componentes do cliente, 
// pois ele ignora o RLS e tem permissão máxima no banco.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
