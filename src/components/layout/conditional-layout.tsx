'use client';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { AuthGuard } from '@/components/auth/auth-guard';

const publicPaths = ['/login'];

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Define quais páginas devem ser renderizadas sem o layout principal
    const isPublicPage = publicPaths.includes(pathname) || pathname.startsWith('/print');

    if (isPublicPage) {
        return <>{children}</>;
    }

    // Header agora é renderizado ANTES do AuthGuard para garantir resgate se o AuthGuard travar
    return (
        <>
            <Header />
            <AuthGuard>
                <main className="container mx-auto px-4 py-8">{children}</main>
            </AuthGuard>
        </>
    );
}
