import type { GameObjectNode } from './schema';

/**
 * The inspector's section titles that the core has to know about.
 *
 * A section title is a **persisted storage key** — `Section` keys its open
 * state by title and `io/prefs.ts` writes that map — and it is also what a
 * `ValidationIssue.inspectorSection` names so that `focusValidationIssue` can
 * open the section holding the broken field. The second is why these live in
 * core rather than beside the panel: `validation.ts` and the store have to name
 * a section, and core imports nothing from `ui/`.
 */

/**
 * Heading for each type's own section. A `Record` over the node-type union, so
 * a new type is a compile error here, which is the same guarantee this table
 * gave when it lived in `Inspector.tsx`.
 */
export const SECTION_TITLE: Record<GameObjectNode['type'], string> = {
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

/**
 * Which section renders a prop's field, per type, where that is not the type's
 * own section. Hand-matched against `Inspector.tsx`, so a field moved between
 * sections there has to move here too — the cost of a mismatch is only that a
 * warning opens the neighbouring section rather than the right one.
 */
const PROP_SECTION: Partial<Record<GameObjectNode['type'], Record<string, string>>> = {
  sprite: {
    frame: 'Sprite sheet',
    animationId: 'Animation',
    tint: 'Appearance',
    alpha: 'Appearance',
    flipX: 'Appearance',
    flipY: 'Appearance',
  },
  nineslice: {
    frame: 'Sprite sheet',
    width: 'Size',
    height: 'Size',
    left: 'Slices',
    right: 'Slices',
    top: 'Slices',
    bottom: 'Slices',
    tint: 'Appearance',
    alpha: 'Appearance',
  },
  tileSprite: {
    frame: 'Sprite sheet',
    width: 'Size',
    height: 'Size',
    tilePositionX: 'Pattern',
    tilePositionY: 'Pattern',
    tileScaleX: 'Pattern',
    tileScaleY: 'Pattern',
    tint: 'Appearance',
    alpha: 'Appearance',
  },
  text: {
    wordWrapWidth: 'Paragraph',
    align: 'Paragraph',
    lineSpacing: 'Paragraph',
    letterSpacing: 'Paragraph',
    strokeColor: 'Stroke and shadow',
    strokeThickness: 'Stroke and shadow',
    shadowColor: 'Stroke and shadow',
    shadowOffsetX: 'Stroke and shadow',
    shadowOffsetY: 'Stroke and shadow',
    shadowBlur: 'Stroke and shadow',
  },
  particles: {
    frame: 'Sprite sheet',
    lifespan: 'Emission',
    quantity: 'Emission',
    frequency: 'Emission',
    speedMin: 'Emission',
    speedMax: 'Emission',
    angleMin: 'Emission',
    angleMax: 'Emission',
    gravityX: 'Emission',
    gravityY: 'Emission',
    scaleStart: 'Particle',
    scaleEnd: 'Particle',
    alphaStart: 'Particle',
    alphaEnd: 'Particle',
    tint: 'Particle',
    alpha: 'Appearance',
    followId: 'Follow',
  },
  tilemap: {
    columns: 'Grid',
    rows: 'Grid',
    alpha: 'Appearance',
  },
};

/**
 * The section that holds the field a document path names, for one node.
 *
 * `path` is relative to the node — `transform.x`, `props.assetId`,
 * `props.label.variableId`. Anything this cannot place falls back to the type's
 * own section, which is always rendered and is always the nearest honest answer.
 */
export function inspectorSectionFor(type: GameObjectNode['type'], path: string): string {
  const [head, key] = path.split('.');
  if (head === 'transform') return 'Transform';
  if (head === 'props' && key) return PROP_SECTION[type]?.[key] ?? SECTION_TITLE[type];
  return SECTION_TITLE[type];
}
