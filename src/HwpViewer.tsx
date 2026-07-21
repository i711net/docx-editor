import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HwpDocument } from '@rhwp/core';
import './HwpViewer.css';

interface HwpViewerProps {
  doc: HwpDocument;
  fileName: string;
  onBack: () => void;
  onConvertToEditable: () => void;
}

/**
 * Read view for HWP / HWPX files, rendered locally with @rhwp/core (no
 * external server involved — everything runs in this page via WASM).
 *
 * This is intentionally a *viewer*, not a native HWP editor: @rhwp/core's
 * own editing API (`insertText`, `createTable`, ...) is a low-level,
 * position-addressed API meant for programmatic use / building a full
 * editor UI on top of (that's what @rhwp/editor does, by embedding an
 * iframe running the author's hosted "rhwp-studio" app). Wiring up
 * click-to-place-cursor, selection, and a toolbar against that API is a
 * project of its own, so here we offer the practical alternative: view the
 * original layout faithfully, then convert the extracted text into a real,
 * freely-editable document using the same docx editor as everything else.
 */
export function HwpViewer({ doc, fileName, onBack, onConvertToEditable }: HwpViewerProps) {
  const pageCount = useMemo(() => doc.pageCount(), [doc]);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);

  const renderPage = useCallback(
    (index: number) => {
      try {
        setSvg(doc.renderPageSvg(index));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [doc],
  );

  useEffect(() => {
    renderPage(pageIndex);
  }, [pageIndex, renderPage]);

  return (
    <div className="hwp-viewer">
      <div className="hwp-viewer__bar">
        <button type="button" onClick={onBack} className="hwp-viewer__btn">
          ← 返回
        </button>
        <span className="hwp-viewer__filename" title={fileName}>
          {fileName}
        </span>
        <div className="hwp-viewer__spacer" />
        <button
          type="button"
          className="hwp-viewer__btn"
          disabled={pageIndex <= 0}
          onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
        >
          上一页
        </button>
        <span className="hwp-viewer__page-indicator">
          第 {pageIndex + 1} / {pageCount} 页
        </span>
        <button
          type="button"
          className="hwp-viewer__btn"
          disabled={pageIndex >= pageCount - 1}
          onClick={() => setPageIndex((i) => Math.min(pageCount - 1, i + 1))}
        >
          下一页
        </button>
        <button type="button" className="hwp-viewer__btn" onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}>
          －
        </button>
        <span className="hwp-viewer__zoom-indicator">{Math.round(zoom * 100)}%</span>
        <button type="button" className="hwp-viewer__btn" onClick={() => setZoom((z) => Math.min(3, z + 0.1))}>
          ＋
        </button>
        <div className="hwp-viewer__spacer" />
        <button type="button" className="hwp-viewer__btn hwp-viewer__btn--primary" onClick={onConvertToEditable}>
          转换为可编辑文档
        </button>
      </div>

      <p className="hwp-viewer__hint">
        这是 HWP 文件的只读预览（原始排版）。HWP 是韩国专有格式，浏览器里没有成熟的开源方案能像
        Word 那样直接改原文排版——点击右上角"转换为可编辑文档"，把文字内容导入到本站的文档编辑器中继续编辑
        （会丢失原始版式，只保留文字）。
      </p>

      {error && <p className="hwp-viewer__error">页面渲染失败：{error}</p>}

      <div className="hwp-viewer__page-scroll">
        <div
          className="hwp-viewer__page"
          style={{ transform: `scale(${zoom})` }}
          // eslint-disable-next-line react/no-danger -- trusted SVG produced locally by the WASM renderer, not remote content
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}
