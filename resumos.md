# Resumo de Alterações - PetMobile

Este documento registra as melhorias, migrações e personalizações realizadas no projeto PetMobile para diferenciá-lo e evoluí-lo em relação à base original do PacienteMobile.

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
