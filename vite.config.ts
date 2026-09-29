import { defineConfig, loadEnv, runnerImport, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

/** O que src/features/journey/render.tsx exporta (o tipo não vem de lá: o projeto do config não compila JSX). */
interface JourneyRender {
  renderJourney: () => string
  lifeAccentsCss: () => string
}

/** Carrega o render da trajetória a cada uso: no dev, texto editado aparece no próximo recarregamento. */
async function journeyRender(): Promise<JourneyRender> {
  const { module } = await runnerImport<JourneyRender>('/src/features/journey/render.tsx', {
    esbuild: { jsx: 'automatic' },
  })
  return module
}

const ACCENTS_ID = 'virtual:journey-accents.css'

/**
 * Página da trajetória (/journey) renderizada no build: o navegador recebe o texto pronto (indexável e legível sem
 * JavaScript) e o React hidrata a mesma árvore (src/features/journey/main.tsx), sem three.js. As cores das vidas saem
 * de journey.ts como classes num CSS gerado, porque a CSP das páginas não aceita estilo inline.
 */
function journeyPage(): Plugin {
  return {
    name: 'journey-page',
    resolveId: (id) => (id === ACCENTS_ID ? `\0${ACCENTS_ID}` : undefined),
    async load(id) {
      if (id !== `\0${ACCENTS_ID}`) return null
      return (await journeyRender()).lifeAccentsCss()
    },
    transformIndexHtml: {
      order: 'pre',
      async handler(html, ctx) {
        if (!ctx.filename.endsWith('journey.html')) return
        return html.replace('<!--journey-->', (await journeyRender()).renderJourney())
      },
    },
    // O HTML da página sai do render: editado o conteúdo ou a página, recarrega a página inteira.
    // O CSS das cores é virtual e o Vite o guarda: sem invalidar, a mudança só aparecia ao reiniciar o servidor.
    hotUpdate({ file, server }) {
      if (!/src\/(content|features\/journey)\//.test(file)) return
      const accents = server.moduleGraph.getModuleById(`\0${ACCENTS_ID}`)
      if (accents) server.moduleGraph.invalidateModule(accents)
      server.ws.send({ type: 'full-reload', path: '/journey' })
    },
    // No dev, /journey (o endereço de produção) serve a página; sem isso o Vite devolveria o herói.
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === '/journey' || req.url?.startsWith('/journey?') || req.url?.startsWith('/journey#')) {
          req.url = req.url.replace('/journey', '/journey.html')
        }
        next()
      })
    },
  }
}

export default defineConfig(({ command, mode }) => {
  // Sem a chave pública o Turnstile não renderiza e o formulário nunca envia: build de produção sem ela não sai.
  if (command === 'build' && mode === 'production' && !loadEnv(mode, '.').VITE_TURNSTILE_SITEKEY) {
    throw new Error('VITE_TURNSTILE_SITEKEY ausente (no CI: segredo do ambiente production)')
  }
  return {
    // cloudflare(): o Worker (worker/index.ts, API do contato) roda dentro do Vite no dev e no preview, com as
    // bindings simuladas localmente (D1, limite, e-mail); variáveis de dev em .dev.vars.
    plugins: [react(), tailwindcss(), cloudflare(), journeyPage()],
    // Demo remota pelo ngrok: o subdomínio muda a cada túnel, então libera o domínio inteiro (só no servidor de dev).
    // Porta fixa: ALLOWED_ORIGINS do .dev.vars aponta para ela (o Worker recusa outra origem).
    server: { port: 5199, strictPort: true, allowedHosts: ['.ngrok-free.app'] },
    // Duas páginas no navegador: o herói e a trajetória. Só no ambiente do cliente; o do Worker tem a própria entrada.
    environments: { client: { build: { rollupOptions: { input: { main: 'index.html', journey: 'journey.html' } } } } },
    build: {
      rollupOptions: {
        output: {
          manualChunks: { three: ['three', '@react-three/fiber', '@react-three/drei'] },
        },
      },
    },
  }
})
