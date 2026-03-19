const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    const { data: cols } = await supabase.rpc('query_columns'); // may fail if not defined

    // Just fetch all patients to see duplicates
    const { data: pat } = await supabase.from('patients').select('id, cpf, name, tenant_id');
    console.log(`TOTAL PATIENTS: ${pat.length}`);
    console.log(pat.map(p => `${p.id} - ${p.name} - ${p.cpf} (Tenant: ${p.tenant_id})`).join('\n'));
}

checkSchema();
