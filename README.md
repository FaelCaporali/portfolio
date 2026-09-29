# Portfólio do Fael Caporali

Site pessoal com herói em 3D: o busto do Fael (scan fotogramétrico esculpido no Blender, com expressões) troca de
"vida" a cada etapa da carreira, com adereços e transição de desintegração. Contato por formulário protegido, servido
pelo mesmo Worker da Cloudflare que entrega o site.

## Estrutura

| Pasta     | Conteúdo                                                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/`    | site: Vite 7, React 19, React Router 7 (páginas geradas no build), TypeScript, React Three Fiber + drei, Tailwind 4        |
| `shared/` | contrato do contato (rota, limites, campos, códigos de erro, validação), usado pelo site e pelo Worker                     |
| `worker/` | API de contato em Cloudflare Workers: Turnstile, limite por IP, D1 e reenvio por cron ([docs/CONTATO.md](docs/CONTATO.md)) |
| `e2e/`    | testes de ponta a ponta (Playwright) contra o servidor de dev                                                              |
| `public/` | assets estáticos e cabeçalhos de segurança (`_headers`)                                                                    |
| `3d/`     | pipeline do busto e do personagem cartoon: Blender 4.5 headless, MPFB, MediaPipe ([3d/README.md](3d/README.md))            |
| `docs/`   | pipeline 3D, contato, deploy e pesquisas de referência                                                                     |

O site é organizado por feature, e cada feature separa camadas:

| Caminho                    | Papel                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `src/features/hero/model/` | lógica pura do herói (carrossel, arrasto, olhar, rosto, enquadramento), sem React/three |
| `src/features/hero/hooks/` | ligação do DOM com o modelo (ponteiro, arrasto, medição do layout)                      |
| `src/features/hero/scene/` | cena do React Three Fiber: busto, furacão, luz, câmera e adereços                       |
| `src/features/hero/*.tsx`  | composição da página e texto                                                            |
| `src/features/contact/`    | widget: shell, formulário, hooks do Turnstile e do envio, cliente da API, textos        |
| `src/ui/`, `src/lib/`      | peças de interface genéricas (popover, pílula) e utilidades sem React                   |
| `src/content/`             | conteúdo: perfil e vidas do carrossel                                                   |

## Desenvolvimento

```bash
pnpm install
cp .dev.vars.example .dev.vars                                  # chaves de teste do Turnstile
pnpm exec wrangler d1 migrations apply fael-caporali --local    # primeira vez
pnpm dev                                                         # http://localhost:5199 (e o Worker na 8787)
pnpm check                                                       # tipos, ESLint, knip, Prettier e testes
pnpm e2e                                                         # Playwright contra o pnpm dev (sobe sozinho)
pnpm build                                                       # build/client; exige VITE_TURNSTILE_SITEKEY
pnpm preview                                                     # o build pelo Worker, http://127.0.0.1:4299
```

Deploy pelo GitHub Actions a cada push na `main`: [docs/DEPLOY.md](docs/DEPLOY.md).

Qualidade: TypeScript estrito (`tsconfig.base.json`), ESLint com typescript-eslint, React, jsx-a11y e SonarJS
(`eslint.config.js`), Prettier a 120 colunas; até 300 linhas por arquivo.
