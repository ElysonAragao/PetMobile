# 🐾 PetMobile (v2.8)

Sistema integrado de gestão veterinária para clínicas e profissionais, focado em Pets, Tutores e Guias de Exame com QR Code.

> [!NOTE]
> Este projeto é uma evolução direta do **PacienteMobile**, adaptado para o contexto veterinário (Pet-Centric).

## ✨ Funcionalidades

- **Cadastro de Pets** — Nome, Espécie, Raça, Sexo e Tutor.
- **Gestão de Tutores** — Vínculo direto com os Pets para faturamento e contato.
- **Cadastro de Veterinários** — Gestão de profissionais com suporte a CRMV.
- **Planos de Saúde/Convênios** — Suporte a múltiplos convênios veterinários.
- **Movimentação (Guias)** — Geração automática de guias de exame com QR Code único.
- **Leitura de QR Code** — Leitura rápida de guias via câmera ou upload para registro de exames.
- **Multi-tenancy (Empresas)** — Suporte a múltiplas clínicas isoladas dentro do mesmo sistema.
- **Gestão Master** — Painel administrativo para controle de empresas e usuários associados.

## 🛠️ Tech Stack

| Camada | Tecnologia |
|---|---|
| **Framework** | Next.js 14 (App Router) |
| **Linguagem** | TypeScript |
| **UI** | ShadCN UI + Radix UI |
| **Estilização** | Tailwind CSS 3 |
| **Backend/Database** | Supabase (PostgreSQL + Auth + RLS) |
| **Validação** | Zod + React Hook Form |
| **Gráficos** | Recharts (Dashboards de atendimento) |
| **QR Code** | jsQR (leitura), api.qrserver.com (geração) |

## 🚀 Quick Start

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Rodar acessível na rede local (para testes em dispositivos móveis)
npm run dev:lan

# Build de produção
npm run build
```

## 📁 Estrutura do Projeto

```
src/
├── app/            # Páginas e Rotas (Início, Pets, Veterinários, Movimentação, Scan)
├── components/     # Componentes de UI (ShadCN) e Layouts Condicionais
├── context/        # SessionProvider (Gestão de Sessão via Supabase)
├── hooks/          # Hooks customizados (usePets, useVeterinarios, useMovement)
├── lib/            # Tipos globais e Configuração do Cliente Supabase
└── firebase/       # (Legado) Arquivos de migração do projeto original
```

## 📜 Histórico de Transformação (Paciente ➡️ Pet)

Este projeto passou por uma migração tecnológica e semântica completa:

1. **Migração de Banco**: Transição de Firebase Firestore para **Supabase**, com implementação de **Row Level Security (RLS)** para multi-tenancy.
2. **Adaptação Semântica**:
   - `Pacientes` ➡️ `Pets`
   - `Médicos` ➡️ `Veterinários`
   - `CRM` ➡️ `CRMV`
   - Adição de `Espécie`, `Raça`, `Sexo` e `Tutor`.
3. **Identificação de Guias**:
   - Prefixo **G**: Guia Médica/Veterinária.
   - Prefixo **R**: Guia gerada pela Recepção.
   - Prefixo **L**: Registro de Leitura Final.

## 📄 Licença

Projeto privado — Uso interno e restrito.
