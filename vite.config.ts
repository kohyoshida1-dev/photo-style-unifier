import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' — 公開先のサブパス（GitHub Pages の /<repo>/ など）に依存しない相対パスで出力する
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
})
