import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // O simulador da binding de e-mail também registra como erro solto a recusa que o teste espera (destino ou
    // remetente fora da lista). Só essas duas mensagens são ignoradas; qualquer outro erro solto reprova a execução.
    onUnhandledError: (error) => !/^email (to|from) \S+ not allowed$/.test(error.message),
    projects: [
      {
        // Worker dentro do runtime da Cloudflare (workerd), com D1 e limite por IP locais.
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
          name: 'worker',
          include: ['worker/test/**/*.test.ts'],
          setupFiles: ['./worker/test/setup.ts'],
        },
      },
      {
        // Site e contrato: funções puras e componentes num DOM simulado.
        plugins: [react()],
        // Data fixa do build (vite.config.ts) para os testes não dependerem do dia.
        define: { __BUILD_DATE__: JSON.stringify('2026-10-02') },
        test: {
          name: 'front',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}', 'shared/**/*.test.ts'],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
    ],
  },
})
