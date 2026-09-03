import { useActiveScene, useEditorStore, useSelectionNodes } from '../core/store';
import {
  containsNode,
  findAsset,
  findParent,
  frameCountOf,
  frameGridOf,
  guidesOf,
  siblingsOf,
  type GameObjectNode,
} from '../core/schema';
import { AssetPicker, AssetSummary, SheetSection } from './AssetPicker';
import { AnimationEditor } from './AnimationEditor';
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
  const alignSelectionToScene = useEditorStore((s) => s.alignSelectionToScene);
  const distributeSelection = useEditorStore((s) => s.distributeSelection);
  const canDistribute = count >= 3;
  // One object has nothing to align to but itself, so `alignSelection` refuses
  // below two. Disabled rather than silently inert: a button that does nothing
  // when pressed is worse than one that says it cannot.
  const canAlign = count >= 2;

  return (
    <>
      <div className="panel__section">Align</div>
      <div className="align-grid">
        <button
          className="btn btn--add"
          title="Align left edges"
          disabled={!canAlign}
          onClick={() => alignSelection('left')}
        >
          Left
        </button>
        <button
          className="btn btn--add"
          title="Align centres horizontally"
          disabled={!canAlign}
          onClick={() => alignSelection('centerX')}
        >
          Centre
        </button>
        <button
          className="btn btn--add"
          title="Align right edges"
          disabled={!canAlign}
          onClick={() => alignSelection('right')}
        >
          Right
        </button>
        <button
          className="btn btn--add"
          title="Align top edges"
          disabled={!canAlign}
          onClick={() => alignSelection('top')}
        >
          Top
        </button>
        <button
          className="btn btn--add"
          title="Align centres vertically"
          disabled={!canAlign}
          onClick={() => alignSelection('middleY')}
        >
          Middle
        </button>
        <button
          className="btn btn--add"
          title="Align bottom edges"
          disabled={!canAlign}
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

      {/* Against the scene rather than the selection's own box. This is the one
          alignment a single object can ask for — lining one object up with
          itself is a no-op by construction — which is why these are the buttons
          that stay enabled when the six above are not. */}
      <div className="arrange-row">
        <button
          className="btn btn--add"
          title="Centre horizontally in the scene"
          onClick={() => alignSelectionToScene('centerX')}
        >
          Centre in scene ↔
        </button>
        <button
          className="btn btn--add"
          title="Centre vertically in the scene"
          onClick={() => alignSelectionToScene('middleY')}
        >
          Centre in scene ↕
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
 * actually reached mid-gesture; this is where the two pitches are set — the
 * grid's and the angle step's — being numbers you choose once per project
 * rather than ones you flick.
 */
function SnappingSection() {
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const setSnapEnabled = useEditorStore((s) => s.setSnapEnabled);
  const gridEnabled = useEditorStore((s) => s.gridEnabled);
  const setGridEnabled = useEditorStore((s) => s.setGridEnabled);
  const gridSize = useEditorStore((s) => s.gridSize);
  const setGridSize = useEditorStore((s) => s.setGridSize);
  const angleStep = useEditorStore((s) => s.angleStep);
  const setAngleStep = useEditorStore((s) => s.setAngleStep);

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
      {/* Beside the grid pitch because the grid toggle is what governs it: the
          two numbers are the two pitches, one for position and one for angle. */}
      <NumberField
        label="Angle step°"
        value={angleStep}
        min={1}
        max={180}
        step={1}
        undoable={false}
        onChange={setAngleStep}
      />
      <p className="hint">
        Dragging lines objects up with their neighbours, matches the spacing of a row you
        drop into, and — with the grid on — lands on the pitch. The knob above a selected
        object turns it, agreeing with another object's angle or landing on the step the
        same way. These are editor settings: they are not saved with the project.
      </p>

      <GuidesSection />
    </>
  );
}

/**
 * Placing, showing and clearing the user's own guides.
 *
 * In this panel rather than the toolbar for the reason the angle step is: a
 * 390px toolbar that already clips cannot hold three more controls, and this is
 * the panel about the space objects are placed in, which is exactly what a
 * guide is. Placing one is not a mid-gesture act either — the gesture that
 * follows it happens on the canvas with no panel open, the same shape as adding
 * an object and then dragging it.
 */
