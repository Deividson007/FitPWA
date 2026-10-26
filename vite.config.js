import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['app-icon.svg'],
      manifest: {
        id: '/', name: 'FitFlow - Meu Treino', short_name: 'FitFlow',
        description: 'Treinos, temporizador e evolução, 100% offline.',
        theme_color: '#101a2f', background_color: '#101a2f',
        display: 'standalone', orientation: 'portrait', start_url: '/', scope: '/',
        icons: [{ src: '/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
        navigateFallback: '/index.html',
        maximumFileSizeToCacheInBytes: 7000000,
        cleanupOutdatedCaches: true
      }
    })
  ],
  build: { target: 'es2020' }
})
