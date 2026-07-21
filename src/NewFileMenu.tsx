import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

/**
 * Toolbar "新建" dropdown — lets the user start a blank docx/xlsx/pptx/txt.
 *
 * The dropdown panel is rendered through a React portal straight into
 * `document.body`, positioned with `position: fixed` from the trigger
 * button's live bounding rect, rather than as a normal in-place absolutely
 * positioned child. This isn't just style preference: the underlying
 * DocxEditor is a large third-party component tree, and somewhere in it an
 * ancestor establishes its own CSS stacking context (a transform/opacity/etc.
 * — not something we control or want to depend on). A plain
 * `position: absolute` dropdown nested inside our own toolbar ended up
 * compared against that library-internal stacking context rather than the
 * page root, so despite a very high `z-index` the dropdown's items were
 * visually present but unclickable — its own toolbar intercepted the click.
 * Portaling to `document.body` sidesteps all of that: the dropdown is a
 * direct child of `<body>`, in the same stacking context as everything else
 * at the page root, so its z-index always wins.
 */
export function NewFileMenu({ onSelect }: NewFileMenuProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setCoords({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    // Close (rather than try to reposition) on scroll/resize — simplest way
    // to avoid the dropdown drifting away from the trigger button.
    const handleReflow = () => setOpen(false);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleReflow, true);
    window.addEventListener('resize', handleReflow);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleReflow, true);
      window.removeEventListener('resize', handleReflow);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="new-file-menu__trigger"
        onClick={() => (open ? setOpen(false) : openMenu())}
        title="新建空白文件"
      >
        ＋ 新建
      </button>
      {open && coords &&
        createPortal(
          <div
            className="new-file-menu__dropdown"
            role="menu"
            ref={dropdownRef}
            style={{ position: 'fixed', top: coords.top, left: coords.left }}
          >
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
          </div>,
          document.body,
        )}
    </>
  );
}
