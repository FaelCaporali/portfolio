// Retro de uma execução do workflow do estúdio: custo por agente, lido dos transcritos.
// Uso: node 3d/tools/props/retro.mjs <pasta wf_*> [saida.md]
// Métricas por chamada: minutos, voltas, contexto inicial e máximo, Σ entrada (inclui leitura de cache), saída,
// imagens lidas e caracteres de texto devolvido por ferramentas. Alvos do ESTUDIO: contexto inicial ≤ 25 k,
// máximo ≤ 90 k, voltas ≤ maxTurns do agente.
import fs from 'node:fs'
import path from 'node:path'

const [pasta, saida] = process.argv.slice(2)
if (!pasta) {
  console.error('uso: node retro.mjs <pasta wf_*> [saida.md]')
  process.exit(2)
}

const k = (n) => `${Math.round(n / 1000)} k`
const m = (n) => `${(n / 1e6).toFixed(1)} M`

function medir(arquivo) {
  const linhas = fs.readFileSync(arquivo, 'utf8').split('\n').filter(Boolean)
  const r = { voltas: 0, entrada: 0, saida: 0, ctxIni: 0, ctxMax: 0, imagens: 0, textoFerramenta: 0, t0: null, t1: null }
  for (const l of linhas) {
    let d
    try {
      d = JSON.parse(l)
    } catch {
      continue
    }
    if (d.timestamp) {
      r.t0 ??= d.timestamp
      r.t1 = d.timestamp
    }
    const msg = d.message ?? {}
    const u = msg.usage
    if (u && msg.role === 'assistant') {
      const ctx = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)
      r.voltas += 1
      r.entrada += ctx
      r.saida += u.output_tokens ?? 0
      if (!r.ctxIni) r.ctxIni = ctx
      r.ctxMax = Math.max(r.ctxMax, ctx)
    }
    if (msg.role === 'user' && Array.isArray(msg.content)) {
      for (const b of msg.content) {
        if (b.type !== 'tool_result') continue
        const partes = Array.isArray(b.content) ? b.content : [{ type: 'text', text: String(b.content ?? '') }]
        for (const p of partes) {
          if (p.type === 'image') r.imagens += 1
          else r.textoFerramenta += (p.text ?? '').length
        }
      }
    }
  }
  r.min = r.t0 ? Math.round((Date.parse(r.t1) - Date.parse(r.t0)) / 60000) : 0
  return r
}

const agentes = fs
  .readdirSync(pasta)
  .filter((f) => /^agent-.*\.jsonl$/.test(f))
  .map((f) => {
    const metaPath = path.join(pasta, f.replace(/\.jsonl$/, '.meta.json'))
    const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {}
    return { rotulo: meta.description ?? f, tipo: meta.agentType ?? '?', ...medir(path.join(pasta, f)) }
  })
  .sort((a, b) => String(a.t0).localeCompare(String(b.t0)))

const total = agentes.reduce(
  (s, a) => ({ min: s.min + a.min, voltas: s.voltas + a.voltas, entrada: s.entrada + a.entrada, saida: s.saida + a.saida }),
  { min: 0, voltas: 0, entrada: 0, saida: 0 },
)
const alertas = agentes.flatMap((a) => [
  ...(a.ctxIni > 30000 ? [`${a.rotulo}: contexto inicial ${k(a.ctxIni)} (alvo ≤ 25 k)`] : []),
  ...(a.ctxMax > 90000 ? [`${a.rotulo}: contexto máximo ${k(a.ctxMax)} (alvo ≤ 90 k)`] : []),
  ...(a.voltas > 40 ? [`${a.rotulo}: ${a.voltas} voltas numa chamada (alvo ≤ 40)`] : []),
])

const md = [
  `## Retro ${path.basename(pasta)}`,
  '',
  '| chamada | tipo | min | voltas | ctx inicial | ctx máx | Σ entrada | saída | imagens | texto de ferramenta |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...agentes.map(
    (a) =>
      `| ${a.rotulo} | ${a.tipo} | ${a.min} | ${a.voltas} | ${k(a.ctxIni)} | ${k(a.ctxMax)} | ${m(a.entrada)} | ` +
      `${k(a.saida)} | ${a.imagens} | ${k(a.textoFerramenta)} car. |`,
  ),
  `| **total** | | ${total.min} | ${total.voltas} | | | ${m(total.entrada)} | ${k(total.saida)} | | |`,
  '',
  alertas.length ? `Alertas:\n${alertas.map((a) => `- ${a}`).join('\n')}` : 'Sem alertas.',
  '',
].join('\n')

if (saida) fs.appendFileSync(saida, `${md}\n`)
process.stdout.write(md)
