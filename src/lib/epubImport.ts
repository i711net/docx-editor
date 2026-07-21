import ePub from 'epubjs';

/**
 * Best-effort EPUB → paragraph-text extraction, for the "转换为可编辑文档"
 * path (same pattern as HWP/PDF/.doc): walk every spine item (chapter),
 * grab its rendered HTML document, and pull out block-level text.
 *
 * epubjs's own TypeScript defs claim `Section.load()` returns a `Document`
 * synchronously, but in practice (it has to unzip + parse the chapter's
 * XHTML) it resolves asynchronously — we handle both to be safe.
 */
export async function extractParagraphsFromEpub(buffer: ArrayBuffer): Promise<string[]> {
  const book = ePub(buffer.slice(0));
  await book.ready;

  const paragraphs: string[] = [];
  const sections: Array<{ load: (request: unknown) => unknown; unload: () => void }> = [];
  book.spine.each((section: { load: (request: unknown) => unknown; unload: () => void }) => {
    sections.push(section);
  });

  for (const section of sections) {
    try {
      const result = section.load(book.load.bind(book));
      // epubjs's Section#load resolves to `xml.documentElement` (the <html>
      // root Element), NOT a Document — so there is no `.body` property on
      // it. Elements support querySelector/querySelectorAll too, so we
      // query for the body (or root) directly instead of via `.body`.
      const root = (result instanceof Promise ? await result : result) as Element | undefined;
      const body = root?.querySelector?.('body') ?? root;
      if (body) {
        const blockSelector = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, div';
        const blocks = body.querySelectorAll(blockSelector);
        if (blocks.length > 0) {
          blocks.forEach((el) => {
            const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
            if (text) paragraphs.push(text);
          });
        } else {
          const text = (body.textContent ?? '').replace(/\s+/g, ' ').trim();
          if (text) paragraphs.push(text);
        }
      }
    } catch (err) {
      console.warn('[epub import] section failed to load, skipping', err);
    } finally {
      section.unload();
    }
  }

  book.destroy();
  return paragraphs.length > 0 ? paragraphs : [''];
}
