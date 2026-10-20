/**
 * Does this buffer start with a ZIP local-file-header-ish signature?
 *
 * Mirrors the exact check `word-extractor` itself uses internally
 * (`lib/word.js`) to decide between its OLE2 reader and its
 * `OpenOfficeExtractor` (zip-based) reader: first two bytes `PK` (0x504b),
 * then one of 0x0304 (local file header — the normal case), 0x0506 (empty
 * archive), or 0x0708 (spanned-archive marker).
 *
 * Used to catch files with a `.doc` extension whose actual bytes are a
 * modern OOXML/zip package — more common than it sounds, since plenty of
 * software just defaults to writing `.doc` regardless of the real format.
 * See the comment in `App.tsx`'s `.doc` branch for why that case is routed
 * to our own native `parseDocx` instead of word-extractor's zip fallback.
 */
export function looksLikeZipPackage(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const view = new DataView(buffer);
  if (view.getUint16(0, false) !== 0x504b) return false;
  const next = view.getUint16(2, false);
  return next === 0x0304 || next === 0x0506 || next === 0x0708;
}
