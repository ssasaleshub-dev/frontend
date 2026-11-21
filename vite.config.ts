import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const rawTarget =
    env.VITE_ENV === 'local' && env.VITE_API_LOCAL
      ? env.VITE_API_LOCAL
      : env.VITE_API_PROD || 'https://srv2054834.hstgr.cloud/prod/'

  let targetHost = rawTarget
  let subPath = ''
  try {
    const targetUrl = new URL(rawTarget)
    targetHost = targetUrl.origin
    subPath = targetUrl.pathname.replace(/\/$/, '')
  } catch {
    targetHost = rawTarget
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: targetHost,
          changeOrigin: true,
          rewrite: (path) => (subPath ? `${subPath}${path}` : path),
          configure: (proxy) => {
            proxy.on('proxyReq', (req) => {
              req.removeHeader('origin')
              req.removeHeader('referer')
            })
          },
        },
      },
    },
  }
})
