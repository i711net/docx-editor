import createQpdfModule from '@neslinesli93/qpdf-wasm';
// `?url` makes Vite copy the .wasm file into the build output and hand back
// its final URL, instead of trying to parse it as JS.
import qpdfWasmUrl from '@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url';

export interface PdfUnlockResult {
  success: boolean;
  /** Only set when `success` is true. */
  blob?: Blob;
  /** Human-readable (Chinese) explanation, for either outcome. */
  message: string;
}

/**
 * Removes PDF "owner password" restrictions (no-printing / no-editing /
 * no-copying flags) from a PDF that has NO open/view password — i.e. any
 * PDF that already opens normally in a viewer.
 *
 * This is NOT password cracking / recovery. Per the PDF spec (ISO 32000),
 * when a PDF has an owner password but a *blank* user password, the file's
 * real encryption key is derived from the (blank, well-known) user password
 * plus some data stored in the file — the owner password's plaintext is
 * never an input to that derivation. So a program can decrypt and re-save
 * such a file without ever knowing the actual owner password; the
 * permission flags were only ever enforced by cooperating reader UIs, not
 * by making the content inaccessible. This is exactly what tools like
 * `qpdf --decrypt` have always done. If a PDF instead requires a real
 * *open* password (one you need just to view it), decryption will fail —
 * that case is a genuine forgotten-password scenario this function
 * deliberately does not attempt to bypass.
 */
export async function removePdfEditRestriction(buffer: ArrayBuffer): Promise<PdfUnlockResult> {
  // qpdf-wasm has no print/printErr hook in its Module config — it writes
  // straight to console.log/console.error. We intercept console for the
  // duration of this single synchronous-ish call to capture qpdf's own
  // diagnostic text (e.g. "invalid password"), then restore it immediately
  // afterwards no matter what happens.
  const captured: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => {
    captured.push(args.map(String).join(' '));
  };
  console.error = (...args: unknown[]) => {
    captured.push(args.map(String).join(' '));
  };

  try {
    const qpdf = await createQpdfModule({ locateFile: () => qpdfWasmUrl });
    const inputPath = '/input.pdf';
    const outputPath = '/output.pdf';
    // The package's shipped .d.ts only declares mkdir/mount/unmount/readFile
    // on the Emscripten FS object, but the real (Emscripten-standard) FS
    // also exposes writeFile — used here exactly as the package's own
    // README documents. Cast narrowly rather than widening the whole `qpdf`
    // object to `any`.
    (qpdf.FS as unknown as { writeFile: (path: string, data: Uint8Array) => void }).writeFile(
      inputPath,
      new Uint8Array(buffer),
    );

    let exitCode: number;
    try {
      exitCode = qpdf.callMain([inputPath, '--decrypt', '--', outputPath]);
    } catch {
      // qpdf-wasm can throw an ExitStatus-like object instead of returning
      // a non-zero code for some failure paths.
      exitCode = 1;
    }

    if (exitCode !== 0) {
      const detail = captured.join('\n');
      const needsOpenPassword = /password/i.test(detail);
      return {
        success: false,
        message: needsOpenPassword
          ? '无法处理：这个 PDF 需要打开密码才能读取（不只是编辑/打印限制）。本工具不做密码破解或找回，无法绕过这种情况。'
          : `处理失败：${detail || `未知错误（qpdf 退出码 ${exitCode}）`}`,
      };
    }

    const outputBytes = qpdf.FS.readFile(outputPath);
    // Copy out of the wasm heap before it can be reused/freed.
    const copy = new Uint8Array(outputBytes.length);
    copy.set(outputBytes);
    return {
      success: true,
      blob: new Blob([copy], { type: 'application/pdf' }),
      message: '已生成新副本：如果原文件设置了禁止编辑/打印/复制的限制，新副本已移除这些限制；文件内容本身没有变化。',
    };
  } catch (err) {
    return {
      success: false,
      message: `处理失败：${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}
