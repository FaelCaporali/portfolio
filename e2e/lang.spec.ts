import { expect, test } from '@playwright/test'

/*
 * Troca de idioma pt-BR/en: inglês em / e /journey, português em /pt e /pt/journey. No dev (5199) não há Worker: a
 * detecção do navegador roda no cliente logo depois da hidratação (src/i18n/useDetectLang.ts), com a mesma regra.
 */
const CENA = { timeout: 45_000 }

test.describe('navegador em português, sem escolha salva', () => {
  test.use({ locale: 'pt-BR' })

  test('/ termina em /pt, com lang, título e texto em português', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/pt$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://fael.caporali.dev/pt')
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(/^Hoje (estou|sou|fui) \S/)
    await expect(page.getByRole('link', { name: /Veja a trajetória completa/ })).toHaveAttribute('href', '/pt/journey')
  })

  test('a escolha EN fica: a volta a / não leva de novo ao português', async ({ page }) => {
    await page.goto('/pt')
    await page.getByRole('link', { name: 'Read in English' }).click()
    await expect(page).toHaveURL(/\/$/)
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page).toHaveURL(/\/$/)
  })
})

test('herói: PT troca idioma, título e canonical sem recarregar, com o mesmo <canvas> e sem "loading" de novo', async ({
  page,
}) => {
  await page.goto('/?slot=qa')
  await expect(page.locator('.slot-word .sr-only')).toHaveText('QA Analyst', CENA)
  await page.locator('canvas').evaluate((c) => {
    ;(c as HTMLCanvasElement & { marca?: string }).marca = 'antes'
  })
  await page.getByRole('link', { name: 'Ler em português' }).click()
  await expect(page).toHaveURL(/\/pt\?slot=qa$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://fael.caporali.dev/pt')
  expect(await page.locator('canvas').evaluate((c) => (c as HTMLCanvasElement & { marca?: string }).marca)).toBe(
    'antes',
  )
  await expect(page.locator('.loading-word')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(/^(Hoje sou|Ontem fui) \S/)
  await page.goBack()
  await expect(page).toHaveURL(/\/\?slot=qa$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(/^(Today I am|Yesterday I was) an? \S/)
})

test('trajetória rolada e filtrada: a troca mantém o filtro e o marco à vista', async ({ page, isMobile }) => {
  await page.goto('/pt/journey?tools=React')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A trajetória completa')
  // Hidratada (o botão do menu do mapa só liga depois dela): rolar antes mede uma página que ainda vai se arrumar.
  await expect(page.locator('.index-sheet button')).toBeEnabled()
  // O filtro do endereço entra depois da hidratação: rolar antes dele mede o mapa inteiro, que depois encolhe.
  await page.waitForFunction(() => document.querySelector('[hidden] [data-checkpoint], [data-checkpoint][hidden]'))
  // O marco no alto da tela, abaixo do cabeçalho e dos filtros: é o que está em leitura.
  await page.evaluate(() => {
    const mark = document.getElementById('fullstack')
    if (mark) window.scrollBy({ top: mark.getBoundingClientRect().top - 200, behavior: 'instant' })
  })
  const before = await page.locator('#fullstack').boundingBox()
  if (isMobile) {
    await page.getByRole('button', { name: 'Mapa da trajetória' }).click()
    await page.getByRole('link', { name: 'Read in English' }).click()
  } else {
    await page.getByRole('link', { name: 'Read in English' }).click()
  }
  await expect(page).toHaveURL(/\/journey\?tools=React$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The full journey')
  if (!before) throw new Error('marco fora da página')
  await expect
    .poll(async () => Math.abs(((await page.locator('#fullstack').boundingBox())?.y ?? 1e9) - before.y))
    .toBeLessThan(4)
  await expect(page.locator('.filter-chip')).toHaveText('React ×')
})

test('endereço que não é idioma: "Page not found"; /pt/… que não existe, em português', async ({ page }) => {
  await page.goto('/xx')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await page.goto('/xx/journey')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await page.goto('/pt/xyz')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
})
