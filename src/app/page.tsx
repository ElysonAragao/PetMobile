"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ArrowRight, FileText, UserPlus, Stethoscope, HeartPulse, UserCog, Send, Scan, ClipboardList, Shield } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/context/session-context';
import { useEffect, Suspense } from 'react';

function HomeContent() {
  const { user } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // 1. Pulo duplo de navegação: se a URL pedir, vai para o /movement direto.
    if (searchParams.get('redirect') === 'movement') {
      router.replace('/movement');
    }

    // 2. Se houver um 'reset' vindo do PDF ou similar, limpamos os estados temporários 
    // de movimentação para garantir que a próxima guia comece do zero.
    if (searchParams.get('reset')) {
        console.log("Detectado retorno de PDF - limpando memória local...");
        localStorage.removeItem('movement-generated-guide');
        // Removemos o parâmetro da URL de forma silenciosa
        router.replace('/', { scroll: false });
    }
  }, [searchParams, router]);

  type UserRole = 'Master' | 'Administrador' | 'Administrador Auxiliar' | 'Supervisor' | 'Secretária' | 'Secretária Geral' | 'Médico' | 'Medico' | 'Medico Geral' | 'Leitor' | 'Leitor Geral' | 'Relatórios';

  const features: { title: string; description: string; href: string; icon: React.ReactNode; roles: UserRole[] }[] = [
    {
      title: 'Painel Master',
      description: 'Gerencie empresas, crie contas e controle o sistema.',
      href: '/admin',
      icon: <Shield className="h-8 w-8 text-red-500" />,
      roles: ['Master'],
    },
    {
      title: 'Cadastro de Pacientes',
      description: 'Adicione e gerencie os dados dos pacientes.',
      href: '/patients',
      icon: <UserPlus className="h-8 w-8 text-primary" />,
      roles: ['Master', 'Administrador', 'Administrador Auxiliar', 'Supervisor', 'Secretária'],
    },
    {
      title: 'Cadastro de Exames',
      description: 'Defina os tipos de exames disponíveis.',
      href: '/exams',
      icon: <FileText className="h-8 w-8 text-primary" />,
      roles: ['Master', 'Administrador', 'Administrador Auxiliar', 'Supervisor'],
    },
    {
      title: 'Cadastro de Médicos',
      description: 'Adicione e gerencie os médicos do sistema.',
      href: '/medicos',
      icon: <Stethoscope className="h-8 w-8 text-primary" />,
      roles: ['Master', 'Administrador', 'Administrador Auxiliar', 'Supervisor'],
    },
    {
      title: 'Cadastro de Planos de Saúde',
      description: 'Gerencie os planos e convênios disponíveis.',
      href: '/planos-saude',
      icon: <HeartPulse className="h-8 w-8 text-primary" />,
      roles: ['Master', 'Administrador', 'Administrador Auxiliar', 'Supervisor'],
    },
    {
      title: 'Movimentação',
      description: 'Gere guias de exames com QR Code para pacientes.',
      href: '/movement',
      icon: <Send className="h-8 w-8 text-primary" />,
      roles: ['Master', 'Administrador', 'Administrador Auxiliar', 'Supervisor', 'Médico', 'Medico', 'Medico Geral'],
    },
    {
      title: 'Leitura de QR Code',
      description: 'Leia uma guia de exame usando a câmera.',
      href: '/scan',
      icon: <Scan className="h-8 w-8 text-primary" />,
      roles: ['Master', 'Administrador', 'Administrador Auxiliar', 'Supervisor', 'Leitor', 'Leitor Geral'],
    },

    {
      title: 'Relatórios',
      description: 'Relatórios e extração de dados do sistema.',
      href: '/reports',
      icon: <ClipboardList className="h-8 w-8 text-primary" />,
      roles: ['Master', 'Administrador', 'Administrador Auxiliar', 'Supervisor', 'Relatórios'],
    },
    {
      title: 'Gerenciar Usuários',
      description: 'Adicione e controle os usuários do sistema.',
      href: '/users',
      icon: <UserCog className="h-8 w-8 text-primary" />,
      roles: ['Master', 'Administrador', 'Administrador Auxiliar', 'Supervisor'],
    }
  ];

  const userRole = user?.status as UserRole | undefined;
  const visibleFeatures = features.filter(feature => userRole && feature.roles.includes(userRole));

  return (
    <div className="flex flex-col items-center text-center p-4">
      <h1 className="text-4xl font-bold font-headline tracking-tight mb-4">
        Bem-vindo ao PacienteMobile
      </h1>
      <p className="text-lg text-muted-foreground max-w-2xl mb-12">
        Sua solução integrada para gestão de pacientes e exames, simplificando o fluxo de atendimento com a geração de QR Codes.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-6xl">
        {visibleFeatures.map((feature) => (
          <Link href={feature.href} key={feature.title} className="group">
            <Card className="h-full text-left hover:border-primary transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-4">
                  {feature.icon}
                  <CardTitle className="text-xl font-semibold font-headline">
                    {feature.title}
                  </CardTitle>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="flex justify-center p-12 text-muted-foreground">Carregando painel...</div>}>
      <HomeContent />
    </Suspense>
  );
}
