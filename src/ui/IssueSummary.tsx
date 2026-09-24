import { useEditorStore } from '../core/store';

/** Shared, navigable result surface for Save, Play and every export. */
export function IssueSummary() {
  const issues = useEditorStore((state) => state.validationIssues);
  const focus = useEditorStore((state) => state.focusValidationIssue);
  const clear = useEditorStore((state) => state.showValidationIssues);
  if (issues.length === 0) return null;
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  return (
    <aside className="issues" aria-label="Validation issues">
      <div className="issues__header">
        <strong>{errors ? `${errors} error${errors === 1 ? '' : 's'}` : `${issues.length} warning${issues.length === 1 ? '' : 's'}`}</strong>
        <button className="btn" onClick={() => clear([])} aria-label="Dismiss validation issues">×</button>
      </div>
      <ul>
        {issues.map((issue, index) => (
          <li key={`${issue.code}:${issue.fieldPath}:${index}`}>
            <button onClick={() => focus(issue)}>
              <span aria-hidden="true">{issue.severity === 'error' ? '●' : '▲'}</span>{' '}
              {issue.message} <code>{issue.code}</code>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
