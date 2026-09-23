# Portfólio do Fael Caporali

Site pessoal com herói em 3D: o busto do Fael (scan fotogramétrico esculpido no Blender, com expressões) troca de
"vida" a cada etapa da carreira, com adereços e transição de desintegração. Contato por formulário protegido, servido
pelo mesmo Worker da Cloudflare que entrega o site.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/` | site: Vite 7, React 19, TypeScript, React Three Fiber + drei, GSAP, Tailwind 4 |
| `worker/` | API de contato em Cloudflare Workers: validação, Turnstile, limite por IP, D1 e reenvio por cron ([docs/CONTATO.md](docs/CONTATO.md)) |
| `public/` | assets estáticos e cabeçalhos de segurança (`_headers`) |
| `3d/` | pipeline do busto e do personagem cartoon: Blender 4.5 headless, MPFB, MediaPipe ([3d/README.md](3d/README.md)) |
| `docs/` | pipeline 3D, contato, e-mail e pesquisas de referência |

## Desenvolvimento

```bash
pnpm install
cp .dev.vars.example .dev.vars                                  # chaves de teste do Turnstile
pnpm exec wrangler d1 migrations apply fael-caporali --local    # primeira vez
pnpm dev                                                         # http://localhost:5199
pnpm test                                                        # testes do Worker no runtime da Cloudflare
pnpm build                                                       # exige VITE_TURNSTILE_SITEKEY em .env.production
```
