// Prova de identidade entre dois glbs de um adereço (ex.: o do main e o de um branch que só troca a imagem).
// Decodifica tudo (meshopt, quantização) pelo gltf-transform e compara, por NOME e não por índice:
//   acessores de cada primitiva (atributos, índices, morfos), das skins (matrizes inversas) e das animações
//   (entrada e saída de cada amostrador); nós (TRS, malha, skin, filhos, extras); skins (juntas, esqueleto);
//   animações (canais, alvo, caminho, interpolação); materiais (fatores, alfa, face dupla, extras, extensões,
//   texturas e amostradores); cenas; texturas e imagens (nome, mime, tamanho e hash dos bytes); extensões do arquivo.
// Uso: node 3d/tools/props/compara_glb.mjs <a.glb> <b.glb> [--json=<saida.json>]
// Primitiva com acessores diferentes: confere se é o MESMO conjunto de triângulos (vértice = todos os atributos) em
// outra ordem ("SÓ ORDEM", não conta como diferença) e mede a distância de Hausdorff dos vértices no mundo, na pose de
// repouso (mm). Sai 0 se tudo igual fora `imagem:*` e `extensoes:*`, que são listadas à parte (a troca de formato é
// esperada) e fora a ordem; sai 1 se qualquer outra coisa mudou.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import draco3d from 'draco3d'
import { MeshoptDecoder } from 'meshoptimizer'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const [arqA, arqB] = args.filter((a) => !a.startsWith('--'))
const saidaJson = args.find((a) => a.startsWith('--json='))?.slice(7)
if (!arqA || !arqB) {
  console.error('uso: node 3d/tools/props/compara_glb.mjs <a.glb> <b.glb> [--json=<saida.json>]')
  process.exit(2)
}

await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'meshopt.decoder': MeshoptDecoder,
})

const nome = (p) => p?.getName() ?? null
const hash = (b) => (b ? createHash('sha256').update(b).digest('hex').slice(0, 16) : null)

/** Acessor decodificado: valores reais (desquantizados pelo `normalized`) + metadados. */
function acessor(a) {
  if (!a) return null
  const n = a.getCount() * a.getElementSize()
  const v = new Float64Array(n)
  const el = new Array(a.getElementSize())
  for (let i = 0; i < a.getCount(); i++) {
    a.getElement(i, el)
    for (let k = 0; k < el.length; k++) v[i * el.length + k] = el[k]
  }
  return { tipo: a.getType(), n: a.getCount(), v }
}

/** JSON cru de cada material (sem decodificar): índices de textura trocados pelo nome da imagem. */
function materiaisJson(caminho) {
  const b = readFileSync(caminho)
  const j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'))
  const nomeTex = (i) =>
    j.images?.[j.textures?.[i]?.source ?? j.textures?.[i]?.extensions?.EXT_texture_webp?.source]?.name
  const troca = (k, v) => (k === 'index' && typeof v === 'number' ? `@${nomeTex(v)}` : v)
  return new Map((j.materials ?? []).map((m) => [m.name, JSON.stringify(m, troca)]))
}

