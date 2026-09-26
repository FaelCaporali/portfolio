// Prova da regra de vela (ADENDO 7): diagrama do percurso visto de CIMA, feito com a MESMA matemática do site
// (src/features/hero/scene/props/vela/aula.ts e circuito.ts, transpilados na hora pelo TypeScript). Seta do vento
// verdadeiro, rastro do percurso colorido pelo ponto de vela, a cabeça, e os dois barcos a cada 0,25 s de 0 a 3 s com
// casco (proa), retranca (com a inércia do site) e rótulo t / α / retranca. Grava SVG, PNG e a tabela em JSON.
// Uso: node 3d/tools/props/diagrama_vela.mjs [pasta=3d/captura/props/vela/v1/site] [rótulo=v1]
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ts from 'typescript'

const tmp = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'aula-'))
for (const f of ['aula', 'circuito']) {
  const src = readFileSync(`src/features/hero/scene/props/vela/${f}.ts`, 'utf8')
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
  writeFileSync(join(tmp, `${f}.mjs`), js.outputText.replace(/from '\.\/(\w+)'/g, "from './$1.mjs'"))
}
const A = await import(join(tmp, 'aula.mjs'))

const [pasta = '3d/captura/props/vela/v1/site', rot = 'v1'] = process.argv.slice(2)
mkdirSync(pasta, { recursive: true })
const G = 180 / Math.PI
const W = 1300
const H = 1060
const S = 1700 // px por metro
const ox = 560
const oz = 520 // página: x → direita, z (para a câmera) → baixo; centro em (0, −0,13)
const px = (x) => ox + x * S
const pz = (z) => oz + (z + 0.13) * S
const f1 = (n) => n.toFixed(1)

// Rastro: a volta inteira, amostrada fino, colorida pelo |α| (vermelho < 40° = zona proibida).
const p = {}
const trilha = []
for (let i = 0; i <= 600; i++) {
  A.percurso((i / 600) * A.VOLTA, 0, p)
  trilha.push({ ...p })
}
const cor = (a) => {
  const g = Math.abs(a) * G
  return g < 40 ? '#e0322b' : g < 60 ? '#f08c00' : g < 110 ? '#2f9e44' : g < 160 ? '#1c7ed6' : '#7048e8'
}
const svg = []
svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="DejaVu Sans" font-size="13">`)
svg.push(`<rect width="${W}" height="${H}" fill="#fbfaf7"/>`)
svg.push(`<text x="20" y="28" font-size="18">Vela V8 — percurso visto de cima (mesma matemática do site: aula.ts)</text>`)
svg.push(
  `<text x="20" y="50">volta ${A.VOLTA} s · virada do Laser em t=${A.VIRA_LASER} s · Optimist +${A.ATRASO} s · escala ${A.ESCALA}</text>`,
)
// Cabeça (crânio no espaço do glb: x ±0,09, z −0,30 a 0,01) e o rosto (+z, embaixo).
svg.push(`<ellipse cx="${px(0)}" cy="${pz(-0.145)}" rx="${0.09 * S}" ry="${0.16 * S}" fill="#e9e3da" stroke="#9c8f80"/>`)
svg.push(`<text x="${px(0) - 24}" y="${pz(0.05) + 18}">rosto ↓ câmera</text>`)
// Vento: seta de onde vem para onde vai.
const vx = -A.VENTO_DE.x
const vz = -A.VENTO_DE.z
const w0 = [px(0.36), pz(-0.38)]
svg.push(`<defs><marker id="m" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">`)
svg.push(`<path d="M0,0 L10,5 L0,10 z" fill="#333"/></marker></defs>`)
svg.push(
  `<line x1="${w0[0]}" y1="${w0[1]}" x2="${w0[0] + vx * 160}" y2="${w0[1] + vz * 160}" stroke="#333" stroke-width="4" marker-end="url(#m)"/>`,
)
svg.push(`<text x="${w0[0] - 60}" y="${w0[1] - 12}" font-size="15">vento verdadeiro (fixo)</text>`)
for (let i = 0; i < trilha.length - 1; i++) {
  const a = trilha[i]
  const b = trilha[i + 1]
  svg.push(
    `<line x1="${px(a.x)}" y1="${pz(a.z)}" x2="${px(b.x)}" y2="${pz(b.z)}" stroke="${cor(a.alfa)}" stroke-width="5"/>`,
  )
}
// Legenda do rastro.
;[
  ['#e0322b', '|α| < 40° (só na virada)'],
  ['#f08c00', 'orça 40–60°'],
  ['#2f9e44', 'través'],
  ['#1c7ed6', 'largo'],
  ['#7048e8', 'popa (jaibe)'],
].forEach(([c, t], i) => {
  svg.push(`<rect x="20" y="${H - 130 + i * 22}" width="18" height="12" fill="${c}"/>`)
  svg.push(`<text x="44" y="${H - 120 + i * 22}">${t}</text>`)
})

