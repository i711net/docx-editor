// `?worker` makes Vite bundle docExtractWorker.ts (and its word-extractor
// dependency) into a standalone worker script and hand back a `Worker`
// constructor for it.
import DocExtractWorker from '../workers/docExtractWorker?worker';

type WorkerResponse = { type: 'ready' } | { type: 'result'; ok: true; paragraphs: string[] } | { type: 'result'; ok: false; error: string };

// Generous, but finite. Real `.doc` files — even large, multi-thousand-
// paragraph ones — extract in well under a second (word-extractor's own
// parsing is fast; see the comment in docExtractWorker.ts for the one case
// that genuinely never finishes). This is purely a safety net against that
// case, not a performance budget for normal files.
const DOC_EXTRACT_TIMEOUT_MS = 20_000;

/**
 * Legacy `.doc` (Word 97-2003 binary / OLE2 compound file) text extraction.
 *
 * There is no maintained open-source library that can re-create a `.doc`
 * file's rich formatting (fonts, tables, images) in the browser — `.doc` is
 * a proprietary binary format and most of the ecosystem just shells out to
 * a full Word/LibreOffice install for this. `word-extractor` is a pure-JS
 * OLE2 parser that recovers the plain text reliably, which is enough to get
 * the content into an editable document (formatting is not preserved).
 *
 * This runs the actual parsing in a Web Worker (`workers/docExtractWorker.ts`)
 * rather than inline, specifically so a malformed/corrupted `.doc` whose
 * sector chain forms a cycle — which makes word-extractor's OLE2 reader loop
 * forever — can't freeze the whole tab. If the worker doesn't respond within
 * `DOC_EXTRACT_TIMEOUT_MS`, it gets forcibly terminated and this rejects with
 * a clear error instead of leaving the UI stuck on "正在读取…" indefinitely.
 *
 * We wait for the worker's own `{type:'ready'}` message before sending it
 * the file, instead of posting right after `new Worker()`. A message sent
 * to this worker before it finishes its own startup (it loads word-extractor
 * via a dynamic `import()`) is silently dropped, not queued — confirmed
 * directly while building this, as an intermittent "file picked, nothing
 * ever happens" failure with no error on either side. The handshake makes
 * that race impossible instead of just unlikely.
 */
export async function extractParagraphsFromDoc(buffer: ArrayBuffer): Promise<string[]> {
  const worker = new DocExtractWorker();

  return new Promise<string[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      worker.terminate();
      reject(
        new Error(
          '解析超时：这个 .doc 文件内部结构可能损坏或不规范，无法安全解析。可以尝试用 Word/WPS/LibreOffice 打开后重新“另存为” .doc 或 .docx 再试一次。',
        ),
      );
    }, DOC_EXTRACT_TIMEOUT_MS);

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.type === 'ready') {
        // Transfer the buffer instead of copying it — we don't need it on
        // the main thread afterwards.
        worker.postMessage(buffer, [buffer]);
        return;
      }
      clearTimeout(timer);
      worker.terminate();
      if (e.data.ok) {
        resolve(e.data.paragraphs);
      } else {
        reject(new Error(e.data.error));
      }
    };

    worker.onerror = (err) => {
      clearTimeout(timer);
      worker.terminate();
      reject(new Error(err.message || '解析 .doc 文件时发生未知错误'));
    };
  });
}
