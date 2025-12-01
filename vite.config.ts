import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
  ],
  build: {
    minify: 'esbuild', // Reactivar minificación ahora que mermaid viene del CDN
    rollupOptions: {
      external: ['mermaid'], // Excluir mermaid del bundle
    },
  },
})
