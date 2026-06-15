"use client";

import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { createClient } from '@/lib/supabase/client';
import { Pet } from '@/lib/types';
import { Loader2, Printer, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ThermalPetLabelPrintPage({ params }: { params: { id: string } }) {
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

  const identificador = pet.idRegistro && pet.idRegistro.trim() !== '' ? pet.idRegistro : pet.codPet;

  return (
    <>
      {/* 
        This style block is critical for 58x30mm thermal label printing.
      */}
      <style dangerouslySetInnerHTML={{__html: `
        @page {
          margin: 0;
        }
        html, body {
          margin: 0;
          padding: 0;
          width: 48mm;
          background: #fff;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          .thermal-label {
            width: 48mm !important;
            height: 30mm !important;
            padding: 0 !important;
            margin: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
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

      {/* Printable Thermal Label */}
      <div className="thermal-label mx-auto bg-white text-black font-mono flex flex-col items-center justify-center box-border p-1" style={{ width: '48mm', height: '30mm', overflow: 'hidden' }}>
        
        {/* Header */}
        <div className="text-center w-full mb-0.5 mt-0.5">
          <h1 className="font-bold text-[12px] leading-none uppercase tracking-widest">PetMobile</h1>
        </div>

        {/* QR Code */}
        <div className="flex justify-center items-center w-full my-0.5">
          <div className="p-[2px] bg-white inline-flex">
            <QRCodeSVG value={`PET:${pet.id}`} size={52} level="M" includeMargin={false} />
          </div>
        </div>

        {/* ID */}
        <div className="text-center w-full mt-1">
          <p className="text-[11px] font-extrabold uppercase tracking-widest">{identificador}</p>
        </div>
      </div>
    </>
  );
}
