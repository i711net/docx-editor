import JSZip from 'jszip';

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const PRESENTATION_XML_PATH = 'ppt/presentation.xml';

export interface PptxUnlockResult {
  /** True if a `<p:modifyVerifier>` (PowerPoint's "Restrict Editing" flag) was found and removed. */
  hadRestriction: boolean;
  /** False when the file didn't look like a valid .pptx at all — nothing was changed. */
  wasValidPptx: boolean;
  blob: Blob;
}

/**
 * Removes PowerPoint's "Restrict Editing" write-protection flag from a
 * .pptx file, without touching anything else in it.
 *
 * This is NOT password cracking. PowerPoint's "Restrict Editing" stores a
 * `<p:modifyVerifier>` element (a password *hash*, salt, and algorithm name)
 * as a child of `<p:presentation>` in ppt/presentation.xml. PowerPoint's UI
 * checks this hash before allowing edits, but the hash does not encrypt the
 * slide XML or the zip in any way — the file remains a completely normal,
 * readable OOXML package throughout. So the restriction can be lifted by
 * simply deleting that one element and re-zipping; the real password is
 * never needed and is never recovered or exposed.
 *
 * Only meaningful for files that already open normally (no open/view
 * password) — this only concerns PowerPoint's separate "don't allow edits"
 * flag, not file encryption.
 */
export async function removePptxEditRestriction(buffer: ArrayBuffer): Promise<PptxUnlockResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    return { hadRestriction: false, wasValidPptx: false, blob: new Blob([buffer], { type: PPTX_MIME }) };
  }

  const xml = await zip.file(PRESENTATION_XML_PATH)?.async('string');
  if (!xml) {
    return { hadRestriction: false, wasValidPptx: false, blob: new Blob([buffer], { type: PPTX_MIME }) };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return { hadRestriction: false, wasValidPptx: false, blob: new Blob([buffer], { type: PPTX_MIME }) };
  }

  const verifiers = Array.from(doc.getElementsByTagName('p:modifyVerifier'));
  const hadRestriction = verifiers.length > 0;
  verifiers.forEach((el) => el.parentNode?.removeChild(el));

  if (hadRestriction) {
    const serializer = new XMLSerializer();
    zip.file(PRESENTATION_XML_PATH, serializer.serializeToString(doc));
  }

  const outBlob = await zip.generateAsync({ type: 'blob', mimeType: PPTX_MIME });
  return { hadRestriction, wasValidPptx: true, blob: outBlob };
}
