import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
