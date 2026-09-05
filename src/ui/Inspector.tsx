import { useState } from 'react';
import {
  countPrefabUses,
  useActiveScene,
  useEditorStore,
  usePrefabs,
  useScenes,
  useSelectionNodes,
} from '../core/store';
import {
  DEFAULT_CAMERA,
  EMPTY_TILE,
  cameraOf,
  canHavePhysics,
  collidableNodes,
  collidersOf,
  containsInstance,
  containsNode,
  controlsOf,
  findAsset,
  findParent,
  frameCountOf,
  frameGridOf,
  guidesOf,
  isDefaultCamera,
  physicsOf,
  scenePhysicsOf,
  siblingsOf,
  tileMapOf,
  type GameObjectNode,
  type NineSliceProps,
  type ParticlesProps,
  type TextProps,
  type TileSpriteProps,
} from '../core/schema';
import { AssetPicker, AssetSummary, SheetSection } from './AssetPicker';
import { AudioSection } from './AudioPicker';
import { SolidPalette, TilePalette } from './TilePalette';
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
  const createPrefabFromSelection = useEditorStore((s) => s.createPrefabFromSelection);

  const anyVisible = nodes.some((node) => node.visible);
  // A definition may not place a prefab of its own — see `prefabChildrenOf`.
  const nestsPrefab = containsInstance(nodes);

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
      <button
        className="btn btn--block"
        disabled={nestsPrefab}
        onClick={createPrefabFromSelection}
        title={
          nestsPrefab
            ? 'A prefab cannot contain another prefab yet'
            : 'Reuse these objects, linked, anywhere in the project'
        }
      >
        Save as prefab
      </button>

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
  const sceneCount = useScenes().length;
  const updateScene = useEditorStore((s) => s.updateScene);
  const duplicateScene = useEditorStore((s) => s.duplicateScene);
  const removeScene = useEditorStore((s) => s.removeScene);

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

      {/* Here rather than in the switcher row, which is a row of things you tap
          to change scenes: a delete button among them is one thumb-width from
          the chip beside it. These act on the scene whose fields are directly
          above them, which is also what makes them unambiguous with no chip to
          point at. */}
      <div className="field-row">
        <button
          className="btn btn--block"
          onClick={duplicateScene}
          title="Copy this scene, objects and all, into a new one"
        >
          Duplicate scene
        </button>
        <button
          className="btn btn--block btn--danger"
          disabled={sceneCount < 2}
          onClick={() => removeScene(scene.id)}
          title={
            sceneCount < 2
              ? 'A project needs at least one scene'
              : 'Delete this scene and everything in it'
          }
        >
          Delete scene
        </button>
      </div>

      <CameraSection />

      <WorldSection />

      <CollidersSection />

      {/* Here rather than in the scene panel beside the prefab list, which was
          the other candidate: a prefab is *placed*, over and over, so reaching
          it must not cost a deselect first, while a sound is imported and tuned
          a handful of times in a project's life. It sits with the scene's own
          fields, the gravity and the guides, which is what it is one of. */}
      <AudioSection />

      <SnappingSection />
    </div>
  );
}

/**
 * Where the game looks when this scene starts.
 *
 * Document state, in the panel about the space objects are placed in and above
 * the gravity for the reason the gravity is above the guides: it belongs to
 * every object at once. Unlike the gravity it is always shown — a camera is not
 * a setting that can only ever do nothing, since every scene has one whether or
 * not the file says so, and the frame it draws is the only place a user can see
 * what the numbers mean.
 *
 * Every label carries "Camera", and that is not decoration: the object's own
 * Name is a few rows up this same panel, so are Width, Height and the two
 * Gravity fields, and the suite locates a field by its exact label. It is the
 * "Animation name, not Name" rule arriving by a third route.
 */
function CameraSection() {
  const scene = useActiveScene();
  // Derived outside the selector, never inside one: `cameraOf` builds a fresh
  // object every call, so `useEditorStore((s) => cameraOf(...))` would compare
  // unequal on every store change and loop forever (React error #185).
  const setCamera = useEditorStore((s) => s.setCamera);
  const camera = cameraOf(scene);

  // Top level only, which is the whole of "a camera follows world coordinates":
  // a node inside a container has parent-relative ones, so following it would
  // scroll to somewhere nothing is. The same rule an Arcade body follows, and
  // the same `true` the exporter and the renderer pass.
  const targets = scene.children;

  return (
    <>
      <div className="panel__section">Camera</div>
      <div className="field-row">
        <NumberField
          label="Camera X"
          value={camera.scrollX}
          onChange={(scrollX) => setCamera({ scrollX })}
        />
        <NumberField
          label="Camera Y"
          value={camera.scrollY}
          onChange={(scrollY) => setCamera({ scrollY })}
        />
      </div>
      <NumberField
        label="Camera zoom"
        value={camera.zoom}
        step={0.1}
        min={0.05}
        onChange={(zoom) => setCamera({ zoom })}
      />
      <SelectField
        label="Camera follows"
        value={camera.followId ?? ''}
        options={[
          { value: '', label: 'Nothing' },
          ...targets.map((node) => ({ value: node.id, label: node.name })),
        ]}
        onChange={(followId) => setCamera({ followId: followId === '' ? null : followId })}
      />
      {/* Only while something is followed. A smoothing with nothing to chase is
          a field that does not apply rather than one that is switched off, which
          is the call the dynamic-only body fields already make: they are absent
          on a static body rather than disabled. */}
      {camera.followId !== null && (
        <NumberField
          label="Camera smoothing"
          value={camera.followLerp}
          step={0.05}
          min={0.01}
          max={1}
          onChange={(followLerp) => setCamera({ followLerp })}
        />
      )}
      <CheckboxField
        label="Limit camera to the scene"
        value={camera.boundToScene}
        onChange={(boundToScene) => setCamera({ boundToScene })}
      />
      <CheckboxField
        label="Round camera to whole pixels"
        value={camera.roundPixels}
        onChange={(roundPixels) => setCamera({ roundPixels })}
      />
      {!isDefaultCamera(camera) && (
        <button
          className="btn btn--block"
          onClick={() => setCamera(DEFAULT_CAMERA)}
          title="Put the camera back to the whole scene at zoom 1"
        >
          Reset camera
        </button>
      )}
      <p className="hint">
        The violet frame is what the game opens on. Only objects at the top level
        can be followed — one inside a group is positioned relative to that
        group, not to the scene. Nothing here moves the editor's own view: pan
        and pinch as usual, and press ⤢ to see the whole scene again.
      </p>
    </>
  );
}

