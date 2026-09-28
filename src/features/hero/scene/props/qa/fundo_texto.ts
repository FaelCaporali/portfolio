/**
 * Textos do fundo da vida qa (REQUISITOS Q20–Q25; FICHA-PRODUCAO ADENDO v2.1): à esquerda o BUG REPORT completo, como
 * numa ferramenta de chamado (ID, severidade, título, tipo, componente, ambiente, prioridade, esforço, passos para
 * reprodução numerados, Expected / Actual); à direita o CASO DE TESTE derivado em Gherkin (realce e logo do Cucumber)
 * e a execução do Cypress (passos verdes com check, logo do Cypress). Em inglês, VERDADEIRO e deste projeto, nunca
 * fato de carreira: na volta 1 do Uber Driver, as mãos do adereço cobriam o botão "Contact me" no 1440×900 do Chromium
 * (1,4 a 5,2 mil px; .wai/3d/props/uber/v1/LOG.md), e a regra que o pegou é a do portão do estúdio
 * (3d/tools/props/volta_prop.mjs): nenhum pixel de adereço a menos de 16 px da interface. Prioridade e esforço são a
 * triagem do defeito (estimativas), não fatos.
 * Cada linha lógica pertence a um bloco que surge na narrativa (roteiro.ts). O report tem uma versão por formato de
 * tela, escrita para caber na grade sem quebrar (1440: 32 colunas × 13 linhas; 1024: 37 × 8; 360: 15 × 4); o caso de
 * teste é quebrado na largura da coluna, com recuo de continuação. Paleta do VS Code Dark+ (a da chuva do FullStack).
 */
import { CORES } from '../fullstack/sintaxe'
import type { Formato } from './composicao'
import { CUCUMBER, CYPRESS } from './logos'

/** Bloco da narrativa: report A (cabeçalho e triagem), report B (reprodução), cenário, Cypress. */
export type Bloco = 'a' | 'b' | 'g' | 'c'
export type Logo = 'cucumber' | 'cypress'
type Trecho = readonly [string, string]

interface Logica {
  bloco: Bloco
  recuo: number
  trechos: readonly Trecho[]
  logo?: Logo
  /** Passo do cenário: fica verde com check quando o Cypress passa por ele. */
  passo?: boolean
}

export const COR = {
  ...CORES,
  severidade: '#f0506a',
  verde: '#69D3A7',
  rotulo: '#9CDCFE',
  meta: '#a0a6b0',
  id: '#DCDCAA',
} as const

const L = (bloco: Bloco, recuo: number, trechos: readonly Trecho[], extra: Partial<Logica> = {}): Logica => ({
  bloco,
  recuo,
  trechos,
  ...extra,
})
const campo = (bloco: Bloco, rotulo: string, valor: string, cor: string = COR.pontuacao) =>
  L(bloco, 0, [
    [rotulo, COR.rotulo],
    [valor, cor],
  ])

const CABECALHO = L('a', 0, [
  ['BUG-UBER-01', COR.id],
  ['  ● Major', COR.severidade],
])
const TITULO = L('a', 0, [['Uber hands cover "Contact me"', COR.texto]])
const ACTUAL = L('b', 0, [
  ['Actual: ', COR.severidade],
  ['5.2k px', COR.numero],
  [' over the button', COR.pontuacao],
])
const EXPECTED = L('b', 0, [
  ['Expected: ', COR.rotulo],
  ['props ', COR.pontuacao],
  ['16px', COR.numero],
  [' off the UI', COR.pontuacao],
])

const REPORT: Record<Formato, readonly Logica[]> = {
  largo: [
    CABECALHO,
    TITULO,
    campo('a', 'Type: ', 'UI overlap'),
    campo('a', 'Component: ', 'hero / props'),
    campo('a', 'Env: ', '1440x900 · Chromium', COR.numero),
    L('a', 0, [
      ['Priority: ', COR.rotulo],
      ['High', COR.severidade],
      ['  Effort: ', COR.rotulo],
      ['S', COR.numero],
    ]),
    L('b', 0, [['Steps to reproduce:', COR.rotulo]]),
    L('b', 1, [
      ['1. Open / at ', COR.pontuacao],
      ['1440x900', COR.numero],
    ]),
    L('b', 1, [['2. Let the carousel reach', COR.pontuacao]]),
    L('b', 4, [['the Uber Driver life', COR.pontuacao]]),
    L('b', 1, [['3. Watch the hands on the wheel', COR.pontuacao]]),
    EXPECTED,
    ACTUAL,
  ],
  medio: [
    L('a', 0, [
      ['BUG-UBER-01', COR.id],
      [' ● Major', COR.severidade],
      [' · High · Effort S', COR.meta],
    ]),
    TITULO,
    L('a', 0, [
      ['UI overlap · hero/props · ', COR.meta],
      ['1440x900', COR.numero],
    ]),
    L('b', 0, [
      ['Steps: ', COR.rotulo],
      ['1. Open / at ', COR.pontuacao],
      ['1440x900', COR.numero],
    ]),
    L('b', 1, [['2. Wait for the Uber Driver life', COR.pontuacao]]),
    L('b', 1, [['3. Watch the hands on the wheel', COR.pontuacao]]),
    EXPECTED,
    ACTUAL,
  ],
  estreito: [
    L('a', 0, [
      ['BUG', COR.id],
      [' ● Major', COR.severidade],
    ]),
    L('a', 0, [['Hands cover', COR.texto]]),
    L('a', 0, [['"Contact me"', COR.texto]]),
    L('b', 0, [
      ['High', COR.severidade],
      [' · Effort S', COR.meta],
    ]),
  ],
}

