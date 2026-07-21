import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface PageImage {
  dataUrl: string;
  widthPx: number;
  heightPx: number;
}

/**
 * Renders every page of a PDF to a PNG data URL, pixel-for-pixel faithful to
 * the original (this is just "print the page to a picture"), for the cases
 * where text extraction either isn't reliable (scanned documents, complex
 * multi-column layouts, forms) or the user simply wants to keep the exact
 * original look. The trade-off is the opposite of `pdfImport.ts`: the layout
 * is perfect, but none of the text is editable or selectable afterwards —
 * each page becomes one embedded picture.
 */
export async function renderPdfPagesAsImages(
  buffer: ArrayBuffer,
  options?: { maxWidthPx?: number },
): Promise<PageImage[]> {
  const maxWidthPx = options?.maxWidthPx ?? 1600;
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const images: PageImage[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(3, maxWidthPx / baseViewport.width);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法创建 canvas 上下文');

    await page.render({ canvasContext: context, viewport }).promise;

    images.push({
      dataUrl: canvas.toDataURL('image/png'),
      widthPx: canvas.width,
      heightPx: canvas.height,
    });

    // Release the canvas before moving on — a long PDF at 1600px-wide PNGs
    // can otherwise hold a lot of decoded bitmap memory at once.
    canvas.width = 0;
    canvas.height = 0;
  }

  return images;
}
