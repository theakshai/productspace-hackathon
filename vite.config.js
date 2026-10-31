import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base must match the GitHub Pages path: https://theakshai.github.io/productspace-hackathon/
export default defineConfig({
  plugins: [react()],
  base: '/productspace-hackathon/',
})
