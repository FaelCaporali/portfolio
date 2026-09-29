import { expect, test } from '@playwright/test'

// Um envio de ponta a ponta por projeto: o Worker local limita 3 envios por minuto por IP.
// O ContactWidget é o mesmo em toda página (ContactWidget.tsx); a /journey não carrega o three.js (a /
// carrega o busto e o renderiza por software o teste inteiro), então testar o contato aqui evita que a
// verificação do Turnstile dispute a única CPU do runner com o WebGL do herói (playwright.config.ts:7-8).
test('contato: valida, envia pelo Worker local e confirma', async ({ page }) => {
  await page.goto('/journey')
  await page.getByRole('button', { name: 'Contact me' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Name')).toBeFocused()

  await dialog.getByRole('button', { name: 'Send' }).click()
  await expect(dialog.getByLabel('Name')).toHaveAttribute('aria-invalid', 'true')

  await dialog.getByLabel('Name').fill('Teste e2e')
  await dialog.getByLabel('E-mail or WhatsApp, so I can reply').fill('e2e@example.com')
  await dialog.getByLabel('Message').fill('Mensagem enviada pelo teste de ponta a ponta.')
  // O Turnstile (chave de teste) grava o token num campo oculto; sem ele o formulário não envia.
  await expect(dialog.locator('input[name="cf-turnstile-response"]')).not.toHaveValue('', { timeout: 20_000 })
  const response = page.waitForResponse((r) => r.url().endsWith('/api/contact'))
  await dialog.getByRole('button', { name: 'Send' }).click()
  expect((await response).status()).toBe(200)
  await expect(dialog.getByText(/Message received/)).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Send another message' })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: 'Contact me' })).toBeFocused()
})
