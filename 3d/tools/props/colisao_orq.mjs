// Prova INDEPENDENTE do orquestrador (não usa o folga.ts do TD): folga mínima entre as malhas que casam com um padrão
// (padrão: os barcos da vela) e o busto + o que está vestido (boné, óculos, apito), no espaço do grupo `prop` (= glb),
// amostrada em tempo real durante ≥ 1 volta, em várias poses (ponteiro no centro e nos cantos, arrasto).
// Distância = vértice da peça × vértice mais próximo do obstáculo (malha do S13 com ~2 mm entre vértices); "dentro"
// quando o ponto está do lado de dentro da normal do vértice mais próximo. Sai 1 se algum quadro tiver folga < limite.
// Uso: node 3d/tools/props/colisao_orq.mjs [vida=vela] [pasta] [limite_mm=5] [--peca=<regex>] [--obst=<regex>]
//   --peca: malhas medidas (padrão por vida em PADROES; vela: os barcos). --obst: o que está vestido e conta como
//   obstáculo além do busto (vela: boné, óculos, apito; vazio = só o busto). URL do site: variável SITE (site.mjs).
//   --tela=LxA (padrão 1440x900): o ponteiro das poses escala com a tela (a vela foi medida no 1440). Com outra tela,
//   o json sai como colisao-<tela>.json.
//   --entrada: antes das poses, a entrada da vida com relógio falso desde a montagem (a cada 40 ms até 4,5 s), que no
//   tempo real passa antes da primeira amostra (qa: a rota de entrada do bug e a subida da lupa).
import { mkdirSync, writeFileSync } from 'node:fs'
import { abrir, launch } from './site.mjs'

// Sem GPU o relógio do herói anda mais devagar que o real (passo ≤ 0,1 s por quadro): amostrar tempo real de sobra.
const JANELA_MS = 12000
const args = process.argv.slice(2)
const [vida = 'vela', pasta = `3d/captura/props/${vida}/v1/orquestrador`, limiteMm = '5'] = args.filter(
  (a) => !a.startsWith('--'),
)
/** Peça × obstáculo vestido por vida (sobrescritos por --peca/--obst). Uber: volante e mãos contra o busto.
 * Fullstack: o notebook inteiro (tampa, base e adesivos) contra o busto; a chuva de código do fundo fica de fora.
 * Qa: o bug (voo inteiro) e a mão com a lupa contra o busto; sem obstáculo vestido. */
const PADROES = {
  vela: { peca: '^vela_(laser|optimist)', obst: '^vela_(bone|oculos|apito)' },
  uber: { peca: '^uber_(volante|mao_)', obst: '' },
  fullstack: { peca: '^fs_(notebook|adesiv)', obst: '' },
  qa: { peca: '^qa_(bug|lupa|mao)', obst: '' },
  // Techlead (FICHA-PRODUCAO, FECHAMENTO): o headset inteiro contra o busto, com limite -1 (as conchas encostam por
  // design, nada atravessa mais de 1 mm); a cápsula sozinha com --peca=^tl_mic$ e limite 10 (≥ 1 cm da pele).
  techlead: { peca: '^tl_headset$', obst: '' },
}
const opc = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const padrao = PADROES[vida] ?? PADROES.vela
const PECA = opc('peca') ?? padrao.peca
const OBSTACULO = opc('obst') ?? padrao.obst
const limite = Number(limiteMm) / 1000
mkdirSync(pasta, { recursive: true })

const [W, H] = (opc('tela') ?? '1440x900').split('x').map(Number)
const sx = W / 1440
const sy = H / 900
const browser = await launch()
const { page } = await abrir(browser, { viewport: { width: W, height: H }, query: `slot=${vida}&d=0` })
await page.waitForTimeout(2500)

