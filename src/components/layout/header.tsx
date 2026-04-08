'use client';
import Link from 'next/link';
import * as React from 'react';
import { Stethoscope, LogOut, Power, RefreshCw } from 'lucide-react';
import { useSession } from '@/context/session-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CompanySelector } from './company-selector';

declare global {
  interface Window {
    reactHealthy: boolean;
    hardResetApp: () => void;
  }
}

export function Header() {
  const { user, logout, isLoading } = useSession();
  const [mounted, setMounted] = React.useState(false);
  
  // Controle de clique pânico localmente no logotipo
  const [panicClicks, setPanicClicks] = React.useState(0);
  const [lastClick, setLastClick] = React.useState(0);

  // Informamos ao monitor de pânico que o React está vivo e marcamos como montado
  React.useEffect(() => {
    setMounted(true);
    window.reactHealthy = true;
  }, []);

  if (!mounted) {
    return (
      <header className="bg-card/95 backdrop-blur-md border-b sticky top-0 z-[100] w-full shadow-md select-none">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold font-headline tracking-tighter text-primary">PetMobile</span>
          </div>
        </div>
      </header>
    );
  }

  const handleLogoClick = () => {
    const now = Date.now();
    if (now - lastClick < 600) {
      const newCount = panicClicks + 1;
      if (newCount >= 6) {
        setPanicClicks(0);
        window.hardResetApp && window.hardResetApp();
      } else {
        setPanicClicks(newCount);
      }
    } else {
      setPanicClicks(1);
    }
    setLastClick(now);
  };

  const getInitials = (n?: string) => {
    if (!n) return "??";
    // Pegamos a primeira letra do primeiro e do último nome (se houver)
    const parts = n.trim().split(/\s+/);
    if (parts.length === 0) return "??";
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  return (
    <header className="bg-card/95 backdrop-blur-md border-b sticky top-0 z-[100] w-full shadow-md select-none">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div 
            onClick={handleLogoClick} 
            className="flex items-center gap-2 cursor-pointer active:scale-95 transition-transform"
            title="Clique 6 vezes seguidas para Restaurar o Sistema"
        >
          <Stethoscope className="w-6 h-6 text-primary" />
          <span className="text-xl font-bold font-headline tracking-tighter text-primary">PetMobile</span>
          <span className="text-[10px] opacity-30 font-mono">v2.8</span>
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden border border-destructive/20 text-destructive h-10 w-10 active:bg-destructive/10" 
                onClick={() => {
                    if (confirm("Deseja realmente sair?")) {
                        // Tentamos o logout do React, mas se falhar, o usuário pode usar o Pânico
                        logout();
                    }
                }}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          )}

          <div className="hidden md:block">
            <CompanySelector />
          </div>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 w-10 p-0 rounded-full border shadow-sm">
                  <Avatar className="h-full w-full">
                    <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">{getInitials(user.nome)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-center">
                  <p className="font-bold text-sm truncate">{user.nome}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{user.status}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link href="/">Início</Link></DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem 
                    className="text-amber-600 font-semibold"
                    onClick={() => window.hardResetApp && window.hardResetApp()}
                >
                    <RefreshCw className="mr-2 h-4 w-4" /> Restaurar App
                </DropdownMenuItem>

                <DropdownMenuItem 
                    onClick={() => confirm("Sair?") && logout()} 
                    className="text-destructive font-bold"
                >
                  <Power className="mr-2 h-4 w-4" /> Sair do Sistema
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : !isLoading && (
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/login'}>Entrar</Button>
          )}
        </div>
      </div>
    </header>
  );
}
