import { defineConfig, devices } from '@playwright/test'

/** e2e contra o `pnpm dev` real: site (Vite) + Worker (D1, limite e e-mail simulados) + Turnstile de teste. */
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
  // Inglês fixo: o site detecta o idioma do navegador (src/i18n/useDetectLang.ts) e, numa máquina em pt-BR, levaria
  // os testes em inglês para /pt. Os casos em português pedem o pt-BR (e2e/lang.spec.ts).
  use: { baseURL: 'http://localhost:5199', trace: 'retain-on-failure', locale: 'en-US' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    // O menor celular que o layout suporta sem ajuste (ver #39).
    { name: 'mobile', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 740 } } },
  ],
  // Os dois processos do `pnpm dev`: o Worker da API no wrangler (8787) e o servidor do site (5199), que encaminha
  // /api ao Worker. Reaproveitados se já estiverem no ar (fora do CI).
  webServer: [
    { command: 'pnpm dev:api', port: 8787, reuseExistingServer: !process.env.CI, timeout: 60_000 },
    { command: 'pnpm dev:web', url: 'http://localhost:5199', reuseExistingServer: !process.env.CI, timeout: 60_000 },
  ],
})
