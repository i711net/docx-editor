import * as pdfjsLib from 'pdfjs-dist';
// Vite turns this into a hashed, self-hosted asset URL at build time — the
// worker never has to be fetched from a CDN.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface Line {
  text: string;
  y: number;
  height: number;
}

/**
 * Best-effort PDF → paragraph-text extraction.
 *
 * PDF has no paragraph model — it only knows where individual glyphs sit on
 * the page. We reconstruct paragraphs heuristically:
 *   1. Group text items into visual lines using pdf.js's `hasEOL` flag.
 *   2. Chain consecutive lines into the same paragraph when the vertical
 *      gap between them is close to the line height (i.e. normal line
 *      spacing / wrapped text); start a new paragraph on a bigger gap
 *      (a blank line, a heading, a new section, ...).
 *
 * This will not perfectly recover multi-column layouts, tables, or images —
 * see the README for the documented limitations. What it does produce is
 * real, independently-editable paragraphs once loaded into the docx editor.
 */
export async function extractParagraphsFromPdf(buffer: ArrayBuffer): Promise<string[]> {
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const paragraphs: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const lines: Line[] = [];
    let text = '';
    let y: number | null = null;
    let height = 0;

    for (const raw of textContent.items) {
      if (!('str' in raw)) continue;
      const item = raw as { str: string; transform: number[]; hasEOL?: boolean };
      if (y === null) y = item.transform[5];
      height = Math.max(height, Math.abs(item.transform[3]) || 0);
      text += item.str;
      if (item.hasEOL) {
        lines.push({ text, y: y ?? 0, height: height || 10 });
        text = '';
        y = null;
        height = 0;
      }
    }
    if (text.trim()) {
      lines.push({ text, y: y ?? 0, height: height || 10 });
    }

    let paragraph = '';
    let prevY: number | null = null;
    let prevHeight = 0;

    const flush = () => {
      if (paragraph.trim()) paragraphs.push(paragraph.trim());
      paragraph = '';
    };

    for (const line of lines) {
      const trimmed = line.text.trim();
      if (!trimmed) continue;

      if (prevY !== null) {
        const gap = Math.abs(prevY - line.y);
        const threshold = Math.max(prevHeight, line.height) * 1.3;
        // A gap that's large relative to line height signals a blank line /
        // new section. A sharp font-size change (heading <-> body text) is
        // just as strong a signal on its own, even when the raw gap alone
        // would look like ordinary line spacing.
        const sizeRatio = Math.max(prevHeight, line.height) / Math.max(1, Math.min(prevHeight, line.height));
        if (gap > threshold || sizeRatio > 1.15) {
          flush();
          paragraph = trimmed;
        } else {
          paragraph += (paragraph ? ' ' : '') + trimmed;
        }
      } else {
        paragraph = trimmed;
      }
      prevY = line.y;
      prevHeight = line.height;
    }
    flush();
  }

  return paragraphs.length > 0 ? paragraphs : [''];
}
