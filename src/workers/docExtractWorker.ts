/// <reference lib="webworker" />
import { Buffer } from 'buffer';
import process from 'process';
// Side-effect only: this package's own job is exactly to attach
// `setImmediate`/`clearImmediate` to whatever global it finds (it has
// explicit Web Worker support via `MessageChannel`), so just importing it
// is the whole fix — see the comment below for which code needs it.
import 'setimmediate';

// `vite-plugin-node-polyfills`'s global-injection shims (for `Buffer` and
// `process`) only hook into the main entry transform, not a separate
// worker build — so unlike in the main bundle, neither is already global
// here. word-extractor's own transitive dependencies (the zip-reading path
// used for .docx-shaped input — i.e. a file with a `.doc` name whose actual
// bytes are a modern OOXML/zip package, which happens more often than it
// sounds: lots of software just defaults to a `.doc` extension regardless
// of what it actually wrote — plus the Node stream/fs polyfills that come
// along with that path) reference `Buffer`/`process` as real globals at
// module top level, not through a module-local import binding — e.g.
// `ole-header.js` does `Buffer.from(...)` immediately on import, and
// bundled stream-polyfill internals read `process.nextTick` / `process.cwd()`
// the same way. That same zip-reading path (`yauzl` → `fd-slicer`'s
// `BufferSlicer.read`/`.write`) also calls the bare global `setImmediate`
// directly, assuming a Node environment — confirmed live: a real user hit
// `打开文件失败：setImmediate is not defined` opening a `.doc`-named file
// that turned out to be zip-based, after the `Buffer`/`process` fix above
// was already deployed and otherwise working. So all three have to be set
// as globals before word-extractor is imported.
//
// That import can't be a static one: static imports are hoisted and
// evaluated before any other top-level statement in *this* file, which
// would run word-extractor's module body (hitting those same references)
// before the assignments below ever ran — confirmed directly while
// building this (`ReferenceError: Buffer is not defined`, then the same
// for `process`, each only once the static import was switched to dynamic
// far enough to expose the next one). A dynamic `import()` is an ordinary
// expression evaluated in program order, so it reliably runs after both.
(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
(globalThis as unknown as { process: typeof process }).process = process;

type DocExtractorModule = new () => {
  extract: (b: Buffer) => Promise<{ getBody: () => string | null }>;
};

type WorkerResponse = { type: 'ready' } | { type: 'result'; ok: true; paragraphs: string[] } | { type: 'result'; ok: false; error: string };

function post(msg: WorkerResponse) {
  self.postMessage(msg);
}

let WordExtractorPromise: Promise<DocExtractorModule> | null = null;

async function loadWordExtractor(): Promise<DocExtractorModule> {
  // @ts-expect-error — word-extractor ships CommonJS + Node-oriented type defs;
  // it works fine for the Buffer-based code path we use (no filesystem access).
  const mod = await import('word-extractor');
  return mod.default as DocExtractorModule;
}

/**
 * Runs legacy `.doc` extraction off the main thread.
 *
 * Why this needs to be a worker at all (it's not just "nice to have"):
 * `word-extractor`'s OLE2 sector-chain walker (`AllocationTable.getSecIdChain`
 * in its own source) only detects an *immediate* self-loop in the sector
 * chain (`secId === secIdPrior`); a slightly-off/corrupted `.doc` whose FAT
 * forms a longer cycle (e.g. 5 → 7 → 5 → 7 → …) makes it loop forever,
 * synchronously, pushing into an array without bound. That's not an "it's
 * slow" bug, it's a true infinite loop — and because it's synchronous, it
 * pins the thread it runs on at 100% with no opportunity for any
 * `setTimeout`/`Promise`-based timeout on *that same thread* to ever fire.
 * On the main thread that means the whole tab freezes — exactly what shows
 * up to a user as "一直读取中" with no way out but closing the tab.
 *
 * Running it here instead means a hang only pins this worker. The caller
 * (see `lib/docImport.ts`) enforces a wall-clock timeout from the main
 * thread and can `terminate()` this worker if it's exceeded, which actually
 * works — unlike a same-thread timeout, there's a separate thread watching.
 *
 * The handshake below (worker posts `{type:'ready'}`, caller only sends the
 * file *after* seeing it) exists because a message posted to a worker
 * before it has actually registered `self.onmessage` is silently dropped,
 * not queued — confirmed directly while this still loaded word-extractor
 * via a top-level `await import(...)` (deferring registration until that
 * resolved): posting the file eagerly right after `new Worker()`
 * intermittently lost the message with zero error on either side, which is
 * just as bad as the hang this whole worker exists to prevent. Loading
 * word-extractor lazily on first use (below) means `self.onmessage` is now
 * registered synchronously and this race shouldn't be reachable any more —
 * the handshake stays anyway as a guarantee rather than an assumption, since
 * the cost of keeping it is one extra tiny message.
 */
self.onmessage = async (e: MessageEvent<ArrayBuffer>) => {
  try {
    if (!WordExtractorPromise) WordExtractorPromise = loadWordExtractor();
    const WordExtractor = await WordExtractorPromise;
    const nodeBuffer = Buffer.from(new Uint8Array(e.data));
    const extractor = new WordExtractor();
    const document = await extractor.extract(nodeBuffer);
    const body: string = document.getBody() ?? '';
    const paragraphs = body.split(/\r?\n/);
    post({ type: 'result', ok: true, paragraphs: paragraphs.length > 0 ? paragraphs : [''] });
  } catch (err) {
    post({ type: 'result', ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};

post({ type: 'ready' });
