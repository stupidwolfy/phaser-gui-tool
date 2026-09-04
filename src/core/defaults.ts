import {
  EMPTY_TILE,
  SCHEMA_VERSION,
  TARGET_PHASER_VERSION,
  newId,
  type GameObjectNode,
  type NodeType,
  type Prefab,
  type Project,
  type SceneDoc,
  type Transform,
} from './schema';

/**
 * Frames per second a new animation starts at, and what the parser falls back
 * to for a clip whose rate is missing or nonsensical.
 *
 * Twelve rather than Phaser's own default of 24: a hand-drawn sprite sheet is
 * usually a handful of frames, and 24fps through six of them is a quarter of a
 * second of animation, which reads as a flicker rather than as a walk.
 */
export const DEFAULT_FRAME_RATE = 12;

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
    case 'sprite':
      return {
        ...base,
        type: 'sprite',
        name: name ?? 'Sprite',
        // No asset yet: a new sprite is a placeholder you then point at an
        // image, rather than an add button that opens a file dialog you might
        // not have an image ready for. Frame 0 and no animation is what a plain
        // image is, so a sprite that never meets a sheet never leaves it.
        props: {
          assetId: null,
          alpha: 1,
          tint: '#ffffff',
          flipX: false,
          flipY: false,
          frame: 0,
          animationId: null,
        },
      };
    case 'container':
      return {
        ...base,
        type: 'container',
        name: name ?? 'Group',
        // Empty: a container is a place to drop objects into, and one created
        // with contents would have to invent what those contents are.
        props: { alpha: 1 },
      };
    case 'instance':
      return {
        ...base,
        type: 'instance',
        name: name ?? 'Instance',
        // Unpointed: `createNode` is reached from the generic add path, and an
        // instance is normally built by `createInstanceNode` instead, which
        // has a prefab to name it after. A null id draws an empty box rather
        // than nothing, which is the same answer a sprite with no image gives.
        props: { prefabId: null, alpha: 1 },
      };
    case 'tilemap':
      return {
        ...base,
        type: 'tilemap',
        name: name ?? 'Tilemap',
        // No tileset, like a sprite has no image: adding an object should never
        // open a file dialog. 20x12 at the 32px fallback is 640x384, which sits
        // inside the default 960x540 scene with room to see its edges — a map
        // that filled the scene would have nothing around it to say it is an
        // object at all.
        props: {
          assetId: null,
          columns: 20,
          rows: 12,
          data: Array.from({ length: 20 * 12 }, () => EMPTY_TILE),
          alpha: 1,
        },
      };
    case 'particles':
      return {
        ...base,
        type: 'particles',
        name: name ?? 'Particles',
        // No image, for the reason a sprite has none: adding an object must
        // never open a file dialog. The numbers are a soft outward puff — a
        // 360-degree spray that shrinks and fades over a second — so that the
        // moment any image is chosen and preview is on, something recognisable
        // happens rather than a single dot or a wall of texture.
        props: {
          assetId: null,
          frame: 0,
          lifespan: 1000,
          speedMin: 50,
          speedMax: 150,
          angleMin: 0,
          angleMax: 360,
          scaleStart: 1,
          scaleEnd: 0,
          alphaStart: 1,
          alphaEnd: 0,
          quantity: 1,
          frequency: 50,
          gravityX: 0,
          gravityY: 0,
          tint: '#ffffff',
          blendMode: 'NORMAL',
          alpha: 1,
        },
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
 * A node that places the given prefab.
 *
 * Named after the prefab rather than "Instance": the tree row is the only place
 * a user sees which prefab this is without opening the inspector, and "Coin" in
 * five rows says more than "Instance" in five rows. The name is the node's own
 * from then on — renaming the prefab later does not rewrite it, exactly as
 * renaming an image does not rename the sprites drawing it.
 */
export function createInstanceNode(
  prefab: Prefab,
  x: number,
  y: number,
): GameObjectNode {
  const node = createNode('instance', x, y, prefab.name);
  return { ...node, type: 'instance', props: { prefabId: prefab.id, alpha: 1 } };
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
    // The spread is shallow, and a tilemap's `data` is the first prop that is
    // an array — two copies sharing one would be a latent aliasing bug the
    // moment anything here stopped being written immutably. Every path that
    // copies a node runs through this one function, so it is copied here once.
    props: node.type === 'tilemap' ? { ...node.props, data: [...node.props.data] } : { ...node.props },
    children: node.children.map(cloneWithNewIds),
  } as GameObjectNode;
}

/**
 * A scene with nothing in it.
 *
 * The starting size, colour and shape of a scene live here rather than in the
 * store's `addScene`, so that the scene a new project opens on and the scene
 * the user adds later are the same object built by the same function — the
 * second one differing only in being empty, which is the one thing that is
 * genuinely different about it. See `newProject` for why the first is not.
 */
export function createScene(name: string, children: GameObjectNode[] = []): SceneDoc {
  return {
    id: newId(),
    name,
    width: DEFAULT_SCENE_WIDTH,
    height: DEFAULT_SCENE_HEIGHT,
    backgroundColor: '#1d2330',
    children,
  };
}

/**
 * A new project is never empty — an empty canvas gives a first-time visitor
 * nothing to click, and no way to tell the editor from a broken page.
 *
 * A scene the user adds to an existing project is empty, and deliberately: by
 * then they have already seen what an object looks like, and three example
 * objects to delete is work rather than a welcome.
 */
export function newProject(name = 'Untitled Project'): Project {
  const scene = createScene('MainScene', [
    createNode('rectangle', 480, 320, 'Platform'),
    createNode('ellipse', 300, 190, 'Ball'),
    createNode('text', 480, 110, 'Title'),
  ]);

  return {
    schemaVersion: SCHEMA_VERSION,
    name,
    phaserVersion: TARGET_PHASER_VERSION,
    assets: [],
    animations: [],
    prefabs: [],
    scenes: [scene],
    activeSceneId: scene.id,
  };
}
