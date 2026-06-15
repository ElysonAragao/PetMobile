"use client";

import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { createClient } from '@/lib/supabase/client';
import { Material } from '@/lib/types';
import { Loader2, Printer, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ThermalMaterialPrintPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMaterial() {
      if (!params.id) return;
      try {
        const { data, error } = await supabase
          .from('pet_materiais')
          .select('*')
          .eq('id', params.id)
          .single();

        if (error) throw error;

        setMaterial({
          id: data.id,
          codigo: data.codigo,
          idMaterial: data.id_material,
          descricao: data.descricao,
          categoria: data.categoria,
          unidade: data.unidade,
          estoque: data.estoque,
          precoUnitario: data.preco_unitario
        } as Material);
      } catch (e) {
        console.error("Erro ao carregar material:", e);
      } finally {
        setLoading(false);
      }
    }
    loadMaterial();
  }, [params.id, supabase]);

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    if (material) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [material]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-slate-800" />
      </div>
    );
  }

  if (!material) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-white gap-4">
        <p className="font-bold text-red-500">Material não encontrado.</p>
        <Button onClick={() => window.close()}><ArrowLeft className="w-4 h-4 mr-2"/> Fechar</Button>
      </div>
    );
  }

  return (
    <>
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

      <div className="no-print fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-3 bg-white p-4 rounded-full shadow-2xl border border-slate-200 z-50">
        <Button variant="outline" onClick={() => window.close()} className="rounded-full">
          <ArrowLeft className="w-4 h-4 mr-2" /> Fechar Aba
        </Button>
        <Button onClick={handlePrint} className="rounded-full bg-slate-800 hover:bg-slate-900 text-white shadow-lg">
          <Printer className="w-4 h-4 mr-2" /> Imprimir Agora
        </Button>
      </div>

      <div className="thermal-container mx-auto bg-white text-black font-mono text-sm leading-tight flex flex-col items-center pb-8" style={{ width: '48mm', boxSizing: 'border-box' }}>
        
        <div className="text-center w-full border-b border-black border-dashed pb-2 mb-2 pt-2">
          <h1 className="font-bold text-lg leading-none uppercase">PetMobile</h1>
          <p className="text-[10px] mt-1">Identificação de Material</p>
        </div>

        <div className="my-2 w-full flex justify-center bg-white">
          <div className="p-1 border border-black bg-white inline-flex">
            <QRCodeSVG value={`MAT:${material.id}`} size={120} level="M" includeMargin={false} />
          </div>
        </div>

        <div className="text-center w-full mt-1 mb-3">
          <h2 className="font-black text-lg uppercase tracking-tighter leading-tight break-words">{material.descricao}</h2>
          <p className="text-sm font-bold mt-1 tracking-widest">{material.codigo || 'N/A'}</p>
        </div>

        <div className="w-full text-xs space-y-1.5 border-t border-b border-black border-dashed py-2 mb-2">
          <div>
            <span className="font-bold">ID Mat:</span> <span className="ml-1">{material.idMaterial || '-'}</span>
          </div>
          <div>
            <span className="font-bold">Categ:</span> <span className="ml-1">{material.categoria || '-'}</span>
          </div>
          <div>
            <span className="font-bold">Unid:</span> <span className="ml-1">{material.unidade || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">Preço:</span>
            <span>R$ {material.precoUnitario.toFixed(2)}</span>
          </div>
        </div>

        <div className="text-center w-full mt-4 text-[9px] text-gray-800">
          <p>Leia o QR Code pelo app</p>
          <p>para gerenciar o estoque.</p>
        </div>
      </div>
    </>
  );
}
