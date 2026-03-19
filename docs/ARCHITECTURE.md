# 🏗️ Arquitetura do Projeto

## Visão Geral

O PacienteMobile segue a arquitetura do **Next.js App Router** com renderização no cliente (`"use client"`) para todas as páginas interativas. O backend é 100% **Firebase Firestore** (sem API routes do Next.js).

## Diagrama de Camadas

```
┌─────────────────────────────────────────┐
│              Páginas (App Router)        │
│     /patients  /exams  /movement  ...   │
├─────────────────────────────────────────┤
│          Componentes UI (ShadCN)         │
│    Button, Card, Dialog, Table, Form    │
├─────────────────────────────────────────┤
│            Hooks Customizados            │
│  usePatients, useExams, useMedicos...   │
├─────────────────────────────────────────┤
│          Firebase Layer                  │
│  FirebaseProvider → useCollection/Doc   │
├─────────────────────────────────────────┤
│           Firestore Database             │
│   pacientes, exames, medicos, usuarios  │
└─────────────────────────────────────────┘
```

## Fluxo de Dados

1. **`FirebaseClientProvider`** inicializa o Firebase no layout raiz
2. **`SessionProvider`** gerencia autenticação (login por e-mail/senha no Firestore)
3. **`AuthGuard`** protege rotas — redireciona para `/login` se não autenticado
4. Hooks como **`usePatients`** usam **`useCollection`** para escutar dados em tempo real
5. Páginas consomem hooks e renderizam com componentes ShadCN

## Padrão de Autenticação

O sistema **não usa Firebase Auth**. A autenticação é feita via consulta direta ao Firestore:
- Coleção `usuarios` armazena e-mail, senha (texto plano) e status
- `SessionProvider` valida credenciais e persiste sessão no `localStorage`
- `AuthGuard` verifica autenticação em cada navegação

## Padrão de CRUD

Cada entidade (Pacientes, Exames, Médicos, etc.) segue o mesmo padrão:
1. **Hook customizado** (`usePatients`, `useExams`, etc.) — CRUD + listener em tempo real
2. **Página com abas** — "Registrar" + "Listar"
3. **Form com Zod** — validação client-side
4. **Dialog para edição** — reutiliza o mesmo formulário
5. **AlertDialog para exclusão** — confirmação antes de deletar

## Estrutura de Pastas

| Pasta | Responsabilidade |
|---|---|
| `src/app/` | Rotas e páginas (App Router) |
| `src/components/ui/` | Componentes ShadCN (não modificar diretamente) |
| `src/components/auth/` | AuthGuard |
| `src/components/layout/` | Header, ConditionalLayout, PageTitle |
| `src/context/` | SessionProvider |
| `src/firebase/` | Config, init, providers, hooks Firestore |
| `src/hooks/` | Hooks customizados de domínio |
| `src/lib/` | Types, utils |
| `docs/` | Documentação do projeto |
