import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const rawConfig = fs.readFileSync('.env.local', 'utf-8');
const config = {};
rawConfig.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && values.length > 0) {
        config[key.trim()] = values.join('=').trim().replace(/['"]/g, '');
    }
});

const url = config.NEXT_PUBLIC_SUPABASE_URL;
const key = config.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function check() {
    const pacienteId = 'e79a1853-7ea4-4d0e-9bfb-8d665b981765';
    console.log(`Fetching patient ${pacienteId} from Supabase anonymously...`);
    const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', pacienteId)
        .single();

    if (error) {
        console.error("Error fetching patient:", error);
    } else {
        console.log("Patient data:", data);
    }
    process.exit(0);
}

check().catch(console.error);
