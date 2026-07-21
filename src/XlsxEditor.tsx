import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Workbook, type WorkbookInstance } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import type { Image as FortuneImage, Sheet } from '@fortune-sheet/core';
import { transformExcelToFortune, transformFortuneToExcel } from '@corbe30/fortune-excel';
import type { IFileType } from '@corbe30/fortune-excel/dist/common/ICommon';
import { extractChartData, parseA1Range, renderChartToDataUrl, type ChartKind } from './lib/xlsxChart';
import { clearDraft, debounce, loadDraft, saveDraft, type DraftEnvelope } from './lib/autosave';
import { DraftBanner } from './DraftBanner';
import './XlsxEditor.css';

// `IFileType` (the `xlsx`/`csv` file-type enum) is a string enum, so a plain
// string literal isn't structurally assignable to it — but the *runtime*
// value only needs to be the string "xlsx"; the enum object itself isn't
// re-exported from the package's main entry point. We import just the type
// (no runtime cost) from the internal submodule and cast the literal to it.
const XLSX_FILE_TYPE = 'xlsx' as IFileType;

const AUTOSAVE_KIND = 'xlsx';

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
  const [chartDialog, setChartDialog] = useState<{ range: string; kind: ChartKind; title: string } | null>(null);
  const [draft, setDraft] = useState<DraftEnvelope<{ sheets: Sheet[] }> | null>(null);

  const debouncedAutosave = useMemo(
    () => debounce((value: Sheet[], fileName: string) => void saveDraft(AUTOSAVE_KIND, { sheets: value }, fileName), 1500),
    [],
  );

  useEffect(() => {
    // Skip offering a restore for the very first load if we were opened
    // with a real pending file to import — that import will overwrite
    // `sheets` moments later anyway, so a draft prompt would just be noise.
    if (pendingImportFile) return;
    void loadDraft<{ sheets: Sheet[] }>(AUTOSAVE_KIND).then(setDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    debouncedAutosave(sheets, nameDraft);
  }, [sheets, nameDraft, debouncedAutosave]);

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
  }, [nameDraft, debouncedAutosave]);

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

  const openChartDialog = useCallback(() => {
    const selection = workbookRef.current?.getSelectionCoordinates?.();
    setChartDialog({ range: selection?.[0] ?? '', kind: 'bar', title: '' });
  }, []);

  const handleInsertChart = useCallback(async () => {
    if (!chartDialog || !workbookRef.current) return;
    try {
      const range = parseA1Range(chartDialog.range);
      const currentSheet = workbookRef.current.getSheet();
      if (!currentSheet) throw new Error('无法获取当前工作表');
      const chartData = extractChartData(currentSheet as Sheet, range);
      const dataUrl = await renderChartToDataUrl(chartDialog.kind, chartData, chartDialog.title);

      const img = new Image();
      const { width, height } = await new Promise<{ width: number; height: number }>((resolve) => {
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.src = dataUrl;
      });
      const displayWidth = 480;
      const displayHeight = (height / width) * displayWidth || 300;

      const newImage: FortuneImage = {
        id: `chart-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        src: dataUrl,
        left: 40,
        top: 40,
        width: displayWidth,
        height: displayHeight,
      };

      const allSheets = workbookRef.current.getAllSheets();
      const updated = allSheets.map((s) =>
        s.id === currentSheet.id ? { ...s, images: [...(s.images ?? []), newImage] } : s,
      );
      workbookRef.current.updateSheet(updated);
      setSheets(updated);
      setChartDialog(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    }
  }, [chartDialog]);

  return (
    <div className="xlsx-editor">
      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={handleImportInputChange}
      />
      {draft && (
        <DraftBanner
          savedAt={draft.savedAt}
          documentName={draft.documentName}
          onRestore={() => {
            setSheets(draft.payload.sheets);
            setWorkbookKey((k) => k + 1);
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
        <button type="button" className="xlsx-editor__btn" onClick={openChartDialog}>
          插入图表
        </button>
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
      {chartDialog && (
        <div className="busy-overlay">
          <div className="busy-overlay__box chart-dialog">
            <p className="chart-dialog__title">插入图表</p>
            <label className="chart-dialog__field">
              数据区域（如 A1:B5）
              <input
                type="text"
                value={chartDialog.range}
                onChange={(e) => setChartDialog({ ...chartDialog, range: e.target.value })}
                placeholder="A1:B5"
              />
            </label>
            <label className="chart-dialog__field">
              图表类型
              <select
                value={chartDialog.kind}
                onChange={(e) => setChartDialog({ ...chartDialog, kind: e.target.value as ChartKind })}
              >
                <option value="bar">柱状图</option>
                <option value="line">折线图</option>
                <option value="pie">饼图</option>
              </select>
            </label>
            <label className="chart-dialog__field">
              标题（可选）
              <input
                type="text"
                value={chartDialog.title}
                onChange={(e) => setChartDialog({ ...chartDialog, title: e.target.value })}
                placeholder="图表标题"
              />
            </label>
            <p className="chart-dialog__hint">
              生成的图表会以图片形式插入表格，可拖拽移动、调整大小；不是可实时联动数据的原生 Excel 图表对象。
            </p>
            <div className="chart-dialog__actions">
              <button type="button" className="xlsx-editor__btn" onClick={() => setChartDialog(null)}>
                取消
              </button>
              <button
                type="button"
                className="xlsx-editor__btn xlsx-editor__btn--primary"
                onClick={() => void handleInsertChart()}
              >
                插入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
