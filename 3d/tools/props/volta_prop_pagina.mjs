// Lado da página de volta_prop.mjs: roda dentro do navegador (page.evaluate), então não usa nada de fora das funções.
// Buffer de desenho em px do dispositivo; o que volta está em px CSS. Máscaras por nome (medidas.ts): a parte do
// adereço abaixo do meio do degradê próprio (withDissolve com `fade`) não conta, porque já se confunde com o fundo.

/**
 * Lábio inferior no espaço do glb, medido na malha do busto COM a expressão da vida (getVertexPosition aplica os
 * morfos): perfil da frente na linha do meio (|x| < 4 mm, maior z por fatia de 1 mm de altura). `labio` = ponto mais
 * saliente do lábio inferior (abaixo da linha da boca); `sulco` = ponto mais fundo entre ele e o queixo; `borda` =
 * meio dos dois, a estimativa da borda de baixo do lábio (o portão usa a borda; o sulco é o conservador).
 */
export function labioInferior() {
  const M = window.__heroDebug.medidas
  const bust = M.objeto('bust')
  const frame = M.objeto('bust').parent
  frame.updateWorldMatrix(true, true)
  const inv = frame.matrixWorld.clone().invert()
  const perfil = new Map()
  const v = new (M.objeto('bust').position.constructor)()
  bust.traverse((o) => {
    if (!o.isMesh || o.name.toLowerCase().includes('eye')) return
    const m = inv.clone().multiply(o.matrixWorld)
    const pos = o.geometry.getAttribute('position')
    for (let i = 0; i < pos.count; i++) {
      o.getVertexPosition(i, v).applyMatrix4(m)
      if (Math.abs(v.x) > 0.004 || v.y < 0.03 || v.y > 0.13) continue
      const k = Math.round(v.y * 1000)
      if (!perfil.has(k) || perfil.get(k) < v.z) perfil.set(k, v.z)
    }
  })
  const ys = [...perfil.keys()].sort((a, b) => a - b)
  const z = (k) => perfil.get(k)
  // Linha da boca: o z mais fundo entre 9 e 11,5 cm; lábio inferior: o mais saliente logo abaixo; sulco: o mais fundo
  // entre o queixo (5 cm) e o lábio.
  const faixa = (a, b) => ys.filter((k) => k >= a && k <= b)
  const minZ = (ks) => ks.reduce((m, k) => (z(k) < z(m) ? k : m), ks[0])
  const maxZ = (ks) => ks.reduce((m, k) => (z(k) > z(m) ? k : m), ks[0])
  const boca = minZ(faixa(90, 115))
  const labio = maxZ(faixa(boca - 25, boca - 2))
  const sulco = minZ(faixa(50, labio - 2))
  const p = (k) => (k == null ? null : [0, k / 1000, +z(k).toFixed(4)])
  const meio = labio != null && sulco != null ? Math.round((labio + sulco) / 2) : null
  return { boca: p(boca), labio: p(labio), borda: p(meio), sulco: p(sulco) }
}

/** Caso ruim conhecido, aplicado na cena (prova de que o portão reprova). */
export function aplicarCaso(caso) {
  const M = window.__heroDebug.medidas
  if (caso === 'aro-na-boca') {
    const o = M.objeto('uber_volante')
    if (o) o.position.y += 0.05
    return { caso, no: o ? 'uber_volante' : null }
  }
  if (caso === 'sobre-texto') {
    const o = M.objeto('uber')
    if (o) o.position.x -= 0.45
    return { caso, no: o ? 'uber' : null }
  }
  return null
}

/**
 * Glifos do título (h1 do herói) no referencial do canvas, com a cor do texto em sRGB 8 bits (a cor computada pode vir
 * em oklch: um canvas 2D a converte), e a caixa do h1. Para a métrica de legibilidade do retrato estreito (ADENDO 6).
 */
export function rectsTitulo() {
  const c = document.querySelector('section[aria-label="Apresentação"] canvas').getBoundingClientRect()
  const h1 = document.querySelector('section[aria-label="Apresentação"] h1')
  if (!h1) return { caixa: null, glifos: [] }
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  const rgb = (cor) => {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = cor
    ctx.fillRect(0, 0, 1, 1)
    return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)]
  }
  const glifos = []
  const walk = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT)
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (!n.textContent.trim() || n.parentElement.closest('.sr-only')) continue
    const cor = rgb(getComputedStyle(n.parentElement).color)
    const range = document.createRange()
    range.selectNodeContents(n)
    for (const r of range.getClientRects()) {
      if (r.width < 2 || r.height < 2) continue
      glifos.push({ nome: `titulo:${glifos.length}`, x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height, cor })
    }
  }
  const b = h1.getBoundingClientRect()
  return { caixa: { x: b.left - c.left, y: b.top - c.top, w: b.width, h: b.height }, glifos }
}

/**
 * Um quadro. cfg: { rects (UI dilatada, px CSS), pecas: {nome: padrão}, rosto: padrão, iris: padrão, aro: padrão,
 * irisRaio (m), lab: {labio, sulco} (glb), olhos: [[x,y,z]...], titulo?: glifos de rectsTitulo, maos?: padrão }.
 */
