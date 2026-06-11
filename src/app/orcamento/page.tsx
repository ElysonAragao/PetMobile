"use client";

import * as React from 'react';
import Link from 'next/link';
import { Calculator, ScanLine, Undo2, ArrowRight } from 'lucide-react';
import { PageTitle } from '@/components/layout/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function OrcamentoHubPage() {
  return (
    <>
      <PageTitle title="Orçamentos" description="Gerencie as estimativas financeiras para os tutores.">
        <Link href="/" passHref>
          <Button variant="outline">
            <Undo2 className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </Link>
      </PageTitle>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mt-8">
        {/* Card Novo Orçamento */}
        <Link href="/orcamento/novo" passHref className="group">
          <Card className="h-full border-2 hover:border-primary/50 transition-all hover:shadow-md cursor-pointer flex flex-col">
            <CardHeader className="pb-4">
              <div className="bg-primary/10 w-14 h-14 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Calculator className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-2xl">Novo Orçamento</CardTitle>
              <CardDescription className="text-base mt-2">
                Crie um novo orçamento selecionando exames e materiais, e gere um PDF com QR Code.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto pt-4 flex justify-end">
              <div className="flex items-center text-primary font-medium">
                Acessar <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Card Ler Orçamento */}
        <Link href="/orcamento/scan" passHref className="group">
          <Card className="h-full border-2 hover:border-blue-500/50 transition-all hover:shadow-md cursor-pointer flex flex-col">
            <CardHeader className="pb-4">
              <div className="bg-blue-50 w-14 h-14 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ScanLine className="h-7 w-7 text-blue-600" />
              </div>
              <CardTitle className="text-2xl text-blue-900">Ler Orçamento</CardTitle>
              <CardDescription className="text-base mt-2">
                Escaneie o QR Code de um orçamento impresso para visualizar as informações salvas.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto pt-4 flex justify-end">
              <div className="flex items-center text-blue-600 font-medium">
                Acessar <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </>
  );
}
