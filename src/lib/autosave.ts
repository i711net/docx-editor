import { get, set, del } from 'idb-keyval';

// Lightweight "don't lose my work" safety net: while a document is open,
// its latest content is periodically snapshotted into the browser's
// IndexedDB (via idb-keyval — a tiny, dependency-free MIT wrapper). If the
// tab crashes, gets refreshed by accident, or is closed before the user
// remembers to hit "保存", the next time that editor type is opened it can
// offer to restore the snapshot. This never touches any server — everything
// stays in the browser's own local storage, same as the rest of this app.
//
// Deliberately scoped to ONE slot per editor type (docx/xlsx/pptx/txt)
// rather than a full version history — the goal is crash recovery for
// "whatever you were last working on", not a document management system.

export interface DraftEnvelope<T> {
  payload: T;
  savedAt: number;
  documentName?: string;
}

const draftKey = (kind: string) => `docx-editor-draft:${kind}`;

export async function saveDraft<T>(kind: string, payload: T, documentName?: string): Promise<void> {
  const envelope: DraftEnvelope<T> = { payload, savedAt: Date.now(), documentName };
  try {
    await set(draftKey(kind), envelope);
  } catch (err) {
    // Autosave is a best-effort convenience, not a guarantee — if IndexedDB
    // is unavailable (private browsing in some browsers, quota exceeded,
    // etc.) we just skip silently rather than interrupting the user's work
    // with an error about a background feature they didn't explicitly ask
    // to invoke this time.
    console.warn(`[autosave] failed to save draft for "${kind}"`, err);
  }
}

export async function loadDraft<T>(kind: string): Promise<DraftEnvelope<T> | null> {
  try {
    const v = await get(draftKey(kind));
    return (v as DraftEnvelope<T> | undefined) ?? null;
  } catch (err) {
    console.warn(`[autosave] failed to load draft for "${kind}"`, err);
    return null;
  }
}

export async function clearDraft(kind: string): Promise<void> {
  try {
    await del(draftKey(kind));
  } catch (err) {
    console.warn(`[autosave] failed to clear draft for "${kind}"`, err);
  }
}

export interface Debounced<Args extends unknown[]> {
  (...args: Args): void;
  /** Cancels a pending trailing call. Callers MUST invoke this right before
   * (or after) an explicit `clearDraft` — otherwise a debounced autosave
   * that was already queued (e.g. from the keystroke just before the user
   * hit "保存") fires moments later and silently re-writes the very draft
   * that was just cleared, so a freshly-saved document reopens later still
   * flagged as having "unsaved" work. */
  cancel(): void;
}

/** Simple trailing debounce — used to avoid writing to IndexedDB on every
 * single keystroke, which would be wasteful and could visibly stutter on
 * large documents. */
export function debounce<Args extends unknown[]>(fn: (...args: Args) => void, ms: number): Debounced<Args> {
  let timer: number | undefined;
  const debounced = ((...args: Args) => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), ms);
  }) as Debounced<Args>;
  debounced.cancel = () => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
  };
  return debounced;
}
