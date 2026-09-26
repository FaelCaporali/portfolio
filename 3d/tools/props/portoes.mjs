// Portões mecânicos do estúdio 3D (ESTUDIO §5): silhueta, tamanho em tela, arte ↔ cena e orçamento, no site real
// (pnpm dev da 5199, SwiftShader) nas 3 telas, pelo gancho window.__heroDebug. Grava imagens, JSON e o veredito.
// Uso: node 3d/tools/props/portoes.mjs <vida> <pasta> <rótulo> [--glb=arquivo.glb] [--q=lab=<glb>] [--camera[=json]]
//        [--espera=16000] [--telas=1440x900,1024x768,360x740]
// Sem --q=lab= mede o adereço integrado da vida; com ele, o glb do laboratório. --glb= é o arquivo do orçamento
// (padrão: o do laboratório). --camera grava 3d/tools/props/camera-site.json (câmera e frame de cada tela).
// Sai com código 1 se algum portão reprovar. Números em px CSS; SwiftShader não mede FPS de celular.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { lerGlb } from './glb.mjs'
import { limitesDa } from './limites.mjs'
import { TELAS, abrir, dilatar, extras, gravarPng, launch, retangulosUi, uniao } from './site.mjs'

const { query, espera, resto } = extras(process.argv.slice(2))
const [vida = 'financeiro', pasta = '3d/captura/props/ferramental', rot = 'portoes'] = resto.filter(
  (a) => !a.startsWith('--'),
)
const L = limitesDa(vida)
const opt = (k) =>
  resto
    .find((a) => a === `--${k}` || a.startsWith(`--${k}=`))
    ?.split('=')
    .slice(1)
    .join('=')
