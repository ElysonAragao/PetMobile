"use client";

import * as React from 'react';
import jsQR from 'jsqr';
import { PageTitle } from '@/components/layout/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Printer, RefreshCw, Undo2, Camera, AlertTriangle, CheckCircle2, FileSpreadsheet, FileCode, FileJson } from 'lucide-react';
import Link from 'next/link';
import { useOrcamentos } from '@/hooks/use-orcamentos';
import { format } from 'date-fns';

export default function OrcamentoScanPage() {
  const { getOrcamentoByCodigo } = useOrcamentos();
  
  const [decodedData, setDecodedData] = React.useState<any | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const scanIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const isScanActiveRef = React.useRef(true);

  const stopScan = React.useCallback(() => {
    isScanActiveRef.current = false;
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const processScannedData = React.useCallback(async (scannedCode: string) => {
    stopScan();
    setIsProcessing(true);
    setError(null);

    try {
      if (!scannedCode.startsWith("OPet")) {
        throw new Error("QR Code inválido. Este não parece ser um código de Orçamento válido.");
      }

      const result = await getOrcamentoByCodigo(scannedCode);
      
      if (!result.success || !result.data) {
        throw new Error(result.message || "Orçamento não encontrado no sistema.");
      }

      setDecodedData(result.data);
    } catch (e: any) {
      setError(e.message || "Erro ao processar orçamento.");
      isScanActiveRef.current = true;
      setTimeout(startCameraStream, 2000); // Tentar novamente em 2 segundos
    } finally {
      setIsProcessing(false);
    }
  }, [stopScan, getOrcamentoByCodigo]);

  const tick = React.useCallback(() => {
    if (!isScanActiveRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        if (code && code.data) processScannedData(code.data);
      }
    }
  }, [processScannedData]);

  const startCameraStream = React.useCallback(async () => {
    stopScan();
    await new Promise(resolve => setTimeout(resolve, 200));
    isScanActiveRef.current = true;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      streamRef.current = stream;
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play();
        scanIntervalRef.current = setInterval(tick, 250);
      }
    } catch (err: any) {
      setHasCameraPermission(false);
      setError("Câmera não autorizada ou indisponível.");
    }
  }, [stopScan, tick]);

  React.useEffect(() => {
    startCameraStream();
    return () => stopScan();
  }, [startCameraStream, stopScan]);

  const generateExportData = () => {
    if (!decodedData) return null;
    return {
      codigo: decodedData.codigo,
      cliente: decodedData.cliente_nome,
      plano: decodedData.plano_nome,
      emissao: format(new Date(decodedData.data_emissao), 'dd/MM/yyyy'),
      validade: format(new Date(decodedData.validade), 'dd/MM/yyyy'),
      total: decodedData.total_estimado,
      itens: [
        ...(decodedData.exames || []).map((e: any) => ({ tipo: 'Exame', descricao: e.name, valor: e.precoCalculado })),
        ...(decodedData.materiais || []).map((m: any) => ({ tipo: 'Material', descricao: m.descricao, valor: m.precoUnitario }))
      ]
    };
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const data = generateExportData();
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `orcamento_${data.codigo}.json`);
  };

  const handleExportCSV = () => {
    const data = generateExportData();
    if (!data) return;
    let csv = `Tipo,Descrição,Valor\n`;
    data.itens.forEach((i: any) => {
      csv += `"${i.tipo}","${i.descricao}",${i.valor}\n`;
    });
    csv += `\nTOTAL,,,${data.total}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `orcamento_${data.codigo}.csv`);
  };

  const handleExportXML = () => {
    const data = generateExportData();
    if (!data) return;
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<orcamento>\n`;
    xml += `  <codigo>${data.codigo}</codigo>\n`;
    xml += `  <cliente>${data.cliente}</cliente>\n`;
    xml += `  <plano>${data.plano}</plano>\n`;
    xml += `  <total>${data.total}</total>\n`;
    xml += `  <itens>\n`;
    data.itens.forEach((i: any) => {
      xml += `    <item>\n      <tipo>${i.tipo}</tipo>\n      <descricao>${i.descricao}</descricao>\n      <valor>${i.valor}</valor>\n    </item>\n`;
    });
    xml += `  </itens>\n</orcamento>`;
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
    downloadBlob(blob, `orcamento_${data.codigo}.xml`);
  };

  const handleExportXLS = () => {
    const data = generateExportData();
    if (!data) return;
    let html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1"><tr><th>Tipo</th><th>Descrição</th><th>Valor (R$)</th></tr>`;
    data.itens.forEach((i: any) => {
      html += `<tr><td>${i.tipo}</td><td>${i.descricao}</td><td>${i.valor}</td></tr>`;
    });
    html += `<tr><td></td><td><b>TOTAL GERAL</b></td><td><b>${data.total}</b></td></tr></table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    downloadBlob(blob, `orcamento_${data.codigo}.xls`);
  };

  return (
    <>
      <PageTitle title="Leitura de Orçamento" description="Leia o QR Code do orçamento para consultar os itens e valores.">
        <Link href="/orcamento" passHref>
          <Button variant="outline"><Undo2 className="mr-2 h-4 w-4" />Voltar</Button>
        </Link>
      </PageTitle>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
        {/* SCANNER CARD */}
        <Card className="shadow-lg border-2 border-slate-100">
          <CardHeader>
            <CardTitle>Câmera / Scanner</CardTitle>
            <CardDescription>Aponte a câmera para o QR Code do Orçamento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="aspect-video w-full bg-slate-900 rounded-xl flex flex-col items-center justify-center text-slate-500 overflow-hidden relative border-4 border-slate-200 shadow-inner">
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              {isProcessing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
                  <Loader2 className="h-12 w-12 animate-spin mb-4" />
                  <p className="font-bold tracking-widest uppercase text-xs">Buscando Orçamento...</p>
                </div>
              )}
              {error && !isProcessing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-4 text-center">
                  <AlertTriangle className="h-10 w-10 text-red-500 mb-2" />
                  <p className="text-sm font-semibold">{error}</p>
                </div>
              )}
            </div>

            <Button onClick={() => { setDecodedData(null); startCameraStream(); }} variant="outline" className="w-full h-12 border-slate-200 text-blue-600 font-medium">
              <RefreshCw className="mr-2 h-4 w-4" /> Nova Leitura
            </Button>
          </CardContent>
        </Card>

        {/* RESULTS CARD */}
        <Card className="shadow-lg border-2 border-slate-100 min-h-[400px] flex flex-col">
          <CardHeader className="bg-slate-50/50 border-b pb-4">
             <div className="flex justify-between items-center">
                <div><CardTitle>Orçamento Encontrado</CardTitle><CardDescription>Informações detalhadas do código lido.</CardDescription></div>
                {decodedData && <CheckCircle2 className="h-8 w-8 text-green-500" />}
             </div>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {decodedData ? (
              <div className="divide-y divide-slate-100 overflow-y-auto">
                <div className="p-5 flex justify-between items-start bg-blue-50/30">
                  <div className="space-y-1">
                    <p className="text-[8pt] text-slate-400 uppercase font-bold">CÓDIGO: {decodedData.codigo}</p>
                    <p className="text-[12pt] font-black text-primary">R$ {decodedData.total_estimado?.toFixed(2)}</p>
                  </div>
                  <div className="text-[8pt] text-right text-slate-400">
                    Emissão: {format(new Date(decodedData.data_emissao), 'dd/MM/yyyy')} <br />
                    Validade: <strong className="text-red-500">{format(new Date(decodedData.validade), 'dd/MM/yyyy')}</strong>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div className="space-y-1 text-sm grid grid-cols-2 bg-slate-50 p-3 rounded-lg border">
                    <p><strong>Nome do Cliente:</strong><br />{decodedData.cliente_nome}</p>
                    <p><strong>Plano/Convênio:</strong><br />{decodedData.plano_nome}</p>
                  </div>
                  
                  {decodedData.exames?.length > 0 && (
                    <div>
                        <h4 className="font-bold text-sm text-slate-500 mb-2 uppercase">Exames ({decodedData.exames.length})</h4>
                        <div className="space-y-1">
                            {decodedData.exames.map((e: any, i: number) => (
                                <div key={i} className="text-xs flex justify-between border-b pb-1">
                                    <span>{e.name}</span>
                                    <span className="font-semibold text-slate-600">R$ {e.precoCalculado?.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                  )}

                  {decodedData.materiais?.length > 0 && (
                    <div className="pt-2">
                        <h4 className="font-bold text-sm text-slate-500 mb-2 uppercase">Materiais ({decodedData.materiais.length})</h4>
                        <div className="space-y-1">
                            {decodedData.materiais.map((m: any, i: number) => (
                                <div key={i} className="text-xs flex justify-between border-b pb-1">
                                    <span>{m.descricao}</span>
                                    <span className="font-semibold text-slate-600">R$ {m.precoUnitario?.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-300 opacity-50 space-y-4">
                  <Search className="h-16 w-16" />
                  <p className="font-medium italic text-center px-8">As informações do orçamento aparecerão aqui após o escaneamento.</p>
              </div>
            )}
          </CardContent>

          {decodedData && (
            <div className="p-4 bg-slate-50 border-t space-y-3 mt-auto">
              <Button onClick={() => {
                  const orcamentoForPrint = {
                      codigo: decodedData.codigo,
                      dataEmissao: decodedData.data_emissao,
                      validade: decodedData.validade,
                      cliente: { nome: decodedData.cliente_nome, cpl: decodedData.cliente_cpl },
                      plano: decodedData.plano_nome,
                      exames: decodedData.exames,
                      materiais: decodedData.materiais,
                      totalEstimado: decodedData.total_estimado
                  };
                  localStorage.setItem(`print-orcamento-${decodedData.codigo}`, JSON.stringify(orcamentoForPrint));
                  window.open(`/print/orcamento/${decodedData.codigo}?origin=scan`, '_blank');
              }} className="w-full bg-blue-600 hover:bg-blue-700 shadow-md h-12">
                <Printer className="mr-2 h-5 w-5" /> Imprimir PDF Original
              </Button>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button variant="outline" size="sm" onClick={handleExportCSV} className="text-xs h-9">
                    <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportXLS} className="text-xs h-9">
                    <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Excel (XLS)
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportXML} className="text-xs h-9">
                    <FileCode className="mr-1.5 h-3.5 w-3.5" /> XML
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportJSON} className="text-xs h-9">
                    <FileJson className="mr-1.5 h-3.5 w-3.5" /> JSON
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