function GuidesSection() {
  const scene = useActiveScene();
  const addGuide = useEditorStore((s) => s.addGuide);
  const moveGuide = useEditorStore((s) => s.moveGuide);
  const removeGuide = useEditorStore((s) => s.removeGuide);
  const clearGuides = useEditorStore((s) => s.clearGuides);
  const guidesVisible = useEditorStore((s) => s.guidesVisible);
  const setGuidesVisible = useEditorStore((s) => s.setGuidesVisible);
  const guides = guidesOf(scene);
  const count = guides.length;

  return (
    <>
      <div className="panel__section">Guides</div>
      {/* At the centre rather than at 0: a guide on the scene's own edge lies
          under the frame and is half off-screen at the fit zoom, which is the
          same reason a new object does not land at the origin either. */}
      <div className="arrange-row">
        <button
          className="btn btn--add"
          title="Add a vertical guide down the middle of the scene"
          onClick={() => addGuide('x', Math.round(scene.width / 2))}
        >
          + Guide ↕
        </button>
        <button
          className="btn btn--add"
          title="Add a horizontal guide across the middle of the scene"
          onClick={() => addGuide('y', Math.round(scene.height / 2))}
        >
          + Guide ↔
        </button>
      </div>
      <CheckboxField label="Show guides" value={guidesVisible} onChange={setGuidesVisible} />

      {/* One row per guide, so a guide can be put on an exact number and
          removed without a gesture. Dragging is the fast way and rounds to
          whole pixels; this is the way to land on 300 — and on a phone it is
          also the only way to delete a guide that has been dragged somewhere
          the finger can no longer reach. */}
      {guides.map((guide, index) => (
        <div className="field-row" key={guide.id}>
          <NumberField
            label={`Guide ${index + 1} ${guide.axis}`}
            value={guide.position}
            onChange={(position) => moveGuide(guide.id, position)}
          />
          <button
            className="icon-btn icon-btn--danger"
            onClick={() => removeGuide(guide.id)}
            title={`Delete guide ${index + 1}`}
          >
            ✕
          </button>
        </div>
      ))}

      <button
        className="btn btn--add"
        disabled={count === 0}
        onClick={clearGuides}
        title="Remove every guide in this scene"
      >
        Clear guides
      </button>
      <p className="hint">
        Drag a guide on the canvas to move it, or off the edge of the scene to remove it.
        Objects line up with guides before anything else while snapping is on. Unlike the
        settings above, guides <em>are</em> saved with the project — turning them off hides
        them and stops objects agreeing with them, but does not delete them.
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

/**
 * Which frame of a sliced image a sprite shows.
 *
 * Absent for a plain image rather than shown reading 0: a one-frame image has
 * no frame to choose, and a field whose only legal value is the one already in
 * it is a control that cannot be used. It is also hidden while an animation is
 * playing on the sprite, because the animation owns the frame then — the field
 * would be a number the canvas visibly disagrees with.
 */
function FrameField({ node }: { node: Extract<GameObjectNode, { type: 'sprite' }> }) {
  const updateProps = useEditorStore((s) => s.updateProps);
  const asset = useEditorStore((s) => findAsset(s.project, node.props.assetId));

  if (!asset || !frameGridOf(asset) || node.props.animationId) return null;

  return (
    <div className="field-row">
      <NumberField
        label="Frame"
        value={node.props.frame}
        min={0}
        max={frameCountOf(asset) - 1}
        onChange={(frame) => updateProps(node.id, { frame })}
      />
    </div>
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

      {/* Rendered for one object as well as for a set: "centre this in the
          scene" is the alignment a single object asks for most, and it has
          nowhere else to live. */}
      <AlignSection count={1} />

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

          {node.props.assetId && (
            <>
              <div className="panel__section">Sprite sheet</div>
              <SheetSection assetId={node.props.assetId} />
              <FrameField node={node} />

              <div className="panel__section">Animation</div>
              <AnimationEditor
                nodeId={node.id}
                assetId={node.props.assetId}
                animationId={node.props.animationId}
                onPick={(animationId) => setProp({ animationId })}
              />
            </>
          )}

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
