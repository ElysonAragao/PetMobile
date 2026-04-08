"use client";

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/context/session-context';
import { Loader2, RefreshCw, Smartphone, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

const publicPaths = ['/login', '/setup'];

const roleRoutes: Record<string, string[]> = {
    'Master': ['*'],
    'Administrador': ['*'],
    'Administrador Auxiliar': ['*'],
    'Supervisor': ['*'],
    'Secretária': ['/pets', '/print'],
    'Secretária Geral': ['/pets', '/print'],
    'Veterinário': ['/movement', '/pets', '/print'],
    'Veterinário Geral': ['/movement', '/pets', '/print'],
    'Médico': ['/movement', '/pets', '/print'],
    'MedicoVet': ['/movement', '/pets', '/print'],
    'MedicoVet Geral': ['/movement', '/pets', '/print'],
    'Medico': ['/movement', '/pets', '/print'],
    'Leitor': ['/scan', '/print'],
    'Leitor Geral': ['/scan', '/print'],
    'Relatórios': ['/leituras', '/print'],
};

function isRouteAllowed(userStatus: string | undefined, pathname: string): boolean {
    if (!userStatus) return false;
    const allowedRoutes = roleRoutes[userStatus] || [];
    if (!allowedRoutes.length) return false;
    if (allowedRoutes.includes('*')) return true;
    if (pathname === '/') return true;
    return allowedRoutes.some(route => pathname.startsWith(route));
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { isLoading, isAuthenticated, user, logout } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const [showRecovery, setShowRecovery] = React.useState(false);

    const isPublic = publicPaths.includes(pathname) || pathname.startsWith('/print');

    // Temporizador de segurança para falhas de rede no mobile
    React.useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isLoading) {
            timer = setTimeout(() => {
                setShowRecovery(true);
            }, 8000); // 8 segundos de espera antes de sugerir recuperação
        } else {
            setShowRecovery(false);
        }
        return () => clearTimeout(timer);
    }, [isLoading]);

    React.useEffect(() => {
        if (isLoading) return;

        console.log(`AuthGuard - Estado: auth=${isAuthenticated}, path=${pathname}, userRole=${user?.status}`);

        if (isAuthenticated && isPublic && !pathname.startsWith('/print')) {
            console.log("Usuário autenticado em rota pública. Redirecionando para /...");
            router.replace('/');
        } else if (!isAuthenticated && !isPublic) {
            console.log("Usuário não autenticado em rota privada. Redirecionando para /login...");
            router.replace('/login');
        } else if (isAuthenticated && pathname.startsWith('/admin') && user?.status !== 'Master') {
            console.log("Acesso negado ao Admin. Redirecionando para /...");
            router.replace('/');
        } else if (isAuthenticated && user && !isPublic && !isRouteAllowed(user.status, pathname)) {
            console.log(`Permissão negada para o perfil ${user.status} na rota ${pathname}. Redirecionando para /...`);
            router.replace('/');
        }
    }, [isLoading, isAuthenticated, pathname, router, isPublic, user]);

    if (pathname.startsWith('/print')) {
        return <>{children}</>;
    }

    if (isLoading || (!isAuthenticated && !isPublic)) {
        return (
            <div className="flex flex-col min-h-[80vh] w-full items-center justify-center p-6 text-center animate-in fade-in duration-500">
                <div className="flex flex-col items-center gap-8 max-w-sm">
                    <div className="relative">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <Smartphone className="h-5 w-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    
                    <div className="space-y-3">
                        <p className="text-2xl font-bold font-headline">Sincronizando Sessão</p>
                        <p className="text-muted-foreground text-sm px-4">
                            Estamos validando seu acesso médico com segurança. Por favor, aguarde...
                        </p>
                    </div>

                    {showRecovery && (
                        <div className="mt-6 p-5 border-2 border-destructive/30 bg-destructive/5 rounded-xl space-y-5 shadow-inner">
                            <div className="flex items-center justify-center gap-2 text-destructive">
                                <ShieldAlert className="h-5 w-5" />
                                <span className="font-bold text-sm uppercase tracking-wider">Acesso Travado?</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Detectamos uma lentidão incomum na sua conexão ou no navegador do celular.
                            </p>
                            <Button 
                                variant="destructive" 
                                onClick={() => logout()}
                                className="w-full h-12 font-bold shadow-md active:scale-95 transition-all"
                            >
                                <RefreshCw className="mr-2 h-4 w-4" /> FORÇAR RESET DO APP
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
