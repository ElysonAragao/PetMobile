# 📋 Tipos TypeScript

Todas as interfaces estão em `src/lib/types.ts`.

---

## `Patient`

Representa um paciente cadastrado.

```ts
interface Patient {
  id: string;           // ID do documento Firestore
  codPaciente: string;  // Código único (ex: "PAC-0001")
  name: string;         // Nome completo
  endereco: string;     // Endereço
  telefone: string;     // Telefone
  cpf: string;          // CPF (único)
  healthPlanCode: string; // Código do plano de saúde
  healthPlanName: string; // Nome do plano de saúde
  matricula: string;    // Matrícula no plano
}
```

---

## `Exam`

Representa um tipo de exame.

```ts
interface Exam {
  id: string;           // ID do documento Firestore
  examCode: string;     // Código ("LAB-0001" ou "IMG-0001")
  name: string;         // Nome do exame
  description: string;  // Descrição
  type: 'Laboratório' | 'Imagem'; // Tipo do exame
}
```

---

## `Medico`

Representa um médico.

```ts
interface Medico {
  id: string;     // ID do documento Firestore
  codMed: string; // Código ("MED-0001")
  name: string;   // Nome
  crm: string;    // Registro CRM
}
```

---

## `HealthPlan`

Representa um plano de saúde / convênio.

```ts
interface HealthPlan {
  id: string;       // ID do documento Firestore
  codPlano: string; // Código do plano
  nome: string;     // Nome do plano
}
```

---

## `Movimentacao`

Representa uma movimentação (guia de exame gerada).

```ts
interface Movimentacao {
  id: string;          // ID do documento Firestore
  movimentoId: string; // Código da movimentação
  pacienteId: string;  // ID do paciente
  medicoId: string;    // ID do médico
  exameIds: string[];  // IDs dos exames solicitados
  data: string;        // Data (ISO String)
}
```

---

## `QrData`

Dados codificados no QR Code da guia.

```ts
interface QrData {
  patient: Patient;     // Dados completos do paciente
  exams: Exam[];        // Lista de exames
  medico: Medico;       // Dados do médico
  movimentoId: string;  // Código da movimentação
  data: string;         // Data
}
```

---

## `Usuario`

Representa um usuário do sistema.

```ts
interface Usuario {
  id: string;           // ID do documento Firestore
  numUsuario: string;   // Número do usuário
  nome: string;         // Nome
  email: string;        // E-mail (usado no login)
  password?: string;    // Senha (texto plano)
  status: 'Administrador' | 'User'; // Nível de acesso
  dataCadastro: string; // Data de cadastro (ISO)
  dataValidade: string; // Data de validade (YYYY-MM-DD)
}
```

> ⚠️ **Nota de segurança:** O campo `password` é armazenado em texto plano no Firestore. Isso não é seguro para produção com dados sensíveis. Considere migrar para Firebase Authentication.
