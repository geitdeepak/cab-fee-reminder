import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      // We register the service worker ourselves (src/main.jsx) so we can show
      // a non-blocking "Update available" bar (NFR-10) instead of reloading
      // silently under the operator mid-task.
      injectRegister: false,
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Cab Fee Reminder',
        short_name: 'CabFee',
        description: 'Offline student cab-fee register and WhatsApp reminder dispatcher.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0F172A',
        theme_color: '#0F172A',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Cache-first app shell, no runtime data caching (there is no server).
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true
      },
      devOptions: { enabled: false }
    })
  ],
  resolve: {
    alias: {
      // dexie-react-hooks targets the React hooks API; preact/compat implements it.
      react: 'preact/compat',
      'react-dom': 'preact/compat'
    }
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.{js,jsx}'],
    // Inline so the react -> preact/compat alias applies (as it does in the bundled build).
    server: { deps: { inline: ['dexie-react-hooks'] } }
  }
});
