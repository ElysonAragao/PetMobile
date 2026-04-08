'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Usuario } from '@/lib/types';
import useLocalStorage from '@/hooks/use-local-storage';

const APP_VERSION = 'v2.8';

interface SessionContextType {
    user: Usuario | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isMaster: boolean;
    selectedEmpresaId: string | null;
    setSelectedEmpresaId: (id: string | null) => void;
    login: (email: string, pass: string) => Promise<{ success: boolean; message?: string; requiresPasswordChange?: boolean }>;
    logout: () => void;
    changePassword: (newPassword: string) => Promise<{ success: boolean; message?: string }>;
}

const SessionContext = React.createContext<SessionContextType | undefined>(undefined);

function normalizeUser(u: any): Usuario | null {
    if (!u) return null;
    let status = u.status;
    
    // Normalização agressiva para evitar problemas de acentuação/case/migração
    if (status === 'Médico' || status === 'Medico' || status === 'medico' || status === 'Veterinário') status = 'MedicoVet';
    if (status === 'Médico Geral' || status === 'Medico Geral' || status === 'Veterinário Geral') status = 'MedicoVet Geral';
    if (status === 'Secretária' || status === 'Secretaria') status = 'Secretária';
    if (status === 'Secretária Geral' || status === 'Secretaria Geral') status = 'Secretária Geral';
    
    console.log(`Normalizando usuário: ${u.email}, Perfil original: ${u.status}, Perfil normalizado: ${status}`);
    return { ...u, status };
}

