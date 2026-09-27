/**
 * Realce de sintaxe mínimo (TS/TSX) para a chuva de código (F10b): um leitor de caracteres, sem dependência, rodando
 * uma vez na montagem. Paleta VS Code Dark+.
 */
export const CORES = {
  palavra: '#569CD6',
  controle: '#C586C0',
  texto: '#CE9178',
  funcao: '#DCDCAA',
  tipo: '#4EC9B0',
  comentario: '#6A9955',
  numero: '#B5CEA8',
  nome: '#9CDCFE',
  pontuacao: '#D4D4D4',
} as const

export interface Token {
  texto: string
  cor: string
}

const PALAVRAS = new Set(
  (
    'const let var function return new export import from type interface extends typeof keyof as in of true ' +
    'false null undefined this void readonly'
  ).split(' '),
)
const CONTROLE = new Set(
  'if else for while do switch case break continue throw try catch finally await async'.split(' '),
)
const INICIO_NOME = /[A-Za-z_$]/
const NOME = /[\w$]/
const DIGITO = /\d/
const NUMERO = /[\w.]/
const ESPACO = /\s/
const ASPAS = new Set(["'", '"', '`'])

const ate = (l: string, re: RegExp, j: number) => {
  while (j < l.length && re.test(l.charAt(j))) j++
  return j
}

/** Cor de um nome: controle, palavra reservada, tipo (maiúscula), função (seguido de `(`) ou identificador. */
function corDoNome(id: string, resto: string) {
  if (CONTROLE.has(id)) return CORES.controle
  if (PALAVRAS.has(id)) return CORES.palavra
  if (/^[A-Z]/.test(id)) return CORES.tipo
  return resto.trimStart().startsWith('(') ? CORES.funcao : CORES.nome
}

/** Pontuação e operadores: até o começo do próximo token de outro tipo. */
function fimPontuacao(l: string, i: number) {
  let j = i + 1
  while (j < l.length) {
    const c = l.charAt(j)
    if (ASPAS.has(c) || DIGITO.test(c) || ESPACO.test(c) || INICIO_NOME.test(c) || l.startsWith('//', j)) break
    j++
  }
  return j
}

/** Fim (exclusivo) do token que começa em `i`, e a cor dele. */
function lerToken(l: string, i: number): [number, string] {
  const ch = l.charAt(i)
  if (l.startsWith('//', i)) return [l.length, CORES.comentario]
  if (ASPAS.has(ch)) {
    let j = i + 1
    while (j < l.length && l.charAt(j) !== ch) j += l.charAt(j) === '\\' ? 2 : 1
    return [Math.min(j + 1, l.length), CORES.texto]
  }
  if (DIGITO.test(ch)) return [ate(l, NUMERO, i), CORES.numero]
  if (ESPACO.test(ch)) return [ate(l, ESPACO, i), CORES.pontuacao]
  if (INICIO_NOME.test(ch)) {
    const j = ate(l, NOME, i)
    return [j, corDoNome(l.slice(i, j), l.slice(j))]
  }
  return [fimPontuacao(l, i), CORES.pontuacao]
}

/** Tokens coloridos de uma linha (a indentação vira um token de espaços). */
export function colorir(linha: string): Token[] {
  const out: Token[] = []
  for (let i = 0; i < linha.length;) {
    const [j, cor] = lerToken(linha, i)
    out.push({ texto: linha.slice(i, j), cor })
    i = j
  }
  return out
}

/**
 * Corta os tokens em `max` caracteres, no fim do último token inteiro que couber; se isso deixar a linha com menos de
 * 60% da largura (token comprido), corta no meio do token.
 */
export function cortar(tokens: readonly Token[], max: number): Token[] {
  const out: Token[] = []
  let n = 0
  for (const t of tokens) {
    if (n + t.texto.length > max) {
      if (n < max * 0.6) out.push({ texto: t.texto.slice(0, max - n), cor: t.cor })
      break
    }
    out.push(t)
    n += t.texto.length
  }
  return out
}
