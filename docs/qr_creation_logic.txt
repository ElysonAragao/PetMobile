// CÓPIA DE SEGURANÇA - Lógica de Geração de QR Code (Movimentação)

"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collection, query, getDocs, orderBy, limit, addDoc, where } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { QrCode, Send, Printer, RefreshCw, Loader2, PlusCircle, Stethoscope, FileText, Info, Undo2, Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

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


import { Patient, Medico, Exam } from '@/lib/types';
import { usePatients } from '@/hooks/use-patients';
import { useMedicos } from '@/hooks/use-medicos';
import { useExams } from '@/hooks/use-exams';

const movementSchema = z.object({
  patientId: z.string({required_error: 'Paciente é obrigatório.'}).min(1, 'Paciente é obrigatório.'),
  medicoId: z.string({required_error: 'Médico é obrigatório.'}).min(1, 'Médico é obrigatório.'),
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


export default function MovementPage() {
  const firestore = useFirestore();
  const { patients, isLoaded: patientsLoaded } = usePatients();
  const { medicos, isLoaded: medicosLoaded } = useMedicos();
  const { exams, isLoaded: examsLoaded } = useExams();
  const { toast } = useToast();

  const [generatedGuide, setGeneratedGuide] = React.useState<GeneratedGuide | null>(null);
  const [patientSearch, setPatientSearch] = React.useState('');
  const [medicoSearch, setMedicoSearch] = React.useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  const patientSearchInputRef = React.useRef<HTMLInputElement>(null);
  const medicoSearchInputRef = React.useRef<HTMLInputElement>(null);
  const examSelectContainerRef = React.useRef<HTMLDivElement>(null);
  const submitButtonRef = React.useRef<HTMLButtonElement>(null);
  const printButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    patientSearchInputRef.current?.focus();
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

  React.useEffect(() => {
    const newPatientId = searchParams.get('newPatientId');
    if (newPatientId && patients.some(p => p.id === newPatientId)) {
        form.setValue('patientId', newPatientId);
        router.replace('/movement', { scroll: false });
        setTimeout(() => medicoSearchInputRef.current?.focus(), 100);
    }
    const newMedicoId = searchParams.get('newMedicoId');
    if (newMedicoId && medicos.some(m => m.id === newMedicoId)) {
        form.setValue('medicoId', newMedicoId);
        router.replace('/movement', { scroll: false });
        setTimeout(() => examSelectContainerRef.current?.focus(), 100);
    }
  }, [searchParams, patients, medicos, form, router]);


  const getNextMovimentoId = async (): Promise<string> => {
    if (!firestore) return `${new Date().getFullYear()}${(Math.random() * 10000).toFixed(0).padStart(4, '0')}`;
    
    const year = new Date().getFullYear().toString();
    const movCollection = collection(firestore, 'movimentacoes');
    const q = query(
      movCollection, 
      where('movimentoId', '>=', year),
      where('movimentoId', '<', String(Number(year) + 1)),
      orderBy('movimentoId', 'desc'), 
      limit(1)
    );

    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            return `${year}0001`;
        }

        const lastDoc = querySnapshot.docs[0];
        const lastId = lastDoc.data().movimentoId as string;
        
        if (lastId && lastId.startsWith(year)) {
            const numberPart = parseInt(lastId.substring(year.length));
            if (!isNaN(numberPart)) {
                const nextNumber = numberPart + 1;
                return `${year}${nextNumber.toString().padStart(4, '0')}`;
            }
        }
    } catch(e) {
      console.warn("Could not determine next movement ID, falling back to random. Error:", e)
    }
    
    return `${new Date().getFullYear()}${(Math.random() * 10000).toFixed(0).padStart(4, '0')}`;
  };

  const onSubmit = async (values: MovementFormValues) => {
    setGeneratedGuide(null);

    const fullPatientData = patients.find(p => p.id === values.patientId);
    const fullMedicoData = medicos.find(m => m.id === values.medicoId);
    const fullExamsData = exams.filter(e => values.examIds.includes(e.id));
    
    if (!fullPatientData || !fullMedicoData || fullExamsData.length === 0) {
      toast({
        title: 'Formulário Incompleto',
        description: 'Dados de paciente, médico ou exames não encontrados.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!firestore) {
        toast({ title: 'Erro', description: 'Serviço indisponível.', variant: 'destructive'});
        return;
    }

    const movimentoId = await getNextMovimentoId();
    const dataHora = new Date().toISOString();
    

    try {
        await addDoc(collection(firestore, 'movimentacoes'), {
            movimentoId,
            pacienteId: values.patientId,
            medicoId: values.medicoId,
            exameIds: values.examIds,
            data: dataHora
        });

        setGeneratedGuide({
            movimentoId,
            qrCodeData: movimentoId, // QR Code now only contains the ID
            patient: fullPatientData,
            medico: fullMedicoData,
            exams: fullExamsData,
        });

        toast({
            title: 'Guia Gerada com Sucesso!',
            description: 'A guia foi salva no sistema e o QR Code está pronto.'
        });
    } catch (e: any) {
         toast({
            title: 'Erro ao Salvar Guia',
            description: e.message || 'Não foi possível salvar a guia no banco de dados.',
            variant: 'destructive',
        });
    }
  };
  
  const handleViewAndPrint = () => {
    if (!generatedGuide) return;
    // We pass the movimentoId, as the print page fetches data from Firestore to be official
    window.open(`/print/${generatedGuide.movimentoId}`, '_blank');
  };

  const resetForm = () => {
    form.reset({
      patientId: '',
      medicoId: '',
      examIds: [],
    });
    setGeneratedGuide(null);
    setPatientSearch('');
    setMedicoSearch('');
    patientSearchInputRef.current?.focus();
  };

  const isLoading = !patientsLoaded || !medicosLoaded || !examsLoaded;


  if (isLoading) {
    return (
        <>
         <PageTitle title="Movimentação" description="Gere guias de exames com QR Code." />
         <div className="flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="w-6 h-6 animate-spin"/>
            <p>Carregando dados de pacientes, médicos e exames...</p>
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
                                        setTimeout(() => medicoSearchInputRef.current?.focus(), 100);
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
                                                                <PlusCircle className="mr-2 h-4 w-4"/>
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
                                        <PlusCircle className="mr-2 h-4 w-4"/>
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
                                    <SelectTrigger>
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
                                                        <Button asChild variant="link" className="mt-2 h-auto p-0">
                                                            <Link href={`/medicos?tab=register&redirect=/movement&name=${encodeURIComponent(medicoSearch)}`}>
                                                                <PlusCircle className="mr-2 h-4 w-4"/>
                                                                Cadastrar Novo Médico
                                                            </Link>
                                                        </Button>
                                                    </>
                                                ) : "Nenhum médico encontrado."}
                                            </div>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="p-4 text-sm text-center text-muted-foreground border rounded-md">
                                <p>Nenhum médico encontrado.</p>
                                <Link href="/medicos?tab=register">
                                    <Button variant="link" className="mt-2 h-auto p-0">
                                        <PlusCircle className="mr-2 h-4 w-4"/>
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
                            <ScrollArea 
                                ref={examSelectContainerRef} 
                                tabIndex={-1} 
                                className="h-40 w-full rounded-md border p-4 focus:outline-none focus:ring-2 focus:ring-ring"
                                onBlur={() => setTimeout(() => submitButtonRef.current?.focus(), 0)}
                            >
                                <div className="space-y-4">
                                {exams.map((item) => (
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
                                                        (field.value ||[]).filter(
                                                        (value) => value !== item.id
                                                        )
                                                    );
                                                }}
                                            />
                                            </FormControl>
                                            <FormLabel className="font-normal">
                                            {item.name}
                                            </FormLabel>
                                        </FormItem>
                                        );
                                    }}
                                    />
                                ))}
                                </div>
                            </ScrollArea>
                        ) : (
                            <div className="p-4 text-sm text-center text-muted-foreground border rounded-md">
                                <p>Nenhum exame encontrado.</p>
                                <Link href="/exams?tab=register">
                                    <Button variant="link" className="mt-2 h-auto p-0">
                                        <PlusCircle className="mr-2 h-4 w-4"/>
                                        Cadastrar Novo Exame
                                    </Button>
                                </Link>
                            </div>
                        )}
                        <FormMessage />
                    </FormItem>
                  )}
                />


                <Button ref={submitButtonRef} type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                        Gerando...
                      </>
                    ) : (
                      <>
                        <QrCode className="mr-2 h-4 w-4" />
                        Gerar Guia e QR Code
                      </>
                    )}
                </Button>
                {generatedGuide && (
                    <Button type="button" variant="outline" className="w-full" onClick={resetForm}>
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
                        <Printer className="mr-2"/> Gerar PDF / Imprimir
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
                        <Image
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
                        <p><strong>Exames:</strong> {generatedGuide.exams.map(e => `${e.name} (${e.description})`).join(', ')}</p>
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
