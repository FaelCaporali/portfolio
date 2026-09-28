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

## Segredos e variáveis (GitHub)

Ambiente `production` (Settings → Environments), com "Deployment branches" só na `main`:

| Segredo                  | O que é                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`   | token de API: modelo **Edit Cloudflare Workers** + **Account › D1 › Edit**, só na zona `caporali.dev` |
| `CLOUDFLARE_ACCOUNT_ID`  | conta da Cloudflare                                                                                   |
| `VITE_TURNSTILE_SITEKEY` | chave pública do widget do Turnstile de `fael.caporali.dev`; entra no build                           |

Variável do repositório (Settings → Secrets and variables → Actions → Variables): `DEPLOY_ENABLED` = `true`. Tem de
ser do repositório, não do ambiente: o `if` do job é avaliado antes de o ambiente carregar.

Fork e pull request não recebem esses segredos: o deploy só roda em push na `main` deste repositório.

## Primeiro deploy

Pelo próprio CI. Sem terminal interativo, o `wrangler deploy` assume o domínio `fael.caporali.dev` que estava no
Worker `fael-caporali-placeholder` (sem tempo fora do ar). Depois dele, uma vez:

1. `TURNSTILE_SECRET` no Worker (painel → Workers → `fael-caporali` → Settings → Variables and Secrets), com o segredo
   do widget. Até lá o formulário recusa o envio e mostra o e-mail e o WhatsApp.
2. Envio real ponta a ponta e conferência de SPF/DKIM/DMARC no cabeçalho recebido.

Deploy local, se um dia precisar: `pnpm exec wrangler login` e `pnpm run deploy` (`pnpm deploy` sem `run` é outro
comando do pnpm), com `VITE_TURNSTILE_SITEKEY` no ambiente.

## Limites do plano grátis que tocam o site

- Assets: 20.000 arquivos por versão, 25 MiB por arquivo; `_headers` com até 100 regras e 2.000 caracteres por linha.
- Só a API e as páginas HTML acordam o Worker (`run_worker_first`): uma visita gasta 1 requisição das 100.000/dia;
  JS, modelos, PDFs e ícones saem direto dos assets.
- CSP com nonce nas páginas (`worker/page.ts`): a Cloudflare põe o mesmo nonce nos scripts que injeta (JS Detections do
  Bot Fight Mode e Web Analytics), sem `'unsafe-inline'`.
- Worker: 10 ms de CPU por requisição (o contato espera rede, não CPU), 5 crons por conta (usa 1).