/** Uma amostra: folga mínima assinada (m, espaço do glb) e onde ocorreu. */
const amostra = (pg = page) =>
  pg.evaluate(
    ({ peca, obst }) => {
      const d = window.__heroDebug
      const prop = d.medidas.objeto('prop')
      const bust = d.medidas.objeto('bust')
      const reP = new RegExp(peca)
      const reO = obst ? new RegExp(obst) : null
      const nomes = (o) => {
        const n = []
        for (let p = o; p && p !== prop && p !== bust; p = p.parent) n.push(p.name)
        return n
      }
      const visivel = (o) => {
        for (let p = o; p; p = p.parent) if (!p.visible) return false
        return true
      }
      prop.updateWorldMatrix(true, true)
      bust.updateWorldMatrix(true, true)
      const inv = prop.matrixWorld.clone().invert()
      const V = prop.position.constructor
      const M3 = new (Object.getPrototypeOf(prop.normalMatrix).constructor)()
      const v = new V()
      const nrm = new V()
      // Obstáculos: busto inteiro + vestidos, com normal.
      const obs = []
      const coleta = (raiz, filtro) =>
        raiz.traverse((o) => {
          if (!o.isMesh || !visivel(o) || !filtro(o)) return
          const m = inv.clone().multiply(o.matrixWorld)
          M3.getNormalMatrix(m)
          const pos = o.geometry.getAttribute('position')
          const nor = o.geometry.getAttribute('normal')
          for (let i = 0; i < pos.count; i++) {
            o.getVertexPosition(i, v).applyMatrix4(m)
            if (nor) nrm.fromBufferAttribute(nor, i).applyMatrix3(M3).normalize()
            else nrm.set(0, 0, 0)
            obs.push(v.x, v.y, v.z, nrm.x, nrm.y, nrm.z)
          }
        })
      coleta(bust, () => true)
      if (reO) coleta(prop, (o) => nomes(o).some((n) => reO.test(n)))
      const C = 0.01
      const grade = new Map()
      const chave = (x, y, z) => `${Math.floor(x / C)},${Math.floor(y / C)},${Math.floor(z / C)}`
      for (let k = 0; k < obs.length; k += 6) {
        const c = chave(obs[k], obs[k + 1], obs[k + 2])
        let l = grade.get(c)
        if (!l) grade.set(c, (l = []))
        l.push(k)
      }
      let pior = { folga: Infinity }
      prop.traverse((o) => {
        if (!o.isMesh || !visivel(o)) return
        const ns = nomes(o)
        if (!ns.some((n) => reP.test(n))) return
        const m = inv.clone().multiply(o.matrixWorld)
        const pos = o.geometry.getAttribute('position')
        for (let i = 0; i < pos.count; i++) {
          o.getVertexPosition(i, v).applyMatrix4(m)
          const cx = Math.floor(v.x / C)
          const cy = Math.floor(v.y / C)
          const cz = Math.floor(v.z / C)
          let best = Infinity
          let bk = -1
          for (let a = -1; a <= 1; a++)
            for (let b = -1; b <= 1; b++)
              for (let c = -1; c <= 1; c++) {
                const l = grade.get(`${cx + a},${cy + b},${cz + c}`)
                if (!l) continue
                for (const k of l) {
                  const dx = v.x - obs[k]
                  const dy = v.y - obs[k + 1]
                  const dz = v.z - obs[k + 2]
                  const q = dx * dx + dy * dy + dz * dz
                  if (q < best) {
                    best = q
                    bk = k
                  }
                }
              }
          if (bk < 0) continue
          const dist = Math.sqrt(best)
          const lado = (v.x - obs[bk]) * obs[bk + 3] + (v.y - obs[bk + 1]) * obs[bk + 4] + (v.z - obs[bk + 2]) * obs[bk + 5]
          const f = lado < 0 ? -dist : dist
          if (f < pior.folga) pior = { folga: f, malha: ns[0], p: [v.x, v.y, v.z].map((x) => +x.toFixed(4)) }
        }
      })
      return { pior, obstaculos: obs.length / 6 }
    },
    { peca: PECA, obst: OBSTACULO },
  )

