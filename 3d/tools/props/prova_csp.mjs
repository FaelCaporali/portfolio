// Prova do build de produção com a CSP real: serve a pasta `client` de um `vite build` com os cabeçalhos do
// `_headers` dela (os de `public/_headers`), abre `/?slot=<vida>&d=0` nas 3 telas e registra violações de CSP,
// requisições fora da origem, erros de console/página e as respostas dos glbs; grava uma captura por tela.
// Uso: VITE_TURNSTILE_SITEKEY=verificacao-local npx vite build --outDir <tmp>/dist
//      node 3d/tools/props/prova_csp.mjs <tmp>/dist/client <vida> <pasta> [--porta=5311] [--espera=16000]
// Sai 1 se houver violação, requisição externa, erro de console/página ou glb que não respondeu 200.
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { TELAS, launch } from './site.mjs'

const args = process.argv.slice(2)
const opc = (n, d) => Number(args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1] ?? d)
const [raiz, vida = 'empreendedor', pasta = '/tmp/prova-csp'] = args.filter((a) => !a.startsWith('--'))
const porta = opc('porta', 5311)
const espera = opc('espera', 16000)
if (!raiz || !existsSync(join(raiz, 'index.html'))) {
  console.error('uso: node 3d/tools/props/prova_csp.mjs <dist/client> <vida> <pasta> [--porta=5311]')
  process.exit(2)
}
mkdirSync(pasta, { recursive: true })

/** Blocos do `_headers` (padrão de caminho → cabeçalhos), no formato do Cloudflare. */
function lerHeaders(arq) {
  const blocos = []
  for (const linha of readFileSync(arq, 'utf8').split('\n')) {
    if (!linha.trim() || linha.startsWith('#')) continue
    if (!/^\s/.test(linha)) blocos.push({ re: new RegExp(`^${linha.trim().replace(/\*/g, '.*')}$`), h: {} })
    else {
      const i = linha.indexOf(':')
      blocos.at(-1).h[linha.slice(0, i).trim()] = linha.slice(i + 1).trim()
    }
  }
  return blocos
}
const blocos = lerHeaders(join(raiz, '_headers'))
const TIPOS = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
}

const servidor = createServer((req, res) => {
  const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let arq = normalize(join(raiz, caminho))
  if (!arq.startsWith(normalize(raiz)) || !existsSync(arq) || statSync(arq).isDirectory()) {
    arq = existsSync(join(arq, 'index.html')) ? join(arq, 'index.html') : join(raiz, 'index.html')
  }
  for (const b of blocos) if (b.re.test(caminho)) for (const [k, v] of Object.entries(b.h)) res.setHeader(k, v)
  res.setHeader('Content-Type', TIPOS[extname(arq)] ?? 'application/octet-stream')
  createReadStream(arq).pipe(res)
})
await new Promise((ok) => servidor.listen(porta, '127.0.0.1', ok))
const origem = `http://localhost:${porta}`
const csp = blocos.find((b) => b.re.test('/'))?.h['Content-Security-Policy']

const browser = await launch()
const relatorio = { origem, csp, telas: {} }
let falhou = false
for (const [w, h, dsf] of TELAS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf })
  const page = await ctx.newPage()
  const r = { violacoes: [], externas: [], erros: [], glbs: {}, avisosTextura: [] }
  await page.addInitScript(() => {
    window.__violacoes = []
    document.addEventListener('securitypolicyviolation', (e) =>
      window.__violacoes.push(`${e.violatedDirective} ${e.blockedURI}`),
    )
  })
  page.on('console', (m) => {
    const t = m.text()
    if (m.type() === 'error') r.erros.push(t)
    if (/texture|textura|webp/i.test(t)) r.avisosTextura.push(`${m.type()}: ${t}`)
    if (/Content Security Policy|Refused to/i.test(t)) r.violacoes.push(t)
  })
  page.on('pageerror', (e) => r.erros.push(`pageerror ${e.message}`))
  page.on('request', (q) => {
    const u = q.url()
    if (!u.startsWith(origem) && !u.startsWith('data:') && !u.startsWith('blob:')) r.externas.push(u)
  })
  page.on('response', (s) => {
    if (s.url().endsWith('.glb')) r.glbs[s.url().split('/').pop()] = s.status()
  })
  await page.goto(`${origem}/?slot=${vida}&d=0`)
  await page.locator('canvas').waitFor({ timeout: 90_000 })
  await page.waitForTimeout(espera)
  r.violacoes.push(...(await page.evaluate(() => window.__violacoes)))
  await page.screenshot({ path: `${pasta}/prod-${w}x${h}.png` })
  await ctx.close()
  const ruim = r.violacoes.length || r.externas.length || r.erros.length || Object.values(r.glbs).some((s) => s !== 200)
  falhou ||= !!ruim
  relatorio.telas[`${w}x${h}`] = r
  console.log(
    `${w}x${h}: ${r.violacoes.length} violações, ${r.externas.length} externas, ${r.erros.length} erros, ` +
      `glbs ${JSON.stringify(r.glbs)}, avisos de textura ${r.avisosTextura.length}`,
  )
}
await browser.close()
servidor.close()
writeFileSync(`${pasta}/prova-csp.json`, JSON.stringify(relatorio, null, 1))
console.log(falhou ? 'RESULTADO: REPROVA' : 'RESULTADO: 0 violações, 0 externas, 0 erros, glbs 200')
process.exit(falhou ? 1 : 0)
