"use client";

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { usePets } from '@/hooks/use-pets';
import { PageTitle } from '@/components/layout/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Undo2, Users, FileText, PlusCircle, Loader2, Activity } from 'lucide-react';
import Link from 'next/link';

export default function ProntuarioPage() {
    const router = useRouter();
    const { pets, isLoaded } = usePets();
    
    const [search, setSearch] = React.useState('');
    const [selectedPetId, setSelectedPetId] = React.useState('');
    const [showList, setShowList] = React.useState(true);
    
    // Sort pets alphabetically by name
    const sortedPets = React.useMemo(() => {
        return [...pets].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    }, [pets]);

    const filteredPets = React.useMemo(() => {
        if (!search) return sortedPets;
        const lowerSearch = search.toLowerCase();
        return sortedPets.filter(p => 
            (p.nome || '').toLowerCase().includes(lowerSearch) ||
            (p.tutorCpf || '').toLowerCase().includes(lowerSearch) ||
            (p.codPet || '').toLowerCase().includes(lowerSearch) ||
            (p.tutorNome || '').toLowerCase().includes(lowerSearch)
        );
    }, [sortedPets, search]);

    const handleOpenRecord = () => {
        if (selectedPetId) {
            router.push(`/pets/${selectedPetId}/prontuario`);
        }
    };

    if (!isLoaded) {
        return <div className="flex justify-center items-center h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="container mx-auto p-4 max-w-6xl animate-in fade-in zoom-in-95 duration-300">
            <PageTitle title="Acesso ao Prontuário Digital" description="Selecione um paciente para visualizar ou cadastrar atendimentos clínicos.">
                <Button variant="outline" className="bg-white" asChild>
                    <Link href="/">
                        <Undo2 className="mr-2 h-4 w-4" /> Voltar ao Menu
                    </Link>
                </Button>
            </PageTitle>

            <div className="max-w-2xl mx-auto my-8">
                <Card className="border shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                            <Activity className="w-5 h-5 text-blue-500" /> Buscar Paciente
                        </CardTitle>
                        <CardDescription>Para iniciar, digite o nome do pet, tutor, CPF ou código.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Digite para filtrar..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 bg-slate-50"
                            />
                        </div>
                        
                        <Select value={selectedPetId} onValueChange={setSelectedPetId}>
                            <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Selecione o paciente na lista..." />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredPets.map(pet => (
                                    <SelectItem key={pet.id} value={pet.id}>
                                        {pet.nome} - {pet.especie} {pet.raca ? `(${pet.raca})` : ''} - Tutor: {pet.tutorNome}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div className="flex gap-4 pt-2">
                            <Button 
                                type="button" 
                                variant="outline" 
                                className="w-1/2 bg-slate-50 hover:bg-slate-100" 
                                onClick={() => setShowList(!showList)}
                            >
                                <Users className="w-4 h-4 mr-2 text-slate-500" />
                                {showList ? 'Ocultar Lista' : 'Mostrar Lista'}
                            </Button>
                            <Button 
                                type="button" 
                                className="w-1/2 bg-[#7FA4EA] hover:bg-[#6c8ecd] text-white shadow-sm" 
                                disabled={!selectedPetId}
                                onClick={handleOpenRecord}
                            >
                                <Activity className="w-4 h-4 mr-2" />
                                Abrir Registro Clínico
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {showList && (
                <div className="mt-12 animate-in slide-in-from-bottom-4 duration-500">
                    <h3 className="text-[15px] font-bold flex items-center gap-2 mb-4 text-[#7FA4EA]">
                        <Users className="w-5 h-5" /> Pacientes com Prontuário
                    </h3>
                    
                    <div className="border rounded-md bg-white shadow-sm overflow-x-auto">
                        <Table className="min-w-[700px]">
                            <TableHeader className="bg-slate-50/80">
                                <TableRow>
                                    <TableHead className="font-semibold text-slate-600">
                                        Nome do Paciente ↑↓
                                    </TableHead>
                                    <TableHead className="font-semibold text-slate-600">
                                        CPF / Código ↑↓
                                    </TableHead>
                                    <TableHead className="text-right font-semibold text-slate-600 w-[300px]">
                                        Ações
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPets.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                            Nenhum paciente encontrado.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredPets.map(pet => (
                                        <TableRow key={pet.id} className="hover:bg-slate-50/50">
                                            <TableCell>
                                                <div className="text-sm font-medium text-slate-800">{pet.nome}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm text-slate-700">CPF: {pet.tutorCpf || 'N/A'}</div>
                                            </TableCell>
                                            <TableCell className="text-right py-2">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="text-slate-600 bg-white shadow-sm hover:bg-slate-50 border-slate-200 h-8"
                                                        onClick={() => router.push(`/pets/${pet.id}/prontuario`)}
                                                    >
                                                        <FileText className="w-3.5 h-3.5 mr-1.5" /> Histórico
                                                    </Button>
                                                    <Button 
                                                        variant="default" 
                                                        size="sm"
                                                        className="bg-[#4666F6] hover:bg-[#3b58d9] shadow-sm text-white h-8"
                                                        onClick={() => router.push(`/pets/${pet.id}/prontuario?tab=novo`)}
                                                    >
                                                        <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Novo Registro
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
        </div>
    );
}