/** Mapa estável chave → valor (string, número ou acessor decodificado) de tudo o que importa no documento. */
function inventario(doc, caminho) {
  const r = doc.getRoot()
  const m = new Map()
  const pos = (k, x) => m.set(k, x)
  for (const me of r.listMeshes()) {
    me.listPrimitives().forEach((p, i) => {
      const k = `malha:${nome(me)}#${i}`
      pos(`${k}.modo`, p.getMode())
      pos(`${k}.material`, nome(p.getMaterial()))
      pos(`${k}.indices`, acessor(p.getIndices()))
      for (const s of p.listSemantics()) pos(`${k}.${s}`, acessor(p.getAttribute(s)))
      p.listTargets().forEach((t, j) => {
        for (const s of t.listSemantics()) pos(`${k}.morfo${j}.${s}`, acessor(t.getAttribute(s)))
      })
    })
    pos(`malha:${nome(me)}.pesos`, JSON.stringify(me.getWeights()))
  }
  for (const n of r.listNodes()) {
    const k = `no:${nome(n)}`
    pos(`${k}.trs`, {
      tipo: 'TRS',
      n: 1,
      v: Float64Array.from([...n.getTranslation(), ...n.getRotation(), ...n.getScale()]),
    })
    pos(`${k}.malha`, nome(n.getMesh()))
    pos(`${k}.skin`, nome(n.getSkin()))
    pos(`${k}.filhos`, n.listChildren().map(nome).join(','))
    pos(`${k}.extras`, JSON.stringify(n.getExtras()))
  }
  for (const s of r.listSkins()) {
    pos(`skin:${nome(s)}.juntas`, s.listJoints().map(nome).join(','))
    pos(`skin:${nome(s)}.esqueleto`, nome(s.getSkeleton()))
    pos(`skin:${nome(s)}.ibm`, acessor(s.getInverseBindMatrices()))
  }
  for (const a of r.listAnimations()) {
    a.listChannels().forEach((c) => {
      const k = `anim:${nome(a)}.${nome(c.getTargetNode())}.${c.getTargetPath()}`
      pos(`${k}.interp`, c.getSampler()?.getInterpolation())
      pos(`${k}.entrada`, acessor(c.getSampler()?.getInput()))
      pos(`${k}.saida`, acessor(c.getSampler()?.getOutput()))
    })
  }
  for (const [n, js] of materiaisJson(caminho)) pos(`material:${n}`, js)
  for (const sc of r.listScenes()) pos(`cena:${nome(sc)}`, sc.listChildren().map(nome).join(','))
  for (const t of r.listTextures()) {
    const img = t.getImage()
    pos(`imagem:${nome(t)}.mime`, t.getMimeType())
    pos(`imagem:${nome(t)}.bytes`, img?.byteLength ?? null)
    pos(`imagem:${nome(t)}.sha256`, hash(img))
  }
  pos(
    'extensoes:usadas',
    r
      .listExtensionsUsed()
      .map((e) => e.extensionName)
      .sort()
      .join(','),
  )
  pos(
    'extensoes:exigidas',
    r
      .listExtensionsRequired()
      .map((e) => e.extensionName)
      .sort()
      .join(','),
  )
  pos('contagem:acessores', r.listAccessors().length)
  return m
}

/** mat4 coluna-maior (glTF) × vec3 ponto. */
const aplica = (m, x, y, z) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
]
function mul(a, b) {
  const o = new Array(16).fill(0)
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]
  return o
}

/** Vértices de cada malha no MUNDO, na pose de repouso (skin linear: Σ peso · mundo(junta) · inversa(junta)). */
function verticesMundo(doc) {
  const out = new Map()
  for (const n of doc.getRoot().listNodes()) {
    const me = n.getMesh()
    if (!me) continue
    const skin = n.getSkin()
    const mats = skin
      ?.listJoints()
      .map((j, i) => mul(j.getWorldMatrix(), skin.getInverseBindMatrices().getElement(i, [])))
    me.listPrimitives().forEach((p, pi) => {
      const pos = p.getAttribute('POSITION')
      const J = p.getAttribute('JOINTS_0')
      const W = p.getAttribute('WEIGHTS_0')
      const v = new Float64Array(pos.getCount() * 3)
      for (let i = 0; i < pos.getCount(); i++) {
        const [x, y, z] = pos.getElement(i, [])
        let m = n.getWorldMatrix()
        if (skin && J && W) {
          const js = J.getElement(i, [])
          const ws = W.getElement(i, [])
          m = new Array(16).fill(0)
          js.forEach((j, k) => mats[j].forEach((e, q) => (m[q] += ws[k] * e)))
        }
        v.set(aplica(m, x, y, z), i * 3)
      }
      out.set(`malha:${nome(me)}#${pi}`, v)
    })
  }
  return out
}

/** Maior distância (m) de um vértice de A ao vértice mais próximo de B e vice-versa (independe da ordem). */
function hausdorff(a, b) {
  const lado = (p, q) => {
    let pior = 0
    for (let i = 0; i < p.length; i += 3) {
      let melhor = Infinity
      for (let j = 0; j < q.length && melhor > 0; j += 3) {
        const d = (p[i] - q[j]) ** 2 + (p[i + 1] - q[j + 1]) ** 2 + (p[i + 2] - q[j + 2]) ** 2
        if (d < melhor) melhor = d
      }
      pior = Math.max(pior, melhor)
    }
    return Math.sqrt(pior)
  }
  return Math.max(lado(a, b), lado(b, a))
}

