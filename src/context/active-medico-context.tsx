"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSession } from './session-context';
import { Veterinario } from '@/lib/types';

interface ActiveMedicoContextType {
    activeMedico: Veterinario | null;
    setActiveMedico: (medico: Veterinario | null) => void;
    isSecretariaMode: boolean;
}

const ActiveMedicoContext = createContext<ActiveMedicoContextType | undefined>(undefined);

export function ActiveMedicoProvider({ children }: { children: React.ReactNode }) {
    const { user } = useSession();
    const [activeMedico, setActiveMedico] = useState<Veterinario | null>(null);

    // Persist active medico across reloads for UX
    useEffect(() => {
        const stored = localStorage.getItem('active-medico');
        if (stored) {
            try {
                setActiveMedico(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse stored active-medico", e);
            }
        }
    }, []);

    const handleSetActiveMedico = (medico: Veterinario | null) => {
        setActiveMedico(medico);
        if (medico) {
            localStorage.setItem('active-medico', JSON.stringify(medico));
        } else {
            localStorage.removeItem('active-medico');
        }
    };

    // Reseta o médico ativo se o usuário mudar ou deslogar
    useEffect(() => {
        if (!user) {
            handleSetActiveMedico(null);
        }
    }, [user]);

    const isSecretariaMode = user?.status === 'Secretária';

    return (
        <ActiveMedicoContext.Provider value={{
            activeMedico,
            setActiveMedico: handleSetActiveMedico,
            isSecretariaMode
        }}>
            {children}
        </ActiveMedicoContext.Provider>
    );
}

export function useActiveMedico() {
    const context = useContext(ActiveMedicoContext);
    if (context === undefined) {
        throw new Error('useActiveMedico must be used within an ActiveMedicoProvider');
    }
    return context;
}
