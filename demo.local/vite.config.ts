import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { appVersionPlugin } from '../scripts/appVersionPlugin.ts'

export default defineConfig({
  root: 'demo.local',
  plugins: [react(), appVersionPlugin()],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('demo-local-without-supabase'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
