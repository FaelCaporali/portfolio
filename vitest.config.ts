import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

// Testes do Worker dentro do runtime da Cloudflare (workerd), com D1 e limite por IP locais.
export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          TURNSTILE_SECRET: 'test-secret',
          ALLOWED_ORIGINS: 'https://fael.caporali.dev',
          TURNSTILE_HOSTNAMES: 'fael.caporali.dev',
          ALLOW_TEST_TURNSTILE: '0',
          TEST_MIGRATIONS: await readD1Migrations('./worker/migrations'),
        },
      },
    })),
  ],
  test: {
    include: ['worker/test/**/*.test.ts'],
    setupFiles: ['./worker/test/setup.ts'],
    // O simulador da binding de e-mail também registra como erro solto a recusa que o teste espera (destino ou
    // remetente fora da lista). Só essas duas mensagens são ignoradas; qualquer outro erro solto reprova a execução.
    onUnhandledError: (error) => !/^email (to|from) \S+ not allowed$/.test(error.message),
  },
})