const TESTE: readonly Logica[] = [
  L('g', 0, [['props.feature', COR.meta]], { logo: 'cucumber' }),
  L('g', 0, [
    ['Feature: ', COR.controle],
    ['Hero props', COR.pontuacao],
  ]),
  L('g', 1, [
    ['Scenario: ', COR.controle],
    ['Props keep off the UI', COR.pontuacao],
  ]),
  L(
    'g',
    2,
    [
      ['Given ', COR.controle],
      ['the hero at ', COR.pontuacao],
      ['1440x900', COR.numero],
    ],
    { passo: true },
  ),
  L(
    'g',
    2,
    [
      ['When ', COR.controle],
      ['the Uber Driver life plays', COR.pontuacao],
    ],
    { passo: true },
  ),
  L(
    'g',
    2,
    [
      ['Then ', COR.controle],
      ['no prop is within ', COR.pontuacao],
      ['16px', COR.numero],
      [' of ', COR.pontuacao],
      ['"Contact me"', COR.texto],
    ],
    { passo: true },
  ),
  L('c', 0, [['cypress run', COR.meta]], { logo: 'cypress' }),
  L('c', 2, [['1 passing', COR.verde]]),
]

const TESTE_CURTO: readonly Logica[] = [
  L('g', 0, [['Scenario', COR.controle]], { logo: 'cucumber' }),
  L(
    'g',
    1,
    [
      ['Given ', COR.controle],
      ['1440', COR.numero],
    ],
    { passo: true },
  ),
  L(
    'g',
    1,
    [
      ['When ', COR.controle],
      ['Uber', COR.pontuacao],
    ],
    { passo: true },
  ),
  L(
    'g',
    1,
    [
      ['Then ', COR.controle],
      ['16px', COR.numero],
    ],
    { passo: true },
  ),
  L('c', 0, [['passing', COR.verde]], { logo: 'cypress' }),
]

/** Uma célula da grade: caractere e cor. */
interface Celula {
  ch: string
  cor: string
}

/** Linha física (depois da quebra): células, logo nas 2 primeiras colunas, bloco e se é passo. */
export interface Linha {
  celulas: Celula[]
  logo: Logo | null
  bloco: Bloco
  passo: boolean
  /** Continuação de uma linha lógica quebrada. */
  continua: boolean
}

const espacos = (n: number): Celula[] => Array.from({ length: n }, () => ({ ch: ' ', cor: COR.pontuacao }))

/** Onde cortar `resto` para caber em `cabe` colunas: no último espaço, se não encurtar demais a linha. */
function corte(resto: readonly Celula[], cabe: number) {
  if (resto.length <= cabe) return resto.length
  const espaco = resto
    .slice(0, cabe + 1)
    .map((c) => c.ch)
    .lastIndexOf(' ')
  return espaco > cabe * 0.4 ? espaco : cabe
}

/** Quebra uma linha lógica em `cols` colunas, com recuo de continuação. */
function quebrarUma(l: Logica, cols: number): Linha[] {
  const out: Linha[] = []
  // Texto só ASCII e símbolos simples (●, ·): um caractere por célula.
  let resto: Celula[] = l.trechos.flatMap(([t, cor]) => Array.from(t, (ch) => ({ ch, cor })))
  while (resto.length > 0) {
    const primeira = out.length === 0
    const logo = l.logo ? 3 : 0
    const recuo = primeira ? l.recuo + logo : l.recuo + 2
    const k = corte(resto, Math.max(1, cols - recuo))
    out.push({
      celulas: [...espacos(recuo), ...resto.slice(0, k)],
      logo: primeira ? (l.logo ?? null) : null,
      bloco: l.bloco,
      passo: l.passo === true,
      continua: !primeira,
    })
    resto = resto.slice(k)
    if (resto[0]?.ch === ' ') resto = resto.slice(1)
  }
  return out
}

export type Painel = 'report' | 'teste'

/** Linhas do painel para a grade (colunas, linhas) e o formato de tela (no máximo `linhas`). */
export function linhasDoPainel(p: Painel, cols: number, linhas: number, f: Formato) {
  let fonte = REPORT[f]
  if (p === 'teste') fonte = f === 'estreito' ? TESTE_CURTO : TESTE
  return fonte.flatMap((l) => quebrarUma(l, cols)).slice(0, linhas)
}

export const LOGOS: Record<Logo, { d: string; cor: string }> = { cucumber: CUCUMBER, cypress: CYPRESS }
