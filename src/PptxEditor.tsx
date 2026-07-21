import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import {
  PPTX_THEMES,
  SLIDE_HEIGHT_PX,
  SLIDE_WIDTH_PX,
  createBlankSlide,
  createImageElement,
  createShapeElement,
  createTableElement,
  createTextElement,
  type AnimationType,
  type Presentation,
  type PptxTheme,
  type Slide,
  type SlideElement,
  type TableSlideElement,
  type TextSlideElement,
  type TransitionType,
} from './lib/pptxModel';
import { exportPresentationToPptx } from './lib/pptxExport';
import { importPresentationFromPptx } from './lib/pptxImport';
import { PptxPresentMode } from './PptxPresentMode';
import { clearDraft, debounce, loadDraft, saveDraft, type DraftEnvelope } from './lib/autosave';
import { DraftBanner } from './DraftBanner';
import './PptxEditor.css';

interface PptxEditorProps {
  initialPresentation: Presentation;
  /** If set, imported automatically on mount (see XlsxEditor for why this
   * indirection exists — the import needs a live component to set state on). */
  pendingImportFile?: File | null;
  documentName: string;
  onDocumentNameChange: (name: string) => void;
  onBack: () => void;
}

const THEME_COLORS = ['#FFFFFF', '#F5F5F0', '#0F172A', '#1E3A8A', '#166534', '#7C2D12', '#4C1D95'];
const SHAPE_COLORS = ['#2563EB', '#DC2626', '#16A34A', '#D97706', '#7C3AED', '#111827'];
const ANIMATION_OPTIONS: { value: AnimationType; label: string }[] = [
  { value: 'none', label: '无动画' },
  { value: 'fadeIn', label: '淡入' },
  { value: 'flyInLeft', label: '左侧飞入' },
  { value: 'flyInRight', label: '右侧飞入' },
  { value: 'zoomIn', label: '缩放进入' },
];
const TRANSITION_OPTIONS: { value: TransitionType; label: string }[] = [
  { value: 'none', label: '无切换效果' },
  { value: 'fade', label: '淡入淡出' },
  { value: 'push', label: '推入' },
  { value: 'wipe', label: '擦除' },
  { value: 'dissolve', label: '溶解' },
];

const AUTOSAVE_KIND = 'pptx';

