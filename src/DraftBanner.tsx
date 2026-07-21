import './DraftBanner.css';

interface DraftBannerProps {
  savedAt: number;
  documentName?: string;
  onRestore: () => void;
  onDiscard: () => void;
}

function formatSavedAt(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;
  return new Date(ts).toLocaleString('zh-CN');
}

/** Shown at the top of an editor when a local autosaved draft is found on
 * open — see src/lib/autosave.ts for why this exists (crash/refresh
 * recovery, not a full version history). */
export function DraftBanner({ savedAt, documentName, onRestore, onDiscard }: DraftBannerProps) {
  return (
    <div className="draft-banner">
      <span>
        检测到 {formatSavedAt(savedAt)} 自动保存的草稿{documentName ? `（${documentName}）` : ''}，是否恢复？
      </span>
      <div className="draft-banner__actions">
        <button type="button" className="draft-banner__btn draft-banner__btn--primary" onClick={onRestore}>
          恢复草稿
        </button>
        <button type="button" className="draft-banner__btn" onClick={onDiscard}>
          丢弃
        </button>
      </div>
    </div>
  );
}
