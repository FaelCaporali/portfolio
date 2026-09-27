/**
 * Zonas LIVRES da tela para o diagrama da vida devops (FICHA-PRODUCAO, FECHAMENTO, "Composição"): em volta da
 * cabeça, nunca atrás dela, da prancheta ou da interface (respiro ≥ 16 px da UI e ≥ 16 px da borda). Tudo em px CSS
 * do canvas, medido no resize (nunca por quadro): a caixa do texto do herói, o indicador de vidas e o balão de
 * contato no DOM; a cabeça e a prancheta projetadas da cena.
 *   largo/médio: TOPO (acima do texto, até a cabeça), ESQ (entre o título e a cabeça), BASE (abaixo do texto, até a
 *   prancheta), DIR (à direita da cabeça) e DIR_BASE (à direita da prancheta, acima do balão);
 *   estreito (retrato): as duas faixas ao lado da cabeça, acima da prancheta.
 * Os PAINÉIS (uma malha cada): topo, esq, direita (dir + dir_base, vizinhas e fora da UI) e base. Nenhum plano cobre a
 * interface, nem transparente (os portões medem a silhueta do plano).
 */
import type { Formato } from './composicao'
import type { Quadro } from './pincel'

export interface Referencias {
  w: number
  h: number
  /** Caixa do texto do herói (título, subtítulo, botões, contatos). */
  ui: Quadro
  /** Fim do cabeçalho e do indicador de vidas (px). */
  topo: number
  balao: Quadro | null
  cabeca: Quadro
  mesa: Quadro
}

export interface Zonas {
  topo: Quadro | null
  esq: Quadro | null
  base: Quadro | null
  dir: Quadro | null
  dirBase: Quadro | null
}

/** Respiro da UI e da borda: 16 px da ficha + 4 px de folga (projeção do plano, arredondamento). */
const RESPIRO = 20
const BORDA = 20
/** Folga da cabeça (cabelo além da projeção) e da prancheta. */
const CABECA = 12
const MESA = 12

const valida = (q: Quadro, minW: number, minH: number): Quadro | null =>
  q.x1 - q.x0 >= minW && q.y1 - q.y0 >= minH ? q : null

export function zonasPara(f: Formato, r: Referencias): Zonas {
  const { w, h, ui, cabeca, mesa } = r
  const y0 = r.topo + RESPIRO
  if (f === 'estreito') {
    const fim = Math.min(mesa.y0 - 8, ui.y0 - RESPIRO)
    return {
      topo: null,
      base: null,
      dirBase: null,
      esq: valida({ x0: BORDA, y0, x1: cabeca.x0 - 6, y1: fim }, 50, 100),
      dir: valida({ x0: cabeca.x1 + 6, y0, x1: w - BORDA, y1: fim }, 50, 100),
    }
  }
  const baixo = r.balao ? r.balao.y0 - RESPIRO : h - BORDA
  return {
    topo: valida({ x0: BORDA, y0, x1: cabeca.x0 - CABECA, y1: ui.y0 - RESPIRO }, 200, 70),
    esq: valida({ x0: ui.x1 + RESPIRO, y0: ui.y0 - RESPIRO, x1: cabeca.x0 - CABECA, y1: mesa.y0 - MESA }, 90, 120),
    base: valida({ x0: BORDA, y0: ui.y1 + RESPIRO, x1: mesa.x0 - RESPIRO, y1: h - BORDA }, 200, 90),
    dir: valida({ x0: cabeca.x1 + CABECA, y0, x1: w - BORDA, y1: mesa.y0 - MESA }, 100, 150),
    dirBase: valida({ x0: mesa.x1 + MESA, y0: mesa.y0 - MESA, x1: w - BORDA, y1: baixo }, 100, 100),
  }
}

/** União de retângulos (nulos fora). */
function uniao(qs: (Quadro | null)[]): Quadro | null {
  const v = qs.filter((q): q is Quadro => q !== null)
  if (!v.length) return null
  return {
    x0: Math.min(...v.map((q) => q.x0)),
    y0: Math.min(...v.map((q) => q.y0)),
    x1: Math.max(...v.map((q) => q.x1)),
    y1: Math.max(...v.map((q) => q.y1)),
  }
}

export type Painel = 'topo' | 'esq' | 'direita' | 'base'
export const PAINEIS: readonly Painel[] = ['topo', 'esq', 'direita', 'base']

/** Retângulo de cada painel (a malha cobre as zonas dele; o que fica fora das zonas é transparente). */
export function paineisPara(z: Zonas): Record<Painel, Quadro | null> {
  return {
    topo: z.topo,
    esq: z.esq,
    direita: uniao([z.dir, z.dirBase]),
    base: z.base,
  }
}
