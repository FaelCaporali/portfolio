// Ficha da etapa: tudo o que um agente do estúdio precisa ler, numa chamada só e só a parte dele.
// Uso: node 3d/tools/props/ficha.mjs <vida> <versao> <papel>
// papel: diretor | modelador | lookdev | animador | tecnico | critico | conferente
// Imprime: REQUISITOS (inteiro, sempre), ESTADO da versão, seções da BÍBLIA do papel e os títulos do LOG (para grep).
import fs from 'node:fs'

const [vida, versao, papel] = process.argv.slice(2)
const SECOES = {
  diretor: null,
  modelador: ['0', '2', '3', '4', '9'],
  lookdev: ['0', '5', '8b', '9'],
  animador: ['0', '6', '9'],
  tecnico: ['0', '4', '7', '9'],
  critico: ['0', '1', '9'],
  conferente: ['0'],
}
if (!vida || !versao || !(papel in SECOES)) {
  console.error(`uso: node ficha.mjs <vida> <versao> <${Object.keys(SECOES).join('|')}>`)
  process.exit(2)
}

const base = `.wai/3d/props/${vida}`
const ler = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : null)

function secoes(texto, quais) {
  if (!quais) return texto
  const partes = texto.split(/^(?=## )/m)
  return partes.filter((p) => quais.some((q) => p.startsWith(`## ${q}.`) || p.startsWith(`## ${q} `))).join('\n')
}

const blocos = [
  ['REQUISITOS (acima de tudo; ESTUDIO §0)', ler(`${base}/REQUISITOS.md`) ?? 'AUSENTE: pare e registre em decisoesFael.'],
  ['ESTADO ATUAL da versão', ler(`${base}/${versao}/ESTADO.md`) ?? '(ainda não existe: você o cria ao terminar)'],
]
const producao = ler(`${base}/FICHA-PRODUCAO.md`)
const biblia = producao ? null : ler(`${base}/BIBLIA.md`)
if (producao) blocos.push(['FICHA DE PRODUÇÃO (o brief; executar, não reinterpretar)', producao])
if (biblia) blocos.push([`BÍBLIA (seções do papel ${papel})`, secoes(biblia, SECOES[papel])])
const log = ler(`${base}/${versao}/LOG.md`) ?? ler(`${base}/${versao}/HANDOFF.md`)
if (log) {
  const titulos = log.split('\n').filter((l) => /^#{2,3} /.test(l))
  blocos.push(['LOG da versão (só títulos; leia uma seção com grep -A quando precisar)', titulos.join('\n')])
}

process.stdout.write(blocos.map(([t, c]) => `==================== ${t}\n${c}\n`).join('\n'))
