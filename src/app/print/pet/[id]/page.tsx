"use client";

import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { createClient } from '@/lib/supabase/client';
import { Pet } from '@/lib/types';
import { Loader2, Printer, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function ThermalPetBadgePrintPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClient();
  const [pet, setPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPet() {
      if (!params.id) return;
      try {
        const { data, error } = await supabase
          .from('pet_pets')
          .select('*')
          .eq('id', params.id)
          .single();

        if (error) throw error;

        // Map DB to Pet type
        setPet({
          id: data.id,
          nome: data.nome,
          especie: data.especie,
          raca: data.raca,
          sexo: data.sexo,
          idade: data.idade,
          dataNascimento: data.data_nascimento,
          tutorNome: data.tutor_nome,
          tutorCpf: data.tutor_cpf,
          tutorTelefone: data.tutor_telefone,
          tutorEmail: data.tutor_email,
          tutorEndereco: data.tutor_endereco,
          codPet: data.cod_pet,
          idRegistro: data.id_registro
        } as Pet);
      } catch (e) {
        console.error("Erro ao carregar pet:", e);
      } finally {
        setLoading(false);
      }
    }
    loadPet();
  }, [params.id, supabase]);

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    // A impressão será chamada pelo onLoad do QR Code se fosse imagem,
    // mas como voltamos pro SVG, podemos usar um timeout bem curto.
    if (pet) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pet]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-slate-800" />
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-white gap-4">
        <p className="font-bold text-red-500">Pet não encontrado.</p>
        <Button onClick={() => window.close()}><ArrowLeft className="w-4 h-4 mr-2"/> Fechar</Button>
      </div>
    );
  }

  return (
    <>
      {/* 
        This style block is critical for 58mm thermal printing. 
        It forces the page to act like a continuous roll with ~48mm printable area.
        Hides UI buttons when printing.
      */}
      <style dangerouslySetInnerHTML={{__html: `
        @page {
          margin: 0;
        }
        body {
          margin: 0;
          padding: 0;
          width: 48mm;
          background: #fff;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          .thermal-container {
            width: 48mm !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}} />

      {/* Control UI (Not Printed) */}
      <div className="no-print fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-3 bg-white p-4 rounded-full shadow-2xl border border-slate-200 z-50">
        <Button variant="outline" onClick={() => window.close()} className="rounded-full">
          <ArrowLeft className="w-4 h-4 mr-2" /> Fechar Aba
        </Button>
        <Button onClick={handlePrint} className="rounded-full bg-slate-800 hover:bg-slate-900 text-white shadow-lg">
          <Printer className="w-4 h-4 mr-2" /> Imprimir Agora
        </Button>
      </div>

      {/* Printable Thermal Container (48mm is the printable width of a 58mm roll) */}
      <div className="thermal-container mx-auto bg-white text-black font-mono text-sm leading-tight flex flex-col items-center pb-8" style={{ width: '48mm', boxSizing: 'border-box' }}>
        
        {/* Header */}
        <div className="text-center w-full border-b border-black border-dashed pb-2 mb-2 pt-2">
          <h1 className="font-bold text-lg leading-none uppercase">PetMobile</h1>
          <p className="text-[10px] mt-1">Crachá de Identificação</p>
        </div>

        {/* QR Code */}
        <div className="my-2 w-full flex justify-center bg-white">
          <div className="p-1 border border-black bg-white inline-flex">
            <QRCodeSVG value={`PET:${pet.id}`} size={120} level="M" includeMargin={false} />
          </div>
        </div>

        {/* Pet Basic Info */}
        <div className="text-center w-full mt-1 mb-3">
          <h2 className="font-black text-xl uppercase tracking-tighter leading-none">{pet.nome}</h2>
          <p className="text-sm font-bold mt-1 tracking-widest">{pet.codPet || 'N/A'}</p>
        </div>

        {/* Details Grid */}
        <div className="w-full text-xs space-y-1.5 border-t border-b border-black border-dashed py-2 mb-2">
          <div>
            <span className="font-bold">Espécie:</span> <span className="ml-1">{pet.especie || '-'}</span>
          </div>
          <div>
            <span className="font-bold">Raça:</span> <span className="ml-1 truncate">{pet.raca || '-'}</span>
          </div>
          <div>
            <span className="font-bold">Sexo:</span> <span className="ml-1">{pet.sexo === 'M' ? 'Macho' : pet.sexo === 'F' ? 'Fêmea' : '-'}</span>
          </div>
          {pet.dataNascimento && (
             <div className="flex justify-between">
               <span className="font-bold">Nasc:</span>
               <span>{new Date(pet.dataNascimento).toLocaleDateString('pt-BR')}</span>
             </div>
          )}
          {pet.idRegistro && (
            <div className="flex justify-between">
              <span className="font-bold">Tatuagem:</span>
              <span>{pet.idRegistro}</span>
            </div>
          )}
        </div>

        {/* Tutor Info */}
        <div className="w-full text-xs space-y-1 mt-1">
          <p className="font-bold text-center border-b border-black border-solid pb-1 mb-1">TUTOR RESPONSÁVEL</p>
          <p className="font-bold uppercase truncate">{pet.tutorNome}</p>
          <p className="text-[11px]">CPF: {pet.tutorCpf}</p>
          <p className="text-[11px] font-bold">Tel: {pet.tutorTelefone}</p>
        </div>

        {/* Footer */}
        <div className="text-center w-full mt-4 text-[9px] text-gray-800">
          <p>Leia o QR Code pelo app</p>
          <p>para acessar o prontuário.</p>
        </div>
      </div>
    </>
  );
}
