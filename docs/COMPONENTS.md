# 🧩 Componentes

## Componentes UI (ShadCN)

Todos em `src/components/ui/`. Gerados via ShadCN CLI, baseados em Radix UI.

| Componente | Arquivo | Usado em |
|---|---|---|
| Accordion | `accordion.tsx` | — |
| AlertDialog | `alert-dialog.tsx` | Exclusão de registros |
| Alert | `alert.tsx` | Erros de login |
| Avatar | `avatar.tsx` | Header |
| Badge | `badge.tsx` | Tipo de exame |
| Button | `button.tsx` | Todos |
| Calendar | `calendar.tsx` | Validade de usuário |
| Card | `card.tsx` | Home, Login, Movement |
| Carousel | `carousel.tsx` | — |
| Chart | `chart.tsx` | — |
| Checkbox | `checkbox.tsx` | Seleção de exames |
| Collapsible | `collapsible.tsx` | — |
| Command | `command.tsx` | Combobox (Movement) |
| Dialog | `dialog.tsx` | Edição de registros |
| DropdownMenu | `dropdown-menu.tsx` | Header (logout) |
| Form | `form.tsx` | Todos os formulários |
| Input | `input.tsx` | Todos os formulários |
| Label | `label.tsx` | Formulários |
| Menubar | `menubar.tsx` | — |
| Popover | `popover.tsx` | Calendar, Combobox |
| Progress | `progress.tsx` | — |
| RadioGroup | `radio-group.tsx` | Tipo de exame |
| ScrollArea | `scroll-area.tsx` | Lista de exames |
| Select | `select.tsx` | Plano de saúde, Status |
| Separator | `separator.tsx` | — |
| Sheet | `sheet.tsx` | — |
| Sidebar | `sidebar.tsx` | — |
| Skeleton | `skeleton.tsx` | — |
| Slider | `slider.tsx` | — |
| Switch | `switch.tsx` | — |
| Table | `table.tsx` | Listagens |
| Tabs | `tabs.tsx` | Páginas CRUD |
| Textarea | `textarea.tsx` | Descrição de exame |
| Toast | `toast.tsx` | Notificações |
| Toaster | `toaster.tsx` | Layout raiz |
| Tooltip | `tooltip.tsx` | — |

## Componentes Customizados

### Auth

| Componente | Arquivo | Descrição |
|---|---|---|
| AuthGuard | `components/auth/auth-guard.tsx` | Protege rotas, redireciona para login |

### Layout

| Componente | Arquivo | Descrição |
|---|---|---|
| ConditionalLayout | `components/layout/conditional-layout.tsx` | Aplica layout com header exceto em login/print |
| Header | `components/layout/header.tsx` | Barra superior com logo, navegação e logout |
| PageTitle | `components/layout/page-title.tsx` | Título de página padronizado |

### Firebase

| Componente | Arquivo | Descrição |
|---|---|---|
| FirebaseErrorListener | `components/FirebaseErrorListener.tsx` | Escuta e exibe erros do Firebase via toast |
