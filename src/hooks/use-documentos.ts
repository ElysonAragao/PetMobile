import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/context/session-context';

export interface DocumentoClinico {
  id: string;
  empresa_id: string;
  prontuario_id: string;
  tipo_documento: 'Receita' | 'Atestado' | 'Recibo' | 'Guia de Internação';
  conteudo: string | null;
  metadata: any | null;
  codigo_documento?: string | null;
  created_at: string;
}

export type DocumentoInsert = Omit<DocumentoClinico, 'id' | 'empresa_id' | 'created_at' | 'codigo_documento'>;

async function getNextDocCode(supabase: any, empresaId: string, tipo: string): Promise<string> {
    const prefix = tipo === 'Receita' ? 'REC' : (tipo === 'Atestado' ? 'ATE' : (tipo === 'Recibo' ? 'RCB' : 'DOC'));
    const { data } = await supabase
        .from('pet_documentos_clinicos')
        .select('codigo_documento')
        .eq('empresa_id', empresaId)
        .like('codigo_documento', `${prefix}-%`)
        .order('codigo_documento', { ascending: false })
        .limit(1);
        
    if (!data || data.length === 0 || !data[0].codigo_documento) return `${prefix}-00001`;
    
    const match = data[0].codigo_documento.match(new RegExp(`${prefix}-(\\d+)`));
    if (match) {
        return `${prefix}-${String(parseInt(match[1]) + 1).padStart(5, '0')}`;
    }
    return `${prefix}-00001`;
}

export function useDocumentos(prontuarioId?: string) {
  const supabase = useMemo(() => createClient(), []);
  const [documentos, setDocumentos] = useState<DocumentoClinico[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { selectedEmpresaId, isLoading: sessionLoading, user } = useSession();

  const fetchInProgress = useRef(false);
  const prevProntuarioId = useRef(prontuarioId);

  const fetchDocumentos = useCallback(async () => {
    if (fetchInProgress.current || !selectedEmpresaId) {
      if (!selectedEmpresaId && !sessionLoading) setIsLoading(false);
      return;
    }
    
    fetchInProgress.current = true;
    setIsLoading(true);

    try {
      let query = supabase
        .from('pet_documentos_clinicos')
        .select('*')
        .eq('empresa_id', selectedEmpresaId)
        .order('created_at', { ascending: false });

      if (prontuarioId) {
        query = query.eq('prontuario_id', prontuarioId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setDocumentos(data || []);
    } catch (error) {
      console.error('Erro ao buscar documentos:', error);
    } finally {
      setIsLoading(false);
      fetchInProgress.current = false;
    }
  }, [selectedEmpresaId, prontuarioId, sessionLoading, supabase]);

  useEffect(() => {
    if (!sessionLoading && selectedEmpresaId) {
       if (prevProntuarioId.current !== prontuarioId) {
           prevProntuarioId.current = prontuarioId;
       }
       fetchDocumentos();
    }
  }, [fetchDocumentos, sessionLoading, selectedEmpresaId, prontuarioId]);

  const addDocumento = async (docInfo: DocumentoInsert) => {
    if (!user?.id || !selectedEmpresaId) return { success: false, message: 'Não autenticado ou sem clínica.' };
    
    try {
      const nextCode = await getNextDocCode(supabase, selectedEmpresaId, docInfo.tipo_documento);

      const dataToInsert = {
        ...docInfo,
        codigo_documento: nextCode,
        autor_registro_id: user?.id,
        empresa_id: selectedEmpresaId,
      };

      const { data, error } = await supabase.from('pet_documentos_clinicos').insert([dataToInsert]).select().single();
      
      if (error) throw error;
      
      await fetchDocumentos();
      return { success: true, message: 'Documento salvo.', data };
    } catch (error: any) {
      console.error('Erro ao adicionar documento:', error);
      return { success: false, message: error.message };
    }
  };

  return { documentos, isLoaded: !isLoading, addDocumento, refreshDocumentos: fetchDocumentos };
}
