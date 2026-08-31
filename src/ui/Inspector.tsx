import { useActiveScene, useEditorStore, useSelectedNode } from '../core/store';
import type { GameObjectNode } from '../core/schema';
import { ColorField, NumberField, TextField } from './fields';

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

      <div className="panel__section">
        {node.type === 'text' ? 'Text' : 'Shape'}
      </div>

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
