"use client";

import * as React from 'react';
import { z } from "zod";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusCircle, Plus, Trash2, PawPrint, Edit, ArrowUpDown, Loader2, HeartPulse, Undo2, Download, FileText, Printer } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

import { Pet, HealthPlan } from '@/lib/types';
import { usePets, PetFormValues, petSchema, calculateAge } from '@/hooks/use-pets';
import { useHealthPlans } from '@/hooks/use-health-plans';
import { useEspecies, Especie } from '@/hooks/use-especies';
import { exportToCSV } from '@/lib/export-utils';
import { PageTitle } from '@/components/layout/page-title';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';



function PetForm({
  form,
  onFormSubmit,
  initialData,
  isEdit = false,
  onTutorCpfBlur,
  onHealthPlanChange,
  healthPlans,
  especies = [],
  tutorCpfInputRef,
  isCpfLocked = false,
  onClearLookup,
  petsForCpf = [],
  onSelectPetToEdit,
  onCancel
}: {
  form: UseFormReturn<PetFormValues>,
  onFormSubmit: (values: PetFormValues, petId?: string) => Promise<any>,
  initialData?: Partial<Pet> | null,
  isEdit?: boolean,
  onTutorCpfBlur?: (e: React.FocusEvent<HTMLInputElement>) => void,
  onHealthPlanChange: (planId: string) => void,
  healthPlans: HealthPlan[],
  especies: Especie[],
  tutorCpfInputRef?: React.RefObject<HTMLInputElement>,
  isCpfLocked?: boolean,
  onClearLookup?: () => void,
  petsForCpf?: Pet[],
  onSelectPetToEdit?: (pet: Pet) => void,
  onCancel?: () => void
}) {
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (initialData && especies.length > 0) {
      // Normalização inteligente de Espécie baseada na tabela de banco
      const rawEspecie = String(initialData.especie || '').trim().toLowerCase();
      
      // Tentar encontrar o match exato ou aproximado no banco
      let matchedEspecie = especies.find(e => e.nome.toLowerCase() === rawEspecie)?.nome;
      
      if (!matchedEspecie) {
        if (['canino', 'cachorro', 'cão', 'cao', 'dog', 'câo'].some(v => rawEspecie.includes(v))) {
          matchedEspecie = especies.find(e => e.nome === 'Cão')?.nome;
        } else if (['felino', 'gato', 'gata', 'cat', 'fel'].some(v => rawEspecie.includes(v))) {
          matchedEspecie = especies.find(e => e.nome === 'Gato')?.nome;
        } else if (['pássaro', 'passaro', 'pave', 'ave'].some(v => rawEspecie.includes(v))) {
          // Busca ultra-flexível para Pássaro
          matchedEspecie = especies.find(e => e.nome.includes('ássaro') || e.nome.includes('assaro'))?.nome;
        }
      }
      
      const especieNorm = matchedEspecie || '';

      // Normalização ultra-robusta de Sexo
      const rawSexo = String(initialData.sexo || '').trim().toLowerCase();
      let sexoNorm = 'M';
      if (['f', 'fêmea', 'femea', 'feminino', 'female'].includes(rawSexo)) sexoNorm = 'F';

      form.reset({
        nome: initialData.nome || '',
        especie: especieNorm,
        raca: initialData.raca || '',
        sexo: sexoNorm,
        idade: initialData.idade || '',
        dataNascimento: initialData.dataNascimento || '',
        tutorNome: initialData.tutorNome || '',
        tutorCpf: initialData.tutorCpf || '',
        tutorTelefone: initialData.tutorTelefone || '',
        tutorEmail: initialData.tutorEmail || '',
        tutorEndereco: initialData.tutorEndereco || '',
        tutorCep: initialData.tutorCep || '',
        tutorBairro: initialData.tutorBairro || '',
        tutorCidade: initialData.tutorCidade || '',
        tutorUf: initialData.tutorUf || '',
        healthPlanCode: initialData.healthPlanCode || '',
        healthPlanName: initialData.healthPlanName || '',
        matricula: initialData.matricula || '',
        codPet: initialData.codPet || '',
        idRegistro: initialData.idRegistro || '',
        dadosFamiliaresAtivo: initialData.dadosFamiliaresAtivo || false,
        paiNome: initialData.paiNome || '',
        paiRegistro: initialData.paiRegistro || '',
        paiInseminacao: initialData.paiInseminacao || false,
        semenRegistro: initialData.semenRegistro || '',
        maeNome: initialData.maeNome || '',
        maeRegistro: initialData.maeRegistro || '',
        paiPedigree: initialData.paiPedigree || '',
        maePedigree: initialData.maePedigree || '',
        dadosMovimentacaoAtivo: initialData.dadosMovimentacaoAtivo || false,
        pesagens: initialData.pesagens || [],
        statusReprodutivo: initialData.statusReprodutivo || '',
        filhos: initialData.filhos || [],
      } as any);

      // Sincronizar manualmente para garantir o visual imediato
      setTimeout(() => {
        form.setValue('especie', especieNorm);
        form.setValue('sexo', sexoNorm as 'M' | 'F');
      }, 0);
    }
  }, [initialData, form, especies]);

  const birthDate = form.watch('dataNascimento');
  React.useEffect(() => {
    if (birthDate) {
      const age = calculateAge(birthDate);
      form.setValue('idade', age, { shouldValidate: true });
    }
  }, [birthDate, form]);

  async function onSubmit(values: PetFormValues) {
    const petId = initialData && 'id' in initialData ? initialData.id : undefined;
    await onFormSubmit(values, petId);
  }

  const selectedPlanId = healthPlans.find(p => p.codPlano === form.watch('healthPlanCode'))?.id;

  return (
    <Form {...form}>
      <form 
        key={initialData && 'id' in initialData ? initialData.id : 'new-pet'}
        onSubmit={form.handleSubmit(onSubmit)} 
        className="space-y-6"
      >
        {!isEdit && petsForCpf.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1">
              <h4 className="font-semibold text-blue-800 text-sm">Pets encontrados para este Tutor:</h4>
              <p className="text-xs text-blue-600 mt-1">Se deseja editar um pet existente, selecione-o abaixo. Para um novo pet, apenas continue preenchendo o formulário abaixo.</p>
            </div>
            <div className="w-full sm:w-64">
              <Select onValueChange={(petId) => {
                const pet = petsForCpf.find(p => p.id === petId);
                if (pet && onSelectPetToEdit) onSelectPetToEdit(pet);
              }}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Selecione para editar..." />
                </SelectTrigger>
                <SelectContent>
                  {petsForCpf.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome} ({p.especie})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="tutorCpf"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CPF do Tutor</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input
                      placeholder="000.000.000-00"
                      {...field}
                      disabled={isEdit || isCpfLocked}
                      onBlur={onTutorCpfBlur}
                      ref={tutorCpfInputRef}
                    />
                  </FormControl>
                  {isCpfLocked && (
                    <Button type="button" variant="ghost" size="sm" onClick={onClearLookup} className="h-10">Limpar</Button>
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tutorNome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do Tutor</FormLabel>
                <FormControl>
                  <Input placeholder="Nome do Responsável" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="tutorTelefone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone do Tutor (Obrigatório)</FormLabel>
                <FormControl>
                  <Input placeholder="(00) 00000-0000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tutorEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail do Tutor</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="email@exemplo.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="nome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do Pet</FormLabel>
                <FormControl>
                  <Input placeholder="Bidu, Pipoca..." {...field} ref={nameInputRef} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
            <FormField
              control={form.control}
              name="codPet"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código do Pet (Automático)</FormLabel>
                  <FormControl>
                    <Input placeholder="PET-XXXX" {...field} disabled />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="idRegistro"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID-Registro (Tatuagem)</FormLabel>
                  <FormControl>
                    <Input placeholder="Identificação da Tatuagem" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="dataNascimento"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de Nascimento (Pet)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="idade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Idade</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: 3 anos" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="especie"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Espécie</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {especies.map(e => (
                      <SelectItem key={e.id} value={e.nome}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="raca"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Raça</FormLabel>
                <FormControl>
                  <Input placeholder="Vira-lata, Persa..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sexo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sexo</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Macho / Fêmea" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="M">Macho</SelectItem>
                    <SelectItem value="F">Fêmea</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 border-t pt-6">
          <FormField
            control={form.control}
            name="tutorCep"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CEP</FormLabel>
                <FormControl>
                  <Input placeholder="00000-000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tutorEndereco"
            render={({ field }) => (
              <FormItem className="md:col-span-3">
                <FormLabel>Endereço</FormLabel>
                <FormControl>
                  <Input placeholder="Rua, Número..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="tutorBairro"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bairro</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Centro" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tutorCidade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cidade</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: São Paulo" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tutorUf"
            render={({ field }) => (
              <FormItem>
                <FormLabel>UF</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: SP" maxLength={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="border p-4 rounded-md space-y-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">Convênio / Plano Pet</h3>
          </div>
          {healthPlans.length > 0 ? (
            <Select onValueChange={onHealthPlanChange} value={selectedPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um plano" />
              </SelectTrigger>
              <SelectContent>
                {healthPlans.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nome} ({p.codPlano})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum plano cadastrado.</p>
          )}
          <FormField
            control={form.control}
            name="matricula"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nº Matrícula (Opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Identificação no convênio" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* --- DADOS COMPLEMENTARES --- */}
        <div className="space-y-4">
          <div className="flex flex-col gap-4 border p-4 rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Dados Familiares</h3>
                <p className="text-sm text-muted-foreground">Registre informações de filiação e pedigree.</p>
              </div>
              <Button 
                type="button" 
                variant={form.watch('dadosFamiliaresAtivo') ? "default" : "outline"}
                onClick={() => form.setValue('dadosFamiliaresAtivo', !form.watch('dadosFamiliaresAtivo'))}
              >
                {form.watch('dadosFamiliaresAtivo') ? 'Remover Dados Familiares' : 'Adicionar Dados Familiares'}
              </Button>
            </div>
            
            {form.watch('dadosFamiliaresAtivo') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <FormField control={form.control} name="paiNome" render={({ field }) => (
                  <FormItem><FormLabel>Nome do Pai</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="paiRegistro" render={({ field }) => (
                  <FormItem><FormLabel>Registro do Pai</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="paiPedigree" render={({ field }) => (
                  <FormItem><FormLabel>Pedigree do Pai</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <div className="flex flex-col gap-4">
                   <div className="flex items-center space-x-2 pt-8">
                    <FormField control={form.control} name="paiInseminacao" render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                           <input type="checkbox" checked={field.value} onChange={field.onChange} className="w-4 h-4 mt-1" />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Pai por Inseminação</FormLabel>
                        </div>
                      </FormItem>
                    )} />
                   </div>
                   {form.watch('paiInseminacao') && (
                     <FormField control={form.control} name="semenRegistro" render={({ field }) => (
                        <FormItem><FormLabel>Registro do Sêmen</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                     )} />
                   )}
                </div>

                <div className="col-span-full border-t my-2" />

                <FormField control={form.control} name="maeNome" render={({ field }) => (
                  <FormItem><FormLabel>Nome da Mãe</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="maeRegistro" render={({ field }) => (
                  <FormItem><FormLabel>Registro da Mãe</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="maePedigree" render={({ field }) => (
                  <FormItem><FormLabel>Pedigree da Mãe</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 border p-4 rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Dados de Movimentação/Saúde</h3>
                <p className="text-sm text-muted-foreground">Registre histórico de peso e reprodução.</p>
              </div>
              <Button 
                type="button" 
                variant={form.watch('dadosMovimentacaoAtivo') ? "default" : "outline"}
                onClick={() => form.setValue('dadosMovimentacaoAtivo', !form.watch('dadosMovimentacaoAtivo'))}
              >
                {form.watch('dadosMovimentacaoAtivo') ? 'Remover Dados de Saúde' : 'Adicionar Dados de Saúde'}
              </Button>
            </div>
            
            {form.watch('dadosMovimentacaoAtivo') && (
              <div className="space-y-4 pt-4 border-t">
                <div>
                  <h4 className="font-medium mb-2">Histórico de Pesagem (3 últimas)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[0, 1, 2].map((idx) => {
                      const pesagens = form.watch('pesagens') || [];
                      const pesoAt = pesagens[idx] || { data: '', peso: '' };
                      return (
                        <div key={idx} className="flex flex-col gap-2 p-3 border rounded">
                           <div className="text-sm font-medium">Pesagem {idx + 1}</div>
                           <Input 
                             type="date" 
                             value={pesoAt.data} 
                             onChange={(e) => {
                               const newP = [...pesagens];
                               newP[idx] = { ...pesoAt, data: e.target.value };
                               form.setValue('pesagens', newP);
                             }} 
                             placeholder="Data" 
                           />
                           <Input 
                             type="text" 
                             value={pesoAt.peso} 
                             onChange={(e) => {
                               const newP = [...pesagens];
                               newP[idx] = { ...pesoAt, peso: e.target.value };
                               form.setValue('pesagens', newP);
                             }} 
                             placeholder="Peso (ex: 12kg)" 
                           />
                        </div>
                      )
                    })}
                  </div>
                </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-4">Dados Reprodutivos e Filhos</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <FormField control={form.control} name="statusReprodutivo" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status (Fêmea)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Nenhum">Nenhum</SelectItem>
                              <SelectItem value="Prenha">Prenha</SelectItem>
                              <SelectItem value="Parida">Parida</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      
                      <FormField control={form.control} name="dataUltimaCria" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data da Última Cria</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                        </FormItem>
                      )} />
                      
                      <FormField control={form.control} name="dataInseminacao" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data Inseminação / Cobertura</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="quantidadeFilhos" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Qtd. de Filhos (Ninhada/Total)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="Ex: 3" {...field} />
                          </FormControl>
                        </FormItem>
                      )} />
                    </div>

                    <h4 className="font-medium mb-2 text-sm">Registro de Filhos (Até 5)</h4>
                    <div className="space-y-2">
                      {[0, 1, 2, 3, 4].map((idx) => {
                        const filhos = form.watch('filhos') || [];
                        const filhoAt = filhos[idx] || { dataNascimento: '', peso: '', sexo: '' };
                        return (
                          <div key={idx} className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
                            <span className="text-xs font-semibold w-12 shrink-0">Filho {idx+1}</span>
                            <Input 
                               type="date" 
                               className="w-full sm:w-40 h-9"
                               value={filhoAt.dataNascimento} 
                               onChange={(e) => {
                                 const newF = [...filhos];
                                 newF[idx] = { ...filhoAt, dataNascimento: e.target.value };
                                 form.setValue('filhos', newF);
                               }} 
                             />
                             <Select 
                               value={filhoAt.sexo} 
                               onValueChange={(v) => {
                                 const newF = [...filhos];
                                 newF[idx] = { ...filhoAt, sexo: v };
                                 form.setValue('filhos', newF);
                               }}
                             >
                                <SelectTrigger className="w-full sm:w-28 h-9"><SelectValue placeholder="Sexo" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="M">Macho</SelectItem>
                                  <SelectItem value="F">Fêmea</SelectItem>
                                </SelectContent>
                             </Select>
                             <Input 
                               type="text" 
                               placeholder="Peso/Obs"
                               className="w-full sm:flex-1 h-9"
                               value={filhoAt.peso} 
                               onChange={(e) => {
                                 const newF = [...filhos];
                                 newF[idx] = { ...filhoAt, peso: e.target.value };
                                 form.setValue('filhos', newF);
                               }} 
                             />
                          </div>
                        )
                      })}
                    </div>
                  </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <Button type="submit" className="w-full md:w-auto" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Salvando...' : (
              <>
                <PlusCircle className="mr-2 h-4 w-4" />
                {isEdit ? 'Salvar Alterações' : 'Cadastrar Pet'}
              </>
            )}
          </Button>
          
          {onCancel && (
            <Button 
              type="button" 
              variant="outline" 
              className="w-full md:w-auto"
              onClick={onCancel}
            >
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}

function PetList({ pets, isLoaded, onEdit, onDelete, searchId }: { pets: Pet[], isLoaded: boolean, onEdit: (pet: Pet) => void, onDelete: (id: string) => void, searchId?: string | null }) {
  const router = useRouter();
  const [sortConfig, setSortConfig] = React.useState<{key: keyof Pet, direction: 'asc' | 'desc'} | null>(null);
  const [globalSearch, setGlobalSearch] = React.useState('');
  const [selectedPlanFilter, setSelectedPlanFilter] = React.useState('all');
  const [selectedEspecieFilter, setSelectedEspecieFilter] = React.useState('all');
  const [petToPrint, setPetToPrint] = React.useState<Pet | null>(null);

  const uniquePlanos = React.useMemo(() => Array.from(new Set(pets.map(p => p.healthPlanName || 'Particular'))).sort(), [pets]);
  const uniqueEspecies = React.useMemo(() => Array.from(new Set(pets.map(p => p.especie || 'Outro'))).sort(), [pets]);

  const sortedPets = React.useMemo(() => {
    let filteredItems = pets.filter(p => {
      if (searchId && p.id !== searchId) return false;
      const plano = p.healthPlanName || 'Particular';
      if (selectedPlanFilter !== 'all' && plano !== selectedPlanFilter) return false;
      
      const esp = p.especie || 'Outro';
      if (selectedEspecieFilter !== 'all' && esp !== selectedEspecieFilter) return false;
      
      if (globalSearch) {
        const searchLower = globalSearch.toLowerCase();
        // Remove formatting from CPF for easier searching if user types numbers only
        const cleanCpf = (p.tutorCpf || '').replace(/\D/g, '');
        const cleanSearch = searchLower.replace(/\D/g, '');
        
        const searchMatch = 
          (p.nome || '').toLowerCase().includes(searchLower) ||
          (cleanSearch && cleanCpf.includes(cleanSearch)) ||
          (p.tutorCpf || '').includes(searchLower) ||
          (p.codPet || '').toLowerCase().includes(searchLower) ||
          (p.tutorNome || '').toLowerCase().includes(searchLower);
          
        if (!searchMatch) return false;
      }
      
      return true;
    });

    if (sortConfig !== null) {
      filteredItems.sort((a, b) => {
        const valA = String(a[sortConfig.key] ?? '');
        const valB = String(b[sortConfig.key] ?? '');
        return sortConfig.direction === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      });
    }
    return filteredItems;
  }, [pets, sortConfig, selectedPlanFilter, selectedEspecieFilter]);

  const requestSort = (key: keyof Pet) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: keyof Pet) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    }
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

  if (!isLoaded) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-col space-y-4 xl:flex-row xl:items-center xl:justify-between xl:space-y-0">
        <div>
          <CardTitle>Pets Cadastrados</CardTitle>
          <CardDescription>
            {searchId ? (
              <div className="text-orange-600 font-medium flex flex-wrap items-center mt-1">
                Exibindo resultado da leitura. 
                <Link href="/pets" className="underline font-bold ml-2 hover:text-orange-700">Limpar</Link>
                <span className="mx-2 text-slate-300">|</span>
                <Link href="/scan-pet" className="text-blue-600 underline font-bold hover:text-blue-800">Ler Novo QR Code</Link>
              </div>
            ) : (
              "Visualize e gerencie todos os animais registrados na clínica."
            )}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto mt-4 xl:mt-0">
          <div className="relative w-full xl:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por CPF, Código ou Nome..." 
              className="pl-9 h-10 w-full bg-slate-50 border-slate-200 focus-visible:ring-slate-300 rounded-md" 
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 w-full xl:w-auto">
            <Select value={selectedPlanFilter} onValueChange={setSelectedPlanFilter}>
              <SelectTrigger className="w-full xl:w-[150px] h-10">
                <SelectValue placeholder="Plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Planos</SelectItem>
                {uniquePlanos.map(plano => (
                  <SelectItem key={plano} value={plano}>{plano}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedEspecieFilter} onValueChange={setSelectedEspecieFilter}>
              <SelectTrigger className="w-full xl:w-[150px] h-10">
                <SelectValue placeholder="Espécie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Espécies</SelectItem>
                {uniqueEspecies.map(esp => (
                  <SelectItem key={esp} value={esp}>{esp}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 border-l pl-2 ml-1">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
              const headers = ['Código', 'Nome', 'Espécie/Raça', 'Tutor', 'CPF Tutor', 'Plano'];
              const rows = sortedPets.map(pet => [
                  pet.codPet || '',
                  pet.nome || '',
                  `${pet.especie}${pet.raca ? ` / ${pet.raca}` : ''}`,
                  pet.tutorNome || '',
                  pet.tutorCpf || '',
                  pet.healthPlanName || 'Particular'
              ]);

              const filters = [];
              if (selectedPlanFilter !== 'all') filters.push({ label: 'Plano', value: selectedPlanFilter });
              if (selectedEspecieFilter !== 'all') filters.push({ label: 'Espécie', value: selectedEspecieFilter });

              const reportData = {
                  title: "Lista de Pets",
                  subtitle: `Total de registros: ${sortedPets.length}`,
                  filters: filters.length > 0 ? filters : undefined,
                  headers,
                  rows,
                  backUrl: '/pets'
              };
              localStorage.setItem('print-report-data', JSON.stringify(reportData));
              router.push('/print/report');
            }}
            className="border-primary/20 text-primary hover:bg-primary/5"
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimir PDF
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              const exportData = sortedPets.map(p => ({
                'Nome_Pet': p.nome,
                'Especie': p.especie,
                'Raca': p.raca || '',
                'Sexo_MF': p.sexo,
                'Data_Nascimento': p.dataNascimento || '',
                'Tutor_Nome': p.tutorNome,
                'Tutor_CPF': p.tutorCpf,
                'Tutor_Email': p.tutorEmail || '',
                'Tutor_Telefone': p.tutorTelefone || '',
                'CEP': p.tutorCep || '',
                'Endereco': p.tutorEndereco || '',
                'Bairro': p.tutorBairro || '',
                'Cidade': p.tutorCidade || '',
                'UF': p.tutorUf || '',
                'Codigo_Plano': p.healthPlanCode || '',
                'Matricula_Plano': p.matricula || '',
                'Codigo_Pet_Antigo': p.codPet || ''
              }));
              
              // If list is empty, export a header-only template
              const dataToExport = exportData.length > 0 ? exportData : [{
                'Nome_Pet': 'Ex: Bidu',
                'Especie': 'Cão',
                'Raca': 'Vira-lata',
                'Sexo_MF': 'M',
                'Data_Nascimento': '2020-01-01',
                'Tutor_Nome': 'João Silva',
                'Tutor_CPF': '000.000.000-00',
                'Tutor_Email': 'joao@email.com',
                'Tutor_Telefone': '(00) 00000-0000',
                'CEP': '00000-000',
                'Endereco': 'Rua Exemplo, 123',
                'Bairro': 'Centro',
                'Cidade': 'São Paulo',
                'UF': 'SP',
                'Codigo_Plano': '',
                'Matricula_Plano': '',
                'Codigo_Pet_Antigo': ''
              }];
              
              exportToCSV('modelo_importacao_pets', dataToExport);
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {sortedPets.length > 0 ? (
          <div className="overflow-x-auto">
          <Table className="min-w-max text-[11px] lg:text-xs">
            <TableHeader>
              <TableRow className="border-b-2">
                <TableHead className="font-semibold text-slate-600 whitespace-nowrap">
                  <Button variant="ghost" onClick={() => requestSort('codPet')} className="hover:bg-transparent p-0 h-auto font-semibold">
                    Código {getSortIndicator('codPet')}
                  </Button>
                </TableHead>
                <TableHead className="font-semibold text-slate-600 whitespace-nowrap">
                  <Button variant="ghost" onClick={() => requestSort('nome')} className="hover:bg-transparent p-0 h-auto font-semibold">
                    Nome {getSortIndicator('nome')}
                  </Button>
                </TableHead>
                <TableHead className="font-semibold text-slate-600 whitespace-nowrap">
                  <Button variant="ghost" onClick={() => requestSort('tutorCpf')} className="hover:bg-transparent p-0 h-auto font-semibold">
                    CPF Tutor {getSortIndicator('tutorCpf')}
                  </Button>
                </TableHead>
                <TableHead className="font-semibold text-slate-600 whitespace-nowrap">Data de Nasc.</TableHead>
                <TableHead className="font-semibold text-slate-600 whitespace-nowrap">Idade</TableHead>
                <TableHead className="font-semibold text-slate-600 whitespace-nowrap">Espécie/Sexo</TableHead>
                <TableHead className="font-semibold text-slate-600 whitespace-nowrap">Telefone</TableHead>
                <TableHead className="font-semibold text-slate-600 whitespace-nowrap max-w-[120px] truncate">E-mail</TableHead>
                <TableHead className="font-semibold text-slate-600 whitespace-nowrap max-w-[150px] truncate">Endereço</TableHead>
                <TableHead className="font-semibold text-slate-600 whitespace-nowrap">Plano de Saúde</TableHead>
                <TableHead className="font-semibold text-slate-600 whitespace-nowrap">Mat</TableHead>
                <TableHead className="text-right font-semibold text-slate-600">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPets.map((pet) => (
                <TableRow key={pet.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-medium">{pet.codPet}</TableCell>
                  <TableCell className="font-medium min-w-[120px]">{pet.nome}<br/><span className="text-[10px] text-muted-foreground font-normal">Tutor: {pet.tutorNome}</span></TableCell>
                  <TableCell className="whitespace-nowrap">{pet.tutorCpf || '-'}</TableCell>
                  <TableCell>{pet.dataNascimento ? new Date(pet.dataNascimento).toLocaleDateString('pt-BR') : '-'}</TableCell>
                  <TableCell>{pet.idade || '-'}</TableCell>
                  <TableCell>{pet.especie}{pet.sexo ? ` (${pet.sexo})` : ''}</TableCell>
                  <TableCell className="whitespace-nowrap">{pet.tutorTelefone || '-'}</TableCell>
                  <TableCell className="max-w-[120px] truncate" title={pet.tutorEmail}>{pet.tutorEmail || '-'}</TableCell>
                  <TableCell className="max-w-[150px] truncate" title={pet.tutorEndereco ? `${pet.tutorEndereco}, ${pet.tutorCidade}-${pet.tutorUf}` : ''}>
                    {pet.tutorEndereco ? `${pet.tutorEndereco}, ${pet.tutorCidade}` : '-'}
                  </TableCell>
                  <TableCell>{pet.healthPlanName || '-'}</TableCell>
                  <TableCell>{pet.matricula || '-'}</TableCell>
                  <TableCell className="text-right flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Imprimir Crachá/Etiqueta" onClick={() => setPetToPrint(pet)}>
                      <Printer className="h-3.5 w-3.5 text-blue-500" />
                    </Button>
                    <Link href={`/pets/${pet.id}/prontuario`} passHref>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Prontuário Digital">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(pet)}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(pet.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        ) : (
          <div className="text-center py-12">
            <PawPrint className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum pet encontrado</h3>
          </div>
        )}
      </CardContent>

      <Dialog open={!!petToPrint} onOpenChange={(open) => !open && setPetToPrint(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Imprimir Identificação</DialogTitle>
            <DialogDescription>
              Escolha o formato de impressão para {petToPrint?.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Button 
              variant="outline" 
              className="h-24 flex flex-col items-center justify-center gap-2"
              onClick={() => {
                window.open(`/print/pet/${petToPrint?.id}`, '_blank');
                setPetToPrint(null);
              }}
            >
              <FileText className="h-8 w-8 text-primary" />
              <span>Crachá (Térmica 58mm)</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-24 flex flex-col items-center justify-center gap-2"
              onClick={() => {
                window.open(`/print/pet-label/${petToPrint?.id}`, '_blank');
                setPetToPrint(null);
              }}
            >
              <PawPrint className="h-8 w-8 text-indigo-500" />
              <span>Etiqueta (58x30mm)</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function PetsPage() {
  const { pets, addPet, updatePet, deletePet, findPetByTutorCpf, isLoaded } = usePets();
  const { healthPlans, isLoaded: healthPlansLoaded } = useHealthPlans();
  const { especies, isLoaded: especiesLoaded, addEspecie, updateEspecie, deleteEspecie, isLoading: especiesLoading } = useEspecies();
  const [newEspecieNome, setNewEspecieNome] = React.useState('');
  const [editingEspecieId, setEditingEspecieId] = React.useState<string | null>(null);
  const [editingEspecieNome, setEditingEspecieNome] = React.useState('');
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchId = searchParams.get('searchId');
  const [activeTab, setActiveTab] = React.useState(searchParams.get('tab') || "list");
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [selectedPet, setSelectedPet] = React.useState<Pet | null>(null);
  const [isCpfLocked, setIsCpfLocked] = React.useState(false);
  const [petsForCpf, setPetsForCpf] = React.useState<Pet[]>([]);
  const tutorCpfInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<PetFormValues>({
    resolver: zodResolver(petSchema),
    defaultValues: { 
      nome: '', especie: '', raca: '', sexo: 'M', 
      tutorNome: '', tutorCpf: '', tutorEmail: '', tutorTelefone: '', 
      tutorEndereco: '', tutorCep: '', tutorBairro: '', tutorCidade: '', tutorUf: '',
      healthPlanCode: '', healthPlanName: '',
      idRegistro: '', dadosFamiliaresAtivo: false, paiNome: '', paiRegistro: '', paiInseminacao: false, semenRegistro: '', maeNome: '', maeRegistro: '', paiPedigree: '', maePedigree: '', dadosMovimentacaoAtivo: false, pesagens: [], statusReprodutivo: '', filhos: []
    }
  });

  React.useEffect(() => {
    const prefill = searchParams.get('prefill');
    if (prefill === 'true') {
      const tutorCpf = searchParams.get('tutorCpf') || '';
      const tutorNome = searchParams.get('tutorNome') || '';
      const tutorTelefone = searchParams.get('tutorTelefone') || '';
      const petNome = searchParams.get('petNome') || '';
      
      form.reset({
        nome: petNome,
        tutorNome: tutorNome,
        tutorCpf: tutorCpf,
        tutorTelefone: tutorTelefone,
        especie: '',
        raca: '',
        sexo: 'M',
        tutorEmail: '',
        tutorEndereco: '',
        tutorCep: '',
        tutorBairro: '',
        tutorCidade: '',
        tutorUf: '',
        healthPlanCode: '',
        healthPlanName: '',
        matricula: '',
        idRegistro: '', dadosFamiliaresAtivo: false, paiNome: '', paiRegistro: '', paiInseminacao: false, semenRegistro: '', maeNome: '', maeRegistro: '', paiPedigree: '', maePedigree: '', dadosMovimentacaoAtivo: false, pesagens: [], statusReprodutivo: '', filhos: []
      } as any);
      
      setIsCpfLocked(!!tutorCpf);
      setActiveTab("register");
      
      router.replace('/pets', { scroll: false });
    } else {
      const editPetId = searchParams.get('editPetId');
      if (editPetId && pets.length > 0) {
        const foundPet = pets.find(p => p.id === editPetId);
        if (foundPet) {
          setSelectedPet(foundPet);
          setIsEditDialogOpen(true);
          router.replace('/pets', { scroll: false });
        }
      }
    }
  }, [searchParams, pets, form, router]);

  const handleTutorCpfBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cpf = e.target.value.trim();
    if (cpf.length < 11) return;
    const foundPets = await findPetByTutorCpf(cpf);
    if (foundPets.length > 0) {
      const p = foundPets[0];
      toast({ title: "Tutor encontrado", description: "Dados do tutor carregados. CPF bloqueado para edição." });
      setIsCpfLocked(true);
      form.setValue('tutorNome', p.tutorNome);
      form.setValue('tutorTelefone', p.tutorTelefone || '');
      form.setValue('tutorEmail', p.tutorEmail || '');
      form.setValue('tutorEndereco', p.tutorEndereco || '');
      form.setValue('tutorCep', p.tutorCep || '');
      form.setValue('tutorBairro', p.tutorBairro || '');
      form.setValue('tutorCidade', p.tutorCidade || '');
      form.setValue('tutorUf', p.tutorUf || '');
      setPetsForCpf(foundPets);
    } else {
      setPetsForCpf([]);
    }
  };

  const handleClearCpfLookup = () => {
    setIsCpfLocked(false);
    setPetsForCpf([]);
    form.reset({ 
      nome: '', especie: '', raca: '', sexo: 'M', 
      tutorNome: '', tutorCpf: '', tutorEmail: '', tutorTelefone: '', 
      tutorEndereco: '', tutorCep: '', tutorBairro: '', tutorCidade: '', tutorUf: '',
      healthPlanCode: '', healthPlanName: '', matricula: '',
      idRegistro: '', dadosFamiliaresAtivo: false, paiNome: '', paiRegistro: '', paiInseminacao: false, semenRegistro: '', maeNome: '', maeRegistro: '', paiPedigree: '', maePedigree: '', dadosMovimentacaoAtivo: false, pesagens: [], statusReprodutivo: '', filhos: []
    });
    setTimeout(() => tutorCpfInputRef.current?.focus(), 100);
  };

  const handleFormSubmit = async (values: PetFormValues, petId?: string) => {
    let result;
    if (petId) {
      result = await updatePet(petId, values);
    } else {
      result = await addPet(values);
    }

    if (result.success) {
      toast({ title: "Sucesso!", description: petId ? "Pet atualizado." : "Pet cadastrado." });
      setIsCpfLocked(false);
      setPetsForCpf([]);
      form.reset({ 
        nome: '', especie: '', raca: '', sexo: 'M', 
        tutorNome: '', tutorCpf: '', tutorEmail: '', tutorTelefone: '', 
        tutorEndereco: '', tutorCep: '', tutorBairro: '', tutorCidade: '', tutorUf: '',
        healthPlanCode: '', healthPlanName: '', matricula: '',
        idRegistro: '', dadosFamiliaresAtivo: false, paiNome: '', paiRegistro: '', paiInseminacao: false, semenRegistro: '', maeNome: '', maeRegistro: '', paiPedigree: '', maePedigree: '', dadosMovimentacaoAtivo: false, pesagens: [], statusReprodutivo: '', filhos: []
      });
      
      if (!petId) {
        setTimeout(() => tutorCpfInputRef.current?.focus(), 100);
      } else {
        setActiveTab("list");
        setIsEditDialogOpen(false);
      }
    } else {
      toast({ title: "Erro", description: result.message, variant: "destructive" });
    }
  };

  return (
    <>
      <PageTitle title="Gerenciamento de Pets" description="Controle de prontuários, tutores e planos veterinários.">
        <Link href="/" passHref><Button variant="outline"><Undo2 className="mr-2 h-4 w-4" />Voltar</Button></Link>
      </PageTitle>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:w-[600px]">
          <TabsTrigger value="list">Listar Pets</TabsTrigger>
          <TabsTrigger value="register">Novo Pet</TabsTrigger>
          <TabsTrigger value="especies">Gerenciar Espécies</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-6">
          <PetList 
            pets={pets} 
            isLoaded={isLoaded && healthPlansLoaded} 
            searchId={searchId}
            onEdit={(pet) => { setSelectedPet(pet); setIsEditDialogOpen(true); }} 
            onDelete={deletePet} 
          />
        </TabsContent>
        <TabsContent value="register" className="mt-6">
          <Card>
            <CardHeader><CardTitle>Cadastro de Novo Pet</CardTitle></CardHeader>
            <CardContent>
              <PetForm 
                form={form} 
                onFormSubmit={handleFormSubmit} 
                onHealthPlanChange={(id) => {
                  const p = healthPlans.find(pl => pl.id === id);
                  if (p) { form.setValue('healthPlanName', p.nome); form.setValue('healthPlanCode', p.codPlano); }
                }}
                onTutorCpfBlur={handleTutorCpfBlur}
                healthPlans={healthPlans}
                especies={especies}
                tutorCpfInputRef={tutorCpfInputRef}
                isCpfLocked={isCpfLocked}
                onClearLookup={handleClearCpfLookup}
                petsForCpf={petsForCpf}
                onSelectPetToEdit={(pet) => {
                  setSelectedPet(pet);
                  setIsEditDialogOpen(true);
                  handleClearCpfLookup();
                }}
                onCancel={() => {
                  handleClearCpfLookup();
                  setActiveTab("list");
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="especies" className="mt-6">
          <Card>
            <CardHeader><CardTitle>Cadastro de Espécies</CardTitle><CardDescription>Adicione as espécies de animais que sua clínica atende.</CardDescription></CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-8">
                <Input 
                  placeholder="Nome da Espécie (ex: Hamster, Tartaruga)" 
                  value={newEspecieNome} 
                  onChange={(e) => setNewEspecieNome(e.target.value)} 
                />
                <Button disabled={especiesLoading || !newEspecieNome} onClick={async () => {
                  const res = await addEspecie(newEspecieNome);
                  if (res.success) { toast({ title: "Sucesso!", description: "Espécie adicionada." }); setNewEspecieNome(''); }
                  else { toast({ title: "Erro na espécie", description: "Nome já existe ou inválido", variant: "destructive" }); }
                }}><Plus className="w-4 h-4 mr-2" />Adicionar</Button>
              </div>

              <Table>
                <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  {especies.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {editingEspecieId === e.id ? (
                          <div className="flex gap-2">
                            <Input 
                              size={30}
                              value={editingEspecieNome} 
                              onChange={(e) => setEditingEspecieNome(e.target.value)}
                              className="h-8"
                            />
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 px-2 text-green-600"
                              onClick={async () => {
                                const res = await updateEspecie(e.id, editingEspecieNome);
                                if (res.success) {
                                  toast({ title: "Sucesso", description: "Espécie atualizada." });
                                  setEditingEspecieId(null);
                                } else {
                                  toast({ title: "Erro", description: res.message, variant: "destructive" });
                                }
                              }}
                            >Salvar</Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 px-2 text-muted-foreground"
                              onClick={() => setEditingEspecieId(null)}
                            >Cancelar</Button>
                          </div>
                        ) : e.nome}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => {
                            setEditingEspecieId(e.id);
                            setEditingEspecieNome(e.nome);
                          }}
                        ><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteEspecie(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {especies.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">Nenhuma espécie cadastrada.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Dados do Pet</DialogTitle></DialogHeader>
          <PetForm 
            form={form} 
            isEdit={true}
            initialData={selectedPet}
            onFormSubmit={handleFormSubmit}
            onHealthPlanChange={(id) => {
              const p = healthPlans.find(pl => pl.id === id);
              if (p) { form.setValue('healthPlanName', p.nome); form.setValue('healthPlanCode', p.codPlano); }
            }}
            healthPlans={healthPlans}
            especies={especies}
            tutorCpfInputRef={tutorCpfInputRef}
            isCpfLocked={isCpfLocked}
            onClearLookup={handleClearCpfLookup}
            onCancel={() => setIsEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
