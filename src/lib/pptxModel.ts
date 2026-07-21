// Shared slide data model for the basic PPT editor. This is our own simple
// representation (not OOXML) — pptxImport.ts converts real .pptx files into
// this shape, and pptxExport.ts converts it back into real .pptx bytes via
// pptxgenjs. Positions/sizes are all in "slide px" at 72px/inch, matching a
// 13.333in x 7.5in (960x540px) widescreen slide — the same aspect ratio
// PowerPoint uses by default for new presentations.

export const SLIDE_WIDTH_PX = 960;
export const SLIDE_HEIGHT_PX = 540;
export const PX_PER_INCH = 72;

export type SlideElementType = 'text' | 'image' | 'shape';
export type ShapeKind = 'rect' | 'ellipse';

export interface BaseSlideElement {
  id: string;
  type: SlideElementType;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextSlideElement extends BaseSlideElement {
  type: 'text';
  text: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: 'left' | 'center' | 'right';
  fontFace: string;
}

export interface ImageSlideElement extends BaseSlideElement {
  type: 'image';
  src: string; // data URL
}

export interface ShapeSlideElement extends BaseSlideElement {
  type: 'shape';
  shapeKind: ShapeKind;
  fill: string;
}

export type SlideElement = TextSlideElement | ImageSlideElement | ShapeSlideElement;

export interface Slide {
  id: string;
  background: string;
  elements: SlideElement[];
}

export interface Presentation {
  slides: Slide[];
}

function genId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createBlankSlide(): Slide {
  return {
    id: genId(),
    background: '#FFFFFF',
    elements: [
      {
        id: genId(),
        type: 'text',
        x: 80,
        y: 200,
        width: 800,
        height: 100,
        text: '单击此处添加标题',
        fontSize: 36,
        color: '#1A1A1A',
        bold: true,
        italic: false,
        underline: false,
        align: 'center',
        fontFace: 'Arial',
      },
    ],
  };
}

export function createBlankPresentation(): Presentation {
  return { slides: [createBlankSlide()] };
}

export function createTextElement(overrides: Partial<TextSlideElement> = {}): TextSlideElement {
  return {
    id: genId(),
    type: 'text',
    x: 120,
    y: 240,
    width: 400,
    height: 80,
    text: '文本框',
    fontSize: 18,
    color: '#1A1A1A',
    bold: false,
    italic: false,
    underline: false,
    align: 'left',
    fontFace: 'Arial',
    ...overrides,
  };
}

export function createShapeElement(shapeKind: ShapeKind, overrides: Partial<ShapeSlideElement> = {}): ShapeSlideElement {
  return {
    id: genId(),
    type: 'shape',
    x: 300,
    y: 180,
    width: 240,
    height: 160,
    shapeKind,
    fill: '#2563EB',
    ...overrides,
  };
}

export function createImageElement(src: string, overrides: Partial<ImageSlideElement> = {}): ImageSlideElement {
  return {
    id: genId(),
    type: 'image',
    x: 200,
    y: 120,
    width: 400,
    height: 300,
    src,
    ...overrides,
  };
}

export { genId };
