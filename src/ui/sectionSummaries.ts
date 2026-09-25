import {
  atlasOf,
  frameGridOf,
  frameLayoutOf,
  type BlendMode,
  type GameObjectNode,
  type ImageAsset,
  type NodeControls,
  type NodeEffect,
  type NodeTween,
  type PhysicsBody,
  type PhysicsEngine,
  type SceneCamera,
  type ScenePhysics,
  type ScrollFactor,
  type TextProps,
  type Transform,
} from '../core/schema';

/**
 * One line saying what a collapsed inspector section holds.
 *
 * Every function here is pure and takes what the section component has
 * *already* read through the document's own readers (`physicsOf`, `tweenOf`,
 * `effectsOf`, …), so a summary cannot disagree with the fields it summarises
 * about what the document says — it is the same answer, shorter. None of them
 * belongs inside a zustand selector: several build a fresh object per call, and
 * the ones they are handed do too, which is the `tileMapOf` trap.
 *
 * Only three states come from here. `warning` and `invalid` come from
 * `validateProject`, through `Section`, so no section decides for itself what
 * counts as broken.
 */
export interface SectionSummary {
  text: string;
  /**
   * `default` is what an untouched section says; `configured` is anything the
   * user has changed from it; `mixed` is a set of objects that disagree, or a
   * setting that is stored but not in force.
   */
  state: 'default' | 'configured' | 'mixed';
}

const quiet = (text: string): SectionSummary => ({ text, state: 'default' });
const set = (text: string): SectionSummary => ({ text, state: 'configured' });

