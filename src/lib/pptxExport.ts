import PptxGenJS from 'pptxgenjs';
import {
  PX_PER_INCH,
  SLIDE_HEIGHT_PX,
  SLIDE_WIDTH_PX,
  type Presentation,
} from './pptxModel';

const px = (v: number) => v / PX_PER_INCH;

/** Convert our in-memory slide model into a real .pptx file (ArrayBuffer). */
export async function exportPresentationToPptx(presentation: Presentation): Promise<ArrayBuffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'CUSTOM_WIDESCREEN', width: px(SLIDE_WIDTH_PX), height: px(SLIDE_HEIGHT_PX) });
  pptx.layout = 'CUSTOM_WIDESCREEN';

  for (const slide of presentation.slides) {
    const s = pptx.addSlide();
    if (slide.background && slide.background.toUpperCase() !== '#FFFFFF') {
      s.background = { color: slide.background.replace('#', '') };
    }
    for (const el of slide.elements) {
      const pos = { x: px(el.x), y: px(el.y), w: px(el.width), h: px(el.height) };
      if (el.type === 'text') {
        s.addText(el.text, {
          ...pos,
          fontSize: el.fontSize,
          color: el.color.replace('#', ''),
          bold: el.bold,
          italic: el.italic,
          underline: el.underline ? { style: 'sng' } : undefined,
          align: el.align,
          fontFace: el.fontFace,
          valign: 'top',
          wrap: true,
        });
      } else if (el.type === 'image') {
        s.addImage({ ...pos, data: el.src });
      } else if (el.type === 'shape') {
        s.addShape(el.shapeKind === 'ellipse' ? pptx.ShapeType.ellipse : pptx.ShapeType.rect, {
          ...pos,
          fill: { color: el.fill.replace('#', '') },
        });
      } else if (el.type === 'table') {
        const rows = el.cells.map((row) =>
          row.map((text) => ({ text, options: { fontSize: el.fontSize } })),
        );
        s.addTable(rows, {
          ...pos,
          fontSize: el.fontSize,
          border: { type: 'solid', color: 'CCCCCC', pt: 1 },
          autoPage: false,
        });
      }
    }
  }

  const result = await pptx.write({ outputType: 'arraybuffer' });
  return result as ArrayBuffer;
}
