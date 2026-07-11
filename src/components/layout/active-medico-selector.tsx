"use client";

import React, { useEffect, useState } from 'react';
import { useActiveMedico } from '@/context/active-medico-context';
import { useVeterinarios } from '@/hooks/use-veterinarios';
import { Stethoscope, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Veterinario } from '@/lib/types';
import { useSession } from '@/context/session-context';

export function ActiveMedicoSelector() {
    const { user } = useSession();
    const { activeMedico, setActiveMedico, isSecretariaMode } = useActiveMedico();
    const { veterinarios, isLoading, isLoaded } = useVeterinarios();
    const [open, setOpen] = useState(false);

    // Permitir "Secretária" e "Secretária Geral". 
    // Em uma versão mais complexa, Secretária normal veria só os vinculados a ela,
    // enquanto Secretária Geral veria todos. No momento, o hook de veterinários traz os do clínica.
    const canSelect = isSecretariaMode || user?.status === 'Secretária Geral';

    if (!canSelect) {
        return null;
    }

    const medicosOrdenados = [...veterinarios].sort((a, b) => a.nome.localeCompare(b.nome));

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[200px] md:w-[250px] justify-between h-9 bg-card hover:bg-accent/50 border-primary/20 shadow-sm"
                >
                    <div className="flex items-center gap-2 truncate">
                        {isLoading && !isLoaded ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                            <Stethoscope className={cn("h-4 w-4 shrink-0", activeMedico ? "text-primary" : "text-muted-foreground")} />
                        )}
                        <span className="truncate text-sm font-medium">
                            {activeMedico ? activeMedico.nome : "Selecione o Médico..."}
                        </span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0 shadow-xl border-primary/10" align="end">
                <Command>
                    <CommandInput placeholder="Buscar médico..." className="h-9" />
                    <CommandList>
                        <CommandEmpty>Nenhum médico encontrado.</CommandEmpty>
                        <CommandGroup heading="Médicos Disponíveis">
                            {medicosOrdenados.map((medico) => (
                                <CommandItem
                                    key={medico.id}
                                    value={medico.nome}
                                    onSelect={() => {
                                        setActiveMedico(medico.id === activeMedico?.id ? null : medico);
                                        setOpen(false);
                                    }}
                                    className="cursor-pointer flex items-center justify-between"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm">{medico.nome}</span>
                                        <span className="text-[10px] text-muted-foreground uppercase">{medico.crmv}</span>
                                    </div>
                                    <Check
                                        className={cn(
                                            "h-4 w-4 text-primary",
                                            activeMedico?.id === medico.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
