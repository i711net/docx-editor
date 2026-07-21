import { DocumentAgent, createEmptyDocument } from '@eigenpal/docx-editor-core';
import type { Document } from '@eigenpal/docx-editor-core/types/document';
import type { PageImage } from './pdfImageImport';

// Word page content width in twips (A4/Letter default from createEmptyDocument:
// 12240 twips page width minus 1440+1440 twips margins = 9360 twips ≈ 6.5in).
const CONTENT_WIDTH_TWIPS = 9360;
const TWIPS_PER_PIXEL_AT_96DPI = 15;
const MAX_IMAGE_WIDTH_PX = CONTENT_WIDTH_TWIPS / TWIPS_PER_PIXEL_AT_96DPI;

/**
 * Builds a Document with one image per page (each page image on its own
 * paragraph, one paragraph per PDF page). Uses `DocumentAgent.insertImage`
 * rather than hand-building the `image` content node directly, because the
 * agent also registers the OOXML relationship/media entry the image needs
 * to actually survive being saved back out as a real .docx — verified by
 * round-tripping a generated file through the save path and inspecting the
 * resulting zip for `word/media/*`.
 */
export function buildDocumentFromPageImages(images: PageImage[]): Document {
  const base = createEmptyDocument();
  base.package.document.content =
    images.length > 0
      ? images.map(() => ({ type: 'paragraph' as const, content: [] }))
      : [{ type: 'paragraph' as const, content: [] }];

  let agent = DocumentAgent.fromDocument(base);

  images.forEach((image, index) => {
    const widthPx = Math.min(image.widthPx, MAX_IMAGE_WIDTH_PX);
    const scale = widthPx / image.widthPx;
    const heightPx = Math.round(image.heightPx * scale);
    agent = agent.insertImage(
      { paragraphIndex: index, offset: 0 },
      image.dataUrl,
      { width: Math.round(widthPx), height: heightPx },
    );
  });

  return agent.getDocument();
}
