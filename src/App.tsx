import { useCallback, useRef, useState } from 'react';
import {
  DocxEditor,
  createEmptyDocument,
  type DocxEditorRef,
} from '@eigenpal/docx-editor-react';
import zhCN from '@eigenpal/docx-editor-i18n/zh-CN';
import '@eigenpal/docx-editor-react/styles.css';
import './App.css';

const AUTHOR_STORAGE_KEY = 'docx-editor:author';

function readSavedAuthor(): string {
  try {
    return localStorage.getItem(AUTHOR_STORAGE_KEY) || '我';
  } catch {
    return '我';
  }
}

function App() {
  const editorRef = useRef<DocxEditorRef>(null);
  const [documentName, setDocumentName] = useState('未命名文档.docx');
  const [author] = useState(readSavedAuthor);

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

  return (
    <div className="app-shell">
      <DocxEditor
        ref={editorRef}
        document={createEmptyDocument()}
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
      />
    </div>
  );
}

export default App;
