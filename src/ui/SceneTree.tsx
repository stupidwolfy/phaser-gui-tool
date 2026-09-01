import { useState, type DragEvent } from 'react';
import { useActiveScene, useEditorStore } from '../core/store';
import { findParent, type GameObjectNode, type NodeType } from '../core/schema';

const ADDABLE: { type: NodeType; label: string }[] = [
  { type: 'rectangle', label: 'Rectangle' },
  { type: 'ellipse', label: 'Ellipse' },
  { type: 'text', label: 'Text' },
  { type: 'sprite', label: 'Image' },
  { type: 'container', label: 'Group' },
];

/** How far each level of nesting steps in, in pixels. */
const INDENT = 14;

/**
 * Where a drag would drop: into a container, or between two rows in the list
 * the hovered row belongs to.
 *
 * Keeping those apart is the whole of drag-to-nest. A single "drop on this row"
 * target cannot express both, and a group is exactly the row where the user
 * means each of them about half the time.
 */
type DropTarget = { kind: 'into' | 'before' | 'after'; id: string };

const countNodes = (nodes: GameObjectNode[]): number =>
  nodes.reduce((total, node) => total + 1 + countNodes(node.children), 0);

/**
 * Lists the objects in the active scene and lets you add, hide, delete, nest or
 * reorder them. The list is the array in document order, which is also draw
 * order — the first row is the object furthest back — and a group's children
 * are the same thing one level down.
 */
export function SceneTree() {
  const scene = useActiveScene();
  const addNode = useEditorStore((s) => s.addNode);
  const moveNode = useEditorStore((s) => s.moveNode);

  // Drag-to-reorder is HTML5 drag and drop, which touch browsers ignore
  // entirely. That is why the inspector carries an Arrange row and a Parent
  // field: this is the pointer shortcut, not the only way to nest or to change
  // draw order.
  const [dragId, setDragId] = useState<string | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const endDrag = () => {
    setDragId(null);
    setTarget(null);
  };

  const toggleCollapsed = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const drop = () => {
    if (!dragId || !target) return endDrag();

    if (target.kind === 'into') {
      // Appended: a drop onto the group itself says which group, not where in
      // it, and the end of the list is the one answer that needs no guessing.
      moveNode(dragId, target.id);
    } else {
      const parent = findParent(scene.children, target.id);
      const list = parent ? parent.children : scene.children;
      const index = list.findIndex((node) => node.id === target.id);
      let insertAt = target.kind === 'before' ? index : index + 1;
      // The gap is in the list as it looks now; moveNode splices with the
      // dragged node already pulled out of it.
      const from = list.findIndex((node) => node.id === dragId);
      if (from !== -1 && from < insertAt) insertAt -= 1;
      moveNode(dragId, parent?.id ?? null, insertAt);
    }
    endDrag();
  };

  return (
    <div className="panel">
      <div className="panel__header">
        <span>{scene.name}</span>
        <span className="panel__count">{countNodes(scene.children)}</span>
      </div>

      <div className="add-row">
        {ADDABLE.map(({ type, label }) => (
          <button key={type} className="btn btn--add" onClick={() => addNode(type)}>
            + {label}
          </button>
        ))}
      </div>

      <ul className="tree">
        <TreeRows
          nodes={scene.children}
          depth={0}
          dragId={dragId}
          target={target}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          onDragStart={setDragId}
          onHover={setTarget}
          onDrop={drop}
          onDragEnd={endDrag}
        />
      </ul>

      {scene.children.length === 0 && (
        <p className="empty">This scene is empty. Add an object above.</p>
      )}
    </div>
  );
}

interface RowsProps {
  nodes: GameObjectNode[];
  depth: number;
  dragId: string | null;
  target: DropTarget | null;
  collapsed: ReadonlySet<string>;
  onToggleCollapsed: (id: string) => void;
  onDragStart: (id: string) => void;
  onHover: (target: DropTarget | null) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

function TreeRows(props: RowsProps) {
  const { nodes, depth, dragId, target, collapsed } = props;
  const selectedId = useEditorStore((s) => s.selectedId);
  const select = useEditorStore((s) => s.select);
  const deleteNode = useEditorStore((s) => s.deleteNode);
  const setNodeVisible = useEditorStore((s) => s.setNodeVisible);

  /**
   * A drop on the middle of a container row nests; anywhere else, and any drop
   * on anything that is not a container, reorders. The bands are generous
   * enough that "into" is reachable without precision, and the top and bottom
   * quarters still let you land a node immediately above or below a group.
   */
  const hover = (event: DragEvent<HTMLDivElement>, node: GameObjectNode) => {
    if (!dragId) return;
    event.preventDefault();
    event.stopPropagation();
    const box = event.currentTarget.getBoundingClientRect();
    const position = (event.clientY - box.top) / box.height;
    if (node.type === 'container' && node.id !== dragId && position > 0.25 && position < 0.75) {
      props.onHover({ kind: 'into', id: node.id });
    } else {
      props.onHover({ kind: position < 0.5 ? 'before' : 'after', id: node.id });
    }
  };

  return (
    <>
      {nodes.map((node) => {
        const isOpen = node.children.length > 0 && !collapsed.has(node.id);
        return (
          <li key={node.id} className="tree__group">
            <div
              className={[
                'tree__item',
                node.id === selectedId ? 'is-selected' : '',
                node.id === dragId ? 'is-dragging' : '',
                target?.id === node.id && target.kind === 'into' ? 'is-drop-into' : '',
                target?.id === node.id && target.kind === 'before' ? 'is-drop-before' : '',
                target?.id === node.id && target.kind === 'after' ? 'is-drop-after' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              draggable
              onDragStart={(event) => {
                props.onDragStart(node.id);
                event.dataTransfer.effectAllowed = 'move';
                // Firefox starts no drag at all without payload on the transfer.
                event.dataTransfer.setData('text/plain', node.id);
              }}
              onDragOver={(event) => hover(event, node)}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                props.onDrop();
              }}
              onDragEnd={props.onDragEnd}
            >
              <span className="tree__indent" style={{ width: depth * INDENT }} />
              {node.type === 'container' ? (
                <button
                  className="tree__twisty"
                  aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
                  disabled={node.children.length === 0}
                  onClick={() => props.onToggleCollapsed(node.id)}
                >
                  {node.children.length === 0 ? '·' : isOpen ? '▾' : '▸'}
                </button>
              ) : (
                <span className="tree__twisty" />
              )}
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
            </div>

            {isOpen && (
              <ul className="tree">
                <TreeRows {...props} nodes={node.children} depth={depth + 1} />
              </ul>
            )}
          </li>
        );
      })}
    </>
  );
}
