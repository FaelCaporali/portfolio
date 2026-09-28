/**
 * Código do harness na IDE da vida ai (FICHA §4.2): realce de sintaxe (tema escuro do GitHub) e a quebra SUAVE de
 * linha longa (como num editor: o texto continua o mesmo, só continua na linha de baixo, recuado). As linhas do diff
 * são as da ficha, na grafia exata.
 */
import { COR } from './estilo'
import type { Pincel } from './pincel'

/** O harness que o agente escreveu: a saída tipada (JSON Schema) e as duas linhas do diff; o 0.6 vira 0.8. */
export const DIFF = {
  reply: '// Reply · JSON Schema: answer, sources, confidence',
  gera: 'const draft = await llm.generate({ system: prompts.v1, context, schema: Reply })',
  /** A linha do guardrail em três partes: antes do limiar, o limiar e depois. */
  guarda: ['if (guardrail.flags(draft) || draft.confidence < ', '0.6', ') return handoff(operator, draft)'],
  editado: '0.8',
} as const

const PALAVRAS = new Set(['const', 'await', 'if', 'return', 'async', 'new'])

/** Cor de um token (palavra-chave, número, string, chamada, operador). */
function corDe(tk: string, prox: string | undefined, base: string) {
  if (PALAVRAS.has(tk)) return COR.kw
  if (/^\d/.test(tk)) return COR.num
  if (/^['"]/.test(tk)) return COR.str
  if (/^[A-Za-z_$]/.test(tk) && prox === '(') return COR.fn
  if (tk === '||' || tk === '<' || tk === '=' || tk === '|') return COR.kw
  return base
}

/** Trechos coloridos de uma linha de TypeScript; comentário inteiro na cor de comentário. */
export function realce(linha: string, base: string = COR.texto): [string, string][] {
  if (linha.trimStart().startsWith('//')) return [[linha, COR.com]]
  const out: [string, string][] = []
  const toks = linha.match(/\s+|[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|\S/g) ?? []
  toks.forEach((tk, i) => {
    const cor = corDe(tk, toks[i + 1], base)
    const ult = out[out.length - 1]
    if (ult?.[1] === cor) ult[0] += tk
    else out.push([tk, cor])
  })
  return out
}

/** Recuo (caracteres) das continuações de uma linha quebrada. */
const RECUO = '    '

/**
 * Quebra suave: divide `linha` em pedaços que cabem em `largura` na fonte (antes de um espaço), sem mudar o texto: os
 * pedaços são trechos da linha original (a continuação começa no espaço da quebra) e se exibem com `exibir`.
 */
export function quebraSuave(p: Pincel, fnt: string, linha: string, largura: number): string[] {
  const partes: string[] = []
  let resto = linha
  let prefixo = ''
  while (resto.length) {
    if (p.medir(fnt, prefixo + resto.trimStart()) <= largura) {
      partes.push(resto)
      break
    }
    let corte = resto.length
    while (corte > 1 && p.medir(fnt, prefixo + resto.slice(0, corte).trimStart()) > largura) {
      corte = resto.lastIndexOf(' ', corte - 1)
    }
    if (corte <= 0) corte = Math.max(1, Math.floor(resto.length / 2))
    partes.push(resto.slice(0, corte))
    resto = resto.slice(corte)
    prefixo = RECUO
  }
  return partes
}

/** O pedaço `i` como aparece no editor (as continuações recuadas). */
export const exibir = (parte: string, i: number) => (i ? RECUO + parte.trimStart() : parte)
