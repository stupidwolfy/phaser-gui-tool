import {
  SCHEMA_VERSION,
  TARGET_PHASER_VERSION,
  newId,
  type GameObjectNode,
  type NodeType,
  type Project,
  type SceneDoc,
  type Transform,
} from './schema';

export const DEFAULT_SCENE_WIDTH = 960;
export const DEFAULT_SCENE_HEIGHT = 540;

const identityTransform = (x: number, y: number): Transform => ({
  x,
  y,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
});

/** Creates a node of the given type with sensible starting values. */
export function createNode(
  type: NodeType,
  x: number,
  y: number,
  name?: string,
): GameObjectNode {
  const base = {
    id: newId(),
    visible: true,
    transform: identityTransform(x, y),
    children: [] as GameObjectNode[],
  };

  switch (type) {
    case 'rectangle':
      return {
        ...base,
        type: 'rectangle',
        name: name ?? 'Rectangle',
        props: { width: 160, height: 100, fill: '#4f8cff', alpha: 1 },
      };
    case 'ellipse':
      return {
        ...base,
        type: 'ellipse',
        name: name ?? 'Ellipse',
        props: { width: 120, height: 120, fill: '#ffb84f', alpha: 1 },
      };
    case 'text':
      return {
        ...base,
        type: 'text',
        name: name ?? 'Text',
        props: {
          text: 'Hello Phaser',
          fontSize: 32,
          color: '#ffffff',
          fontFamily: 'system-ui, sans-serif',
          alpha: 1,
        },
      };
  }
}

/**
 * Deep copy of a node with fresh ids all the way down, for duplicate and paste.
 * Ids must not repeat: they are the key the Phaser sync diffs display objects
 * against, so a shared id would leave the two copies fighting over one object.
 *
 * The cast is the same one the store needs: spreading a value of a
 * discriminated union widens `props` past the branch `type` picked.
 */
export function cloneWithNewIds(node: GameObjectNode): GameObjectNode {
  return {
    ...node,
    id: newId(),
    transform: { ...node.transform },
    props: { ...node.props },
    children: node.children.map(cloneWithNewIds),
  } as GameObjectNode;
}

/**
 * A new project is never empty — an empty canvas gives a first-time visitor
 * nothing to click, and no way to tell the editor from a broken page.
 */
export function newProject(name = 'Untitled Project'): Project {
  const scene: SceneDoc = {
    id: newId(),
    name: 'MainScene',
    width: DEFAULT_SCENE_WIDTH,
    height: DEFAULT_SCENE_HEIGHT,
    backgroundColor: '#1d2330',
    children: [
      createNode('rectangle', 480, 320, 'Platform'),
      createNode('ellipse', 300, 190, 'Ball'),
      createNode('text', 480, 110, 'Title'),
    ],
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    name,
    phaserVersion: TARGET_PHASER_VERSION,
    scenes: [scene],
    activeSceneId: scene.id,
  };
}
