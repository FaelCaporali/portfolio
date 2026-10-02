import { expect, test } from '@playwright/test'

/*
 * MCP do portfólio, fase 4 (.wai/mcp/02-plano.md): o ícone fixo da home leva à página /mcp do idioma; no largo a pílula
 * com o rótulo fica aberta enquanto o herói ocupa metade da tela e recolhe depois (04-direcao-mcp.md §5); a /journey
 * não tem link para a /mcp (D-MCP2).
 */
const ICONE = { en: 'Connect your AI assistant', pt: 'Conecte o seu assistente de IA' }

test('home: o ícone leva à /mcp, com o endereço para copiar', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: ICONE.en }).click()
  await expect(page).toHaveURL(/\/mcp$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ask your AI assistant about my work')
  await expect(page.locator('main code').first()).toHaveText('https://fael-caporali.rafaelhon.workers.dev/mcp')
  await expect(page.getByRole('button', { name: 'Copy address' })).toBeEnabled()
})

test.describe('largo (a pílula só existe a partir de 1024 px)', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('pílula aberta no herói, recolhida no conteúdo, aberta de novo ao voltar', async ({ page }) => {
    await page.goto('/')
    const pilula = page.getByRole('link', { name: ICONE.en }).locator('.mcp-fab-label')
    await expect(pilula).toBeVisible()
    await page.locator('#overview').scrollIntoViewIfNeeded()
    await expect(pilula).toBeHidden()
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(pilula).toBeVisible()
  })
})

test.describe('em português', () => {
  test.use({ locale: 'pt-BR' })

  test('/pt leva à /pt/mcp, e o PT/EN da página troca para /mcp', async ({ page }) => {
    await page.goto('/pt')
    await page.getByRole('link', { name: ICONE.pt }).click()
    await expect(page).toHaveURL(/\/pt\/mcp$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Pergunte sobre o meu trabalho ao seu assistente de IA',
    )
    await page.getByRole('link', { name: 'Read in English' }).click()
    await expect(page).toHaveURL(/\/mcp$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ask your AI assistant about my work')
  })
})

test('a /journey não tem o ícone nem link para a /mcp (D-MCP2)', async ({ page }) => {
  await page.goto('/journey')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('a[href$="/mcp"]')).toHaveCount(0)
})
