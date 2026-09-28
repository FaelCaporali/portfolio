# Contato — widget + Cloudflare Worker

Construído em 23/09/2026. Custo zero: Workers (plano grátis), D1, Turnstile e envio de e-mail para destino verificado
(grátis em qualquer plano, fora da cota). Nenhum segredo neste arquivo nem no repositório.

## Arquitetura

Um Worker só (`wrangler.jsonc`, nome `fael-caporali`, domínio `fael.caporali.dev`) serve o build do Vite e a API.
Só `/api/*` acorda o Worker (`run_worker_first`); o resto sai direto dos assets.

```
navegador ── POST /api/contact ──▶ Worker ──▶ D1 (grava) ──▶ send_email ──▶ fael@caporali.dev ──▶ Email Routing ──▶ Gmail
                                     ▲                                                      (worker@mail.caporali.dev)
                            cron */15 min: reenvia pendentes, apaga > 90 dias
```

| Arquivo                                  | Papel                                                                                    |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| `shared/contact/contract.ts`             | contrato com o site: rota, ação do Turnstile, limites, campos, resposta, códigos de erro |
| `shared/contact/validation.ts`           | limpeza e validação dos campos (funções puras, usadas pelo Worker e pelo widget)         |
| `worker/index.ts`                        | roteamento (`/api/contact`, 404 JSON no resto de `/api/`, assets) e cron                 |
| `worker/contact.ts`                      | o endpoint: ordem das checagens, respostas, logs sem dado pessoal                        |
| `worker/http.ts`                         | resposta JSON endurecida, leitura do corpo com teto                                      |
| `worker/turnstile.ts`                    | conferência do token no servidor                                                         |
| `worker/message.ts`                      | a mensagem e a política: tentativas, retenção, teto diário                               |
| `worker/repository.ts`                   | D1 (consultas parametrizadas)                                                            |
| `worker/mail.ts`                         | composição do e-mail (só texto) e envio pela binding                                     |
| `worker/cron.ts`                         | reenvio de pendentes e limpeza após 90 dias                                              |
| `worker/migrations/`                     | esquema do D1 (`messages`)                                                               |
| `src/features/contact/ContactWidget.tsx` | formulário + atalhos (e-mail e WhatsApp)                                                 |
| `src/features/contact/CopyContacts.tsx`  | linha do herói: clique copia e-mail/telefone                                             |
| `public/_headers`                        | cabeçalhos de segurança do site (CSP etc.)                                               |

O e-mail vai para `fael@caporali.dev` (destino verificado; o roteamento entrega no Gmail). Assim a mensagem chega
"para" o endereço profissional e a resposta sai por ele ("Enviar como" + "responder do mesmo endereço", docs/EMAIL.md).
Reply-To = e-mail do visitante; se ele deixou telefone, o corpo traz o link `wa.me`.

## Segurança (cada ameaça, cada defesa — todas com teste em `worker/test/`)

| Ameaça                           | Defesa                                                                                                                                                                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Relay: mandar e-mail a terceiros | binding com `destination_address` e `allowed_sender_addresses` fixos (a própria Cloudflare recusa outro destino/remetente)                                                                                                  |
| Injeção de cabeçalho             | assunto montado no servidor; campos de uma linha sem CR/LF; Reply-To só com e-mail validado                                                                                                                                 |
| HTML/phishing no Gmail           | corpo só `text`, nunca `html`                                                                                                                                                                                               |
| Texto disfarçado                 | removidos caracteres de controle, marcas bidirecionais, separadores Unicode, BOM                                                                                                                                            |
| CSRF                             | `Origin` precisa estar em `ALLOWED_ORIGINS`; `Sec-Fetch-Site` diferente de `same-origin` recusado; nenhum cabeçalho CORS                                                                                                    |
| Robôs                            | Turnstile no servidor (ação `contact`, hostname esperado, uso único, falha fechada; chave de teste só vale com `ALLOW_TEST_TURNSTILE=1`), isca `website`, 3 req/min por IP, teto de 50 mensagens por 24 h                   |
| Corpo abusivo                    | só POST + `application/json`; 16 KB lidos em streaming (não confia no `Content-Length`); UTF-8 estrito; limites por campo                                                                                                   |
| Vazamento                        | respostas genéricas; logs com evento, id e código de erro, nunca nome, contato ou texto                                                                                                                                     |
| Site                             | CSP restrita (próprio site + Turnstile; `'wasm-unsafe-eval'` porque o script do Turnstile compila WebAssembly), HSTS, `nosniff`, `frame-ancestors 'none'`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP |
| Segredo                          | `TURNSTILE_SECRET` só como secret do Worker; `.dev.vars` (chaves de teste) fora do git                                                                                                                                      |
| Custo                            | plano grátis: estourou o limite, o Worker falha, não cobra                                                                                                                                                                  |

Entrega garantida: a mensagem é gravada antes do envio. Falhou o envio, o visitante vê sucesso e o cron tenta de novo
(até 5 tentativas, depois `failed`). Falharam envio **e** banco: o visitante vê erro e os atalhos diretos.

## Dados (LGPD)

Tabela `messages`: nome, contato, mensagem, país (da Cloudflare), status. Sem IP, sem identificador do visitante.
Apagadas após 90 dias pelo cron. O aviso de privacidade entra na tarefa de monitoramento e cookies (#41).

## Desenvolvimento

- `pnpm dev` (porta 5199): o Worker roda dentro do Vite; D1, limite e e-mail simulados. O e-mail vira arquivo em
  `.wrangler/tmp/email/` (não sai de verdade). Chaves de teste do Turnstile em `.env.development` e `.dev.vars`
  (copiar de `.dev.vars.example`). Primeira vez: `pnpm exec wrangler d1 migrations apply fael-caporali --local`.
- `pnpm test`: testes do Worker no runtime da Cloudflare (vitest + `@cloudflare/vitest-plugin`, `worker/test/`) e do
  widget e do contrato em jsdom (`src/features/contact/*.test.tsx`, `shared/contact/*.test.ts`).
- `pnpm e2e`: envio de ponta a ponta pelo widget contra o `pnpm dev` (`e2e/contact.spec.ts`).
- `pnpm cf-typegen` depois de mudar `wrangler.jsonc`.
- O build de produção exige `VITE_TURNSTILE_SITEKEY` (`.env.production`); sem ela, falha de propósito.

## Envio real sem publicar o site

`"remote": true` na binding `send_email` faz o dev local mandar e-mail de verdade pela Cloudflare (o resto continua
local). Exige `wrangler login`. Serve para validar a entrega e o SPF/DKIM/DMARC antes do deploy; tirar antes de publicar.

## Deploy

Primeiro deploy, CI e limites do plano: [DEPLOY.md](DEPLOY.md).
