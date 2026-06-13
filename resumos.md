# Resumo de Alterações - PetMobile

## [2026-06-13] - Otimização de Orçamentos e Laboratório de OCR (Tatuagens)

### 📄 Refinamentos no Orçamento e Impressão PDF
- **Categorização de Materiais**: Padronização global das categorias (Alimento, Material, Medicamento/Suplemento, Equipamento, Insumo, Outro).
- **Auto-preenchimento de ID**: O sistema agora aproveita o código sequencial gerado para preencher o `ID Material` de forma automática caso o usuário o deixe em branco durante o cadastro/edição.
- **Detalhamento no PDF**: A tabela impressa de materiais agora mostra explicitamente a conta matemática de preço unitário e quantidade (`2x R$ 50.00 = R$ 100.00`).
- **Quebra de Página Avançada**: Implementada tabela inteligente (`thead`) que repete automaticamente o cabeçalho "Continuação - Orçamento - OPet..." nas impressões longas que passam para a segunda página.
- **Status de Leitura no PDF**: Documentos impressos a partir do Scanner agora são nomeados como "LEITURA DO ORÇAMENTO" e exibem uma tag de status verde/vermelha mostrando `(NA VALIDADE)` ou `(VENCIDO)`.

### 🔍 Laboratório Experimental de OCR (Tatuagens)
- **Leitura Inteligente de Tatuagens**: Instalação e integração local da biblioteca `Tesseract.js` para reconhecimento de padrões numéricos em pele de animais.
- **Novo Módulo de Teste**: Criada a rota laboratorial `/tattoo-scan` (Leitura de Tatuagem - Teste), permitindo o upload de fotos da pele do pet para extração imediata do código.
- **Calibração de IA**: Configuração de "Whitelist" no motor de OCR, forçando a IA a ignorar ruídos (sombras e pelos) e procurar exclusivamente por números, letras e traços, elevando a confiabilidade do processo para testes de campo.

## [2026-06-11] - Módulo Completo de Orçamentos e Exportação

### 📄 PDF e Layout Profissional de Orçamentos
- **Tela de Impressão Dedicada**: Nova rota `/print/orcamento/[id]` com cabeçalho focado em Dados do Cliente (Nome, Complemento e Plano), além de Data de Emissão e Validade.
- **Padrão de Código OPet**: Geração de códigos amigáveis com identificação de ano e sequencial (Ex: `OPet20261234`).
- **QR Code Rastreável**: Impressão automática do QR Code do orçamento na folha PDF para facilitar leitura futura no balcão.

### 💾 Persistência em Nuvem (Supabase)
- **Criação da Tabela pet_orcamentos**: Script de banco de dados (`_projeto_docs/database_schemas/orcamentos.sql`) com armazenamento em JSONB para Exames e Materiais, protegendo o orçamento contra alterações futuras de preço no sistema.
- **Integração Completa (CRUD)**: Desenvolvimento do hook `useOrcamentos` para gravação e recuperação instantânea dos dados via banco de dados Supabase com RLS desativado para testes.

### 📷 Leitura e Scanner Inteligente (Hub de Operações)
- **Hub Intermediário**: Ao acessar o módulo, a tela se divide entre "Novo Orçamento" e "Ler Orçamento", facilitando a rotina.
- **Scanner Dedicado (`/orcamento/scan`)**: Rotina de câmera que lê os QR Codes antigos, resgata no banco e lista tudo de forma colorida na tela do celular ou computador.
- **Modais de Confirmação**: Inseridos modais na ação de "Voltar" (Undo) das telas de impressão para direcionar corretamente a jornada (Nova Leitura vs Novo Orçamento).

### 📊 Múltiplos Formatos de Exportação
- **Botões Dinâmicos**: Inclusão das ações `CSV`, `XML`, `JSON` e `Excel (XLS)` na tela do scanner do orçamento.
- **Funções de Conversão Nativas**: Sem dependências pesadas, o sistema gera os pacotes `Blob` e entrega planilhas HTML formatadas e tabelas para cruzamento de dados na própria memória do navegador.

## [2026-04-26] - Suporte Multi-Câmeras e Resiliência de Hardware
    
### 🎥 Sistema de Câmeras Híbrido (USB + Integrada)
- **Seleção Dinâmica de Dispositivos**: Implementada a capacidade de alternar instantaneamente entre a câmera frontal/notebook e webcams USB externas tanto no scanner quanto no visualizador.
- **Detecção em Tempo Real**: Novo botão "Atualizar Câmeras" que detecta novos dispositivos conectados (Plug & Play) sem precisar recarregar a página.
- **Visualizador Fullscreen dedicada**: Criada a página `/cameras` que permite testar a qualidade, o enquadramento e a estabilidade de todos os dispositivos de vídeo em tamanho real.

