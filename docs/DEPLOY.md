# 🚀 Deploy

## Deploy no Vercel

### Pré-requisitos

- Conta no [Vercel](https://vercel.com)
- Repositório no GitHub conectado ao Vercel

### Configuração

1. Conecte seu repositório GitHub ao Vercel
2. O Vercel detectará automaticamente que é um projeto Next.js
3. **Framework Preset:** Next.js (automático)
4. **Build Command:** `npm run build` (automático)
5. **Output Directory:** `.next` (automático)
6. **Node.js Version:** 18.x ou 20.x

### Variáveis de Ambiente (Opcional)

Se migrar o Firebase config para variáveis de ambiente:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ID do projeto |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | API Key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Auth Domain |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Sender ID |

### Troubleshooting

| Problema | Solução |
|---|---|
| Build falha com erro de config | Certifique-se de ter apenas um arquivo para cada config (`.cjs`) |
| Firebase `app/no-options` | Normal — o fallback para `firebaseConfig` funciona automaticamente |
| Erro de tipo TypeScript | Execute `npm run typecheck` localmente antes do push |

---

## Deploy via GitHub

### Configuração Inicial

```bash
# Inicializar Git (se necessário)
git init

# Adicionar arquivos
git add .

# Commit
git commit -m "Initial commit"

# Definir branch
git branch -M main

# Conectar ao repositório
git remote add origin https://github.com/ElysonAragao/PacienteMobile.git

# Enviar
git push -u origin main
```

### Atualizações

```bash
git add .
git commit -m "Descrição das mudanças"
git push
```

O Vercel fará o deploy automaticamente a cada push na branch `main`.

---

## Arquivos de Configuração Importantes

| Arquivo | Propósito |
|---|---|
| `next.config.cjs` | Config do Next.js (remotePatterns para imagens) |
| `tailwind.config.cjs` | Config do Tailwind CSS (cores, fontes, animações) |
| `postcss.config.cjs` | Config do PostCSS (Tailwind + Autoprefixer) |
| `tsconfig.json` | Config do TypeScript (paths, target) |
| `components.json` | Config do ShadCN UI |
| `.gitignore` | Arquivos ignorados pelo Git |

> ⚠️ **Importante:** Mantenha apenas **um** arquivo para cada config. Não crie versões `.js`, `.mjs` ou `.ts` duplicadas — isso causa conflito no build do Vercel.
