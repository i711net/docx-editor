import { useCallback, useRef, useState } from 'react';
import {
  DocxEditor,
  createEmptyDocument,
  type DocxEditorRef,
} from '@eigenpal/docx-editor-react';
import type { Document } from '@eigenpal/docx-editor-core/types/document';
import type { HwpDocument } from '@rhwp/core';
import zhCN from '@eigenpal/docx-editor-i18n/zh-CN';
import '@eigenpal/docx-editor-react/styles.css';
import './App.css';
import { buildDocumentFromParagraphs } from './lib/buildDocumentFromParagraphs';
import { extractParagraphsFromPdf } from './lib/pdfImport';
import { extractParagraphsFromDoc } from './lib/docImport';
import { extractParagraphsFromHwpDocument, loadHwpDocument } from './lib/hwp';
import { HwpViewer } from './HwpViewer';

const AUTHOR_STORAGE_KEY = 'docx-editor:author';

function readSavedAuthor(): string {
  try {
    return localStorage.getItem(AUTHOR_STORAGE_KEY) || '我';
  } catch {
    return '我';
  }
}

type Mode = 'docx' | 'hwp-view';

interface HwpState {
  doc: HwpDocument;
  fileName: string;
}

function App() {
  const editorRef = useRef<DocxEditorRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>('docx');
  const [documentName, setDocumentName] = useState('未命名文档.docx');
  const [author] = useState(readSavedAuthor);
  const [initialDocument, setInitialDocument] = useState<Document>(() => createEmptyDocument());
  const [editorKey, setEditorKey] = useState(0);
  const [hwpState, setHwpState] = useState<HwpState | null>(null);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);

  // Called when the user chooses File > Save (or Ctrl/Cmd+S) inside the
  // editor. The library hands us the packaged .docx bytes; we just need to
  // turn that into a real file download in the browser.
  const handleSave = useCallback(
    (buffer: ArrayBuffer) => {
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = URL.createObjectURL(blob);
      const filename = documentName.trim().endsWith('.docx')
        ? documentName.trim()
        : `${documentName.trim() || '未命名文档'}.docx`;
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
    [documentName],
  );

  const handleError = useCallback((error: Error) => {
    console.error('[docx-editor]', error);
  }, []);

  const loadConvertedDocument = useCallback((paragraphs: string[], name: string) => {
    const doc = buildDocumentFromParagraphs(paragraphs);
    setInitialDocument(doc);
    setDocumentName(name);
    setEditorKey((k) => k + 1);
    setMode('docx');
  }, []);

  const handleOpenOtherFormat = useCallback(
    async (file: File) => {
      const lower = file.name.toLowerCase();
      try {
        if (lower.endsWith('.pdf')) {
          setBusyMessage('正在解析 PDF，尽力还原段落结构…');
          const buffer = await file.arrayBuffer();
          const paragraphs = await extractParagraphsFromPdf(buffer);
          loadConvertedDocument(paragraphs, file.name.replace(/\.pdf$/i, '') + '（由PDF转换）.docx');
        } else if (lower.endsWith('.doc')) {
          setBusyMessage('正在读取 .doc 文件（仅提取文字，不含原格式）…');
          const buffer = await file.arrayBuffer();
          const paragraphs = await extractParagraphsFromDoc(buffer);
          loadConvertedDocument(paragraphs, file.name.replace(/\.doc$/i, '') + '.docx');
        } else if (lower.endsWith('.hwp') || lower.endsWith('.hwpx')) {
          setBusyMessage('正在解析 HWP 文件…');
          const buffer = await file.arrayBuffer();
          const hwpDoc = await loadHwpDocument(buffer);
          setHwpState({ doc: hwpDoc, fileName: file.name });
          setMode('hwp-view');
        } else {
          window.alert('暂不支持这个文件类型。支持：.docx（原生编辑）、.doc、.pdf、.hwp、.hwpx。');
        }
      } catch (err) {
        console.error(err);
        window.alert(`打开文件失败：${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setBusyMessage(null);
      }
    },
    [loadConvertedDocument],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (file) void handleOpenOtherFormat(file);
    },
    [handleOpenOtherFormat],
  );

  const handleConvertHwpToEditable = useCallback(async () => {
    if (!hwpState) return;
    setBusyMessage('正在提取文字内容…');
    try {
      const paragraphs = extractParagraphsFromHwpDocument(hwpState.doc);
      loadConvertedDocument(paragraphs, hwpState.fileName.replace(/\.(hwpx?|HWPX?)$/, '') + '（由HWP转换）.docx');
    } finally {
      setBusyMessage(null);
    }
  }, [hwpState, loadConvertedDocument]);

  if (mode === 'hwp-view' && hwpState) {
    return (
      <div className="app-shell">
        <HwpViewer
          doc={hwpState.doc}
          fileName={hwpState.fileName}
          onBack={() => setMode('docx')}
          onConvertToEditable={() => void handleConvertHwpToEditable()}
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <input
        ref={fileInputRef}
        type="file"
        accept=".doc,.pdf,.hwp,.hwpx"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />
      <DocxEditor
        key={editorKey}
        ref={editorRef}
        document={initialDocument}
        documentName={documentName}
        onDocumentNameChange={setDocumentName}
        author={author}
        onSave={handleSave}
        onError={handleError}
        i18n={zhCN}
        colorMode="system"
        showToolbar
        showFileOpen
        showZoomControl
        showRuler
        showOutline
        showMarginGuides={false}
        rulerUnit="cm"
        mode="editing"
        className="app-editor"
        toolbarExtra={
          <button
            type="button"
            className="open-other-format-btn"
            onClick={() => fileInputRef.current?.click()}
            title="打开 .doc / .pdf / .hwp / .hwpx 文件（会转换为可编辑文档）"
          >
            打开 DOC/PDF/HWP
          </button>
        }
      />
      {busyMessage && (
        <div className="busy-overlay">
          <div className="busy-overlay__box">{busyMessage}</div>
        </div>
      )}
    </div>
  );
}

export default App;
