import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import {
  countPrefabSpawns,
  countPrefabUses,
  useActiveScene,
  useEditorStore,
  usePrefabs,
  useScenes,
} from '../core/store';
import { findParent, type GameObjectNode, type NodeType, type Prefab } from '../core/schema';
import { TextField } from './fields';
import {
  ancestorIdsOf,
  FOCUS_TREE_FILTER_EVENT,
  filterTree,
  groupIdsOf,
  highlightParts,
  type TreeFilter,
} from './treeFilter';

/**
 * The object types the add row offers.
 *
 * `instance` is deliberately absent, and this is not an oversight: an instance
 * has to name a prefab, and a `+ Instance` button could only ever produce one
 * pointing at nothing. Prefabs are placed from `PrefabsSection` below, where
 * each button already knows which definition it is placing.
 */
const ADDABLE: { type: NodeType; label: string }[] = [
  { type: 'rectangle', label: 'Rectangle' },
  { type: 'ellipse', label: 'Ellipse' },
  { type: 'text', label: 'Text' },
  { type: 'sprite', label: 'Image' },
  // "Panel" and "Tiled" rather than "Nine-slice" and "Tile sprite", by the rule
  // that already labels a tilemap "Tiles": every label is a column the 260px
  // tree has to find room for. Neither word collides with the mobile tab bar's
  // exactly-matched Scene / Properties / File.
  { type: 'nineslice', label: 'Panel' },
  { type: 'tileSprite', label: 'Tiled' },
  { type: 'container', label: 'Group' },
  // "Tiles" rather than "Tilemap": the add row is an auto-fit grid of `nowrap`
  // buttons, so every label is a column the 260px tree has to find room for.
  { type: 'tilemap', label: 'Tiles' },
  { type: 'particles', label: 'Particles' },
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
  const multiSelect = useEditorStore((s) => s.multiSelect);
  const setMultiSelect = useEditorStore((s) => s.setMultiSelect);
  const selectedCount = useEditorStore((s) => s.selectedIds.length);

  // Drag-to-reorder is HTML5 drag and drop, which touch browsers ignore
  // entirely. That is why the inspector carries an Arrange row and a Parent
  // field: this is the pointer shortcut, not the only way to nest or to change
  // draw order.
  const [dragId, setDragId] = useState<string | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState('');
  const filterInput = useRef<HTMLInputElement>(null);
  const treeList = useRef<HTMLUListElement>(null);
  const filter = useMemo(() => filterTree(scene.children, query), [scene.children, query]);
  const groupIds = useMemo(() => groupIdsOf(scene.children), [scene.children]);
  const primaryId = useEditorStore((s) => s.selectedIds[s.selectedIds.length - 1] ?? null);

  // Reveal the selection. A press on the canvas can select a child of a group
  // the tree has collapsed, which would leave the one row that says what was
  // picked out of sight. So the groups above the primary selection are opened
  // — only those, and only when one was closed, so the Set keeps its identity
  // otherwise — and the row is scrolled to.
  //
  // The scroll is done by hand on the nearest scrolling ancestor rather than
  // with `scrollIntoView`, which also scrolls every ancestor up to the page:
  // on a phone the Scene panel is a sheet translated off-screen while closed,
  // and scrolling the document to reach it would shift the canvas under the
  // user's thumb. A filter that hides the row is left alone — the user asked
  // for it, and the selection is kept, only not shown.
  useEffect(() => {
    if (!primaryId) return;
    const above = ancestorIdsOf(scene.children, primaryId);
    setCollapsed((current) => {
      if (!above.some((id) => current.has(id))) return current;
      const next = new Set(current);
      for (const id of above) next.delete(id);
      return next;
    });
    const frame = requestAnimationFrame(() => {
      const row = treeList.current?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(primaryId)}"]`);
      if (row) scrollRowIntoView(row);
    });
    return () => cancelAnimationFrame(frame);
    // Keyed on the id alone: re-running on every document change would undo a
    // collapse the user makes while the selection sits inside that group.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryId]);

  // The `/` shortcut. `App.tsx` sends it and `Layout` opens the Scene sheet on
  // a phone. An opening sheet focuses its own first control from an effect a
  // frame or two later, which would take the focus straight back, so this
  // holds it for a few frames rather than trusting one.
  useEffect(() => {
    const focus = () => {
      let frames = 8;
      const hold = () => {
        const input = filterInput.current;
        if (input && document.activeElement !== input) input.focus();
        if ((frames -= 1) > 0) requestAnimationFrame(hold);
      };
      requestAnimationFrame(hold);
    };
    window.addEventListener(FOCUS_TREE_FILTER_EVENT, focus);
    return () => window.removeEventListener(FOCUS_TREE_FILTER_EVENT, focus);
  }, []);

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
        <span className="panel__count">
          {filter
            ? `${filter.matches.size} of ${countNodes(scene.children)}`
            : selectedCount > 1
              ? `${selectedCount} of ${countNodes(scene.children)}`
              : countNodes(scene.children)}
        </span>
        {/* The one control that changes what every row below it does, so it
            sits with them rather than in the inspector. Shift-click does the
            same thing on a desktop; a phone has no modifier key at all, which
            is why this exists. */}
        <button
          className={`btn btn--toggle ${multiSelect ? 'is-active' : ''}`}
          aria-pressed={multiSelect}
          title="Tap objects to add them to the selection"
          onClick={() => setMultiSelect(!multiSelect)}
        >
          Multi
        </button>
      </div>

      <ScenesSection />

      <div className="add-row">
        {ADDABLE.map(({ type, label }) => (
          <button key={type} className="btn btn--add" onClick={() => addNode(type)}>
            + {label}
          </button>
        ))}
      </div>

      {scene.children.length > 0 && (
        <div className="tree-tools">
          {/* A search input rather than the shared TextField: that one is a
              labelled document field with an undo transaction behind it, and
              this edits nothing. "Filter objects" collides with none of the
              mobile tab bar's exactly-matched Scene / Properties / File. */}
          <input
            ref={filterInput}
            className="tree-filter"
            type="search"
            aria-label="Filter objects"
            placeholder="Filter by name or type"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                // Clears the filter and nothing else: without the stop, App's
                // own Escape would also clear the selection.
                event.stopPropagation();
                if (query !== '') {
                  event.preventDefault();
                  setQuery('');
                } else {
                  event.currentTarget.blur();
                }
              } else if (event.key === 'ArrowDown') {
                const first = treeList.current?.querySelector<HTMLButtonElement>('.tree__label[data-tree-object]');
                if (first) {
                  event.preventDefault();
                  first.focus();
                }
              }
            }}
          />
          {groupIds.length > 0 && (
            <>
              {/* Disabled while filtering: the filter forces every group on a
                  match's path open, so these would change nothing visible and
                  then surprise the user when the filter is cleared. */}
              <button
                className="icon-btn"
                aria-label="Expand all groups"
                title="Expand all groups"
                disabled={filter !== null || collapsed.size === 0}
                onClick={() => setCollapsed(new Set())}
              >
                ⊞
              </button>
              <button
                className="icon-btn"
                aria-label="Collapse all groups"
                title="Collapse all groups"
                disabled={filter !== null || groupIds.every((id) => collapsed.has(id))}
                onClick={() => setCollapsed(new Set(groupIds))}
              >
                ⊟
              </button>
            </>
          )}
        </div>
      )}

      <ul className="tree" aria-label="Scene objects" ref={treeList}>
        <TreeRows
          nodes={scene.children}
          depth={0}
          dragId={dragId}
          target={target}
          collapsed={collapsed}
          filter={filter}
          query={query}
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
      {filter && filter.matches.size === 0 && (
        <p className="empty">No objects match “{query.trim()}”.</p>
      )}

      <PrefabsSection />
    </div>
  );
}

