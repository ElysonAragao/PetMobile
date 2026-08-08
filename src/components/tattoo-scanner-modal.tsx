import React, { useState, useEffect } from 'react';
import { Camera, ScanLine, X, Loader2, CheckCircle2, Upload, RefreshCw, Undo2 } from 'lucide-react';
import { createWorker } from 'tesseract.js';

interface TattooScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (tatuagemId: string, fotoBase64: string | null, ocrOriginal: string | null) => void;
}

export function TattooScannerModal({ isOpen, onClose, onConfirm }: TattooScannerModalProps) {
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrResult, setOcrResult] = useState<string | null>(null);
  const [editedTattoo, setEditedTattoo] = useState<string>('');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [reviewZoom, setReviewZoom] = useState(1);
  const [zoomOrigin, setZoomOrigin] = useState('center center');
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const shouldCameraBeRunning = React.useRef(false);

  useEffect(() => {
    if (isOpen) {
      setIsWebcamOpen(true);
    } else {
      closeOcrModal();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isWebcamOpen) {
      shouldCameraBeRunning.current = true;
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
           stream.getTracks().forEach(track => track.stop());
           return navigator.mediaDevices.enumerateDevices();
        })
        .then(devices => {
           const videoInputs = devices.filter(device => device.kind === 'videoinput');
           setVideoDevices(videoInputs);
           if (videoInputs.length > 0 && !selectedDeviceId) {
             setSelectedDeviceId(videoInputs[0].deviceId);
           }
        })
        .catch(err => setOcrError("Câmera não encontrada."));
    } else {
      shouldCameraBeRunning.current = false;
      stopCamera();
    }
  }, [isWebcamOpen]);

  useEffect(() => {
    if (isWebcamOpen && selectedDeviceId) startCamera(selectedDeviceId);
  }, [selectedDeviceId, isWebcamOpen]);

  const startCamera = async (deviceId: string) => {
    stopCamera();
    shouldCameraBeRunning.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' }
      });
      
      if (!shouldCameraBeRunning.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      setWebcamStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      setOcrError("Erro ao iniciar câmera.");
    }
  };

  const stopCamera = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(t => t.stop());
      setWebcamStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const extrairTatuagem = (textoBruto: string) => {
    // A extração pode ser ajustada conforme o formato da tatuagem
    // Geralmente é uma sequência de letras e números
    const limpo = textoBruto.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (limpo.length >= 3) {
      return limpo.substring(0, 10); // Retorna até 10 caracteres lidos
    }
    return null;
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsProcessingOcr(true);
    setOcrError(null);
    
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      const maxDim = 1280;
      let w = video.videoWidth;
      let h = video.videoHeight;
      if (w > maxDim || h > maxDim) {
         const ratio = Math.min(maxDim / w, maxDim / h);
         w = Math.floor(w * ratio);
         h = Math.floor(h * ratio);
      }
      canvas.width = w;
      canvas.height = h;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Erro no canvas");
      
      ctx.filter = 'contrast(200%) grayscale(100%) brightness(120%)';
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      
      setImageSrc(video.srcObject ? canvas.toDataURL('image/jpeg', 0.6) : dataUrl);
      stopCamera(); 

      const worker = await createWorker('eng');
      const { data } = await worker.recognize(dataUrl);
      await worker.terminate();
      
      const tatuagemEncontrada = extrairTatuagem(data.text);
      const finalResult = tatuagemEncontrada || 'N/A';
      
      setOcrResult(finalResult);
      setEditedTattoo(finalResult !== 'N/A' ? finalResult : '');
    } catch (err: any) {
      setOcrError("Erro ao processar imagem.");
    } finally {
      setIsProcessingOcr(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsProcessingOcr(true);
    setOcrError(null);
    
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      try {
        const img = new window.Image();
        await new Promise((resolve, reject) => { 
          img.onload = resolve; 
          img.onerror = () => reject(new Error("Erro ao carregar imagem no DOM"));
          img.src = dataUrl;
        });
        
        const canvas = document.createElement('canvas');
        const maxDim = 1280;
        let w = img.width;
        let h = img.height;
        
        if (!w || !h) throw new Error("Imagem sem dimensões válidas");

        if (w > maxDim || h > maxDim) {
           const ratio = Math.min(maxDim / w, maxDim / h);
           w = Math.floor(w * ratio);
           h = Math.floor(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Erro ao criar contexto do canvas");
        
        ctx.filter = 'contrast(200%) grayscale(100%) brightness(120%)';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const processedSrc = canvas.toDataURL('image/jpeg', 0.9);

        setImageSrc(dataUrl);
        stopCamera();

        const worker = await createWorker('eng');
        const { data } = await worker.recognize(processedSrc);
        await worker.terminate();
        
        const tatuagemEncontrada = extrairTatuagem(data.text);
        const finalResult = tatuagemEncontrada || 'N/A';
        
        setOcrResult(finalResult);
        setEditedTattoo(finalResult !== 'N/A' ? finalResult : '');
      } catch (err: any) {
        console.error("OCR Upload Error:", err);
        setOcrError("Erro: " + (err.message || String(err)));
      } finally {
        setIsProcessingOcr(false);
        if (fileInputRef.current) fileInputRef.current.value = ''; 
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (reviewZoom > 1) {
      setReviewZoom(1);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setZoomOrigin(`${x}% ${y}%`);
      setReviewZoom(3);
    }
  };

  const reScanFromZoom = async () => {
    if (!imageSrc || reviewZoom <= 1) return;
    setIsProcessingOcr(true);
    setOcrError(null);
    try {
      const [pctX, pctY] = zoomOrigin.split(' ').map(p => parseFloat(p));
      const img = new window.Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Erro DOM"));
        img.src = imageSrc;
      });

      const canvas = document.createElement('canvas');
      const cropW = img.width / reviewZoom;
      const cropH = img.height / reviewZoom;

      let srcX = (img.width * (pctX / 100)) - (cropW / 2);
      let srcY = (img.height * (pctY / 100)) - (cropH / 2);

      srcX = Math.max(0, Math.min(srcX, img.width - cropW));
      srcY = Math.max(0, Math.min(srcY, img.height - cropH));

      canvas.width = cropW * 2;
      canvas.height = cropH * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Erro canvas");
      
      ctx.filter = 'contrast(200%) grayscale(100%) brightness(120%)';
      ctx.drawImage(img, srcX, srcY, cropW, cropH, 0, 0, canvas.width, canvas.height);
      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);

      const worker = await createWorker('eng');
      const { data } = await worker.recognize(croppedDataUrl);
      await worker.terminate();

      const tatuagemEncontrada = extrairTatuagem(data.text);
      const finalResult = tatuagemEncontrada || 'N/A';
      
      if (finalResult !== 'N/A') {
         setOcrResult(finalResult);
         setEditedTattoo(finalResult);
      } else {
         setOcrError("Não foi possível ler a tatuagem mesmo com o zoom. Digite manualmente.");
      }
    } catch (err: any) {
       console.error(err);
       setOcrError("Erro ao re-analisar o recorte da imagem.");
    } finally {
       setIsProcessingOcr(false);
    }
  };

  const confirmarRevisao = () => {
    onConfirm(editedTattoo, imageSrc, ocrResult);
    closeOcrModal();
  };

  const closeOcrModal = () => {
    setIsWebcamOpen(false);
    setOcrError(null);
    stopCamera();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm print:hidden">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-blue-500" /> Leitura de Tatuagem
          </h3>
          <button onClick={closeOcrModal} className="text-slate-400 hover:text-white flex items-center gap-2 font-semibold text-sm bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors">
            <Undo2 className="w-4 h-4" /> Voltar
          </button>
        </div>
        
        {isProcessingOcr ? (
          <div className="py-12 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
            <p className="text-white font-bold">Analisando imagem...</p>
          </div>
        ) : ocrResult ? (
          <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 animate-in fade-in zoom-in-95">
            <p className="text-sm text-slate-400 font-bold mb-6 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-500" /> Verifique a Tatuagem Lida
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* LEFT: Image */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                   <label className="block text-xs font-bold text-slate-500 uppercase">Imagem Analisada</label>
                   {reviewZoom > 1 && <span className="text-xs text-blue-400 font-bold animate-pulse">Modo Zoom (Clique para sair)</span>}
                </div>

                <div className="flex-1 bg-black rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center min-h-[220px] max-h-[250px] relative shadow-inner cursor-crosshair">
                  {imageSrc ? (
                     <>
                       <img 
                         src={imageSrc}
                         onClick={handleImageClick}
                         style={{ 
                           transform: `scale(${reviewZoom})`,
                           transformOrigin: zoomOrigin,
                         }}
                         className={`w-full h-full object-contain transition-transform duration-300 ${isProcessingOcr ? 'opacity-50 blur-sm' : ''}`}
                         alt="Captura" 
                         title="Clique na tatuagem para aplicar zoom"
                       />
                       {reviewZoom > 1 && (
                         <div className="absolute top-2 right-2 z-20">
                           <button 
                             onClick={(e) => { e.stopPropagation(); reScanFromZoom(); }} 
                             className="bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.5)] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-blue-400/50"
                             disabled={isProcessingOcr}
                           >
                             {isProcessingOcr ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                             {isProcessingOcr ? "LENDO..." : "LER DESTE ZOOM"}
                           </button>
                         </div>
                       )}
                     </>
                  ) : <Camera className="w-8 h-8 opacity-20" />}
                  
                  {reviewZoom === 1 && imageSrc && (
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
                      <span className="bg-black/70 text-white text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10 shadow-lg">
                        Clique na Tatuagem para dar Zoom
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: Data */}
              <div className="flex flex-col justify-center">
                <div className="mb-4 text-center md:text-left">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Lido pela Inteligência</label>
                  <p className="text-lg font-mono text-slate-300 tracking-widest bg-slate-900 py-2 px-4 rounded-lg border border-slate-800 line-through decoration-rose-500/50 inline-block w-full">
                    {ocrResult}
                  </p>
                </div>
                
                <div className="mb-2">
                  <label className="block text-sm font-bold text-white mb-2 text-center md:text-left">Digite a Tatuagem Correta</label>
                  <input 
                    type="text" 
                    value={editedTattoo} 
                    onChange={(e) => setEditedTattoo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} 
                    className="w-full bg-black border-2 border-blue-500/50 rounded-xl px-4 py-3 text-white text-center text-3xl uppercase font-black tracking-widest focus:border-blue-500 focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] outline-none transition-all"
                    maxLength={15}
                    autoFocus
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck="false"
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
               <button onClick={() => { setOcrResult(null); setImageSrc(null); setIsWebcamOpen(true); }} className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center" title="Nova Foto">
                 <Camera className="w-5 h-5" />
               </button>
               <button onClick={() => { setOcrResult(null); stopCamera(); fileInputRef.current?.click(); }} className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center" title="Novo Arquivo">
                 <Upload className="w-5 h-5" />
               </button>
               <button onClick={confirmarRevisao} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
                 <CheckCircle2 className="w-5 h-5" /> Confirmar
               </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="aspect-video bg-black rounded-2xl overflow-hidden relative flex items-center justify-center border-2 border-slate-800 shadow-inner">
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
              
              {!webcamStream ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10">
                  <button 
                    onClick={() => startCamera(selectedDeviceId)} 
                    className="flex flex-col items-center gap-3 text-slate-400 hover:text-white transition-colors"
                  >
                    <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center">
                      <Camera className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-sm">Câmera Pausada. Clique para Ligar.</span>
                  </button>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                   <div className="w-64 h-20 border-2 border-dashed border-white/50 rounded-lg"></div>
                </div>
              )}
              
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
            
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
            />

            <div className="flex gap-3">
              <button 
                onClick={() => {
                  shouldCameraBeRunning.current = false;
                  setIsWebcamOpen(false);
                  stopCamera();
                  fileInputRef.current?.click();
                }} 
                disabled={isProcessingOcr}
                title="Enviar foto do arquivo"
                className="px-5 py-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl font-bold transition-colors flex items-center justify-center"
              >
                <Upload className="w-6 h-6" />
              </button>
              <button 
                onClick={captureAndScan} 
                disabled={isProcessingOcr}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Camera className="w-6 h-6" /> Escanear Agora
              </button>
            </div>
            
            {ocrError && <div className="text-amber-500 font-bold text-center bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-sm">{ocrError}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
