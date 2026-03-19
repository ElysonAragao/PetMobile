# 🔥 Firebase

## Configuração

### `src/firebase/config.ts`

Contém o objeto `firebaseConfig` com as credenciais do projeto Firebase.

### `src/firebase/index.ts`

Ponto de entrada. Exporta:
- `initializeFirebase()` — inicializa o app Firebase (tenta auto-init, fallback para config)
- `getSdks()` — retorna `{ firebaseApp, auth, firestore }`
- Re-exporta todos os providers, hooks e utilitários

## Providers

### `FirebaseProvider` (`src/firebase/provider.tsx`)

Context Provider que disponibiliza os serviços Firebase para toda a árvore de componentes.

**Context State:**
```ts
interface FirebaseContextState {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}
```

**Hooks expostos:**
- `useAuth()` → `Auth`
- `useFirestore()` → `Firestore`
- `useFirebaseApp()` → `FirebaseApp`
- `useMemoFirebase()` → memoização com marca `__memo`

### `FirebaseClientProvider` (`src/firebase/client-provider.tsx`)

Wrapper client-side que chama `initializeFirebase()` uma vez e renderiza o `FirebaseProvider`.

Usado no `layout.tsx` raiz:
```tsx
<FirebaseClientProvider>
  <SessionProvider>
    <AuthGuard>
      {children}
    </AuthGuard>
  </SessionProvider>
</FirebaseClientProvider>
```

## Hooks de Firestore

### `useCollection` (`src/firebase/firestore/use-collection.tsx`)

Escuta uma coleção em tempo real via `onSnapshot`.

**Params:** `collectionName: string`
**Retorno:** `{ data: T[], isLoaded: boolean, error: Error | null }`

### `useDoc` (`src/firebase/firestore/use-doc.tsx`)

Escuta um documento individual em tempo real.

**Params:** `collectionName: string, docId: string`
**Retorno:** `{ data: T | null, isLoaded: boolean, error: Error | null }`

## Tratamento de Erros

### `error-emitter.ts`

Event emitter customizado para propagar erros do Firebase entre componentes.

### `errors.ts`

Mapeamento de códigos de erro Firebase para mensagens amigáveis em português.

### `FirebaseErrorListener` (componente)

Escuta erros via `error-emitter` e exibe toasts com as mensagens traduzidas.

## Coleções do Firestore

| Coleção | Tipo | Campos Principais |
|---|---|---|
| `pacientes` | Patient | codPaciente, name, cpf, endereco, telefone, healthPlanCode, healthPlanName, matricula |
| `exames` | Exam | examCode, name, description, type |
| `medicos` | Medico | codMed, name, crm |
| `planos` | HealthPlan | codPlano, nome |
| `movimentacoes` | Movimentacao | movimentoId, pacienteId, medicoId, exameIds, data |
| `usuarios` | Usuario | numUsuario, nome, email, password, status, dataCadastro, dataValidade |