/**
 * The scene switcher: one chip per scene, plus the button that adds another.
 *
 * It sits in the scene panel, above the objects, for the reason the prefab
 * library sits below them — that panel is on screen at all times, while the
 * inspector's `SceneInspector` appears only when *nothing* is selected, so
 * putting the switcher there would mean deselecting before every switch. The
 * scene's own fields stay in the inspector, and so do duplicate and delete:
 * those are about the scene you are in rather than about which one that is,
 * and a delete button in a row you tap to switch scenes is a delete button
 * under a thumb aiming at the chip beside it.
 *
 * The row is hidden entirely for a one-scene project. A switcher with one chip
 * offers nothing to switch to, and most projects have one scene — but the
 * `+ Scene` button has to stay visible, since it is the only way to reach the
 * second one.
 *
 * A chip's accessible name is `Switch to <name>`, not the bare scene name. The
 * mobile tab bar's labels are single common words matched *exactly*, so a scene
 * a user calls "Scene" would otherwise put a second button reading exactly
 * "Scene" on the page — the trap the prefab buttons' `+ ` prefix exists for,
 * arriving here by a different route because a switcher chip has no prefix to
 * give it.
 */
function ScenesSection() {
  const scenes = useScenes();
  const activeId = useActiveScene().id;
  const setActiveScene = useEditorStore((s) => s.setActiveScene);
  const addScene = useEditorStore((s) => s.addScene);

  return (
    <>
      <div className="panel__section">Scenes</div>
      <div className="add-row">
        {scenes.length > 1 &&
          scenes.map((scene) => (
            <button
              key={scene.id}
              className={`btn btn--add ${scene.id === activeId ? 'is-active' : ''}`}
              aria-pressed={scene.id === activeId}
              aria-label={`Switch to ${scene.name}`}
              onClick={() => setActiveScene(scene.id)}
            >
              {scene.name}
            </button>
          ))}
        <button className="btn btn--add" onClick={addScene}>
          + Scene
        </button>
      </div>
    </>
  );
}

