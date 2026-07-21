// @ts-expect-error — word-extractor ships CommonJS + Node-oriented type defs;
// it works fine in the browser for the Buffer-based code path we use (no
// filesystem access), we just don't get first-class ESM types for it.
import WordExtractor from 'word-extractor';

/**
 * Legacy `.doc` (Word 97-2003 binary / OLE2 compound file) text extraction.
 *
 * There is no maintained open-source library that can re-create a `.doc`
 * file's rich formatting (fonts, tables, images) in the browser — `.doc` is
 * a proprietary binary format and most of the ecosystem just shells out to
 * a full Word/LibreOffice install for this. `word-extractor` is a pure-JS
 * OLE2 parser that recovers the plain text reliably, which is enough to get
 * the content into an editable document (formatting is not preserved).
 */
export async function extractParagraphsFromDoc(buffer: ArrayBuffer): Promise<string[]> {
  const nodeBuffer = bufferFromArrayBuffer(buffer);
  const extractor = new WordExtractor();
  const document = await extractor.extract(nodeBuffer);
  const body: string = document.getBody() ?? '';
  const paragraphs = body.split(/\r?\n/);
  return paragraphs.length > 0 ? paragraphs : [''];
}

// word-extractor's OLE2 reader expects a Node `Buffer`, not a raw
// ArrayBuffer/Uint8Array. Vite polyfills the `buffer` package for browser
// builds, so `Buffer.from` is available here.
function bufferFromArrayBuffer(buffer: ArrayBuffer) {
  return Buffer.from(new Uint8Array(buffer));
}
