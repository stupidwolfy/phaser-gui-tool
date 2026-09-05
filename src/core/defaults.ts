import {
  EMPTY_TILE,
  SCHEMA_VERSION,
  TARGET_PHASER_VERSION,
  newId,
  type GameObjectNode,
  type NodeType,
  type PhysicsBody,
  type Prefab,
  type Project,
  type SceneDoc,
  type SceneSound,
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
    case 'nineslice':
      return {
        ...base,
        type: 'nineslice',
        name: name ?? 'Panel',
        // No asset, for the reason a sprite has none: adding an object should
        // never open a file dialog. 12px insets on a 240x120 box is a dialog
        // frame — big enough that the corners are visibly *not* stretching the
        // moment the panel is widened, which is the whole thing this type is
        // for and the one thing a new user has to be able to see happen.
        props: {
          assetId: null,
          frame: 0,
          width: 240,
          height: 120,
          left: 12,
          right: 12,
          top: 12,
          bottom: 12,
          tint: '#ffffff',
          alpha: 1,
        },
      };
    case 'tileSprite':
      return {
        ...base,
        type: 'tileSprite',
        name: name ?? 'Tiled',
        // 320x180 is 16:9 at a third of the default scene, so a new one reads
        // as a piece of background rather than as an object. Offset 0 and scale
        // 1 is the texture at its own size, starting at its own corner — the
        // plain repeat a tile sprite that never meets the inspector stays at.
        props: {
          assetId: null,
          frame: 0,
          width: 320,
          height: 180,
          tilePositionX: 0,
          tilePositionY: 0,
          tileScaleX: 1,
          tileScaleY: 1,
          tint: '#ffffff',
          alpha: 1,
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
          // Every typography field at Phaser's own default, so a text object
          // added today draws and exports exactly what one added before
          // iteration 22 did — the rule the asset table, the tilemap helper,
          // the prefab factories, the emitted `update()` and the touch buttons
          // all follow.
          bold: false,
          italic: false,
          align: 'left',
          wordWrapWidth: 0,
          lineSpacing: 0,
          letterSpacing: 0,
          strokeColor: '#000000',
          strokeThickness: 0,
          shadowColor: '#000000',
          shadowOffsetX: 0,
          shadowOffsetY: 0,
          shadowBlur: 0,
        },
      };
  }
}

/**
 * A body the moment it is switched on, before the user has touched a field.
 *
 * Every dial at Phaser's own default except `collideWorldBounds`, which starts
 * *on*. A dynamic body with gravity and nothing to stop it leaves the scene in
 * under a second, so a body that started unbounded would make the feature look
 * broken the first time anyone exported it — and the scene rectangle is already
 * the world's bounds, so the box it stays inside is one the user can see.
 */
export function defaultPhysicsBody(kind: PhysicsBody['kind'] = 'dynamic'): PhysicsBody {
  return {
    kind,
    velocityX: 0,
    velocityY: 0,
    bounceX: 0,
    bounceY: 0,
    dragX: 0,
    dragY: 0,
    angularVelocity: 0,
    mass: 1,
    immovable: false,
    allowGravity: true,
    collideWorldBounds: true,
  };
}

/**
 * A scene's registration of a sound, at rest.
 *
 * Full volume, no loop and no autoplay: the settings a sound effect wants, and
 * the ones that make adding one to a scene silent until the user asks for
 * otherwise. A theme that starts by itself is a deliberate act, not a default —
 * the same call `createNode` makes when every asset-bearing type starts with no
 * image, because adding something should never surprise the person who did it.
 */
export function defaultSceneSound(audioId: string): SceneSound {
  return { id: newId(), audioId, loop: false, volume: 1, autoplay: false };
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
    // The spread is shallow, and a tilemap's `data` and `collides` are the only
    // props that are arrays — two copies sharing one would be a latent aliasing
    // bug the moment anything here stopped being written immutably. Every path
    // that copies a node runs through this one function, so they are copied
    // here once.
    props:
      node.type === 'tilemap'
        ? {
            ...node.props,
            data: [...node.props.data],
            ...(node.props.collides ? { collides: [...node.props.collides] } : {}),
          }
        : { ...node.props },
    // The same trap one field over: `physics` and `controls` are objects, so the
    // outer spread would leave the copy and the original sharing one, and
    // editing the duplicate's bounce would edit the original's too.
    ...(node.physics ? { physics: { ...node.physics } } : {}),
    ...(node.controls ? { controls: { ...node.controls } } : {}),
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
    audio: [],
    fonts: [],
    animations: [],
    prefabs: [],
    scenes: [scene],
    activeSceneId: scene.id,
  };
}