/**
 * The prefab library, as one placing button per definition — and, behind one
 * toggle, the definitions' own controls.
 *
 * It lives in the scene panel rather than in the inspector or a fourth mobile
 * tab for two reasons. Placing needs no selection, while the inspector's scene
 * panel only appears when *nothing* is selected — so putting it there would
 * mean deselecting first every time. And the tab bar holds exactly three tabs;
 * a fourth costs a `MobileTab`, a sheet, and a quarter of the width of a 390px
 * bar to say something the always-visible panel can say for free.
 *
 * Every button keeps the `+ ` prefix. That is not decoration: the mobile tab
 * bar's labels are single common words matched exactly, so a prefab a user
 * names "Scene" would otherwise be a second button reading exactly "Scene".
 *
 * **Rename and delete are here as well as on an instance's panel**, because a
 * prefab that only a rule's `spawn` builds is placed nowhere, and until they
 * were, a definition nothing placed had no controls anywhere: renaming the
 * exported factory or deleting the definition meant placing one first. The
 * instance's panel keeps its copy — one field, two controls, both writing
 * `renamePrefab`, which is the tile eraser's rule.
 *
 * They sit behind a single "Manage prefabs" toggle rather than always open, and
 * the reason is where this panel is: on screen at all times, with the tree
 * underneath it on a phone sheet. Three rows per prefab would push every object
 * down for an action taken a handful of times in a project's life. A per-prefab
 * button in the grid was the other shape, and a grid cell cannot hold a card.
 * Whether it is open is editor state held here, like the tree's collapsed
 * groups — never saved and never undoable.
 */
function PrefabsSection() {
  const prefabs = usePrefabs();
  const placePrefab = useEditorStore((s) => s.placePrefab);
  const [managing, setManaging] = useState(false);

  // A library nobody has put anything in is not worth a heading: the way to
  // make a prefab is to select objects, which the inspector then offers.
  if (prefabs.length === 0) return null;

  return (
    <>
      <div className="panel__section">Prefabs</div>
      <div className="add-row">
        {prefabs.map((prefab) => (
          <button
            key={prefab.id}
            className="btn btn--add"
            onClick={() => placePrefab(prefab.id)}
            title={`Place ${prefab.name}`}
          >
            + {prefab.name}
          </button>
        ))}
      </div>
      <button
        className={`btn btn--add btn--block ${managing ? 'is-active' : ''}`}
        aria-pressed={managing}
        onClick={() => setManaging(!managing)}
        title="Rename or delete a prefab, placed or not"
      >
        Manage prefabs
      </button>
      {managing &&
        prefabs.map((prefab, index) => (
          <PrefabCard key={prefab.id} prefab={prefab} index={index + 1} />
        ))}
    </>
  );
}