### 🛠️ Estabilização e Tratamento de Hardware (Windows/USB)
- **Prevenção de Locks de Hardware**: Implementado o gerenciamento agressivo de fluxos (`streamRef`) para garantir que uma câmera seja 100% desligada antes que outra tente iniciar, evitando o erro de "Câmera em uso por outro programa".
- **Resiliência de Inicialização**: Adicionado um atraso de segurança (500ms) e trava de concorrência (`switchingRef`) para sincronizar a liberação de drivers do sistema operacional durante a troca rápida de dispositivos.
- **Ajuste de Compatibilidade**: Redução da resolução ideal para 720p com fallback automático, garantindo que webcams USB de diferentes marcas e qualidades funcionem sem travar.

### 🔗 UX e Integração
- **Atalho no Menu Principal**: Inclusão do card "Visualizar Câmeras" no dashboard para acesso administrativo e médico.
- **Link Direto no Scanner**: Opção de abrir o visualizador em tela cheia diretamente da interface de escaneamento de QR Code para ajustes finos.

---

## [2026-04-21] - Planejamento: Prontuário Digital e Documentos Clínicos

### 🏥 Arquitetura do Prontuário Digital (Proposta Aceita)
- **Centralização de Eventos Clínicos**: Implementação da tabela `pet_prontuarios` vinculada a `pet_pets` e `pet_usuarios` (MedicoVet).
- **Campos Estruturados**: Histórico com Data de Atendimento, Tipo (Consulta, Exame, Procedimento, Retorno), Descrição Livre e Prescrição Médica.
- **Lógica de Retorno Inteligente**: Monitoramento do período de 30 dias para consultas de retorno, com sinalização de status (Ativo/Expirado).
- **Integração de Exames**: Vínculo direto com a tabela `pet_exames` para solicitações e registro de evolução.

### 📄 Gestão de Documentos e Laudos
- **Storage de Imagens**: Uso do Supabase Storage para armazenamento de fotos de exames, laudos e evolução clínica diretamente no prontuário.
- **Módulo de Registros Dinâmicos**: Tabela `pet_documentos_clinicos` para geração e armazenamento de **Receitas**, **Atestados**, **Recibos** e **Guias de Internação** pré-formatados com dados do paciente.
- **Templates Flexíveis**: Sistema de modelos para anamnese (perguntas padrão) e documentos, permitindo padronização entre diferentes tipos de atendimento.

### 🛡️ Segurança e UX Médica
- **Restrição por Perfil**: Implementação de RLS (Row Level Security) garantindo que a edição de prontuários seja exclusiva para o perfil `MedicoVet`.
- **Preenchimento Automático**: Interface otimizada para carregar dados do Tutor e do Plano de Saúde instantaneamente ao selecionar o Pet.

---

## [2026-04-16] - Padronização de Relatórios e Gestão de Ambiente (Master)

### 📊 Auditoria e Relatórios de Usuários
- **Paridade com Gestão de Usuários**: O relatório de usuários foi redesenhado para exibir as mesmas colunas da rotina de gerenciamento: **Número**, **Nome**, **E-mail**, **Perfil**, **Telefone**, **Cadastro**, **Validade** e **Situação**.
- **Indicador de Situação Inteligente**: Adicionada a coluna **Situação** (Ativo/Inativo), que calcula o status do usuário em tempo real comparando a data atual com a validade cadastrada.
- **UX de Auditoria**: A coluna de **Validade** foi movida para o final do relatório (penúltima), melhorando a visualização rápida do tempo de vida da conta.

### 🛠️ Controle de Ambiente Experimental (Clean Setup)
- **Zerar Movimentação (Master Only)**: Implementada função crítica para o perfil Master que permite realizar o "Wipe" (limpeza total) de **Movimentações**, **Leituras** e **Faturamento** de uma clínica específica.
- **Apoio a Demonstrações/Testes**: Esta função permite que uma clínica utilize o sistema em caráter experimental e, após o período de testes, o Master limpe os dados de teste para iniciar o monitoramento real sem resíduos.
- **Segurança de Dados Estruturais**: O processo de limpeza preserva todos os cadastros base (Pets, Exames, Veterinários e Usuários), evitando o retrabalho de reconfiguração do sistema.

### 📤 Padronização de Exportação (Modelos CSV)
- **Botões de Exportação/Modelo**: Adicionamos o botão "Exportar CSV (Modelo)" em todas as rotinas de cadastro (Pets, Exames, Veterinários e Planos de Saúde). 
- **Facilitação de Importação**: O arquivo gerado serve como template oficial, garantindo que o usuário saiba exatamente o padrão necessário para futuras importações em lote.

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
