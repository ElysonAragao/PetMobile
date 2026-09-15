"use client";

import * as React from "react";
import { PlusCircle, Edit, Trash2, CalendarRange, Clock, Printer } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAgendaTemplates } from "@/hooks/use-agenda-templates";
import { AgendaTemplate, AgendaTemplateEtapa } from "@/lib/types";

export function ProtocolosTab() {
  const { templates, fetchTemplates, saveTemplate, deleteTemplate, isLoading } = useAgendaTemplates();
  const { toast } = useToast();

  const [showForm, setShowForm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState<AgendaTemplate | null>(null);

  const [formNome, setFormNome] = React.useState("");
  const [formPular, setFormPular] = React.useState(false);
  
  // Array de etapas temporárias no formulário
  const [etapas, setEtapas] = React.useState<{ id?: string, ordem: number, nomeEtapa: string, diasAposAnterior: number }[]>([]);

  React.useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const resetForm = () => {
    setEditingTemplate(null);
    setFormNome("");
    setFormPular(false);
    setEtapas([]);
    setShowForm(false);
  };

  const handleEdit = (t: AgendaTemplate) => {
    setEditingTemplate(t);
    setFormNome(t.nome);
    setFormPular(t.pularFinaisDeSemana);
    setEtapas(t.etapas?.map(e => ({
      id: e.id,
      ordem: e.ordem,
      nomeEtapa: e.nomeEtapa,
      diasAposAnterior: e.diasAposAnterior
    })) || []);
    setShowForm(true);
  };

  const addEtapa = () => {
    const nextOrdem = etapas.length > 0 ? Math.max(...etapas.map(e => e.ordem)) + 1 : 1;
    setEtapas([...etapas, { ordem: nextOrdem, nomeEtapa: "", diasAposAnterior: 1 }]);
  };

  const handleQuantidadeEtapasChange = (totalQtd: number) => {
    if (totalQtd < 1) totalQtd = 1;
    if (totalQtd > 50) totalQtd = 50; // limite de segurança
    const targetLength = totalQtd - 1; // pois 1 é o principal
    const currentLength = etapas.length;
    
    if (targetLength > currentLength) {
      const novas = [];
      for (let i = currentLength; i < targetLength; i++) {
        novas.push({ ordem: i + 1, nomeEtapa: `Etapa_${String(i + 2).padStart(2, '0')}`, diasAposAnterior: 2 });
      }
      setEtapas([...etapas, ...novas]);
    } else if (targetLength < currentLength) {
      setEtapas(etapas.slice(0, targetLength));
    }
  };

  const removeEtapa = (index: number) => {
    const novasEtapas = [...etapas];
    novasEtapas.splice(index, 1);
    // Reordenar
    const reordenadas = novasEtapas.map((e, i) => ({ ...e, ordem: i + 1 }));
    setEtapas(reordenadas);
  };

  const updateEtapa = (index: number, key: string, value: any) => {
    const novasEtapas = [...etapas];
    novasEtapas[index] = { ...novasEtapas[index], [key]: value };
    setEtapas(novasEtapas);
  };

  const handleSave = async () => {
    if (!formNome.trim()) {
      toast({ title: "Erro", description: "O nome do protocolo é obrigatório.", variant: "destructive" });
      return;
    }

    // Validar etapas
    for (const e of etapas) {
      if (!e.nomeEtapa.trim()) {
        toast({ title: "Erro", description: "Todas as etapas devem ter um nome.", variant: "destructive" });
        return;
      }
      if (e.diasAposAnterior < 0) {
        toast({ title: "Erro", description: "Os dias de intervalo não podem ser negativos.", variant: "destructive" });
        return;
      }
    }

    setSaving(true);
    const res = await saveTemplate({
      id: editingTemplate?.id,
      nome: formNome,
      pularFinaisDeSemana: formPular,
      etapas: etapas
    });
    setSaving(false);

    if (res.success) {
      toast({ title: "Sucesso!", description: "Protocolo salvo com sucesso." });
      resetForm();
    } else {
      toast({ title: "Erro", description: res.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    const res = await deleteTemplate(id);
    if (res.success) {
      toast({ title: "Sucesso", description: "Protocolo removido." });
    } else {
      toast({ title: "Erro", description: res.message, variant: "destructive" });
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("PetMobile - Lista de Protocolos (Cascata)", 14, 15);
    
    let currentY = 25;

    if (templates.length === 0) {
      doc.setFontSize(12);
      doc.text("Nenhum protocolo cadastrado.", 14, currentY);
    }

    templates.forEach((t, i) => {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      const fdsText = t.pularFinaisDeSemana ? "Pula Finais de Semana" : "Dias Corridos Direto";
      doc.text(`${i + 1}. ${t.nome} (${fdsText})`, 14, currentY);
      
      currentY += 6;

      if (t.etapas && t.etapas.length > 0) {
        const tableData = t.etapas.sort((a: any, b: any) => a.ordem - b.ordem).map((e: any, index: number) => [
          e.ordem.toString(),
          e.nomeEtapa,
          e.diasAposAnterior.toString() + (index === 0 ? " dia(s) após D01" : " dia(s) após anterior")
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [["Ordem", "Nome da Etapa", "Intervalo de Dias"]],
          body: tableData,
          theme: 'striped',
          margin: { left: 14 },
          styles: { fontSize: 10 },
          headStyles: { fillColor: [63, 81, 181] }
        });
        currentY = (doc as any).lastAutoTable.finalY + 10;
      } else {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Sem etapas encadeadas.", 14, currentY);
        currentY += 10;
      }

      if (currentY > 270) {
        doc.addPage();
        currentY = 20;
      }
    });

    doc.save("protocolos_cadastrados.pdf");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Protocolos de Agendamento</h3>
          <p className="text-sm text-muted-foreground">Crie sequências de agendamentos em cascata (Ex: Protocolos de Inseminação, Vacinação).</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <PlusCircle className="mr-2 h-4 w-4" />Novo Protocolo
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Editar Protocolo" : "Novo Protocolo"}</DialogTitle>
            <DialogDescription>
              Configure o nome e os passos (etapas) subsequentes gerados automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Protocolo *</Label>
                <Input 
                  value={formNome} 
                  onChange={e => setFormNome(e.target.value)} 
                  placeholder="Ex: Protocolo de Inseminação" 
                />
              </div>
              <div className="flex items-center justify-between pt-8">
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="pular-fds" 
                    checked={formPular} 
                    onCheckedChange={setFormPular} 
                  />
                  <Label htmlFor="pular-fds" className="cursor-pointer">
                    Pular Finais de Semana (Sáb/Dom)
                  </Label>
                </div>
                
                <Button type="button" variant="outline" size="sm" onClick={generatePDF} className="bg-white hover:bg-slate-50 text-slate-700">
                  <Printer className="h-4 w-4 mr-2 text-indigo-600" />
                  Imprimir Protocolos PDF
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center bg-primary/5 p-4 rounded-lg border border-primary/20">
                <div>
                  <Label className="text-base font-semibold text-primary">Total de Agendamentos da Cascata</Label>
                  <p className="text-sm text-muted-foreground">O agendamento principal conta como a 1ª etapa.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input 
                    type="number" 
                    min="1"
                    max="50"
                    className="w-24 text-center font-bold text-lg"
                    value={etapas.length + 1}
                    onChange={(e) => handleQuantidadeEtapasChange(parseInt(e.target.value) || 1)}
                  />
                  <span className="text-sm font-medium">etapas</span>
                </div>
              </div>
              
              {etapas.length === 0 ? (
                <div className="text-center p-4 border rounded-md text-muted-foreground bg-muted/20">
                  Nenhuma etapa cadastrada. O agendamento principal será apenas 1 evento.
                </div>
              ) : (
                <div className="space-y-3">
                  {etapas.map((etapa, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 border rounded-md bg-muted/10 relative group">
                      <div className="bg-primary/10 text-primary font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                        {etapa.ordem}
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Nome do Agendamento Gerado</Label>
                        <Input 
                          value={etapa.nomeEtapa} 
                          onChange={(e) => updateEtapa(index, 'nomeEtapa', e.target.value)} 
                          placeholder="Ex: D02" 
                        />
                      </div>
                      <div className="w-32 space-y-1">
                        <Label className="text-xs">Dias de Intervalo</Label>
                        <Input 
                          type="number"
                          min="0"
                          value={etapa.diasAposAnterior} 
                          onChange={(e) => updateEtapa(index, 'diasAposAnterior', parseInt(e.target.value) || 0)} 
                        />
                      </div>
                      <div className="pt-5 pl-2">
                         <span className="text-xs text-muted-foreground shrink-0 w-48 block">
                            dias após {index === 0 ? "o agendamento principal (D01)" : `a ${etapas[index-1].nomeEtapa || 'etapa anterior'}`}
                         </span>
                      </div>
                      
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute right-2 top-2 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeEtapa(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-6">
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : (editingTemplate ? "Salvar Alterações" : "Criar Protocolo")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-4">Carregando protocolos...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <CalendarRange className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Nenhum protocolo cadastrado</h3>
              <p className="mt-1 text-sm text-muted-foreground">Crie um protocolo para agendamentos em lote automatizados.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Protocolo</TableHead>
                  <TableHead>Dias Úteis?</TableHead>
                  <TableHead>Cascata (Etapas)</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.nome}</TableCell>
                    <TableCell>
                      {t.pularFinaisDeSemana ? (
                         <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-md font-medium">Pula Sáb/Dom</span>
                      ) : (
                         <span className="bg-slate-100 text-slate-800 text-xs px-2 py-1 rounded-md font-medium">Dias Corridos</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {t.etapas && t.etapas.length > 0 ? t.etapas.map(e => (
                           <div key={e.id} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-1 rounded-md flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              +{e.diasAposAnterior}d: {e.nomeEtapa}
                           </div>
                        )) : (
                           <span className="text-xs text-muted-foreground">Sem etapas</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(t)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir protocolo?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Isso excluirá o template de agendamento &quot;{t.nome}&quot;. Agendamentos já realizados não serão afetados.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(t.id)} className="bg-destructive">Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
