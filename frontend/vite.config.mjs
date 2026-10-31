import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import autoprefixer from 'autoprefixer'

const DIA = 24 * 60 * 60

// Service worker (Workbox) para uso sin conexión:
// - la app (JS, CSS, fuentes) se guarda al instalar, así abre aunque no haya red
// - las respuestas GET de /api se guardan al pedirlas: primero la red y, si falla o tarda,
//   la última copia guardada; las descargas de recursos van primero al caché porque el
//   contenido de un recurso no cambia (renombrar solo cambia sus metadatos)
// - las escrituras (POST, PUT, PATCH, DELETE) no se guardan ni se reintentan
// Los nombres de caché comienzan con el prefijo de src/services/offlineCache.js, que los
// elimina al cerrar sesión o cuando inicia sesión otra persona.
const pwa = VitePWA({
  registerType: 'prompt', // la actualización se ofrece en la app (EstadoConexion), no se fuerza
  injectRegister: false, // se registra desde React con useRegisterSW
  manifest: false, // se mantiene public/manifest.json
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
    cleanupOutdatedCaches: true,
    // Workbox dentro de sw.js: si se carga aparte, los manejadores de fetch se registran
    // después de la evaluación inicial y Firefox ignora el service worker para las solicitudes
    inlineWorkboxRuntime: true,
    // con HashRouter toda navegación carga index.html
    navigateFallback: 'index.html',
    navigateFallbackDenylist: [/^\/api\//],
    runtimeCaching: [
      {
        urlPattern: ({ url, request }) =>
          request.method === 'GET' &&
          /^\/api\/recurso\/[0-9a-f]{24}\/descarga$/i.test(url.pathname),
        handler: 'CacheFirst',
        options: {
          cacheName: 'educacionrural-api-recursos-v2',
          expiration: { maxEntries: 100, maxAgeSeconds: 30 * DIA, purgeOnQuotaError: true },
          cacheableResponse: { statuses: [200] },
          // solo descargas reales (el backend las envía como adjunto), nunca una página de
          // advertencia de un túnel o proxy
          plugins: [
            {
              cacheWillUpdate: async ({ response }) =>
                response.headers.get('content-disposition') ? response : null,
            },
          ],
        },
      },
      {
        urlPattern: ({ url, request }) =>
          request.method === 'GET' &&
          url.pathname.startsWith('/api/') &&
          !url.pathname.startsWith('/api/auth/'),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'educacionrural-api-datos-v2',
          // en conexiones lentas, pasado este tiempo se usa la copia guardada si existe
          networkTimeoutSeconds: 8,
          expiration: { maxEntries: 300, maxAgeSeconds: 30 * DIA, purgeOnQuotaError: true },
          cacheableResponse: { statuses: [200] },
          // solo JSON de la API, nunca una página HTML de un túnel o proxy
          plugins: [
            {
              cacheWillUpdate: async ({ response }) =>
                (response.headers.get('content-type') || '').includes('json') ? response : null,
            },
          ],
        },
      },
    ],
  },
})

export default defineConfig(() => {
  return {
    base: './',
    build: {
      outDir: 'build',
      chunkSizeWarningLimit: 1500, // 1.5MB para uso en telefonos móviles; ajustable según resultados
    },
    css: {
      postcss: {
        plugins: [
          autoprefixer({}), // add options if needed
        ],
      },
    },
    plugins: [react(), pwa],
    resolve: {
      alias: [
        {
          find: 'src/',
          replacement: `${path.resolve(__dirname, 'src')}/`,
        },
      ],
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.scss'],
    },
    server: {
      port: 3000,
      // misma ruta relativa /api que en producción, donde la resuelve nginx
      proxy: { '/api': 'http://localhost:8064' },
    },
    preview: {
      proxy: { '/api': 'http://localhost:8064' },
    },
  }
})