/**
 * One definition's controls: its name, where it is used, and deleting it.
 *
 * The field is `Prefab <n> name`, indexed the way `Variable <n> name` and
 * `Rule <n> name` are, and it must not be the inspector's `Prefab name`: on the
 * desktop layout this panel and the inspector are on screen together, so with
 * an instance selected both fields are visible at once and a label matched
 * exactly would name two of them.
 *
 * The delete button carries the prefab's name for the same reason in the other
 * direction — the inspector's is a bare `Delete prefab` and the tree's rows are
 * `Delete <object>`, so a named `Delete prefab <name>` collides with neither.
 * No confirm, which is the inspector's button's call: it is one undo step.
 */
function PrefabCard({ prefab, index }: { prefab: Prefab; index: number }) {
  // Both counts are plain numbers, so selecting them is safe — unlike every
  // reader in `schema.ts` that builds a fresh object per call.
  const uses = useEditorStore((s) => countPrefabUses(s.project, prefab.id));
  const spawns = useEditorStore((s) => countPrefabSpawns(s.project, prefab.id));
  const renamePrefab = useEditorStore((s) => s.renamePrefab);
  const removePrefab = useEditorStore((s) => s.removePrefab);

  return (
    <div className="prefab-card">
      <TextField
        label={`Prefab ${index} name`}
        value={prefab.name}
        onChange={(name) => renamePrefab(prefab.id, name)}
      />
      <p className="hint" title={`Prefab ${index} use`}>
        {prefabUsage(uses, spawns)}
      </p>
      <button
        className="btn btn--block btn--danger"
        onClick={() => removePrefab(prefab.id)}
        title={prefabRemovalSummary(uses, spawns)}
      >
        Delete prefab {prefab.name}
      </button>
    </div>
  );
}

const plural = (count: number, word: string): string =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * Where a definition is used, in words.
 *
 * The third case is the one worth having this for: a definition that is placed
 * nowhere and built by no rule is dead weight in the export's factory list, and
 * this is the only place in the editor that can say so.
 */
function prefabUsage(uses: number, spawns: number): string {
  if (uses === 0 && spawns === 0) return 'Placed nowhere and built by nothing.';
  if (uses === 0) return `Placed nowhere — only rules build it (${plural(spawns, 'spawn action')}).`;
  const placed = uses === 1 ? 'Placed once' : `Placed ${uses} times`;
  return spawns === 0 ? `${placed}.` : `${placed} · built by ${plural(spawns, 'spawn action')}.`;
}

/**
 * What deleting a prefab is about to do, for the title of every button that
 * does it — the library's and an instance's panel alike, so the two cannot
 * drift apart about a press that detaches instances and strips rule actions.
 */
export function prefabRemovalSummary(uses: number, spawns: number): string {
  return (
    `Detaches ${plural(uses, 'instance')}` +
    (spawns > 0 ? `, removes ${plural(spawns, 'spawn action')}` : '') +
    ' and removes the prefab'
  );
}