export function medirQuadroProp(cfg) {
  const H = window.__heroDebug
  const M = H.medidas
  const k = H.camera().dpr
  const masc = (p) => M.mascara([[p, 'preto'], ['^prop$', 'oculto']])
  const caixa = (m) => {
    let [x0, y0, x1, y1, n] = [Infinity, Infinity, -1, -1, 0]
    for (let i = 0; i < m.data.length; i++) {
      if (!m.data[i]) continue
      const x = i % m.w
      const y = (i - x) / m.w
      ;[x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)]
      n++
    }
    return x1 < 0 ? null : { x: x0 / k, y: y0 / k, w: (x1 - x0 + 1) / k, h: (y1 - y0 + 1) / k, px: n / (k * k) }
  }
  const noCirculo = (m, cx, cy, r) => {
    let n = 0
    for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(m.h, Math.ceil(cy + r)); y++)
      for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(m.w, Math.ceil(cx + r)); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) n += m.data[y * m.w + x]
    return Math.round(n / (k * k))
  }
  const emRects = (m) =>
    Object.entries(cfg.rects)
      .map(([nome, r]) => {
        let n = 0
        for (let y = Math.max(0, Math.floor(r.y * k)); y < Math.min(m.h, Math.ceil((r.y + r.h) * k)); y++)
          for (let x = Math.max(0, Math.floor(r.x * k)); x < Math.min(m.w, Math.ceil((r.x + r.w) * k)); x++)
            n += m.data[y * m.w + x]
        return [nome, Math.round(n / (k * k))]
      })
      .filter(([, px]) => px > 0)

  const tudo = masc(cfg.pecas.tudo)
  const partes = Object.fromEntries(Object.entries(cfg.pecas).map(([n, p]) => [n, caixa(n === 'tudo' ? tudo : masc(p))]))
  // Olhos e boca (zonas do gancho, as mesmas dos portões) contra o que não pode cobri-los.
  const zonas = H.masks({}, false).rosto
  const mr = masc(cfg.rosto)
  const rosto = zonas.map((z) => [z.nome, noCirculo(mr, z.centro[0] * k, z.centro[1] * k, z.raio * k)])
  // Íris contra as lágrimas.
  const ml = masc(cfg.iris)
  const iris = cfg.olhos.map((p, i) => {
    const [cx, cy] = M.projetar(p)
    const [ex] = M.projetar([p[0] + cfg.irisRaio, p[1], p[2]])
    return [`iris${i}`, noCirculo(ml, cx, cy, Math.abs(ex - cx))]
  })
  // Respiro do aro ao lábio inferior: topo do aro nas colunas da boca (±2,7 cm) menos a altura do lábio na tela.
  const ma = masc(cfg.aro)
  const respiro = {}
  for (const [nome, p] of Object.entries(cfg.lab)) {
    if (!p) continue
    const [lx, ly] = M.projetar(p)
    const [ex] = M.projetar([p[0] + 0.027, p[1], p[2]])
    const meia = Math.abs(ex - lx)
    let topo = Infinity
    for (let y = 0; y < ma.h && topo === Infinity; y++)
      for (let x = Math.max(0, Math.floor(lx - meia)); x < Math.min(ma.w, Math.ceil(lx + meia)); x++)
        if (ma.data[y * ma.w + x]) {
          topo = y
          break
        }
    respiro[nome] = topo === Infinity ? null : +((topo - ly) / k).toFixed(1)
  }
  // Título (retrato estreito): mão nunca sob glifo; sob o resto da peça, contraste do glifo ≥ 4,5:1 contra o pixel
  // mais claro da peça sob ele (a imagem do canvas não tem o texto do DOM).
  let titulo = null
  if (cfg.titulo?.length) {
    const mm = masc(cfg.maos)
    const img = M.cor()
    const lin = (c) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4)
    const lum = (d, i) => 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2])
    titulo = cfg.titulo
      .map((g) => {
        let [mao, peca, lmax] = [0, 0, 0]
        for (let y = Math.max(0, Math.floor(g.y * k)); y < Math.min(tudo.h, Math.ceil((g.y + g.h) * k)); y++)
          for (let x = Math.max(0, Math.floor(g.x * k)); x < Math.min(tudo.w, Math.ceil((g.x + g.w) * k)); x++) {
            const i = y * tudo.w + x
            mao += mm.data[i]
            if (!tudo.data[i]) continue
            peca++
            lmax = Math.max(lmax, lum(img.data, i * 4))
          }
        const lt = lum(g.cor, 0)
        const contraste = peca ? (Math.max(lt, lmax) + 0.05) / (Math.min(lt, lmax) + 0.05) : null
        return { nome: g.nome, mao: Math.round(mao / (k * k)), peca: Math.round(peca / (k * k)), contraste }
      })
      .filter((g) => g.peca > 0)
      .map((g) => ({ ...g, contraste: +g.contraste.toFixed(2) }))
  }
  return { dpr: k, partes, rosto, iris, respiro, sobreUi: emRects(tudo), titulo }
}

