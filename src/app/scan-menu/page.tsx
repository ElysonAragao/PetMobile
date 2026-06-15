"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PawPrint, PackageOpen, ArrowRight, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/layout/page-title";

export default function ScanMenu() {
  const options = [
    {
      title: "Ler QR Code do Pet",
      description: "Identifique um animal cadastrado usando seu QR Code.",
      href: "/scan-pet",
      icon: <PawPrint className="h-8 w-8 text-primary" />,
    },
    {
      title: "Ler QR Code do Material",
      description: "Identifique e verifique dados de um material.",
      href: "/scan-material",
      icon: <PackageOpen className="h-8 w-8 text-primary" />,
    },
  ];

  return (
    <>
      <PageTitle title="Selecione o tipo de Leitura" description="Escolha o tipo de QR Code que deseja escanear.">
        <Button variant="outline" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Menu
          </Link>
        </Button>
      </PageTitle>
      
      <div className="container mx-auto p-4 max-w-4xl mt-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        {options.map((option) => (
          <Link href={option.href} key={option.title} className="group">
            <Card className="h-full hover:border-primary transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md cursor-pointer">
              <CardHeader className="flex flex-row items-center gap-4">
                {option.icon}
                <CardTitle className="text-xl font-headline">{option.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-between items-center">
                <p className="text-muted-foreground">{option.description}</p>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors ml-4 shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
        </div>
      </div>
    </>
  );
}
