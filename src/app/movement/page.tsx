"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { QrCode, Send, Printer, RefreshCw, Loader2, PlusCircle, Stethoscope, FileText, Info, Undo2, Search, PawPrint, CheckCircle2, AlertTriangle } from 'lucide-react';
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle 
} from "@/components/ui/alert-dialog";

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
import { Badge } from '@/components/ui/badge';

import { Pet, Veterinario, Exam } from '@/lib/types';
import { usePets } from '@/hooks/use-pets';
import { useUsers } from '@/hooks/use-user-management';
import { useExams } from '@/hooks/use-exams';
import { useSession } from '@/context/session-context';
import { useMovement } from '@/hooks/use-movement';

/**
 * Esquema de validação idêntico ao PacienteMobile, adaptado para terminologia Pet
 */
const movementSchema = z.object({
    petId: z.string({ required_error: 'Pet é obrigatório.' }).min(1, 'Pet é obrigatório.'),
    veterinarioId: z.string({ required_error: 'Veterinário é obrigatório.' }).min(1, 'Veterinário é obrigatório.'),
    examIds: z.array(z.string()).min(1, 'Selecione ao menos um exame.'),
});

type MovementFormValues = z.infer<typeof movementSchema>;

interface GeneratedGuide {
    movimentoId: string;
    qrCodeData: string;
    pet: Pet;
    veterinario: Veterinario;
    exams: Exam[];
}

