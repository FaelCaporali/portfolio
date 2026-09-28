# Deploy e CI

Um Worker só (`fael-caporali`) serve o site e a API do contato em `fael.caporali.dev` (arquitetura em
[CONTATO.md](CONTATO.md)). Nenhum segredo neste arquivo nem no repositório.

## CI (`.github/workflows/ci.yml`)

| Job       | Quando                          | O que prova                                                                           |
| --------- | ------------------------------- | ------------------------------------------------------------------------------------- |
| `quality` | todo push na `main` e todo PR   | `pnpm check` (tsc, ESLint, knip, Prettier, vitest) e `pnpm run build`                 |
| `e2e`     | todo push na `main` e todo PR   | Playwright (desktop e celular) contra o `pnpm dev`, com D1 local e Turnstile de teste |
| `deploy`  | push na `main`, depois dos dois | build de produção, migrações do D1 remoto, `wrangler deploy`                          |

O `deploy` só roda com a variável de repositório `DEPLOY_ENABLED=true`; sem ela aparece como pulado. Actions fixadas por
commit.

## Primeiro deploy (uma vez, local)

O domínio ainda está no Worker `fael-caporali-placeholder`, e a troca pede confirmação: o primeiro deploy é feito à mão.

1. `pnpm exec wrangler login`
2. Widget do Turnstile para `fael.caporali.dev` (painel → Turnstile). A sitekey é pública: vai em `.env.production`
   (`VITE_TURNSTILE_SITEKEY=...`, versionado). A secret vai direto no Worker, nunca em arquivo:
   `pnpm exec wrangler secret put TURNSTILE_SECRET`.
3. `pnpm db:migrate` (esquema no D1 remoto).
4. `pnpm run deploy` (`pnpm deploy` sem `run` é outro comando do pnpm). Confirmar a troca do domínio do placeholder.
5. Envio real ponta a ponta e conferência de SPF/DKIM/DMARC no cabeçalho recebido.

## Ligar o deploy pelo CI

1. Token em [Account API tokens](https://dash.cloudflare.com/?to=/:account/api-tokens): modelo **Edit Cloudflare
   Workers**, mais **Account › D1 › Edit**; escopo só na conta e na zona `caporali.dev`.
2. No GitHub (Settings → Secrets and variables → Actions): segredos `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`;
   variável `DEPLOY_ENABLED` = `true`.
3. (Opcional) Settings → Environments → `production`: revisor obrigatório, se o deploy precisar de aprovação.

## Limites do plano grátis que tocam o site

- Assets: 20.000 arquivos por versão, 25 MiB por arquivo; `_headers` com até 100 regras e 2.000 caracteres por linha.
- Só `/api/*` acorda o Worker (`run_worker_first`): o site estático não gasta as 100.000 requisições/dia.
- Worker: 10 ms de CPU por requisição (o contato espera rede, não CPU), 5 crons por conta (usa 1).
