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
  worker: {
    // `docExtractWorker.ts` (legacy .doc parsing, run off-thread so a
    // malformed file can't freeze the tab — see its own comments) loads its
    // one dependency via a dynamic `import()`, specifically so that import
    // runs *after* a `globalThis.Buffer` assignment it depends on (static
    // imports are hoisted ahead of everything else in the importing
    // module, which doesn't work here — see that file's comments). Module
    // format keeps that code-split chunk a normal relative-URL import
    // instead of needing it inlined.
    format: 'es',
  },
})
