/**
 * Vite Configuration for Moove PWA
 *
 * - React with Fast Refresh
 * - Tailwind CSS v4
 * - PWA with auto-update and offline support
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Stamped into the bundle so Settings can say which build is running.
  // Netlify exports COMMIT_REF on every build; locally there is none.
  define: {
    __BUILD_REF__: JSON.stringify(
      (process.env.COMMIT_REF ?? '').slice(0, 7) || 'dev'),
  },
  plugins: [
    react(),
    tailwindcss(),
    // PWA configuration for installable app experience
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo_icon.png', 'logo_stacked.png'],
      manifest: {
        name: 'Moove',
        short_name: 'Moove',
        description: 'Personal workout tracking app',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'logo_icon.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'logo_icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Force new service worker to take over immediately
        skipWaiting: true,
        clientsClaim: true,
      }
    })
  ],
})
