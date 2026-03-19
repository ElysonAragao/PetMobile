"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { QrCode, Send, Printer, RefreshCw, Loader2, PlusCircle, Stethoscope, FileText, Info, Undo2, Search } from 'lucide-react';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';

import { PageTitle } from '@/components/layout/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import useLocalStorage from '@/hooks/use-local-storage';


import { Patient, Medico, Exam } from '@/lib/types';
import { usePatients } from '@/hooks/use-patients';
import { useMedicos } from '@/hooks/use-medicos';
import { useExams } from '@/hooks/use-exams';
import { useSession } from '@/context/session-context';
import { useMovement } from '@/hooks/use-movement';

const movementSchema = z.object({
    patientId: z.string({ required_error: 'Paciente é obrigatório.' }).min(1, 'Paciente é obrigatório.'),
    medicoId: z.string({ required_error: 'Médico é obrigatório.' }).min(1, 'Médico é obrigatório.'),
    examIds: z.array(z.string()).min(1, 'Selecione ao menos um exame.'),
});

type MovementFormValues = z.infer<typeof movementSchema>;

interface GeneratedGuide {
    movimentoId: string;
    qrCodeData: string; // This will now just be the movimentoId string
    patient: Patient;
    medico: Medico;
    exams: Exam[];
}


