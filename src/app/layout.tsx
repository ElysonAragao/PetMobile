import type { Metadata } from 'next';
import { PT_Sans } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { SessionProvider } from '@/context/session-context';
import { ConditionalLayout } from '@/components/layout/conditional-layout';
import { Toaster } from "@/components/ui/toaster";

const ptSans = PT_Sans({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-pt-sans',
});

export const metadata: Metadata = {
  title: 'PetMobile',
  description: 'Gestão de Pacientes e Exames',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <head>
          <script dangerouslySetInnerHTML={{
              __html: `
              (function() {
                  window.reactHealthy = false;
                  
                  // Função de limpeza bruta que não depende do React
                  window.hardResetApp = function() {
                      if (confirm('RESTAURAR SISTEMA: Deseja limpar os dados e voltar ao Login?')) {
                          localStorage.clear();
                          sessionStorage.clear();
                          document.cookie.split(";").forEach(c => {
                              document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
                          });
                          window.location.replace('/login?reset=' + Date.now());
                      }
                  };

                  // Monitor de Travamento Inicial
                  setTimeout(function() {
                      if (!window.reactHealthy && !window.location.pathname.includes('/login')) {
                          var bar = document.createElement('div');
                          bar.id = 'rescue-bar';
                          bar.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:#ef4444;color:white;padding:12px;text-align:center;z-index:9999;font-weight:bold;cursor:pointer;font-family:sans-serif;box-shadow:0 2px 10px rgba(0,0,0,0.3);';
                          bar.innerHTML = '⚠️ SISTEMA TRAVADO? CLIQUE AQUI PARA REINICIAR';
                          bar.onclick = window.hardResetApp;
                          document.body.appendChild(bar);
                      }
                  }, 6000); // 6 segundos de tolerância
              })();
              `
          }} />
      </head>
      <body
        className={cn(
          'min-h-screen bg-background font-body antialiased',
          ptSans.variable
        )}
      >
        <SessionProvider>
          <ConditionalLayout>{children}</ConditionalLayout>
        </SessionProvider>
        <Toaster />
        
        {/* Script para avisar que o React montou */}
        <script dangerouslySetInnerHTML={{
            __html: 'window.reactHealthy = true; if(document.getElementById("rescue-bar")) document.getElementById("rescue-bar").style.display="none";'
        }} />
      </body>
    </html>
  );
}
