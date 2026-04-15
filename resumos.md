# Resumo de Alterações - PetMobile

---

## [2026-04-15] - Inteligência de Faturamento e Refinamento de Documentos

### 📊 Visibilidade Financeira e KPIs nos Relatórios
- **Cabeçalhos de Totais Consolidados**: Adicionamos painéis de KPIs (**Total Período**, **Qtd. Exames** e **Contagem de Atendimentos**) em todas as abas críticas de auditoria: 
    - **Guias Emitidas**: Agora exibe o valor potencial de faturamento do período.
    - **Leituras Realizadas**: Mostra o valor real processado.
    - **Faturamento**: Os cartões agora são fixos e universais, eliminando a dependência de filtros manuais para visualização dos totais.
- **Cálculo Dinâmico Multi-Fonte**: O sistema agora cruza dados de leituras com a tabela de faturamento em tempo real para garantir que os valores monetários apareçam mesmo em abas de simples histórico.

### 📄 Refinamento da Visualização de Leituras (Doc View)
- **Correção de Identidade de Documentos**: Resolvemos a falha onde o ícone de "olho" nas Leituras Realizadas abria o título genérico de "Guia". Agora o documento é corretamente identificado como **Comprovante de Leitura de Exames**.
- **Exposição de Metadados Críticos**: O **Código da Leitura** (ex: `LPet...`) e a **Data Real da Leitura** agora são exibidos com destaque no cabeçalho do documento, garantindo paridade total entre o histórico digital e o documento impresso.

### ☁️ Sincronização e Deploy
- **Git Sync**: Consolidação e envio de todas as melhorias acumuladas para o repositório oficial no GitHub.

Este documento registra as melhorias, migrações e personalizações realizadas no projeto PetMobile para diferenciá-lo e evoluí-lo em relação à base original do PacienteMobile.

---

## [2026-04-12] - O Grande Sincronismo Estrutural e Leitura Inteligente (OCR avançado)

### 🧹 Varredura e Limpeza Estrutural do Banco (Dívida Técnica)
- **Eliminação de Constraints Fantasmas**: Identificamos e deletamos chaves estrangeiras (`Foreign Keys`) antigas e minúsculas no Supabase (ex: `leituras_paciente_id_fkey`) que apontavam para tabelas extintas (`pacientes`, `usuarios`), travando o fluxo de inserção de dados. O banco agora roda liso e aponta exclusivamente para as tabelas `pet_pets`, `pet_usuarios` etc.
- **Redirecionamento de JSON das Leituras**: Removemos a tabela ilusória `pet_leitura_exames` do código-fonte e convertemos a persistência dos exames na leitura (Scan) para o campo nativo e flexível `metadata` da própria tabela `pet_leituras`, evitando overhead estrutural.

### 🤖 OCR e Inteligência Artificial (Paridade com PacienteMobile)
- **Extrator NATIVO de PDF**: Importamos do PacienteMobile a incrível lógica de renderização injetada via CDN do `pdf.js`. O PetMobile agora volta a "engolir" solicitações em PDF nativamente sem precisar de conversões manuais e nem estourar as dependências do servidor.
- **Lupa Flexível de Busca (Fuse.js)**: Ajustamos a elasticidade da busca dos Exames Lidos (`threshold: 0.6`). O algoritmo de IA (Tesseract) agora "limpa" os caracteres das imagens (tirando acentos, hífens) e busca palavra por palavra, achando caixinhas de exames que antes passavam ilesas por erro de caligrafia (ou borrão na foto JPG).
- **UX de Segurança na Recepção**: A Leitura Inteligente e a "Digitar Manualmente" agora exigem estritamente a escolha prévia de PET e VETERINÁRIO antes do upload de documentos, impossibilitando a existência de "dados soltos" sem tutor no banco.

---
## [2026-04-08] - Finalização dos Relatórios e Padronização de IDs (G, R, L)

