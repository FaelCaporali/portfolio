import { defineConfig, devices } from '@playwright/test'

/** e2e contra o `pnpm dev` real: Vite + Worker (D1, limite e e-mail simulados) + Turnstile com a chave de teste. */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // Sem GPU, cada página renderiza o busto por software: poucos workers e mais tempo por teste. No runner do CI
  // (4 CPUs) duas páginas ao mesmo tempo derrubam o quadro por segundo, e o carrossel não troca a tempo: um só.
  workers: process.env.CI ? 1 : 2,
  // Medido num contêiner com 4 CPUs (28/09): contato 41 s, carrossel 32 s. O dobro no CI dá folga para runner lento.
  timeout: process.env.CI ? 120_000 : 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:5199', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    // O menor celular que o layout suporta sem ajuste (ver #39).
    { name: 'mobile', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 740 } } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5199',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
