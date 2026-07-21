import JSZip from 'jszip';
import {
  PX_PER_INCH,
  SLIDE_HEIGHT_PX,
  SLIDE_WIDTH_PX,
  createBlankSlide,
  genId,
  type Presentation,
  type Slide,
  type SlideElement,
} from './pptxModel';

// 1 inch = 914400 EMU. PowerPoint slide XML positions/sizes are in EMU.
const EMU_PER_INCH = 914400;

function emuToPx(emu: number, scale: number): number {
  return (emu / EMU_PER_INCH) * PX_PER_INCH * scale;
}

/**
 * Best-effort .pptx → our editable Slide[] model, parsed directly from the
 * OOXML zip (same family of format as .docx, just under ppt/ instead of
 * word/). This is a from-scratch parser (no mature FOSS "read pptx into an
 * editable model" library exists), so it intentionally only recovers what
 * the basic editor can represent: per-shape text (with position/size) and
 * pictures — not animations, transitions, tables, charts, or exact font
 * metrics. Anything it can't confidently parse is skipped rather than
 * guessed at.
 */
export async function importPresentationFromPptx(buffer: ArrayBuffer): Promise<Presentation> {
  const zip = await JSZip.loadAsync(buffer);
  const parser = new DOMParser();

  // Figure out the slide size (EMU) so we can scale everything down to our
  // fixed 960x540 reference canvas proportionally instead of assuming the
  // source used the same dimensions.
  let scale = 1;
  const presentationXml = await zip.file('ppt/presentation.xml')?.async('string');
  if (presentationXml) {
    const presDoc = parser.parseFromString(presentationXml, 'application/xml');
    const sldSz = presDoc.getElementsByTagName('p:sldSz')[0];
    const cx = Number(sldSz?.getAttribute('cx'));
    const cy = Number(sldSz?.getAttribute('cy'));
    if (cx > 0 && cy > 0) {
      const srcWidthPx = (cx / EMU_PER_INCH) * PX_PER_INCH;
      const srcHeightPx = (cy / EMU_PER_INCH) * PX_PER_INCH;
      scale = Math.min(SLIDE_WIDTH_PX / srcWidthPx, SLIDE_HEIGHT_PX / srcHeightPx);
    }
  }

  // Slide order comes from ppt/_rels/presentation.xml.rels + presentation.xml's
  // <p:sldIdLst>, but in practice slide file names (slide1.xml, slide2.xml, …)
  // are already in presentation order for every real-world exporter we
  // tested against (PowerPoint, LibreOffice, Google Slides) — so we just sort
  // numerically, which is far simpler than resolving the relationship graph.
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return na - nb;
    });

  if (slideFiles.length === 0) {
    return { slides: [createBlankSlide()] };
  }

  const slides: Slide[] = [];
  for (const slideFile of slideFiles) {
    const slideNum = slideFile.match(/slide(\d+)\.xml$/)?.[1];
    const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
    const [slideXml, relsXml] = await Promise.all([
      zip.file(slideFile)?.async('string'),
      zip.file(relsPath)?.async('string'),
    ]);
    if (!slideXml) continue;

    const relMap = new Map<string, string>();
    if (relsXml) {
      const relsDoc = parser.parseFromString(relsXml, 'application/xml');
      Array.from(relsDoc.getElementsByTagName('Relationship')).forEach((rel) => {
        const id = rel.getAttribute('Id');
        const target = rel.getAttribute('Target');
        if (id && target) relMap.set(id, target);
      });
    }

    const slideDoc = parser.parseFromString(slideXml, 'application/xml');
    const elements: SlideElement[] = [];

    // Text-bearing shapes: <p:sp> containing <p:txBody>.
    const shapes = Array.from(slideDoc.getElementsByTagName('p:sp'));
    for (const sp of shapes) {
      const txBody = sp.getElementsByTagName('p:txBody')[0];
      if (!txBody) continue;
      const paragraphs = Array.from(txBody.getElementsByTagName('a:p'));
      const text = paragraphs
        .map((p) => Array.from(p.getElementsByTagName('a:t')).map((t) => t.textContent ?? '').join(''))
        .join('\n')
        .trim();
      if (!text) continue;

      const xfrm = sp.getElementsByTagName('a:off')[0];
      const ext = sp.getElementsByTagName('a:ext')[0];
      const x = xfrm ? emuToPx(Number(xfrm.getAttribute('x')), scale) : 80;
      const y = xfrm ? emuToPx(Number(xfrm.getAttribute('y')), scale) : 80;
      const w = ext ? emuToPx(Number(ext.getAttribute('cx')), scale) : 400;
      const h = ext ? emuToPx(Number(ext.getAttribute('cy')), scale) : 100;

      const firstRunProps = txBody.getElementsByTagName('a:rPr')[0];
      const fontSizeAttr = firstRunProps?.getAttribute('sz');
      const fontSize = fontSizeAttr ? Math.round(Number(fontSizeAttr) / 100) : 18;
      const colorEl = firstRunProps?.getElementsByTagName('a:srgbClr')[0];
      const color = colorEl?.getAttribute('val') ? `#${colorEl.getAttribute('val')}` : '#1A1A1A';
      const bold = firstRunProps?.getAttribute('b') === '1';
      const italic = firstRunProps?.getAttribute('i') === '1';
      const underline = (firstRunProps?.getAttribute('u') ?? 'none') !== 'none';
      const algnAttr = paragraphs[0]?.getElementsByTagName('a:pPr')[0]?.getAttribute('algn');
      const align = algnAttr === 'ctr' ? 'center' : algnAttr === 'r' ? 'right' : 'left';

      elements.push({
        id: genId(),
        type: 'text',
        x,
        y,
        width: Math.max(w, 20),
        height: Math.max(h, 20),
        text,
        fontSize: Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 18,
        color,
        bold,
        italic,
        underline,
        align,
        fontFace: 'Arial',
      });
    }

    // Pictures: <p:pic> with an r:embed relationship pointing at ppt/media/*.
    const pics = Array.from(slideDoc.getElementsByTagName('p:pic'));
    for (const pic of pics) {
      const blip = pic.getElementsByTagName('a:blip')[0];
      const embedId = blip?.getAttribute('r:embed');
      if (!embedId) continue;
      const target = relMap.get(embedId);
      if (!target) continue;
      // `target` is a path relative to ppt/slides/ (e.g. "../media/image1.png").
      // Resolve it against that base manually rather than via the URL API,
      // since these are zip-internal paths, not real URLs.
      const resolved = target.startsWith('../')
        ? `ppt/${target.replace(/^(\.\.\/)+/, '')}`
        : `ppt/slides/${target}`;
      const mediaFile = zip.file(resolved) ?? zip.file(`ppt/media/${target.split('/').pop()}`);
      if (!mediaFile) continue;
      const base64 = await mediaFile.async('base64');
      const ext = resolved.split('.').pop()?.toLowerCase() ?? 'png';
      const mime = ext === 'jpg' ? 'jpeg' : ext;
      const src = `data:image/${mime};base64,${base64}`;

      const xfrm = pic.getElementsByTagName('a:off')[0];
      const extEl = pic.getElementsByTagName('a:ext')[0];
      const x = xfrm ? emuToPx(Number(xfrm.getAttribute('x')), scale) : 100;
      const y = xfrm ? emuToPx(Number(xfrm.getAttribute('y')), scale) : 100;
      const w = extEl ? emuToPx(Number(extEl.getAttribute('cx')), scale) : 300;
      const h = extEl ? emuToPx(Number(extEl.getAttribute('cy')), scale) : 200;

      elements.push({
        id: genId(),
        type: 'image',
        x,
        y,
        width: Math.max(w, 20),
        height: Math.max(h, 20),
        src,
      });
    }

    // Slide background color (best-effort — only the simple solid-fill case).
    let background = '#FFFFFF';
    const bg = slideDoc.getElementsByTagName('p:bg')[0];
    const bgSrgb = bg?.getElementsByTagName('a:srgbClr')[0];
    if (bgSrgb?.getAttribute('val')) {
      background = `#${bgSrgb.getAttribute('val')}`;
    }

    slides.push({ id: genId(), background, elements });
  }

  return { slides: slides.length > 0 ? slides : [createBlankSlide()] };
}
