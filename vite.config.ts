import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // 개발 환경에서 Cloudflare Pages Functions 프록시 시뮬레이션
      '/api/notion': {
        target: 'https://api.notion.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/notion/, ''),
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Authorization 헤더를 요청에서 추출하여 추가
            const authHeader = req.headers.authorization
            if (authHeader) {
              proxyReq.setHeader('Authorization', authHeader)
            }
            proxyReq.setHeader('Notion-Version', '2022-06-28')
          })
        },
      },
    },
  },
})

