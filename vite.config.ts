import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // word-extractor (legacy .doc text extraction) was written for Node and
    // pulls in `buffer`/`fs`/`path`/`stream`. We only ever use its
    // Buffer-based API (never the filesystem-path branch), but Vite still
    // needs these to resolve at build time — this plugin provides browser
    // shims for them.
    nodePolyfills({
      include: ['buffer', 'stream', 'path', 'util', 'process'],
    }),
    react(),
  ],
})
