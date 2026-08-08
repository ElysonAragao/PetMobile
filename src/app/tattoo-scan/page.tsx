"use client";

import * as React from 'react';
import { PageTitle } from '@/components/layout/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScanLine, Undo2, CheckCircle2, List, Camera, Printer } from 'lucide-react';
import Link from 'next/link';
import { TattooScannerModal } from '@/components/tattoo-scanner-modal';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/context/session-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export default function TattooScanTestPage() {
  const [isScannerOpen, setIsScannerOpen] = React.useState(false);
  const [result, setResult] = React.useState<{ tatuagem: string, fotoUrl: string | null, iaResult: string | null } | null>(null);
  
  // States para Histórico
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
  const [history, setHistory] = React.useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);

  const { selectedEmpresaId } = useSession();
  const supabase = React.useMemo(() => createClient(), []);
  const { toast } = useToast();

  const loadHistory = async () => {
    if (!selectedEmpresaId) return;
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('pet_ocr_testes')
        .select('*')
        .eq('empresa_id', selectedEmpresaId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setHistory(data || []);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro", description: "Não foi possível carregar o histórico.", variant: "destructive" });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleOpenHistory = () => {
    loadHistory();
    setIsHistoryOpen(true);
  };

  const handleSaveTest = async (tatuagemFinal: string, fotoUrl: string | null, ocrOriginal: string | null) => {
    if (!selectedEmpresaId) return;
    
    const corrigidoManualmente = (ocrOriginal !== tatuagemFinal);
    
    try {
      await supabase.from('pet_ocr_testes').insert({
        empresa_id: selectedEmpresaId,
        texto_ia: ocrOriginal || 'N/A',
        texto_final: tatuagemFinal,
        corrigido_manualmente: corrigidoManualmente,
        foto_url: fotoUrl
      });
      toast({ title: "Teste Arquivado", description: "O resultado foi salvo no banco de dados para auditoria." });
    } catch (e) {
      console.error("Erro ao salvar teste:", e);
    }
  };

  const handlePrintHistory = () => {
    window.print();
  };

  return (
    <>
      <PageTitle title="Laboratório de OCR (Tatuagem)" description="Teste o novo motor de OCR do AutoMobile adaptado para o PetMobile.">
        <Link href="/" passHref>
          <Button variant="outline"><Undo2 className="mr-2 h-4 w-4" />Voltar ao Painel</Button>
        </Link>
      </PageTitle>

      <div className="max-w-2xl mx-auto mt-8">
        <Card className="shadow-lg border-2 border-slate-100">
          <CardHeader>
            <div className="flex justify-between items-center w-full">
              <div>
                <CardTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5 text-primary" /> Teste Rápido do Scanner</CardTitle>
                <CardDescription>
                  Abra a modal, faça a captura e o sistema irá registrar automaticamente a assertividade no banco de dados.
                </CardDescription>
              </div>
              <Button variant="outline" onClick={handleOpenHistory} className="gap-2">
                <List className="w-4 h-4" />
                Ver Histórico
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 flex flex-col items-center">
            
            <Button onClick={() => setIsScannerOpen(true)} size="lg" className="w-full h-16 text-lg bg-blue-600 hover:bg-blue-700">
              <ScanLine className="mr-2 h-6 w-6" />
              Abrir Leitor de Tatuagem
            </Button>

            {result && (
              <div className="w-full bg-slate-50 p-6 rounded-xl border border-slate-200 mt-4 space-y-4 animate-in fade-in">
                <div className="flex items-center gap-2 text-emerald-600 font-bold mb-4">
                  <CheckCircle2 className="w-5 h-5" /> Resultado Final Capturado
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded border text-center">
                    <p className="text-xs text-slate-500 font-bold uppercase mb-1">Lido pela IA</p>
                    <p className="text-xl font-mono text-slate-400 line-through decoration-red-500">{result.iaResult || 'N/A'}</p>
                  </div>
                  <div className="bg-white p-4 rounded border text-center">
                    <p className="text-xs text-slate-500 font-bold uppercase mb-1">Texto Confirmado</p>
                    <p className="text-2xl font-mono font-black text-emerald-700">{result.tatuagem}</p>
                  </div>
                  <div className="bg-white p-4 rounded border text-center flex flex-col items-center">
                    <p className="text-xs text-slate-500 font-bold uppercase mb-1">Foto para Auditoria</p>
                    {result.fotoUrl ? (
                      <div className="w-16 h-16 rounded overflow-hidden border">
                        <img src={result.fotoUrl} alt="Foto" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <Camera className="w-8 h-8 text-slate-300 mt-2" />
                    )}
                  </div>
                </div>
                
                <div className="text-center mt-2">
                  {result.tatuagem === result.iaResult ? (
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200">Leitura Perfeita (IA Acertou)</span>
                  ) : (
                    <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full border border-amber-200">Corrigido Manualmente (Usuário Alterou)</span>
                  )}
                </div>
                
                <p className="text-xs text-slate-400 italic text-center mt-4">Este teste já foi gravado no banco de dados.</p>
              </div>
            )}

          </CardContent>
        </Card>
      </div>

      <TattooScannerModal 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        onConfirm={(tatuagem, fotoUrl, iaResult) => {
          setResult({ tatuagem, fotoUrl, iaResult });
          handleSaveTest(tatuagem, fotoUrl, iaResult);
        }} 
      />

      {/* HISTÓRICO DIALOG */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de Testes de Leitura</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {isLoadingHistory ? (
              <p className="text-center text-slate-500 py-8">Carregando histórico...</p>
            ) : history.length === 0 ? (
              <p className="text-center text-slate-500 py-8">Nenhum teste registrado ainda.</p>
            ) : (
              <div className="grid gap-4">
                {history.map((h) => (
                  <div key={h.id} className="flex gap-4 border rounded-xl p-4 items-center bg-slate-50">
                    <div className="w-24 h-24 shrink-0 bg-black rounded-lg overflow-hidden">
                      {h.foto_url ? (
                        <img src={h.foto_url} alt="Scan" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400">Sem Foto</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs text-slate-500">{new Date(h.created_at).toLocaleString()}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Lido pela IA</span>
                              <span className={`font-mono ${h.corrigido_manualmente ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                {h.texto_ia}
                              </span>
                            </div>
                            {h.corrigido_manualmente && (
                              <div>
                                <span className="text-[10px] uppercase font-bold text-amber-600 block">Corrigido Para</span>
                                <span className="font-mono font-bold text-amber-700">{h.texto_final}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          {h.corrigido_manualmente ? (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-1 rounded">ALTERADO</span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded">100% IA</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-between items-center w-full mt-6 pt-4 border-t border-slate-100">
            <Button variant="outline" className="gap-2" onClick={handlePrintHistory}>
              <Printer className="w-4 h-4" />
              Imprimir Histórico
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setIsHistoryOpen(false)}>
              <Undo2 className="w-4 h-4" />
              Voltar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
