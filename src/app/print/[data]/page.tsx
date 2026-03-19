"use client";
import * as React from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Beaker, Loader2, AlertTriangle, Printer, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Patient, Medico, Exam, Movimentacao } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';


import { useSession } from '@/context/session-context';


interface GuiaCompleta {
    movimentoId: string;
    data: string;
    patient: Patient;
    medico: Medico;
    exams: Exam[];
}


function PrintContent() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();
    const { isAuthenticated, isLoading: sessionLoading } = useSession();
    const supabase = React.useMemo(() => createClient(), []);
    
    // Garantir que trabalhamos com o parâmetro limpo
    const movimentoIdRaw = params.data as string;
    const movimentoId = movimentoIdRaw ? decodeURIComponent(movimentoIdRaw) : '';

    // Suporte para modo leitura
    const tipo = searchParams.get('tipo'); // 'leitura' or null (movimentação)
    const codLeitura = searchParams.get('codLeitura');
    const dataLeitura = searchParams.get('dataLeitura');

    const isLeitura = tipo === 'leitura';
    const titulo = isLeitura ? 'Relatório de Leitura' : 'Guia de Solicitação Médica';

    const [guia, setGuia] = React.useState<GuiaCompleta | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const fetchInProgress = React.useRef(false);

    React.useEffect(() => {
        const fetchGuiaWithRetry = async (retryCount = 0) => {
            if (!movimentoId) {
                setError("Nenhuma guia especificada.");
                setIsLoading(false);
                return;
            }

            // Tenta primeiro a entrega local (localStorage) - É instantâneo e resolve problemas de sessão no mobile
            if (retryCount === 0 && typeof window !== 'undefined') {
                try {
                    const cached = localStorage.getItem(`print-data-${movimentoId}`);
                    if (cached) {
                        const parsed = JSON.parse(cached);
                        console.log("Guia carregada via entrega local (localStorage)");
                        setGuia(parsed);
                        setIsLoading(false);
                        return;
                    }
                } catch (e) {
                    console.warn("Erro ao ler dados locais, tentando via banco...", e);
                }
            }

            // Se a sessão ainda está carregando, esperamos.
            // O SessionProvider tem um timeout de segurança que garante que sessionLoading ficará false.
            if (sessionLoading) {
                console.log("Aguardando carregamento da sessão para buscar guia...");
                return;
            }

            if (fetchInProgress.current && retryCount === 0) return;
            fetchInProgress.current = true;

            // No ambiente publicado, RLS pode falhar se a sessão não estiver 100% propagada
            if (retryCount === 0) {
                setIsLoading(true);
            }
            
            setError(null);
            
            try {
                console.log(`Tentativa ${retryCount + 1} de buscar guia:`, movimentoId);
                
                let query = supabase
                    .from('movimentacoes')
                    .select('*')
                    .eq('movimentoId', movimentoId);

                if (movimentoId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                    query = supabase.from('movimentacoes').select('*').or(`id.eq.${movimentoId},movimentoId.eq.${movimentoId}`);
                }

                const { data: movData, error: movError } = await query.maybeSingle();

                if (movError) {
                    console.error("Erro do Supabase ao buscar movimentação:", movError);
                    throw new Error(`Erro ao buscar guia: ${movError.message}`);
                }

                if (!movData) {
                    // Se não encontrou (pode ser delay de RLS), tenta novamente até 3 vezes
                    if (retryCount < 2) {
                        console.warn(`Guia não encontrada na tentativa ${retryCount + 1}. Tentando novamente em 1 segundo...`);
                        setTimeout(() => {
                            fetchInProgress.current = false;
                            fetchGuiaWithRetry(retryCount + 1);
                        }, 1000);
                        return;
                    }
                    throw new Error("Guia de movimentação não encontrada. Verifique as permissões de acesso ou se a guia existe.");
                }

                const { pacienteId, medicoId, exameIds, data: fetchedData } = movData;
                const fetchedMovimentoId = movData.movimentoId;

                // Busca Paciente
                // Nota: Verificamos os nomes reais das colunas no banco (health_plan_code, health_plan_name)
                const { data: patientDataSB, error: patientError } = await supabase
                    .from('pacientes')
                    .select('id, name:nome, cpf, telefone, email, endereco, matricula, dataNascimento:data_nascimento, codPaciente:cod_paciente, healthPlanCode:health_plan_code, healthPlanName:health_plan_name')
                    .eq('id', pacienteId)
                    .single();
                
                if (patientError || !patientDataSB) {
                    console.error("Erro ao buscar paciente:", patientError);
                    throw new Error("Dados do paciente não encontrados. Verifique as permissões.");
                }
                const patientData = patientDataSB as unknown as Patient;

                // Busca Médico
                const { data: medicoDataSB, error: medicoError } = await supabase
                    .from('usuarios')
                    .select('id, name:nome, crm:crm_uf, telefone, codMed:codigo')
                    .eq('id', medicoId)
                    .single();
                
                if (medicoError || !medicoDataSB) {
                    console.error("Erro ao buscar médico:", medicoError);
                    throw new Error("Médico não encontrado. Verifique as permissões.");
                }
                const medicoData = medicoDataSB as unknown as Medico;

                // Busca Exames
                let examsData: Exam[] = [];
                if (exameIds && exameIds.length > 0) {
                    const { data: examsDataSB, error: examsError } = await supabase
                        .from('exames')
                        .select('id, name:nome, description:descricao, type:tipo, examCode:codigo, idExame:id_exame')
                        .in('id', exameIds);
                    if (!examsError && examsDataSB) {
                        examsData = examsDataSB as unknown as Exam[];
                    }
                }

                setGuia({
                    movimentoId: fetchedMovimentoId,
                    data: fetchedData,
                    patient: patientData,
                    medico: medicoData,
                    exams: examsData
                });
                setIsLoading(false);

            } catch (e: any) {
                console.error("Erro detalhado no fetchGuia:", e);
                setError(e.message || "Erro ao carregar dados da guia.");
                setIsLoading(false);
            } finally {
                fetchInProgress.current = false;
            }
        };

        if (movimentoId && !fetchInProgress.current) {
            fetchGuiaWithRetry();
        } else if (!movimentoId) {
            setError("Nenhuma guia especificada.");
            setIsLoading(false);
        }
    }, [movimentoId, sessionLoading, supabase]);

    const handlePrint = () => {
        window.print();
    }

    const handleClose = () => {
        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem(`print-data-${movimentoId}`);
                localStorage.removeItem('movement-generated-guide');
            } catch (e) {}

            // Se for médico ou se viemos de uma movimentação, volta direto para gerar nova guia
            if (!isLeitura) {
                console.log("Retornando para Nova Guia...");
                window.location.href = `/movement?reset=${Date.now()}`;
            } else {
                window.location.href = `/?reset=${Date.now()}`;
            }
        }
    }


    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 no-print">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 animate-spin text-primary" />
                    <p className="text-lg text-muted-foreground">Carregando dados da guia...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 no-print">
                <Card className="w-full max-w-lg text-center shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex flex-col items-center justify-center gap-2">
                            <AlertTriangle className="w-10 h-10 text-destructive" />
                            <span className="mt-2 text-xl">Erro ao Carregar Dados</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="p-3 rounded-md bg-destructive/90 text-destructive-foreground">{error}</p>
                        <p className="mt-4 text-sm text-muted-foreground">Por favor, volte e tente gerar a guia novamente ou verifique o link.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (!guia) return null;

    // Dividir exames em colunas (2 colunas)
    const midPoint = Math.ceil(guia.exams.length / 2);
    const examsCol1 = guia.exams.slice(0, midPoint);
    const examsCol2 = guia.exams.slice(midPoint);

    return (
        <div className="bg-white text-black max-w-4xl mx-auto p-8 print-container font-sans">
            <header className="flex justify-between items-center mb-4 no-print">
                <h1 className="text-xl font-bold text-primary">PacienteMobile</h1>
                <div className="flex gap-2">
                    <Button onClick={handlePrint} className="font-bold text-base">
                        <Printer className="mr-2" /> Gerar PDF / Imprimir
                    </Button>
                    <Button onClick={handleClose} className="font-bold text-base" variant="outline">
                        FECHAR
                    </Button>
                </div>
            </header>

            <div className="no-print my-6">
                <Alert variant="default" className="text-left">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Como Salvar ou Enviar a Guia?</AlertTitle>
                    <AlertDescription>
                        Após clicar em &quot;Gerar PDF / Imprimir&quot;, na janela de impressão do seu navegador, escolha o destino <strong>&quot;Salvar como PDF&quot;</strong>. Depois de salvo, você poderá anexar o arquivo em um e-mail ou enviá-lo pelo WhatsApp.
                    </AlertDescription>
                </Alert>
            </div>

            {/* Título do documento */}
            <h1 className="text-center text-2xl font-bold mb-4">{titulo}</h1>

            {/* Cabeçalho com informações */}
            <section className="flex justify-between items-center mb-4 text-sm">
                <div>
                    {isLeitura && codLeitura && (
                        <><strong>Código Leitura:</strong> {codLeitura} &nbsp;|&nbsp; </>
                    )}
                    {isLeitura && dataLeitura && (
                        <><strong>Data Leitura:</strong> {new Date(dataLeitura).toLocaleString('pt-BR')}</>
                    )}
                    {!isLeitura && (
                        <><strong>Data do Pedido:</strong> {new Date(guia.data).toLocaleString('pt-BR')}</>
                    )}
                </div>
                <div><strong>Movimentação:</strong> {guia.movimentoId}</div>
            </section>

            {/* Dados do Paciente e Médico */}
            <section className="mb-4 text-base border-t border-b border-black py-3">
                <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                    <p className="col-span-1"><strong>Nome:</strong> {guia.patient.name}</p>
                    <p className="col-span-1"><strong>Data Nasc.:</strong> {guia.patient.dataNascimento ? new Date(guia.patient.dataNascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}</p>
                    <p className="col-span-1"><strong>Idade:</strong> {guia.patient.idade || '-'}</p>

                    <p className="col-span-1"><strong>Gênero:</strong> {guia.patient.genero || '-'}</p>
                    <p className="col-span-1"><strong>CPF:</strong> {guia.patient.cpf}</p>
                    <p className="col-span-1"><strong>Telefone:</strong> {guia.patient.telefone}</p>

                    <p className="col-span-1"><strong>ID Plano:</strong> {guia.patient.healthPlanCode}</p>
                    <p className="col-span-1"><strong>Plano:</strong> {guia.patient.healthPlanName}</p>
                    <p className="col-span-1"><strong>Matrícula:</strong> {guia.patient.matricula || 'N/A'}</p>

                    <p className="col-span-2"><strong>Médico(a):</strong> Dr(a). {guia.medico.name}</p>
                    <p className="col-span-1"><strong>CRM/UF:</strong> {guia.medico.crm}</p>
                </div>
            </section>

            {/* QR Code - posição fixa, antes dos exames */}
            <section className="flex flex-col items-center justify-center my-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=${encodeURIComponent(guia.movimentoId)}`}
                    width={180}
                    height={180}
                    alt={`QR Code para a guia ${guia.movimentoId}`}
                />
            </section>

            {/* Exames em 2 colunas */}
            <section>
                <h2 className="text-xl font-bold mb-3 flex items-center gap-2 border-t border-black pt-3">
                    <Beaker size={22} /> Exames Solicitados ({guia.exams.length})
                </h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    <div className="space-y-2">
                        {examsCol1.map(exam => (
                            <div key={exam.id}>
                                <p className="text-base">
                                    • <strong>{exam.idExame || ''}</strong> - {exam.name}
                                </p>
                                {!isLeitura && exam.description && (
                                    <p className="text-sm text-gray-600 ml-4">{exam.description}</p>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="space-y-2">
                        {examsCol2.map(exam => (
                            <div key={exam.id}>
                                <p className="text-base">
                                    • <strong>{exam.idExame || ''}</strong> - {exam.name}
                                </p>
                                {!isLeitura && exam.description && (
                                    <p className="text-sm text-gray-600 ml-4">{exam.description}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Data de movimentação no rodapé para leitura */}
            {isLeitura && (
                <section className="mt-6 pt-3 border-t border-black text-sm text-center text-gray-600">
                    <p><strong>Data da Movimentação Original:</strong> {new Date(guia.data).toLocaleString('pt-BR')}</p>
                </section>
            )}

            <style jsx global>{`
          @media print {
            .no-print {
              display: none !important;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            @page {
              size: A4;
              margin: 0;
            }
            .print-container {
                font-size: 12pt;
                padding: 2.5rem;
            }
            .print-container h1 {
                font-size: 18pt;
            }
             .print-container h2 {
                font-size: 14pt;
             }
             .print-container p, .print-container div, .print-container strong {
                font-size: 12pt !important;
             }
             .print-container .text-sm {
                font-size: 11pt !important;
             }
             .print-container .text-base {
                font-size: 12pt !important;
             }
          }
        `}</style>
        </div>
    )
}

function PrintLayout() {
    return (
        <React.Suspense fallback={<div className="flex justify-center p-12 text-muted-foreground">Preparando impressão...</div>}>
            <PrintContent />
        </React.Suspense>
    );
}

export default PrintLayout;
