"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { QrCode, Send, Download, Printer, RefreshCw, Loader2, PlusCircle, Stethoscope, FileText, Info, Undo2, Search, PawPrint, CheckCircle2, AlertTriangle, ArrowRight, CalendarDays, Star, ChevronsUpDown, Check } from 'lucide-react';
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

import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger 
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';

import { PageTitle } from '@/components/layout/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';

import { Pet, Veterinario, Exam } from '@/lib/types';
import { usePets } from '@/hooks/use-pets';
import { useUsers } from '@/hooks/use-user-management';
import { useExams } from '@/hooks/use-exams';
import { useSession } from '@/context/session-context';
import { useMovement } from '@/hooks/use-movement';
import { useProntuarios } from '@/hooks/use-prontuarios';
import { exportToCSV, exportToPDF, exportToTXT } from '@/lib/export-utils';
import { useModelos } from '@/hooks/use-modelos';

/**
 * Esquema de validação idêntico ao PacienteMobile, adaptado para terminologia Pet
 */
const movementSchema = z.object({
    petId: z.string({ required_error: 'Pet é obrigatório.' }).min(1, 'Pet é obrigatório.'),
    veterinarioId: z.string({ required_error: 'Veterinário é obrigatório.' }).min(1, 'Veterinário é obrigatório.'),
    examIds: z.array(z.string()).min(1, 'Selecione ao menos um exame.'),
    urgentExamIds: z.array(z.string()).optional(),
});

type MovementFormValues = z.infer<typeof movementSchema>;

interface GeneratedGuide {
    movimentoId: string;
    qrCodeData: string;
    pet: Pet;
    veterinario: Veterinario;
    exams: Exam[];
    urgentExams: string[];
}


