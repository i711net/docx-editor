import { useState } from 'react';
import './ImageViewer.css';

interface ImageViewerProps {
  dataUrl: string;
  fileName: string;
  onBack: () => void;
  onInsertIntoDocument: () => void;
}

/** Simple local image viewer (zoom in/out) with an "insert into a document" action. */
export function ImageViewer({ dataUrl, fileName, onBack, onInsertIntoDocument }: ImageViewerProps) {
  const [zoom, setZoom] = useState(1);

  return (
    <div className="image-viewer">
      <div className="image-viewer__bar">
        <button type="button" onClick={onBack} className="image-viewer__btn">
          ← 返回
        </button>
        <span className="image-viewer__filename" title={fileName}>
          {fileName}
        </span>
        <div className="image-viewer__spacer" />
        <button type="button" className="image-viewer__btn" onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))}>
          －
        </button>
        <span className="image-viewer__zoom-indicator">{Math.round(zoom * 100)}%</span>
        <button type="button" className="image-viewer__btn" onClick={() => setZoom((z) => Math.min(5, z + 0.1))}>
          ＋
        </button>
        <button type="button" className="image-viewer__btn" onClick={() => setZoom(1)}>
          重置
        </button>
        <div className="image-viewer__spacer" />
        <button type="button" className="image-viewer__btn image-viewer__btn--primary" onClick={onInsertIntoDocument}>
          插入到新文档
        </button>
      </div>
      <div className="image-viewer__scroll">
        <img src={dataUrl} alt={fileName} className="image-viewer__img" style={{ transform: `scale(${zoom})` }} />
      </div>
    </div>
  );
}
