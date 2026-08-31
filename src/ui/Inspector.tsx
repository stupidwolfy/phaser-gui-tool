import { useActiveScene, useEditorStore, useSelectedNode } from '../core/store';
import type { GameObjectNode } from '../core/schema';
import { AssetPicker, AssetSummary } from './AssetPicker';
import { CheckboxField, ColorField, NumberField, TextField } from './fields';

/** Edits the selected object, or the scene itself when nothing is selected. */
export function Inspector() {
  const node = useSelectedNode();
  return node ? <NodeInspector node={node} /> : <SceneInspector />;
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
    </div>
  );
}

/** Heading for the per-type section, which is the only thing that differs. */
const SECTION_TITLE: Record<GameObjectNode['type'], string> = {
  rectangle: 'Shape',
  ellipse: 'Shape',
  text: 'Text',
  sprite: 'Image',
};

/**
 * Draw order controls. The labels talk about front and back rather than up and
 * down the list: array order *is* draw order, and the tree lists the array as
 * it is, so the first row is the object furthest back.
 */
function ArrangeRow({ node }: { node: GameObjectNode }) {
  const scene = useActiveScene();
  const reorderNode = useEditorStore((s) => s.reorderNode);
  const duplicateNode = useEditorStore((s) => s.duplicateNode);

  const index = scene.children.findIndex((child) => child.id === node.id);
  const last = scene.children.length - 1;
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
          onClick={() => duplicateNode(node.id)}
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
  const deleteNode = useEditorStore((s) => s.deleteNode);

  const setProp = (patch: Record<string, unknown>) => updateProps(node.id, patch);

  return (
    <div className="panel">
      <div className="panel__header">
        <span>{node.type}</span>
        <button
          className="icon-btn icon-btn--danger"
          onClick={() => deleteNode(node.id)}
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
          onChange={(scaleX) => updateTransform(node.id, { scaleX })}
        />
        <NumberField
          label="Scale Y"
          value={node.transform.scaleY}
          step={0.1}
          onChange={(scaleY) => updateTransform(node.id, { scaleY })}
        />
      </div>

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