interface RowsProps {
  nodes: GameObjectNode[];
  depth: number;
  dragId: string | null;
  target: DropTarget | null;
  collapsed: ReadonlySet<string>;
  /** Null when no filter is on; otherwise only `visible` rows render, with their groups forced open. */
  filter: TreeFilter | null;
  query: string;
  onToggleCollapsed: (id: string) => void;
  onDragStart: (id: string) => void;
  onHover: (target: DropTarget | null) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

function TreeRows(props: RowsProps) {
  const { nodes, depth, dragId, target, collapsed, filter, query } = props;
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const multiSelect = useEditorStore((s) => s.multiSelect);
  const select = useEditorStore((s) => s.select);
  const toggleSelect = useEditorStore((s) => s.toggleSelect);
  const deleteNode = useEditorStore((s) => s.deleteNode);
  const setNodeVisible = useEditorStore((s) => s.setNodeVisible);

  /**
   * A row click replaces the selection, unless the multi toggle is on or a
   * modifier is held — then it adds or removes this one row. The two ways to
   * say "and this one as well" go through the same branch so they cannot drift
   * apart.
   */
  const pick = (event: MouseEvent<HTMLButtonElement>, id: string) => {
    if (multiSelect || event.shiftKey || event.ctrlKey || event.metaKey) toggleSelect(id);
    else select(id);
  };

  const navigate = (event: KeyboardEvent<HTMLButtonElement>, node: GameObjectNode) => {
    const labels = [...document.querySelectorAll<HTMLButtonElement>('.tree__label[data-tree-object]')];
    const index = labels.indexOf(event.currentTarget);
    let next = index;
    if (event.key === 'ArrowDown') next += 1;
    else if (event.key === 'ArrowUp') next -= 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = labels.length - 1;
    else if (event.key === 'ArrowRight' && node.type === 'container' && collapsed.has(node.id)) props.onToggleCollapsed(node.id);
    else if (event.key === 'ArrowLeft' && node.type === 'container' && !collapsed.has(node.id)) props.onToggleCollapsed(node.id);
    else return;
    event.preventDefault();
    labels[Math.max(0, Math.min(labels.length - 1, next))]?.focus();
  };

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
        if (filter && !filter.visible.has(node.id)) return null;
        // A filter opens every group on a match's path without touching
        // `collapsed`, so clearing it puts back exactly what the user had.
        const isOpen = node.children.length > 0 && (filter !== null || !collapsed.has(node.id));
        // Shown only as the ancestry of a match, not a match itself.
        const isContext = filter !== null && !filter.matches.has(node.id);
        return (
          <li key={node.id} className="tree__group">
            <div
              data-node-id={node.id}
              className={[
                'tree__item',
                isContext ? 'is-context' : '',
                selectedIds.includes(node.id) ? 'is-selected' : '',
                node.id === dragId ? 'is-dragging' : '',
                target?.id === node.id && target.kind === 'into' ? 'is-drop-into' : '',
                target?.id === node.id && target.kind === 'before' ? 'is-drop-before' : '',
                target?.id === node.id && target.kind === 'after' ? 'is-drop-after' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              // Off while filtering: a drop between filtered rows would land
              // relative to siblings the user cannot see.
              draggable={filter === null}
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
                  disabled={node.children.length === 0 || filter !== null}
                  onClick={() => props.onToggleCollapsed(node.id)}
                >
                  {node.children.length === 0 ? '·' : isOpen ? '▾' : '▸'}
                </button>
              ) : (
                <span className="tree__twisty" />
              )}
              <button className="tree__label" data-tree-object aria-pressed={selectedIds.includes(node.id)} aria-label={`${node.name}, ${node.type}${isContext ? ', contains a match' : ''}`} onKeyDown={(event) => navigate(event, node)} onClick={(event) => pick(event, node.id)}>
                <span className="tree__type" data-type={node.type} />
                <span className="tree__name">
                  {filter && !isContext
                    ? highlightParts(node.name, query).map((part, index) =>
                        part.hit ? <mark key={index}>{part.text}</mark> : part.text,
                      )
                    : node.name}
                </span>
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

/**
 * Scrolls a row into its nearest scrolling ancestor, and nothing further out.
 * See the reveal effect in `SceneTree` for why `scrollIntoView` is not used.
 */
function scrollRowIntoView(row: HTMLElement): void {
  for (let box = row.parentElement; box; box = box.parentElement) {
    const overflow = getComputedStyle(box).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && box.scrollHeight > box.clientHeight) {
      const outer = box.getBoundingClientRect();
      const inner = row.getBoundingClientRect();
      if (inner.top < outer.top) box.scrollTop -= outer.top - inner.top;
      else if (inner.bottom > outer.bottom) box.scrollTop += inner.bottom - outer.bottom;
      return;
    }
  }
}