/**
 * The scene's physics world.
 *
 * Gravity and nothing else, in the panel about the space objects are placed in
 * — the only setting here that belongs to every body at once, and the one a
 * user reaches for immediately after switching their first body on. It is
 * document state, unlike the snapping block below it: two people opening the
 * same file must get the same fall.
 *
 * The row appears only once something in the scene has a body. Gravity with no
 * body to pull on is a number that can only ever do nothing, which is the
 * argument that keeps the ▶ button out of a toolbar with nothing that moves.
 */
function WorldSection() {
  const scene = useActiveScene();
  const updateScene = useEditorStore((s) => s.updateScene);

  // Top level only, which is where a body may be — the same walk the renderer
  // and the exporter make, and the same `true`.
  const any = scene.children.some((child) => physicsOf(child, true) !== null);
  if (!any) return null;

  const gravity = scenePhysicsOf(scene);
  const set = (patch: Partial<typeof gravity>) =>
    updateScene({ physics: { ...gravity, ...patch } });

  return (
    <>
      <div className="panel__section">Physics world</div>
      <div className="field-row">
        <NumberField
          label="Gravity X"
          value={gravity.gravityX}
          onChange={(gravityX) => set({ gravityX })}
        />
        <NumberField
          label="Gravity Y"
          value={gravity.gravityY}
          onChange={(gravityY) => set({ gravityY })}
        />
      </div>
      <p className="hint">
        Positive Y falls downward, as everywhere else here. The world's bounds
        are the scene's own width and height, so an object set to collide with
        them stops at the frame you can see.
      </p>
    </>
  );
}

/**
 * Which pairs of objects Arcade keeps apart, or watches for a touch.
 *
 * A scene setting, where the scene's other settings are — the gravity is
 * directly above it and is the world these rows act in. It is the line
 * iteration 16 told the user to write by hand, and it is here now for the
 * reason that iteration emitted a `mass` and an `immovable` nothing it
 * generated read: which pairs interact is a standing fact about the world,
 * where what should *happen* when they touch is a sequence of events and stays
 * the user's, on the handle `add.overlap` hands them.
 *
 * The pickers offer exactly what `collidersOf` would keep — a top-level node
 * with a body, or a tilemap — so the panel cannot produce a row that vanishes
 * on the next read. Hidden entirely below two such nodes: with one there is no
 * pair to make, and a "+ Collision" button that could only ever produce nothing
 * is worth less than the rows it costs.
 */
