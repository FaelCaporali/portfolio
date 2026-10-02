// Imagem de compartilhamento (og:image) do site, 1200×630, en e pt: o busto do herói (S13) à direita, na luz do site,
// e à esquerda o nome, a vida "AI Product Engineer", os títulos e o lugar, com os textos, cores e fontes do site.
//
// Regenerar (da raiz do repositório; um processo pesado por vez: o Blender termina antes de o Chromium abrir):
//   node 3d/tools/og/gerar.mjs [--tmp=<pasta>] [--reusar-busto] [--amostras=128] [--qualidade=90]
// Saída: public/og/fael-caporali-en.jpg e public/og/fael-caporali-pt.jpg (JPEG; cada uma < 300 KB, limite do WhatsApp).
//
// Passos: (1) o glb do busto sem meshopt (3d/tools/props/otimizar.mjs --cru), porque o Blender 4.5 não o lê;
// (2) Blender 4.5 sem interface: 3d/tools/og/busto_og.py renderiza o busto com fundo transparente (Cycles, luz e tom
// ACES do site, cabeça em 3/4 olhando para a câmera); (3) Chromium do Playwright (sem WebGL) abre modelo.html, põe os
// textos e o busto e fotografa. Textos lidos de src/ (só o nome é fixo aqui): vida `ai` (journey.ts, slots do
// pt.ts), títulos (hero.titles de en.ts/pt.ts), lugar e "remoto" (overview.json facts), cor da vida (journey.ts),
// fundo e fonte (index.css). --reusar-busto: pula (1) e (2) se o PNG do busto já está em --tmp.
import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = resolve(AQUI, '../../..')
const opc = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v] = a.slice(2).split('=')
      return [k, v ?? true]
    }),
)
const TMP = resolve(String(opc.tmp ?? join(tmpdir(), 'og-fael')))
const AMOSTRAS = Number(opc.amostras ?? 128)
const QUALIDADE = Number(opc.qualidade ?? 90)
const LIMITE = 300 * 1024
const W = 1200
const H = 630
const SEGURA = 60
// O busto é renderizado no dobro e mostrado à metade (nitidez na miniatura e no zoom).
const RENDER = { w: 1280, h: 1260, escala: 0.5 }
// Caixa do busto (cabelo, rosto e pescoço) na imagem: borda direita e topo. Virado para a direita, a borda direita da
// caixa é o próprio rosto: 1115 o deixa dentro de x 600–1140 (área segura de 60 px).
const BUSTO_DIREITA = 1115
const BUSTO_TOPO = 50

const ler = (p) => readFileSync(join(RAIZ, p), 'utf8')
function achar(texto, re, nome) {
  const m = texto.match(re)
  if (!m) throw new Error(`não achei ${nome} no código do site (${re})`)
  return m[1]
}
const aspas = (lista) => [...lista.matchAll(/'([^']+)'/g)].map((m) => m[1])

function textos() {
  const journey = ler('src/content/journey.ts')
  const en = ler('src/i18n/messages/en.ts')
  const pt = ler('src/i18n/messages/pt.ts')
  const css = ler('src/index.css')
  const facts = findFacts(JSON.parse(ler('src/content/overview.json')))
  if (!facts) throw new Error('não achei facts em src/content/overview.json')
  // "Belo Horizonte, Brazil" + a 1ª palavra do modo de trabalho ("Remote for Brazil…" → "remote").
  const lugar = (l) => `${facts[0][l]} · ${facts[1][l].split(' ')[0].toLowerCase()}`
  const vidaAi = achar(journey, /id: 'ai',[\s\S]*?slot: '([^']+)'/, "slot da vida 'ai'")
  return {
    cores: {
      page: achar(css, /--color-page: (#[0-9a-f]{6})/i, '--color-page'),
      fgRgb: achar(css, /--fg-rgb: ([0-9 ]+);/, '--fg-rgb'),
      accent: achar(journey, /id: 'ai',[\s\S]*?accent: '(#[0-9a-f]{6})'/i, "accent da vida 'ai'"),
      font: achar(css, /--font-sans: ([^;]+);/, '--font-sans'),
    },
    en: {
      nome: 'Fael Caporali',
      vida: vidaAi,
      titulos: aspas(achar(en, /titles: \[([^\]]+)\]/, 'hero.titles (en)')),
      lugar: lugar('en'),
    },
    pt: {
      nome: 'Fael Caporali',
      vida: achar(pt, /slots: \{[\s\S]*?\bai: '([^']+)'/, 'hero.slots.ai (pt)'),
      titulos: aspas(achar(pt, /titles: \[([^\]]+)\]/, 'hero.titles (pt)')),
      lugar: lugar('pt'),
    },
  }
}

// overview.json: a lista `facts` (lugar, modo de trabalho...) fica dentro das ofertas; acha onde estiver.
function findFacts(o) {
  if (o && typeof o === 'object') {
    if (Array.isArray(o.facts)) return o.facts
    for (const v of Object.values(o)) {
      const r = findFacts(v)
      if (r) return r
    }
  }
  return null
}