/** Entrada da vida com relógio falso (como volta_prop.mjs): monta outra vida e volta, e amostra a cada 40 ms. */
async function entrada() {
  const aberta = await abrir(browser, { viewport: { width: W, height: H }, query: `slot=${vida}`, relogio: true })
  const pg = aberta.page
  // Margem larga: a página das poses desenha ao mesmo tempo e o relógio da página anda enquanto a ordem chega.
  await pg.clock.pauseAt((await pg.evaluate(() => Date.now())) + 8000)
  const palavra = () =>
    pg.evaluate(() => document.querySelector('.slot-word:not(.is-leaving)')?.textContent?.replace(/\s+/g, ' ').trim())
  const montar = async (alvo) => {
    await pg.evaluate(
      (v) => [...document.querySelectorAll('nav[aria-label="Timeline"] button')].find((b) => b.ariaLabel === v)?.click(),
      alvo,
    )
    for (let i = 0; i < 300; i++) {
      await pg.clock.runFor(20)
      if ((await palavra())?.includes(alvo) && (await pg.evaluate(() => window.__heroDebug?.ready() === true))) return
    }
    throw new Error(`a vida ${alvo} não montou`)
  }
  const vidas = await pg.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="Timeline"] button')].map((b) => b.getAttribute('aria-label') ?? ''),
  )
  await montar(vidas[(vidas.indexOf(aberta.vidaInicial) + 1) % vidas.length])
  await montar(aberta.vidaInicial)
  let pior = { folga: Infinity }
  let n = 0
  for (let t = 0; t <= 4500; t += 40) {
    const a = await amostra(pg)
    n++
    if (a.pior.folga < pior.folga) pior = { ...a.pior, t: t / 1000 }
    await pg.clock.runFor(40)
  }
  await aberta.ctx.close()
  return { amostras: n, pior }
}

const mover = (x, y, o) => page.mouse.move(x * sx, y * sy, o)
const poses = [
  ['centro', async () => mover(720, 450)],
  ['sup-esq', async () => mover(40, 40)],
  ['sup-dir', async () => mover(1400, 40)],
  ['inf-esq', async () => mover(40, 860)],
  ['inf-dir', async () => mover(1400, 860)],
  ['arrasto-esq', async () => { await mover(1000, 450); await page.mouse.down(); await mover(700, 450, { steps: 8 }) }],
  ['arrasto-dir', async () => { await mover(1000, 450); await page.mouse.down(); await mover(1300, 450, { steps: 8 }) }],
]
const tela = `${W}x${H}`
const resultado = { vida, tela, peca: PECA, obstaculo: OBSTACULO || null, limiteMm: Number(limiteMm), poses: {} }
let reprovou = false
if (args.includes('--entrada')) {
  const { amostras, pior } = await entrada()
  const longe = !Number.isFinite(pior.folga)
  resultado.poses.entrada = { amostras, folgaMm: longe ? null : +(pior.folga * 1000).toFixed(2), ...pior, folga: undefined }
  if (pior.folga < limite) reprovou = true
  console.log(`entrada: ${amostras} amostras, folga mínima ${(pior.folga * 1000).toFixed(2)} mm (${pior.malha}) t=${pior.t} ${pior.folga < limite ? 'REPROVA' : 'ok'}`)
}
for (const [nome, entrar] of poses) {
  await entrar()
  await page.waitForTimeout(400)
  const t0 = Date.now()
  let pior = { folga: Infinity }
  let n = 0
  let obst = 0
  while (Date.now() - t0 < JANELA_MS) {
    const a = await amostra()
    obst = a.obstaculos
    n++
    if (a.pior.folga < pior.folga) {
      pior = { ...a.pior, t: (Date.now() - t0) / 1000 }
      await page.screenshot({ path: `${pasta}/colisao-${tela === '1440x900' ? '' : `${tela}-`}${nome}.png` })
    }
  }
  await page.mouse.up()
  // Sem obstáculo nas células vizinhas (grade de 1 cm), a folga é ≥ 10 mm: registrado como tal, não como número.
  const longe = !Number.isFinite(pior.folga)
  resultado.poses[nome] = {
    amostras: n,
    obstaculos: obst,
    folgaMm: longe ? null : +(pior.folga * 1000).toFixed(2),
    ...(longe ? { folgaMinimaMm: 10, nota: 'nenhum vértice da peça a menos de 1 cm do obstáculo' } : {}),
    malha: pior.malha,
    p: pior.p,
    t: pior.t,
  }
  if (pior.folga < limite) reprovou = true
  console.log(`${nome}: ${n} amostras, folga mínima ${(pior.folga * 1000).toFixed(2)} mm (${pior.malha}) ${pior.folga < limite ? 'REPROVA' : 'ok'}`)
}
resultado.aprovado = !reprovou
writeFileSync(`${pasta}/colisao${tela === '1440x900' ? '' : `-${tela}`}.json`, JSON.stringify(resultado, null, 2))
await browser.close()
process.exitCode = reprovou ? 1 : 0
