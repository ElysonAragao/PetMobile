# 🏥 PacienteMobile

Sistema integrado de gestão de pacientes e exames com geração e leitura de QR Codes.

## ✨ Funcionalidades

- **Cadastro de Pacientes** — nome, CPF, endereço, telefone, plano de saúde
- **Cadastro de Exames** — laboratório e imagem, com código automático
- **Cadastro de Médicos** — nome e CRM
- **Planos de Saúde** — gestão de convênios
- **Movimentação** — gerar guias de exame com QR Code
- **Leitura de QR Code** — ler guias via câmera ou upload
- **Impressão de Guias** — visualização e impressão em PDF
- **Gerenciamento de Usuários** — administrador e operador, com validade

## 🛠️ Tech Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14 (App Router) |
| Linguagem | TypeScript |
| UI | ShadCN UI + Radix UI |
| Estilização | Tailwind CSS 3 |
| Backend/Database | Firebase Firestore |
| Validação | Zod + React Hook Form |
| Gráficos | Recharts |
| QR Code | jsQR (leitura), api.qrserver.com (geração) |

## 🚀 Quick Start

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Rodar acessível na rede local (mobile)
npm run dev:lan

# Build de produção
npm run build
```

## 📁 Estrutura do Projeto

```
src/
├── app/            # Páginas (App Router)
│   ├── page.tsx          # Home / Dashboard
│   ├── login/            # Login
│   ├── patients/         # CRUD de Pacientes
│   ├── exams/            # CRUD de Exames
│   ├── medicos/          # CRUD de Médicos
│   ├── planos-saude/     # CRUD de Planos de Saúde
│   ├── movement/         # Movimentação / Geração de QR
│   ├── scan/             # Leitura de QR Code
│   ├── print/[data]/     # Impressão de Guias
│   └── users/            # Gerenciamento de Usuários
├── components/     # Componentes React
│   ├── ui/               # 36 componentes ShadCN
│   ├── auth/             # AuthGuard
│   └── layout/           # Header, ConditionalLayout
├── context/        # SessionProvider (auth por sessão)
├── firebase/       # Config, providers, hooks Firestore
├── hooks/          # 9 hooks customizados
└── lib/            # Tipos, utilitários
```

## 📚 Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Setup e Configuração](docs/SETUP.md)
- [Páginas e Rotas](docs/PAGES.md)
- [Componentes](docs/COMPONENTS.md)
- [Firebase](docs/FIREBASE.md)
- [Hooks](docs/HOOKS.md)
- [Tipos TypeScript](docs/TYPES.md)
# 🏥 PacienteMobile

Sistema integrado de gestão de pacientes e exames com geração e leitura de QR Codes.

## ✨ Funcionalidades

- **Cadastro de Pacientes** — nome, CPF, endereço, telefone, plano de saúde
- **Cadastro de Exames** — laboratório e imagem, com código automático
- **Cadastro de Médicos** — nome e CRM
- **Planos de Saúde** — gestão de convênios
- **Movimentação** — gerar guias de exame com QR Code
- **Leitura de QR Code** — ler guias via câmera ou upload
- **Impressão de Guias** — visualização e impressão em PDF
- **Gerenciamento de Usuários** — administrador e operador, com validade

## 🛠️ Tech Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14 (App Router) |
| Linguagem | TypeScript |
| UI | ShadCN UI + Radix UI |
| Estilização | Tailwind CSS 3 |
| Backend/Database | Firebase Firestore |
| Validação | Zod + React Hook Form |
| Gráficos | Recharts |
| QR Code | jsQR (leitura), api.qrserver.com (geração) |

## 🚀 Quick Start

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Rodar acessível na rede local (mobile)
npm run dev:lan

# Build de produção
npm run build
```

## 📁 Estrutura do Projeto

```
src/
├── app/            # Páginas (App Router)
│   ├── page.tsx          # Home / Dashboard
│   ├── login/            # Login
│   ├── patients/         # CRUD de Pacientes
│   ├── exams/            # CRUD de Exames
│   ├── medicos/          # CRUD de Médicos
│   ├── planos-saude/     # CRUD de Planos de Saúde
│   ├── movement/         # Movimentação / Geração de QR
│   ├── scan/             # Leitura de QR Code
│   ├── print/[data]/     # Impressão de Guias
│   └── users/            # Gerenciamento de Usuários
├── components/     # Componentes React
│   ├── ui/               # 36 componentes ShadCN
│   ├── auth/             # AuthGuard
│   └── layout/           # Header, ConditionalLayout
├── context/        # SessionProvider (auth por sessão)
├── firebase/       # Config, providers, hooks Firestore
├── hooks/          # 9 hooks customizados
└── lib/            # Tipos, utilitários
```

## 📚 Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Setup e Configuração](docs/SETUP.md)
- [Páginas e Rotas](docs/PAGES.md)
- [Componentes](docs/COMPONENTS.md)
- [Firebase](docs/FIREBASE.md)
- [Hooks](docs/HOOKS.md)
- [Tipos TypeScript](docs/TYPES.md)
- [Deploy](docs/DEPLOY.md)

## 📄 Licença

Projeto privado — uso interno.


### Plano de Transformação (PetMobile)

Este roteiro descreve as fases para adaptar o sistema original (PacienteMobile) para o uso veterinário (PetMobile), focando em infraestrutura, nomenclatura e experiência do usuário.

#### 📋 Fase 1: Infraestrutura e Acesso Master (CONCLUÍDO)
- **Objetivo**: Corrigir erro no cadastro de empresas pelo usuário Master.
- **Ações**: Renomeação de `tenants` para `empresas`, adição de campos de clínica e permissão do status `'Master'`.

#### 📋 Fase 2: Adaptação de Nomenclatura (Animais) (CONCLUÍDO)
- **Objetivo**: Trocar termos humanos por veterinários.
- **Mudanças**: `Pacientes` ➡️ `Pets`, `Médicos` ➡️ `Veterinários`, `CRM` ➡️ `CRMV`.
- **Novos Campos**: Adição de `Espécie`, `Raça`, `Sexo` e `Tutor` (Nome/CPF).

#### 📋 Fase 3: Atualização de Código (Frontend/Hooks) (CONCLUÍDO)
- **Objetivo**: Refletir mudanças na UI e lógica.
- **Ações**: Atualização de `types.ts`, hooks e páginas de cadastro de pets e veterinários.

#### 📋 Fase 4: Registro de Histórico e Documentação (EM ANDAMENTO)
- **Objetivo**: Manter transparência nas modificações realizadas.

---

### História de Modificações e Melhorias

1. **[03/04/2026] Migração PetMobile (Fase 1, 2 e 3):**
   - Criação do plano de transformação completo.
   - Refatoração dos Hooks: `use-patients` → `use-pets`, `use-medicos` → `use-veterinarios`, `use-movement`.
   - Atualização das Páginas: `/pets`, `/veterinarios`, `/movement` e `/print` agora são 100% pet-centric.
   - Adição de novos campos: Espécie, Raça, Sexo, Tutor (Nome, CPF, Contato).
   - Ajuste do cabeçalho de impressão (Header) para padrões veterinários (CRMV).
   - Geração do script SQL de migração da Fase 2 para sincronizar o banco Supabase.
   - Atualização do menu principal com ícones e links veterinários.