function MovementContent() {
    const { createMovimento, isLoading: movementApiLoading } = useMovement();
    const { patients, isLoaded: patientsLoaded } = usePatients();
    const { medicos, isLoaded: medicosLoaded } = useMedicos();
    const { exams, isLoaded: examsLoaded } = useExams();
    const { toast } = useToast();
    const { user: currentUser } = useSession();

    // Log de depuração para detectar loops de re-renderização
    React.useEffect(() => {
        console.log("MovementContent montado ou re-renderizado. User:", currentUser?.nome);
    }, [currentUser]);
    
    // Suporte para médico logado (status normalizado no SessionProvider)
    const isSpecificMedico = currentUser?.status === 'Medico';
    const isGeralRole = ['Master', 'Administrador', 'Administrador Auxiliar', 'Secretária Geral', 'Medico Geral'].includes(currentUser?.status || '');

    const [generatedGuide, setGeneratedGuide] = useLocalStorage<GeneratedGuide | null>('movement-generated-guide', null);
    const [patientSearch, setPatientSearch] = React.useState('');
    const [medicoSearch, setMedicoSearch] = React.useState('');
    const [examSearch, setExamSearch] = React.useState('');
    const [resetCounter, setResetCounter] = React.useState(0);
    const router = useRouter();
    const searchParams = useSearchParams();

    const patientSearchInputRef = React.useRef<HTMLInputElement>(null);
    const medicoSearchInputRef = React.useRef<HTMLInputElement>(null);
    const medicoSelectTriggerRef = React.useRef<HTMLButtonElement>(null);
    const examSelectContainerRef = React.useRef<HTMLDivElement>(null);
    const submitButtonRef = React.useRef<HTMLButtonElement>(null);
    const printButtonRef = React.useRef<HTMLButtonElement>(null);

    React.useEffect(() => {
        patientSearchInputRef.current?.focus();

        // Limpeza de dados de impressão antigos para não saturar o localStorage
        try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('print-data-')) {
                    keysToRemove.push(key);
                }
            }
            // Mantém apenas os 5 mais recentes, remove o resto
            if (keysToRemove.length > 5) {
                keysToRemove.sort().slice(0, keysToRemove.length - 5).forEach(k => localStorage.removeItem(k));
            }
        } catch (e) {
            console.warn("Falha ao limpar cache de impressão:", e);
        }
    }, []);

    React.useEffect(() => {
        if (generatedGuide && printButtonRef.current) {
            printButtonRef.current.focus();
        }
    }, [generatedGuide]);


    const filteredPatients = React.useMemo(() => {
        if (!patientSearch) return patients;
        return patients.filter(p =>
            p.name.toLowerCase().includes(patientSearch.toLowerCase())
        );
    }, [patients, patientSearch]);

    const filteredMedicos = React.useMemo(() => {
        if (!medicoSearch) return medicos;
        return medicos.filter(m =>
            m.name.toLowerCase().includes(medicoSearch.toLowerCase())
        );
    }, [medicos, medicoSearch]);

    const form = useForm<MovementFormValues>({
        resolver: zodResolver(movementSchema),
        defaultValues: {
            patientId: '',
            medicoId: '',
            examIds: [],
        },
    });

    const selectedPatientId = form.watch('patientId');
    const selectedMedicoId = form.watch('medicoId');
    const currentPatient = React.useMemo(() => {
        return patients.find(p => p.id === selectedPatientId);
    }, [patients, selectedPatientId]);

    const filteredExams = React.useMemo(() => {
        let baseExams = exams;

        if (currentPatient && currentPatient.healthPlanName) {
            baseExams = exams.filter(e =>
                !e.healthPlanName ||
                e.healthPlanName.trim() === '' ||
                e.healthPlanName.trim().toLowerCase() === currentPatient.healthPlanName.trim().toLowerCase()
            );
        }

        if (!examSearch) return baseExams;

        const searchLower = examSearch.toLowerCase();
        return baseExams.filter(e =>
            e.name.toLowerCase().includes(searchLower) ||
            (e.idExame && e.idExame.toLowerCase().includes(searchLower)) ||
            e.examCode.toLowerCase().includes(searchLower)
        );
    }, [exams, examSearch, currentPatient]); // fixed dependencies

    // Auto-select doctor if the logged-in user is a specific 'Medico'
    React.useEffect(() => {
        if (isSpecificMedico && currentUser?.id && selectedMedicoId !== currentUser.id) {
            form.setValue('medicoId', currentUser.id, { shouldValidate: true });
        }
    }, [isSpecificMedico, currentUser, form, selectedMedicoId]);

    React.useEffect(() => {
        const newPatientId = searchParams.get('newPatientId');
        if (newPatientId && selectedPatientId !== newPatientId && patients.some(p => p.id === newPatientId)) {
            form.setValue('patientId', newPatientId);
            router.replace('/movement', { scroll: false });
            setTimeout(() => medicoSelectTriggerRef.current?.focus(), 100);
        }
        const newMedicoId = searchParams.get('newMedicoId');
        if (newMedicoId && selectedMedicoId !== newMedicoId && medicos.some(m => m.id === newMedicoId)) {
            form.setValue('medicoId', newMedicoId);
            router.replace('/movement', { scroll: false });
            setTimeout(() => examSelectContainerRef.current?.focus(), 100);
        }
    }, [searchParams, patients, medicos, form, router, selectedPatientId, selectedMedicoId]);


    // Efeito para detectar reset forçado vindo do PDF ou clique em Nova Guia
    React.useEffect(() => {
        if (searchParams.get('reset')) {
            console.log("Recarga total concluída. Sistema pronto.");
            resetForm(true); 
            router.replace('/movement', { scroll: false });
        }
    }, [searchParams, router]);

    const [submittingGuide, setSubmittingGuide] = React.useState(false);

    const onSubmit = async (values: MovementFormValues) => {
        if (submittingGuide || generatedGuide) return;

        setSubmittingGuide(true);
        const fullPatientData = patients.find(p => p.id === values.patientId);
        const fullMedicoData = medicos.find(m => m.id === values.medicoId);
        const fullExamsData = exams.filter(e => values.examIds.includes(e.id));

        if (!fullPatientData || !fullMedicoData || fullExamsData.length === 0) {
            toast({ title: 'Dados incompletos', variant: 'destructive' });
            setSubmittingGuide(false);
            return;
        }

        // Timer de pânico local: 10 segundos para desistir e sugerir reset
        const timeoutId = setTimeout(() => {
            setSubmittingGuide(false);
            if (confirm("A conexão parece travada. Deseja recarregar a página para tentar de novo?")) {
                resetForm();
            }
        }, 10000);

        try {
            console.log("Iniciando criação de movimento via createMovimento hook...");
            const result = await createMovimento(values.patientId, values.medicoId, values.examIds);
            console.log("Resultado de createMovimento:", result);
            clearTimeout(timeoutId);

            if (result.success && result.movimentoId) {
                setGeneratedGuide({
                    movimentoId: result.movimentoId,
                    qrCodeData: result.movimentoId,
                    patient: fullPatientData,
                    medico: fullMedicoData,
                    exams: fullExamsData,
                });
                toast({ title: 'Guia Gerada!' });
            } else {
                toast({ title: 'Falha na conexão', description: 'Tente recarregar a página.', variant: 'destructive' });
            }
        } catch (error) {
            clearTimeout(timeoutId);
            toast({ title: 'Erro Crítico', variant: 'destructive' });
        } finally {
            setSubmittingGuide(false);
        }
    };

    const handleViewAndPrint = () => {
        if (!generatedGuide) return;
        localStorage.setItem(`print-data-${generatedGuide.movimentoId}`, JSON.stringify({ ...generatedGuide, data: new Date().toISOString() }));
        window.location.href = `/print/${generatedGuide.movimentoId}`;
    };

    const resetForm = (isInitial = false) => {
        if (!isInitial) {
            // Forçamos RECARGA TOTAL (Hard Reload) para limpar conexões zumbis
            localStorage.removeItem('movement-generated-guide');
            window.location.href = '/movement?reset=' + Date.now();
            return;
        }
        setPatientSearch('');
        setMedicoSearch('');
        setExamSearch('');
        setGeneratedGuide(null);
        setResetCounter(prev => prev + 1);
        form.reset({
            patientId: isSpecificMedico ? (currentUser?.id || '') : '',
            medicoId: isSpecificMedico ? (currentUser?.id || '') : '',
            examIds: [],
        });
        setTimeout(() => patientSearchInputRef.current?.focus(), 100);
    };

    const [forceShow, setForceShow] = React.useState(false);
    
    // Timer de segurança para a própria página de movimentação
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setForceShow(true);
        }, 12000); // 12 segundos de tolerância antes de liberar a UI
        return () => clearTimeout(timer);
    }, []);

    const isLoading = (!patientsLoaded || !medicosLoaded || !examsLoaded) && !forceShow;

    const handleManualRefresh = () => {
        window.location.reload();
    };

    const handleClearCacheAndRetry = () => {
        // Limpa estados do Supabase e do app que podem estar travando o Hook
        if (typeof window !== 'undefined') {
            localStorage.removeItem('sb-ybnkjsnyzphcptjkyxov-auth-token');
            localStorage.removeItem('session-user');
            localStorage.removeItem('selected-empresa-id');
            sessionStorage.clear();
            window.location.href = '/login?reset=true';
        }
    };

    if (isLoading) {
        return (
            <>
                <PageTitle title="Movimentação" description="Gere guias de exames com QR Code." />
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 p-4 text-center">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="w-12 h-12 animate-spin text-primary" />
                        <div className="space-y-2">
                            <p className="text-lg font-medium">Sincronizando dados da clínica...</p>
                            <p className="text-sm text-muted-foreground italic">
                                {!patientsLoaded ? "• Pacientes " : ""}
                                {!medicosLoaded ? "• Médicos " : ""}
                                {!examsLoaded ? "• Exames " : ""}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 w-full max-w-xs mt-8">
                        <Button variant="outline" onClick={handleManualRefresh} className="flex gap-2">
                            <RefreshCw className="w-4 h-4" /> Atualizar Página
                        </Button>
                        <Button variant="ghost" onClick={handleClearCacheAndRetry} className="text-xs text-muted-foreground">
                            Problemas ao carregar? Limpar sessão e reiniciar
                        </Button>
                    </div>
                </div>
            </>
        )
    }

    return (
        <>
            <PageTitle title="Movimentação de Paciente" description="Gere guias de exames com QR Code para impressão e compartilhamento.">
                <Link href="/" passHref>
                    <Button variant="outline">
                        <Undo2 className="mr-2 h-4 w-4" />
                        Voltar ao Menu
                    </Button>
                </Link>
            </PageTitle>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

                <Card>
                    <CardHeader>
                        <CardTitle>Gerar Guia</CardTitle>
                        <CardDescription>Selecione o paciente, o médico e os exames para gerar a guia.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                                <FormField
                                    control={form.control}
                                    name="patientId"
                                    render={({ field }) => {
                                        const selectedPatient = patients.find(p => p.id === field.value);
                                        return (
                                            <FormItem>
                                                <FormLabel>Paciente</FormLabel>
                                                {patients.length > 0 ? (
                                                    <div className="space-y-2">
                                                        <div className="relative">
                                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                            <Input
                                                                ref={patientSearchInputRef}
                                                                placeholder="Filtrar paciente por nome..."
                                                                value={patientSearch}
                                                                onChange={(e) => setPatientSearch(e.target.value)}
                                                                className="pl-10"
                                                            />
                                                        </div>
                                                        {selectedPatient && (
                                                            <div className="border p-2 rounded-md bg-muted/50">
                                                                <p className="text-xs font-medium text-muted-foreground">Paciente Selecionado:</p>
                                                                <p className="font-semibold">{selectedPatient.name}</p>
                                                            </div>
                                                        )}
                                                        <Select
                                                            onValueChange={(value) => {
                                                                field.onChange(value);
                                                                setPatientSearch('');
                                                                setTimeout(() => medicoSelectTriggerRef.current?.focus(), 100);
                                                            }}
                                                            value={field.value}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <span className="text-muted-foreground">
                                                                        {selectedPatient ? 'Alterar paciente...' : 'Selecione um paciente...'}
                                                                    </span>
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {filteredPatients.length > 0 ? filteredPatients.map((p) => (
                                                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                                )) : (
                                                                    <div className="p-4 text-center text-sm text-muted-foreground">
                                                                        {patientSearch ? (
                                                                            <>
                                                                                <p>Nenhum paciente encontrado para "{patientSearch}".</p>
                                                                                <Button asChild variant="link" className="mt-2 h-auto p-0">
                                                                                    <Link href={`/patients?tab=register&redirect=/movement&name=${encodeURIComponent(patientSearch)}`}>
                                                                                        <PlusCircle className="mr-2 h-4 w-4" />
                                                                                        Cadastrar Novo Paciente
                                                                                    </Link>
                                                                                </Button>
                                                                            </>
                                                                        ) : "Nenhum paciente encontrado."}
                                                                    </div>
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                ) : (
                                                    <div className="p-4 text-sm text-center text-muted-foreground border rounded-md">
                                                        <p>Nenhum paciente encontrado.</p>
                                                        <Link href="/patients?tab=register">
                                                            <Button variant="link" className="mt-2 h-auto p-0">
                                                                <PlusCircle className="mr-2 h-4 w-4" />
                                                                Cadastrar Novo Paciente
                                                            </Button>
                                                        </Link>
                                                    </div>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        );
                                    }}
                                />

                                <FormField
                                    control={form.control}
                                    name="medicoId"
                                    render={({ field }) => {
                                        const selectedMedico = medicos.find(m => m.id === field.value);
                                        return (
                                            <FormItem>
                                                <FormLabel>Médico</FormLabel>
                                                {medicos.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {isSpecificMedico && currentUser ? (
                                                            <div className="border p-4 rounded-md bg-muted/50 flex items-center justify-between">
                                                                <div>
                                                                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Stethoscope className="w-3 h-3" /> Médico Responsável (Logado):</p>
                                                                    <p className="font-semibold text-lg">{currentUser.nome}</p>
                                                                </div>
                                                                <Button type="button" variant="outline" size="sm" onClick={() => form.setValue('medicoId', currentUser.id, { shouldValidate: true })}> Confirmar </Button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="relative">
                                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                                    <Input
                                                                        ref={medicoSearchInputRef}
                                                                        placeholder="Filtrar médico por nome..."
                                                                        value={medicoSearch}
                                                                        onChange={(e) => setMedicoSearch(e.target.value)}
                                                                        className="pl-10"
                                                                    />
                                                                </div>
                                                                {selectedMedico && (
                                                                    <div className="border p-2 rounded-md bg-muted/50">
                                                                        <p className="text-xs font-medium text-muted-foreground">Médico Selecionado:</p>
                                                                        <p className="font-semibold">{selectedMedico.name}</p>
                                                                    </div>
                                                                )}
                                                                <Select
                                                                    onValueChange={(value) => {
                                                                        field.onChange(value);
                                                                        setMedicoSearch('');
                                                                        setTimeout(() => examSelectContainerRef.current?.focus(), 100);
                                                                    }}
                                                                    value={field.value}
                                                                >
                                                                    <FormControl>
                                                                        <SelectTrigger ref={medicoSelectTriggerRef}>
                                                                            <span className="text-muted-foreground">
                                                                                {selectedMedico ? 'Alterar médico...' : 'Selecione um médico...'}
                                                                            </span>
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        {filteredMedicos.length > 0 ? filteredMedicos.map((m) => (
                                                                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                                                        )) : (
                                                                            <div className="p-4 text-center text-sm text-muted-foreground">
                                                                                {medicoSearch ? (
                                                                                    <>
                                                                                        <p>Nenhum médico encontrado para "{medicoSearch}".</p>
                                                                                        {!isSpecificMedico && (
                                                                                            <Button asChild variant="link" className="mt-2 h-auto p-0">
                                                                                                <Link href={`/medicos?tab=register&redirect=/movement&name=${encodeURIComponent(medicoSearch)}`}>
                                                                                                    <PlusCircle className="mr-2 h-4 w-4" />
                                                                                                    Cadastrar Novo Médico
                                                                                                </Link>
                                                                                            </Button>
                                                                                        )}
                                                                                    </>
                                                                                ) : "Nenhum médico encontrado."}
                                                                            </div>
                                                                        )}
                                                                    </SelectContent>
                                                                </Select>
                                                            </>
                                                        )}
                                                    </div>
                                                ) : isSpecificMedico && currentUser ? (
                                                    <div className="border p-4 rounded-md bg-muted/50 flex items-center justify-between">
                                                        <div>
                                                            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Stethoscope className="w-3 h-3" /> Médico Responsável (Logado):</p>
                                                            <p className="font-semibold text-lg">{currentUser.nome}</p>
                                                        </div>
                                                        <Button type="button" variant="outline" size="sm" onClick={() => form.setValue('medicoId', currentUser.id, { shouldValidate: true })}> Confirmar </Button>
                                                    </div>
                                                ) : (
                                                    <div className="p-4 text-sm text-center text-muted-foreground border rounded-md">
                                                        <p>Nenhum médico encontrado.</p>
                                                        <Link href="/medicos?tab=register">
                                                            <Button variant="link" className="mt-2 h-auto p-0">
                                                                <PlusCircle className="mr-2 h-4 w-4" />
                                                                Cadastrar Novo Médico
                                                            </Button>
                                                        </Link>
                                                    </div>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        );
                                    }}
                                />

                                <FormField
                                    control={form.control}
                                    name="examIds"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Exames</FormLabel>
                                            {exams.length > 0 ? (
                                                <div className="space-y-2">
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <Input
                                                            placeholder="Filtrar exames por nome ou ID..."
                                                            value={examSearch}
                                                            onChange={(e) => setExamSearch(e.target.value)}
                                                            className="pl-10"
                                                        />
                                                    </div>
                                                    <ScrollArea
                                                        key={`exams-scroll-${resetCounter}`}
                                                        ref={examSelectContainerRef}
                                                        tabIndex={-1}
                                                        className="h-48 w-full rounded-md border p-4 focus:outline-none focus:ring-2 focus:ring-ring"
                                                    >
                                                        <div className="space-y-4">
                                                            {filteredExams.length > 0 ? filteredExams.map((item) => (
                                                                <FormField
                                                                    key={item.id}
                                                                    control={form.control}
                                                                    name="examIds"
                                                                    render={({ field }) => {
                                                                        return (
                                                                            <FormItem
                                                                                key={item.id}
                                                                                className="flex flex-row items-start space-x-3 space-y-0"
                                                                            >
                                                                                <FormControl>
                                                                                    <Checkbox
                                                                                        checked={field.value?.includes(item.id)}
                                                                                        onCheckedChange={(checked) => {
                                                                                            return checked
                                                                                                ? field.onChange([...(field.value || []), item.id])
                                                                                                : field.onChange(
                                                                                                    (field.value || []).filter(
                                                                                                        (value) => value !== item.id
                                                                                                    )
                                                                                                );
                                                                                        }}
                                                                                    />
                                                                                </FormControl>
                                                                                <FormLabel className="font-normal text-sm">
                                                                                    <span className="font-mono font-semibold text-primary">{item.idExame || item.examCode}</span>{' '}
                                                                                    — {item.name}
                                                                                </FormLabel>
                                                                            </FormItem>
                                                                        );
                                                                    }}
                                                                />
                                                            )) : (
                                                                <div className="text-center py-4 space-y-2">
                                                                    <p className="text-sm text-muted-foreground">
                                                                        {examSearch ? `Nenhum exame encontrado para "${examSearch}".` : 'Nenhum exame disponível.'}
                                                                    </p>
                                                                    {!examSearch && currentPatient?.healthPlanName && (
                                                                        <p className="text-xs text-muted-foreground">
                                                                            Exibindo apenas exames genéricos ou exclusivos do plano <strong>{currentPatient.healthPlanName}</strong>. 
                                                                            Se o exame esperado não aparece, verifique o cadastro do exame.
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </ScrollArea>
                                                </div>
                                            ) : !isSpecificMedico ? (
                                                <div className="p-4 text-sm text-center text-muted-foreground border rounded-md">
                                                    <p>Nenhum exame encontrado no servidor.</p>
                                                    <p className="text-xs mb-3 mt-1">Verifique sua conexão e se há exames cadastrados para esta clínica.</p>
                                                    <Link href="/exams?tab=register">
                                                        <Button variant="outline" className="h-9 px-4">
                                                            <PlusCircle className="mr-2 h-4 w-4" />
                                                            Cadastrar Novo Exame
                                                        </Button>
                                                    </Link>
                                                </div>
                                            ) : (
                                                <div className="p-4 text-sm text-center text-muted-foreground border rounded-md">
                                                    <p>Nenhum exame encontrado. Solicite ao supervisor o cadastro.</p>
                                                </div>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />


                                {!generatedGuide && (
                                    <Button ref={submitButtonRef} type="submit" className="w-full" disabled={submittingGuide}>
                                        {submittingGuide ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Gerando...
                                            </>
                                        ) : (
                                            <>
                                                <QrCode className="mr-2 h-4 w-4" />
                                                Gerar Guia e QR Code
                                            </>
                                        )}
                                    </Button>
                                )}
                                {generatedGuide && (
                                    <Button type="button" variant="outline" className="w-full" onClick={() => resetForm()}>
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Gerar Nova Guia
                                    </Button>
                                )}
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>Resultado</CardTitle>
                                <CardDescription>QR Code gerado e ações disponíveis.</CardDescription>
                            </div>
                            {generatedGuide && (
                                <Button ref={printButtonRef} onClick={handleViewAndPrint}>
                                    <Printer className="mr-2" /> Gerar PDF / Imprimir
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {generatedGuide ? (
                            <>
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-lg">QR Code Gerado</h3>
                                    <div className="flex flex-col items-center gap-2">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(generatedGuide.qrCodeData)}`}
                                            width={150}
                                            height={150}
                                            alt={`QR Code para ${generatedGuide.movimentoId}`}
                                            className="rounded-lg border"
                                        />
                                        <span className="text-xs font-mono">{generatedGuide.movimentoId}</span>
                                    </div>
                                </div>

                                <Separator />

                                <div className="space-y-4">
                                    <h3 className="font-semibold text-lg">Resumo da Guia</h3>
                                    <div className="space-y-2 text-sm p-4 border rounded-md bg-muted/50">
                                        <p><strong>Paciente:</strong> {generatedGuide.patient.name}</p>
                                        <p><strong>Médico:</strong> {generatedGuide.medico.name}</p>
                                        <p><strong>Exames:</strong> {generatedGuide.exams.map(e => `${e.idExame || ''} - ${e.name}`).join(', ')}</p>
                                    </div>
                                </div>

                                <Alert variant="default" className="text-left mt-4">
                                    <Info className="h-4 w-4" />
                                    <AlertTitle>Como Salvar ou Enviar a Guia?</AlertTitle>
                                    <AlertDescription>
                                        Após clicar em "Gerar PDF / Imprimir", na janela de impressão do seu navegador, escolha o destino **"Salvar como PDF"**. Depois de salvo, você poderá anexar o arquivo em um e-mail ou enviá-lo pelo WhatsApp.
                                    </AlertDescription>
                                </Alert>

                            </>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                <Send className="mx-auto h-12 w-12" />
                                <p className="mt-4">Aguardando geração da guia.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>
        </>
    );
}

export default function MovementPage() {
    return (
        <Suspense fallback={<div className="flex justify-center p-12 text-muted-foreground">Carregando formulário...</div>}>
            <MovementContent />
        </Suspense>
    );
}
