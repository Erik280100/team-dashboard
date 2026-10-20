import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

/**
 * Content-Security-Policy als Meta-Tag (GitHub Pages kann keine Header setzen). Nur im Build — der Dev-Server
 * braucht Inline-Skripte für Hot Reload. Erlaubt sind nur die eigene Herkunft, Google Fonts und die Firebase-
 * Endpunkte; gegen die lokalen Emulatoren (VITE_USE_EMULATORS=true) zusätzlich 127.0.0.1.
 */
function csp(emulators: boolean): Plugin {
  const local = emulators ? ' http://127.0.0.1:* ws://127.0.0.1:*' : ''
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' https://*.googleapis.com https://*.cloudfunctions.net https://*.run.app${local}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`),
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/team-dashboard/',
  plugins: [react(), tailwindcss(), csp(loadEnv(mode, process.cwd(), 'VITE_').VITE_USE_EMULATORS === 'true' || process.env.VITE_USE_EMULATORS === 'true')],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))
