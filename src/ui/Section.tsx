import type { ReactNode } from 'react';
import { useEditorStore } from '../core/store';

/**
 * One collapsible section of the inspector.
 *
 * The panel grew a section per iteration and never grew a way to put one away:
 * a tilemap carrying a dynamic body renders eighteen at once, which on a phone
 * is a 55vh sheet of unbroken scroll. Each one is now a disclosure, separated
 * from its neighbours and closed until asked for.
 *
 * A button with `aria-expanded` rather than `<details>/<summary>`: the open
 * state lives in the store so that it can survive a selection change and a
 * reload, and `<details>` keeps state of its own that would fight it. It is
 * also the shape `.rule__summary` already uses a few rows down the same panel,
 * so the inspector gains no second idiom for the same idea.
 *
 * **Sections do not nest.** Every one is a flat peer, which is what the panel
 * already looked like when the headings were bare labels, and what keeps any
 * control one press away rather than two. A component that renders a section
 * and then a nested one closes its own before the next begins.
 *
 * A closed body is unmounted rather than hidden, which is also what `RuleCard`
 * a few rows down already does. On a panel that can hold eighteen sections that
 * is the cheaper half — every field in a closed one would otherwise go on
 * subscribing to the store and re-rendering through a canvas drag — and hiding
 * would not have helped the suite anyway, since Playwright refuses to click
 * what it cannot see. The one visible consequence is that collapsing a section
 * clears an import error showing inside it, the treatment closing a sheet
 * already gives.
 *
 * **Collapsing must always move focus out of the body first.** `NumberField`
 * opens an undo transaction on focus and closes it on blur, and unmounting a
 * focused input fires no blur — which would strand `txDepth` above zero and
 * poison undo for the rest of the session. Pressing the head does move focus,
 * so this holds today; a toggle driven from anywhere that does not (a keyboard
 * shortcut, say) has to blur the panel itself.
 */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  const open = useEditorStore(
    (s) => s.sectionOverrides[title] ?? s.sectionsOpenByDefault,
  );
  const toggleSection = useEditorStore((s) => s.toggleSection);

  return (
    <section className={`section ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="section__head"
        aria-expanded={open}
        onClick={() => toggleSection(title)}
      >
        <span className="section__title">{title}</span>
        {/* Its own element, and aria-hidden: the title has to stay a text node
            of its own or an exact-text locator stops matching the heading —
            which is what `physics.spec.ts` asserts a missing section with. */}
        <span className="section__chevron" aria-hidden="true">
          ▸
        </span>
      </button>
      {open && (
        <div className="section__body">
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * Opens or closes every section at once, for the inspector's own header.
 *
 * Earns its place on a panel that can hold eighteen of them, and it is also the
 * only control that can reach a section which is not on screen — `setAllSections`
 * moves the default rather than naming titles, for exactly that reason.
 */
export function SectionsToggle() {
  // Reads the default alone, deliberately, and not the overrides beside it.
  // Folding those in to make the button describe "what the panel looks like
  // right now" reads as the more honest option and is the opposite: the
  // overrides map spans every panel, so a section left closed on the *scene*
  // panel would have an object's fully-open panel offering Expand. The default
  // is the only thing this button sets, so it is the only thing it should
  // report — and pressing it is correct either way, because `setAllSections`
  // clears the overrides that would otherwise contradict it.
  const openByDefault = useEditorStore((s) => s.sectionsOpenByDefault);
  const setAllSections = useEditorStore((s) => s.setAllSections);

  const label = openByDefault ? 'Collapse all sections' : 'Expand all sections';

  return (
    <button
      type="button"
      className="icon-btn panel__tool"
      // Never a bare "Expand"/"Collapse": the mobile tab bar matches single
      // common words exactly, and a one-word button here is how seventeen
      // mobile tests once failed at once, nowhere near the control that did it.
      title={label}
      aria-label={label}
      onClick={() => setAllSections(!openByDefault)}
    >
      {openByDefault ? '⌃' : '⌄'}
    </button>
  );
}
