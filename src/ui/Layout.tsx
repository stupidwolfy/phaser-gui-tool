import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { useEditorStore } from '../core/store';
import { MoveBar } from './MoveBar';
import { TileBar } from './TileBar';
import { Sheet } from './Sheet';

export type MobileTab = 'scene' | 'inspect' | 'file' | null;

function TabButton({
  label,
  icon,
  active,
  onClick,
  buttonRef,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      className={`tabbar__btn ${active ? 'is-active' : ''}`}
      aria-pressed={active}
      aria-expanded={active}
      ref={buttonRef}
      onClick={onClick}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </button>
  );
}

/**
 * The responsive shell.
 *
 * One component tree for both form factors — the panels themselves are
 * identical, only their container changes. Forking the layout into two
 * components would double the work of every future panel.
 */
export function Layout({
  isMobile,
  toolbar,
  viewport,
  tree,
  inspector,
  fileMenu,
  help,
  helpOpen,
  onCloseHelp,
}: {
  isMobile: boolean;
  toolbar: ReactNode;
  viewport: ReactNode;
  tree: ReactNode;
  inspector: ReactNode;
  /** Mobile only — on desktop these actions live in the toolbar. */
  fileMenu: ReactNode;
  help: ReactNode;
  helpOpen: boolean;
  onCloseHelp: () => void;
}) {
  const [tab, setTab] = useState<MobileTab>(null);
  const sceneTab = useRef<HTMLButtonElement>(null);
  const inspectTab = useRef<HTMLButtonElement>(null);
  const fileTab = useRef<HTMLButtonElement>(null);
  const painting = useEditorStore((s) => s.paintingId !== null);
  const helpTitleId = useId();
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (helpOpen) requestAnimationFrame(() => (helpRef.current?.querySelector<HTMLElement>('[data-dialog-initial]') ?? helpRef.current?.querySelector<HTMLElement>('input, button, a[href]'))?.focus());
  }, [helpOpen]);

  const keepHelpFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCloseHelp(); return; }
    if (event.key !== 'Tab') return;
    const controls = [...(helpRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])') ?? [])];
    if (!controls.length) return;
    const first = controls[0]; const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const helpSurface = isMobile ? (
    <Sheet open={helpOpen} title="Help" onClose={onCloseHelp}>{help}</Sheet>
  ) : helpOpen ? (
    <div className="help-modal__backdrop">
      <div ref={helpRef} className="help-modal" role="dialog" aria-modal="true" aria-labelledby={helpTitleId} onKeyDown={keepHelpFocus}>
        <header className="help-modal__header"><h2 id={helpTitleId}>Help</h2><button className="icon-btn" onClick={onCloseHelp} aria-label="Close Help">✕</button></header>
        {help}
      </div>
    </div>
  ) : null;

  if (!isMobile) {
    return (
      <div className="app app--desktop">
        {toolbar}
        <div className="app__body">
          <aside className="app__side app__side--left">{tree}</aside>
          <main className="app__center">{viewport}</main>
          <aside className="app__side app__side--right">{inspector}</aside>
        </div>
        {/* On the desktop too, unlike the move bar: paint mode takes the canvas
            over, and the way out of a mode belongs on the surface the mode has
            taken — not in a panel the user may have scrolled away from. */}
        <TileBar />
        {helpSurface}
      </div>
    );
  }

  const tabRefs = { scene: sceneTab, inspect: inspectTab, file: fileTab };
  const close = (closed: Exclude<MobileTab, null>) => {
    setTab(null);
    requestAnimationFrame(() => tabRefs[closed].current?.focus());
  };
  const toggle = (next: Exclude<MobileTab, null>) => {
    if (tab === next) close(next);
    else setTab(next);
  };

  return (
    <div className={`app app--mobile ${tab ? 'has-sheet' : ''}`}>
      {toolbar}
      <main className="app__center">{viewport}</main>

      <Sheet open={tab === 'scene'} title="Scene" onClose={() => close('scene')}>
        {tree}
      </Sheet>
      <Sheet open={tab === 'inspect'} title="Properties" onClose={() => close('inspect')}>
        {inspector}
      </Sheet>
      <Sheet open={tab === 'file'} title="File" onClose={() => close('file')}>
        {fileMenu}
      </Sheet>
      {helpSurface}

      {/* Both hidden while a sheet is open: the sheet already occupies that
          space, and the object being edited is up in the canvas band anyway.
          Never both at once either — a tilemap being painted is not a tilemap
          being moved, and two stacked bars is most of a 390px screen. */}
      {tab === null && <TileBar />}
      {tab === null && !painting && <MoveBar />}

      <nav className="tabbar">
        <TabButton label="Scene" icon="☰" active={tab === 'scene'} onClick={() => toggle('scene')} buttonRef={sceneTab} />
        <TabButton
          label="Properties"
          icon="⚙"
          active={tab === 'inspect'}
          onClick={() => toggle('inspect')}
          buttonRef={inspectTab}
        />
        <TabButton label="File" icon="⬒" active={tab === 'file'} onClick={() => toggle('file')} buttonRef={fileTab} />
      </nav>
    </div>
  );
}
