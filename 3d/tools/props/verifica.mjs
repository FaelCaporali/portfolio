// Confere o manifesto de uma etapa: cada artefato existe, foi escrito nesta execução e, se PNG, tem tamanho legível.
// Uso: node 3d/tools/props/verifica.mjs <inicio ISO> <caminho> [caminho...]
// Sai 1 se faltar algo. É o que impede "pronto" declarado sem artefato (E4 da v7, 24/09).
import fs from 'node:fs'

const [inicio, ...caminhos] = process.argv.slice(2)
const t0 = Date.parse(inicio ?? '')
if (Number.isNaN(t0) || caminhos.length === 0) {
  console.error('uso: node verifica.mjs <inicio ISO> <caminho> [caminho...]')
  process.exit(2)
}

function png(arquivo) {
  const b = Buffer.alloc(24)
  const fd = fs.openSync(arquivo, 'r')
  fs.readSync(fd, b, 0, 24, 0)
  fs.closeSync(fd)
  return b.toString('ascii', 1, 4) === 'PNG' ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null
}

const itens = caminhos.map((c) => {
  if (!fs.existsSync(c)) return { c, ok: false, motivo: 'não existe' }
  const st = fs.statSync(c)
  const arquivos = st.isDirectory() ? fs.readdirSync(c).map((f) => `${c}/${f}`) : [c]
  if (arquivos.length === 0) return { c, ok: false, motivo: 'pasta vazia' }
  const novos = arquivos.filter((f) => fs.statSync(f).mtimeMs >= t0)
  if (novos.length === 0) return { c, ok: false, motivo: 'nada escrito nesta execução' }
  const dims = arquivos.filter((f) => f.endsWith('.png')).map(png).filter(Boolean)
  if (dims.some((d) => d.w < 64 || d.h < 64)) return { c, ok: false, motivo: 'PNG menor que 64 px' }
  return { c, ok: true, motivo: `${novos.length}/${arquivos.length} novos` }
})

for (const i of itens) console.log(`${i.ok ? 'OK ' : 'FALTA'} ${i.c} — ${i.motivo}`)
const falhas = itens.filter((i) => !i.ok).length
console.log(falhas ? `REPROVADO: ${falhas} de ${itens.length}` : `APROVADO: ${itens.length} artefatos`)
process.exit(falhas ? 1 : 0)
