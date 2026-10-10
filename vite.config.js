import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Preserve long-lived static assets in the output directory.
 *
 * `public/` contains ~190 files that must survive every rebuild:
 *   - pdfjs/cmaps + pdfjs/standard_fonts  (CJK font coverage for pdf.js)
 *   - samples/                             (bundled sample documents)
 *
 * Vite wipes `outDir` before each build, which deletes them. Restoring the
 * files afterwards keeps a normal `npm run build` / `tauri build` correct
 * without any manual copy step.
 */
function preservePublicAssets() {
  const root = import.meta.dirname
  const publicDir = resolve(root, 'public')
  const outDir = resolve(root, 'dist')
  if (!existsSync(publicDir)) return

  return {
    name: 'preserve-public-assets',
    // Run after Vite has written its own output so nothing gets overwritten
    enforce: 'post',
    closeBundle() {
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
      cpSync(publicDir, outDir, { recursive: true })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), preservePublicAssets()],
  build: {
    // Keep the output predictable for the Tauri bundler
    emptyOutDir: false,
    chunkSizeWarningLimit: 2500,
  },
})
