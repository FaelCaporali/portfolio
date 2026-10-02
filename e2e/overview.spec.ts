import { expect, test, type Page } from '@playwright/test'

/*
 * O conteúdo objetivo abaixo do herói (.wai/pagina-objetiva/05-contrato.md, 08-contrato-v2.md e 11-contrato-v3.md): o
 * CTA "Cut the BS" desce até #overview; cada CTA da região (o do cabeçalho das ofertas, o de cada oferta, com o título
 * dela como assunto do formulário, e o do fechamento; cada um com o seu rótulo) abre o MESMO formulário do botão
 * flutuante e, com Esc, devolve o foco a quem abriu; as provas das ofertas e cada grupo da stack fecham com "and many
 * more", que leva ao início da trajetória, e a rota do que entreguei não (termina em "Read the full story"). Nada
 * aqui depende da cena 3D: o WebGL fica desligado (a cena cai, SceneBoundary) para o runner não desenhar o busto por
 * software.
 */
async function semWebGL(page: Page) {
  await page.addInitScript(() => {
    const proto = HTMLCanvasElement.prototype
    const original: unknown = Reflect.get(proto, 'getContext')
    Object.defineProperty(proto, 'getContext', {
      value(this: HTMLCanvasElement, type: string, ...rest: unknown[]): unknown {
        if (type.startsWith('webgl')) return null
        return Reflect.apply(original as (...a: unknown[]) => unknown, this, [type, ...rest])
      },
    })
  })
}

test('o CTA do herói desce até #overview e cada CTA da região abre o formulário do contato', async ({ page }) => {
  await semWebGL(page)
  await page.goto('/')
  const cta = page.getByRole('link', { name: /^Cut the BS/ })
  await expect(cta).toHaveAttribute('href', '#overview')
  await cta.click()
  await expect(page).toHaveURL(/#overview$/)
  await expect(page.getByRole('heading', { level: 2, name: 'What I can build for you' })).toBeInViewport()

  // 1 primário no cabeçalho das ofertas, 1 secundário no fim de cada uma das 4 e 1 primário no fechamento.
  const ctas = page.locator('#overview button[aria-haspopup="dialog"]')
  await expect(ctas).toHaveCount(6)
  await expect(ctas.first()).toHaveAccessibleName(/^Tell me about your project/)
  await expect(ctas.last()).toHaveAccessibleName(/^Drop me a line/)
  const dialog = page.getByRole('dialog')
  for (const button of await ctas.all()) {
    await button.click()
    await expect(dialog.getByLabel('Name')).toBeFocused()
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    // O mesmo painel do botão flutuante: um formulário só na página.
    await expect(page.locator('form')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    // O foco volta a quem abriu, não ao "Contact me".
    await expect(button).toBeFocused()
  }
  // O CTA de uma oferta leva o título dela ao formulário.
  await ctas.nth(1).click()
  await expect(dialog.getByText('AI products and agents, in production')).toBeVisible()
  await page.keyboard.press('Escape')
  // Reaberto pelo botão flutuante, sem assunto.
  await page.getByRole('button', { name: 'Contact me' }).click()
  await expect(dialog.getByText(/^About:/)).toHaveCount(0)
  await page.keyboard.press('Escape')

  // "and many more": nas provas das 4 ofertas e nos 6 grupos da stack; nenhum na rota do que entreguei.
  const more = 'and many more on the full journey'
  const section = (id: string) => page.locator(`section[aria-labelledby="${id}-title"]`)
  await expect(section('offers').getByRole('link', { name: more })).toHaveCount(4)
  await expect(section('stack').getByRole('link', { name: more })).toHaveCount(6)
  await expect(section('experience').getByRole('link', { name: more })).toHaveCount(0)
  await expect(section('experience').getByRole('link', { name: /^Read the full story/ })).toHaveAttribute(
    'href',
    '/journey#prologue',
  )
})

test.describe('em português', () => {
  test.use({ locale: 'pt-BR' })

  test('/pt: "Sem lero-lero" desce até #overview e os CTAs da região abrem o formulário', async ({ page }) => {
    await semWebGL(page)
    await page.goto('/pt')
    await page.getByRole('link', { name: /^Sem lero-lero/ }).click()
    await expect(page).toHaveURL(/\/pt#overview$/)
    await expect(page.getByRole('heading', { level: 2, name: 'O que posso fazer por você' })).toBeInViewport()
    const ctas = page.locator('#overview button[aria-haspopup="dialog"]')
    await expect(ctas).toHaveCount(6)
    await expect(ctas.first()).toHaveAccessibleName(/^Me conta o seu projeto/)
    await ctas.nth(2).click()
    await expect(page.getByRole('dialog').getByLabel('Nome')).toBeFocused()
    await expect(page.getByRole('dialog').getByText(/^Sobre:/)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(ctas.nth(2)).toBeFocused()

    // "e muito mais" fecha as provas das 4 ofertas e os 6 grupos da stack: o início da trajetória.
    const more = page.getByRole('link', { name: 'e muito mais na trajetória completa' })
    await expect(more).toHaveCount(10)
    for (const link of await more.all()) await expect(link).toHaveAttribute('href', '/pt/journey')
    await more.last().click()
    await expect(page).toHaveURL(/\/pt\/journey$/)
  })
})