function busto() {
  const png = join(TMP, 'busto-og.png')
  const caixaArq = join(TMP, 'busto-og.json')
  if (opc['reusar-busto'] && existsSync(png) && existsSync(caixaArq)) return { png, ...JSON.parse(readFileSync(caixaArq, 'utf8')) }
  const cru = join(TMP, 'busto-cru.glb')
  execFileSync('node', [join(RAIZ, '3d/tools/props/otimizar.mjs'), '--cru', join(RAIZ, '3d/export/s13/busto-s13.glb'), cru], {
    cwd: RAIZ,
    stdio: 'inherit',
  })
  const saida = execFileSync(
    'blender',
    ['-b', '--factory-startup', '--python', join(AQUI, 'busto_og.py'), '--', cru, png,
      `--w=${RENDER.w}`, `--h=${RENDER.h}`, `--amostras=${AMOSTRAS}`],
    { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 << 20 },
  )
  const m = saida.match(/^CAIXA (\d+) (\d+) (\d+) (\d+) (\d+) (\d+)$/m)
  if (!m || !saida.includes('\nOK ')) throw new Error('o Blender não terminou o render do busto:\n' + saida.slice(-3000))
  const [, , , x0, y0, x1, y1] = m.map(Number)
  const caixa = { x0, y0, x1, y1 }
  writeFileSync(caixaArq, JSON.stringify(caixa))
  return { png, ...caixa }
}

async function fotografar(b, t) {
  const navegador = await chromium.launch()
  try {
    const pagina = await navegador.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
    await pagina.goto(pathToFileURL(join(AQUI, 'modelo.html')).href)
    const k = RENDER.escala
    const pos = {
      left: Math.round(BUSTO_DIREITA - b.x1 * k),
      top: Math.round(BUSTO_TOPO - b.y0 * k),
      w: RENDER.w * k,
      h: RENDER.h * k,
    }
    const saidas = []
    for (const lang of ['en', 'pt']) {
      const medidas = await pagina.evaluate(
        async ({ c, x, pos, src, caixa, k }) => {
          const r = document.documentElement.style
          r.setProperty('--page', c.page)
          r.setProperty('--fg-rgb', c.fgRgb)
          r.setProperty('--accent', c.accent)
          r.setProperty('--font', c.font)
          document.documentElement.lang = x.lang
          const img = document.querySelector('.busto')
          Object.assign(img.style, { left: `${pos.left}px`, top: `${pos.top}px`, width: `${pos.w}px`, height: `${pos.h}px` })
          // Máscara do pescoço: do queixo para baixo, em % da altura da imagem do busto.
          const fundo = (caixa.y1 * k) / pos.h
          r.setProperty('--m0', `${((fundo - 0.2) * 100).toFixed(1)}%`)
          r.setProperty('--m1', `${((fundo - 0.045) * 100).toFixed(1)}%`)
          r.setProperty('--bx', `${pos.left + ((caixa.x0 + caixa.x1) / 2) * k}px`)
          r.setProperty('--by', `${pos.top + ((caixa.y0 + caixa.y1) / 2) * k}px`)
          if (img.getAttribute('src') !== src) {
            img.src = src
            await img.decode()
          }
          document.querySelector('h1').textContent = x.nome
          document.querySelector('.vida').textContent = x.vida
          const tit = document.querySelector('.titulos')
          tit.replaceChildren()
          x.titulos.forEach((s, i) => {
            if (i > 0) {
              const sep = document.createElement('span')
              sep.className = 'sep'
              sep.textContent = '·'
              tit.append(' ', sep, ' ')
            }
            tit.append(s)
          })
          document.querySelector('.lugar').textContent = x.lugar
          await document.fonts.ready
          // Caixas de cada texto (a extensão real das letras, por Range) para conferir a área segura e o rosto.
          const caixaDe = (el) => {
            const rg = document.createRange()
            rg.selectNodeContents(el)
            const q = rg.getBoundingClientRect()
            return { sel: el.className || el.tagName, x0: q.left, y0: q.top, x1: q.right, y1: q.bottom, linhas: rg.getClientRects().length }
          }
          return {
            fonte: getComputedStyle(document.querySelector('h1')).fontFamily,
            textos: [...document.querySelectorAll('.texto > *')].map(caixaDe),
          }
        },
        { c: t.cores, x: { ...t[lang], lang }, pos, src: pathToFileURL(b.png).href, caixa: b, k },
      )
      for (const q of medidas.textos) {
        const fora = q.x0 < SEGURA || q.y0 < SEGURA || q.x1 > W - SEGURA || q.y1 > H - SEGURA
        if (fora) throw new Error(`${lang}: ${q.sel} fora da área segura de ${SEGURA} px: ${JSON.stringify(q)}`)
      }
      const arq = join(RAIZ, 'public/og', `fael-caporali-${lang}.jpg`)
      let q = QUALIDADE
      let buf
      for (;;) {
        buf = await pagina.screenshot({ type: 'jpeg', quality: q })
        if (buf.length < LIMITE || q <= 70) break
        q -= 5
      }
      if (buf.length >= LIMITE) throw new Error(`${lang}: ${buf.length} bytes, acima de ${LIMITE}`)
      writeFileSync(arq, buf)
      saidas.push({ lang, arq, bytes: statSync(arq).size, qualidade: q, busto: pos, ...medidas })
    }
    return saidas
  } finally {
    await navegador.close()
  }
}

mkdirSync(TMP, { recursive: true })
mkdirSync(join(RAIZ, 'public/og'), { recursive: true })
const t = textos()
const b = busto()
const r = await fotografar(b, t)
for (const s of r) {
  console.log(`${s.lang}: ${s.arq.replace(RAIZ + '/', '')} ${W}×${H} ${(s.bytes / 1024).toFixed(1)} KB (JPEG q${s.qualidade})`)
  console.log(`  fonte: ${s.fonte}`)
  console.log(`  busto: x ${s.busto.left + b.x0 * RENDER.escala}–${s.busto.left + b.x1 * RENDER.escala}, y ${s.busto.top + b.y0 * RENDER.escala}–${s.busto.top + b.y1 * RENDER.escala}`)
  for (const q of s.textos)
    console.log(`  ${q.sel}: x ${q.x0.toFixed(0)}–${q.x1.toFixed(0)}, y ${q.y0.toFixed(0)}–${q.y1.toFixed(0)}, ${q.linhas} linha(s)`)
}
