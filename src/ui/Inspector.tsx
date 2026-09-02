import { useActiveScene, useEditorStore, useSelectionNodes } from '../core/store';
import { containsNode, findParent, siblingsOf, type GameObjectNode } from '../core/schema';
import { AssetPicker, AssetSummary } from './AssetPicker';
import { CheckboxField, ColorField, NumberField, SelectField, TextField } from './fields';

/**
 * Edits the selection: one object in full, several at once through the actions
 * that make sense for a set, or the scene itself when nothing is selected.
 */
export function Inspector() {
  // The selection's roots, so picking a group and something inside it edits the
  // group rather than showing two panels' worth of the same objects.
  const nodes = useSelectionNodes();
  if (nodes.length > 1) return <SelectionInspector nodes={nodes} />;
  return nodes.length === 1 ? <NodeInspector node={nodes[0]} /> : <SceneInspector />;
}

/**
 * The multi-object panel.
 *
 * Deliberately only the operations that mean one unambiguous thing for a set —
 * group, duplicate, show/hide, delete. Position and size fields are not among
 * them: with several objects selected there is no single number to show, and a
 * field that displayed one object's value while writing to all of them is the
 * kind of control that loses work. Moving several objects is the canvas drag
 * and the arrow keys, both of which apply a delta rather than a value.
 */
