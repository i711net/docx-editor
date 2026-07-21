// Shared slide data model for the basic PPT editor. This is our own simple
// representation (not OOXML) — pptxImport.ts converts real .pptx files into
// this shape, and pptxExport.ts converts it back into real .pptx bytes via
// pptxgenjs. Positions/sizes are all in "slide px" at 72px/inch, matching a
// 13.333in x 7.5in (960x540px) widescreen slide — the same aspect ratio
// PowerPoint uses by default for new presentations.

export const SLIDE_WIDTH_PX = 960;
export const SLIDE_HEIGHT_PX = 540;
export const PX_PER_INCH = 72;

export type SlideElementType = 'text' | 'image' | 'shape' | 'table';
export type ShapeKind = 'rect' | 'ellipse';

/**
 * Entrance animation applied to an element in "播放" (present) mode. This is
 * a preview-only feature: real PowerPoint animation timing lives in a very
 * deep, mostly-undocumented part of OOXML (`<p:timing>`), and pptxgenjs (our
 * export library) doesn't write it — so an animated element still exports
 * fine into the real .pptx, it just appears immediately/statically if
 * opened in actual PowerPoint/WPS, rather than replaying the animation. The
 * `order` an element animates in during present mode is simply its position
 * within `slide.elements` among the other animated elements on that slide.
 */
export type AnimationType = 'none' | 'fadeIn' | 'flyInLeft' | 'flyInRight' | 'zoomIn';

export interface BaseSlideElement {
  id: string;
  type: SlideElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  animation?: AnimationType;
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

export interface TableSlideElement extends BaseSlideElement {
  type: 'table';
  rows: number;
  cols: number;
  cells: string[][];
  fontSize: number;
}

export type SlideElement = TextSlideElement | ImageSlideElement | ShapeSlideElement | TableSlideElement;

/**
 * Slide-level transition — like element animation above, this only drives
 * our own "播放" present-mode preview (a CSS animation played when this
 * slide becomes active), not the exported .pptx's native transition XML
 * (`<p:transition>`), which pptxgenjs has no API for writing. Describes how
 * *this* slide enters when moving forward from the previous one, matching
 * PowerPoint's own convention.
 */
export type TransitionType = 'none' | 'fade' | 'push' | 'wipe' | 'dissolve';

export interface Slide {
  id: string;
  background: string;
  elements: SlideElement[];
  transition?: TransitionType;
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

export function createTableElement(
  rows = 3,
  cols = 3,
  overrides: Partial<TableSlideElement> = {},
): TableSlideElement {
  return {
    id: genId(),
    type: 'table',
    x: 160,
    y: 160,
    width: 500,
    height: 200,
    rows,
    cols,
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')),
    fontSize: 14,
    ...overrides,
  };
}

/**
 * Preset "主题" bundles — a bit like PowerPoint's design themes, scoped down
 * to what a basic-tier editor can meaningfully offer: a slide background plus
 * a default title/body color pair. Applying one sets every slide's
 * background at once and becomes the default color for new text boxes going
 * forward; it deliberately does NOT touch colors already set on existing
 * text (surprising the user by silently recoloring their manual edits would
 * be worse than leaving old text alone).
 */
export interface PptxTheme {
  id: string;
  name: string;
  background: string;
  titleColor: string;
  bodyColor: string;
}

export const PPTX_THEMES: PptxTheme[] = [
  { id: 'classic', name: '经典蓝', background: '#FFFFFF', titleColor: '#1F4E79', bodyColor: '#333333' },
  { id: 'dark', name: '深色', background: '#1F2937', titleColor: '#FFFFFF', bodyColor: '#E5E7EB' },
  { id: 'warm', name: '暖橙', background: '#FFF7ED', titleColor: '#9A3412', bodyColor: '#431407' },
  { id: 'green', name: '清新绿', background: '#F0FDF4', titleColor: '#14532D', bodyColor: '#166534' },
];

export { genId };
