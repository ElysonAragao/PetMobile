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
