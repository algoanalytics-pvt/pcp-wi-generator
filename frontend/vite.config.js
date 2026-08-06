import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The deployed app is served from the /pcp_wi_generator/ subpath behind nginx.
// `base` is applied to production builds only, so `npm run dev` keeps serving
// from "/" with the /api proxy below. This is the single place the subpath is
// spelled on the frontend — src/api.js derives the API base from it via
// import.meta.env.BASE_URL.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/pcp_wi_generator/' : '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
}))
