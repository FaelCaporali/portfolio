// Leitura do JSON de um glb (sem decodificar a geometria): malhas, primitivas, materiais, extensões, texturas,
// animações, triângulos e bytes. Base do portão de orçamento (ESTUDIO §5).
// Uso: node 3d/tools/props/glb.mjs <arquivo.glb> [--json]
import { readFileSync, statSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const MODOS_TRIANGULO = new Set([undefined, 4])

export function lerGlb(caminho) {
  const buf = readFileSync(caminho)
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${caminho}: não é glb`)
  const len = buf.readUInt32LE(12)
  const j = JSON.parse(buf.subarray(20, 20 + len).toString('utf8'))
  const acc = (i) => (i === undefined ? undefined : j.accessors?.[i])
  const primitivas = []
  for (const [mi, m] of (j.meshes ?? []).entries()) {
    for (const p of m.primitives) {
      const pos = acc(p.attributes.POSITION)
      const idx = acc(p.indices)
      const n = idx ? idx.count : (pos?.count ?? 0)
      primitivas.push({
        malha: m.name ?? `malha${mi}`,
        material: p.material === undefined ? null : (j.materials?.[p.material]?.name ?? `mat${p.material}`),
        triangulos: MODOS_TRIANGULO.has(p.mode) ? Math.round(n / 3) : 0,
        vertices: pos?.count ?? 0,
        atributos: Object.keys(p.attributes),
        extensoes: Object.keys(p.extensions ?? {}),
        morphs: p.targets?.length ?? 0,
      })
    }
  }
  // Cada nó com malha vira uma chamada de desenho por primitiva.
  const instancias = (j.nodes ?? []).filter((n) => n.mesh !== undefined)
  const chamadas = instancias.reduce((s, n) => s + j.meshes[n.mesh].primitives.length, 0)
  const triangulos = instancias.reduce(
    (s, n) =>
      s +
      primitivas
        .filter((p) => p.malha === (j.meshes[n.mesh].name ?? `malha${n.mesh}`))
        .reduce((a, p) => a + p.triangulos, 0),
    0,
  )
  const imagens = (j.images ?? []).map((im, i) => {
    const bv = im.bufferView === undefined ? null : j.bufferViews[im.bufferView]
    let lado = null
    if (bv && im.mimeType === 'image/png') {
      const o = 20 + len + 8 + (bv.byteOffset ?? 0)
      lado = [buf.readUInt32BE(o + 16), buf.readUInt32BE(o + 20)]
    } else if (bv && im.mimeType === 'image/jpeg')
      lado = jpegLado(buf, 20 + len + 8 + (bv.byteOffset ?? 0), bv.byteLength)
    return { nome: im.name ?? `img${i}`, mime: im.mimeType ?? im.uri, bytes: bv?.byteLength ?? null, lado }
  })
  return {
    arquivo: caminho,
    bytes: statSync(caminho).size,
    gerador: j.asset?.generator,
    extensoesUsadas: j.extensionsUsed ?? [],
    extensoesExigidas: j.extensionsRequired ?? [],
    nos: (j.nodes ?? []).map((n) => n.name ?? '?'),
    malhas: (j.meshes ?? []).length,
    primitivas,
    chamadas,
    triangulos,
    materiais: (j.materials ?? []).map((m) => ({
      nome: m.name,
      pbr: m.pbrMetallicRoughness ?? {},
      extensoes: Object.keys(m.extensions ?? {}),
      alfa: m.alphaMode ?? 'OPAQUE',
      duplaFace: !!m.doubleSided,
    })),
    texturas: (j.textures ?? []).length,
    imagens,
    animacoes: (j.animations ?? []).map((a) => ({ nome: a.name, canais: a.channels.length })),
    cameras: (j.cameras ?? []).length,
    luzes: j.extensions?.KHR_lights_punctual?.lights?.length ?? 0,
  }
}

/** Largura × altura de um JPEG (marcador SOF). */
function jpegLado(buf, ini, tam) {
  let o = ini + 2
  while (o < ini + tam) {
    if (buf[o] !== 0xff) return null
    const m = buf[o + 1]
    const l = buf.readUInt16BE(o + 2)
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
      return [buf.readUInt16BE(o + 7), buf.readUInt16BE(o + 5)]
    o += 2 + l
  }
  return null
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , arq, flag] = process.argv
  const g = lerGlb(arq)
  if (flag === '--json') console.log(JSON.stringify(g, null, 2))
  else {
    console.log(`${g.arquivo}: ${(g.bytes / 1024).toFixed(1)} kB, ${g.chamadas} chamadas, ${g.triangulos} triângulos`)
    console.log(
      `extensões usadas: ${g.extensoesUsadas.join(', ') || '(nenhuma)'}; exigidas: ${g.extensoesExigidas.join(', ') || '(nenhuma)'}`,
    )
    for (const p of g.primitivas)
      console.log(
        `  ${p.malha} [${p.material}] ${p.triangulos} tri, ${p.vertices} vért, ${p.atributos.join('/')}${p.extensoes.length ? ` ext:${p.extensoes}` : ''}${p.morphs ? ` morphs:${p.morphs}` : ''}`,
      )
    for (const m of g.materiais)
      console.log(`  material ${m.nome} ${m.alfa}${m.extensoes.length ? ` ext:${m.extensoes}` : ''}`)
    for (const i of g.imagens)
      console.log(`  imagem ${i.nome} ${i.mime} ${i.bytes ?? '?'} B ${i.lado?.join('×') ?? ''}`)
    console.log(
      `texturas ${g.texturas}; animações ${g.animacoes.map((a) => a.nome).join(', ') || '(nenhuma)'}; câmeras ${g.cameras}; luzes ${g.luzes}`,
    )
  }
}