/** A number as a person would write it: at most two places, no trailing zeros. */
export function num(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

/** Free user text shortened for a head, by characters rather than pixels. */
export function clip(text: string, max = 24): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export function transformSummary(t: Transform): SectionSummary {
  const parts = [`${num(t.x)}, ${num(t.y)}`];
  if (t.rotation !== 0) parts.push(`${num(t.rotation)}°`);
  if (t.scaleX !== 1 || t.scaleY !== 1) {
    parts.push(t.scaleX === t.scaleY ? `×${num(t.scaleX)}` : `${num(t.scaleX)}×${num(t.scaleY)}`);
  }
  return quiet(parts.join(' · '));
}

export function parentSummary(parentName: string | null): SectionSummary {
  return parentName === null ? quiet('Scene') : set(parentName || 'Unnamed group');
}

export function arrangeSummary(index: number, count: number): SectionSummary {
  if (count <= 1) return quiet('Only object');
  if (index === 0) return quiet(`Back · 1 of ${count}`);
  if (index === count - 1) return quiet(`Front · ${count} of ${count}`);
  return quiet(`${index + 1} of ${count}`);
}

export function shapeSummary(props: { width: number; height: number; fill: string }): SectionSummary {
  return quiet(`${num(props.width)}×${num(props.height)} · ${props.fill}`);
}

export function sizeSummary(props: { width: number; height: number }): SectionSummary {
  return quiet(`${num(props.width)}×${num(props.height)}`);
}

export function textSummary(props: TextProps, variableName: string | null): SectionSummary {
  const caption = props.text ? `“${clip(props.text)}”` : 'Empty';
  return variableName === null ? quiet(caption) : set(`${caption} · shows ${variableName}`);
}

export function paragraphSummary(props: TextProps): SectionSummary {
  const parts: string[] = [];
  if (props.wordWrapWidth > 0) parts.push(`Wrap ${num(props.wordWrapWidth)}`);
  if (props.align !== 'left') parts.push(props.align === 'center' ? 'centre' : props.align);
  if (props.lineSpacing !== 0) parts.push(`line ${num(props.lineSpacing)}`);
  if (props.letterSpacing !== 0) parts.push(`letter ${num(props.letterSpacing)}`);
  return parts.length ? set(parts.join(' · ')) : quiet('Default');
}

export function strokeShadowSummary(props: TextProps): SectionSummary {
  const stroke = props.strokeThickness > 0;
  const shadow = props.shadowOffsetX !== 0 || props.shadowOffsetY !== 0 || props.shadowBlur > 0;
  if (stroke && shadow) return set('Stroke and shadow');
  if (stroke) return set(`Stroke ${num(props.strokeThickness)}`);
  if (shadow) return set('Shadow');
  return quiet('None');
}

/** The image a type draws, and the frame it draws of it. */
export function imageSummary(
  asset: ImageAsset | undefined,
  assetId: string | null,
  frame?: number | string,
): SectionSummary {
  // A dangling id has no name to show. Validation says it is missing, and
  // `Section` puts that over this, so only the plain wording is needed here.
  if (!assetId || !asset) return quiet('No image');
  const cut = frameGridOf(asset) !== null || atlasOf(asset) !== null;
  if (!cut || frame === undefined) return set(asset.name);
  return set(`${asset.name} · ${typeof frame === 'number' ? `frame ${frame}` : frame}`);
}

export function sheetSummary(asset: ImageAsset | undefined): SectionSummary {
  if (!asset) return quiet('Not sliced');
  const atlas = atlasOf(asset);
  if (atlas) return set(`Atlas · ${plural(atlas.length, 'frame')}`);
  if (frameGridOf(asset)) {
    const { columns, rows } = frameLayoutOf(asset);
    return set(`Grid ${columns}×${rows} · ${plural(columns * rows, 'frame')}`);
  }
  return quiet('Not sliced');
}

export function animationSummary(clipName: string | null): SectionSummary {
  return clipName === null ? quiet('None') : set(clipName || 'Unnamed clip');
}

/** Only what differs from a plain draw; `Default` when nothing does. */
export function appearanceSummary(props: {
  tint?: string;
  alpha: number;
  flipX?: boolean;
  flipY?: boolean;
}): SectionSummary {
  const parts: string[] = [];
  if (props.tint !== undefined && props.tint.toLowerCase() !== '#ffffff') parts.push(`Tint ${props.tint}`);
  if (props.alpha !== 1) parts.push(`Alpha ${num(props.alpha)}`);
  if (props.flipX) parts.push('Flip X');
  if (props.flipY) parts.push('Flip Y');
  return parts.length ? set(parts.join(' · ')) : quiet('Default');
}

export function slicesSummary(p: { left: number; right: number; top: number; bottom: number }): SectionSummary {
  return quiet(`${num(p.left)} / ${num(p.right)} / ${num(p.top)} / ${num(p.bottom)}`);
}

export function patternSummary(p: {
  tilePositionX: number;
  tilePositionY: number;
  tileScaleX: number;
  tileScaleY: number;
}): SectionSummary {
  const parts: string[] = [];
  if (p.tilePositionX !== 0 || p.tilePositionY !== 0) {
    parts.push(`offset ${num(p.tilePositionX)}, ${num(p.tilePositionY)}`);
  }
  if (p.tileScaleX !== 1 || p.tileScaleY !== 1) {
    parts.push(`scale ${num(p.tileScaleX)}×${num(p.tileScaleY)}`);
  }
  return parts.length ? set(parts.join(' · ')) : quiet('Default');
}

export function emissionSummary(p: { frequency: number; quantity: number; lifespan: number }): SectionSummary {
  return quiet(`every ${num(p.frequency)}ms · ×${num(p.quantity)} · life ${num(p.lifespan)}ms`);
}

export function particleSummary(p: {
  scaleStart: number;
  scaleEnd: number;
  alphaStart: number;
  alphaEnd: number;
  tint: string;
}): SectionSummary {
  const parts = [`scale ${num(p.scaleStart)}→${num(p.scaleEnd)}`, `alpha ${num(p.alphaStart)}→${num(p.alphaEnd)}`];
  if (p.tint.toLowerCase() !== '#ffffff') parts.push(`tint ${p.tint}`);
  return quiet(parts.join(' · '));
}

/**
 * A trail. `held` is the id the document stores and `honoured` is what
 * `particleFollowOf` answered — the two differ exactly when the follow is
 * stored but not in force, which is the one thing worth marking as mixed here.
 */
export function followSummary(held: string | null | undefined, honoured: GameObjectNode | null): SectionSummary {
  if (honoured) return set(`Follows ${honoured.name || honoured.type}`);
  if (held) return { text: 'Off · not in force', state: 'mixed' };
  return quiet('Off');
}

export function groupSummary(childCount: number): SectionSummary {
  return childCount === 0 ? quiet('Empty') : set(plural(childCount, 'object'));
}

export function instanceSummary(prefabName: string | null, uses: number): SectionSummary {
  if (prefabName === null) return quiet('No prefab');
  return set(`${prefabName || 'Unnamed prefab'} · used ${uses}×`);
}

export function tilesetSummary(asset: ImageAsset | undefined, tileCount: number): SectionSummary {
  if (!asset) return quiet('No tileset');
  return set(tileCount > 0 ? `${asset.name} · ${plural(tileCount, 'tile')}` : `${asset.name} · not sliced`);
}

export function gridSummary(columns: number, rows: number, tileWidth: number, tileHeight: number): SectionSummary {
  const tile = tileWidth === tileHeight ? `${num(tileWidth)}px` : `${num(tileWidth)}×${num(tileHeight)}px`;
  return quiet(`${columns}×${rows} · ${tile}`);
}

export function layersSummary(names: readonly string[]): SectionSummary {
  return names.length <= 1 ? quiet(names[0] ?? '1 layer') : set(plural(names.length, 'layer'));
}

export function brushSummary(erasing: boolean, tile: number, layerName: string): SectionSummary {
  return quiet(`${erasing ? 'Erase' : `Tile ${tile}`} · ${layerName}`);
}

export function solidSummary(solidFrames: number): SectionSummary {
  return solidFrames === 0 ? quiet('None') : set(plural(solidFrames, 'solid frame'));
}

/**
 * A body: which engine, which kind, which shape. `topLevel` false is not an
 * error — it is the physics rule saying why this object cannot have one — so
 * a body stored on a nested node reads as mixed (kept, not in force) and no
 * body at all reads as the default.
 */
export function physicsSummary(
  body: PhysicsBody | null,
  engine: PhysicsEngine,
  topLevel: boolean,
  stored: boolean,
): SectionSummary {
  if (!topLevel) return stored ? { text: 'Kept · not in force in a group', state: 'mixed' } : quiet('Top level only');
  if (!body) return quiet('Off');
  const kind = body.kind === 'dynamic' ? 'Dynamic' : 'Static';
  const shape = body.shape === 'circle' ? 'circle' : 'box';
  return set(engine === 'matter' ? `Matter · ${kind.toLowerCase()} · ${shape}` : `${kind} · ${shape}`);
}

export function pairsSummary(pairs: number): SectionSummary {
  return pairs === 0 ? quiet('None') : set(plural(pairs, 'pair'));
}

export function controlsSummary(controls: NodeControls | null): SectionSummary {
  if (!controls) return quiet('Off');
  const mode = controls.mode === 'platformer' ? 'Platformer' : 'Top-down';
  const keys = controls.scheme === 'wasd' ? 'WASD' : 'arrows';
  return set([mode, keys, ...(controls.touch ? ['buttons'] : [])].join(' · '));
}

export function blendSummary(mode: BlendMode): SectionSummary {
  const word = mode.charAt(0) + mode.slice(1).toLowerCase();
  return mode === 'NORMAL' ? quiet(word) : set(word);
}

export function scrollSummary(factor: ScrollFactor): SectionSummary {
  if (factor.x === 1 && factor.y === 1) return quiet('1 × 1');
  const text = `${num(factor.x)} × ${num(factor.y)}`;
  return set(factor.x === 0 && factor.y === 0 ? `${text} · pinned` : text);
}

const EFFECT_NAME: Record<NodeEffect['kind'], string> = {
  glow: 'Glow',
  blur: 'Blur',
  shadow: 'Shadow',
  pixelate: 'Pixelate',
  mask: 'Mask',
};

export function effectsSummary(effects: readonly NodeEffect[]): SectionSummary {
  return effects.length === 0 ? quiet('None') : set(effects.map((effect) => EFFECT_NAME[effect.kind]).join(', '));
}

const TWEEN_WORD: Record<keyof NodeTween['to'], string> = {
  x: 'x',
  y: 'y',
  rotation: 'rotation',
  scaleX: 'scale X',
  scaleY: 'scale Y',
  alpha: 'alpha',
};

export function tweenSummary(tween: NodeTween | null): SectionSummary {
  if (!tween) return quiet('Off');
  const driven = (Object.keys(TWEEN_WORD) as (keyof NodeTween['to'])[])
    .filter((key) => tween.to[key] !== undefined)
    .map((key) => TWEEN_WORD[key]);
  const parts = [driven.join(', '), `${num(tween.duration)}ms`];
  if (tween.yoyo) parts.push('yoyo');
  if (tween.repeat < 0) parts.push('forever');
  else if (tween.repeat > 0) parts.push(`×${tween.repeat + 1}`);
  return set(parts.join(' · '));
}

export function rulesSummary(count: number): SectionSummary {
  return count === 0 ? quiet('None') : set(plural(count, 'rule'));
}

export function cameraSummary(camera: SceneCamera, followName: string | null): SectionSummary {
  const parts: string[] = [];
  if (followName !== null) parts.push(`Follows ${followName || 'object'}`);
  if (camera.zoom !== 1) parts.push(`zoom ${num(camera.zoom)}`);
  if (camera.scrollX !== 0 || camera.scrollY !== 0) parts.push(`at ${num(camera.scrollX)}, ${num(camera.scrollY)}`);
  if (camera.boundToScene) parts.push('bounded');
  if (camera.roundPixels) parts.push('whole pixels');
  return parts.length ? set(parts.join(' · ')) : quiet('Default');
}

export function worldSummary(physics: ScenePhysics): SectionSummary {
  const engine = physics.engine === 'matter' ? 'Matter' : 'Arcade';
  const gravity = `gravity ${num(physics.gravityX)}, ${num(physics.gravityY)}`;
  const configured = physics.engine === 'matter' || physics.gravityX !== 0 || physics.gravityY !== 0;
  return configured ? set(`${engine} · ${gravity}`) : quiet(`${engine} · no gravity`);
}

export function snappingSummary(objects: boolean, grid: boolean, gridSize: number): SectionSummary {
  const parts: string[] = [];
  if (objects) parts.push('Objects');
  if (grid) parts.push(`grid ${num(gridSize)}`);
  return parts.length ? quiet(parts.join(' · ')) : quiet('Off');
}

export function countSummary(count: number, one: string): SectionSummary {
  return count === 0 ? quiet('None') : set(plural(count, one));
}

/**
 * A set of objects. Visibility is the one thing the panel acts on for all of
 * them at once, so it is the one thing said — and said as a split rather than
 * as either answer when the set disagrees.
 */
export function selectionSummary(nodes: readonly Pick<GameObjectNode, 'visible'>[]): SectionSummary {
  const hidden = nodes.filter((node) => !node.visible).length;
  const all = plural(nodes.length, 'object');
  if (hidden === 0) return quiet(`${all} · all visible`);
  if (hidden === nodes.length) return set(`${all} · all hidden`);
  return { text: `${hidden} of ${nodes.length} hidden`, state: 'mixed' };
}

const TYPE_WORD: Record<GameObjectNode['type'], string> = {
  rectangle: 'Rectangle',
  ellipse: 'Ellipse',
  text: 'Text',
  sprite: 'Sprite',
  nineslice: 'Panel',
  tileSprite: 'Tiled image',
  container: 'Group',
  instance: 'Prefab',
  tilemap: 'Tilemap',
  particles: 'Particles',
};

/** `Rectangle ×2, Text`, in the order the types were first met. */
export function objectsSummary(nodes: readonly Pick<GameObjectNode, 'type'>[]): SectionSummary {
  const counts = new Map<GameObjectNode['type'], number>();
  for (const node of nodes) counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
  const text = [...counts].map(([type, n]) => (n > 1 ? `${TYPE_WORD[type]} ×${n}` : TYPE_WORD[type])).join(', ');
  return counts.size > 1 ? { text, state: 'mixed' } : quiet(text);
}
