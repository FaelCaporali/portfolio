import { expect, test, type Page } from '@playwright/test'

/** Erros do console durante o teste (WebGL, shader, React). */
function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

test('herói: vida, títulos, links e o busto sem erro no console', async ({ page }) => {
  const errors = collectErrors(page)
  const bust = page.waitForResponse((r) => r.url().includes('busto-s13.glb') && r.ok())
  await page.goto('/')
  // Nome acessível: a frase inteira, com espaço, e não letra a letra.
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(/^Today I am an? \S/)
  await expect(page.getByRole('link', { name: 'See the full journey' })).toHaveAttribute('href', '/trajetoria')
  await expect(page.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('target', '_blank')
  // Atalho do código: um só visível por tamanho de tela (canto no largo, junto das pílulas no celular).
  await expect(page.getByRole('link', { name: 'View source on GitHub' })).toHaveCount(1)
  await expect(page.getByRole('link', { name: 'View source on GitHub' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Lattes' })).toHaveCount(0)
  await expect(page.locator('canvas')).toBeVisible()
  await bust
  expect(errors).toEqual([])
})

test('?slot começa na vida pedida e o carrossel troca sozinho', async ({ page }) => {
  await page.goto('/?slot=vela')
  // O texto que o leitor de tela recebe (as letras animadas são aria-hidden).
  const slot = page.locator('.slot-word .sr-only')
  await expect(slot).toHaveText('Sailing Instructor')
  // Sem GPU o headless roda a ~7 FPS e o relógio limita o passo por quadro: a troca leva mais que os ~5 s reais.
  await expect(slot).not.toHaveText('Sailing Instructor', { timeout: 45_000 })
})

test('indicador cronológico: clique leva à vida escolhida', async ({ page }) => {
  await page.goto('/?slot=fullstack')
  const timeline = page.getByRole('navigation', { name: 'Timeline' })
  await timeline.getByRole('button', { name: 'QA Analyst' }).click()
  await expect(timeline.getByRole('button', { name: 'QA Analyst' })).toHaveAttribute('aria-current', 'step')
  await expect(page.locator('.slot-word .sr-only')).toHaveText('QA Analyst', { timeout: 30_000 })
})

test('sem rolagem horizontal e currículo com os dois PDFs', async ({ page }) => {
  await page.goto('/')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await page.getByRole('button', { name: /Résumé/ }).click()
  await expect(page.getByRole('link', { name: /Português/ })).toHaveAttribute('href', '/cv/fael-caporali-cv-pt.pdf')
  await expect(page.getByRole('link', { name: /English/ })).toHaveAttribute('href', '/cv/fael-caporali-cv-en.pdf')
})

// Celular deitado: layout largo (texto à esquerda, busto à direita), texto abaixo do cabeçalho e inteiro na tela.
for (const [width, height] of [
  [800, 360],
  [712, 320],
] as const) {
  test(`paisagem ${width}×${height}: texto abaixo do cabeçalho, sem cortar`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/?slot=ai&d=0')
    const header = await page.locator('header').boundingBox()
    const title = await page.getByRole('heading', { level: 1 }).boundingBox()
    const contact = await page.getByRole('list', { name: 'Contact' }).boundingBox()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    if (!header || !title || !contact) throw new Error('herói incompleto')
    const box = {
      headerBottom: header.y + header.height,
      textTop: title.y,
      textBottom: contact.y + contact.height,
      textRight: title.x + title.width,
      overflow,
    }
    expect(box.textTop).toBeGreaterThanOrEqual(box.headerBottom)
    expect(box.textBottom).toBeLessThanOrEqual(height)
    expect(box.textRight).toBeLessThan(width * 0.6)
    expect(box.overflow).toBeLessThanOrEqual(0)
  })
}