/**
 * Tamanho na tela de cada adesivo (px CSS) de uma malha única com um EMPTY por adesivo (fullstack): ilhas da malha
 * (índices conectados) atribuídas ao empty mais próximo do centro da ilha; caixa dos vértices projetados.
 * cfg: { malha: nome da malha, prefixo: prefixo dos empties (o resto do nome é o rótulo) }.
 */
export function medirAdesivos(cfg) {
  const M = window.__heroDebug.medidas
  const k = window.__heroDebug.camera().dpr
  const malha = M.objeto(cfg.malha)
  if (!malha) return null
  const frame = M.objeto('bust').parent
  frame.updateWorldMatrix(true, true)
  const inv = frame.matrixWorld.clone().invert()
  const V = malha.position.constructor
  const emp = []
  frame.traverse((o) => {
    if (o.name.startsWith(cfg.prefixo) && o !== malha && !o.isMesh) {
      emp.push({ nome: o.name.slice(cfg.prefixo.length), p: new V().setFromMatrixPosition(o.matrixWorld).applyMatrix4(inv) })
    }
  })
  const g = malha.geometry
  const pos = g.getAttribute('position')
  const idx = g.index
  const pai = Array.from({ length: pos.count }, (_, i) => i)
  const raiz = (i) => {
    while (pai[i] !== i) i = pai[i] = pai[pai[i]]
    return i
  }
  if (idx) for (let t = 0; t < idx.count; t += 3) {
    const a = raiz(idx.getX(t))
    pai[raiz(idx.getX(t + 1))] = a
    pai[raiz(idx.getX(t + 2))] = a
  }
  const m = inv.clone().multiply(malha.matrixWorld)
  const ilhas = new Map()
  const v = new V()
  for (let i = 0; i < pos.count; i++) {
    malha.getVertexPosition(i, v).applyMatrix4(m)
    const r = raiz(i)
    if (!ilhas.has(r)) ilhas.set(r, [])
    ilhas.get(r).push([v.x, v.y, v.z])
  }
  const caixas = {}
  for (const pts of ilhas.values()) {
    const c = pts.reduce((s, p) => s.map((x, j) => x + p[j] / pts.length), [0, 0, 0])
    const e = emp.reduce((b, x) => (!b || x.p.distanceTo(new V(...c)) < b.p.distanceTo(new V(...c)) ? x : b), null)
    if (!e) continue
    const b = (caixas[e.nome] ??= [Infinity, Infinity, -Infinity, -Infinity])
    for (const p of pts) {
      const [x, y] = M.projetar(p)
      ;[b[0], b[1], b[2], b[3]] = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)]
    }
  }
  return Object.fromEntries(
    Object.entries(caixas).map(([n, b]) => {
      const [w, h] = [(b[2] - b[0]) / k, (b[3] - b[1]) / k]
      return [n, { maior: +Math.max(w, h).toFixed(1), menor: +Math.min(w, h).toFixed(1) }]
    }),
  )
}

/**
 * Pele sob a luz do adereço: pixels do busto visíveis (o adereço oclui), estourados (algum canal ≥ 250),
 * saturação HSV p99 e luminância média do queixo (abaixo do lábio). Com `cfg.luz` (nome da luz), o mesmo sem ela,
 * no mesmo quadro (a luz volta no quadro seguinte).
 */
export function medirPele(cfg) {
  const H = window.__heroDebug
  const M = H.medidas
  const k = H.camera().dpr
  const pele = M.mascara([['^bust$', 'preto']])
  const [, yl] = cfg.lab.labio ? M.projetar(cfg.lab.labio) : [0, Infinity]
  const medir = () => {
    const img = M.cor()
    const sats = []
    let [n, estouro, lq, nq] = [0, 0, 0, 0]
    for (let i = 0; i < pele.data.length; i++) {
      if (!pele.data[i]) continue
      const [r, g, b] = [img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]]
      const mx = Math.max(r, g, b)
      n++
      if (mx >= 250) estouro++
      sats.push(mx ? (mx - Math.min(r, g, b)) / mx : 0)
      if (Math.floor(i / pele.w) > yl) {
        lq += 0.2126 * r + 0.7152 * g + 0.0722 * b
        nq++
      }
    }
    sats.sort((a, b) => a - b)
    return {
      px: Math.round(n / (k * k)),
      estouro: Math.round(estouro / (k * k)),
      satP99: +(sats[Math.floor(sats.length * 0.99)] ?? 0).toFixed(3),
      lumQueixo: nq ? +(lq / nq).toFixed(1) : null,
    }
  }
  const com = medir()
  const luz = cfg.luz ? M.objeto(cfg.luz) : null
  if (!luz) return com
  const antes = luz.intensity
  luz.intensity = 0
  const sem = medir()
  luz.intensity = antes
  return { ...com, semLuz: sem }
}
