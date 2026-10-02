// Imagem de compartilhamento (og:image) do site, 1200×630, en e pt: o busto do herói (S13) à direita, renderizado
// pelo pipeline do próprio site, e à esquerda o nome, a vida "AI Product Engineer", os títulos e o lugar.
//
// Regenerar (da raiz do repositório): node 3d/tools/og/gerar.mjs [--qualidade=90]
// Saída: public/og/fael-caporali-en.jpg e public/og/fael-caporali-pt.jpg (JPEG; cada uma < 150 KB).
//
// Um Chromium do Playwright (WebGL por SwiftShader), duas páginas servidas por page.route (sem servidor nem porta):
// (1) busto.html: three do node_modules, o glb do herói (3d/export/s13/busto-s13.glb, meshopt), os materiais e o
// degradê do pescoço de src/features/hero/scene/rig.ts e dissolve.ts (o TypeScript sem tipos, por node:module), a luz
// e o ambiente de Lighting.tsx, o tom ACES de HeroCanvas.tsx, a posição da câmera de HeroCanvas.tsx e a mira de
// Framing.tsx (lidos do código, não copiados); de frente, expressão neutra, olhar em repouso, sem adereço. O ângulo
// é o das capturas aprovadas pelo Fael (.wai/seo-geo/og-referencia/angulo-fael-{1,2}.png). (2) modelo.html: textos
// e o busto; a foto é a JPEG. Textos lidos de src/ (só o nome é fixo aqui): vida `ai` (journey.ts, slots do pt.ts),
// títulos (hero.titles de en.ts/pt.ts), lugar e "remoto" (overview.json facts), cor da vida (journey.ts), fundo e
// fonte (index.css).
import { chromium } from '@playwright/test'
import { readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { dirname, extname, join, resolve } from 'node:path'
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
const QUALIDADE = Number(opc.qualidade ?? 90)
const LIMITE = 150 * 1024
const W = 1200
const H = 630
const SEGURA = 60
// Retângulo do busto no cartão (metade direita) e, dentro dele, onde caem o alto do cabelo e a barba (altura Y_BASE no
// glb, no meio do degradê do pescoço). Renderizado no dobro (DPR) e mostrado à metade: nitidez no zoom.
const BUSTO = { left: 640, top: 0, w: 560, h: H, topo: 34, base: 596, dpr: 2 }
const Y_BASE = 0.04
const ORIGEM = 'http://og.local'

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

const num = (t) => t.split(',').map(Number)

// A cena do herói como o site a monta, lida do código: luz e ambiente (Lighting.tsx), tom (HeroCanvas.tsx), posição da
// câmera (HeroCanvas.tsx) e mira (Framing.tsx).
function cenaDoSite() {
  const luz = ler('src/features/hero/scene/Lighting.tsx')
  const canvas = ler('src/features/hero/scene/HeroCanvas.tsx')
  const framing = ler('src/features/hero/scene/Framing.tsx')
  if (!canvas.includes('toneMapping: THREE.ACESFilmicToneMapping'))
    throw new Error('HeroCanvas.tsx não usa mais o tom ACESFilmic: atualize busto.html')
  const dirs = [...luz.matchAll(/<directionalLight position=\{\[([^\]]+)\]\} intensity=\{([\d.]+)\} color="(#[0-9a-f]{6})"/gi)]
  if (dirs.length !== 3) throw new Error(`Lighting.tsx: esperava 3 luzes direcionais, achei ${dirs.length}`)
  return {
    luz: {
      ambiente: Number(achar(luz, /<ambientLight intensity=\{([\d.]+)\}/, 'ambientLight')),
      sigma: Number(achar(luz, /fromScene\(new RoomEnvironment\(\), ([\d.]+)\)/, 'sigma do ambiente')),
      envIntensidade: Number(achar(luz, /environmentIntensity = ([\d.]+)/, 'environmentIntensity')),
      dirs: dirs.map((m) => ({ pos: num(m[1]), int: Number(m[2]), cor: m[3] })),
    },
    camera: {
      pos: num(achar(canvas, /camera=\{\{ position: \[([^\]]+)\]/, 'posição da câmera')),
      mira: num(achar(framing, /cam\.lookAt\(([^)]+)\)/, 'mira da câmera')),
    },
  }
}

