// Evidência de site da vida `vela` num comando só: capturas nas 3 telas (e com movimento reduzido), poses de olhar e
// arrasto, sequência da troca/aula (0 a 4 s a cada 0,25 s), sequência reduzida, medidas da ficha (medidas_vela.mjs) e
// a folha de contato rotulada por R# (≤ 1568 px). Contra o pnpm dev da 5199 (SwiftShader: não mede GPU de celular).
// Uso: node 3d/tools/props/site_vela.mjs [pasta=3d/captura/props/vela/v1/site] [rótulo=v1] [--so=medidas,folha,...]
// Etapas: estatico, reduzido, poses, sequencia, seqreduzida, medidas, folha. Sai 1 se as medidas reprovarem.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const [pasta = '3d/captura/props/vela/v1/site', rot = 'v1'] = args.filter((a) => !a.startsWith('--'))
const so = args.find((a) => a.startsWith('--so='))?.slice(5).split(',')
const faz = (etapa) => !so || so.includes(etapa)
let medidasOk = true

function rodar(nome, cmd) {
  console.log(`▶ ${nome}: node ${cmd.join(' ')}`)
  const r = spawnSync('node', cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
  const saida = `${r.stdout}${r.stderr}`.trim().split('\n').slice(-12).join('\n')
  console.log(saida)
  return r.status
}

const cap = (modo, extra = []) => ['3d/tools/captura_prop.mjs', modo, 'vela', pasta, rot, ...extra]
if (faz('estatico')) rodar('estático', cap('estatico'))
if (faz('reduzido')) rodar('estático reduzido', cap('estatico', ['--reduzido']))
if (faz('poses')) rodar('poses', cap('poses'))
if (faz('sequencia')) rodar('sequência', cap('sequencia'))
if (faz('seqreduzida')) rodar('sequência reduzida', cap('sequencia', ['--reduzido', '--tempos=0,1,2,3']))
if (faz('medidas')) {
  medidasOk = rodar('medidas', ['3d/tools/props/medidas_vela.mjs', `${pasta}/medidas`, rot]) === 0
}

/** Recorte (px da captura) em volta de todos os nós medidos naquela tela, com margem. */
function recorte(med, tela, dsf) {
  const t = med?.telas.find((x) => x.tela === tela)
  const bs = Object.values(t?.nos ?? {}).filter((n) => n.box).map((n) => n.box)
  if (!bs.length) return ''
  const m = 30
  const x0 = Math.max(0, Math.min(...bs.map((b) => b[0])) - m)
  const y0 = Math.max(0, Math.min(...bs.map((b) => b[1])) - m)
  const [w, h] = tela.split('x').map(Number)
  const x1 = Math.min(w, Math.max(...bs.map((b) => b[0] + b[2])) + m)
  const y1 = Math.min(h, Math.max(...bs.map((b) => b[1] + b[3])) + m)
  return [x0, y0, x1 - x0, y1 - y0].map((v) => Math.round(v * dsf)).join(',')
}

if (faz('folha')) {
  const arq = `${pasta}/medidas/${rot}.json`
  const med = existsSync(arq) ? JSON.parse(readFileSync(arq, 'utf8')) : null
  const f = (nome) => `${pasta}/${rot}-${nome}.png`
  const telas = [
    ['1440x900', 1],
    ['1024x768', 1],
    ['360x740', 2],
  ]
  const specs = ['#V1-V5, V9, V10 no site: 3 telas (recorte nos nós medidos) e movimento reduzido']
  for (const [t, dsf] of telas) specs.push(`${f(t)}|${t}|${recorte(med, t, dsf)}`)
  specs.push(`${f('1440x900-reduzido')}|1440 movimento reduzido|${recorte(med, '1440x900', 1)}`)
  specs.push('#V2, V3 vestidos: olhar (os olhos seguem o ponteiro pela lente) e arrasto')
  for (const p of ['olhar-sup-esq', 'olhar-inf-dir', 'arrasto-esq', 'arrasto-dir']) specs.push(`${f(`pose-${p}`)}|${p}`)
  specs.push('#V8 aula: t desde a montagem (virada do Laser 0,6-1,6 s; Optimist 1,1-2,1 s; lais 0,2-1,4 s)')
  for (const t of [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 3.0]) specs.push(`${f(`seq-${t.toFixed(2)}s`)}|t=${t} s`)
  specs.push('#Movimento reduzido: estado final parado desde a montagem')
  for (const t of [0, 1, 2, 3]) specs.push(`${f(`seq-${t.toFixed(2)}s-reduzido`)}|reduzido t=${t} s`)
  execFileSync('python3', ['3d/tools/props/folha_contato.py', `${pasta}/folha.png`, ...specs], { stdio: 'inherit' })
}
process.exitCode = medidasOk ? 0 : 1
