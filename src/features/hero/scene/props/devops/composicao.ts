/**
 * Composição da vida devops por formato de tela (FICHA-PRODUCAO.md, FECHAMENTO, "Composição"; medida com
 * 3d/tools/props/volta_prop.mjs devops e colisao_orq.mjs devops, LOG da v1, seção TD).
 * - Prancheta: grupo da mesa (../ancora.ts) em volta da origem de `arq_prancheta` (centro da borda de cima da folha).
 *   O LOG do modelador pedia escala 0,8 e +3 mm em Y; medido no site, a 0,8 a prancheta cobre o "Contact me" (borda
 *   direita da mesa na faixa do botão: 1392 px no 1440, limite 1241; 989 no 1024, limite 825). E nas poses (olhar para
 *   baixo) o lábio desce ~57 px no 1440 (~13 no 360): a borda de cima tem de ficar mais baixa, e a régua ≥ 16 px da
 *   borda de baixo. Por isso: 1440, 0,615, −3,5 cm em X e −1,7 mm em Y; 1024, 0,58, −5,5 cm e −11 mm; no retrato,
 *   a 0,8 a mesa (madeira clara) passa sob o título com contraste 1,1–2,2:1 (medido): 0,3 e +5 mm cabe entre o
 *   lábio (≥ 4 px em todas as poses) e o "Today I am a" (≥ 16 px).
 * - Fundo: o diagrama nas ZONAS livres em volta da cabeça (zonas.ts), nunca atrás dela, da prancheta ou da UI.
 */
import type { Grupo } from '../ancora'

export type Formato = 'largo' | 'medio' | 'estreito'

/** Retrato (largura < altura), paisagem estreita (< 1200 px CSS, o 1024×768) e larga (o 1440×900). */
export function formato(w: number, h: number): Formato {
  if (w < h) return 'estreito'
  return w < 1200 ? 'medio' : 'largo'
}

export const GRUPO_MESA: Record<Formato, Grupo> = {
  largo: { escala: 0.615, desloc: [-0.035, -0.0017, 0] },
  medio: { escala: 0.58, desloc: [-0.055, -0.011, 0] },
  estreito: { escala: 0.3, desloc: [0, 0.005, 0] },
}