// Barcos a cada 0,25 s, com a inércia da retranca e do adernamento do site (passo de 1/60 s).
const linhas = []
for (const [nome, atraso, c, L] of [
  ['Laser', 0, '#111', 0.05],
  ['Optimist', A.ATRASO, '#c2255c', 0.03],
]) {
  const est = { r: null }
  const v = {}
  let proximo = 0
  for (let k = 0; k <= 3 * 60; k++) {
    const t = k / 60
    A.percurso(t, atraso, p)
    A.pontoDeVela(p.alfa, v)
    est.r = est.r == null ? v.retranca : A.seguir(est.r, v.retranca, 1 / 60, A.TAU_RETRANCA)
    if (t + 1e-9 < proximo) continue
    proximo += 0.25
    const bx = Math.cos(p.rumo)
    const bz = -Math.sin(p.rumo)
    const [x, z] = [px(p.x), pz(p.z)]
    const proa = [x + bx * L * S, z + bz * L * S]
    const popa = [x - bx * L * S * 0.6, z - bz * L * S * 0.6]
    // Retranca: da base do mastro para a popa, girada `r` para boreste (+z do casco).
    const ang = p.rumo + Math.PI + est.r
    const rx = Math.cos(ang)
    const rz = -Math.sin(ang)
    svg.push(`<line x1="${popa[0]}" y1="${popa[1]}" x2="${proa[0]}" y2="${proa[1]}" stroke="${c}" stroke-width="3"/>`)
    svg.push(`<circle cx="${proa[0]}" cy="${proa[1]}" r="3.5" fill="${c}"/>`)
    svg.push(
      `<line x1="${x}" y1="${z}" x2="${x + rx * L * S * 0.8}" y2="${z + rz * L * S * 0.8}" stroke="#f59f00" stroke-width="3"/>`,
    )
    const rotulo = `${nome[0]} ${t.toFixed(2)}s α${f1(p.alfa * G)}° r${f1(est.r * G)}°`
    const lado = nome === 'Laser' ? -1 : 1
    svg.push(`<text x="${x + 8}" y="${z + lado * 14}" fill="${c}" font-size="11">${rotulo}</text>`)
    linhas.push({ barco: nome, t, x: p.x, y: p.y, z: p.z, rumo: p.rumo * G, alfa: p.alfa * G, retranca: est.r * G })
  }
}
svg.push('</svg>')
const base = `${pasta}/${rot}-diagrama-cima`
writeFileSync(`${base}.svg`, svg.join('\n'))
writeFileSync(`${base}.json`, JSON.stringify(linhas, null, 2))
execFileSync('inkscape', [`${base}.svg`, '--export-type=png', `--export-filename=${base}.png`], { stdio: 'ignore' })
// Conferência da regra: rumo sustentado na zona proibida e retranca do lado errado.
const proibido = trilha.filter((q) => Math.abs(q.alfa) * G < 40).length / trilha.length
const errado = linhas.filter((l) => Math.abs(l.alfa) > 45 && Math.sign(l.alfa) !== Math.sign(l.retranca)).length
console.log(`fração da volta com |α| < 40°: ${(proibido * 100).toFixed(1)} % (só no canto da virada)`)
console.log(`quadros com retranca a barlavento (|α| > 45°): ${errado}`)
console.log(`→ ${base}.png`)
