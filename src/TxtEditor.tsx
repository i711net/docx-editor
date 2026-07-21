import { useCallback, useRef, useState } from 'react';
import './TxtEditor.css';

interface TxtEditorProps {
  initialText: string;
  documentName: string;
  onDocumentNameChange: (name: string) => void;
  onBack: () => void;
}

/**
 * Plain-text editor for .txt files. Deliberately NOT built on top of the
 * rich DocxEditor: that library always performs its own internal download
 * (forcing a .docx extension) whenever the user hits "保存", independent of
 * our `onSave` callback — there's no prop to suppress it. Piggy-backing TXT
 * editing on the docx editor would mean every save silently produces a
 * second, incorrectly-named file alongside the real .txt one. A plain
 * <textarea> has no such surprises: one button, one download, exactly the
 * bytes the user sees.
 */
export function TxtEditor({ initialText, documentName, onDocumentNameChange, onBack }: TxtEditorProps) {
  const [text, setText] = useState(initialText);
  const [nameDraft, setNameDraft] = useState(documentName);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleSave = useCallback(() => {
    const trimmed = nameDraft.trim() || '未命名文本';
    const filename = trimmed.toLowerCase().endsWith('.txt') ? trimmed : `${trimmed}.txt`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [text, nameDraft]);

  const handleImportFile = useCallback(
    async (file: File) => {
      const content = await file.text();
      setText(content);
      setNameDraft(file.name);
      onDocumentNameChange(file.name);
    },
    [onDocumentNameChange],
  );

  return (
    <div className="txt-editor">
      <input
        ref={importInputRef}
        type="file"
        accept=".txt"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleImportFile(file);
        }}
      />
      <div className="txt-editor__bar">
        <button type="button" className="txt-editor__btn" onClick={onBack}>
          ← 返回
        </button>
        <input
          className="txt-editor__name-input"
          value={nameDraft}
          onChange={(e) => {
            setNameDraft(e.target.value);
            onDocumentNameChange(e.target.value);
          }}
        />
        <div className="txt-editor__spacer" />
        <button type="button" className="txt-editor__btn" onClick={() => importInputRef.current?.click()}>
          打开 TXT
        </button>
        <button type="button" className="txt-editor__btn txt-editor__btn--primary" onClick={handleSave}>
          保存为 .txt
        </button>
      </div>
      <textarea
        className="txt-editor__textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        placeholder="在这里输入纯文本内容…"
      />
    </div>
  );
}
