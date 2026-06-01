const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    try {
        console.log("Checking tables in public schema...");
        const { data, error } = await supabase.rpc('query_columns');
        if (error) {
            console.log("RPC query_columns failed. Trying fallback catalog query.");
            // Fallback: try fetching from typical tables
            const tables = [
                'pet_pets', 'pet_usuarios', 'pet_empresas', 'pet_prontuarios', 
                'pet_movimentacoes', 'pet_planos_saude', 'pet_precos_exames', 
                'pet_faturamento', 'pet_agenda'
            ];
            for (const table of tables) {
                const { data, error } = await supabase.from(table).select('*').limit(1);
                if (error) {
                    console.log(`Table ${table}: Not Accessible / Doesn't Exist (${error.message})`);
                } else {
                    console.log(`Table ${table}: EXISTS (found ${data.length} records or accessible)`);
                }
            }
        } else {
            console.log("Columns data:", data);
        }
    } catch (e) {
        console.error("Error checking tables:", e);
    }
}

checkTables();