function CollidersSection() {
  const scene = useActiveScene();
  // Derived outside the selector, never inside one: `collidersOf` builds a
  // fresh array every call, so `useEditorStore((s) => collidersOf(...))` would
  // compare unequal on every store change and loop forever (React error #185).
  const addCollider = useEditorStore((s) => s.addCollider);
  const updateCollider = useEditorStore((s) => s.updateCollider);
  const removeCollider = useEditorStore((s) => s.removeCollider);

  const candidates = collidableNodes(scene);
  if (candidates.length < 2) return null;
  const rows = collidersOf(scene);
  const options = candidates.map((node) => ({ value: node.id, label: node.name }));

  return (
    <>
      <div className="panel__section">Collisions</div>
      {/* Every label is numbered, and that is not decoration: a second row puts
          a second field reading exactly "Collides" on the page, and the suite
          locates a field by its exact label — the trap the prefab buttons' "+ "
          prefix and the scene chips' "Switch to " both exist for, arriving here
          by a third route. It also gives the remove button something to name. */}
      {rows.map((row, index) => (
        // Two rows of two rather than one row of four: at 390px a flex row
        // shares its width equally, so four controls are ~85px each and every
        // object name in the picker is truncated to nothing. The pair that has
        // to be read together — what collides with what — gets a row of its
        // own.
        <div key={row.id}>
          <div className="field-row">
            <SelectField
              label={`Collides ${index + 1}`}
              value={row.aId}
              options={options}
              onChange={(aId) => updateCollider(row.id, { aId })}
            />
            <SelectField
              label={`With ${index + 1}`}
              value={row.bId}
              options={options}
              onChange={(bId) => updateCollider(row.id, { bId })}
            />
          </div>
          <div className="field-row field-row--foot">
            <SelectField
              label={`How ${index + 1}`}
              value={row.kind}
              options={[
                { value: 'collide', label: 'Solid' },
                { value: 'overlap', label: 'Overlap' },
              ]}
              onChange={(kind) => updateCollider(row.id, { kind: kind as 'collide' | 'overlap' })}
            />
            <button
              className="btn btn--block btn--danger"
              onClick={() => removeCollider(row.id)}
              aria-label={`Remove collision ${index + 1}`}
              title="Remove this collision"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      {/* The first two candidates rather than a blank row, because a row naming
          nothing is one `collidersOf` drops on the next read — so there would
          be nothing on screen left to fill in. */}
      <button
        className="btn btn--block"
        onClick={() => addCollider(candidates[0].id, candidates[1].id)}
      >
        + Collision
      </button>
      <p className="hint">
        Solid stops them; Overlap only reports the touch. What happens then is
        yours to write, on the collider the export hands back.
      </p>
    </>
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

/**
 * The prefab controls on an ordinary object: save it as a new prefab, and — for
 * a group — push it into an existing one.
 *
 * That second half is the whole reason there is no prefab editing *mode*. A
 * group's own frame is exactly an instance's frame, so its children's
 * transforms transfer with no arithmetic at all — which makes "detach an
 * instance, edit it with every tool that already exists, push it back" a
 * complete round trip, and a mode only a second place to do the same thing.
 *
 * Saving is offered for every type, not only for groups: one object is a
 * selection of one, and `createPrefabFromSelection` wraps whatever it is given
 * the same way. Replacing is not, because a definition comes from a node's
 * children and a rectangle has none — the answer for a single object is to
 * detach the instance, which gives back a group.
 */
function NodePrefabSection({ node }: { node: GameObjectNode }) {
  const prefabs = usePrefabs();
  const createPrefabFromSelection = useEditorStore((s) => s.createPrefabFromSelection);
  const updatePrefabFrom = useEditorStore((s) => s.updatePrefabFrom);
  const [target, setTarget] = useState('');

  const nestsPrefab = containsInstance(node.children);
  const chosen = prefabs.find((prefab) => prefab.id === target);
  const replaceable = node.type === 'container' && prefabs.length > 0;

  return (
    <>
      <div className="panel__section">Prefab</div>
      {nestsPrefab ? (
        <p className="hint">
          This group places a prefab of its own, and a prefab cannot contain another one
          yet.
        </p>
      ) : (
        <>
          <button className="btn btn--block" onClick={createPrefabFromSelection}>
            Save as prefab
          </button>
          {replaceable && (
            <>
              <SelectField
                label="Update"
                value={target}
                options={[
                  { value: '', label: 'Choose a prefab…' },
                  ...prefabs.map((prefab) => ({ value: prefab.id, label: prefab.name })),
                ]}
                onChange={setTarget}
              />
              <button
                className="btn btn--block"
                disabled={!chosen}
                onClick={() => chosen && updatePrefabFrom(chosen.id, node.id)}
              >
                {chosen ? `Replace ${chosen.name} with this group` : 'Replace a prefab'}
              </button>
            </>
          )}
        </>
      )}
    </>
  );
}

/**
 * The panel for a placed prefab.
 *
 * What it edits is deliberately split in two: the fields above this belong to
 * the *instance* — where it is, how big, what it is called — and the ones here
 * belong to the *definition*, shared with every other placement. The use count
 * is what makes that difference visible before the user finds it out.
 *
 * There are no controls for the contents, because an instance has none of its
 * own: they are read from the definition every time it is drawn, which is what
 * makes one edit reach every placement. Detach is the way to get editable
 * objects, and it says so.
 */
function InstanceSection({ node }: { node: GameObjectNode }) {
  const prefabs = usePrefabs();
  const uses = useEditorStore((s) =>
    node.type === 'instance' && node.props.prefabId
      ? countPrefabUses(s.project, node.props.prefabId)
      : 0,
  );
  const updateProps = useEditorStore((s) => s.updateProps);
  const renamePrefab = useEditorStore((s) => s.renamePrefab);
  const removePrefab = useEditorStore((s) => s.removePrefab);
  const detachInstance = useEditorStore((s) => s.detachInstance);

  if (node.type !== 'instance') return null;
  const prefab = prefabs.find((entry) => entry.id === node.props.prefabId);

  return (
    <>
      {prefab ? (
        <p className="hint">
          {uses === 1
            ? 'The only instance of this prefab. Editing it changes this one.'
            : `One of ${uses} instances — editing the prefab changes all of them.`}
        </p>
      ) : (
        <p className="hint">
          This prefab is no longer in the project, so there is nothing to draw. Point it at
          another one, or delete it.
        </p>
      )}

      <SelectField
        label="Prefab"
        value={node.props.prefabId ?? ''}
        options={[
          { value: '', label: prefab ? 'None' : 'Missing — choose one' },
          ...prefabs.map((entry) => ({ value: entry.id, label: entry.name })),
        ]}
        onChange={(prefabId) => updateProps(node.id, { prefabId: prefabId || null })}
      />

      {prefab && (
        /* "Prefab name", not "Name": the object's own Name field is a few rows
           up this same panel, and this one is the definition's, shared by every
           instance — and the factory function's name in exported code. */
        <TextField
          label="Prefab name"
          value={prefab.name}
          onChange={(name) => renamePrefab(prefab.id, name)}
        />
      )}

      <NumberField
        label="Alpha"
        value={node.props.alpha}
        step={0.05}
        min={0}
        max={1}
        onChange={(alpha) => updateProps(node.id, { alpha })}
      />

      <button
        className="btn btn--block"
        onClick={() => detachInstance(node.id)}
        title="Turn this into an ordinary group you can edit"
      >
        Detach into a group
      </button>
      {prefab && (
        <button
          className="btn btn--block btn--danger"
          onClick={() => removePrefab(prefab.id)}
          title={`Detaches ${uses} instance${uses === 1 ? '' : 's'} and removes the prefab`}
        >
          Delete prefab
        </button>
      )}
    </>
  );
}

/** Heading for the per-type section, which is the only thing that differs. */
const SECTION_TITLE: Record<GameObjectNode['type'], string> = {
  rectangle: 'Shape',
  ellipse: 'Shape',
  text: 'Text',
  sprite: 'Image',
  nineslice: 'Panel',
  tileSprite: 'Tiled image',
  container: 'Group',
  instance: 'Prefab',
  tilemap: 'Tiles',
  particles: 'Particles',
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
function FrameField({
  node,
}: {
  node: Extract<
    GameObjectNode,
    { type: 'sprite' | 'particles' | 'nineslice' | 'tileSprite' }
  >;
}) {
  const updateProps = useEditorStore((s) => s.updateProps);
  const asset = useEditorStore((s) => findAsset(s.project, node.props.assetId));

  // An emitter, a panel and a tile sprite all index the same grid and clamp
  // against the same count, so this is the same control rather than four copies
  // of it. Only a sprite can have a clip taking the frame over, which is why
  // that half of the guard narrows.
  if (!asset || !frameGridOf(asset)) return null;
  if (node.type === 'sprite' && node.props.animationId) return null;

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

/**
 * The nine-slice section.
 *
 * The image controls are the picker and the slicer used verbatim, for the
 * reason an emitter and a tileset reuse them: a nine-slice source *is* an
 * image, sliced or not.
 *
 * The four insets are their own field each rather than a symmetric pair,
 * because a nine-slice's whole subject is that the sides differ — a window
 * frame with a title bar has a top unlike its bottom. They are labelled "Slice
 * …" and the box is labelled "Width"/"Height" plainly, since the transform's
 * Scale X/Y two rows up is the other thing that changes an object's size and
 * the two must not read as the same control.
 */
function NineSliceSection({
  node,
}: {
  node: Extract<GameObjectNode, { type: 'nineslice' }>;
}) {
  const updateProps = useEditorStore((s) => s.updateProps);
  const setProp = (patch: Partial<NineSliceProps>) => updateProps(node.id, patch);

  return (
    <>
      <AssetSummary assetId={node.props.assetId} kind="panel" />
      <AssetPicker
        selectedAssetId={node.props.assetId}
        onPick={(assetId) => setProp({ assetId })}
      />

      {node.props.assetId && (
        <>
          <div className="panel__section">Sprite sheet</div>
          <SheetSection assetId={node.props.assetId} />
          <FrameField node={node} />
        </>
      )}

      <div className="panel__section">Size</div>
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

      <div className="panel__section">Slices</div>
      <p className="hint">
        The corners keep their size at any width; only the edges and the middle
        stretch. Leave Slice top and bottom at 0 for a bar that stretches
        sideways only.
      </p>
      <div className="field-row">
        <NumberField
          label="Slice left"
          value={node.props.left}
          min={0}
          onChange={(left) => setProp({ left })}
        />
        <NumberField
          label="Slice right"
          value={node.props.right}
          min={0}
          onChange={(right) => setProp({ right })}
        />
      </div>
      <div className="field-row">
        <NumberField
          label="Slice top"
          value={node.props.top}
          min={0}
          onChange={(top) => setProp({ top })}
        />
        <NumberField
          label="Slice bottom"
          value={node.props.bottom}
          min={0}
          onChange={(bottom) => setProp({ bottom })}
        />
      </div>

      <div className="panel__section">Appearance</div>
      <ColorField label="Tint" value={node.props.tint} onChange={(tint) => setProp({ tint })} />
      <NumberField
        label="Alpha"
        value={node.props.alpha}
        step={0.05}
        min={0}
        max={1}
        onChange={(alpha) => setProp({ alpha })}
      />
    </>
  );
}

/**
 * The tile-sprite section.
 *
 * "Tile offset" and "Tile scale" rather than "Offset" and "Scale": the
 * transform's own Scale X/Y is a few rows up the same panel and does something
 * genuinely different — it stretches the box and the pattern together, where
 * these leave the box alone. Two fields called Scale would be ambiguous to a
 * reader and to the suite's exact-match label locator alike, which is the
 * "Animation name, not Name" rule.
 */
function TileSpriteSection({
  node,
}: {
  node: Extract<GameObjectNode, { type: 'tileSprite' }>;
}) {
  const updateProps = useEditorStore((s) => s.updateProps);
  const setProp = (patch: Partial<TileSpriteProps>) => updateProps(node.id, patch);

  return (
    <>
      <AssetSummary assetId={node.props.assetId} kind="tile" />
      <AssetPicker
        selectedAssetId={node.props.assetId}
        onPick={(assetId) => setProp({ assetId })}
      />

      {node.props.assetId && (
        <>
          <div className="panel__section">Sprite sheet</div>
          <SheetSection assetId={node.props.assetId} />
          <FrameField node={node} />
        </>
      )}

      <div className="panel__section">Size</div>
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

      <div className="panel__section">Pattern</div>
      <p className="hint">
        The image repeats to fill the box. Tile offset scrolls it inside the
        box; tile scale changes how big one repeat is.
      </p>
      <div className="field-row">
        <NumberField
          label="Tile offset X"
          value={node.props.tilePositionX}
          onChange={(tilePositionX) => setProp({ tilePositionX })}
        />
        <NumberField
          label="Tile offset Y"
          value={node.props.tilePositionY}
          onChange={(tilePositionY) => setProp({ tilePositionY })}
        />
      </div>
      <div className="field-row">
        <NumberField
          label="Tile scale X"
          value={node.props.tileScaleX}
          step={0.1}
          onChange={(tileScaleX) => setProp({ tileScaleX })}
        />
        <NumberField
          label="Tile scale Y"
          value={node.props.tileScaleY}
          step={0.1}
          onChange={(tileScaleY) => setProp({ tileScaleY })}
        />
      </div>

      <div className="panel__section">Appearance</div>
      <ColorField label="Tint" value={node.props.tint} onChange={(tint) => setProp({ tint })} />
      <NumberField
        label="Alpha"
        value={node.props.alpha}
        step={0.05}
        min={0}
        max={1}
        onChange={(alpha) => setProp({ alpha })}
      />
    </>
  );
}

/**
 * The text panel: what it says, and how it is set.
 *
 * Its own component rather than the inline block it was until iteration 22,
 * because twelve more fields do not belong in the middle of `NodeInspector`.
 *
 * Split into three by what a person is doing. The top group is the object —
 * the words, their size and their colour — and is what almost every visit to
 * this panel is for. Paragraph is the group that only means anything once the
 * text has more than one line, which is why the wrap field sits beside the
 * alignment that it is usually what enables. Stroke and shadow are the two
 * decorations, last because most text has neither.
 *
 * Every label is unique by exact match within the panel, which the suite's
 * locator requires: "Font size" rather than "Size" and "Text colour" rather
 * than "Color", because this panel is now carrying three colours and two
 * widths, and Name, X, Y, Rotation, Alpha and the physics section's own
 * Bounce/Drag pairs are all a scroll away. The "Animation name, not Name" rule.
 */
function TextSection({ node }: { node: Extract<GameObjectNode, { type: 'text' }> }) {
  const updateProps = useEditorStore((s) => s.updateProps);
  const setProp = (patch: Partial<TextProps>) => updateProps(node.id, patch);

  return (
    <>
      <TextField
        label="Content"
        value={node.props.text}
        onChange={(text) => setProp({ text })}
      />
      <div className="field-row">
        <NumberField
          label="Font size"
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
        label="Text colour"
        value={node.props.color}
        onChange={(color) => setProp({ color })}
      />
      <TextField
        label="Font family"
        value={node.props.fontFamily}
        onChange={(fontFamily) => setProp({ fontFamily })}
      />
      <div className="field-row">
        <CheckboxField
          label="Bold"
          value={node.props.bold}
          onChange={(bold) => setProp({ bold })}
        />
        <CheckboxField
          label="Italic"
          value={node.props.italic}
          onChange={(italic) => setProp({ italic })}
        />
      </div>

      <div className="panel__section">Paragraph</div>
      <p className="hint">
        Wrap width 0 means the text runs on in one line. Align only shows itself
        on text with more than one line — wrapped, or with a line break in it.
      </p>
      <div className="field-row">
        <NumberField
          label="Wrap width"
          value={node.props.wordWrapWidth}
          min={0}
          onChange={(wordWrapWidth) => setProp({ wordWrapWidth })}
        />
        <SelectField
          label="Align"
          value={node.props.align}
          options={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Centre' },
            { value: 'right', label: 'Right' },
          ]}
          onChange={(align) => setProp({ align: align as TextProps['align'] })}
        />
      </div>
      <div className="field-row">
        <NumberField
          label="Line spacing"
          value={node.props.lineSpacing}
          onChange={(lineSpacing) => setProp({ lineSpacing })}
        />
        <NumberField
          label="Letter spacing"
          value={node.props.letterSpacing}
          onChange={(letterSpacing) => setProp({ letterSpacing })}
        />
      </div>

      <div className="panel__section">Stroke and shadow</div>
      <p className="hint">
        A stroke draws only while its width is above zero. Room for both is
        worked out from the numbers you set, so neither is clipped.
      </p>
      <div className="field-row">
        <ColorField
          label="Stroke colour"
          value={node.props.strokeColor}
          onChange={(strokeColor) => setProp({ strokeColor })}
        />
        <NumberField
          label="Stroke width"
          value={node.props.strokeThickness}
          min={0}
          onChange={(strokeThickness) => setProp({ strokeThickness })}
        />
      </div>
      <div className="field-row">
        <NumberField
          label="Shadow X"
          value={node.props.shadowOffsetX}
          onChange={(shadowOffsetX) => setProp({ shadowOffsetX })}
        />
        <NumberField
          label="Shadow Y"
          value={node.props.shadowOffsetY}
          onChange={(shadowOffsetY) => setProp({ shadowOffsetY })}
        />
      </div>
      <div className="field-row">
        <ColorField
          label="Shadow colour"
          value={node.props.shadowColor}
          onChange={(shadowColor) => setProp({ shadowColor })}
        />
        <NumberField
          label="Shadow blur"
          value={node.props.shadowBlur}
          min={0}
          onChange={(shadowBlur) => setProp({ shadowBlur })}
        />
      </div>
    </>
  );
}

/**
 * The emitter panel.
 *
 * Long, because an emitter is eighteen numbers rather than a position and a
 * colour — but every one of them is one Phaser config key, and the set is the
 * smallest that reaches fire, sparks and falling snow. The image controls are
 * the picker and the slicer used verbatim, for the reason a tileset reuses
 * them: a particle sheet *is* a sliced image.
 *
 * The hint is not decoration. An emitter is stopped unless preview is on, so
 * without it the panel reads as broken — every dial set, and nothing moving.
 */
function ParticlesSection({
  node,
}: {
  node: Extract<GameObjectNode, { type: 'particles' }>;
}) {
  const updateProps = useEditorStore((s) => s.updateProps);
  const previewMotion = useEditorStore((s) => s.previewMotion);
  const setProp = (patch: Partial<ParticlesProps>) => updateProps(node.id, patch);

  return (
    <>
      <AssetSummary assetId={node.props.assetId} kind="particle" />
      <AssetPicker
        selectedAssetId={node.props.assetId}
        onPick={(assetId) => setProp({ assetId })}
      />

      {node.props.assetId && (
        <>
          <div className="panel__section">Sprite sheet</div>
          <SheetSection assetId={node.props.assetId} />
          <FrameField node={node} />
        </>
      )}

      {!previewMotion && (
        <p className="hint">
          Stopped. Press ▶ in the toolbar to watch it run — the canvas holds
          still by default so objects stay where you put them.
        </p>
      )}

      <div className="panel__section">Emission</div>
      <NumberField
        label="Lifespan"
        value={node.props.lifespan}
        min={1}
        step={50}
        onChange={(lifespan) => setProp({ lifespan })}
      />
      <div className="field-row">
        <NumberField
          label="Quantity"
          value={node.props.quantity}
          min={1}
          step={1}
          onChange={(quantity) => setProp({ quantity })}
        />
        <NumberField
          label="Frequency"
          value={node.props.frequency}
          min={0}
          step={10}
          onChange={(frequency) => setProp({ frequency })}
        />
      </div>
      <div className="field-row">
        <NumberField
          label="Speed min"
          value={node.props.speedMin}
          step={10}
          onChange={(speedMin) => setProp({ speedMin })}
        />
        <NumberField
          label="Speed max"
          value={node.props.speedMax}
          step={10}
          onChange={(speedMax) => setProp({ speedMax })}
        />
      </div>
      <div className="field-row">
        <NumberField
          label="Angle min"
          value={node.props.angleMin}
          step={5}
          onChange={(angleMin) => setProp({ angleMin })}
        />
        <NumberField
          label="Angle max"
          value={node.props.angleMax}
          step={5}
          onChange={(angleMax) => setProp({ angleMax })}
        />
      </div>
      <div className="field-row">
        <NumberField
          label="Gravity X"
          value={node.props.gravityX}
          step={10}
          onChange={(gravityX) => setProp({ gravityX })}
        />
        <NumberField
          label="Gravity Y"
          value={node.props.gravityY}
          step={10}
          onChange={(gravityY) => setProp({ gravityY })}
        />
      </div>

      <div className="panel__section">Particle</div>
      {/* Phaser's own names, and deliberately not "Scale"/"Alpha": the
          transform's Scale X/Y and the object's own Alpha are a few rows up
          this same panel, and two fields differing by one word is ambiguous to
          a reader and to a test locator alike. */}
      <div className="field-row">
        <NumberField
          label="Scale start"
          value={node.props.scaleStart}
          step={0.1}
          min={0}
          onChange={(scaleStart) => setProp({ scaleStart })}
        />
        <NumberField
          label="Scale end"
          value={node.props.scaleEnd}
          step={0.1}
          min={0}
          onChange={(scaleEnd) => setProp({ scaleEnd })}
        />
      </div>
      <div className="field-row">
        <NumberField
          label="Alpha start"
          value={node.props.alphaStart}
          step={0.05}
          min={0}
          max={1}
          onChange={(alphaStart) => setProp({ alphaStart })}
        />
        <NumberField
          label="Alpha end"
          value={node.props.alphaEnd}
          step={0.05}
          min={0}
          max={1}
          onChange={(alphaEnd) => setProp({ alphaEnd })}
        />
      </div>
      <ColorField
        label="Tint"
        value={node.props.tint}
        onChange={(tint) => setProp({ tint })}
      />
      <SelectField
        label="Blend"
        value={node.props.blendMode}
        options={[
          { value: 'NORMAL', label: 'Normal' },
          { value: 'ADD', label: 'Add' },
        ]}
        onChange={(blendMode) => setProp({ blendMode: blendMode as 'NORMAL' | 'ADD' })}
      />

      <div className="panel__section">Appearance</div>
      <NumberField
        label="Alpha"
        value={node.props.alpha}
        step={0.05}
        min={0}
        max={1}
        onChange={(alpha) => setProp({ alpha })}
      />
    </>
  );
}

/**
 * The tilemap panel: the tileset, the grid, the brush, and the way into paint
 * mode.
 *
 * The tileset controls are the image picker and the sheet slicer used verbatim,
 * because a tileset *is* a sliced image — the same panel that gives a sprite its
 * frames gives a map its tiles, and a second slicer here would be the same four
 * numbers in a second place.
 */
function TilemapSection({ node }: { node: Extract<GameObjectNode, { type: 'tilemap' }> }) {
  const updateProps = useEditorStore((s) => s.updateProps);
  const resizeTilemap = useEditorStore((s) => s.resizeTilemap);
  const fillTiles = useEditorStore((s) => s.fillTiles);
  const setPainting = useEditorStore((s) => s.setPainting);
  const paintingId = useEditorStore((s) => s.paintingId);
  const brushTile = useEditorStore((s) => s.brushTile);
  const erasing = useEditorStore((s) => s.erasing);
  // Derived outside the selector, not inside one: `tileMapOf` builds a fresh
  // object every call and zustand compares snapshots by identity, so selecting
  // it would re-render on every store read for ever. The same reason
  // `useSelectionNodes` reaches for `useShallow`.
  const project = useEditorStore((s) => s.project);
  const map = tileMapOf(project, node.props);

  const painting = paintingId === node.id;

  return (
    <>
      <AssetSummary assetId={node.props.assetId} kind="tileset" />
      <AssetPicker
        selectedAssetId={node.props.assetId}
        onPick={(assetId) => updateProps(node.id, { assetId })}
      />

      {node.props.assetId && (
        <>
          <div className="panel__section">Tileset</div>
          <SheetSection assetId={node.props.assetId} />
        </>
      )}

      <div className="panel__section">Grid</div>
      <div className="field-row">
        <NumberField
          label="Columns"
          value={node.props.columns}
          min={1}
          onChange={(columns) => resizeTilemap(node.id, columns, node.props.rows)}
        />
        <NumberField
          label="Rows"
          value={node.props.rows}
          min={1}
          onChange={(rows) => resizeTilemap(node.id, node.props.columns, rows)}
        />
      </div>
      <p className="hint">
        {map.columns}×{map.rows} tiles of {map.tileWidth}×{map.tileHeight}px —{' '}
        {map.columns * map.tileWidth}×{map.rows * map.tileHeight} before scaling. The tile
        size is the tileset's frame size.
      </p>

      <div className="panel__section">Brush</div>
      <TilePalette assetId={node.props.assetId} />

      {/* Toggling rather than only entering: the bar over the canvas has the ✓
          that leaves, but on a desktop the button that turned the mode on is
          where a user looks to turn it off again. */}
      <button
        className={`btn btn--block ${painting ? 'is-active' : ''}`}
        onClick={() => setPainting(painting ? null : node.id)}
        aria-pressed={painting}
      >
        {painting ? 'Done painting' : 'Edit tiles'}
      </button>
      <button
        className="btn btn--block"
        onClick={() => fillTiles(node.id, erasing ? EMPTY_TILE : brushTile)}
      >
        {erasing ? 'Clear every tile' : 'Fill with this tile'}
      </button>

      {/* "Collision", not "Physics": a tilemap carries no Arcade body — its
          collision is `setCollision([...])`, which is about which *tiles* are
          solid rather than about a box round the layer. Naming it Physics would
          say the map has the thing it deliberately has not got. */}
      <div className="panel__section">Collision</div>
      <SolidPalette
        nodeId={node.id}
        assetId={node.props.assetId}
        collides={map.collides}
      />
      <p className="hint">
        {map.collides.length > 0
          ? 'Solid tiles are outlined green while you paint. Add a collision in the Scene panel between this map and whatever should stand on it.'
          : 'Pick the tiles that should stop things — walls, floors. Then add a collision in the Scene panel between this map and whatever should stand on it.'}
      </p>

      <div className="panel__section">Appearance</div>
      <NumberField
        label="Alpha"
        value={node.props.alpha}
        step={0.05}
        min={0}
        max={1}
        onChange={(alpha) => updateProps(node.id, { alpha })}
      />
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

      {/* Rendered for one object as well as for a set: "centre this in the
          scene" is the alignment a single object asks for most, and it has
          nowhere else to live. */}
      <AlignSection count={1} />

      {/* An instance's own prefab controls live in the per-type section below,
          under the heading `SECTION_TITLE` already gives it. */}
      {node.type !== 'instance' && <NodePrefabSection node={node} />}

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

      {node.type === 'nineslice' && <NineSliceSection node={node} />}

      {node.type === 'tileSprite' && <TileSpriteSection node={node} />}

      {node.type === 'particles' && <ParticlesSection node={node} />}

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

      {node.type === 'instance' && <InstanceSection node={node} />}

      {node.type === 'tilemap' && <TilemapSection node={node} />}

      {node.type === 'text' && <TextSection node={node} />}

      <PhysicsSection node={node} />
    </div>
  );
}

/**
 * The node's Arcade Physics body.
 *
 * Last in the panel, below the per-type section rather than above it. A body is
 * opt-in and most objects never get one, so switched off it is a single
 * checkbox — and putting a dozen fields between the object's name and the fill
 * colour it is actually being edited for would cost a 390px screen most of a
 * scroll on every object in the project.
 *
 * Two things are refused rather than offered and quietly ignored, which is the
 * `containsInstance` treatment of "Save as prefab": a type Arcade cannot
 * simulate, and a node inside a group. Both say why. The second is the one a
 * reader will not expect, so it says the actual reason — a body is placed from
 * its object's `x`/`y`, and inside a group those are the group's coordinates,
 * not the world's.
 */
function PhysicsSection({ node }: { node: GameObjectNode }) {
  const scene = useActiveScene();
  const setNodePhysics = useEditorStore((s) => s.setNodePhysics);

  if (!canHavePhysics(node.type)) return null;

  // The same question the store asks, asked the same way: a body may only be on
  // a direct child of the scene.
  const topLevel = scene.children.some((child) => child.id === node.id);
  const body = physicsOf(node, topLevel);

  if (!topLevel) {
    return (
      <>
        <div className="panel__section">Physics</div>
        <p className="hint">
          {node.physics
            ? 'This object has a body, but it is inside a group, so nothing draws it and the export leaves it out. Move it back to the top level of the scene and it comes back exactly as you left it.'
            : "Only an object in the scene itself can have a body. Arcade places a body from its object's X and Y, and inside a group those are the group's coordinates rather than the scene's."}
        </p>
      </>
    );
  }

  return (
    <>
      <div className="panel__section">Physics</div>
      <CheckboxField
        label="Physics body"
        value={body !== null}
        onChange={(on) => setNodePhysics(node.id, on ? {} : null)}
      />

      {body && (
        <>
          <SelectField
            label="Body"
            value={body.kind}
            options={[
              { value: 'dynamic', label: 'Dynamic — moves' },
              { value: 'static', label: 'Static — never moves' },
            ]}
            onChange={(kind) =>
              setNodePhysics(node.id, { kind: kind === 'static' ? 'static' : 'dynamic' })
            }
          />

          {/* A static body genuinely has none of these — Phaser's StaticBody
              carries no velocity, bounce, drag, mass or gravity — so they are
              absent rather than disabled. A disabled field says "not now"; these
              do not exist for this kind of body at all. */}
          {body.kind === 'dynamic' && (
            <>
              <div className="field-row">
                <NumberField
                  label="Velocity X"
                  value={body.velocityX}
                  onChange={(velocityX) => setNodePhysics(node.id, { velocityX })}
                />
                <NumberField
                  label="Velocity Y"
                  value={body.velocityY}
                  onChange={(velocityY) => setNodePhysics(node.id, { velocityY })}
                />
              </div>
              <div className="field-row">
                <NumberField
                  label="Bounce X"
                  value={body.bounceX}
                  step={0.05}
                  min={0}
                  onChange={(bounceX) => setNodePhysics(node.id, { bounceX })}
                />
                <NumberField
                  label="Bounce Y"
                  value={body.bounceY}
                  step={0.05}
                  min={0}
                  onChange={(bounceY) => setNodePhysics(node.id, { bounceY })}
                />
              </div>
              <div className="field-row">
                <NumberField
                  label="Drag X"
                  value={body.dragX}
                  min={0}
                  onChange={(dragX) => setNodePhysics(node.id, { dragX })}
                />
                <NumberField
                  label="Drag Y"
                  value={body.dragY}
                  min={0}
                  onChange={(dragY) => setNodePhysics(node.id, { dragY })}
                />
              </div>
              <div className="field-row">
                <NumberField
                  label="Spin°/s"
                  value={body.angularVelocity}
                  onChange={(angularVelocity) =>
                    setNodePhysics(node.id, { angularVelocity })
                  }
                />
                <NumberField
                  label="Mass"
                  value={body.mass}
                  step={0.1}
                  min={0.0001}
                  onChange={(mass) => setNodePhysics(node.id, { mass })}
                />
              </div>
              <CheckboxField
                label="Immovable"
                value={body.immovable}
                onChange={(immovable) => setNodePhysics(node.id, { immovable })}
              />
              <CheckboxField
                label="Affected by gravity"
                value={body.allowGravity}
                onChange={(allowGravity) => setNodePhysics(node.id, { allowGravity })}
              />
            </>
          )}

          <CheckboxField
            label="Collide with world bounds"
            value={body.collideWorldBounds}
            onChange={(collideWorldBounds) =>
              setNodePhysics(node.id, { collideWorldBounds })
            }
          />
          <p className="hint">
            The green outline on the canvas is the body. It stays square to the
            screen however the object is turned, because an Arcade body does not
            rotate with what it belongs to. Nothing moves in the editor — the
            document is what you are editing, so the simulation is left to the
            game you export.
          </p>

          {/* Only for a dynamic body, and absent rather than disabled for the
              reason the velocity rows above are: a StaticBody has no velocity
              for a key to change, so this does not exist for that kind of body
              rather than being switched off for it. */}
          {body.kind === 'dynamic' && <ControlsSection node={node} />}
        </>
      )}
    </>
  );
}

/**
 * What the player drives this object with.
 *
 * The first thing in this editor that is about the game *running*, and it is
 * here — under the body it needs — rather than in a panel of its own, because
 * it is a property of that body: a velocity is what a key changes, and a static
 * body has none. Only a top-level node can have one, which `PhysicsSection`
 * has already established by the time this renders.
 *
 * Two modes rather than a row of switches, for the reason `NodeControls` says:
 * a top-down game moves on four axes and never jumps, a platformer moves on two
 * and jumps, and the combinations in between are ones nobody asks for and the
 * exporter would have to answer for.
 */
function ControlsSection({ node }: { node: GameObjectNode }) {
  const setNodeControls = useEditorStore((s) => s.setNodeControls);
  // Derived outside the selector: `controlsOf` builds a fresh object every
  // call, the `tileMapOf` trap.
  const controls = controlsOf(node, true);

  return (
    <>
      <div className="panel__section">Controls</div>
      <CheckboxField
        label="Player controls"
        value={controls !== null}
        onChange={(on) => setNodeControls(node.id, on ? {} : null)}
      />
      {controls && (
        <>
          <SelectField
            label="Control mode"
            value={controls.mode}
            options={[
              { value: 'platformer', label: 'Platformer — walk and jump' },
              { value: 'topDown', label: 'Top-down — walk any way' },
            ]}
            onChange={(mode) =>
              setNodeControls(node.id, { mode: mode === 'topDown' ? 'topDown' : 'platformer' })
            }
          />
          <SelectField
            label="Control keys"
            value={controls.scheme}
            options={[
              { value: 'arrows', label: 'Arrow keys' },
              { value: 'wasd', label: 'W A S D' },
            ]}
            onChange={(scheme) =>
              setNodeControls(node.id, { scheme: scheme === 'wasd' ? 'wasd' : 'arrows' })
            }
          />
          {/* Beside the keys rather than a third option in them: which keys and
              whether there are also buttons are two questions, and keeping them
              apart is what lets one export play on a desktop and on a phone. */}
          <CheckboxField
            label="On-screen buttons"
            value={controls.touch}
            onChange={(touch) => setNodeControls(node.id, { touch })}
          />
          <div className="field-row">
            <NumberField
              label="Walk speed"
              value={controls.speed}
              min={0}
              onChange={(speed) => setNodeControls(node.id, { speed })}
            />
            {/* Absent in top-down for the rule this panel already follows twice
                over: there is no jump in a game with no down. */}
            {controls.mode === 'platformer' && (
              <NumberField
                label="Jump speed"
                value={controls.jump}
                min={0}
                onChange={(jump) => setNodeControls(node.id, { jump })}
              />
            )}
          </div>
          <p className="hint">
            The green arrows on the body are which object the keys drive. Nothing
            moves here either — the export gets an <code>update()</code> that
            reads the keys, and a jump needs something under it, which is a
            collision or a solid tile.
          </p>
          {controls.touch && (
            <p className="hint">
              The orange rings are where the exported game draws its buttons. They
              are the game's, not the editor's — nothing here presses them — and
              there is one set per scene, so everything driven in this scene
              reads the same buttons. A top-down object puts up and down on the
              pad; a platformer puts a jump button on the right.
            </p>
          )}
        </>
      )}
    </>
  );
}
