import { useCallback, useState } from 'react';
import { ReactReader } from 'react-reader';
import './EpubViewer.css';

interface EpubViewerProps {
  buffer: ArrayBuffer;
  fileName: string;
  onBack: () => void;
  onConvertToEditable: () => void;
  converting: boolean;
}

/**
 * EPUB reading view, built on react-reader / epub.js (BSD-2-Clause /
 * ISC — see README). Runs entirely locally: the ArrayBuffer is handed
 * straight to epub.js, nothing is uploaded anywhere.
 */
export function EpubViewer({ buffer, fileName, onBack, onConvertToEditable, converting }: EpubViewerProps) {
  const [location, setLocation] = useState<string | number>(0);

  const handleLocationChanged = useCallback((epubcfi: string) => {
    setLocation(epubcfi);
  }, []);

  return (
    <div className="epub-viewer">
      <div className="epub-viewer__bar">
        <button type="button" onClick={onBack} className="epub-viewer__btn">
          ← 返回
        </button>
        <span className="epub-viewer__filename" title={fileName}>
          {fileName}
        </span>
        <div className="epub-viewer__spacer" />
        <button
          type="button"
          className="epub-viewer__btn epub-viewer__btn--primary"
          onClick={onConvertToEditable}
          disabled={converting}
        >
          {converting ? '正在提取文字…' : '转换为可编辑文档'}
        </button>
      </div>
      <p className="epub-viewer__hint">
        点击左侧目录图标查看章节目录；"转换为可编辑文档"会把全书文字提取出来导入编辑器（不保留原始排版/字体/图片）。
      </p>
      <div className="epub-viewer__reader">
        <ReactReader
          url={buffer}
          location={location}
          locationChanged={handleLocationChanged}
          showToc
        />
      </div>
    </div>
  );
}