function SelectionInspector({ nodes }: { nodes: GameObjectNode[] }) {
  const select = useEditorStore((s) => s.select);
  const groupSelection = useEditorStore((s) => s.groupSelection);
  const duplicateSelection = useEditorStore((s) => s.duplicateSelection);
  const deleteSelection = useEditorStore((s) => s.deleteSelection);
  const setSelectionVisible = useEditorStore((s) => s.setSelectionVisible);

  const anyVisible = nodes.some((node) => node.visible);

  return (
    <div className="panel">
      <div className="panel__header">
        <span>{nodes.length} objects</span>
        <button
          className="icon-btn icon-btn--danger"
          onClick={deleteSelection}
          title="Delete these objects"
        >
          ✕
        </button>
      </div>

      <p className="hint">Drag any one of them on the canvas to move them together.</p>

      <div className="panel__section">Selection</div>
      <div className="arrange-row">
        <button className="btn btn--add" onClick={groupSelection}>
          Group
        </button>
        <button className="btn btn--add" onClick={duplicateSelection}>
          Duplicate
        </button>
        <button className="btn btn--add" onClick={() => setSelectionVisible(!anyVisible)}>
          {anyVisible ? 'Hide' : 'Show'}
        </button>
      </div>

      <AlignSection count={nodes.length} />

      <div className="panel__section">Objects</div>
      <ul className="tree">
        {nodes.map((node) => (
          <li key={node.id} className="tree__group">
            <div className="tree__item">
              {/* Tapping one drops back to editing just that object, which is
                  the only way out of the multi panel that does not also mean
                  losing the selection you have just built. */}
              <button className="tree__label" onClick={() => select(node.id)}>
                <span className="tree__type" data-type={node.type} />
                <span className="tree__name">{node.name}</span>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Align and distribute.
 *
 * Both act on the objects' *drawn* boxes, which the renderer publishes to
 * `core/bounds` — lining up the stored x/y would line up origins, and two
 * objects of different sizes with the same origin do not look aligned.
 *
 * Alignment is relative to the selection's own bounding box, so it never moves
 * anything outside what is selected and pressing the same button twice does
 * nothing the second time. Distribute needs three objects: with two, the outer
 * pair is the whole selection and there is nothing in between to space.
 */
function AlignSection({ count }: { count: number }) {
  const alignSelection = useEditorStore((s) => s.alignSelection);
  const distributeSelection = useEditorStore((s) => s.distributeSelection);
  const canDistribute = count >= 3;

  return (
    <>
      <div className="panel__section">Align</div>
      <div className="align-grid">
        <button
          className="btn btn--add"
          title="Align left edges"
          onClick={() => alignSelection('left')}
        >
          Left
        </button>
        <button
          className="btn btn--add"
          title="Align centres horizontally"
          onClick={() => alignSelection('centerX')}
        >
          Centre
        </button>
        <button
          className="btn btn--add"
          title="Align right edges"
          onClick={() => alignSelection('right')}
        >
          Right
        </button>
        <button
          className="btn btn--add"
          title="Align top edges"
          onClick={() => alignSelection('top')}
        >
          Top
        </button>
        <button
          className="btn btn--add"
          title="Align centres vertically"
          onClick={() => alignSelection('middleY')}
        >
          Middle
        </button>
        <button
          className="btn btn--add"
          title="Align bottom edges"
          onClick={() => alignSelection('bottom')}
        >
          Bottom
        </button>
      </div>

      <div className="arrange-row">
        <button
          className="btn btn--add"
          title="Space evenly across — needs three objects"
          disabled={!canDistribute}
          onClick={() => distributeSelection('x')}
        >
          Spread ↔
        </button>
        <button
          className="btn btn--add"
          title="Space evenly down — needs three objects"
          disabled={!canDistribute}
          onClick={() => distributeSelection('y')}
        >
          Spread ↕
        </button>
      </div>
    </>
  );
}

function SceneInspector() {
  const scene = useActiveScene();
  const updateScene = useEditorStore((s) => s.updateScene);

  return (
    <div className="panel">
      <div className="panel__header">Scene</div>
      <p className="hint">Select an object to edit it.</p>

      <TextField
        label="Name"
        value={scene.name}
        onChange={(name) => updateScene({ name })}
      />
      <div className="field-row">
        <NumberField
          label="Width"
          value={scene.width}
          min={1}
          onChange={(width) => updateScene({ width })}
        />
        <NumberField
          label="Height"
          value={scene.height}
          min={1}
          onChange={(height) => updateScene({ height })}
        />
      </div>
      <ColorField
        label="Background"
        value={scene.backgroundColor}
        onChange={(backgroundColor) => updateScene({ backgroundColor })}
      />

      <SnappingSection />
    </div>
  );
}

/**
 * How a drag behaves, in the panel that is showing whenever nothing is
 * selected.
 *
 * None of this is in the document — it is not saved, not undoable, and two
 * people opening the same file may well want different answers. It sits in the
 * Scene panel anyway because that is the panel about the space objects are
 * placed in, and because a preference with no home ends up in a menu nobody
 * opens. The two toggles are mirrored in the toolbar, which is where they are
 * actually reached mid-gesture; this is where the grid's pitch is set, being a
 * number you choose once per project rather than one you flick.
 */
function SnappingSection() {
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const setSnapEnabled = useEditorStore((s) => s.setSnapEnabled);
  const gridEnabled = useEditorStore((s) => s.gridEnabled);
  const setGridEnabled = useEditorStore((s) => s.setGridEnabled);
  const gridSize = useEditorStore((s) => s.gridSize);
  const setGridSize = useEditorStore((s) => s.setGridSize);

  return (
    <>
      <div className="panel__section">Snapping</div>
      <CheckboxField label="Snap to objects" value={snapEnabled} onChange={setSnapEnabled} />
      <CheckboxField label="Snap to grid" value={gridEnabled} onChange={setGridEnabled} />
      <NumberField
        label="Grid size"
        value={gridSize}
        min={1}
        step={1}
        undoable={false}
        onChange={setGridSize}
      />
      <p className="hint">
        Dragging lines objects up with their neighbours, matches the spacing of a row you
        drop into, and — with the grid on — lands on the pitch. These are editor settings:
        they are not saved with the project.
      </p>
    </>
  );
}

/** Heading for the per-type section, which is the only thing that differs. */
const SECTION_TITLE: Record<GameObjectNode['type'], string> = {
  rectangle: 'Shape',
  ellipse: 'Shape',
  text: 'Text',
  sprite: 'Image',
  container: 'Group',
};

/** The value the parent picker uses for "not in a group at all". */
const SCENE_PARENT = '';

/**
 * Every container the node could be moved into, with its own subtree left out —
 * a node cannot be its own ancestor.
 *
 * This is the only way to nest on a phone: the tree's drag-to-nest is HTML5
 * drag and drop, which touch browsers do not fire at all.
 */
function parentOptions(
  nodes: GameObjectNode[],
  node: GameObjectNode,
  depth = 0,
): { value: string; label: string }[] {
  return nodes.flatMap((candidate) => {
    if (candidate.type !== 'container' || containsNode(node, candidate.id)) return [];
    return [
      { value: candidate.id, label: `${'— '.repeat(depth)}${candidate.name}` },
      ...parentOptions(candidate.children, node, depth + 1),
    ];
  });
}

/**
 * Moves the node between groups, and wraps it in a new one.
 *
 * Reparenting keeps the object exactly where it is on the canvas: what changes
 * is what it moves with, not where it sits, so the transform in the fields
 * above is recomputed against the new parent rather than carried over.
 */
function ParentRow({ node }: { node: GameObjectNode }) {
  const scene = useActiveScene();
  const moveNode = useEditorStore((s) => s.moveNode);
  const groupSelection = useEditorStore((s) => s.groupSelection);

  const parent = findParent(scene.children, node.id);
  const options = [
    { value: SCENE_PARENT, label: 'Scene' },
    ...parentOptions(scene.children, node),
  ];

  return (
    <>
      <div className="panel__section">Parent</div>
      <SelectField
        label="Group"
        value={parent?.id ?? SCENE_PARENT}
        options={options}
        onChange={(value) => moveNode(node.id, value === SCENE_PARENT ? null : value)}
      />
      <button className="btn btn--add" onClick={groupSelection}>
        Wrap in a new group
      </button>
    </>
  );
}

/**
 * Draw order controls. The labels talk about front and back rather than up and
 * down the list: array order *is* draw order, and the tree lists the array as
 * it is, so the first row is the object furthest back.
 */
function ArrangeRow({ node }: { node: GameObjectNode }) {
  const scene = useActiveScene();
  const reorderNode = useEditorStore((s) => s.reorderNode);
  const duplicateSelection = useEditorStore((s) => s.duplicateSelection);

  // Among its own siblings, not the scene's top level: draw order is array
  // order at every depth, and inside a group "to front" means the front of
  // that group.
  const siblings = siblingsOf(scene.children, node.id);
  const index = siblings.findIndex((child) => child.id === node.id);
  const last = siblings.length - 1;
  const move = (to: number) => reorderNode(node.id, to);

  return (
    <>
      <div className="panel__section">Arrange</div>
      <div className="arrange-row">
        <button
          className="btn btn--add"
          title="Send to back"
          disabled={index <= 0}
          onClick={() => move(0)}
        >
          ⤓
        </button>
        <button
          className="btn btn--add"
          title="Send backward"
          disabled={index <= 0}
          onClick={() => move(index - 1)}
        >
          ↓
        </button>
        <button
          className="btn btn--add"
          title="Bring forward"
          disabled={index === -1 || index >= last}
          onClick={() => move(index + 1)}
        >
          ↑
        </button>
        <button
          className="btn btn--add"
          title="Bring to front"
          disabled={index === -1 || index >= last}
          onClick={() => move(last)}
        >
          ⤒
        </button>
        <button
          className="btn btn--add"
          title="Duplicate"
          onClick={duplicateSelection}
        >
          Duplicate
        </button>
      </div>
    </>
  );
}

function NodeInspector({ node }: { node: GameObjectNode }) {
  const renameNode = useEditorStore((s) => s.renameNode);
  const updateTransform = useEditorStore((s) => s.updateTransform);
  const updateProps = useEditorStore((s) => s.updateProps);
  const deleteSelection = useEditorStore((s) => s.deleteSelection);
  const scaleNode = useEditorStore((s) => s.scaleNode);
  const lockAspect = useEditorStore((s) => s.lockAspect);
  const setLockAspect = useEditorStore((s) => s.setLockAspect);

  const setProp = (patch: Record<string, unknown>) => updateProps(node.id, patch);

  return (
    <div className="panel">
      <div className="panel__header">
        <span>{node.type}</span>
        <button
          className="icon-btn icon-btn--danger"
          onClick={deleteSelection}
          title="Delete object"
        >
          ✕
        </button>
      </div>

      <TextField
        label="Name"
        value={node.name}
        onChange={(name) => renameNode(node.id, name)}
      />

      <ParentRow node={node} />

      <ArrangeRow node={node} />

      <div className="panel__section">Transform</div>
      <div className="field-row">
        <NumberField
          label="X"
          value={node.transform.x}
          onChange={(x) => updateTransform(node.id, { x })}
        />
        <NumberField
          label="Y"
          value={node.transform.y}
          onChange={(y) => updateTransform(node.id, { y })}
        />
      </div>
      <div className="field-row">
        <NumberField
          label="Rotation°"
          value={node.transform.rotation}
          onChange={(rotation) => updateTransform(node.id, { rotation })}
        />
      </div>
      <div className="field-row">
        <NumberField
          label="Scale X"
          value={node.transform.scaleX}
          step={0.1}
          onChange={(scaleX) => scaleNode(node.id, 'x', scaleX)}
        />
        <NumberField
          label="Scale Y"
          value={node.transform.scaleY}
          step={0.1}
          onChange={(scaleY) => scaleNode(node.id, 'y', scaleY)}
        />
      </div>
      <CheckboxField
        label="Scale X and Y together"
        value={lockAspect}
        onChange={setLockAspect}
      />

      <div className="panel__section">{SECTION_TITLE[node.type]}</div>

      {/* The union in schema.ts narrows node.props per branch, so adding a node
          type later turns every missed case here into a compile error. */}
      {(node.type === 'rectangle' || node.type === 'ellipse') && (
        <>
          <div className="field-row">
            <NumberField
              label="Width"
              value={node.props.width}
              min={1}
              onChange={(width) => setProp({ width })}
            />
            <NumberField
              label="Height"
              value={node.props.height}
              min={1}
              onChange={(height) => setProp({ height })}
            />
          </div>
          <ColorField
            label="Fill"
            value={node.props.fill}
            onChange={(fill) => setProp({ fill })}
          />
          <NumberField
            label="Alpha"
            value={node.props.alpha}
            step={0.05}
            min={0}
            max={1}
            onChange={(alpha) => setProp({ alpha })}
          />
        </>
      )}

      {node.type === 'sprite' && (
        <>
          <AssetSummary assetId={node.props.assetId} />
          <AssetPicker
            selectedAssetId={node.props.assetId}
            onPick={(assetId) => setProp({ assetId })}
          />

          <div className="panel__section">Appearance</div>
          <ColorField
            label="Tint"
            value={node.props.tint}
            onChange={(tint) => setProp({ tint })}
          />
          <NumberField
            label="Alpha"
            value={node.props.alpha}
            step={0.05}
            min={0}
            max={1}
            onChange={(alpha) => setProp({ alpha })}
          />
          <div className="field-row">
            <CheckboxField
              label="Flip X"
              value={node.props.flipX}
              onChange={(flipX) => setProp({ flipX })}
            />
            <CheckboxField
              label="Flip Y"
              value={node.props.flipY}
              onChange={(flipY) => setProp({ flipY })}
            />
          </div>
        </>
      )}

      {node.type === 'container' && (
        <>
          <p className="hint">
            {node.children.length === 0
              ? 'Empty. Drag objects onto this row in the scene tree, or set their Parent to this group.'
              : `Moves, rotates and scales ${node.children.length} object${
                  node.children.length === 1 ? '' : 's'
                } as one.`}
          </p>
          <NumberField
            label="Alpha"
            value={node.props.alpha}
            step={0.05}
            min={0}
            max={1}
            onChange={(alpha) => setProp({ alpha })}
          />
        </>
      )}

      {node.type === 'text' && (
        <>
          <TextField
            label="Content"
            value={node.props.text}
            onChange={(text) => setProp({ text })}
          />
          <div className="field-row">
            <NumberField
              label="Size"
              value={node.props.fontSize}
              min={1}
              onChange={(fontSize) => setProp({ fontSize })}
            />
            <NumberField
              label="Alpha"
              value={node.props.alpha}
              step={0.05}
              min={0}
              max={1}
              onChange={(alpha) => setProp({ alpha })}
            />
          </div>
          <ColorField
            label="Color"
            value={node.props.color}
            onChange={(color) => setProp({ color })}
          />
          <TextField
            label="Font"
            value={node.props.fontFamily}
            onChange={(fontFamily) => setProp({ fontFamily })}
          />
        </>
      )}
    </div>
  );
}
