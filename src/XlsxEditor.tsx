import { useCallback, useEffect, useRef, useState } from 'react';
import { Workbook, type WorkbookInstance } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import type { Sheet } from '@fortune-sheet/core';
import { transformExcelToFortune, transformFortuneToExcel } from '@corbe30/fortune-excel';
import type { IFileType } from '@corbe30/fortune-excel/dist/common/ICommon';
import './XlsxEditor.css';

// `IFileType` (the `xlsx`/`csv` file-type enum) is a string enum, so a plain
// string literal isn't structurally assignable to it — but the *runtime*
// value only needs to be the string "xlsx"; the enum object itself isn't
// re-exported from the package's main entry point. We import just the type
// (no runtime cost) from the internal submodule and cast the literal to it.
const XLSX_FILE_TYPE = 'xlsx' as IFileType;

export function createBlankSheets(): Sheet[] {
  return [{ name: 'Sheet1' } as Sheet];
}

interface XlsxEditorProps {
  initialSheets: Sheet[];
  /** If set, imported automatically once the Workbook has mounted (used when
   * the user opens an .xlsx/.xls/.csv file from the main "打开其他格式" picker,
   * before this editor even exists yet to hold a ref to import into). */
  pendingImportFile?: File | null;
  documentName: string;
  onDocumentNameChange: (name: string) => void;
  onBack: () => void;
}

/**
 * Excel-compatible spreadsheet editor. Wraps `@fortune-sheet/react`'s
 * <Workbook> (MIT, an actively-maintained fork of the Luckysheet UI/engine)
 * for the actual grid/formula/formatting experience, and
 * `@corbe30/fortune-excel` (MIT, wraps SheetJS-adjacent `exceljs`) purely for
 * converting to/from real .xlsx bytes on open/save.
 */
export function XlsxEditor({
  initialSheets,
  pendingImportFile,
  documentName,
  onDocumentNameChange,
  onBack,
}: XlsxEditorProps) {
  const workbookRef = useRef<WorkbookInstance>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [sheets, setSheets] = useState<Sheet[]>(initialSheets);
  const [workbookKey, setWorkbookKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState(documentName);

  const handleSave = useCallback(async () => {
    if (!workbookRef.current) return;
    setBusy('正在生成 .xlsx 文件…');
    try {
      const blob = await transformFortuneToExcel(workbookRef, XLSX_FILE_TYPE, false);
      const filename = nameDraft.trim().endsWith('.xlsx') ? nameDraft.trim() : `${nameDraft.trim() || '未命名表格'}.xlsx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      window.alert(`保存失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  }, [nameDraft]);

  const handleImportFile = useCallback(async (file: File) => {
    setBusy('正在解析 Excel 文件…');
    try {
      await transformExcelToFortune(file, setSheets, setWorkbookKey, workbookRef);
      const base = file.name.replace(/\.(xlsx|xls|csv)$/i, '');
      setNameDraft(base + '.xlsx');
      onDocumentNameChange(base + '.xlsx');
    } catch (err) {
      console.error(err);
      window.alert(`导入失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  }, [onDocumentNameChange]);

  useEffect(() => {
    // Only run once on mount for whichever file was pending when this editor
    // was created — intentionally not re-running if the prop identity
    // changes later (the parent always remounts this component via `key`
    // when opening a different file).
    if (pendingImportFile) void handleImportFile(pendingImportFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImportInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (file) void handleImportFile(file);
    },
    [handleImportFile],
  );

  return (
    <div className="xlsx-editor">
      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={handleImportInputChange}
      />
      <div className="xlsx-editor__bar">
        <button type="button" className="xlsx-editor__btn" onClick={onBack} title="返回">
          ← 返回
        </button>
        <input
          className="xlsx-editor__name-input"
          value={nameDraft}
          onChange={(e) => {
            setNameDraft(e.target.value);
            onDocumentNameChange(e.target.value);
          }}
        />
        <div className="xlsx-editor__spacer" />
        <button type="button" className="xlsx-editor__btn" onClick={() => importInputRef.current?.click()}>
          打开 Excel/CSV
        </button>
        <button type="button" className="xlsx-editor__btn xlsx-editor__btn--primary" onClick={() => void handleSave()}>
          保存为 .xlsx
        </button>
      </div>
      <div className="xlsx-editor__grid">
        <Workbook
          key={workbookKey}
          ref={workbookRef}
          data={sheets}
          lang="zh"
          showToolbar
          showFormulaBar
          showSheetTabs
          onChange={setSheets}
        />
      </div>
      {busy && (
        <div className="busy-overlay">
          <div className="busy-overlay__box">{busy}</div>
        </div>
      )}
    </div>
  );
}