function GuiaContent({ onBack }: { onBack: () => void }) {
    const { createMovimento, isLoading: movementApiLoading } = useMovement();
    const { pets, isLoaded: petsLoaded } = usePets();
    const { users, isLoaded: usersLoaded } = useUsers();
    const { exams, isLoaded: examsLoaded } = useExams();
    const { modelos, isLoaded: modelosLoaded } = useModelos();
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
    const isGeralRole = currentUser?.status === 'Master' || currentUser?.status === 'Administrador' || currentUser?.status === 'MedicoVet Geral';
    
    const [generatedGuide, setGeneratedGuide] = useLocalStorage<GeneratedGuide | null>('movement-generated-guide', null);
    const [petSearch, setPetSearch] = React.useState('');
    const [vetSearch, setVetSearch] = React.useState('');
    const [examSearch, setExamSearch] = React.useState('');
    const [urgencyFilter, setUrgencyFilter] = React.useState(false);
    const [showSuccessDialog, setShowSuccessDialog] = React.useState(false);
    const [isModeloOpen, setIsModeloOpen] = React.useState(false);
    const [showOnlySelected, setShowOnlySelected] = React.useState(false);

    const petSearchInputRef = React.useRef<HTMLInputElement>(null);
    const vetSelectTriggerRef = React.useRef<HTMLButtonElement>(null);
    const newGuideButtonRef = React.useRef<HTMLButtonElement>(null);

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
            urgentExamIds: [],
        },
    });

    const selectedPetId = form.watch('petId');
    const selectedVeterinarioId = form.watch('veterinarioId');
    const currentPet = React.useMemo(() => pets.find(p => p.id === selectedPetId), [pets, selectedPetId]);

    const examKits = React.useMemo(() => {
        return modelos.filter(m => 
            m.tipo === 'Exames' && 
            (!m.medico_id || m.medico_id === selectedVeterinarioId)
        );
    }, [modelos, selectedVeterinarioId]);

    const handleApplyKit = React.useCallback((kit: any) => {
        if (!kit) return;
        setIsModeloOpen(false);
        
        toast({ title: "Processando Kit...", description: `Buscando exames para o kit "${kit.nome}"...` });

        setTimeout(() => {
            const petPlan = currentPet?.healthPlanName?.trim().toLowerCase();
            const lines = kit.conteudo
                .split(/\r?\n/)
                .map((l: string) => l.trim().replace(/^[\-\*\•]\s+/, '').trim())
                .filter((l: string) => l.length > 0);
            
            if (lines.length === 0) {
                toast({ title: "Kit Vazio", description: "O kit selecionado não possui conteúdo válido.", variant: "destructive" });
                return;
            }

            const resolvedIds: string[] = [];
            const notFound: string[] = [];

            lines.forEach((line: string) => {
                const lineLower = line.toLowerCase();
                
                const candidates = exams.filter(e => {
                    const idExame = e.idExame?.toLowerCase().trim();
                    const examCode = e.examCode?.toLowerCase().trim();
                    const name = e.name?.toLowerCase().trim();
                    return idExame === lineLower || examCode === lineLower || name === lineLower;
                });

                if (candidates.length > 0) {
                    let match: any = null;
                    
                    // Tier 1: Exact plan match
                    match = candidates.find(e => 
                        e.healthPlanName?.trim().toLowerCase() === petPlan
                    );
                    
                    // Tier 2: Partial plan match
                    if (!match && petPlan) {
                        match = candidates.find(e => {
                            const ePlan = e.healthPlanName?.trim().toLowerCase();
                            return ePlan && (ePlan.includes(petPlan) || petPlan.includes(ePlan));
                        });
                    }
                    
                    // Tier 3: Global exam
                    if (!match) {
                        match = candidates.find(e => !e.healthPlanName || e.healthPlanName.trim() === '');
                    }
                    
                    if (match) {
                        resolvedIds.push(match.id);
                    }
                } else {
                    notFound.push(line);
                }
            });

            if (resolvedIds.length > 0) {
                const currentExams = form.getValues('examIds') || [];
                const merged = Array.from(new Set([...currentExams, ...resolvedIds]));
                
                form.setValue('examIds', merged, { 
                    shouldValidate: true, 
                    shouldDirty: true,
                    shouldTouch: true 
                });
                
                toast({ 
                    title: "Sucesso!", 
                    description: `Adicionados ${resolvedIds.length} exames. ${notFound.length > 0 ? `${notFound.length} não encontrados.` : ""}`,
                });
                setShowOnlySelected(true);
            } else {
                toast({ 
                    title: "Nenhum exame encontrado", 
                    description: `Tentamos buscar ${lines.length} exames, mas nenhum é compatível com o plano "${currentPet?.healthPlanName || 'Não Informado'}".`, 
                    variant: "destructive",
                });
            }
        }, 300);
    }, [exams, currentPet, form, toast]);

    const filteredExams = React.useMemo(() => {
        let baseExams = exams;
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

    React.useEffect(() => {
        const newPetId = searchParams.get('newPetId');
        if (newPetId && pets.some(p => p.id === newPetId)) {
            form.setValue('petId', newPetId);
            router.replace('/movement', { scroll: false });
            setTimeout(() => vetSelectTriggerRef.current?.focus(), 100);
        }
    }, [searchParams, pets, form, router]);
    
    // ATIVAÇÃO DO MODAL APENAS NO RETORNO E FOCO DO BOTÃO
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
            const urgentIds = values.urgentExamIds || [];
            const result = await createMovimento(values.petId, values.veterinarioId, values.examIds, urgentIds);
            if (result.success && result.movimentoId) {
                setGeneratedGuide({
                    movimentoId: result.movimentoId,
                    qrCodeData: result.movimentoId,
                    pet: fullPetData,
                    veterinario: fullVetData,
                    exams: fullExamsData,
                    urgentExams: urgentIds,
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

    const resetForm = (isInitial = false) => {
        if (!isInitial) {
            localStorage.removeItem('movement-generated-guide');
            window.location.href = '/movement?mode=guia&reset=' + Date.now();
            return;
        }
        setPetSearch('');
        setVetSearch('');
        setExamSearch('');
        setGeneratedGuide(null);
        form.reset({
            petId: '',
            veterinarioId: isSpecificVet && currentUser ? currentUser.id : '',
            examIds: [],
            urgentExamIds: [],
        });
        setTimeout(() => petSearchInputRef.current?.focus(), 100);
    };

    // Efeito para detectar reset forçado vindo do PDF ou clique em Nova Guia
    React.useEffect(() => {
        if (searchParams.get('reset') || searchParams.get('focus') === 'newGuide') {
            resetForm(true); 
            router.replace('/movement?mode=guia', { scroll: false });
        }
    }, [searchParams, router]);

    const isLoading = !petsLoaded || !usersLoaded || !examsLoaded || !modelosLoaded;

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 text-center">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <div className="space-y-2">
                    <p className="text-lg font-medium">Sincronizando dados clínicos...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <PageTitle title="Gerar Guia Veterinária" description="Gere solicitações de exames com QR Code para pets.">
                <Button variant="outline" onClick={onBack}><Undo2 className="mr-2 h-4 w-4" />Voltar ao Menu</Button>
            </PageTitle>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Dados da Solicitação</CardTitle>
                        <CardDescription>Preencha os dados do animal e exames.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                                                        <Input placeholder="Buscar por nome, tutor ou código..." value={petSearch} onChange={(e) => setPetSearch(e.target.value)} className="pl-10" />
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

                                <FormField
                                    control={form.control}
                                    name="veterinarioId"
                                    render={({ field }) => {
                                        return (
                                            <FormItem>
                                                <FormLabel>Médico(a) Veterinário(a)</FormLabel>
                                                <div className="space-y-2">
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <Input placeholder="Filtrar veterinário..." value={vetSearch} onChange={(e) => setVetSearch(e.target.value)} className="pl-10" />
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

                                <FormField
                                    control={form.control}
                                    name="examIds"
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className="flex justify-between items-center mb-2">
                                                <FormLabel>Exames Solicitados</FormLabel>
                                                <div className="flex gap-2">
                                                    {(isGeralRole || isSpecificVet) && (
                                                        <Popover open={isModeloOpen} onOpenChange={setIsModeloOpen}>
                                                            <PopoverTrigger asChild>
                                                                <Button type="button" variant="outline" size="sm" className="h-8 text-xs">
                                                                    <Star className={cn("mr-2 h-3 w-3", examKits.length > 0 ? "fill-amber-400 text-amber-500" : "")} />
                                                                    Kits Favoritos
                                                                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-[300px] p-0 shadow-xl border-2" align="end">
                                                                 <div className="flex flex-col bg-background">
                                                                     <div className="p-3 border-b bg-muted/30">
                                                                         <div className="relative">
                                                                             <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                                             <Input 
                                                                                 placeholder="Buscar kit..." 
                                                                                 className="h-8 pl-8 text-xs focus-visible:ring-1"
                                                                             />
                                                                         </div>
                                                                     </div>
                                                                     <ScrollArea className="h-[250px]">
                                                                         <div className="p-1">
                                                                             <p className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Seus Kits de Exames</p>
                                                                             {examKits.length > 0 ? examKits.map((kit) => (
                                                                                 <button
                                                                                     key={kit.id}
                                                                                     type="button"
                                                                                     className="w-full flex items-center px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-md transition-colors text-left group"
                                                                                     onClick={() => handleApplyKit(kit)}
                                                                                 >
                                                                                     <div className="mr-2 h-4 w-4 flex items-center justify-center">
                                                                                         {kit.is_favorite ? (
                                                                                             <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                                                                                         ) : (
                                                                                             <div className="h-1 w-1 bg-muted-foreground/30 rounded-full" />
                                                                                         )}
                                                                                     </div>
                                                                                     <span className="flex-1 truncate font-medium">{kit.nome}</span>
                                                                                     <Check className={cn("ml-2 h-4 w-4 opacity-0 text-primary", form.getValues('examIds')?.includes(kit.id) ? "opacity-100" : "group-hover:opacity-20")} />
                                                                                 </button>
                                                                             )) : (
                                                                                 <div className="p-8 text-center">
                                                                                     <p className="text-xs text-muted-foreground">Nenhum kit encontrado.</p>
                                                                                 </div>
                                                                             )}
                                                                         </div>
                                                                     </ScrollArea>
                                                                     <div className="p-1 border-t bg-muted/10 space-y-0.5">
                                                                         <button
                                                                             type="button"
                                                                             className="w-full flex items-center px-3 py-2 text-xs hover:bg-accent rounded-md transition-colors font-medium"
                                                                             onClick={() => { setIsModeloOpen(false); router.push('/veterinarios'); }}
                                                                         >
                                                                             <PlusCircle className="mr-2 h-4 w-4 text-primary" />
                                                                             Gerenciar Modelos
                                                                         </button>
                                                                         <button
                                                                             type="button"
                                                                             className="w-full flex items-center px-3 py-2 text-xs hover:bg-accent rounded-md transition-colors text-muted-foreground italic"
                                                                             onClick={() => setIsModeloOpen(false)}
                                                                         >
                                                                             <Undo2 className="mr-2 h-4 w-4" />
                                                                             Fechar Menu
                                                                         </button>
                                                                     </div>
                                                                 </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <div className="relative flex-1">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <Input placeholder="Buscar exame..." value={examSearch} onChange={(e) => setExamSearch(e.target.value)} className="pl-10" />
                                                    </div>
                                                    {(field.value?.length > 0) && (
                                                        <div className="flex gap-1 shrink-0">
                                                            <Button
                                                                type="button"
                                                                variant={!showOnlySelected ? "default" : "outline"}
                                                                size="sm"
                                                                className="h-9 text-xs gap-1.5"
                                                                onClick={() => setShowOnlySelected(false)}
                                                            >
                                                                <Search className="h-3.5 w-3.5" />
                                                                Ver Todos
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant={showOnlySelected ? "default" : "outline"}
                                                                size="sm"
                                                                className="h-9 text-xs gap-1.5"
                                                                onClick={() => setShowOnlySelected(true)}
                                                            >
                                                                <Check className="h-3.5 w-3.5" />
                                                                Selecionados ({field.value.length})
                                                            </Button>
                                                        </div>
                                                    )}
                                                    <Button type="button" variant={urgencyFilter ? "destructive" : "outline"} size="sm" onClick={() => setUrgencyFilter(!urgencyFilter)} className="flex items-center gap-2">
                                                        <AlertTriangle className={urgencyFilter ? "animate-pulse" : "h-4 w-4"} size={16} />
                                                        {urgencyFilter ? "Apenas Urgentes" : "Filtrar Urgentes"}
                                                    </Button>
                                                </div>
                                                <ScrollArea className="h-48 w-full rounded-md border p-4">
                                                    <div className="space-y-3">
                                                        {(() => {
                                                            const selectedIds = field.value || [];
                                                            let displayExams;
                                                            if (showOnlySelected) {
                                                                displayExams = exams.filter(e => selectedIds.includes(e.id));
                                                            } else {
                                                                displayExams = filteredExams;
                                                            }
                                                            return displayExams.length > 0 ? displayExams.map((item) => (
                                                                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-md hover:bg-muted/30 border border-transparent hover:border-border transition-colors">
                                                                    <div className="flex items-start space-x-3 flex-1">
                                                                        <Checkbox 
                                                                            id={item.id} 
                                                                            checked={field.value?.includes(item.id)} 
                                                                            onCheckedChange={(checked) => {
                                                                                if (checked) {
                                                                                    field.onChange([...(field.value || []), item.id]);
                                                                                    if (item.isUrgency) {
                                                                                        const currentUrgent = form.getValues('urgentExamIds') || [];
                                                                                        if (!currentUrgent.includes(item.id)) {
                                                                                            form.setValue('urgentExamIds', [...currentUrgent, item.id]);
                                                                                        }
                                                                                    }
                                                                                } else {
                                                                                    field.onChange(field.value.filter(v => v !== item.id));
                                                                                    const currentUrgent = form.getValues('urgentExamIds') || [];
                                                                                    form.setValue('urgentExamIds', currentUrgent.filter(v => v !== item.id));
                                                                                }
                                                                            }} 
                                                                        />
                                                                        <label htmlFor={item.id} className="text-sm font-medium leading-none cursor-pointer flex flex-wrap items-center gap-2">
                                                                            <span className="font-mono text-primary font-bold">{item.idExame || item.examCode}</span> — {item.name}
                                                                            {item.isUrgency && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 text-[10px] h-5 px-1 py-0">Padrão: Urgente</Badge>}
                                                                        </label>
                                                                    </div>
                                                                    {field.value?.includes(item.id) && (
                                                                        <div className="mt-2 sm:mt-0 pl-7 sm:pl-0">
                                                                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold bg-white border px-2 py-1 rounded-md shadow-sm">
                                                                                <Checkbox 
                                                                                    checked={form.watch('urgentExamIds')?.includes(item.id)}
                                                                                    onCheckedChange={(checked) => {
                                                                                        const current = form.getValues('urgentExamIds') || [];
                                                                                        if (checked) {
                                                                                            form.setValue('urgentExamIds', [...current, item.id]);
                                                                                        } else {
                                                                                            form.setValue('urgentExamIds', current.filter(id => id !== item.id));
                                                                                        }
                                                                                    }}
                                                                                />
                                                                                <span className={form.watch('urgentExamIds')?.includes(item.id) ? "text-red-600 font-bold" : "text-muted-foreground"}>
                                                                                    {form.watch('urgentExamIds')?.includes(item.id) ? "COM URGÊNCIA" : "NORMAL"}
                                                                                </span>
                                                                            </label>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )) : (
                                                                <div className="text-center py-8">
                                                                    <p className="text-sm text-muted-foreground">
                                                                        {showOnlySelected 
                                                                            ? 'Nenhum exame selecionado. Clique em "Selecionados" para ver todos.'
                                                                            : examSearch ? `Nenhum exame encontrado para "${examSearch}".` : 'Nenhum exame disponível.'}
                                                                    </p>
                                                                </div>
                                                            );
                                                        })()}
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
                                    <Button type="button" variant="outline" className="w-full" onClick={() => resetForm()}><RefreshCw className="mr-2 h-4 w-4" /> Gerar Nova Guia</Button>
                                )}
                             </form>
                        </Form>
                    </CardContent>
                </Card>

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
                                    <div className="pt-2 border-t mt-2">
                                        <p className="font-semibold mb-2 text-slate-700">Exames Solicitados ({generatedGuide.exams?.length || 0}):</p>
                                        <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-2">
                                            {generatedGuide.exams?.map(ex => {
                                                const isUrgent = generatedGuide.urgentExams?.includes(ex.id);
                                                return (
                                                <li key={ex.id} className="text-xs text-slate-600 flex flex-col sm:flex-row sm:items-start gap-2 border-b pb-1">
                                                   <div className="flex items-start gap-2 flex-1">
                                                       <span className="mt-0.5">•</span>
                                                       <span><strong className="font-mono text-slate-800">{ex.idExame || ex.examCode}</strong> — {ex.name}</span>
                                                   </div>
                                                   {isUrgent && <Badge variant="destructive" className="text-[10px] h-5">URGÊNCIA</Badge>}
                                                </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                </div>
                             </>
                        ) : (
                             <div className="text-center py-20 text-muted-foreground"><Send className="mx-auto h-12 w-12 opacity-20 mb-4" /><p>Aguardando preenchimento do formulário.</p></div>
                        )}
                    </CardContent>
                </Card>
            </div>
            
            <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
                <AlertDialogContent className="max-w-[400px]">
                    <AlertDialogHeader className="flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-2">
                            <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                        <AlertDialogTitle className="text-xl font-bold">Ação Concluída</AlertDialogTitle>
                        <AlertDialogDescription className="text-base text-slate-600">Sua guia foi gerada com sucesso.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 mt-4 sm:justify-center w-full">
                        <AlertDialogCancel onClick={() => setShowSuccessDialog(false)}>Manter nesta tela</AlertDialogCancel>
                        <AlertDialogAction onClick={() => resetForm()}>Nova Leitura</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function ProntuarioSelectionContent({ onBack }: { onBack: () => void }) {
    const { pets, isLoaded: petsLoaded } = usePets();
    const { users, isLoaded: usersLoaded } = useUsers();
    const { prontuarios, isLoaded: prontLoaded } = useProntuarios();
    const { user } = useSession();
    const router = useRouter();
    const [petSearch, setPetSearch] = React.useState('');
    const [selectedPetId, setSelectedPetId] = React.useState('all');
    const [isGlobalListOpen, setIsGlobalListOpen] = React.useState(false);
    const [vetFilter, setVetFilter] = React.useState<string>('all');

    const isPrivileged = user?.status === 'Master' || user?.status === 'Administrador' || user?.status === 'MedicoVet Geral';
    
    const filteredPets = React.useMemo(() => {
        if (!petSearch) return pets;
        const search = petSearch.toLowerCase();
        return pets.filter(p => 
            p.nome.toLowerCase().includes(search) || 
            p.tutorNome.toLowerCase().includes(search) ||
            (p.codPet && p.codPet.toLowerCase().includes(search))
        );
    }, [pets, petSearch]);

    const veterinarios = React.useMemo(() => {
        return (users || []).filter(u => 
            u.status === 'MedicoVet' || 
            u.status === 'MedicoVet Geral'
        );
    }, [users]);

    const globalProntuarios = React.useMemo(() => {
        if (!prontLoaded || !user) return [];
        
        // Regra de Negócio: Médico A não vê de médico B, a não ser que seja ADM ou Geral
        let filtered = prontuarios;
        
        if (!isPrivileged) {
            filtered = prontuarios.filter(p => p.medico_id === user.id || p.autor_registro_id === user.id);
        }

        if (selectedPetId && selectedPetId !== 'all') {
            filtered = filtered.filter(p => p.pet_id === selectedPetId);
        }

        if (vetFilter !== 'all') {
            filtered = filtered.filter(p => p.medico_id === vetFilter);
        }

        return filtered;
    }, [prontuarios, prontLoaded, user, isPrivileged, vetFilter, selectedPetId]);

    const handleExport = async (format: 'pdf' | 'csv' | 'txt') => {
        const rows = globalProntuarios.map(pront => {
            const pet = pets.find(p => p.id === pront.pet_id);
            const med = veterinarios.find(v => v.id === pront.medico_id);
            return {
                'Data Consulta': format ? new Date(pront.data_atendimento).toLocaleDateString('pt-BR') : '',
                'Médico': med?.nome || 'Não inf.',
                'Tipo': pront.tipo_atendimento,
                'Cód_Pet': pet?.codPet || '-', 
                'Nome do Pet': pet?.nome || '-',
                'Espécie': pet?.especie || '-',
                'Raça': pet?.raca || '-',
                'Desc': pront.descricao_livre || '-'
            };
        });

        const selectedPet = pets.find(p => p.id === selectedPetId);
        const vet = vetFilter === 'all' ? null : veterinarios.find(v => v.id === vetFilter);
        
        let title = 'Histórico de Atendimentos';
        if (selectedPet) title += ` - ${selectedPet.nome}`;
        if (vet) title += ` (${vet.nome})`;

        const filename = `historico_${selectedPet ? selectedPet.nome.toLowerCase() : 'geral'}`;

        if (format === 'csv') {
            await exportToCSV(filename, rows);
        } else if (format === 'txt') {
            await exportToTXT(filename, rows);
        } else {
            await exportToPDF(filename, title, rows);
        }
    };

    if (!petsLoaded || !usersLoaded) {
        return <div className="p-12 text-center text-muted-foreground"><Loader2 className="animate-spin mx-auto mb-2"/> Carregando dados...</div>;
    }

    return (
        <>
            <PageTitle title="Acesso ao Prontuário Digital" description="Selecione um animal para visualizar ou cadastrar atendimentos clínicos.">
                <Button variant="outline" onClick={onBack}><Undo2 className="mr-2 h-4 w-4" />Voltar ao Menu</Button>
            </PageTitle>

            <div className="max-w-2xl mx-auto mt-8">
                <Card className="border-t-4 border-t-blue-500 shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Stethoscope className="w-5 h-5 text-blue-500" /> Buscar Paciente</CardTitle>
                        <CardDescription>Para iniciar, digite o nome do pet, nome do tutor ou código.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Digite para filtrar..." value={petSearch} onChange={(e) => setPetSearch(e.target.value)} className="pl-10 py-6 text-lg" />
                            </div>
                            <Select onValueChange={setSelectedPetId} value={selectedPetId}>
                                <SelectTrigger className="h-14">
                                    <SelectValue placeholder="Selecione o animal na lista..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="py-3 border-b bg-blue-50/50">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-base text-blue-700">Todos os Animais (Geral)</span>
                                            <span className="text-sm text-blue-600/70">Lista o histórico de todos os pets</span>
                                        </div>
                                    </SelectItem>
                                    {filteredPets.length > 0 ? filteredPets.map(p => (
                                        <SelectItem key={p.id} value={p.id} className="py-3">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-base">{p.nome} <span className="text-xs text-muted-foreground font-normal">({p.especie})</span></span>
                                                <span className="text-sm text-muted-foreground">Tutor: {p.tutorNome}</span>
                                            </div>
                                        </SelectItem>
                                    )) : (
                                        <div className="p-4 text-center text-sm text-muted-foreground">Nenhum registro encontrado.</div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-slate-50 pt-6 flex justify-between gap-4">
                        <Button 
                            variant="outline"
                            onClick={() => setIsGlobalListOpen(true)}
                        >
                            <FileText className="w-4 h-4 mr-2" /> Listar Registros Clínicos
                        </Button>
                        <Button 
                            size="lg" 
                            disabled={!selectedPetId || selectedPetId === 'all'}
                            onClick={() => router.push(`/pets/${selectedPetId}/prontuario`)}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <FileText className="w-5 h-5 mr-2" /> Abrir Registro Clínico
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            <Dialog open={isGlobalListOpen} onOpenChange={setIsGlobalListOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="flex flex-row items-center justify-between border-b pb-4">
                        <DialogTitle className="flex items-center gap-2">
                            <Stethoscope className="w-6 h-6 text-blue-600" />
                            Histórico de Atendimentos Clínicos - Geral
                        </DialogTitle>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} className="h-8">
                                <Download className="w-4 h-4 mr-2" /> PDF
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleExport('csv')} className="h-8">
                                <Download className="w-4 h-4 mr-2" /> CSV
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleExport('txt')} className="h-8">
                                <Download className="w-4 h-4 mr-2" /> TXT
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => {
                                setIsGlobalListOpen(false);
                                setSelectedPetId('all');
                                setPetSearch('');
                            }} className="h-8">
                                <Undo2 className="w-4 h-4 mr-2" /> Voltar
                            </Button>
                        </div>
                    </DialogHeader>

                    <div className="space-y-6 mt-4">
                        {isPrivileged && (
                            <div className="flex items-center gap-4 p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
                                <div className="w-full max-w-sm space-y-1.5">
                                    <Label>Filtrar por Médico</Label>
                                    <Select value={vetFilter} onValueChange={setVetFilter}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Todos os Médicos" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos os Médicos</SelectItem>
                                            {veterinarios.map(v => (
                                                <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="text-sm text-slate-500 pt-7">
                                    {globalProntuarios.length} registros encontrados.
                                </div>
                            </div>
                        )}

                        <div className="border rounded-lg overflow-hidden">
                            <ScrollArea className="h-[500px]">
                                {globalProntuarios.length === 0 ? (
                                    <div className="p-12 text-center text-muted-foreground">Nenhum registro clínico encontrado para os critérios selecionados.</div>
                                ) : (
                                    <div className="divide-y">
                                        {globalProntuarios.map((pront) => {
                                            const pet = pets.find(p => p.id === pront.pet_id);
                                            const med = users.find(u => u.id === pront.medico_id);
                                            return (
                                                <div key={pront.id} className="p-4 hover:bg-slate-50 transition-colors">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <div className="font-bold text-slate-900 flex items-center gap-2">
                                                                <span className="text-blue-600">{pront.tipo_atendimento}</span>
                                                                <span className="text-slate-300">|</span>
                                                                <span>{pet?.nome || 'Pet não encontrado'}</span>
                                                            </div>
                                                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                                                                <CalendarDays className="w-3 h-3" /> 
                                                                {new Date(pront.data_atendimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                <span className="text-slate-300">•</span>
                                                                <span className="font-medium">Médico: {med?.nome || pront.medico_id || 'Não informado'}</span>
                                                            </div>
                                                        </div>
                                                        <Button size="sm" variant="ghost" className="text-blue-600 h-8 px-2" onClick={() => {
                                                            setIsGlobalListOpen(false);
                                                            router.push(`/pets/${pront.pet_id}/prontuario`);
                                                        }}>
                                                            Ver Detalhes <ArrowRight className="w-3 h-3 ml-1" />
                                                        </Button>
                                                    </div>
                                                    <div className="text-sm text-slate-600 line-clamp-2 italic bg-slate-50/50 p-2 rounded">
                                                        {pront.descricao_livre || 'Sem descrição clínica...'}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

function MovementContainer() {
    const searchParams = useSearchParams();
    const [activeMode, setActiveMode] = React.useState<'menu' | 'guia' | 'prontuario'>('menu');

    React.useEffect(() => {
        const mode = searchParams.get('mode');
        if (mode === 'prontuario') {
            setActiveMode('prontuario');
        } else if (mode === 'guia') {
            setActiveMode('guia');
        }
    }, [searchParams]);

    const { user } = useSession();

    // Proteção rigorosa conforme regra de negócios
    const canAccessProntuario = user?.status === 'MedicoVet' || user?.status === 'Administrador' || user?.status === 'Master' || user?.status === 'MedicoVet Geral';

    if (activeMode === 'guia') {
        return <GuiaContent onBack={() => setActiveMode('menu')} />;
    }

    if (activeMode === 'prontuario') {
        return <ProntuarioSelectionContent onBack={() => setActiveMode('menu')} />;
    }

    return (
        <>
            <PageTitle title="Central de Atendimento" description="Escolha uma ação para iniciar seu fluxo de trabalho.">
                <Link href="/" passHref>
                    <Button variant="outline">
                        <Undo2 className="mr-2 h-4 w-4" />
                        Voltar ao Menu Principal
                    </Button>
                </Link>
            </PageTitle>

            <div className="max-w-4xl mx-auto mt-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card 
                    className="cursor-pointer hover:border-primary hover:shadow-md transition-all group overflow-hidden relative"
                    onClick={() => setActiveMode('guia')}
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <QrCode className="w-32 h-32" />
                    </div>
                    <CardHeader>
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 text-primary">
                            <PlusCircle className="w-6 h-6" />
                        </div>
                        <CardTitle className="text-xl">Solicitação de Exames</CardTitle>
                        <CardDescription className="text-sm">
                            Gere novas guias (QR Code) e solicite exames laboratoriais ou de imagem para seus pacientes.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <span className="text-primary font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                            Emitir Guia <ArrowRight className="w-4 h-4" />
                        </span>
                    </CardFooter>
                </Card>

                <Card 
                    className={`cursor-pointer transition-all group overflow-hidden relative ${canAccessProntuario ? 'hover:border-blue-500 hover:shadow-md border-blue-100' : 'opacity-60 grayscale cursor-not-allowed border-slate-200'}`}
                    onClick={() => {
                        if (canAccessProntuario) setActiveMode('prontuario');
                    }}
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FileText className="w-32 h-32" />
                    </div>
                    <CardHeader>
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${canAccessProntuario ? 'bg-blue-500/10 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                            <Stethoscope className="w-6 h-6" />
                        </div>
                        <CardTitle className="text-xl">Acesso ao Prontuário</CardTitle>
                        <CardDescription className="text-sm">
                           Registre evoluções, anamneses e emita receitas/atestados.
                           {(!canAccessProntuario) && (
                               <Badge variant="destructive" className="mt-4 block w-fit">Acesso Restrito</Badge>
                           )}
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <span className={`${canAccessProntuario ? 'text-blue-600' : 'text-slate-400'} font-medium flex items-center gap-1 group-hover:gap-2 transition-all`}>
                            {canAccessProntuario ? 'Acessar Registros Corporativos' : 'Requer Perfil Médico'} <ArrowRight className="w-4 h-4" />
                        </span>
                    </CardFooter>
                </Card>
            </div>
        </div>
        </>
    );
}

export default function MovementPage() {
    return (
        <Suspense fallback={<div className="p-12 text-center text-muted-foreground"><Loader2 className="animate-spin mx-auto mb-2"/> Carregando sistema central...</div>}>
            <MovementContainer />
        </Suspense>
    );
}