### 📊 Relatórios e Visibilidade de Dados
Hoje consolidamos a central de inteligência do sistema, garantindo que nenhum dado seja perdido:
- **Módulo de Relatórios Reconstruído**: 
    - Restaurada a aba de **Atendimentos (Leituras)** com mecanismo de "Três Níveis" (Relação Direta -> Metadados de Backup -> Fallback Legacy), garantindo dados visíveis mesmo em caso de atraso na indexação.
    - **Equipe Veterinária**: Implementada a listagem completa da equipe com CRMV e status.
    - **Customização de Colunas**: No relatório de Pets, trocamos o campo "Convênio" pelo **Telefone do Tutor**, priorizando o contato direto.
- **Painel Master Restaurado**: 
    - Corrigida a invisibilidade de dados no Painel Master através da atualização das rotas de API para as tabelas prefixadas (`pet_empresas` e `pet_usuarios`).
    - Adicionada a coluna **"Cód. Empresa"** na listagem de usuários para identificação imediata das unidades.

### 🆔 Padronização de Identificação Profissional
Implementamos um sistema de IDs altamente escalável e autoexplicativo:
- **Prefixos Inteligentes**: 
    - **G**: Guia de Solicitação Veterinária (Ex: `GPet001202600001`).
    - **R**: Recepção / Entrada Manual (Ex: `RPet001202600001`).
    - **L**: Leitura de Scan / Atendimento (Ex: `LPet001202600001`).
- **Sincronização com Código Clínico**: O sistema agora respeita rigorosamente o código cadastrado no Painel Master (Ex: `Pet001`, `AlphaVet`, etc).
- **Sequência Expandida**: Aumentamos o preenchimento (padding) para **5 dígitos** finais, permitindo até 99.999 registros por unidade/ano.

### 🔧 Estabilização Técnica
- **Resiliência no Scan**: O processo de registro de leituras agora salva nomes e dados críticos em uma coluna de metadados JSONB, servindo como uma "caixa preta" de segurança para auditorias futuras.
- **Correção de Cache de Sessão**: Ajustada a lógica de resolução de códigos para garantir que mudanças no Painel Master reflitam instantaneamente na emissão de guias.

---
*Status Atual: Sistema 100% operacional. Relatórios, Scan e Painel Administrativo totalmente sincronizados com o padrão PetMobile.*

---

## [2026-04-08] - Grande Sincronização de Sistemas e Estabilização do Banco

### 🔄 Sincronização PetMobile ↔️ PacienteMobile (Paridade Total)
- **Movimentação (Gerar Guia)**: 
    - Implementada **Busca em Tempo Real** no seletor de Pets e Veterinários.
    - Adicionado **Filtro Inteligente de Exames** (mostra apenas exames cobertos pelo plano de saúde do pet).
- **Scan (Scanner Central)**: 
    - Migrada a lógica de **Validação de Guia** diretamente no banco de dados.
    - Interface de scanner com feedback visual de enquadramento.
- **Relatórios Analíticos**: 
    - Criada a central de relatórios com **Filtros de Data (Período)**, Veterinário e Plano.
    - Tabelas agora permitem ordenação por qualquer coluna.

---

## [2026-04-05] - Gestão de Senhas e Hierarquia de Acesso

### 🔐 Segurança e Autenticação
- **Reset de Senha Administrativo**: Capacidade de forçar a troca de senha diretamente no painel.
- **Correção da Tela de Login**: Ajustada a lógica de auto-redirect para aguardar "Troca Obrigatória de Senha".

### 👔 Hierarquia Multi-Tenant
- **Limites de Validade Cascata**: Rigor no teto de validade entre Master -> Administrador -> Usuário.

---

## [2026-03-24] - Migração de Rotina e Inteligência de Setup

### 🆕 Novas Funcionalidades e Melhorias
- **Leitura Inteligente (OCR)**: Integrado `tesseract.js` para reconhecimento de texto.
- **Busca de Exames (Fuse.js)**: Motor de busca aproximada para seleção manual.
- **Setup Inicial Automático**: Rota `/api/setup` para auto-configuração do primeiro Master.
- **Nomenclatura (Pet Context)**: Substituição de termos médicos por termos veterinários: "Paciente" ➔ **"Pet"**, "CPF" ➔ **"Chip/CPF"**, etc.
