import { createContext, useContext, useEffect, useId, useRef, type ReactNode } from 'react';
import { useEditorStore } from '../core/store';
import type { ValidationIssue } from '../core/validation';
import type { SectionSummary } from './sectionSummaries';

/**
 * The validation issues about whatever the inspector is currently showing.
 *
 * Provided once by `Inspector` from `validateProject`, and read by every
 * `Section` for the issues whose `inspectorSection` is its own title — so the
 * warning a collapsed head shows is the same issue Play and export report, by
 * the same code, and no section decides for itself what counts as broken.
 */
export const SectionIssuesContext = createContext<readonly ValidationIssue[]>([]);

type ShownState = SectionSummary['state'] | 'warning' | 'invalid';

const STATE_GLYPH: Record<ShownState, string> = {
  default: '',
  configured: '●',
  mixed: '◐',
  warning: '▲',
  invalid: '●',
};

/** Said in words as well as in a glyph and a colour, for a screen reader. */
const STATE_WORD: Record<ShownState, string> = {
  default: '',
  configured: 'Configured: ',
  mixed: 'Mixed: ',
  warning: 'Warning: ',
  invalid: 'Error: ',
};

/**
 * What a collapsed head says: the caller's summary, unless validation has
 * something to say about this section, which always wins — an error over a
 * warning, and either over a summary.
 */
function shownSummary(
  summary: SectionSummary | null | undefined,
  issues: readonly ValidationIssue[],
): { text: string; state: ShownState } | null {
  const errors = issues.filter((issue) => issue.severity === 'error');
  const worst = errors.length > 0 ? errors : issues;
  if (worst.length > 0) {
    const more = worst.length > 1 ? ` (+${worst.length - 1})` : '';
    return {
      text: `${worst[0].message}${more}`,
      state: errors.length > 0 ? 'invalid' : 'warning',
    };
  }
  return summary ?? null;
}

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
export function Section({
  title,
  summary,
  children,
}: {
  title: string;
  /**
   * What the section holds, said on its head while it is collapsed. Shown only
   * collapsed: an open section shows the fields themselves, and a summary that
   * changed as they were typed into would move every control below the head.
   */
  summary?: SectionSummary | null;
  children: ReactNode;
}) {
  const bodyId = useId();
  const summaryId = useId();
  const headRef = useRef<HTMLButtonElement>(null);
  const open = useEditorStore(
    (s) => s.sectionOverrides[title] ?? s.sectionsOpenByDefault,
  );
  const toggleSection = useEditorStore((s) => s.toggleSection);
  const focusSection = useEditorStore((s) => s.validationFocusSection);
  const clearFocusSection = useEditorStore((s) => s.clearValidationFocusSection);
  const allIssues = useContext(SectionIssuesContext);
  const issues = allIssues.filter((issue) => issue.inspectorSection === title);
  const shown = open ? null : shownSummary(summary, issues);

  // An issue pressed in the issue summary opens this section through the
  // store; this is the half that brings it on screen. The head takes focus
  // rather than a field inside it, because the field an issue names is not
  // always one a control edits (a dangling id has no input of its own).
  useEffect(() => {
    if (focusSection !== title || !open) return;
    headRef.current?.scrollIntoView({ block: 'nearest' });
    headRef.current?.focus();
    clearFocusSection();
  }, [focusSection, open, title, clearFocusSection]);

  return (
    <section className={`section ${open ? 'is-open' : ''}`}>
      <button
        ref={headRef}
        type="button"
        className="section__head"
        // The name is the title and nothing else, and the summary is its
        // description. Folded into the name, a summary would change what every
        // exact-name locator — and a screen reader's list of headings — calls
        // this control each time a value changed.
        aria-label={title}
        aria-describedby={shown ? summaryId : undefined}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => toggleSection(title)}
      >
        <span className="section__title">{title}</span>
        {shown && (
          <span
            id={summaryId}
            className={`section__summary section__summary--${shown.state}`}
          >
            {STATE_GLYPH[shown.state] && (
              <span className="section__state" aria-hidden="true">
                {STATE_GLYPH[shown.state]}
              </span>
            )}
            <span className="visually-hidden">{STATE_WORD[shown.state]}</span>
            {shown.text}
          </span>
        )}
        {/* Its own element, and aria-hidden: the title has to stay a text node
            of its own or an exact-text locator stops matching the heading —
            which is what `physics.spec.ts` asserts a missing section with. */}
        <span className="section__chevron" aria-hidden="true">
          ▸
        </span>
      </button>
      {open && (
        <div className="section__body" id={bodyId}>
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
