// Erro da quantização de um glb otimizado (`otimizar.mjs`) contra o original, vértice a vértice. O `reorder` do
// otimizar só permuta vértices e índices; aqui ele é refeito, com as mesmas opções, sobre o original (C = reorder(A),
// sem perda), e C é comparado com o otimizado B na MESMA ordem: índices iguais, posição no mundo (mm, pela matriz de
// mundo do nó de cada malha, que no B carrega a desquantização), normal (graus), UV, cor e cada morfo (mm no mundo).
// Uso: node 3d/tools/props/erro_quantizacao.mjs <original.glb> <otimizado.glb> [--json=<saida.json>]
// Sai 1 se a ordem, os índices ou as contagens divergirem (aí a comparação por índice não vale).
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { reorder } from '@gltf-transform/functions'
import draco3d from 'draco3d'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const [arqA, arqB] = args.filter((a) => !a.startsWith('--'))
const saidaJson = args.find((a) => a.startsWith('--json='))?.slice(7)
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready])
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
})
const C = await io.read(arqA)
await C.transform(reorder({ encoder: MeshoptEncoder, target: 'size', cleanup: false }))
const B = await io.read(arqB)

const valores = (a) => {
  const el = []
  return Array.from({ length: a.getCount() }, (_, i) => [...a.getElement(i, el)])
}
const mundo = (doc, malha) => doc.getRoot().listNodes().find((n) => n.getMesh() === malha).getWorldMatrix()
const aplica = (m, v, w = 1) => [0, 1, 2].map((k) => m[k] * v[0] + m[4 + k] * v[1] + m[8 + k] * v[2] + m[12 + k] * w)
const norm = (v) => Math.hypot(...v) || 1
const angulo = (a, b) => {
  const d = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (norm(a) * norm(b))
  return (Math.acos(Math.min(1, Math.max(-1, d))) * 180) / Math.PI
}
const maxAbs = (xa, xb) => Math.max(...xa.map((v, i) => Math.max(...v.map((x, k) => Math.abs(x - xb[i][k])))))

/** Cada triângulo girado para começar no menor índice (mesmo sentido de giro). */
function triangulos(ix) {
  const t = []
  for (let k = 0; ix && k < ix.length; k += 3) {
    const [a, b, c] = [ix[k], ix[k + 1], ix[k + 2]]
    t.push(a <= b && a <= c ? `${a},${b},${c}` : b <= c ? `${b},${c},${a}` : `${c},${a},${b}`)
  }
  return t
}

const rel = {}
let falha = false
const malhasB = new Map(B.getRoot().listMeshes().map((m) => [m.getName(), m]))
for (const mc of C.getRoot().listMeshes()) {
  const mb = malhasB.get(mc.getName())
  const wc = mundo(C, mc)
  const wb = mundo(B, mb)
  mc.listPrimitives().forEach((pc, i) => {
    const pb = mb.listPrimitives()[i]
    const r = {}
    // O codec de índices do meshopt pode girar cada triângulo (a,b,c → b,c,a): compara na rotação canônica.
    const ic = triangulos(pc.getIndices()?.getArray())
    const ib = triangulos(pb.getIndices()?.getArray())
    r.indices_iguais = ic.length > 0 && ic.length === ib.length && ic.every((v, k) => v === ib[k])
    if (!r.indices_iguais) falha = true
    for (const sem of pc.listSemantics()) {
      const xa = valores(pc.getAttribute(sem))
      const xb = valores(pb.getAttribute(sem))
      if (xa.length !== xb.length) {
        falha = true
        r[sem] = 'contagem diferente'
      } else if (sem === 'POSITION') {
        r.posicao_mm = Math.max(...xa.map((v, k) => Math.hypot(...aplica(wc, v).map((x, j) => x - aplica(wb, xb[k])[j])))) * 1000
      } else if (sem === 'NORMAL') {
        r.normal_graus = Math.max(...xa.map((v, k) => angulo(aplica(wc, v, 0), aplica(wb, xb[k], 0))))
      } else r[sem] = maxAbs(xa, xb)
    }
    pc.listTargets().forEach((tc, t) => {
      const da = valores(tc.getAttribute('POSITION'))
      const db = valores(pb.listTargets()[t].getAttribute('POSITION'))
      const e = da.map((v, k) => Math.hypot(...aplica(wc, v, 0).map((x, j) => x - aplica(wb, db[k], 0)[j])))
      r[`morfo${t}_mm`] = Math.max(...e) * 1000
    })
    rel[`${mc.getName()}#${i}`] = r
    console.log(`${mc.getName()}#${i}`, JSON.stringify(r, (k, v) => (typeof v === 'number' ? +v.toPrecision(3) : v)))
  })
}
if (saidaJson) writeFileSync(saidaJson, JSON.stringify({ a: arqA, b: arqB, primitivas: rel }, null, 1))
console.log(falha ? 'RESULTADO: ordem/contagem divergente' : 'RESULTADO: mesma ordem; erros acima')
process.exit(falha ? 1 : 0)
