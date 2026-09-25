// Passo final da exportação de um adereço: glb do Blender (cru ou Draco) → glb com EXT_meshopt_compression +
// KHR_mesh_quantization, SEM Draco. Por quê: o drei busca o decodificador Draco em https://www.gstatic.com e a CSP de
// produção (public/_headers: connect-src 'self') bloqueia; o do meshopt já vem no bundle (three-stdlib, ~6,5 kB gzip).
//
// Uso: node 3d/tools/props/otimizar.mjs <entrada.glb> [saida.glb] [--posicao-float] [--malha-em-filho]
//        [--normal=<bits, padrão 10>] [--webp=<imagem>=<arquivo.webp>]   (sem saída: sobrescreve)
//      node 3d/tools/props/otimizar.mjs --cru <entrada.glb> <saida.glb>   (tira o meshopt: o importador glTF do
//      Blender 4.5 não lê EXT_meshopt_compression; comum.importar_glb usa este modo sozinho)
//
// O que faz: reordena índices e vértices para o meshopt (reorder), quantiza normal (10 bits), UV (12, todas as
// camadas: TEXCOORD_1 dos cartões incluso), cor e pesos, e a posição (16 bits num volume ÚNICO da cena: o mesmo
// desquantizador para todas as malhas), comprime geometria e animação com meshopt (filtros) e tira o Draco.
// Posição quantizada vira inteiro normalizado + escala/translação no NÓ da malha (ou nas matrizes inversas do skin);
// quem usa `nodes.X.geometry` fora do nó (Calculadora, Ledger) precisa de `--posicao-float`: a posição fica float32.
// O que NÃO faz: prune, dedup, weld, simplify. Skins, ossos, clipes, nós (e nomes), materiais e bytes das imagens saem
// como entraram. O quantize do gltf-transform clona o skin por malha para corrigir as matrizes inversas; com volume
// único as cópias de um mesmo rig são idênticas e voltam a ser UM skin, com o nome original. Por fim, o script relê a
// saída e compara o inventário (nós, malhas, skins e juntas, clipes e canais, materiais, atributos, vértices, imagens,
// morfos); se algo mudou, não grava e sai com código 1. (`gltf-transform meshopt` do CLI, com opções padrão, trocou as
// 7 skins do empreendedor por 13 cópias.) Depois: `node 3d/tools/props/glb.mjs <saida>` para ler o JSON.
// --malha-em-filho (busto S13): a desquantização iria para o TRS do nó da malha (o quantize compõe escala e translação
//   na matriz local). O site gira Olho_D/Olho_E pelo quaternion: o pivô sairia do centro do olho. Com a opção, a malha
//   de CADA nó passa, antes da quantização, a um filho novo `<nó>_malha` (TRS identidade, depois só a desquantização);
//   o nó original fica com nome, TRS, filhos e extras intactos. O inventário aceita só esses filhos novos.
// --webp=<imagem>=<arquivo> (repetível): troca os bytes da imagem de nome <imagem> pelos do arquivo WebP, como estão
//   (sem reencodar aqui), com EXT_texture_webp exigida. O inventário aceita só essa troca (mime e tamanho).
import { NodeIO } from '@gltf-transform/core'
import {
  ALL_EXTENSIONS,
  EXTMeshoptCompression,
  EXTTextureWebP,
  KHRDracoMeshCompression,
} from '@gltf-transform/extensions'
import { quantize, reorder } from '@gltf-transform/functions'
import draco3d from 'draco3d'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const args = process.argv.slice(2)
const posicaoFloat = args.includes('--posicao-float')
const cru = args.includes('--cru')
const malhaEmFilho = args.includes('--malha-em-filho')
const bitsNormal = Number(args.find((a) => a.startsWith('--normal='))?.slice(9) ?? 10)
const webp = args.filter((a) => a.startsWith('--webp=')).map((a) => a.slice(7).split('='))
const [entrada, saida = entrada] = args.filter((a) => !a.startsWith('--'))
if (!entrada) {
  console.error('uso: node 3d/tools/props/otimizar.mjs <entrada.glb> [saida.glb] [--posicao-float]')
  process.exit(2)
}

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready])
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
})

/** Tudo o que não pode mudar: nomes e contagens da hierarquia, rig, animação, materiais, UVs e bytes das imagens. */
function inventario(doc) {
  const r = doc.getRoot()
  const prims = r.listMeshes().flatMap((m) => m.listPrimitives().map((p) => ({ m, p })))
  return {
    nos: r
      .listNodes()
      .map((n) => `${n.getName()}>${n.getSkin()?.getName() ?? ''}`)
      .sort(),
    malhas: r.listMeshes().map((m) => `${m.getName()}:${m.listPrimitives().length}`),
    skins: r.listSkins().map((s) => `${s.getName()}:${s.listJoints().map((j) => j.getName())}`),
    clipes: r.listAnimations().map((a) => `${a.getName()}:${a.listChannels().length}`),
    canais: r
      .listAnimations()
      .flatMap((a) => a.listChannels().map((c) => `${c.getTargetNode()?.getName()}.${c.getTargetPath()}`)),
    materiais: r.listMaterials().map((m) => m.getName()),
    atributos: prims.map(({ m, p }) => `${m.getName()}:${p.listSemantics().sort()}:${p.getMaterial()?.getName()}`),
    vertices: prims.map(({ p }) => p.getAttribute('POSITION')?.getCount() ?? 0),
    imagens: r.listTextures().map((t) => `${t.getName()}:${t.getMimeType()}:${t.getImage()?.byteLength}`),
    morfos: prims.map(({ p }) => p.listTargets().length),
  }
}

