import { useCallback, useRef, useState } from 'react';
import {
  DocxEditor,
  createEmptyDocument,
  type DocxEditorRef,
} from '@eigenpal/docx-editor-react';
import type { Document } from '@eigenpal/docx-editor-core/types/document';
import type { HwpDocument } from '@rhwp/core';
import type { Sheet } from '@fortune-sheet/core';
import zhCN from '@eigenpal/docx-editor-i18n/zh-CN';
import '@eigenpal/docx-editor-react/styles.css';
import './App.css';
import { buildDocumentFromParagraphs } from './lib/buildDocumentFromParagraphs';
import { buildDocumentFromPageImages } from './lib/buildDocumentFromImages';
import { extractParagraphsFromPdf } from './lib/pdfImport';
import { renderPdfPagesAsImages } from './lib/pdfImageImport';
import { extractParagraphsFromDoc } from './lib/docImport';
import { extractParagraphsFromHwpDocument, loadHwpDocument } from './lib/hwp';
import { extractParagraphsFromEpub } from './lib/epubImport';
import { loadImageFile } from './lib/imageFileImport';
import { createBlankPresentation, type Presentation } from './lib/pptxModel';
import { HwpViewer } from './HwpViewer';
import { EpubViewer } from './EpubViewer';
import { ImageViewer } from './ImageViewer';
import { XlsxEditor, createBlankSheets } from './XlsxEditor';
import { PptxEditor } from './PptxEditor';
import { TxtEditor } from './TxtEditor';
import { NewFileMenu, type NewFileKind } from './NewFileMenu';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

const AUTHOR_STORAGE_KEY = 'docx-editor:author';

function readSavedAuthor(): string {
  try {
    return localStorage.getItem(AUTHOR_STORAGE_KEY) || '我';
  } catch {
    return '我';
  }
}

type Mode = 'docx' | 'hwp-view' | 'epub-view' | 'image-view' | 'xlsx' | 'pptx' | 'txt-edit';

interface HwpState {
  doc: HwpDocument;
  fileName: string;
}

interface EpubState {
  buffer: ArrayBuffer;
  fileName: string;
}

interface ImageState {
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  fileName: string;
}

interface TxtState {
  text: string;
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
  const [epubState, setEpubState] = useState<EpubState | null>(null);
  const [epubConverting, setEpubConverting] = useState(false);
  const [imageState, setImageState] = useState<ImageState | null>(null);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [pendingPdf, setPendingPdf] = useState<File | null>(null);
  const [xlsxSheets, setXlsxSheets] = useState<Sheet[]>(() => createBlankSheets());
  const [xlsxPendingFile, setXlsxPendingFile] = useState<File | null>(null);
  const [xlsxKey, setXlsxKey] = useState(0);
  const [pptxPresentation, setPptxPresentation] = useState<Presentation>(() => createBlankPresentation());
  const [pptxPendingFile, setPptxPendingFile] = useState<File | null>(null);
  const [pptxKey, setPptxKey] = useState(0);
  const [txtState, setTxtState] = useState<TxtState>({ text: '', fileName: '未命名文本.txt' });
  const [txtKey, setTxtKey] = useState(0);

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

