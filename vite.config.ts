import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig(({ command, mode }) => {
  // Sem a chave pública o Turnstile não renderiza e o formulário nunca envia: build de produção sem ela não sai.
  if (command === 'build' && mode === 'production' && !loadEnv(mode, '.').VITE_TURNSTILE_SITEKEY) {
    throw new Error('VITE_TURNSTILE_SITEKEY ausente (.env.production)')
  }
  return {
    // cloudflare(): o Worker (worker/index.ts, API do contato) roda dentro do Vite no dev e no preview, com as
    // bindings simuladas localmente (D1, limite, e-mail); variáveis de dev em .dev.vars.
    plugins: [react(), tailwindcss(), cloudflare()],
    // Demo remota pelo ngrok: o subdomínio muda a cada túnel, então libera o domínio inteiro (só no servidor de dev).
    // Porta fixa: ALLOWED_ORIGINS do .dev.vars aponta para ela (o Worker recusa outra origem).
    server: { port: 5199, strictPort: true, allowedHosts: ['.ngrok-free.app'] },
    build: {
      rollupOptions: {
        output: {
          manualChunks: { three: ['three', '@react-three/fiber', '@react-three/drei'] },
        },
      },
    },
  }
})
