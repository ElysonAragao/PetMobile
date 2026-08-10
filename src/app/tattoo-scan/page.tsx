"use client";

import * as React from 'react';
import { PageTitle } from '@/components/layout/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScanLine, Undo2, CheckCircle2, List, Camera, Printer, Activity, Database, Loader2, Trash2, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { TattooScannerModal } from '@/components/tattoo-scanner-modal';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/context/session-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function TattooScanTestPage() {
  const [isScannerOpen, setIsScannerOpen] = React.useState(false);
  const [recentResults, setRecentResults] = React.useState<Array<{ id?: string, tatuagem: string, fotoUrl: string | null, iaResult: string | null }>>([]);
  
  // States para Histórico
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
  const [history, setHistory] = React.useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);

  const { selectedEmpresaId, user } = useSession();
  const supabase = React.useMemo(() => createClient(), []);
  const { toast } = useToast();
  const router = useRouter();
  const [isCheckingTattoo, setIsCheckingTattoo] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);

  const canAccessProntuario = user?.status === 'Administrador' || user?.status === 'MedicoVet' || user?.status === 'MedicoVet Geral' || user?.status === 'Master';

  const handleDeleteTest = async (id: string | undefined) => {
    if (!id || !selectedEmpresaId) return;
    setIsDeleting(id);
    try {
      const { error } = await supabase.from('pet_ocr_testes').delete().eq('id', id).eq('empresa_id', selectedEmpresaId);
      if (error) throw error;
      toast({ title: "Registro Apagado", description: "O teste de leitura foi removido." });
      setRecentResults(prev => prev.filter(r => r.id !== id));
      setHistory(prev => prev.filter(h => h.id !== id));
    } catch(e) {
      toast({ title: "Erro", description: "Falha ao apagar o registro.", variant: "destructive" });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleActionClick = async (tatuagem: string, action: 'movimentacao' | 'ficha' | 'prontuario') => {
    if (!selectedEmpresaId) return;
    setIsCheckingTattoo(tatuagem);
    try {
      const { data, error } = await supabase
        .from('pet_pets')
        .select('id')
        .eq('empresa_id', selectedEmpresaId)
        .eq('id_registro', tatuagem)
        .limit(1);
        
      if (error) throw error;
      
      const pet = data && data.length > 0 ? data[0] : null;
      
      if (pet) {
         if (action === 'prontuario') {
            router.push(`/pets/${pet.id}/prontuario?source=tattoo-scan`);
         } else {
            router.push(`/pets?editPetId=${pet.id}&source=tattoo-scan`);
         }
      } else {
         toast({ title: "Pet não encontrado", description: "Iniciando novo cadastro..." });
         router.push(`/pets?prefill=true&tatuagem=${tatuagem}&source=tattoo-scan`);
      }
    } catch(e) {
      toast({ title: "Erro", description: "Erro ao buscar pet no banco." });
    } finally {
      setIsCheckingTattoo(null);
    }
  };

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
    if (!selectedEmpresaId) return null;
    
    const corrigidoManualmente = (ocrOriginal !== tatuagemFinal);
    
    try {
      const { data, error } = await supabase.from('pet_ocr_testes').insert({
        empresa_id: selectedEmpresaId,
        texto_ia: ocrOriginal || 'N/A',
        texto_final: tatuagemFinal,
        corrigido_manualmente: corrigidoManualmente,
        foto_url: fotoUrl
      }).select('id').single();
      
      if (error) throw error;
      toast({ title: "Teste Arquivado", description: "O resultado foi salvo no banco de dados para auditoria." });
      return data?.id;
    } catch (e) {
      console.error("Erro ao salvar teste:", e);
      return null;
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

            {recentResults.length > 0 && (
              <div className="w-full space-y-4">
                <div className="flex items-center gap-2 text-emerald-600 font-bold mb-4">
                  <CheckCircle2 className="w-5 h-5" /> Resultados da Sessão Atual ({recentResults.length})
                </div>
                
                {recentResults.map((res, idx) => (
                  <div key={idx} className="w-full bg-slate-50 p-4 rounded-xl border border-slate-200 animate-in fade-in flex flex-col gap-4">
                    <div className="flex items-center gap-4 w-full">
                      {res.fotoUrl ? (
                        <div className="w-16 h-16 shrink-0 rounded overflow-hidden border bg-black">
                          <img src={res.fotoUrl} alt="Foto" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-16 h-16 shrink-0 rounded border bg-slate-200 flex items-center justify-center">
                           <Camera className="w-6 h-6 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-xs text-slate-500 font-bold uppercase mb-1">Texto Confirmado</p>
                        <p className="text-2xl font-mono font-black text-emerald-700">{res.tatuagem}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 font-bold uppercase mb-1">Lido pela IA</p>
                        <p className="text-lg font-mono text-slate-400 line-through decoration-red-500">{res.iaResult || 'N/A'}</p>
                        {res.tatuagem === res.iaResult ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block">100% IA</span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block">Alterado</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 w-full">
                       {res.id && (
                         <Button 
                           variant="outline" size="sm" 
                           onClick={() => handleDeleteTest(res.id)}
                           disabled={isDeleting === res.id}
                           className="h-8 text-xs gap-1.5 border-red-200 hover:bg-red-50 text-red-600 hover:text-red-700 font-bold mr-auto"
                         >
                           {isDeleting === res.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} 
                           Apagar
                         </Button>
                       )}
                       <Button 
                         variant="outline" size="sm" 
                         onClick={() => handleActionClick(res.tatuagem, 'movimentacao')}
                         disabled={isCheckingTattoo === res.tatuagem}
                         className="h-8 text-xs gap-1.5 border-blue-200 hover:bg-blue-50 hover:text-blue-700 text-slate-600 font-bold"
                       >
                         {isCheckingTattoo === res.tatuagem ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />} 
                         Lançar Movimentação
                       </Button>
                       <Button 
                         variant="outline" size="sm" 
                         onClick={() => handleActionClick(res.tatuagem, 'ficha')}
                         disabled={isCheckingTattoo === res.tatuagem}
                         className="h-8 text-xs gap-1.5 border-slate-200 hover:bg-slate-100 text-slate-600 font-bold"
                       >
                         {isCheckingTattoo === res.tatuagem ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />} 
                         Ficha do Animal
                       </Button>
                       {canAccessProntuario && (
                         <Button 
                           variant="outline" size="sm" 
                           onClick={() => handleActionClick(res.tatuagem, 'prontuario')}
                           disabled={isCheckingTattoo === res.tatuagem}
                           className="h-8 text-xs gap-1.5 border-indigo-200 hover:bg-indigo-50 text-indigo-700 font-bold"
                         >
                           {isCheckingTattoo === res.tatuagem ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />} 
                           Prontuário
                         </Button>
                       )}
                    </div>
                  </div>
                ))}
                
                <p className="text-xs text-slate-400 italic text-center mt-4">Estes testes já foram gravados no banco de dados.</p>
              </div>
            )}

          </CardContent>
        </Card>
      </div>

      <TattooScannerModal 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        onConfirm={async (tatuagem, fotoUrl, iaResult) => {
          const id = await handleSaveTest(tatuagem, fotoUrl, iaResult);
          setRecentResults(prev => [{ id, tatuagem, fotoUrl, iaResult }, ...prev]);
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
                      
                      {/* Botões de Ação da Leitura */}
                      <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-200">
                         <Button 
                           variant="outline" size="sm" 
                           onClick={() => handleDeleteTest(h.id)}
                           disabled={isDeleting === h.id}
                           className="h-7 text-[10px] gap-1.5 border-red-200 hover:bg-red-50 text-red-600 hover:text-red-700 font-bold mr-auto"
                         >
                            {isDeleting === h.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} 
                            Apagar
                         </Button>
                         <Button 
                           variant="outline" size="sm" 
                           onClick={() => handleActionClick(h.texto_final, 'movimentacao')}
                           disabled={isCheckingTattoo === h.texto_final}
                           className="h-7 text-[10px] gap-1.5 border-blue-200 hover:bg-blue-50 hover:text-blue-700 text-slate-600 font-bold"
                         >
                            {isCheckingTattoo === h.texto_final ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />} 
                            Lançar Movimentação
                         </Button>
                         <Button 
                           variant="outline" size="sm" 
                           onClick={() => handleActionClick(h.texto_final, 'ficha')}
                           disabled={isCheckingTattoo === h.texto_final}
                           className="h-7 text-[10px] gap-1.5 border-slate-200 hover:bg-slate-100 text-slate-600 font-bold"
                         >
                            {isCheckingTattoo === h.texto_final ? <Loader2 className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />} 
                            Ficha do Animal
                         </Button>
                         {canAccessProntuario && (
                           <Button 
                             variant="outline" size="sm" 
                             onClick={() => handleActionClick(h.texto_final, 'prontuario')}
                             disabled={isCheckingTattoo === h.texto_final}
                             className="h-7 text-[10px] gap-1.5 border-indigo-200 hover:bg-indigo-50 text-indigo-700 font-bold"
                           >
                              {isCheckingTattoo === h.texto_final ? <Loader2 className="w-3 h-3 animate-spin" /> : <ClipboardList className="w-3 h-3" />} 
                              Prontuário
                           </Button>
                         )}
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
