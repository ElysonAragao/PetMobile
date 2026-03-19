import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// ESTE SCRIPT DEVE SER RODADO COM NODE.JS
// Exige dependências: npm install firebase-admin @supabase/supabase-js dotenv

// 1. Configurar credentials do Firebase Admin
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serviceAccountPath = join(__dirname, "firebase-service-account.json");
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = getFirestore();

// 2. Configurar Supabase
// Usaremos a SERVICE_ROLE_KEY do Supabase para ter poderes de ADMIN e ignorar as políticas RLS durante a migração.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // NÃO É A ANON KEY!

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Faltam variáveis de ambiente do Supabase (URL ou SERVICE_ROLE_KEY).");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// UUID para o Tenant "Empresa Teste"
const EMPRESA_TESTE_ID = '00000000-0000-0000-0000-000000000000'; // Será gerado aleatoriamente se não existir

async function runMigration() {
    console.log("Iniciando Migração Firebase -> Supabase...");

    try {
        // 1. Criar ou Obter o Tenant "Empresa Teste"
        let tenantId;
        const { data: existingTenant } = await supabase.from('tenants').select('id').eq('name', 'Empresa Teste').limit(1);

        if (existingTenant && existingTenant.length > 0) {
            tenantId = existingTenant[0].id;
            console.log(`✅ Tenant 'Empresa Teste' já existe. ID: ${tenantId}`);
        } else {
            const { data: newTenant, error } = await supabase.from('tenants').insert({ name: 'Empresa Teste' }).select('id').single();
            if (error) throw error;
            tenantId = newTenant.id;
            console.log(`✅ Tenant 'Empresa Teste' criado. ID: ${tenantId}`);
        }

        // MAPAS para converter IDs do Firebase para UUIDs do Postgres
        const pacientesMap = new Map(); // firestore_id -> postgres_uuid
        const medicosMap = new Map();
        const examesCatMap = new Map(); // codExame -> postgres_uuid

        // 2. Migrar Pacientes
        console.log("Migrando Pacientes...");
        const pacientesSnap = await db.collection('pacientes').get();
        for (const doc of pacientesSnap.docs) {
            const data = doc.data();
            const payload = {
                tenant_id: tenantId,
                name: data.name,
                cpf: data.cpf,
                phone: data.telefone,
                // Firebase não tinha birth_date nativo simples neste app, mas mapeamos os cruciais
            };
            const { data: inserted, error } = await supabase.from('patients').insert(payload).select('id').single();
            if (error) console.error("Erro no paciente:", data.cpf, error.message);
            else pacientesMap.set(doc.id, inserted.id);
        }
        console.log(`✅ ${pacientesMap.size} pacientes migrados.`);

        // 3. Migrar Médicos
        console.log("Migrando Médicos...");
        const medicosSnap = await db.collection('medicos').get();
        for (const doc of medicosSnap.docs) {
            const data = doc.data();
            const payload = {
                tenant_id: tenantId,
                name: data.name,
                crm: data.crm,
                phone: data.telefone || data.phone || null,
                cod_med: data.codMed || data.cod_med || 'MED999'
            };
            const { data: inserted, error } = await supabase.from('medicos').insert(payload).select('id').single();
            if (error) console.error("Erro no médico:", data.crm, error.message);
            else medicosMap.set(doc.id, inserted.id);
        }
        console.log(`✅ ${medicosMap.size} médicos migrados.`);

        // 4. Migrar Planos de Saúde
        console.log("Migrando Planos de Saúde...");
        const planosSnap = await db.collection('planosSaude').get();
        let planosCount = 0;
        for (const doc of planosSnap.docs) {
            const data = doc.data();
            const payload = {
                tenant_id: tenantId,
                name: data.nome,
                ans_code: data.idPlano || data.codPlano
            };
            const { error } = await supabase.from('health_plans').insert(payload);
            if (error) console.error("Erro no plano:", data.nome, error.message);
            else planosCount++;
        }
        console.log(`✅ ${planosCount} planos de saúde migrados.`);

        // 5. Migrar Exames (Catálogo)
        console.log("Migrando Catálogo de Exames...");
        const examesSnap = await db.collection('exames').get();
        for (const doc of examesSnap.docs) {
            const data = doc.data();
            const payload = {
                tenant_id: tenantId,
                name: data.name,
                description: data.description,
                type: data.type,
                code: data.examCode
            };
            const { data: inserted, error } = await supabase.from('exams').insert(payload).select('id').single();
            if (error) console.error("Erro no exame:", data.name, error.message);
            else examesCatMap.set(data.examCode, inserted.id);
        }
        console.log(`✅ ${examesCatMap.size} tipos de exames migrados.`);

        // 6. Migrar Leituras
        console.log("Migrando Leituras (Atendimentos)...");
        const leiturasSnap = await db.collection('leituras').get();
        let leiturasCount = 0;
        for (const doc of leiturasSnap.docs) {
            const data = doc.data();

            // Tenta achar o paciente na base do postgres via CPF, senão pula (ou usa o ID do map)
            let patientIdResult = null;
            if (data.pacienteCpf) {
                const { data: p } = await supabase.from('patients').select('id').eq('cpf', data.pacienteCpf).limit(1);
                if (p && p.length > 0) patientIdResult = p[0].id;
            }

            let medicoIdResult = null;
            if (data.medicoCrm) {
                const { data: m } = await supabase.from('medicos').select('id').eq('crm', data.medicoCrm).limit(1);
                if (m && m.length > 0) medicoIdResult = m[0].id;
            }

            if (!patientIdResult || !medicoIdResult) {
                console.log(`⚠️ Pulando leitura ${data.codLeitura} por falta de vínculo forte (Paciente/Médico não encontrados).`);
                continue;
            }

            const payloadLeitura = {
                tenant_id: tenantId,
                paciente_id: patientIdResult,
                medico_id: medicoIdResult,
                cod_leitura: data.codLeitura,
                data_leitura: new Date(data.dataLeitura).toISOString(), // ou o timestamp se for Firebase timestamp
                status: 'Realizado',
                metadata: {
                    pacienteHealthPlanCode: data.pacienteHealthPlanCode,
                    pacienteHealthPlanName: data.pacienteHealthPlanName,
                    movimentoId: data.movimentoId
                }
            };

            const { data: novaLeitura, error } = await supabase.from('leituras').insert(payloadLeitura).select('id').single();

            if (error) {
                console.error("Erro na leitura:", data.codLeitura, error.message);
                continue;
            }

            leiturasCount++;

            // Vincular Exames a esta leitura
            if (data.exames && data.exames.length > 0) {
                const links = [];
                for (const ex of data.exames) {
                    const examId = examesCatMap.get(ex.examCode);
                    if (examId) {
                        links.push({
                            leitura_id: novaLeitura.id,
                            exam_id: examId,
                            tenant_id: tenantId
                        });
                    }
                }
                if (links.length > 0) {
                    await supabase.from('leitura_exames').insert(links);
                }
            }
        }
        console.log(`✅ ${leiturasCount} leituras migradas com sucesso.`);

        console.log("🎉 MIGRAÇÃO CONCLUÍDA!");

    } catch (err) {
        console.error("Erro fatal durante a migração:", err);
    }
}

runMigration();
