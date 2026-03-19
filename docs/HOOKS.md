# 🪝 Hooks Customizados

Todos em `src/hooks/`.

---

## `usePatients` (`use-patients.ts`)

CRUD completo de pacientes.

| Função | Descrição |
|---|---|
| `patients` | Lista de pacientes (tempo real) |
| `isLoaded` | Se os dados foram carregados |
| `addPatient(data)` | Adiciona paciente |
| `updatePatient(id, data)` | Atualiza paciente |
| `deletePatient(id)` | Remove paciente |
| `getNextPatientCode()` | Gera próximo código `PAC-XXXX` |

---

## `useExams` (`use-exams.ts`)

CRUD completo de exames.

| Função | Descrição |
|---|---|
| `exams` | Lista de exames (tempo real) |
| `isLoaded` | Se os dados foram carregados |
| `addExam(data)` | Adiciona exame |
| `updateExam(id, data)` | Atualiza exame |
| `deleteExam(id)` | Remove exame |
| `deleteAllExams()` | Remove todos os exames |
| `getNextExamCode(firestore, type)` | Gera próximo código (`LAB-XXXX` ou `IMG-XXXX`) |

---

## `useMedicos` (`use-medicos.ts`)

CRUD completo de médicos.

| Função | Descrição |
|---|---|
| `medicos` | Lista de médicos (tempo real) |
| `isLoaded` | Se os dados foram carregados |
| `addMedico(data)` | Adiciona médico |
| `updateMedico(id, data)` | Atualiza médico |
| `deleteMedico(id)` | Remove médico |
| `getNextMedicoCode(firestore)` | Gera próximo código `MED-XXXX` |

---

## `useHealthPlans` (`use-health-plans.ts`)

CRUD completo de planos de saúde.

| Função | Descrição |
|---|---|
| `healthPlans` | Lista de planos (tempo real) |
| `isLoaded` | Se os dados foram carregados |
| `addHealthPlan(data)` | Adiciona plano |
| `updateHealthPlan(id, data)` | Atualiza plano |
| `deleteHealthPlan(id)` | Remove plano |
| `getNextPlanCode()` | Gera próximo código |

---

## `useUserManagement` (`use-user-management.ts`)

CRUD de usuários do sistema.

| Função | Descrição |
|---|---|
| `users` | Lista de usuários (tempo real) |
| `isLoaded` | Se os dados foram carregados |
| `addUser(data)` | Adiciona usuário |
| `updateUser(id, data)` | Atualiza usuário |
| `deleteUser(id)` | Remove usuário |
| `getNextUserNumber()` | Gera próximo número de usuário |

---

## `useToast` (`use-toast.ts`)

Sistema de notificações toast (ShadCN).

| Função | Descrição |
|---|---|
| `toast({ title, description, variant })` | Exibe notificação |
| `dismiss(id)` | Remove toast |
| `toasts` | Lista de toasts ativos |

---

## `useLocalStorage` (`use-local-storage.ts`)

Persiste estado no `localStorage` com serialização JSON.

```ts
const [value, setValue] = useLocalStorage<T>(key, initialValue);
```

---

## `useMobile` (`use-mobile.tsx`)

Detecta se a tela é mobile (< 768px).

```ts
const isMobile = useMobile(); // boolean
```

---

## `usePrintData` (`use-print-data.ts`)

Hook auxiliar para passar dados para a página de impressão.

```ts
const { data, setData } = usePrintData();
```
