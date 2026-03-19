'use client';

import * as React from 'react';
import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import { useSession } from '@/context/session-context';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Empresa } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

export function CompanySelector() {
    const { isMaster, selectedEmpresaId, setSelectedEmpresaId } = useSession();
    const [open, setOpen] = React.useState(false);
    const [empresas, setEmpresas] = React.useState<Empresa[]>([]);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        // Only fetch if Master
        if (!isMaster) return;

        const fetchEmpresas = async () => {
            setLoading(true);
            try {
                const supabase = createClient();
                const { data: sessionData } = await supabase.auth.getSession();
                const token = sessionData.session?.access_token;

                if (!token) return;

                const response = await fetch('/api/admin?resource=empresas', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                const result = await response.json();
                if (response.ok && result.data) {
                    setEmpresas(result.data);

                    // Se não houver nenhuma empresa selecionada e houver alguma na lista, seleciona a primeira por padrão
                    if (!selectedEmpresaId && result.data.length > 0) {
                        setSelectedEmpresaId(result.data[0].id);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch empresas for selector', error);
            } finally {
                setLoading(false);
            }
        };

        fetchEmpresas();
    }, [isMaster]); // eslint-disable-next-line react-hooks/exhaustive-deps

    if (!isMaster) return null;

    const selectedEmpresa = empresas.find(e => e.id === selectedEmpresaId);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[200px] justify-between text-muted-foreground bg-muted/50 border-dashed truncate max-w-[140px] md:max-w-[200px]"
                >
                    <Building2 className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                    <span className="truncate">
                        {selectedEmpresa ? selectedEmpresa.nome_fantasia : (loading ? "Carregando..." : "Selecione a Clínica...")}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0">
                <Command>
                    <CommandInput placeholder="Buscar clínica..." />
                    <CommandList>
                        <CommandEmpty>Nenhuma clínica encontrada.</CommandEmpty>
                        <CommandGroup>
                            {empresas.map((empresa) => (
                                <CommandItem
                                    key={empresa.id}
                                    value={empresa.nome_fantasia}
                                    onSelect={() => {
                                        setSelectedEmpresaId(empresa.id);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            selectedEmpresaId === empresa.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <span className="truncate">{empresa.nome_fantasia}</span>
                                    <span className="ml-auto text-xs text-muted-foreground">{empresa.codigo}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