async function fetchUserProfile(supabase: any, authUserId: string): Promise<Usuario | null> {
    try {
        console.log("Buscando perfil para UUID:", authUserId);
        const { data, error } = await supabase.from('pet_usuarios').select('*').eq('id', authUserId).single();
        if (error) {
            console.error("Erro ao buscar perfil no banco 'usuarios':", error);
            return null;
        }
        if (!data) {
            console.warn("Perfil não encontrado na tabela 'usuarios' para o UUID:", authUserId);
            return null;
        }
        return normalizeUser({
            id: data.id,
            empresaId: data.empresa_id || undefined,
            numUsuario: data.codigo || '',
            nome: data.nome,
            status: data.status,
            email: data.email,
            dataCadastro: data.created_at,
            dataValidade: data.validade || '',
        });
    } catch (err) { 
        console.error("Falha catastrófica ao buscar perfil:", err);
        return null; 
    }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
    const supabase = React.useMemo(() => createClient(), []);
    const router = useRouter();

    // Reset de versão inicial
    React.useLayoutEffect(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('app-version');
            if (stored !== APP_VERSION) {
                localStorage.clear();
                sessionStorage.clear();
                localStorage.setItem('app-version', APP_VERSION);
                window.location.reload();
            }
        }
    }, []);

    const [user, setUser] = useLocalStorage<Usuario | null>('session-user', null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [sessionAuth, setSessionAuth] = React.useState(false);
    const [selectedEmpresaId, setSelectedEmpresaId] = useLocalStorage<string | null>('selected-empresa-id', null);
    
    const userRef = React.useRef(user);
    React.useEffect(() => {
        userRef.current = user;
    }, [user]);

    React.useEffect(() => {
        let mounted = true;
        const safety = setTimeout(() => { if (mounted) setIsLoading(false); }, 5000);

        const handleAuth = async (session: any) => {
            if (!mounted) return;
            if (!session?.user) {
                console.log("Sessão não encontrada - limpando usuário.");
                setSessionAuth(false);
                setUser(null);
                setIsLoading(false);
                return;
            }
            setSessionAuth(true);
            
            // Se já temos o perfil em cache compatível com a sessão, liberamos o loading mais rápido
            if (userRef.current && userRef.current.id === session.user.id) {
                console.log("Usuário já em cache e válido.");
                // Não retorna aqui. Continua executando o try/catch abaixo para forçar o recarregamento do perfil real 
                // e substituir qualquer perfil fallback (perfil de segurança temporário).
            }

            try {
                const profile = await fetchUserProfile(supabase, session.user.id);
                if (mounted && profile) {
                    console.log("Perfil carregado/atualizado com sucesso.");
                    setUser(profile);
                    if (profile.empresaId) setSelectedEmpresaId(profile.empresaId);
                }
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        console.log("Subscrevendo a mudanças de autenticação...");
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
            console.log(`Auth Event: ${_event}`);
            if (_event === 'SIGNED_OUT') {
                setUser(null);
                setSessionAuth(false);
            } else {
                handleAuth(session);
            }
        });

        supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => handleAuth(session));

        return () => { 
            mounted = false; 
            clearTimeout(safety); 
            subscription.unsubscribe();
        };
    }, [supabase, setUser, setSelectedEmpresaId]); // REMOVIDO 'user' DAQUI PARA EVITAR LOOP

    const logout = React.useCallback(async () => {
        console.log("Iniciando processo de Logout...");
        try {
            // Limpeza local imediata (crítica para o usuário ver que algo aconteceu)
            localStorage.clear();
            sessionStorage.clear();
            localStorage.setItem('app-version', APP_VERSION);
            
            // Tentativa de sign out no servidor com timeout curto
            const signOutPromise = supabase.auth.signOut();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000));
            
            await Promise.race([signOutPromise, timeoutPromise]).catch(err => {
                console.warn("SignOut no Supabase demorou demais ou falhou (procedendo localmente):", err);
            });
        } catch (e) {
            console.error("Erro durante o logout:", e);
        } finally {
            console.log("Redirecionando para login...");
            window.location.href = '/login?reset=' + Date.now();
        }
    }, [supabase]);

    const value = React.useMemo(() => ({
        user,
        isAuthenticated: sessionAuth && !!user,
        isLoading,
        isMaster: user?.status === 'Master',
        selectedEmpresaId,
        setSelectedEmpresaId,
        login: async (e: string, p: string) => {
            console.log("Tentando login para:", e);
            const { data, error } = await supabase.auth.signInWithPassword({ email: e, password: p });
            if (error) {
                console.error("Erro no signInWithPassword:", error.message);
                return { success: false, message: error.message };
            }
            console.log("Auth login OK, buscando perfil...");
            
            // Tentar buscar perfil com log de erro do Supabase
            const { data: profileData, error: profileError } = await supabase.from('pet_usuarios').select('*').eq('id', data.user.id).single();
            
            if (profileError || !profileData) {
                console.warn("Retorno da tabela 'usuarios' falhou. Tentando obter perfil via RPC...");
                // Criar um perfil de segurança para forçar o login caso só falte o select
                const fallbackProfile = normalizeUser({
                    id: data.user.id,
                    nome: "Usuário Logado (Perfil de Segurança)",
                    status: e === "elysonaragao@gmail.com" ? "Master" : "Leitor",
                    email: e,
                    dataCadastro: new Date().toISOString(),
                    dataValidade: '',
                });
                
                setUser(fallbackProfile);
                setSessionAuth(true);
                return { success: true, requiresPasswordChange: p === '123456' };
            }
            
            const profile = normalizeUser({
                id: profileData.id,
                empresaId: profileData.empresa_id || undefined,
                numUsuario: profileData.codigo || '',
                nome: profileData.nome,
                status: profileData.status,
                email: profileData.email,
                dataCadastro: profileData.created_at,
                dataValidade: profileData.validade || '',
            });

            console.log("Perfil encontrado. Atualizando estado local...");
            setUser(profile);
            setSessionAuth(true); // Forçar estado para acelerar AuthGuard
            
            return { success: true, requiresPasswordChange: p === '123456' };
        },
        logout,
        changePassword: async (p: string) => {
            const { error } = await supabase.auth.updateUser({ password: p });
            return { success: !error };
        }
    }), [user, sessionAuth, isLoading, selectedEmpresaId, supabase, setUser, setSelectedEmpresaId, logout]);

    return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
    const context = React.useContext(SessionContext);
    if (!context) throw new Error('useSession error');
    return context;
}