const camFlag = resto.some((a) => a.startsWith('--camera'))
const camSaida = opt('camera') || '3d/tools/props/camera-site.json'
const lab = new URLSearchParams(query).get('lab')
const glbArq = opt('glb') || lab?.replace(/^\//, '')
const telasPedidas = opt('telas')?.split(',')
const telas = TELAS.filter(([w, h]) => !telasPedidas || telasPedidas.includes(`${w}x${h}`))
mkdirSync(pasta, { recursive: true })

const r1 = (n) => Math.round(n * 10) / 10
const falha = (lista, cond, txt) => cond && lista.push(txt)

async function medirTela(browser, [w, h, dsf]) {
  const tela = `${w}x${h}`
  const { ctx, page } = await abrir(browser, {
    viewport: { width: w, height: h },
    dsf,
    query: [`slot=${vida}&d=0`, query].filter(Boolean).join('&'),
  })
  await page.waitForTimeout(espera)
  const camera = await page.evaluate(() => window.__heroDebug.camera())
  const info = await page.evaluate(() => window.__heroDebug.info())
  const ui = await retangulosUi(page)
  const rects = Object.fromEntries(Object.entries(ui.rects).map(([k, r]) => [k, dilatar(r, L.arteCena.margemUi)]))
  const m = await page.evaluate((r) => window.__heroDebug.masks(r, true), rects)
  const base = `${pasta}/${rot}-${tela}`
  await page.screenshot({ path: `${base}-captura.png` })
  for (const [k, v] of Object.entries(m.imagens)) gravarPng(`${base}-${k}.png`, v)
  await ctx.close()
  delete m.imagens

  // Captura anotada: interface (vermelho), peça (amarelo), zonas do rosto (ciano), na escala da captura (dsf).
  const k = dsf
  const draw = []
  for (const r of Object.values(ui.rects)) draw.push('-stroke', '#ff3b3b', '-draw', rect(r, k))
  if (m.peca.box) draw.push('-stroke', '#ffd400', '-draw', rect(m.peca.box, k))
  for (const z of m.rosto)
    draw.push(
      '-stroke',
      '#00e5ff',
      '-draw',
      `circle ${z.centro[0] * k},${z.centro[1] * k} ${(z.centro[0] + z.raio) * k},${z.centro[1] * k}`,
    )
  execFileSync('convert', [
    `${base}-captura.png`,
    '-fill',
    'none',
    '-strokewidth',
    String(k),
    ...draw,
    `${base}-arte-cena.png`,
  ])
  return { tela, dsf, camera, info, ui, m, base }
}

function rect(r, k) {
  return `rectangle ${r.x * k},${r.y * k} ${(r.x + r.w) * k},${(r.y + r.h) * k}`
}

function julgar(med, glb) {
  const port = { silhueta: [], tamanho: [], arteCena: [], orcamento: [] }
  const tabela = []
  for (const { tela, ui, m, info } of med) {
    const cab = m.cabeca.box?.h ?? 0
    const lado = m.peca.box ? Math.max(m.peca.box.w, m.peca.box.h) : 0
    const razao = cab ? lado / cab : 0
    const sobreUi = Object.entries(m.sobreUi).filter(([, px]) => px > L.arteCena.pxSobreUiMax)
    const rosto = m.rosto.filter((z) => z.pxCobertos > L.arteCena.pxRostoMax)
    const b = m.peca.box
    const borda =
      b &&
      (b.x < L.arteCena.bordaMinPx ||
        b.y < L.arteCena.bordaMinPx ||
        b.x + b.w > ui.canvas.w - L.arteCena.bordaMinPx ||
        b.y + b.h > ui.canvas.h - L.arteCena.bordaMinPx)
    const pequenas = m.partes.filter((p) => Math.max(p.box.w, p.box.h) < L.tamanho.parteMinPx)
    const s = port.silhueta
    falha(s, !b, `${tela}: peça sem pixel visível`)
    falha(
      s,
      m.ocultaPelaCabeca > L.silhueta.ocultaMax,
      `${tela}: ${r1(m.ocultaPelaCabeca * 100)}% da peça atrás da cabeça (máx. ${L.silhueta.ocultaMax * 100}%)`,
    )
    falha(
      s,
      m.contornoNaCabeca > L.silhueta.contornoNaCabecaMax,
      `${tela}: ${r1(m.contornoNaCabeca * 100)}% do contorno encosta na cabeça (máx. ${L.silhueta.contornoNaCabecaMax * 100}%)`,
    )
    const t = port.tamanho
    falha(
      t,
      razao < L.tamanho.razaoMin || razao > L.tamanho.razaoMax,
      `${tela}: maior lado ${r1(lado)} px = ${r1(razao)} da cabeça (${r1(cab)} px); régua ${L.tamanho.razaoMin}–${L.tamanho.razaoMax}`,
    )
    for (const p of pequenas)
      t.push(`${tela}: parte ${p.nome} com ${r1(Math.max(p.box.w, p.box.h))} px (mín. ${L.tamanho.parteMinPx})`)
    if (tela === '1440x900') {
      for (const p of m.partes) {
        const d = p.triangulos / Math.max(1, p.box.w * p.box.h)
        falha(
          t,
          d > L.tamanho.densidadeMax,
          `${tela}: parte ${p.nome} com ${p.triangulos} tri em ${r1(p.box.w)}×${r1(p.box.h)} px = ${r1(d)} tri/px² (máx. ${L.tamanho.densidadeMax})`,
        )
      }
    }
    const a = port.arteCena
    for (const [nome, px] of sobreUi)
      a.push(`${tela}: ${r1(px)} px da peça sobre ${nome} (margem ${L.arteCena.margemUi} px)`)
    for (const z of rosto) a.push(`${tela}: ${r1(z.pxCobertos)} px da peça sobre ${z.nome}`)
    falha(
      a,
      m.ocultaPelaCabeca > L.arteCena.ocultaMax,
      `${tela}: ${r1(m.ocultaPelaCabeca * 100)}% da peça (o que ela carrega) atrás da cabeça`,
    )
    falha(a, borda, `${tela}: peça encosta na borda da tela`)
    const calls = info.sem ? info.com.calls - info.sem.calls : null
    const tris = info.sem ? info.com.triangulos - info.sem.triangulos : null
    falha(
      port.orcamento,
      calls > L.orcamento.chamadasMax,
      `${tela}: ${calls} chamadas de desenho da peça na página (máx. ${L.orcamento.chamadasMax})`,
    )
    falha(
      port.orcamento,
      tris > L.orcamento.triangulosMax,
      `${tela}: ${tris} triângulos da peça na página (máx. ${L.orcamento.triangulosMax})`,
    )
    tabela.push({
      tela,
      cabecaPx: r1(cab),
      pecaPx: m.peca.box && [r1(m.peca.box.w), r1(m.peca.box.h)],
      razao: r1(razao * 100) / 100,
      oculta: r1(m.ocultaPelaCabeca * 100),
      contorno: r1(m.contornoNaCabeca * 100),
      chamadas: calls,
      triangulos: tris,
    })
  }
  const o = port.orcamento
  if (glb) {
    falha(
      o,
      glb.bytes > L.orcamento.bytesMax,
      `glb com ${r1(glb.bytes / 1024)} kB (máx. ${L.orcamento.bytesMax / 1024} kB)`,
    )
    falha(
      o,
      !glb.extensoesUsadas.some((e) => L.orcamento.compressao.includes(e)),
      `glb sem compressão de geometria (esperada: ${L.orcamento.compressao.join(' ou ')})`,
    )
    falha(o, glb.cameras > 0 || glb.luzes > 0, `glb com ${glb.cameras} câmera(s) e ${glb.luzes} luz(es)`)
    for (const im of glb.imagens) {
      falha(o, !L.orcamento.mimes.includes(im.mime), `imagem ${im.nome} em ${im.mime} (esperado JPEG/WebP)`)
      falha(
        o,
        im.lado && Math.max(...im.lado) > L.orcamento.texturaLadoMax,
        `imagem ${im.nome} com ${im.lado?.join('×')}`,
      )
    }
  } else o.push('sem glb para ler (--glb=)')
  return { port, tabela }
}

const browser = await launch()
const med = []
for (const t of telas) med.push(await medirTela(browser, t))
await browser.close()

const glb = glbArq ? lerGlb(glbArq) : null
const { port, tabela } = julgar(med, glb)

// Folha de silhueta: recorte (cabeça + peça) de cada tela, no tamanho real, lado a lado.
// As máscaras saem no buffer de desenho (densidade m.dpr, que a qualidade adaptativa pode baixar), não na da captura.
const recortes = med.map(({ m, base, ui }) => {
  const k = m.dpr
  const u = uniao([m.cabeca.box, m.peca.boxTotal], 24, ui.canvas.w, ui.canvas.h)
  const g = `${Math.round(u.width * k)}x${Math.round(u.height * k)}+${Math.round(u.x * k)}+${Math.round(u.y * k)}`
  execFileSync('convert', [
    `${base}-contexto.png`,
    '-crop',
    g,
    '+repage',
    '-resize',
    `${100 / k}%`,
    `${base}-silhueta-recorte.png`,
  ])
  return `${base}-silhueta-recorte.png`
})
execFileSync('convert', [
  ...recortes,
  '-background',
  'white',
  '-gravity',
  'south',
  '-splice',
  '0x0',
  '+append',
  `${pasta}/${rot}-silhueta-folha.png`,
])

if (camFlag) {
  const cam = Object.fromEntries(
    med.map(({ tela, dsf, camera, m }) => [
      tela,
      { ...camera, dsfCaptura: dsf, dprMascara: m.dpr, cabecaBox: m.cabeca.box, bustoBox: m.busto.box },
    ]),
  )
  writeFileSync(
    camSaida,
    JSON.stringify({ gerado: new Date().toISOString(), origem: 'portoes.mjs --camera', telas: cam }, null, 2),
  )
  console.log(`câmera do site → ${camSaida}`)
}

const veredito = Object.fromEntries(Object.entries(port).map(([k, f]) => [k, { ok: f.length === 0, falhas: f }]))
const saida = {
  vida,
  rotulo: rot,
  query,
  glb,
  limites: L,
  tabela,
  veredito,
  medidas: med.map(({ tela, info, m }) => ({ tela, info, ...m })),
}
writeFileSync(`${pasta}/${rot}-portoes.json`, JSON.stringify(saida, null, 2))
console.table(tabela)
for (const [k, v] of Object.entries(veredito)) {
  console.log(`${v.ok ? 'PASSA' : 'REPROVA'}  ${k}`)
  for (const f of v.falhas) console.log(`   - ${f}`)
}
console.log(`→ ${pasta}/${rot}-portoes.json`)
process.exitCode = Object.values(veredito).every((v) => v.ok) ? 0 : 1
