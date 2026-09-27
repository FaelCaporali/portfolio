// Medidas da vida qa para volta_prop.mjs (FICHA-PRODUCAO.md do qa, métricas de aceite): maior lado na tela (px CSS) do
// bug sem a oclusão da cabeça (em voo ele passa por trás dela de propósito), do bug visível (preso sob a lente) e da
// lente. `medirQa` roda dentro do navegador (page.evaluate); `julgarTamanhos` roda no Node.

/** pecas: os padrões da vida em VIDAS (bug, lente). Máscaras do gancho de desenvolvimento (medidas.ts). */
export function medirQa(pecas) {
  const H = window.__heroDebug
  const M = H.medidas
  const k = H.camera().dpr
  const maior = (m) => {
    let [x0, y0, x1, y1] = [Infinity, Infinity, -1, -1]
    for (let i = 0; i < m.data.length; i++) {
      if (!m.data[i]) continue
      const x = i % m.w
      const y = (i - x) / m.w
      ;[x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)]
    }
    return x1 < 0 ? 0 : +(Math.max(x1 - x0 + 1, y1 - y0 + 1) / k).toFixed(1)
  }
  const bug = maior(M.mascara([[pecas.bug, 'preto'], ['^prop$', 'oculto'], ['^bust$', 'oculto']]))
  const bugVisivel = maior(M.mascara([[pecas.bug, 'preto'], ['^prop$', 'oculto']]))
  const lente = maior(M.mascara([[pecas.lente, 'preto'], ['^prop$', 'oculto']]))
  return { bug, bugVisivel, lente }
}

/**
 * Falhas de tamanho no instante t (s desde a montagem; NaN nas poses, que não julgam fase): bug em voo (sem oclusão)
 * entre `fases.vooDe` e `fases.vooAte`; bug preso (visível) e lente entre `fases.presoDe` e `fases.presoAte`.
 */
export function julgarTamanhos(tam, min, fases, t) {
  if (!min || !fases || !Number.isFinite(t)) return []
  const f = []
  const em = (a, b) => t >= a && t <= b
  if (em(fases.vooDe, fases.vooAte) && tam.bug < min.bugVoo) f.push(`bug em voo com ${tam.bug} px (< ${min.bugVoo})`)
  if (em(fases.presoDe, fases.presoAte)) {
    if (tam.bugVisivel < min.bugPreso) f.push(`bug preso com ${tam.bugVisivel} px (< ${min.bugPreso})`)
    if (tam.lente < min.lente) f.push(`lente com ${tam.lente} px (< ${min.lente})`)
  }
  return f
}
