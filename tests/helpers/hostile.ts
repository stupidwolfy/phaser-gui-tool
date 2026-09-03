import { SCHEMA_VERSION, type Project } from '../../src/core/schema';
import { stripPng } from './png';

/**
 * A project made of everything a project file should not contain.
 *
 * Generated code is built from free user text, and every hole found so far was
 * in a field nobody had thought to make hostile — the `</script>` in a text
 * object first, and then the *scene name*, which reaches `super(...)` and the
 * class declaration. So this covers every string the exporter interpolates,
 * and the rule when a new field starts reaching the output is to add it here.
 */
export function hostileProject(): Project {
  const breakout = '</script><script>window.__pwned = "yes";</script>';
  // A real four-frame sheet, because the export path for one runs Phaser's own
  // sprite-sheet parser and `generateFrameNumbers` against the actual bytes —
  // a stub data URL would be dropped by `parseAssets` and take the sprite, the
  // clip and this whole path out of the export with it.
  const sheet = `data:image/png;base64,${stripPng(8, ['#ff0000', '#00ff00', '#0000ff', '#ffff00']).toString('base64')}`;

  return {
    schemaVersion: SCHEMA_VERSION,
    // Reaches the generated <title> and a comment in the file header.
    name: `${breakout}</title><img src=x onerror="window.__pwned='title'">`,
    // Reaches the CDN URL, so it must be validated rather than interpolated.
    phaserVersion: '4.2.1"></script><script>window.__pwned="cdn"</script>',
    assets: [
      {
        id: 'sheet-1',
        // The asset name becomes the *texture key* in exported code, through
        // `toIdentifier` — a path neither the scene name nor an object name
        // takes, since those become a class name and a variable.
        name: `${breakout} sheet.png`,
        mimeType: 'image/png',
        dataUrl: sheet,
        width: 32,
        height: 8,
        sheet: { frameWidth: 8, frameHeight: 8, margin: 0, spacing: 0 },
      },
    ],
    animations: [
      {
        id: 'anim-1',
        // The clip name becomes the animation *key*, which is a string literal
        // rather than an identifier — so it reaches the output with nothing but
        // `str()` between it and the page, in both `anims.create` and `.play`.
        name: `${breakout} walk`,
        assetId: 'sheet-1',
        // Out of order and repeating, so the emitted frame list is not merely a
        // range that a start/end pair would also have produced.
        frames: [0, 2, 1, 2],
        frameRate: 8,
        repeat: -1,
      },
    ],
    prefabs: [
      {
        id: 'prefab-1',
        // The prefab name becomes a *factory function* name in exported code,
        // through `toIdentifier('create ' + name)` — a fifth path, and the one
        // whose output is called from inside `create()`, so a collision here
        // would call an object instead of a function rather than merely
        // producing an odd variable name.
        name: `${breakout} coin`,
        children: [
          {
            id: 'p1',
            name: breakout,
            type: 'rectangle',
            visible: true,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            props: { width: 60, height: 60, fill: '#7ee787', alpha: 1 },
            children: [],
          },
          {
            id: 'p2',
            // A sprite *inside* a definition, which is what proves the asset
            // collection descends into prefab bodies. Without the descent this
            // exports the "no image chosen" comment for an image that is
            // chosen — a plausible-looking export that draws nothing — and
            // every other assertion here still passes.
            name: 'scene',
            type: 'sprite',
            visible: true,
            transform: { x: 40, y: 0, rotation: 0, scaleX: 2, scaleY: 2 },
            props: {
              assetId: 'sheet-1',
              alpha: 1,
              tint: '#ffffff',
              flipX: false,
              flipY: false,
              frame: 1,
              animationId: null,
            },
            children: [],
          },
        ],
      },
    ],
    activeSceneId: 'scene-1',
    scenes: [
      {
        id: 'scene-1',
        // Reaches both the class name and super(...).
        name: `Main ${breakout} Scene`,
        width: 960,
        height: 540,
        // Reaches a CSS declaration and a JS string; not a hex colour at all.
        backgroundColor: '#1d2330; } body { background: url(javascript:1) } /*',
        // Guides carry no user text — a machine id, a two-member union and a
        // number — so there is nothing here for the escaping to get wrong. They
        // are in the fixture for the other risk: an exporter that one day walks
        // the scene's keys instead of naming them would start emitting editor
        // furniture into somebody's game. `export.spec` asserts they do not
        // appear in the output, and that assertion needs a guide to be real.
        guides: [
          { id: 'guide-1', axis: 'x' as const, position: 480 },
          { id: 'guide-2', axis: 'y' as const, position: 270 },
        ],
        children: [
          {
            id: 'a',
            name: breakout,
            type: 'rectangle',
            visible: true,
            transform: { x: 480, y: 270, rotation: 0, scaleX: 1, scaleY: 1 },
            props: { width: 200, height: 120, fill: '#4f8cff', alpha: 1 },
            children: [],
          },
          {
            id: 'b',
            // Blank, so `toIdentifier` has nothing to work with.
            name: '',
            type: 'ellipse',
            visible: true,
            transform: { x: 200, y: 150, rotation: 0, scaleX: 1, scaleY: 1 },
            // Not a colour, so `hexLiteral` has to reject it.
            props: { width: 100, height: 100, fill: '0xdeadbeef); alert(1); //', alpha: 1 },
            children: [],
          },
          {
            id: 'c',
            // Starts with a digit and repeats the identifier of the next one.
            name: '123 name',
            type: 'text',
            visible: true,
            transform: { x: 480, y: 80, rotation: 0, scaleX: 1, scaleY: 1 },
            props: {
              // The comment opener and the two line terminators JSON allows raw
              // in a string but older JS parsers do not.
              text: `${breakout}<!--\u2028\u2029"quoted" \\ backslash`,
              fontSize: 28,
              color: '#ffffff',
              fontFamily: 'system-ui, sans-serif',
              alpha: 1,
            },
            children: [],
          },
          {
            id: 'e',
            // A group carries its own hostile name into an identifier, and its
            // children reach the export through a second path — the nested
            // emit and the `add([...])` list — that the flat cases never take.
            name: `${breakout} group`,
            type: 'container',
            visible: true,
            // A rotation, and a rotated one at three decimals, because that is
            // what the rotate gesture settles on and nothing else in this
            // fixture had a non-zero angle — so `modifiersFor`'s `.setAngle`
            // line reached neither export toolchain.
            transform: { x: 700, y: 400, rotation: 12.5, scaleX: 1, scaleY: 1 },
            props: { alpha: 1 },
            children: [
              {
                id: 'e1',
                name: breakout,
                type: 'rectangle',
                visible: true,
                // Local coordinates: the group puts it at 700,400.
                transform: { x: 0, y: 0, rotation: -37.125, scaleX: 1, scaleY: 1 },
                props: { width: 120, height: 80, fill: '#22d3ee', alpha: 1 },
                children: [],
              },
            ],
          },
          {
            id: 'f',
            name: `${breakout} player`,
            type: 'sprite',
            visible: true,
            transform: { x: 150, y: 420, rotation: 0, scaleX: 4, scaleY: 4 },
            props: {
              assetId: 'sheet-1',
              alpha: 1,
              tint: '#ffffff',
              flipX: false,
              flipY: false,
              frame: 0,
              animationId: 'anim-1',
            },
            children: [],
          },
          {
            id: 'g',
            // The same sheet, still, on a non-zero frame: the other half of the
            // sprite export — `add.image(..., frame)` rather than
            // `add.sprite(...).play(...)`. Both have to survive the toolchains.
            name: 'still frame',
            type: 'sprite',
            visible: true,
            transform: { x: 850, y: 420, rotation: 0, scaleX: 4, scaleY: 4 },
            props: {
              assetId: 'sheet-1',
              alpha: 1,
              tint: '#ffffff',
              flipX: false,
              flipY: false,
              frame: 3,
              animationId: null,
            },
            children: [],
          },
          {
            id: 'h',
            // Two instances of one prefab, which is the whole point of the
            // factory emit: one function, two calls. This one is turned and
            // scaled so `modifiersFor` runs over an instance as well.
            name: `${breakout} coin A`,
            type: 'instance',
            visible: true,
            transform: { x: 300, y: 300, rotation: 21.5, scaleX: 1.5, scaleY: 1.5 },
            props: { prefabId: 'prefab-1', alpha: 0.8 },
            children: [],
          },
          {
            id: 'i',
            name: 'coin B',
            type: 'instance',
            visible: true,
            transform: { x: 600, y: 200, rotation: 0, scaleX: 1, scaleY: 1 },
            props: { prefabId: 'prefab-1', alpha: 1 },
            children: [],
          },
          {
            id: 'j',
            // A dangling reference, which only a hand-edited file can hold —
            // and the other branch of `constructorFor` returning null, so the
            // stand-in comment is emitted for something other than a sprite.
            name: 'gone',
            type: 'instance',
            visible: true,
            transform: { x: 100, y: 100, rotation: 0, scaleX: 1, scaleY: 1 },
            props: { prefabId: 'nope', alpha: 1 },
            children: [],
          },
          {
            id: 'd',
            name: 'name123',
            type: 'text',
            visible: true,
            transform: { x: 480, y: 460, rotation: 0, scaleX: 1, scaleY: 1 },
            props: {
              text: 'ordinary',
              fontSize: 20,
              color: '#ffb84f',
              fontFamily: 'system-ui, sans-serif',
              alpha: 1,
            },
            children: [],
          },
        ],
      },
    ],
  };
}