export function PptxEditor({
  initialPresentation,
  pendingImportFile,
  documentName,
  onDocumentNameChange,
  onBack,
}: PptxEditorProps) {
  const [presentation, setPresentation] = useState<Presentation>(initialPresentation);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState(documentName);
  const [busy, setBusy] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [presenting, setPresenting] = useState(false);
  const [lastTheme, setLastTheme] = useState<PptxTheme | null>(null);
  const [draft, setDraft] = useState<DraftEnvelope<{ presentation: Presentation }> | null>(null);

  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      setScale(w > 0 ? Math.min(w / SLIDE_WIDTH_PX, 1.4) : 1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const debouncedAutosave = useMemo(
    () => debounce((value: Presentation, fileName: string) => void saveDraft(AUTOSAVE_KIND, { presentation: value }, fileName), 1500),
    [],
  );

  useEffect(() => {
    if (pendingImportFile) return;
    void loadDraft<{ presentation: Presentation }>(AUTOSAVE_KIND).then(setDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    debouncedAutosave(presentation, nameDraft);
  }, [presentation, nameDraft, debouncedAutosave]);

  const activeSlide: Slide | undefined = presentation.slides[activeIndex];

  const updateActiveSlide = useCallback(
    (updater: (slide: Slide) => Slide) => {
      setPresentation((prev) => ({
        ...prev,
        slides: prev.slides.map((s, i) => (i === activeIndex ? updater(s) : s)),
      }));
    },
    [activeIndex],
  );

  const updateElement = useCallback(
    (id: string, patch: Partial<SlideElement>) => {
      updateActiveSlide((slide) => ({
        ...slide,
        elements: slide.elements.map((el) => (el.id === id ? ({ ...el, ...patch } as SlideElement) : el)),
      }));
    },
    [updateActiveSlide],
  );

  const selectedElement = useMemo(
    () => activeSlide?.elements.find((el) => el.id === selectedId) ?? null,
    [activeSlide, selectedId],
  );

  const addElement = useCallback(
    (el: SlideElement) => {
      updateActiveSlide((slide) => {
        // Newly inserted elements all start from the same default position,
        // which otherwise stacks every new text box/shape/image exactly on
        // top of the last one — cascade each new addition by a small offset
        // per existing element so they land visibly staggered instead, the
        // same "new item lands slightly offset" convention PowerPoint itself
        // uses.
        const cascade = (slide.elements.length % 8) * 24;
        const placed: SlideElement = {
          ...el,
          x: Math.min(el.x + cascade, SLIDE_WIDTH_PX - el.width - 10),
          y: Math.min(el.y + cascade, SLIDE_HEIGHT_PX - el.height - 10),
        } as SlideElement;
        return { ...slide, elements: [...slide.elements, placed] };
      });
      setSelectedId(el.id);
    },
    [updateActiveSlide],
  );

  const handleAddText = useCallback(
    () => addElement(createTextElement(lastTheme ? { color: lastTheme.bodyColor } : {})),
    [addElement, lastTheme],
  );
  const handleAddShape = useCallback(
    (kind: 'rect' | 'ellipse') => addElement(createShapeElement(kind)),
    [addElement],
  );
  const handleAddTable = useCallback(() => addElement(createTableElement(3, 3)), [addElement]);

  const handleAddImageFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const maxW = 480;
          const w = Math.min(img.naturalWidth, maxW);
          const h = (img.naturalHeight / img.naturalWidth) * w || 300;
          addElement(createImageElement(dataUrl, { width: w, height: h }));
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [addElement],
  );

  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return;
    updateActiveSlide((slide) => ({ ...slide, elements: slide.elements.filter((el) => el.id !== selectedId) }));
    setSelectedId(null);
    setEditingId(null);
    setEditingCell(null);
  }, [selectedId, updateActiveSlide]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedId || editingId || editingCell) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        handleDeleteSelected();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, editingId, editingCell, handleDeleteSelected]);

  const handleAddSlide = useCallback(() => {
    setPresentation((prev) => {
      const slides = [...prev.slides];
      slides.splice(activeIndex + 1, 0, createBlankSlide());
      return { ...prev, slides };
    });
    setActiveIndex((i) => i + 1);
    setSelectedId(null);
  }, [activeIndex]);

  const handleDeleteSlide = useCallback(
    (index: number) => {
      setPresentation((prev) => {
        if (prev.slides.length <= 1) return prev;
        const slides = prev.slides.filter((_, i) => i !== index);
        return { ...prev, slides };
      });
      setActiveIndex((i) => Math.max(0, Math.min(i, presentation.slides.length - 2)));
      setSelectedId(null);
    },
    [presentation.slides.length],
  );

  const handleMoveSlide = useCallback((index: number, dir: -1 | 1) => {
    setPresentation((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.slides.length) return prev;
      const slides = [...prev.slides];
      [slides[index], slides[target]] = [slides[target], slides[index]];
      return { ...prev, slides };
    });
    setActiveIndex((i) => (i === index ? index + dir : i === index + dir ? index : i));
  }, []);

  const handleSetBackground = useCallback(
    (color: string) => {
      updateActiveSlide((slide) => ({ ...slide, background: color }));
    },
    [updateActiveSlide],
  );

  const handleSetTransition = useCallback(
    (transition: TransitionType) => {
      updateActiveSlide((slide) => ({ ...slide, transition }));
    },
    [updateActiveSlide],
  );

  const handleApplyTheme = useCallback((theme: PptxTheme) => {
    // A "theme" here only sets every slide's background plus the default
    // color new text boxes get from now on — it deliberately never touches
    // colors already set on existing text, so applying one can't silently
    // undo formatting the user did by hand.
    setPresentation((prev) => ({
      ...prev,
      slides: prev.slides.map((s) => ({ ...s, background: theme.background })),
    }));
    setLastTheme(theme);
  }, []);

  const handleSave = useCallback(async () => {
    setBusy('正在生成 .pptx 文件…');
    try {
      const buffer = await exportPresentationToPptx(presentation);
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
      const filename = nameDraft.trim().endsWith('.pptx') ? nameDraft.trim() : `${nameDraft.trim() || '未命名演示文稿'}.pptx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      // Cancel first — a keystroke-triggered autosave could already be
      // queued and would otherwise fire moments later and re-write the
      // draft we're about to clear.
      debouncedAutosave.cancel();
      void clearDraft(AUTOSAVE_KIND);
    } catch (err) {
      console.error(err);
      window.alert(`保存失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  }, [presentation, nameDraft, debouncedAutosave]);

  const handleImportPptx = useCallback(
    async (file: File) => {
      setBusy('正在解析 PPTX 文件…');
      try {
        const buffer = await file.arrayBuffer();
        const imported = await importPresentationFromPptx(buffer);
        setPresentation(imported);
        setActiveIndex(0);
        setSelectedId(null);
        const base = file.name.replace(/\.pptx$/i, '');
        setNameDraft(base + '.pptx');
        onDocumentNameChange(base + '.pptx');
      } catch (err) {
        console.error(err);
        window.alert(`导入失败：${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setBusy(null);
      }
    },
    [onDocumentNameChange],
  );

  useEffect(() => {
    // Same one-shot-on-mount pattern as XlsxEditor: the parent remounts this
    // component (via `key`) whenever a different pending file should be
    // imported, so it's safe to only look at the prop once here.
    if (pendingImportFile) void handleImportPptx(pendingImportFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patchSelectedText = useCallback(
    (patch: Partial<TextSlideElement>) => {
      if (!selectedId || selectedElement?.type !== 'text') return;
      updateElement(selectedId, patch);
    },
    [selectedId, selectedElement, updateElement],
  );

  const updateTableCell = useCallback(
    (elId: string, r: number, c: number, value: string) => {
      updateActiveSlide((slide) => ({
        ...slide,
        elements: slide.elements.map((el) => {
          if (el.id !== elId || el.type !== 'table') return el;
          const cells = el.cells.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? value : cell)) : row));
          return { ...el, cells };
        }),
      }));
    },
    [updateActiveSlide],
  );

  const patchSelectedTable = useCallback(
    (patch: Partial<TableSlideElement>) => {
      if (!selectedId || selectedElement?.type !== 'table') return;
      updateElement(selectedId, patch);
    },
    [selectedId, selectedElement, updateElement],
  );

  const addTableRow = useCallback(() => {
    if (selectedElement?.type !== 'table') return;
    patchSelectedTable({
      rows: selectedElement.rows + 1,
      cells: [...selectedElement.cells, Array.from({ length: selectedElement.cols }, () => '')],
    });
  }, [selectedElement, patchSelectedTable]);

  const removeTableRow = useCallback(() => {
    if (selectedElement?.type !== 'table' || selectedElement.rows <= 1) return;
    patchSelectedTable({ rows: selectedElement.rows - 1, cells: selectedElement.cells.slice(0, -1) });
  }, [selectedElement, patchSelectedTable]);

  const addTableCol = useCallback(() => {
    if (selectedElement?.type !== 'table') return;
    patchSelectedTable({
      cols: selectedElement.cols + 1,
      cells: selectedElement.cells.map((row) => [...row, '']),
    });
  }, [selectedElement, patchSelectedTable]);

  const removeTableCol = useCallback(() => {
    if (selectedElement?.type !== 'table' || selectedElement.cols <= 1) return;
    patchSelectedTable({ cols: selectedElement.cols - 1, cells: selectedElement.cells.map((row) => row.slice(0, -1)) });
  }, [selectedElement, patchSelectedTable]);

  return (
    <div className="pptx-editor">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) handleAddImageFile(file);
        }}
      />
      <input
        ref={importInputRef}
        type="file"
        accept=".pptx"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleImportPptx(file);
        }}
      />
      {draft && (
        <DraftBanner
          savedAt={draft.savedAt}
          documentName={draft.documentName}
          onRestore={() => {
            setPresentation(draft.payload.presentation);
            setActiveIndex(0);
            setSelectedId(null);
            if (draft.documentName) {
              setNameDraft(draft.documentName);
              onDocumentNameChange(draft.documentName);
            }
            setDraft(null);
          }}
          onDiscard={() => {
            void clearDraft(AUTOSAVE_KIND);
            setDraft(null);
          }}
        />
      )}
      <div className="pptx-editor__bar">
        <button type="button" className="pptx-editor__btn" onClick={onBack}>
          ← 返回
        </button>
        <input
          className="pptx-editor__name-input"
          value={nameDraft}
          onChange={(e) => {
            setNameDraft(e.target.value);
            onDocumentNameChange(e.target.value);
          }}
        />
        <span className="pptx-editor__divider" />
        <button type="button" className="pptx-editor__btn" onClick={handleAddText}>
          插入文本框
        </button>
        <button type="button" className="pptx-editor__btn" onClick={() => imageInputRef.current?.click()}>
          插入图片
        </button>
        <button type="button" className="pptx-editor__btn" onClick={() => handleAddShape('rect')}>
          插入矩形
        </button>
        <button type="button" className="pptx-editor__btn" onClick={() => handleAddShape('ellipse')}>
          插入椭圆
        </button>
        <button type="button" className="pptx-editor__btn" onClick={handleAddTable}>
          插入表格
        </button>
        {selectedElement?.type === 'shape' && (
          <div className="pptx-editor__swatches">
            {SHAPE_COLORS.map((c) => (
              <button
                key={c}
                className="pptx-editor__swatch"
                style={{ background: c }}
                onClick={() => updateElement(selectedElement.id, { fill: c })}
                title={c}
              />
            ))}
          </div>
        )}
        {selectedElement?.type === 'text' && (
          <>
            <span className="pptx-editor__divider" />
            <button
              type="button"
              className={`pptx-editor__btn ${selectedElement.bold ? 'pptx-editor__btn--active' : ''}`}
              onClick={() => patchSelectedText({ bold: !selectedElement.bold })}
            >
              <b>B</b>
            </button>
            <button
              type="button"
              className={`pptx-editor__btn ${selectedElement.italic ? 'pptx-editor__btn--active' : ''}`}
              onClick={() => patchSelectedText({ italic: !selectedElement.italic })}
            >
              <i>I</i>
            </button>
            <button
              type="button"
              className={`pptx-editor__btn ${selectedElement.underline ? 'pptx-editor__btn--active' : ''}`}
              onClick={() => patchSelectedText({ underline: !selectedElement.underline })}
            >
              <u>U</u>
            </button>
            <select
              className="pptx-editor__select"
              value={selectedElement.fontSize}
              onChange={(e) => patchSelectedText({ fontSize: Number(e.target.value) })}
            >
              {[12, 14, 16, 18, 20, 24, 28, 32, 36, 44, 54, 66].map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
            <input
              type="color"
              className="pptx-editor__color-input"
              value={selectedElement.color}
              onChange={(e) => patchSelectedText({ color: e.target.value })}
              title="文字颜色"
            />
            <select
              className="pptx-editor__select"
              value={selectedElement.align}
              onChange={(e) => patchSelectedText({ align: e.target.value as 'left' | 'center' | 'right' })}
            >
              <option value="left">左对齐</option>
              <option value="center">居中</option>
              <option value="right">右对齐</option>
            </select>
          </>
        )}
        {selectedElement?.type === 'table' && (
          <>
            <span className="pptx-editor__divider" />
            <button type="button" className="pptx-editor__btn" onClick={addTableRow}>
              ＋行
            </button>
            <button type="button" className="pptx-editor__btn" onClick={removeTableRow}>
              －行
            </button>
            <button type="button" className="pptx-editor__btn" onClick={addTableCol}>
              ＋列
            </button>
            <button type="button" className="pptx-editor__btn" onClick={removeTableCol}>
              －列
            </button>
          </>
        )}
        {selectedElement && (
          <>
            <span className="pptx-editor__divider" />
            <select
              className="pptx-editor__select"
              value={selectedElement.animation ?? 'none'}
              onChange={(e) => updateElement(selectedElement.id, { animation: e.target.value as AnimationType })}
              title="播放时该元素的进入动画（仅在本应用的“播放”预览中生效，不会写入导出的 .pptx）"
            >
              {ANIMATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  动画：{opt.label}
                </option>
              ))}
            </select>
          </>
        )}
        <span className="pptx-editor__spacer" />
        {selectedId && (
          <button type="button" className="pptx-editor__btn" onClick={handleDeleteSelected}>
            删除所选
          </button>
        )}
        <button type="button" className="pptx-editor__btn" onClick={() => importInputRef.current?.click()}>
          打开 PPTX
        </button>
        <button type="button" className="pptx-editor__btn" onClick={() => setPresenting(true)}>
          ▶ 播放
        </button>
        <button type="button" className="pptx-editor__btn pptx-editor__btn--primary" onClick={() => void handleSave()}>
          保存为 .pptx
        </button>
      </div>

      <div className="pptx-editor__body">
        <div className="pptx-editor__sidebar">
          {presentation.slides.map((slide, index) => (
            <div
              key={slide.id}
              className={`pptx-editor__thumb ${index === activeIndex ? 'pptx-editor__thumb--active' : ''}`}
              onClick={() => {
                setActiveIndex(index);
                setSelectedId(null);
              }}
            >
              <div className="pptx-editor__thumb-index">{index + 1}</div>
              <div className="pptx-editor__thumb-preview" style={{ background: slide.background }}>
                {slide.elements.map((el) => (
                  <div
                    key={el.id}
                    className="pptx-editor__thumb-el"
                    style={{
                      left: `${(el.x / SLIDE_WIDTH_PX) * 100}%`,
                      top: `${(el.y / SLIDE_HEIGHT_PX) * 100}%`,
                      width: `${(el.width / SLIDE_WIDTH_PX) * 100}%`,
                      height: `${(el.height / SLIDE_HEIGHT_PX) * 100}%`,
                      background: el.type === 'shape' ? el.fill : el.type === 'text' ? 'transparent' : '#ccc',
                      border: el.type === 'text' ? '1px solid #99999955' : 'none',
                    }}
                  />
                ))}
              </div>
              <div className="pptx-editor__thumb-actions">
                <button onClick={(e) => { e.stopPropagation(); handleMoveSlide(index, -1); }} title="上移">↑</button>
                <button onClick={(e) => { e.stopPropagation(); handleMoveSlide(index, 1); }} title="下移">↓</button>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteSlide(index); }} title="删除">✕</button>
              </div>
            </div>
          ))}
          <button type="button" className="pptx-editor__add-slide" onClick={handleAddSlide}>
            ＋ 新建幻灯片
          </button>
        </div>

        <div className="pptx-editor__canvas-area">
          <div className="pptx-editor__swatches pptx-editor__bg-swatches">
            <span>主题：</span>
            {PPTX_THEMES.map((theme) => (
              <button
                key={theme.id}
                className="pptx-editor__theme-swatch"
                style={{ background: theme.background, color: theme.titleColor, borderColor: theme.titleColor }}
                onClick={() => handleApplyTheme(theme)}
                title={`${theme.name}（应用到全部幻灯片）`}
              >
                {theme.name}
              </button>
            ))}
          </div>
          <div className="pptx-editor__swatches pptx-editor__bg-swatches">
            <span>背景：</span>
            {THEME_COLORS.map((c) => (
              <button
                key={c}
                className="pptx-editor__swatch"
                style={{ background: c, borderColor: c === '#FFFFFF' ? '#ccc' : c }}
                onClick={() => handleSetBackground(c)}
                title={c}
              />
            ))}
            <span className="pptx-editor__divider" />
            <span>切换效果：</span>
            <select
              className="pptx-editor__select"
              value={activeSlide?.transition ?? 'none'}
              onChange={(e) => handleSetTransition(e.target.value as TransitionType)}
              title="翻到这一页时的过渡效果（仅在本应用的“播放”预览中生效，不会写入导出的 .pptx）"
            >
              {TRANSITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="pptx-editor__canvas-wrap" ref={canvasWrapRef}>
            <div
              className="pptx-editor__canvas"
              style={{
                width: SLIDE_WIDTH_PX,
                height: SLIDE_HEIGHT_PX,
                background: activeSlide?.background ?? '#fff',
                transform: `scale(${scale})`,
              }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  setSelectedId(null);
                  setEditingId(null);
                  setEditingCell(null);
                }
              }}
            >
              {activeSlide?.elements.map((el) => {
                const isEditingThisTable = el.type === 'table' && editingCell?.startsWith(`${el.id}:`);
                return (
                <Rnd
                  key={el.id}
                  size={{ width: el.width, height: el.height }}
                  position={{ x: el.x, y: el.y }}
                  scale={scale}
                  disableDragging={editingId === el.id || isEditingThisTable}
                  enableResizing={editingId !== el.id && !isEditingThisTable}
                  onDragStop={(_e, d) => updateElement(el.id, { x: d.x, y: d.y })}
                  onResizeStop={(_e, _dir, ref, _delta, pos) =>
                    updateElement(el.id, {
                      width: ref.offsetWidth,
                      height: ref.offsetHeight,
                      x: pos.x,
                      y: pos.y,
                    })
                  }
                  bounds="parent"
                  className={`pptx-editor__element ${selectedId === el.id ? 'pptx-editor__element--selected' : ''}`}
                  onMouseDown={(e: MouseEvent) => {
                    e.stopPropagation();
                    setSelectedId(el.id);
                  }}
                >
                  {el.type === 'text' && (
                    <div
                      className="pptx-editor__text-el"
                      contentEditable={editingId === el.id}
                      suppressContentEditableWarning
                      ref={(node) => {
                        // Entering edit mode only flips the `contentEditable`
                        // attribute — the browser doesn't automatically move
                        // focus into it, so without this the user's first
                        // keystrokes would go nowhere. Seed the node's text
                        // imperatively (see the `children` below for why),
                        // focus it, and select all so typing immediately
                        // replaces the placeholder.
                        if (node && editingId === el.id && document.activeElement !== node) {
                          node.textContent = el.text;
                          node.focus();
                          const range = document.createRange();
                          range.selectNodeContents(node);
                          const sel = window.getSelection();
                          sel?.removeAllRanges();
                          sel?.addRange(range);
                        }
                      }}
                      style={{
                        fontSize: el.fontSize,
                        color: el.color,
                        fontWeight: el.bold ? 700 : 400,
                        fontStyle: el.italic ? 'italic' : 'normal',
                        textDecoration: el.underline ? 'underline' : 'none',
                        textAlign: el.align,
                        fontFamily: el.fontFace,
                      }}
                      onDoubleClick={() => setEditingId(el.id)}
                      // Commit on every keystroke (`onInput`) rather than
                      // only on blur — relying solely on blur turned out to
                      // be fragile: whether it fires, and in what order
                      // relative to the click that ends editing, depends on
                      // focus-management details we don't fully control here
                      // (react-rnd's own mousedown handling, which element
                      // the "click away" lands on, etc). `input` fires
                      // synchronously for every real text change, so this
                      // can't lose the last keystroke the way blur-only did.
                      onInput={(e) => {
                        updateElement(el.id, { text: e.currentTarget.textContent ?? '' });
                      }}
                      onBlur={() => setEditingId(null)}
                    >
                      {/* While editing, the DOM's own live text (seeded once by
                          the ref callback above) is the source of truth — if we
                          also bind `el.text` as children here, React re-renders
                          triggered by onInput's state update fight the browser
                          over cursor position (each keystroke gets applied at
                          the start instead of where the caret is, scrambling
                          typed text). Only bind children in display mode. */}
                      {editingId === el.id ? undefined : el.text}
                    </div>
                  )}
                  {el.type === 'image' && <img src={el.src} alt="" className="pptx-editor__image-el" draggable={false} />}
                  {el.type === 'shape' && (
                    <div
                      className="pptx-editor__shape-el"
                      style={{
                        background: el.fill,
                        borderRadius: el.shapeKind === 'ellipse' ? '50%' : 0,
                      }}
                    />
                  )}
                  {el.type === 'table' && (
                    <table className="pptx-editor__table-el" style={{ fontSize: el.fontSize }}>
                      <tbody>
                        {el.cells.map((row, r) => (
                          <tr key={r}>
                            {row.map((cellText, c) => {
                              const cellKey = `${el.id}:${r}:${c}`;
                              const isEditingCell = editingCell === cellKey;
                              return (
                                <td
                                  key={c}
                                  contentEditable={isEditingCell}
                                  suppressContentEditableWarning
                                  ref={(node) => {
                                    // Same fix as the text-box editor above:
                                    // seed + focus imperatively on entering
                                    // edit mode, and only bind `children`
                                    // while NOT editing (see below) so React
                                    // doesn't fight the caret position on
                                    // every keystroke.
                                    if (node && isEditingCell && document.activeElement !== node) {
                                      node.textContent = cellText;
                                      node.focus();
                                      const range = document.createRange();
                                      range.selectNodeContents(node);
                                      const sel = window.getSelection();
                                      sel?.removeAllRanges();
                                      sel?.addRange(range);
                                    }
                                  }}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCell(cellKey);
                                  }}
                                  onMouseDown={(e) => {
                                    if (isEditingCell) e.stopPropagation();
                                  }}
                                  onInput={(e) => {
                                    updateTableCell(el.id, r, c, e.currentTarget.textContent ?? '');
                                  }}
                                  onBlur={() => setEditingCell(null)}
                                >
                                  {isEditingCell ? undefined : cellText}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Rnd>
              );})}
            </div>
          </div>
        </div>
      </div>

      {busy && (
        <div className="busy-overlay">
          <div className="busy-overlay__box">{busy}</div>
        </div>
      )}
      {presenting && activeSlide && (
        <PptxPresentMode presentation={presentation} startIndex={activeIndex} onExit={() => setPresenting(false)} />
      )}
    </div>
  );
}
