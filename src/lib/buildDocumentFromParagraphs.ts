import { createEmptyDocument } from '@eigenpal/docx-editor-react';
import type { Document } from '@eigenpal/docx-editor-core/types/document';

/**
 * `createDocumentWithText` (from @eigenpal/docx-editor-core) stuffs the whole
 * string into a single run inside a single paragraph — literal `\n`
 * characters do not become separate paragraphs. For imported content (PDF /
 * legacy .doc / HWP text extraction) we want each logical paragraph to be a
 * real ProseMirror paragraph, so the user gets normal Word-style reflow
 * instead of one giant blob of text with invisible newlines.
 *
 * This builds a valid Document by starting from `createEmptyDocument()`
 * (which sets up valid styles / section properties) and replacing its body
 * content with one paragraph per string in `paragraphs`.
 */
export function buildDocumentFromParagraphs(
  paragraphs: string[],
  options?: Parameters<typeof createEmptyDocument>[0],
): Document {
  const doc = createEmptyDocument(options);

  const cleaned = paragraphs.map((p) => p.replace(/\s+$/, '').replace(/^\s+/, ''));
  const nonEmpty = cleaned.length > 0 ? cleaned : [''];

  const content = nonEmpty.map((text) => ({
    type: 'paragraph' as const,
    content: text
      ? [
          {
            type: 'run' as const,
            content: [{ type: 'text' as const, text }],
          },
        ]
      : [],
  }));

  doc.package.document.content = content as Document['package']['document']['content'];
  return doc;
}