function MovementContent() {
    const { createMovimento, isLoading: movementApiLoading } = useMovement();
    const { pets, isLoaded: petsLoaded } = usePets();
    const { users, isLoaded: usersLoaded } = useUsers();
    const { exams, isLoaded: examsLoaded } = useExams();
    const { toast } = useToast();
    const { user: currentUser } = useSession();
    
    const router = useRouter();
    const searchParams = useSearchParams();

    // Filtra apenas usuários que podem ser veterinários (MedicoVet ou Admin)
    const veterinarios = React.useMemo(() => {
        return (users || []).filter(u => 
            u.status === 'MedicoVet' || 
            u.status === 'Administrador' || 
            u.status === 'Master'
        ).map(u => ({
            id: u.id,
            nome: u.nome,
            crmv: u.crmvUf || u.numUsuario, // usa código como fallback
            email: u.email,
            telefone: u.telefone
        })) as unknown as Veterinario[];
    }, [users]);

    // Suporte para médico/veterinário logado
    const isSpecificVet = currentUser?.status === 'MedicoVet';
    
    const [generatedGuide, setGeneratedGuide] = useLocalStorage<GeneratedGuide | null>('movement-generated-guide', null);
    const [petSearch, setPetSearch] = React.useState('');
    const [vetSearch, setVetSearch] = React.useState('');
    const [examSearch, setExamSearch] = React.useState('');
    const [urgencyFilter, setUrgencyFilter] = React.useState(false);
    const [resetCounter, setResetCounter] = React.useState(0);
    const [showSuccessDialog, setShowSuccessDialog] = React.useState(false);

    const petSearchInputRef = React.useRef<HTMLInputElement>(null);
    const vetSelectTriggerRef = React.useRef<HTMLButtonElement>(null);
    const examSelectContainerRef = React.useRef<HTMLDivElement>(null);
    const printButtonRef = React.useRef<HTMLButtonElement>(null);

    // Foco inicial e limpeza de cache antigo (padrão PacienteMobile)
    React.useEffect(() => {
        petSearchInputRef.current?.focus();
        try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('print-data-')) keysToRemove.push(key);
            }
            if (keysToRemove.length > 5) {
                keysToRemove.sort().slice(0, keysToRemove.length - 5).forEach(k => localStorage.removeItem(k));
            }
        } catch (e) {}
    }, []);

    // Filtros de busca dinâmica (Busca em Tempo Real)
    const filteredPets = React.useMemo(() => {
        if (!petSearch) return pets;
        const search = petSearch.toLowerCase();
        return pets.filter(p => 
            p.nome.toLowerCase().includes(search) || 
            p.tutorNome.toLowerCase().includes(search) ||
            (p.codPet && p.codPet.toLowerCase().includes(search))
        );
    }, [pets, petSearch]);

    const filteredVets = React.useMemo(() => {
        if (!vetSearch) return veterinarios;
        return veterinarios.filter(v => v.nome.toLowerCase().includes(vetSearch.toLowerCase()));
    }, [veterinarios, vetSearch]);

    const form = useForm<MovementFormValues>({
        resolver: zodResolver(movementSchema),
        defaultValues: {
            petId: '',
            veterinarioId: '',
            examIds: [],
        },
    });

    const selectedPetId = form.watch('petId');
    const currentPet = React.useMemo(() => pets.find(p => p.id === selectedPetId), [pets, selectedPetId]);

    const filteredExams = React.useMemo(() => {
        let baseExams = exams;
        // Filtro Inteligente por Plano de Saúde (Igual ao PacienteMobile)
        if (currentPet && currentPet.healthPlanName) {
            baseExams = exams.filter(e =>
                !e.healthPlanName ||
                e.healthPlanName.trim() === '' ||
                e.healthPlanName.trim().toLowerCase() === currentPet.healthPlanName.trim().toLowerCase()
            );
        }

        if (urgencyFilter) {
            baseExams = baseExams.filter(e => e.isUrgency);
        }

        if (!examSearch) return baseExams;
        const searchLower = examSearch.toLowerCase();
        return baseExams.filter(e =>
            e.name.toLowerCase().includes(searchLower) ||
            (e.idExame && e.idExame.toLowerCase().includes(searchLower))
        );
    }, [exams, examSearch, currentPet, urgencyFilter]);

    // Auto-seleção de veterinário logado
    React.useEffect(() => {
        if (isSpecificVet && currentUser?.id) {
            form.setValue('veterinarioId', currentUser.id, { shouldValidate: true });
        }
    }, [isSpecificVet, currentUser, form]);

    // Redirecionamento após cadastro rápido (Deep Linking)
    // Redirecionamento após cadastro rápido (Deep Linking)
    React.useEffect(() => {
        const newPetId = searchParams.get('newPetId');
        if (newPetId && pets.some(p => p.id === newPetId)) {
            form.setValue('petId', newPetId);
            router.replace('/movement', { scroll: false });
            setTimeout(() => vetSelectTriggerRef.current?.focus(), 100);
        }
    }, [searchParams, pets, form, router]);
    
    // ATIVAÇÃO DO MODAL APENAS NO RETORNO (Motor PacienteMobile)
    React.useEffect(() => {
        const isCompleted = searchParams.get('completed') === 'true';
        if (isCompleted && generatedGuide) {
            setShowSuccessDialog(true);
        }
    }, [searchParams, generatedGuide]);

    const [submittingGuide, setSubmittingGuide] = React.useState(false);

    const onSubmit = async (values: MovementFormValues) => {
        if (submittingGuide || generatedGuide) return;
        setSubmittingGuide(true);
        
        const fullPetData = pets.find(p => p.id === values.petId);
        const fullVetData = veterinarios.find(v => v.id === values.veterinarioId);
        const fullExamsData = exams.filter(e => values.examIds.includes(e.id));

        if (!fullPetData || !fullVetData || fullExamsData.length === 0) {
            toast({ title: 'Dados incompletos', variant: 'destructive' });
            setSubmittingGuide(false);
            return;
        }

        try {
            const result = await createMovimento(values.petId, values.veterinarioId, values.examIds);
            if (result.success && result.movimentoId) {
                setGeneratedGuide({
                    movimentoId: result.movimentoId,
                    qrCodeData: result.movimentoId,
                    pet: fullPetData,
                    veterinario: fullVetData,
                    exams: fullExamsData,
                });
                toast({ title: 'Guia Gerada!' });
            } else {
                toast({ title: 'Erro ao gerar', description: result.message || 'Verifique o banco de dados.', variant: 'destructive' });
            }
        } catch (error) {
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

    const resetForm = () => {
        localStorage.removeItem('movement-generated-guide');
        window.location.href = '/movement?reset=' + Date.now();
    };

    const isLoading = !petsLoaded || !usersLoaded || !examsLoaded;

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 text-center">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <div className="space-y-2">
                    <p className="text-lg font-medium">Sincronizando dados clínicos...</p>
                    <p className="text-sm text-muted-foreground italic">
                        {!petsLoaded ? "• Pets " : ""}
                        {!usersLoaded ? "• Veterinários " : ""}
                        {!examsLoaded ? "• Exames " : ""}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            <PageTitle title="Gerar Guia Veterinária" description="Gere solicitações de exames com QR Code para pets.">
                <Link href="/" passHref><Button variant="outline"><Undo2 className="mr-2 h-4 w-4" />Voltar</Button></Link>
            </PageTitle>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <Card>
                    <CardHeader>
                        <CardTitle>Dados da Solicitação</CardTitle>
                        <CardDescription>Preencha os dados do animal e exames.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                {/* BUSCA DE PET (Igual PacienteMobile) */}
                                <FormField
                                    control={form.control}
                                    name="petId"
                                    render={({ field }) => {
                                        const selectedPet = pets.find(p => p.id === field.value);
                                        return (
                                            <FormItem>
                                                <FormLabel>Animal / Pet</FormLabel>
                                                <div className="space-y-2">
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <Input
                                                            ref={petSearchInputRef}
                                                            placeholder="Buscar por nome, tutor ou código..."
                                                            value={petSearch}
                                                            onChange={(e) => setPetSearch(e.target.value)}
                                                            className="pl-10"
                                                        />
                                                    </div>
                                                    {selectedPet && (
                                                        <div className="border p-2 rounded-md bg-primary/5 border-primary/20">
                                                            <p className="text-[10pt] font-semibold text-primary flex items-center gap-1"><PawPrint size={14}/> {selectedPet.nome} <span className="font-normal text-muted-foreground">({selectedPet.tutorNome})</span></p>
                                                        </div>
                                                    )}
                                                    <Select onValueChange={(val) => { field.onChange(val); setPetSearch(''); }} value={field.value}>
                                                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione o animal..." /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            {filteredPets.length > 0 ? filteredPets.map(p => (
                                                                <SelectItem key={p.id} value={p.id}>{p.nome} - {p.tutorNome}</SelectItem>
                                                            )) : (
                                                                <div className="p-4 text-center text-sm text-muted-foreground">
                                                                    <p>Nenhum pet encontrado.</p>
                                                                    <Button asChild variant="link" className="mt-2 h-auto p-0">
                                                                        <Link href={`/pets?tab=register&redirect=/movement&name=${encodeURIComponent(petSearch)}`}>Cadastrar Novo Pet</Link>
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        );
                                    }}
                                />

                                {/* VETERINÁRIO */}
                                <FormField
                                    control={form.control}
                                    name="veterinarioId"
                                    render={({ field }) => {
                                        const selectedVet = veterinarios.find(v => v.id === field.value);
                                        return (
                                            <FormItem>
                                                <FormLabel>Médico(a) Veterinário(a)</FormLabel>
                                                <div className="space-y-2">
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <Input
                                                            placeholder="Filtrar veterinário..."
                                                            value={vetSearch}
                                                            onChange={(e) => setVetSearch(e.target.value)}
                                                            className="pl-10"
                                                        />
                                                    </div>
                                                    <Select onValueChange={(val) => { field.onChange(val); setVetSearch(''); }} value={field.value}>
                                                        <FormControl><SelectTrigger ref={vetSelectTriggerRef}><SelectValue placeholder="Selecione o profissional..." /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            {filteredVets.map(v => (
                                                                <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        );
                                    }}
                                />

                                {/* EXAMES COM FILTRO DE PLANO */}
                                <FormField
                                    control={form.control}
                                    name="examIds"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Exames Solicitados</FormLabel>
                                            <div className="space-y-2">
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <div className="relative flex-1">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <Input placeholder="Buscar exame..." value={examSearch} onChange={(e) => setExamSearch(e.target.value)} className="pl-10" />
                                                    </div>
                                                    <Button 
                                                        type="button" 
                                                        variant={urgencyFilter ? "destructive" : "outline"} 
                                                        size="sm"
                                                        onClick={() => setUrgencyFilter(!urgencyFilter)}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <AlertTriangle className={urgencyFilter ? "animate-pulse" : "h-4 w-4"} size={16} />
                                                        {urgencyFilter ? "Apenas Urgentes" : "Filtrar Urgentes"}
                                                    </Button>
                                                </div>
                                                <ScrollArea className="h-48 w-full rounded-md border p-4">
                                                    <div className="space-y-3">
                                                        {filteredExams.map((item) => (
                                                            <div key={item.id} className="flex items-start space-x-3">
                                                                <Checkbox 
                                                                    id={item.id} 
                                                                    checked={field.value?.includes(item.id)} 
                                                                    onCheckedChange={(checked) => checked ? field.onChange([...(field.value || []), item.id]) : field.onChange(field.value.filter(v => v !== item.id))}
                                                                />
                                                                <label htmlFor={item.id} className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2">
                                                                    <span className="font-mono text-primary font-bold">{item.idExame || item.examCode}</span> — {item.name}
                                                                    {item.isUrgency && <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200 text-[10px] h-5 px-1 py-0">URGENTE</Badge>}
                                                                </label>
                                                            </div>
                                                        ))}
                                                        {filteredExams.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">Nenhum exame encontrado.</p>}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {!generatedGuide && (
                                    <Button type="submit" className="w-full" disabled={submittingGuide || movementApiLoading}>
                                        {submittingGuide ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...</> : <><QrCode className="mr-2 h-4 w-4" /> Gerar Guia e QR Code</>}
                                    </Button>
                                )}
                                {generatedGuide && (
                                    <Button type="button" variant="outline" className="w-full" onClick={resetForm}><RefreshCw className="mr-2 h-4 w-4" /> Gerar Nova Guia</Button>
                                )}
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                {/* RESULTADO (Simétrico ao PacienteMobile) */}
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div><CardTitle>Status da Guia</CardTitle><CardDescription>QR Code e ações.</CardDescription></div>
                            {generatedGuide && <Button onClick={handleViewAndPrint}><Printer className="mr-2 h-4 w-4" /> Imprimir / PDF</Button>}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {generatedGuide ? (
                            <>
                                <div className="flex flex-col items-center gap-3 border p-6 rounded-lg bg-white shadow-inner">
                                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(generatedGuide.qrCodeData)}`} width={200} height={200} alt="QR Code" className="border-4 p-1 rounded-sm border-black" />
                                    <span className="text-xs font-mono font-bold bg-muted px-2 py-1 rounded">{generatedGuide.movimentoId}</span>
                                </div>
                                <div className="space-y-3 text-sm border p-4 rounded-md">
                                    <p><strong>PET:</strong> {generatedGuide.pet.nome}</p>
                                    <p><strong>VETERINÁRIO:</strong> {generatedGuide.veterinario.nome}</p>
                                    
                                    <Separator className="my-2" />
                                    
                                    {generatedGuide.exams.filter(e => !e.isUrgency).length > 0 && (
                                        <div className="space-y-1">
                                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Exames Normais ({generatedGuide.exams.filter(e => !e.isUrgency).length})</p>
                                            <p className="text-sm">{generatedGuide.exams.filter(e => !e.isUrgency).map(e => `${e.idExame || e.examCode} - ${e.name}`).join(', ')}</p>
                                        </div>
                                    )}

                                    {generatedGuide.exams.filter(e => e.isUrgency).length > 0 && (
                                        <div className="space-y-1 mt-2">
                                            <p className="text-xs font-bold text-red-600 uppercase tracking-wider flex items-center gap-1">Exames de Urgência ({generatedGuide.exams.filter(e => e.isUrgency).length}) 🚨</p>
                                            <p className="text-sm font-medium text-red-900 bg-red-50 p-1 rounded border border-red-100">{generatedGuide.exams.filter(e => e.isUrgency).map(e => `${e.idExame || e.examCode} - ${e.name}`).join(', ')}</p>
                                        </div>
                                    )}
                                </div>
                                <Alert><Info className="h-4 w-4" /><AlertTitle>Dica de Envio</AlertTitle><AlertDescription>Ao clicar em Imprimir, escolha "Salvar como PDF" para enviar por WhatsApp ou E-mail.</AlertDescription></Alert>
                            </>
                        ) : (
                            <div className="text-center py-20 text-muted-foreground"><Send className="mx-auto h-12 w-12 opacity-20 mb-4" /><p>Aguardando preenchimento do formulário.</p></div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* MODAL DE SUCESSO (Motor PacienteMobile) */}
            <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
                <AlertDialogContent className="max-w-[400px]">
                    <AlertDialogHeader className="flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-2">
                            <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                        <AlertDialogTitle className="text-xl font-bold">Ação Concluída</AlertDialogTitle>
                        <AlertDialogDescription className="text-base text-slate-600">
                            Sua guia foi gerada com sucesso. Deseja realizar a leitura de uma nova guia agora?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 mt-4 sm:justify-center w-full">
                        <AlertDialogCancel 
                            onClick={() => setShowSuccessDialog(false)}
                            className="w-full sm:w-auto mt-0 border-slate-200 text-slate-700 hover:bg-slate-50"
                        >
                            Não, manter nesta tela
                        </AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={resetForm}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            Sim, Nova Leitura
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

export default function MovementPage() {
    return <Suspense fallback={<div className="p-12 text-center text-muted-foreground"><Loader2 className="animate-spin mx-auto mb-2"/> Carregando motor de guias...</div>}><MovementContent /></Suspense>;
}