/** Triângulos como conjunto (vértice = todos os atributos; triângulo girado para começar no menor): ordem não conta. */
function conjuntoTriangulos(p) {
  const accs = p
    .listSemantics()
    .sort()
    .map((s) => p.getAttribute(s))
  const nv = p.getAttribute('POSITION').getCount()
  const chave = []
  for (let i = 0; i < nv; i++)
    chave.push(
      accs
        .map((a) =>
          a
            .getElement(i, [])
            .map((x) => x.toFixed(6))
            .join(','),
        )
        .join(';'),
    )
  const idx = p.getIndices()
  const nt = (idx ? idx.getCount() : nv) / 3
  const tris = []
  for (let t = 0; t < nt; t++) {
    const k = [0, 1, 2].map((c) => chave[idx ? idx.getScalar(t * 3 + c) : t * 3 + c])
    const r = k.indexOf([...k].sort()[0])
    tris.push([k[r], k[(r + 1) % 3], k[(r + 2) % 3]].join('/'))
  }
  return createHash('sha256').update(tris.sort().join('|')).digest('hex')
}

function primitivas(doc) {
  const m = new Map()
  for (const me of doc.getRoot().listMeshes()) me.listPrimitives().forEach((p, i) => m.set(`malha:${nome(me)}#${i}`, p))
  return m
}

function difere(a, b) {
  if (a && typeof a === 'object' && a.v) {
    if (!b?.v || a.tipo !== b.tipo || a.n !== b.n || a.v.length !== b.v.length) return 'forma diferente'
    let max = 0
    for (let i = 0; i < a.v.length; i++) max = Math.max(max, Math.abs(a.v[i] - b.v[i]))
    return max === 0 ? null : `máx |Δ| ${max.toExponential(3)}`
  }
  return JSON.stringify(a) === JSON.stringify(b) ? null : `${JSON.stringify(a)} → ${JSON.stringify(b)}`
}

const [docA, docB] = [await io.read(arqA), await io.read(arqB)]
const [A, B] = [inventario(docA, arqA), inventario(docB, arqB)]
const chaves = [...new Set([...A.keys(), ...B.keys()])]
const diffs = []
for (const k of chaves) {
  if (!A.has(k) || !B.has(k)) diffs.push({ k, d: A.has(k) ? 'só em A' : 'só em B' })
  else {
    const d = difere(A.get(k), B.get(k))
    if (d) diffs.push({ k, d })
  }
}
// Primitiva com acessores diferentes: mesma geometria em outra ordem? E quanto os vértices andaram no mundo?
const [pA, pB] = [primitivas(docA), primitivas(docB)]
const [mA, mB] = [verticesMundo(docA), verticesMundo(docB)]
const geometria = {}
for (const prim of new Set(diffs.filter(({ k }) => k.startsWith('malha:')).map(({ k }) => k.split('.')[0]))) {
  if (!pA.has(prim) || !pB.has(prim)) continue
  const mesmoConjunto = conjuntoTriangulos(pA.get(prim)) === conjuntoTriangulos(pB.get(prim))
  geometria[prim] = { mesmoConjunto, hausdorff_mm: +(1000 * hausdorff(mA.get(prim), mB.get(prim))).toFixed(4) }
  if (mesmoConjunto) for (const d of diffs) if (d.k.startsWith(`${prim}.`)) d.ordem = true
}
const esperada = (k) => k.startsWith('imagem:') || k.startsWith('extensoes:')
const grupos = {}
for (const k of chaves) grupos[k.split(':')[0]] = (grupos[k.split(':')[0]] ?? 0) + 1
console.log(`A ${arqA}\nB ${arqB}`)
console.log(
  `chaves comparadas: ${chaves.length} (${Object.entries(grupos)
    .map(([g, n]) => `${g} ${n}`)
    .join(', ')})`,
)
for (const { k, d, ordem } of diffs)
  console.log(`${esperada(k) ? 'ESPERADA' : ordem ? 'SÓ ORDEM' : 'DIFERENTE'} ${k}: ${d}`)
for (const [prim, g] of Object.entries(geometria))
  console.log(
    `GEOMETRIA ${prim}: ${g.mesmoConjunto ? 'mesmos triângulos (só a ordem muda)' : 'triângulos diferentes'}, ` +
      `Hausdorff no mundo ${g.hausdorff_mm} mm`,
  )
const inesperadas = diffs.filter(({ k, ordem }) => !esperada(k) && !ordem)
console.log(
  inesperadas.length
    ? `RESULTADO: ${inesperadas.length} diferença(s) fora da imagem`
    : 'RESULTADO: igual fora a imagem',
)
if (saidaJson)
  writeFileSync(
    saidaJson,
    JSON.stringify({ a: arqA, b: arqB, chaves: chaves.length, grupos, diffs, geometria }, null, 1),
  )
process.exit(inesperadas.length ? 1 : 0)
