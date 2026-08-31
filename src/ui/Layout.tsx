import { useState, type ReactNode } from 'react';
import { Sheet } from './Sheet';

export type MobileTab = 'scene' | 'inspect' | 'file' | null;

function TabButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`tabbar__btn ${active ? 'is-active' : ''}`}
      aria-pressed={active}
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
}: {
  isMobile: boolean;
  toolbar: ReactNode;
  viewport: ReactNode;
  tree: ReactNode;
  inspector: ReactNode;
  /** Mobile only — on desktop these actions live in the toolbar. */
  fileMenu: ReactNode;
}) {
  const [tab, setTab] = useState<MobileTab>(null);

  if (!isMobile) {
    return (
      <div className="app app--desktop">
        {toolbar}
        <div className="app__body">
          <aside className="app__side app__side--left">{tree}</aside>
          <main className="app__center">{viewport}</main>
          <aside className="app__side app__side--right">{inspector}</aside>
        </div>
      </div>
    );
  }

  const toggle = (next: Exclude<MobileTab, null>) =>
    setTab((current) => (current === next ? null : next));

  return (
    <div className={`app app--mobile ${tab ? 'has-sheet' : ''}`}>
      {toolbar}
      <main className="app__center">{viewport}</main>

      <Sheet open={tab === 'scene'} title="Scene" onClose={() => setTab(null)}>
        {tree}
      </Sheet>
      <Sheet open={tab === 'inspect'} title="Properties" onClose={() => setTab(null)}>
        {inspector}
      </Sheet>
      <Sheet open={tab === 'file'} title="File" onClose={() => setTab(null)}>
        {fileMenu}
      </Sheet>

      <nav className="tabbar">
        <TabButton label="Scene" icon="☰" active={tab === 'scene'} onClick={() => toggle('scene')} />
        <TabButton
          label="Properties"
          icon="⚙"
          active={tab === 'inspect'}
          onClick={() => toggle('inspect')}
        />
        <TabButton label="File" icon="⬒" active={tab === 'file'} onClick={() => toggle('file')} />
      </nav>
    </div>
  );
}
