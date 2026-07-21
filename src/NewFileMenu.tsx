import { useEffect, useRef, useState } from 'react';
import './NewFileMenu.css';

export type NewFileKind = 'docx' | 'xlsx' | 'pptx' | 'txt';

const OPTIONS: { kind: NewFileKind; label: string; desc: string }[] = [
  { kind: 'docx', label: '新建 Word 文档', desc: '.docx · 富文本文字处理' },
  { kind: 'xlsx', label: '新建 Excel 表格', desc: '.xlsx · 电子表格' },
  { kind: 'pptx', label: '新建 PPT 演示文稿', desc: '.pptx · 幻灯片' },
  { kind: 'txt', label: '新建 TXT 文本', desc: '.txt · 纯文本' },
];

interface NewFileMenuProps {
  onSelect: (kind: NewFileKind) => void;
}

/** Toolbar "新建" dropdown — lets the user start a blank docx/xlsx/pptx/txt. */
export function NewFileMenu({ onSelect }: NewFileMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="new-file-menu" ref={rootRef}>
      <button
        type="button"
        className="new-file-menu__trigger"
        onClick={() => setOpen((v) => !v)}
        title="新建空白文件"
      >
        ＋ 新建
      </button>
      {open && (
        <div className="new-file-menu__dropdown" role="menu">
          {OPTIONS.map((opt) => (
            <button
              key={opt.kind}
              type="button"
              className="new-file-menu__item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSelect(opt.kind);
              }}
            >
              <span className="new-file-menu__item-label">{opt.label}</span>
              <span className="new-file-menu__item-desc">{opt.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
