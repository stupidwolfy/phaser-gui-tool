import type { ReactNode } from 'react';

/**
 * The mobile bottom sheet.
 *
 * It covers the lower part of the screen rather than the whole thing, so the
 * canvas stays visible while you edit — on a phone, a full-screen inspector
 * means you can't see what your change did.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`sheet ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="sheet__grip" />
      <div className="sheet__header">
        <span>{title}</span>
        <button className="icon-btn" onClick={onClose} aria-label="Close panel">
          ✕
        </button>
      </div>
      <div className="sheet__body">{children}</div>
    </div>
  );
}
