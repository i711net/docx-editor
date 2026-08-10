import { useCallback, useRef, useState } from 'react';
import { removePdfEditRestriction } from './lib/pdfUnlock';
import { removePptxEditRestriction } from './lib/pptxUnlock';
import './UnlockFileDialog.css';

interface UnlockFileDialogProps {
  onClose: () => void;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; fileName: string }
  | { kind: 'done'; ok: boolean; message: string };

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function withSuffix(name: string, suffix: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return `${name}${suffix}`;
  return `${name.slice(0, dot)}${suffix}${name.slice(dot)}`;
}

/**
 * Standalone utility (deliberately NOT wired into the main open/import
 * flow) for removing *editing restrictions* — not open/view passwords —
 * from PDF and PPTX files the user can already open and read:
 *
 *  - PDF: an "owner password" that blocks printing/editing/copying, on a
 *    file with no user/open password (see lib/pdfUnlock.ts for why this
 *    doesn't require knowing the real password).
 *  - PPTX: PowerPoint's "Restrict Editing" write-protection flag (see
 *    lib/pptxUnlock.ts).
 *
 * This deliberately does NOT attempt to recover or crack a forgotten
 * open/view password on an encrypted file — that's a different, much
 * harder, and more sensitive problem this app does not take on.
 */
export function UnlockFileDialog({ onClose }: UnlockFileDialogProps) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.toLowerCase().split('.').pop();
    setStatus({ kind: 'busy', fileName: file.name });

    try {
      const buffer = await file.arrayBuffer();

      if (ext === 'pdf') {
        const result = await removePdfEditRestriction(buffer);
        if (result.success && result.blob) {
          downloadBlob(result.blob, withSuffix(file.name, '_已解除限制'));
        }
        setStatus({ kind: 'done', ok: result.success, message: result.message });
        return;
      }

      if (ext === 'pptx') {
        const result = await removePptxEditRestriction(buffer);
        if (!result.wasValidPptx) {
          setStatus({ kind: 'done', ok: false, message: '无法处理：这不是一个可识别的 .pptx 文件（可能已损坏，或其实是老版本 .ppt 格式）。' });
          return;
        }
        downloadBlob(result.blob, withSuffix(file.name, '_已解除限制'));
        setStatus({
          kind: 'done',
          ok: true,
          message: result.hadRestriction
            ? '已移除该 PPTX 的"限制编辑"保护，新副本可以正常编辑了。'
            : '这个 PPTX 本来就没有设置"限制编辑"保护，已原样生成一份副本。',
        });
        return;
      }

      setStatus({ kind: 'done', ok: false, message: '暂只支持 .pdf 和 .pptx 文件。' });
    } catch (err) {
      setStatus({ kind: 'done', ok: false, message: `处理失败：${err instanceof Error ? err.message : String(err)}` });
    }
  }, []);

  return (
    <div className="busy-overlay">
      <div className="busy-overlay__box unlock-dialog">
        <p className="unlock-dialog__title">解除文件限制</p>
        <p className="unlock-dialog__desc">
          仅适用于<strong>已经能正常打开、阅读</strong>的文件——用来去掉 PDF 的"禁止编辑/打印/复制"限制，或 PPTX 的"限制编辑"保护。
          <br />
          不支持、也不会尝试破解需要密码才能<strong>打开</strong>文件的情况（比如你忘记了打开密码）。
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.pptx"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void handleFile(file);
          }}
        />
        {status.kind === 'idle' && (
          <button type="button" className="unlock-dialog__pick-btn" onClick={() => inputRef.current?.click()}>
            选择 PDF 或 PPTX 文件
          </button>
        )}
        {status.kind === 'busy' && <p className="unlock-dialog__status">正在处理「{status.fileName}」…</p>}
        {status.kind === 'done' && (
          <>
            <p className={`unlock-dialog__status ${status.ok ? 'unlock-dialog__status--ok' : 'unlock-dialog__status--error'}`}>
              {status.message}
            </p>
            <button type="button" className="unlock-dialog__pick-btn" onClick={() => setStatus({ kind: 'idle' })}>
              处理另一个文件
            </button>
          </>
        )}
        <button type="button" className="pdf-choice-box__cancel" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  );
}
