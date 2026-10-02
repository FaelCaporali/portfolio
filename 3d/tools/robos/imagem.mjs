// Conversão PNG → WebP e montagem da folha de contato, tudo dentro do próprio Chromium (canvas 2D, `toBlob`), sem
// dependência nova. Decisão do Fael (Fase 8b, correção da Fase 8): o commit bf3e03d importava o sharp por caminho
// direto ao store do pnpm — funciona só nesta máquina, quebra em outra. Nada aqui usa sharp nem qualquer pacote além
// do Playwright que os scripts de captura já tinham.
//
// `lab` é uma página em branco (about:blank, `browser.newPage()`), separada da página do site: só existe para
// desenhar num <canvas> 2D comum e nunca disputa nada com a cena 3D que foi capturada.

/** Uma página em branco, só para os `page.evaluate` deste módulo. */
export async function labPage(browser) {
  return browser.newPage()
}

// Qualidade decrescente do WebP até caber no orçamento (maxBytes) — a mesma ideia da escada antiga do sharp.
const QUALIDADES = [86, 80, 74, 68, 62, 56, 50, 44, 38, 32, 26, 20]

/**
 * PNG (Buffer) → WebP (Buffer) com largura/altura exatas, tentando as qualidades de QUALIDADES até caber em
 * `maxBytes` (byteLength); se nenhuma couber, devolve a última (a mais comprimida). `mode`:
 *  - 'fill': a imagem já nasce do tamanho certo (screenshot no viewport exato) — só reempacota em WebP, com o fundo
 *    pintado atrás por segurança (o canvas do site já é opaco contra a página, mas um PNG com alfa nunca corta).
 *  - 'contain': cabe inteira dentro de width×height, com barras na cor `background` nos lados que sobrarem — nunca
 *    corta (a caixa de recorte de `capturar.mjs` não é quadrada).
 */
export async function paraWebp(lab, png, { width, height, background, mode = 'fill', maxBytes = Infinity }) {
  const dataUrl = `data:image/png;base64,${png.toString('base64')}`
  const base64 = await lab.evaluate(
    async ({ dataUrl, width, height, background, mode, maxBytes, qualidades }) => {
      const img = await new Promise((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('falha ao carregar PNG no canvas'))
        el.src = dataUrl
      })
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = background
      ctx.fillRect(0, 0, width, height)
      if (mode === 'contain') {
        const escala = Math.min(width / img.width, height / img.height)
        const w = img.width * escala
        const h = img.height * escala
        ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h)
      } else {
        ctx.drawImage(img, 0, 0, width, height)
      }
      const paraBlob = (q) => new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', q))
      // base64 em pedaços: String.fromCharCode.apply com um array grande (imagens de ~100 KB) estoura a pilha.
      const paraBase64 = (buf) => {
        const bytes = new Uint8Array(buf)
        const PASSO = 0x8000
        let binario = ''
        for (let i = 0; i < bytes.length; i += PASSO) {
          binario += String.fromCharCode.apply(null, bytes.subarray(i, i + PASSO))
        }
        return btoa(binario)
      }
      let ultimo = null
      for (const q of qualidades) {
        const blob = await paraBlob(q)
        ultimo = await blob.arrayBuffer()
        if (ultimo.byteLength <= maxBytes) break
      }
      return paraBase64(ultimo)
    },
    { dataUrl, width, height, background, mode, maxBytes, qualidades: QUALIDADES },
  )
  return Buffer.from(base64, 'base64')
}

/**
 * Folha de contato (grade de `cols` colunas, rótulo por célula) — montada como uma página HTML e capturada (nunca
 * composta em Buffer): cada `celula` é `{ webp: Buffer, rotulo: string }`.
 */
export async function montarFolha(lab, celulas, { cols = 3, cel = 480, rotulo = 28 } = {}) {
  const linhas = Math.ceil(celulas.length / cols)
  const largura = cols * cel
  const altura = linhas * (cel + rotulo)
  const itens = celulas
    .map(
      (c) => `<figure style="margin:0;width:${cel}px">
        <figcaption style="height:${rotulo}px;background:#111;color:#fff;font:16px sans-serif;display:flex;align-items:center;padding-left:8px;box-sizing:border-box">${c.rotulo}</figcaption>
        <img src="data:image/webp;base64,${c.webp.toString('base64')}" width="${cel}" height="${cel}" style="display:block" />
      </figure>`,
    )
    .join('')
  const html = `<!doctype html><html><body style="margin:0;background:#000">
    <div style="display:grid;grid-template-columns:repeat(${cols},${cel}px)">${itens}</div>
  </body></html>`
  await lab.setViewportSize({ width: largura, height: altura })
  await lab.setContent(html)
  return lab.screenshot({ type: 'png' })
}
