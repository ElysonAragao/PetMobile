# ⚙️ Setup e Configuração

## Pré-requisitos

- **Node.js** 18+ (recomendado: 20 LTS)
- **npm** 9+
- Conta no **Firebase** com projeto configurado
- **Git** instalado

## Instalação

```bash
# Clonar o repositório
git clone https://github.com/ElysonAragao/PacienteMobile.git
cd PacienteMobile

# Instalar dependências
npm install
```

## Configuração do Firebase

O arquivo de configuração está em `src/firebase/config.ts`:

```ts
export const firebaseConfig = {
  projectId: "seu-project-id",
  appId: "seu-app-id",
  apiKey: "sua-api-key",
  authDomain: "seu-project.firebaseapp.com",
  measurementId: "",
  messagingSenderId: "seu-sender-id"
};
```

### Coleções necessárias no Firestore

O sistema cria as coleções automaticamente no primeiro uso:

| Coleção | Descrição |
|---|---|
| `pacientes` | Dados dos pacientes |
| `exames` | Catálogo de exames |
| `medicos` | Cadastro de médicos |
| `planos` | Planos de saúde |
| `movimentacoes` | Movimentações/guias |
| `usuarios` | Usuários do sistema |

### Regras do Firestore

O arquivo `firestore.rules` na raiz define as regras de segurança.

## Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia servidor de desenvolvimento |
| `npm run dev:lan` | Inicia com acesso na rede local (para testar no celular) |
| `npm run build` | Build de produção |
| `npm run start` | Inicia servidor de produção |
| `npm run lint` | Executa o linter |
| `npm run typecheck` | Verifica tipos TypeScript |

## Acesso no Celular

Para testar no celular na mesma rede Wi-Fi:

```bash
npm run dev:lan
```

Acesse pelo IP da máquina, ex: `http://192.168.1.100:3000`

## Primeiro Acesso

1. Ao abrir o app pela primeira vez, você será redirecionado para `/users`
2. Cadastre o primeiro usuário como **Administrador**
3. Após isso, o sistema exigirá login para acessar
