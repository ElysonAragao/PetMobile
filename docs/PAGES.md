# 📄 Páginas e Rotas

## Mapa de Rotas

| Rota | Arquivo | Acesso | Descrição |
|---|---|---|---|
| `/` | `app/page.tsx` | Autenticado | Dashboard com navegação |
| `/login` | `app/login/page.tsx` | Público | Tela de login |
| `/patients` | `app/patients/page.tsx` | Autenticado | CRUD de Pacientes |
| `/exams` | `app/exams/page.tsx` | Autenticado | CRUD de Exames |
| `/medicos` | `app/medicos/page.tsx` | Autenticado | CRUD de Médicos |
| `/planos-saude` | `app/planos-saude/page.tsx` | Autenticado | CRUD de Planos |
| `/movement` | `app/movement/page.tsx` | Autenticado | Movimentação + QR |
| `/scan` | `app/scan/page.tsx` | Autenticado | Leitura de QR Code |
| `/print/[data]` | `app/print/[data]/page.tsx` | Público | Impressão de guia |
| `/users` | `app/users/page.tsx` | Admin | Gerenciar usuários |

---

## `/` — Home / Dashboard

- Exibe cards de navegação para cada funcionalidade
- Cards de "Gerenciar Usuários" visível apenas para Administradores
- Componentes: `Card`, `Link`, ícones Lucide

## `/login` — Login

- Formulário com e-mail e senha
- Validação com Zod
- Usa `useSession().login()` para autenticar
- Componentes: `Card`, `Form`, `Input`, `Button`, `Alert`

## `/patients` — Pacientes

- **Aba "Registrar"**: formulário completo com CPF, endereço, telefone, matrícula, plano de saúde (select dinâmico)
- **Aba "Listar"**: tabela com busca, ordenação por coluna, edição e exclusão
- Código do paciente gerado automaticamente
- Verifica CPF duplicado ao sair do campo
- Componentes: `Tabs`, `Form`, `Table`, `Dialog`, `AlertDialog`, `Select`

## `/exams` — Exames

- **Aba "Registrar"**: nome, descrição, tipo (Laboratório/Imagem com RadioGroup)
- **Aba "Listar"**: tabela com busca, filtro por tipo (Badge), ordenação
- Código do exame gerado automaticamente com prefixo (`LAB-` ou `IMG-`)
- Suporta "Excluir Todos"
- Componentes: `Tabs`, `Form`, `Table`, `RadioGroup`, `Badge`, `Dialog`

## `/medicos` — Médicos

- **Aba "Registrar"**: nome e CRM
- **Aba "Listar"**: tabela com busca, ordenação, edição e exclusão
- Código do médico gerado automaticamente (`MED-XXXX`)
- Componentes: `Tabs`, `Form`, `Table`, `Dialog`, `AlertDialog`

## `/planos-saude` — Planos de Saúde

- **Aba "Registrar"**: nome do plano
- **Aba "Listar"**: tabela com edição e exclusão
- Código do plano gerado automaticamente
- Componentes: `Tabs`, `Form`, `Table`, `Dialog`, `AlertDialog`

## `/movement` — Movimentação

- Formulário multi-etapas:
  1. Selecionar paciente (combobox com busca)
  2. Selecionar médico (combobox com busca)
  3. Selecionar exames (checkboxes, scroll area)
  4. Gera guia com QR Code
- QR Code gerado via API externa (`api.qrserver.com`)
- Botão para visualizar/imprimir guia
- Componentes: `Form`, `Command`, `Popover`, `Checkbox`, `ScrollArea`, `Card`

## `/scan` — Leitura de QR Code

- Modo câmera: usa `getUserMedia` + `jsQR` para decodificar em tempo real
- Modo arquivo: upload de imagem com QR Code
- Busca manual por ID da movimentação
- Exibe dados decodificados: paciente, médico, exames
- Botão para imprimir guia
- Componentes: `Card`, `Button`, `Input`, `Table`

## `/print/[data]` — Impressão

- Rota pública (sem autenticação)
- Recebe dados via parâmetro dinâmico (base64 encoded)
- Renderiza guia formatada para impressão
- CSS específico para `@media print`

## `/users` — Usuários

- **Aba "Cadastrar"**: nome, e-mail, senha, status (Admin/User), data de validade
- **Aba "Listar"**: tabela com edição e exclusão
- Primeiro acesso: redireciona automaticamente para cadastrar o admin
- Visível apenas para Administradores (após primeiro acesso)
- Componentes: `Tabs`, `Form`, `Table`, `Dialog`, `Calendar`, `Popover`, `Select`
