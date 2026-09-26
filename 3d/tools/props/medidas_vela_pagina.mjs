// Lado da página de medidas_vela.mjs: roda dentro do navegador (page.evaluate), então não usa nada de fora da função.
// Recebe { nomes, caso } e devolve contraste, estouro do boné, queda da testa, caixas por nó e o caso ruim aplicado.
// Buffer de desenho em px do dispositivo; caixas devolvidas em px CSS.
export function medirNaPagina({ nomes, caso }) {
  const H = window.__heroDebug
  const M = H.medidas
  const k = H.camera().dpr
  const prop = M.objeto('prop')
  const re = (p) => new RegExp(p)
  const luma = (d, i) => 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]
  const materiais = (raiz, filtro = () => true) => {
    const s = new Set()
    raiz?.traverse((o) => {
      if (o.isMesh && filtro(o)) [o.material].flat().forEach((m) => s.add(m))
    })
    return [...s]
  }
  const mostrado = (o) => {
    for (let p = o; p; p = p.parent) if (!p.visible) return false
    return true
  }

  // Caso ruim conhecido (prova de que a métrica reprova).
  let aplicado = null
  if (caso === 'lente-opaca') {
    const ms = materiais(prop).filter((m) => re(nomes.lente).test(m.name))
    for (const m of ms) Object.assign(m, { transparent: false, opacity: 1, needsUpdate: true }).color?.set('#050505')
    aplicado = { caso, materiais: ms.length }
  } else if (caso === 'bone-estourado') {
    const ms = materiais(M.objeto('vela_bone'), (o) => !re(nomes.sombra).test(o.name))
    for (const m of ms) {
      m.color?.set('#ffffff')
      m.emissive?.set('#ffffff')
      m.emissiveIntensity = 1.2
    }
    aplicado = { caso, materiais: ms.length }
  } else if (caso === 'sem-sombra') {
    let n = 0
    prop.traverse((o) => {
      if (o.isMesh && re(nomes.sombra).test(o.name)) {
        o.visible = false
        n++
      }
    })
    aplicado = { caso, malhas: n }
  } else if (caso === 'sobre-texto') {
    const b = M.objeto(nomes.barcos[0])
    if (b) b.position.x -= 0.45
    aplicado = { caso, no: b ? nomes.barcos[0] : null }
  } else if (caso === 'chamadas') {
    let base = null
    prop.traverse((o) => {
      if (!base && o.isMesh) base = o
    })
    for (let i = 0; base && i < 12; i++) {
      const c = base.clone()
      c.material = [base.material].flat()[0].clone()
      base.parent.add(c)
    }
    aplicado = { caso, copias: base ? 12 : 0 }
  }

  const com = M.cor([])
  const semOculos = M.cor([nomes.oculos])
  const semBone = M.cor(['^vela_bone'])
  const n = com.w * com.h
  const caixa = (mask) => {
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -1
    let y1 = -1
    let px = 0
    for (let i = 0; i < n; i++) {
      if (!mask.data[i]) continue
      px++
      const x = i % mask.w
      const y = (i - x) / mask.w
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
      y0 = Math.min(y0, y)
      y1 = Math.max(y1, y)
    }
    return { px, box: px ? { x: x0 / k, y: y0 / k, w: (x1 - x0 + 1) / k, h: (y1 - y0 + 1) / k } : null }
  }

  // 1. Contraste íris × esclera pela lente: pixels do olho (sem pálpebra por cima) cobertos pela lente; íris e esclera
  //    separadas por Otsu na imagem SEM óculos; o contraste (média da esclera − média da íris) nos mesmos pixels com e sem.
  const lente = M.mascara([
    ['^Sombra_', 'oculto'],
    [nomes.lente, 'preto'],
  ])
  const contraste = {}
  for (const olho of ['Olho_D', 'Olho_E']) {
    const om = M.mascara([
      ['^Sombra_', 'oculto'],
      ['^prop$', 'oculto'],
      [`^${olho}$`, 'preto'],
    ])
    const idx = []
    let pxOlho = 0
    for (let i = 0; i < n; i++) {
      if (!om.data[i]) continue
      pxOlho++
      if (lente.data[i]) idx.push(i)
    }
    if (idx.length < 12) {
      contraste[olho] = { razao: null, motivo: `lente cobre ${idx.length} px do olho (${pxOlho} px visíveis)` }
      continue
    }
    const hist = new Array(256).fill(0)
    const ls = idx.map((i) => luma(semOculos.data, i))
    for (const l of ls) hist[Math.min(255, Math.round(l))]++
    let soma = 0
    for (let t = 0; t < 256; t++) soma += t * hist[t]
    let sB = 0
    let wB = 0
    let melhor = 0
    let limiar = 0
    for (let t = 0; t < 256; t++) {
      wB += hist[t]
      if (!wB || wB === idx.length) continue
      sB += t * hist[t]
      const mB = sB / wB
      const mF = (soma - sB) / (idx.length - wB)
      const v = wB * (idx.length - wB) * (mB - mF) ** 2
      if (v > melhor) [melhor, limiar] = [v, t]
    }
    const media = (img, lado) => {
      let s = 0
      let c = 0
      idx.forEach((i, j) => {
        if (ls[j] <= limiar === lado) {
          s += luma(img.data, i)
          c++
        }
      })
      return c ? s / c : NaN
    }
    const sem = media(semOculos, false) - media(semOculos, true)
    const comL = media(com, false) - media(com, true)
    contraste[olho] = {
      razao: sem > 4 ? comL / sem : null,
      motivo: sem > 4 ? undefined : 'olho sem contraste nem sem óculos',
      contrasteSem: Math.round(sem * 10) / 10,
      contrasteCom: Math.round(comL * 10) / 10,
      irisSem: Math.round(media(semOculos, true)),
      irisCom: Math.round(media(com, true)),
      escleraSem: Math.round(media(semOculos, false)),
      escleraCom: Math.round(media(com, false)),
      pxPelaLente: idx.length,
      coberturaDoOlho: Math.round((idx.length / pxOlho) * 1000) / 1000,
    }
  }

  // 2. Boné estourado: pixels visíveis do boné (sem a malha de sombra) com algum canal ≥ 250 ou luma ≥ 250.
  const boneM = M.mascara([
    [nomes.sombra, 'oculto'],
    [nomes.bone, 'preto'],
  ])
  let pxBone = 0
  let canal = 0
  let alta = 0
  for (let i = 0; i < n; i++) {
    if (!boneM.data[i]) continue
    pxBone++
    const d = com.data
    if (Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) >= 250) canal++
    if (luma(d, i) >= 250) alta++
  }
  const bone = { px: Math.round(pxBone / (k * k)), pctCanal: pxBone ? canal / pxBone : 0, pctLuma: pxBone ? alta / pxBone : 0 }

  // 3. Testa sob a aba: em cada coluna entre os olhos, a faixa de pele visível logo abaixo do pixel mais baixo do boné
  //    (10 mm projetados, sem passar de y 0,200 do glb, acima das sobrancelhas); luma com boné ÷ sem boné.
  const pele = M.mascara([
    [nomes.sombra, 'oculto'],
    ['^bust$', 'preto'],
  ])
  const cD = M.centro('Olho_D')
  const cE = M.centro('Olho_E')
  const [xa] = M.projetar(cD)
  const [xb] = M.projetar(cE)
  const yLim = M.projetar([0, 0.2, (cD[2] + cE[2]) / 2 + 0.01])[1]
  const faixa = Math.abs(M.projetar([0, 0.21, 0.03])[1] - M.projetar([0, 0.22, 0.03])[1])
  let sc = 0
  let ss = 0
  let pxT = 0
  for (let x = Math.round(Math.min(xa, xb)); x <= Math.round(Math.max(xa, xb)); x++) {
    let yb = -1
    for (let y = 0; y < Math.min(com.h, yLim); y++) if (boneM.data[y * com.w + x]) yb = y
    if (yb < 0) continue
    for (let y = yb + 2; y <= Math.min(yb + faixa, yLim); y++) {
      const i = y * com.w + x
      if (!pele.data[i]) continue
      sc += luma(com.data, i)
      ss += luma(semBone.data, i)
      pxT++
    }
  }
  const testa = pxT
    ? { queda: 1 - sc / ss, lumaCom: Math.round(sc / pxT), lumaSem: Math.round(ss / pxT), px: Math.round(pxT / (k * k)) }
    : { queda: null, motivo: 'nenhuma coluna com boné acima e pele abaixo entre os olhos' }

  // 4. Caixas por nó (silhueta inteira, busto escondido) e fração escondida pela cabeça.
  const nos = {}
  for (const nome of nomes.nos) {
    const o = M.objeto(nome)
    if (!o || !mostrado(o)) {
      nos[nome] = { box: null }
      continue
    }
    const regras = (bust) => [[nomes.sombra, 'oculto'], ...(bust ? [] : [['^bust$', 'oculto']]), [`^${nome}$`, 'preto'], ['^prop$', 'oculto']]
    const tot = caixa(M.mascara(regras(false)))
    const vis = caixa(M.mascara(regras(true)))
    nos[nome] = { box: tot.box, oculta: tot.px ? 1 - vis.px / tot.px : 0 }
  }
  const cabecaPx = H.masks({}, false)?.cabeca.box?.h ?? null
  return { dpr: k, contraste, bone, testa, nos, cabecaPx, caso: aplicado }
}
