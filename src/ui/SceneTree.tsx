import { useActiveScene, useEditorStore } from '../core/store';
import type { NodeType } from '../core/schema';

const ADDABLE: { type: NodeType; label: string }[] = [
  { type: 'rectangle', label: 'Rectangle' },
  { type: 'ellipse', label: 'Ellipse' },
  { type: 'text', label: 'Text' },
];

/** Lists the objects in the active scene and lets you add, hide, or delete them. */
export function SceneTree() {
  const scene = useActiveScene();
  const selectedId = useEditorStore((s) => s.selectedId);
  const select = useEditorStore((s) => s.select);
  const addNode = useEditorStore((s) => s.addNode);
  const deleteNode = useEditorStore((s) => s.deleteNode);
  const setNodeVisible = useEditorStore((s) => s.setNodeVisible);

  return (
    <div className="panel">
      <div className="panel__header">
        <span>{scene.name}</span>
        <span className="panel__count">{scene.children.length}</span>
      </div>

      <div className="add-row">
        {ADDABLE.map(({ type, label }) => (
          <button key={type} className="btn btn--add" onClick={() => addNode(type)}>
            + {label}
          </button>
        ))}
      </div>

      <ul className="tree">
        {scene.children.map((node) => (
          <li
            key={node.id}
            className={`tree__item ${node.id === selectedId ? 'is-selected' : ''}`}
          >
            <button className="tree__label" onClick={() => select(node.id)}>
              <span className="tree__type" data-type={node.type} />
              <span className="tree__name">{node.name}</span>
            </button>
            <button
              className="icon-btn"
              aria-label={node.visible ? `Hide ${node.name}` : `Show ${node.name}`}
              title={node.visible ? 'Hide' : 'Show'}
              onClick={() => setNodeVisible(node.id, !node.visible)}
            >
              {node.visible ? '◉' : '○'}
            </button>
            <button
              className="icon-btn icon-btn--danger"
              aria-label={`Delete ${node.name}`}
              title="Delete"
              onClick={() => deleteNode(node.id)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {scene.children.length === 0 && (
        <p className="empty">This scene is empty. Add an object above.</p>
      )}
    </div>
  );
}
