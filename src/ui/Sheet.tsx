import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

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
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) requestAnimationFrame(() => (sheetRef.current?.querySelector<HTMLElement>('[data-dialog-initial]') ?? sheetRef.current?.querySelector<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])'))?.focus());
  }, [open]);

  const keepFocusInside = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); return onClose(); }
    if (event.key !== 'Tab') return;
    const controls = [...(sheetRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? [])];
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return (
    <div ref={sheetRef} className={`sheet ${open ? 'is-open' : ''}`} aria-hidden={!open} role="dialog" aria-modal={open || undefined} aria-labelledby={titleId} onKeyDown={keepFocusInside}>
      <div className="sheet__grip" aria-hidden="true" />
      <div className="sheet__header">
        <span id={titleId}>{title}</span>
        <button className="icon-btn" onClick={onClose} aria-label={`Close ${title} panel`}>
          ✕
        </button>
      </div>
      <div className="sheet__body">{children}</div>
    </div>
  );
}