/** Devolve a cada nó o skin original, com as matrizes inversas já corrigidas pelo quantize (cópias idênticas). */
function reunirSkins(doc, original) {
  const copias = new Set()
  const corrigida = new Map()
  for (const [no, skin] of original) {
    const copia = no.getSkin()
    if (copia === skin) continue
    const ibm = copia.getInverseBindMatrices()
    const antes = corrigida.get(skin)
    if (antes) {
      const a = antes.getArray()
      const b = ibm.getArray()
      if (a.length !== b.length || a.some((v, i) => Math.abs(v - b[i]) > 1e-6)) {
        throw new Error(`skin ${skin.getName()}: cópias com matrizes inversas diferentes (volume não é único?)`)
      }
    } else {
      corrigida.set(skin, ibm)
      skin.setInverseBindMatrices(ibm)
    }
    no.setSkin(skin)
    copias.add(copia)
  }
  for (const c of copias) c.dispose()
}

const kb = (b) => (b / 1024).toFixed(1)
const medir = (bytes) => `${kb(bytes.byteLength)} kB (gzip ${kb(gzipSync(bytes, { level: 9 }).byteLength)})`

const bytesEntrada = readFileSync(entrada)
const doc = await io.readBinary(bytesEntrada)
const root = doc.getRoot()
if (cru) {
  for (const ext of root.listExtensionsUsed()) {
    if (ext.extensionName === EXTMeshoptCompression.EXTENSION_NAME) ext.dispose()
  }
  writeFileSync(saida, await io.writeBinary(doc))
  console.log(`${entrada} → ${saida} (sem meshopt, para o Blender)`)
  process.exit(0)
}
const antes = inventario(doc)
if (malhaEmFilho) {
  for (const no of root.listNodes().filter((n) => n.getMesh())) {
    const filho = doc.createNode(`${no.getName()}_malha`).setMesh(no.getMesh()).setWeights(no.getWeights())
    no.setMesh(null).setWeights([]).addChild(filho)
    antes.nos.push(`${filho.getName()}>`)
  }
  antes.nos.sort()
}
for (const [nomeImg, arq] of webp) {
  const tex = root.listTextures().find((t) => t.getName() === nomeImg)
  if (!tex) throw new Error(`--webp: imagem ${nomeImg} não existe`)
  const bytes = new Uint8Array(readFileSync(arq))
  tex.setImage(bytes).setMimeType('image/webp')
  antes.imagens = antes.imagens.map((i) => (i.startsWith(`${nomeImg}:`) ? `${nomeImg}:image/webp:${bytes.byteLength}` : i))
}
if (webp.length) doc.createExtension(EXTTextureWebP).setRequired(true)
const skinOriginal = new Map(root.listNodes().flatMap((n) => (n.getSkin() ? [[n, n.getSkin()]] : [])))

await doc.transform(
  reorder({ encoder: MeshoptEncoder, target: 'size', cleanup: false }),
  quantize({
    pattern: posicaoFloat ? /^(?!POSITION$)/ : /.*/,
    quantizationVolume: 'scene',
    quantizePosition: 16,
    quantizeNormal: bitsNormal,
    quantizeTexcoord: 12,
    cleanup: false,
  }),
)
reunirSkins(doc, skinOriginal)
// Sem prune: só os acessores que o reorder/quantize substituíram (ninguém além da raiz os referencia).
for (const a of root.listAccessors()) if (a.listParents().length === 1) a.dispose()
for (const ext of root.listExtensionsUsed()) {
  if (ext.extensionName === KHRDracoMeshCompression.EXTENSION_NAME) ext.dispose()
}
doc
  .createExtension(EXTMeshoptCompression)
  .setRequired(true)
  .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER })

const bytesSaida = await io.writeBinary(doc)
// Relê o que será gravado (decodificando o meshopt) e compara com a entrada.
const relido = await io.readBinary(bytesSaida)
const depois = inventario(relido)
const diferencas = Object.keys(antes).filter((k) => JSON.stringify(antes[k]) !== JSON.stringify(depois[k]))
if (diferencas.length) {
  for (const k of diferencas) console.error(`MUDOU ${k}:\n  antes  ${antes[k]}\n  depois ${depois[k]}`)
  console.error('nada gravado')
  process.exit(1)
}
writeFileSync(saida, bytesSaida)
const usadas = relido
  .getRoot()
  .listExtensionsUsed()
  .map((e) => e.extensionName)
console.log(`${entrada}: ${medir(bytesEntrada)} → ${saida}: ${medir(bytesSaida)}`)
console.log(
  `preservados: ${antes.nos.length} nós, ${antes.skins.length} skins, ${antes.clipes.length} clipes / ` +
    `${antes.canais.length} canais, ${antes.materiais.length} materiais, ${antes.imagens.length} imagens; ` +
    `posição ${posicaoFloat ? 'float32' : 'quantizada'}; extensões: ${usadas.join(', ')}`,
)