const TIPOS = { '.js': 'text/javascript', '.html': 'text/html', '.glb': 'model/gltf-binary' }
// O "site" da página do busto: three do node_modules, o TypeScript do herói sem tipos e o glb, direto do disco.
function servir(rota) {
  const url = new URL(rota.request().url())
  let arq
  let corpo
  if (url.pathname === '/busto.html') arq = join(AQUI, 'busto.html')
  else if (url.pathname === '/glb/busto.glb') arq = join(RAIZ, '3d/export/s13/busto-s13.glb')
  else if (url.pathname.startsWith('/three/')) arq = join(RAIZ, 'node_modules', url.pathname)
  else if (url.pathname.startsWith('/src/')) {
    arq = join(RAIZ, url.pathname)
    if (!extname(arq)) arq += '.ts'
    corpo = stripTypeScriptTypes(readFileSync(arq, 'utf8'))
  }
  if (!arq) return rota.fulfill({ status: 404 })
  const tipo = arq.endsWith('.ts') ? TIPOS['.js'] : (TIPOS[extname(arq)] ?? 'application/octet-stream')
  return rota.fulfill({ status: 200, contentType: tipo, body: corpo ?? readFileSync(arq) })
}

async function busto(navegador, cores) {
  const pagina = await navegador.newPage({ viewport: { width: BUSTO.w, height: BUSTO.h }, deviceScaleFactor: BUSTO.dpr })
  const erros = []
  pagina.on('pageerror', (e) => erros.push(String(e)))
  pagina.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
  try {
    await pagina.route(`${ORIGEM}/**`, servir)
    await pagina.goto(`${ORIGEM}/busto.html`)
    await pagina.waitForFunction(() => window.pronto === true || undefined, null, { timeout: 30_000 }).catch(() => {
      throw new Error('busto.html não carregou:\n' + erros.join('\n'))
    })
    const caixa = await pagina.evaluate((c) => window.renderBusto(c), {
      ...cenaDoSite(),
      w: BUSTO.w,
      h: BUSTO.h,
      dpr: BUSTO.dpr,
      page: cores.page,
      topo: BUSTO.topo,
      base: BUSTO.base,
      yBase: Y_BASE,
    })
    const png = await pagina.locator('canvas').screenshot({ type: 'png' })
    return { src: `data:image/png;base64,${png.toString('base64')}`, caixa }
  } finally {
    await pagina.close()
  }
}

async function fotografar(t) {
  const navegador = await chromium.launch()
  try {
    const b = await busto(navegador, t.cores)
    const pagina = await navegador.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
    await pagina.goto(pathToFileURL(join(AQUI, 'modelo.html')).href)
    const pos = { left: BUSTO.left, top: BUSTO.top, w: BUSTO.w, h: BUSTO.h }
    const saidas = []
    for (const lang of ['en', 'pt']) {
      const medidas = await pagina.evaluate(
        async ({ c, x, pos, src }) => {
          const r = document.documentElement.style
          r.setProperty('--page', c.page)
          r.setProperty('--fg-rgb', c.fgRgb)
          r.setProperty('--accent', c.accent)
          r.setProperty('--font', c.font)
          document.documentElement.lang = x.lang
          const img = document.querySelector('.busto')
          Object.assign(img.style, { left: `${pos.left}px`, top: `${pos.top}px`, width: `${pos.w}px`, height: `${pos.h}px` })
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
        { c: t.cores, x: { ...t[lang], lang }, pos, src: b.src },
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
      saidas.push({ lang, arq, bytes: statSync(arq).size, qualidade: q, ...medidas })
    }
    return { saidas, caixa: b.caixa }
  } finally {
    await navegador.close()
  }
}

mkdirSync(join(RAIZ, 'public/og'), { recursive: true })
const { saidas, caixa: c } = await fotografar(textos())
console.log(
  `busto: fov ${c.fov.toFixed(2)}°, cabeça x ${(BUSTO.left + c.x0).toFixed(0)}–${(BUSTO.left + c.x1).toFixed(0)}, ` +
    `cabelo y ${(BUSTO.top + c.y0).toFixed(0)}, barba (y ${Y_BASE} no glb) y ${(BUSTO.top + c.y1).toFixed(0)}`,
)
for (const s of saidas) {
  console.log(`${s.lang}: ${s.arq.replace(RAIZ + '/', '')} ${W}×${H} ${(s.bytes / 1024).toFixed(1)} KB (JPEG q${s.qualidade})`)
  console.log(`  fonte: ${s.fonte}`)
  for (const q of s.textos)
    console.log(`  ${q.sel}: x ${q.x0.toFixed(0)}–${q.x1.toFixed(0)}, y ${q.y0.toFixed(0)}–${q.y1.toFixed(0)}, ${q.linhas} linha(s)`)
}
