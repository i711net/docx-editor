import init, { HwpDocument } from '@rhwp/core';
// Vite bundles the actual .wasm binary as a static asset and gives us its
// final, hashed URL — nothing is fetched from a third-party server.
import rhwpWasmUrl from '@rhwp/core/rhwp_bg.wasm?url';

let initPromise: Promise<void> | null = null;

/**
 * One-time WASM bootstrap for @rhwp/core (Rust/WASM HWP + HWPX parser and
 * renderer, MIT licensed — see https://github.com/edwardkim/rhwp). Runs
 * fully locally; unlike `@rhwp/editor`, this does not load an iframe from
 * any external site.
 */
export function initHwp(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      // The WASM module needs to measure text width to lay out lines the
      // same way the original HWP renderer did (line breaks, justification).
      // It has no access to browser fonts on its own, so it calls back into
      // JS, which uses a <canvas> 2D context — the same trick browsers use
      // internally for text metrics.
      let ctx: CanvasRenderingContext2D | null = null;
      let lastFont = '';
      (globalThis as unknown as { measureTextWidth: (font: string, text: string) => number }).measureTextWidth = (
        font: string,
        text: string,
      ) => {
        if (!ctx) ctx = document.createElement('canvas').getContext('2d');
        if (!ctx) return text.length * 8;
        if (font !== lastFont) {
          ctx.font = font;
          lastFont = font;
        }
        return ctx.measureText(text).width;
      };
      await init({ module_or_path: rhwpWasmUrl });
    })();
  }
  return initPromise;
}

export async function loadHwpDocument(buffer: ArrayBuffer): Promise<InstanceType<typeof HwpDocument>> {
  await initHwp();
  return new HwpDocument(new Uint8Array(buffer));
}

/**
 * Best-effort HWP/HWPX → paragraph-text extraction, for routing an opened
 * .hwp/.hwpx file into the same docx editor used for everything else (so it
 * becomes genuinely, freely editable — see the README for why we don't try
 * to write back to the original HWP binary format by default).
 */
export function extractParagraphsFromHwpDocument(doc: InstanceType<typeof HwpDocument>): string[] {
  const paragraphs: string[] = [];
  const sectionCount = doc.getSectionCount();
  for (let section = 0; section < sectionCount; section++) {
    const paraCount = doc.getParagraphCount(section);
    for (let para = 0; para < paraCount; para++) {
      const length = doc.getParagraphLength(section, para);
      const text = length > 0 ? doc.getTextRange(section, para, 0, length) : '';
      paragraphs.push(text);
    }
  }
  return paragraphs.length > 0 ? paragraphs : [''];
}
