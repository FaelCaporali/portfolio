import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  // cloudflare(): o Worker (worker/index.ts, API do contato) roda dentro do Vite no dev e no preview, com as
  // bindings simuladas localmente (D1, limite, e-mail); variáveis de dev em .dev.vars.
  plugins: [react(), tailwindcss(), cloudflare()],
  // Demo remota pelo ngrok: o subdomínio muda a cada túnel, então libera o domínio inteiro (só no servidor de dev).
  server: { allowedHosts: ['.ngrok-free.app'] },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { three: ['three', '@react-three/fiber', '@react-three/drei'] },
      },
    },
  },
})
