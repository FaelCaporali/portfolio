// Prova INDEPENDENTE do orquestrador (não usa o folga.ts do TD): folga mínima entre as malhas que casam com um padrão
// (padrão: os barcos da vela) e o busto + o que está vestido (boné, óculos, apito), no espaço do grupo `prop` (= glb),
// amostrada em tempo real durante ≥ 1 volta, em várias poses (ponteiro no centro e nos cantos, arrasto).
// Distância = vértice da peça × vértice mais próximo do obstáculo (malha do S13 com ~2 mm entre vértices); "dentro"
// quando o ponto está do lado de dentro da normal do vértice mais próximo. Sai 1 se algum quadro tiver folga < limite.
// Uso: node 3d/tools/props/colisao_orq.mjs [vida=vela] [pasta] [limite_mm=5] [--url=http://localhost:5199]
import { mkdirSync, writeFileSync } from 'node:fs'
import { abrir, launch } from './site.mjs'

// Sem GPU o relógio do herói anda mais devagar que o real (passo ≤ 0,1 s por quadro): amostrar tempo real de sobra.
const JANELA_MS = 12000
const args = process.argv.slice(2)
const [vida = 'vela', pasta = '3d/captura/props/vela/v1/orquestrador', limiteMm = '5'] = args.filter((a) => !a.startsWith('--'))
const PECA = /^vela_(laser|optimist)/
const OBSTACULO = /^vela_(bone|oculos|apito)/
const limite = Number(limiteMm) / 1000
mkdirSync(pasta, { recursive: true })

const browser = await launch()
const { page } = await abrir(browser, { viewport: { width: 1440, height: 900 }, query: `slot=${vida}&d=0` })
await page.waitForTimeout(2500)

/** Uma amostra: folga mínima assinada (m, espaço do glb) e onde ocorreu. */
const amostra = () =>
  page.evaluate(
    ({ peca, obst }) => {
      const d = window.__heroDebug
      const prop = d.medidas.objeto('prop')
      const bust = d.medidas.objeto('bust')
      const reP = new RegExp(peca)
      const reO = new RegExp(obst)
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
      coleta(prop, (o) => nomes(o).some((n) => reO.test(n)))
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
    { peca: PECA.source, obst: OBSTACULO.source },
  )

const poses = [
  ['centro', async () => page.mouse.move(720, 450)],
  ['sup-esq', async () => page.mouse.move(40, 40)],
  ['sup-dir', async () => page.mouse.move(1400, 40)],
  ['inf-esq', async () => page.mouse.move(40, 860)],
  ['inf-dir', async () => page.mouse.move(1400, 860)],
  ['arrasto-esq', async () => { await page.mouse.move(1000, 450); await page.mouse.down(); await page.mouse.move(700, 450, { steps: 8 }) }],
  ['arrasto-dir', async () => { await page.mouse.move(1000, 450); await page.mouse.down(); await page.mouse.move(1300, 450, { steps: 8 }) }],
]
const resultado = { vida, limiteMm: Number(limiteMm), poses: {} }
let reprovou = false
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
      await page.screenshot({ path: `${pasta}/colisao-${nome}.png` })
    }
  }
  await page.mouse.up()
  resultado.poses[nome] = { amostras: n, obstaculos: obst, folgaMm: +(pior.folga * 1000).toFixed(2), malha: pior.malha, p: pior.p, t: pior.t }
  if (pior.folga < limite) reprovou = true
  console.log(`${nome}: ${n} amostras, folga mínima ${(pior.folga * 1000).toFixed(2)} mm (${pior.malha}) ${pior.folga < limite ? 'REPROVA' : 'ok'}`)
}
resultado.aprovado = !reprovou
writeFileSync(`${pasta}/colisao.json`, JSON.stringify(resultado, null, 2))
await browser.close()
process.exitCode = reprovou ? 1 : 0
