// J74: o elemento de cima à esquerda (devops: o diagrama da aplicação; techlead: o cliente na chamada) NO MEIO DA
// ANIMAÇÃO, com o carrossel normal e o relógio falso do Playwright (como captura_prop.mjs sequencia): t=0 é a montagem
// real da vida (pula para a vida seguinte e volta). Tela inteira, sem recorte.
// Uso: node 3d/tools/j74_animado.mjs <rótulo> [vida,vida] [t=3] [WxH,...]
import { mkdirSync } from 'node:fs'
import { abrir, launch } from './props/site.mjs'

const [rotulo = 'depois', vidasArg = 'devops,techlead', tArg = '3', telasArg] = process.argv.slice(2)
const t = Number(tArg)
const OUT = '3d/captura/j74'
mkdirSync(OUT, { recursive: true })
const TELAS = (telasArg ?? '320x568,360x780,390x844,800x360,768x1024,1280x800,1440x900,1920x1080')
  .split(',')
  .map((s) => s.split('x').map(Number))

const palavra = (page) =>
  page.evaluate(() => document.querySelector('.slot-word:not(.is-leaving)')?.textContent?.replace(/\s+/g, ' ').trim())

/** Escolhe a vida no indicador e avança o relógio falso em passos de 0,02 s até ela montar. */
async function montar(page, vida) {
  await page.evaluate(
    (v) => [...document.querySelectorAll('nav[aria-label="Timeline"] button')].find((b) => b.ariaLabel === v)?.click(),
    vida,
  )
  for (let i = 0; i < 300; i++) {
    await page.clock.runFor(20)
    if ((await palavra(page))?.includes(vida)) return
  }
  throw new Error(`a vida ${vida} não montou em 6 s de cena`)
}

const browser = await launch()
for (const vida of vidasArg.split(','))
  for (const [w, h] of TELAS) {
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      const { ctx, page, vidaInicial: alvo } = await abrir(browser, {
        viewport: { width: w, height: h },
        dsf: w < 1000 ? 2 : 1,
        query: `slot=${vida}`,
        relogio: true,
      })
      try {
        await page.clock.pauseAt(Date.now() + 1000)
        const vidas = await page.evaluate(() =>
          [...document.querySelectorAll('nav[aria-label="Timeline"] button')].map((b) => b.ariaLabel ?? ''),
        )
        await montar(page, vidas[(vidas.indexOf(alvo) + 1) % vidas.length])
        await montar(page, alvo)
        await page.clock.runFor(Math.round(t * 1000))
        const path = `${OUT}/${vida}-${w}x${h}-${rotulo}-anim-t${t}.png`
        await page.screenshot({ path, timeout: 180_000 })
        console.log(path)
        await ctx.close()
        break
      } catch (e) {
        await ctx.close()
        if (tentativa === 3) throw e
        console.error(`tentativa ${tentativa} de ${vida} ${w}x${h}: ${e.message.split('\n')[0]}`)
      }
    }
  }
await browser.close()