  const handlePdfAsText = useCallback(
    async (file: File) => {
      setPendingPdf(null);
      setBusyMessage('正在解析 PDF，尽力还原段落结构…');
      try {
        const buffer = await file.arrayBuffer();
        const paragraphs = await extractParagraphsFromPdf(buffer);
        loadConvertedDocument(paragraphs, file.name.replace(/\.pdf$/i, '') + '（由PDF转换·文字）.docx');
      } catch (err) {
        console.error(err);
        window.alert(`解析 PDF 失败：${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setBusyMessage(null);
      }
    },
    [loadConvertedDocument],
  );

  const handlePdfAsImages = useCallback(
    async (file: File) => {
      setPendingPdf(null);
      setBusyMessage('正在把 PDF 每一页渲染成图片…');
      try {
        const buffer = await file.arrayBuffer();
        const images = await renderPdfPagesAsImages(buffer);
        const doc = buildDocumentFromPageImages(images);
        setInitialDocument(doc);
        setDocumentName(file.name.replace(/\.pdf$/i, '') + '（由PDF转换·图片）.docx');
        setEditorKey((k) => k + 1);
        setMode('docx');
      } catch (err) {
        console.error(err);
        window.alert(`转换 PDF 失败：${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setBusyMessage(null);
      }
    },
    [],
  );

  const handleOpenOtherFormat = useCallback(
    async (file: File) => {
      const lower = file.name.toLowerCase();
      try {
        if (lower.endsWith('.pdf')) {
          setPendingPdf(file);
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
        } else if (lower.endsWith('.epub')) {
          setBusyMessage('正在打开 EPUB…');
          const buffer = await file.arrayBuffer();
          setEpubState({ buffer, fileName: file.name });
          setMode('epub-view');
        } else if (lower.endsWith('.txt')) {
          setBusyMessage('正在读取文本文件…');
          const text = await file.text();
          setTxtState({ text, fileName: file.name });
          setTxtKey((k) => k + 1);
          setDocumentName(file.name);
          setMode('txt-edit');
        } else if (IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
          setBusyMessage('正在打开图片…');
          const { dataUrl, widthPx, heightPx } = await loadImageFile(file);
          setImageState({ dataUrl, widthPx, heightPx, fileName: file.name });
          setMode('image-view');
        } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
          setXlsxSheets(createBlankSheets());
          setXlsxPendingFile(file);
          setXlsxKey((k) => k + 1);
          setDocumentName(file.name);
          setMode('xlsx');
        } else if (lower.endsWith('.pptx')) {
          setPptxPresentation(createBlankPresentation());
          setPptxPendingFile(file);
          setPptxKey((k) => k + 1);
          setDocumentName(file.name);
          setMode('pptx');
        } else {
          window.alert(
            '暂不支持这个文件类型。支持：.docx（原生编辑）、.doc、.pdf、.hwp、.hwpx、.epub、.txt、.xlsx/.xls/.csv、.pptx、常见图片格式。',
          );
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

  const handleConvertEpubToEditable = useCallback(async () => {
    if (!epubState) return;
    setEpubConverting(true);
    try {
      const paragraphs = await extractParagraphsFromEpub(epubState.buffer);
      loadConvertedDocument(paragraphs, epubState.fileName.replace(/\.epub$/i, '') + '（由EPUB转换）.docx');
    } catch (err) {
      console.error(err);
      window.alert(`提取 EPUB 文字失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setEpubConverting(false);
    }
  }, [epubState, loadConvertedDocument]);

  const handleInsertImageIntoDocument = useCallback(() => {
    if (!imageState) return;
    const doc = buildDocumentFromPageImages([
      { dataUrl: imageState.dataUrl, widthPx: imageState.widthPx, heightPx: imageState.heightPx },
    ]);
    setInitialDocument(doc);
    setDocumentName(imageState.fileName.replace(/\.[^.]+$/, '') + '（图片）.docx');
    setEditorKey((k) => k + 1);
    setMode('docx');
  }, [imageState]);

  // "新建" menu — starts a blank file of whichever native-editable format the
  // user picked. PDF/EPUB deliberately aren't offered here (see README):
  // "starting from a blank PDF/EPUB to edit" isn't really a meaningful
  // action the way it is for docx/xlsx/pptx/txt.
  const handleNewFile = useCallback((kind: NewFileKind) => {
    switch (kind) {
      case 'docx':
        setInitialDocument(createEmptyDocument());
        setDocumentName('未命名文档.docx');
        setEditorKey((k) => k + 1);
        setMode('docx');
        break;
      case 'txt':
        setTxtState({ text: '', fileName: '未命名文本.txt' });
        setTxtKey((k) => k + 1);
        setDocumentName('未命名文本.txt');
        setMode('txt-edit');
        break;
      case 'xlsx':
        setXlsxSheets(createBlankSheets());
        setXlsxPendingFile(null);
        setXlsxKey((k) => k + 1);
        setDocumentName('未命名表格.xlsx');
        setMode('xlsx');
        break;
      case 'pptx':
        setPptxPresentation(createBlankPresentation());
        setPptxPendingFile(null);
        setPptxKey((k) => k + 1);
        setDocumentName('未命名演示文稿.pptx');
        setMode('pptx');
        break;
    }
  }, []);

  if (mode === 'txt-edit') {
    return (
      <div className="app-shell">
        <TxtEditor
          key={txtKey}
          initialText={txtState.text}
          documentName={documentName}
          onDocumentNameChange={setDocumentName}
          onBack={() => setMode('docx')}
        />
      </div>
    );
  }

  if (mode === 'xlsx') {
    return (
      <div className="app-shell">
        <XlsxEditor
          key={xlsxKey}
          initialSheets={xlsxSheets}
          pendingImportFile={xlsxPendingFile}
          documentName={documentName}
          onDocumentNameChange={setDocumentName}
          onBack={() => setMode('docx')}
        />
      </div>
    );
  }

  if (mode === 'pptx') {
    return (
      <div className="app-shell">
        <PptxEditor
          key={pptxKey}
          initialPresentation={pptxPresentation}
          pendingImportFile={pptxPendingFile}
          documentName={documentName}
          onDocumentNameChange={setDocumentName}
          onBack={() => setMode('docx')}
        />
      </div>
    );
  }

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

  if (mode === 'epub-view' && epubState) {
    return (
      <div className="app-shell">
        <EpubViewer
          buffer={epubState.buffer}
          fileName={epubState.fileName}
          onBack={() => setMode('docx')}
          onConvertToEditable={() => void handleConvertEpubToEditable()}
          converting={epubConverting}
        />
      </div>
    );
  }

  if (mode === 'image-view' && imageState) {
    return (
      <div className="app-shell">
        <ImageViewer
          dataUrl={imageState.dataUrl}
          fileName={imageState.fileName}
          onBack={() => setMode('docx')}
          onInsertIntoDocument={handleInsertImageIntoDocument}
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <input
        ref={fileInputRef}
        type="file"
        accept={`.doc,.pdf,.hwp,.hwpx,.epub,.txt,.xlsx,.xls,.csv,.pptx,${IMAGE_EXTENSIONS.join(',')}`}
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
          <>
            <NewFileMenu onSelect={handleNewFile} />
            <button
              type="button"
              className="open-other-format-btn"
              onClick={() => fileInputRef.current?.click()}
              title="打开 .doc / .pdf / .hwp / .hwpx / .epub / .txt / .xlsx / .pptx / 图片 文件（部分格式会转换为可编辑文档，部分仅供阅读）"
            >
              打开 DOC/PDF/HWP/EPUB/TXT/XLSX/PPTX/图片
            </button>
          </>
        }
      />
      {pendingPdf && (
        <div className="busy-overlay">
          <div className="busy-overlay__box pdf-choice-box">
            <p className="pdf-choice-box__title">这个 PDF 要怎么导入？</p>
            <button type="button" className="pdf-choice-box__option" onClick={() => void handlePdfAsText(pendingPdf)}>
              <span className="pdf-choice-box__option-title">转换为可编辑文字</span>
              <span className="pdf-choice-box__option-desc">
                提取文字并按段落重新排版，之后可以像 Word 一样自由编辑、重新排版。排版是近似还原，复杂版式（多栏、表格）可能不准确。
              </span>
            </button>
            <button
              type="button"
              className="pdf-choice-box__option"
              onClick={() => void handlePdfAsImages(pendingPdf)}
            >
              <span className="pdf-choice-box__option-title">保留原始排版（导入为图片）</span>
              <span className="pdf-choice-box__option-desc">
                把每一页原样渲染成图片放进文档，版式 100% 还原，但文字不可编辑、不可选中——适合扫描件或版式复杂、不需要改文字的情况。
              </span>
            </button>
            <button type="button" className="pdf-choice-box__cancel" onClick={() => setPendingPdf(null)}>
              取消
            </button>
          </div>
        </div>
      )}
      {busyMessage && (
        <div className="busy-overlay">
          <div className="busy-overlay__box">{busyMessage}</div>
        </div>
      )}
    </div>
  );
}

export default App;
