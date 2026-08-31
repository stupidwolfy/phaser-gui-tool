import { useState, type DragEvent } from 'react';
import { useActiveScene, useEditorStore } from '../core/store';
import type { NodeType } from '../core/schema';

const ADDABLE: { type: NodeType; label: string }[] = [
  { type: 'rectangle', label: 'Rectangle' },
  { type: 'ellipse', label: 'Ellipse' },
  { type: 'text', label: 'Text' },
];

/**
 * Lists the objects in the active scene and lets you add, hide, delete or
 * reorder them. The list is the array in document order, which is also draw
 * order — the first row is the object furthest back.
 */
export function SceneTree() {
  const scene = useActiveScene();
  const selectedId = useEditorStore((s) => s.selectedId);
  const select = useEditorStore((s) => s.select);
  const addNode = useEditorStore((s) => s.addNode);
  const deleteNode = useEditorStore((s) => s.deleteNode);
  const setNodeVisible = useEditorStore((s) => s.setNodeVisible);
  const reorderNode = useEditorStore((s) => s.reorderNode);

  // Drag-to-reorder is HTML5 drag and drop, which touch browsers ignore
  // entirely. That is why the inspector carries an Arrange row: this is the
  // pointer shortcut, not the only way to change draw order.
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);

  const endDrag = () => {
    setDragId(null);
    setDropAt(null);
  };

  const dropOn = (insertAt: number) => {
    if (dragId) {
      const from = scene.children.findIndex((node) => node.id === dragId);
      // `insertAt` is a gap in the list as it looks now; reorderNode splices
      // into the array with the dragged node already pulled out of it.
      if (from !== -1) reorderNode(dragId, insertAt > from ? insertAt - 1 : insertAt);
    }
    endDrag();
  };

  const overRow = (event: DragEvent<HTMLLIElement>, index: number) => {
    if (!dragId) return;
    event.preventDefault();
    const box = event.currentTarget.getBoundingClientRect();
    setDropAt(event.clientY < box.top + box.height / 2 ? index : index + 1);
  };

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
        {scene.children.map((node, index) => (
          <li
            key={node.id}
            className={[
              'tree__item',
              node.id === selectedId ? 'is-selected' : '',
              node.id === dragId ? 'is-dragging' : '',
              dropAt === index ? 'is-drop-before' : '',
              dropAt === scene.children.length && index === scene.children.length - 1
                ? 'is-drop-after'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            draggable
            onDragStart={(event) => {
              setDragId(node.id);
              event.dataTransfer.effectAllowed = 'move';
              // Firefox starts no drag at all without payload on the transfer.
              event.dataTransfer.setData('text/plain', node.id);
            }}
            onDragOver={(event) => overRow(event, index)}
            onDrop={(event) => {
              event.preventDefault();
              dropOn(dropAt ?? index);
            }}
            onDragEnd={endDrag}
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
