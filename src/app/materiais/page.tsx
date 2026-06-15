"use client";

import * as React from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PackageOpen, PlusCircle, Trash2, Edit, Box, Undo2, Printer, Upload, Download } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Material } from '@/lib/types';
import { useMateriais, MaterialFormValues, materialSchema } from '@/hooks/use-materiais';
import { exportToCSV } from '@/lib/export-utils';
import { PageTitle } from '@/components/layout/page-title';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from '@/components/ui/badge';

function MaterialList({ materiais, onEdit, onDelete, searchId }: { 
  materiais: Material[], 
  onEdit: (material: Material) => void,
  onDelete: (id: string) => void,
  searchId?: string | null
}) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = React.useState('all');
  const [materialToPrint, setMaterialToPrint] = React.useState<Material | null>(null);

  const filteredMateriais = React.useMemo(() => {
    let filtered = materiais;
    if (searchId) filtered = filtered.filter(m => m.id === searchId);
    if (selectedCategory !== 'all') filtered = filtered.filter(m => m.categoria === selectedCategory);
    return filtered;
  }, [materiais, selectedCategory, searchId]);

  const handlePrint = () => {
    const reportData = {
      title: "Catálogo de Materiais e Produtos",
      subtitle: "Lista de insumos, medicamentos e itens de pet shop",
      filters: selectedCategory !== 'all' ? [{ label: 'Categoria', value: selectedCategory }] : undefined,
      headers: ["Cód", "ID Mat", "Descrição do Produto", "Categoria", "Un.", "Estq", "Preço (R$)"],
      rows: filteredMateriais.map(m => [
        m.codigo || '-',
        m.idMaterial || '-',
        m.descricao,
        m.categoria,
        m.unidade,
        m.estoque.toString(),
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(m.precoUnitario)
      ]),
      backUrl: '/materiais'
    };
    localStorage.setItem('print-report-data', JSON.stringify(reportData));
    router.push('/print/report');
  };

  const categories = [
    'Alimento', 
    'Material', 
    'Medicamento/Suplemento', 
    'Equipamento', 
    'Insumo', 
    'Outro'
  ];

  return (
    <Card>
      <CardHeader className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <CardTitle>Materiais Cadastrados</CardTitle>
          <CardDescription>
            {searchId ? (
              <div className="text-orange-600 font-medium flex flex-wrap items-center mt-1">
                Exibindo resultado da leitura. 
                <Link href="/materiais" className="underline font-bold ml-2 hover:text-orange-700">Limpar</Link>
                <span className="mx-2 text-slate-300">|</span>
                <Link href="/scan-material" className="text-blue-600 underline font-bold hover:text-blue-800">Ler Novo QR Code</Link>
              </div>
            ) : (
              "Gerencie o catálogo de produtos e insumos da clínica."
            )}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Categorias</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handlePrint} className="border-primary/20 text-primary hover:bg-primary/5">
            <Printer className="mr-2 h-4 w-4" /> Imprimir PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {filteredMateriais.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>ID Mat.</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-center">Unidade</TableHead>
                <TableHead className="text-center">Estoque</TableHead>
                <TableHead className="text-right">Preço Unitário</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMateriais.map((material) => (
                <TableRow key={material.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{material.codigo}</TableCell>
                  <TableCell className="font-mono text-sm">{material.idMaterial || '-'}</TableCell>
                  <TableCell className="font-medium">{material.descricao}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{material.categoria}</Badge>
                  </TableCell>
                  <TableCell className="text-center">{material.unidade}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={material.estoque > 10 ? 'secondary' : material.estoque > 0 ? 'outline' : 'destructive'}>
                      {material.estoque}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(material.precoUnitario)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" title="Imprimir Crachá/Etiqueta" onClick={() => setMaterialToPrint(material)}>
                      <Printer className="h-4 w-4 text-blue-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onEdit(material)}>
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
                          <AlertDialogTitle>Excluir Material?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Deseja remover "{material.descricao}" do catálogo permanentemente?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(material.id)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl bg-muted/20">
            <PackageOpen className="mx-auto h-12 w-12 opacity-30 mb-4" />
            <p>Nenhum material cadastrado nesta categoria.</p>
          </div>
        )}
      </CardContent>

      <Dialog open={!!materialToPrint} onOpenChange={(open) => !open && setMaterialToPrint(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Imprimir Identificação do Material</DialogTitle>
            <DialogDescription>
              Escolha o formato de impressão para {materialToPrint?.descricao}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Button 
              variant="outline" 
              className="h-24 flex flex-col items-center justify-center gap-2"
              onClick={() => {
                window.open(`/print/material/${materialToPrint?.id}`, '_blank');
                setMaterialToPrint(null);
              }}
            >
              <Box className="h-8 w-8 text-primary" />
              <span>Identificação (Térmica 58mm)</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-24 flex flex-col items-center justify-center gap-2"
              onClick={() => {
                window.open(`/print/material-label/${materialToPrint?.id}`, '_blank');
                setMaterialToPrint(null);
              }}
            >
              <PackageOpen className="h-8 w-8 text-indigo-500" />
              <span>Etiqueta (58x30mm)</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function MateriaisPage() {
  const { materiais, addMaterial, updateMaterial, deleteMaterial, isLoaded, error, getNextMaterialCode } = useMateriais();
  const searchParams = useSearchParams();
  const searchId = searchParams.get('searchId');
  const [activeTab, setActiveTab] = React.useState(searchParams.get('tab') || "list");
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [selectedMaterial, setSelectedMaterial] = React.useState<Material | null>(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const form = useForm<MaterialFormValues>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      codigo: "",
      idMaterial: "",
      descricao: "",
      categoria: "Insumo",
      precoUnitario: 0,
      unidade: "Unidade",
      estoque: 0,
    },
  });

  const handleRegisterClick = async () => {
    if (!selectedMaterial) {
      const nextCode = await getNextMaterialCode();
      form.reset({
        codigo: nextCode,
        idMaterial: "",
        descricao: "",
        categoria: "Insumo",
        precoUnitario: 0,
        unidade: "Unidade",
        estoque: 0,
      });
    }
  };

  const handleFormSubmit = async (values: MaterialFormValues) => {
    let result;
    const finalValues = { ...values };
    if (!finalValues.idMaterial || finalValues.idMaterial.trim() === "") {
      finalValues.idMaterial = finalValues.codigo;
    }

    if (selectedMaterial) {
      result = await updateMaterial(selectedMaterial.id, finalValues);
    } else {
      result = await addMaterial(finalValues);
    }

    if (result.success) {
      toast({ title: "Sucesso!", description: selectedMaterial ? "Material atualizado." : "Material cadastrado." });
      const nextCode = await getNextMaterialCode();
      form.reset({ 
        codigo: nextCode, 
        idMaterial: "",
        descricao: "", 
        categoria: "Insumo", 
        precoUnitario: 0, 
        unidade: "Unidade", 
        estoque: 0 
      });
      
      if (selectedMaterial) {
        setIsEditDialogOpen(false);
        setSelectedMaterial(null);
      }
    } else {
      toast({ title: "Erro", description: result.message, variant: "destructive" });
    }
  };

  if (error) return <div className="text-red-500">Erro: {error.message}</div>;

  const handleExportCSV = async () => {
    const dataToExport = materiais.map(m => ({
      "Cód Sequencial": m.codigo,
      "ID Material": m.idMaterial || '',
      "Descrição": m.descricao,
      "Categoria": m.categoria,
      "Unidade": m.unidade,
      "Estoque": m.estoque,
      "Preço Unitário": m.precoUnitario
    }));
    await exportToCSV('materiais_export', dataToExport);
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result;
      if (typeof text !== 'string') {
        setIsImporting(false);
        return;
      }

      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        toast({ title: "Erro", description: "Arquivo CSV vazio ou sem dados.", variant: "destructive" });
        setIsImporting(false);
        return;
      }

      const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
      const headerCols = lines[0].split(/[;,\t]/).map(h => normalize(h));

      const findCol = (...aliases: string[]) => {
        for (const alias of aliases) {
          const idx = headerCols.findIndex(h => h.includes(normalize(alias)));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const colCod = findCol('cod sequencial', 'codigo');
      const colIdMat = findCol('id material', 'idmat', 'id_material');
      const colDesc = findCol('descricao', 'descrição', 'nome');
      const colCat = findCol('categoria', 'tipo');
      const colUnid = findCol('unidade', 'unid');
      const colEstq = findCol('estoque', 'quantidade', 'qtd');
      const colPreco = findCol('preco', 'preço', 'valor');

      if (colDesc === -1) {
        toast({ title: "Erro no CSV", description: "Cabeçalho não encontrado: 'Descrição'. Verifique o arquivo.", variant: "destructive" });
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(/[;,\t]/);
        const descricao = colDesc !== -1 ? cols[colDesc]?.trim() : '';
        if (!descricao) continue;

        const codigo = colCod !== -1 ? cols[colCod]?.trim() : undefined;
        const idMaterial = colIdMat !== -1 ? cols[colIdMat]?.trim() : undefined;
        const categoria = colCat !== -1 ? cols[colCat]?.trim() : 'Insumo';
        const unidade = colUnid !== -1 ? cols[colUnid]?.trim() : 'Unidade';
        
        let estoque = 0;
        if (colEstq !== -1) {
          const estRaw = cols[colEstq]?.trim();
          estoque = parseInt(estRaw, 10);
          if (isNaN(estoque)) estoque = 0;
        }

        let precoUnitario = 0;
        if (colPreco !== -1) {
          let pRaw = cols[colPreco]?.trim() || '0';
          // Se tiver R$, tirar. Trocar virgula por ponto
          pRaw = pRaw.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
          precoUnitario = parseFloat(pRaw);
          if (isNaN(precoUnitario)) precoUnitario = 0;
        }

        try {
          await addMaterial({
            codigo,
            idMaterial,
            descricao,
            categoria,
            unidade,
            estoque,
            precoUnitario
          });
          successCount++;
        } catch (err) {
          failCount++;
        }
      }

      toast({
        title: "Importação Concluída",
        description: `${successCount} materiais importados com sucesso.${failCount > 0 ? ` ${failCount} falhas.` : ''}`,
        variant: failCount > 0 ? "destructive" : "default"
      });

      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.onerror = () => setIsImporting(false);
    reader.readAsText(file, "UTF-8");
  };

  const categories = [
    'Alimento', 
    'Material', 
    'Medicamento/Suplemento', 
    'Equipamento', 
    'Insumo', 
    'Outro'
  ];

  return (
    <>
      <PageTitle title="Catálogo de Materiais" description="Cadastro de insumos, medicamentos e produtos de venda.">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept=".csv,.txt,text/csv,text/plain,application/vnd.ms-excel"
            ref={fileInputRef}
            onChange={handleImportCSV}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            <Upload className="mr-2 h-4 w-4" />
            {isImporting ? 'Importando...' : 'Importar CSV'}
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Link href="/" passHref>
            <Button variant="outline"><Undo2 className="mr-2 h-4 w-4" />Voltar</Button>
          </Link>
        </div>
      </PageTitle>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="list"><Box className="mr-2 h-4 w-4" />Listar Materiais</TabsTrigger>
          <TabsTrigger value="register" onClick={handleRegisterClick}>
            <PlusCircle className="mr-2 h-4 w-4" />Novo Material
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="list" className="mt-6">
          {!isLoaded ? (
            <div className="space-y-4">
              <Skeleton className="h-[200px] w-full" />
            </div>
          ) : (
            <MaterialList 
              materiais={materiais} 
              searchId={searchId}
              onEdit={(m) => {
                setSelectedMaterial(m);
                form.reset({
                  ...m,
                  idMaterial: m.idMaterial || ""
                });
                setIsEditDialogOpen(true);
              }}
              onDelete={async (id) => {
                const res = await deleteMaterial(id);
                if (res.success) toast({ title: "Excluído", description: "Material removido do catálogo." });
                else toast({ title: "Erro", description: res.message, variant: "destructive" });
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="register" className="mt-6">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle>Cadastrar Novo Material</CardTitle>
              <CardDescription>Adicione um novo produto, insumo ou medicamento ao estoque.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="codigo" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código Interno</FormLabel>
                        <FormControl><Input placeholder="Ex: MAT001" disabled {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="idMaterial" render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID Material</FormLabel>
                        <FormControl><Input placeholder="Opcional" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="descricao" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição do Material / Produto</FormLabel>
                        <FormControl><Input placeholder="Nome descritivo" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="categoria" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a categoria" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <FormField control={form.control} name="unidade" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unidade de Medida</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a unidade" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Caixa">Caixa</SelectItem>
                            <SelectItem value="Unidade">Unidade</SelectItem>
                            <SelectItem value="Frasco">Frasco</SelectItem>
                            <SelectItem value="Pacote">Pacote</SelectItem>
                            <SelectItem value="Outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="estoque" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade em Estoque</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="precoUnitario" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preço Unitário (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" min="0" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <Button type="submit">Salvar Material</Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Editar Material</DialogTitle>
            <DialogDescription>Modifique os dados de estoque e precificação do item selecionado.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleFormSubmit)} id="edit-material-form" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="codigo" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código Interno</FormLabel>
                        <FormControl><Input placeholder="Ex: MAT001" disabled {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="idMaterial" render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID Material</FormLabel>
                        <FormControl><Input placeholder="Opcional" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="descricao" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição do Material / Produto</FormLabel>
                        <FormControl><Input placeholder="Nome descritivo" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="categoria" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a categoria" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <FormField control={form.control} name="unidade" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unidade de Medida</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a unidade" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Caixa">Caixa</SelectItem>
                            <SelectItem value="Unidade">Unidade</SelectItem>
                            <SelectItem value="Frasco">Frasco</SelectItem>
                            <SelectItem value="Pacote">Pacote</SelectItem>
                            <SelectItem value="Outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="estoque" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade em Estoque</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="precoUnitario" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preço Unitário (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" min="0" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
              </form>
            </Form>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
            <Button type="submit" form="edit-material-form">Salvar Alterações</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
