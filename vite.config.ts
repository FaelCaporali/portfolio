import { defineConfig, loadEnv, runnerImport, type Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { reactRouter } from '@react-router/dev/vite'

const ACCENTS_ID = 'virtual:journey-accents.css'

/** Carrega as cores a cada uso: no dev, cor editada em journey.ts aparece no próximo recarregamento. */
async function lifeAccentsCss(): Promise<string> {
  const { module } = await runnerImport<{ lifeAccentsCss: () => string }>('/src/features/journey/accents.ts')
  return module.lifeAccentsCss()
}

/**
 * As cores das vidas saem de journey.ts como classes num CSS gerado (virtual:journey-accents.css, importado em
 * src/root.tsx), porque a CSP das páginas não aceita estilo inline.
 */
function lifeAccents(): Plugin {
  return {
    name: 'life-accents',
    resolveId: (id) => (id === ACCENTS_ID ? `\0${ACCENTS_ID}` : undefined),
    async load(id) {
      if (id !== `\0${ACCENTS_ID}`) return null
      return lifeAccentsCss()
    },
    // O CSS é virtual e o Vite o guarda: sem invalidar, cor editada só aparecia ao reiniciar o servidor.
    hotUpdate({ file, server }) {
      if (!file.includes('/src/content/')) return
      const accents = server.moduleGraph.getModuleById(`\0${ACCENTS_ID}`)
      if (accents) server.moduleGraph.invalidateModule(accents)
      server.ws.send({ type: 'full-reload' })
    },
  }
}

export default defineConfig(({ command, mode }) => {
  // Sem a chave pública o Turnstile não renderiza e o formulário nunca envia: build de produção sem ela não sai.
  if (command === 'build' && mode === 'production' && !loadEnv(mode, '.').VITE_TURNSTILE_SITEKEY) {
    throw new Error('VITE_TURNSTILE_SITEKEY ausente (no CI: segredo do ambiente production)')
  }
  return {
    // As páginas saem prontas do build (reactRouter, react-router.config.ts); o Worker (worker/index.ts, a API do
    // contato) roda à parte no `wrangler dev` (pnpm dev:api, porta 8787), e o dev encaminha /api para ele.
    plugins: [tailwindcss(), reactRouter(), lifeAccents()],
    // Demo remota pelo ngrok: o subdomínio muda a cada túnel, então libera o domínio inteiro (só no servidor de dev).
    // Porta fixa: ALLOWED_ORIGINS do .dev.vars aponta para ela (o Worker recusa outra origem; o proxy mantém a
    // origem do navegador).
    server: {
      port: 5199,
      strictPort: true,
      allowedHosts: ['.ngrok-free.app'],
      proxy: { '/api': 'http://127.0.0.1:8787' },
      // A saída do build (pnpm build, build/client) não é fonte: gerá-la com o dev no ar não recarrega a página.
      watch: { ignored: ['**/build/**'] },
    },
  }
})
