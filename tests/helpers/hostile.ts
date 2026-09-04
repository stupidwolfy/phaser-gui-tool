import { SCHEMA_VERSION, type Project } from '../../src/core/schema';
import { stripPng } from './png';
import { silentWav } from './wav';

/**
 * A project made of everything a project file should not contain.
 *
 * Generated code is built from free user text, and every hole found so far was
 * in a field nobody had thought to make hostile — the `</script>` in a text
 * object first, and then the *scene name*, which reaches `super(...)` and the
 * class declaration. So this covers every string the exporter interpolates,
 * and the rule when a new field starts reaching the output is to add it here.
 */
/**
 * A body's fields at rest, for the fixtures whose point is the *shape* of the
 * emit rather than its numbers — the numbers are exercised once, in full, on
 * the top-level rectangle.
 */
const NO_MOTION = {
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
  collideWorldBounds: false,
};

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
    audio: [
      {
        id: 'sound-1',
        // The name becomes the *audio cache key* in exported code, through
        // `toIdentifier` — a sixth interpolation path, and the only one whose
        // output a human is told to copy into a `play()` call of their own.
        name: `${breakout} jump.wav`,
        mimeType: 'audio/wav',
        // Real bytes, for the reason the sheet is real: the export tests decode
        // this in a browser, and a stub would be dropped by `parseAudio` and
        // take the whole audio path out of the export with it.
        dataUrl: `data:audio/wav;base64,${silentWav(20).toString('base64')}`,
        duration: 0.02,
      },
      {
        // A plain name, so its key is predictably `jump` — which is what lets
        // the object named "jump sound" below actually collide with it. A
        // hostile name cannot do that job: nobody can write down in advance
        // what `toIdentifier` will make of one.
        id: 'sound-2',
        name: 'jump.wav',
        mimeType: 'audio/wav',
        dataUrl: `data:audio/wav;base64,${silentWav(20).toString('base64')}`,
        duration: 0.02,
      },
      {
        // Imported and used by no scene, which is the case that proves only
        // *registered* sounds are emitted — a deleted-from-every-scene sound
        // must not ship its bytes, the rule the images already follow.
        id: 'sound-3',
        name: 'unused.wav',
        mimeType: 'audio/wav',
        dataUrl: `data:audio/wav;base64,${silentWav(20).toString('base64')}`,
        duration: 0.02,
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
            // Carries a body for the reason the nested rectangle above does:
            // a prefab factory adds its children to the Container it returns,
            // so a definition's children are container children by exactly the
            // same mechanism, and the emit has to leave this one out too.
            physics: { kind: 'dynamic' as const, ...NO_MOTION },
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
        // Set here and deliberately absent from the second scene, so both
        // branches of `scenePhysicsOf` reach the exporter in one file.
        physics: { gravityX: -20, gravityY: 480 },
        // `autoplay` is deliberately false on both. It would add an
        // AudioContext-resume dependency to two toolchain tests for no
        // coverage at all — the emitted `.play()` line is one statement, and
        // `export.spec` asserts its text rather than its sound.
        sounds: [
          { id: 'snd-1', audioId: 'sound-1', loop: true, volume: 0.5, autoplay: false },
          // A second entry on the *same* file, so the binding de-duplication in
          // `buildSoundLines` runs: two rows would otherwise both bind
          // `jumpSound` and the module would not parse.
          { id: 'snd-2', audioId: 'sound-1', loop: false, volume: 1, autoplay: false },
          { id: 'snd-3', audioId: 'sound-2', loop: false, volume: 0.25, autoplay: false },
          // Dangling, which only a hand-edited file can hold. `soundsOf` drops
          // it, so the export must show no trace of it at all.
          { id: 'snd-4', audioId: 'gone', loop: false, volume: 1, autoplay: false },
        ],
        children: [
          {
            id: 'a',
            name: breakout,
            type: 'rectangle',
            visible: true,
            transform: { x: 480, y: 270, rotation: 0, scaleX: 1, scaleY: 1 },
            props: { width: 200, height: 120, fill: '#4f8cff', alpha: 1 },
            // A dynamic body with a non-default value in every field. Not here
            // for escaping — a body carries no free user text — but because
            // `export-toolchain.spec` compiles the emitted `.ts` under
            // `tsc --strict` against the real Phaser types, and this is the
            // only place the emitted setter chain ever meets
            // `Phaser.Physics.Arcade.Body`. A method Phaser renamed between
            // versions would fail there and nowhere else. The hostile emitter's
            // eighteen fields are here for exactly the same reason.
            physics: {
              kind: 'dynamic' as const,
              velocityX: 120,
              velocityY: -45,
              bounceX: 0.4,
              bounceY: 0.85,
              dragX: 30,
              dragY: 5,
              angularVelocity: 90,
              mass: 2.5,
              immovable: false,
              allowGravity: false,
              collideWorldBounds: true,
            },
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
                // A body on a node inside a group, which only a hand-edited
                // file can hold — the store cannot reach one to write it. It is
                // what proves the exporter emits nothing for a nested body
                // rather than emitting one positioned in the group's
                // coordinates.
                physics: { kind: 'dynamic' as const, ...NO_MOTION },
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
            // The other branch: a static body is one `add.existing(obj, true)`
            // with nothing to chain, so without this the `true` argument never
            // reaches either toolchain.
            physics: { kind: 'static' as const, ...NO_MOTION },
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
            id: 'l',
            // A tilemap drawing the same sheet as a tileset, with a hostile
            // name that becomes both a variable binding and a *key in the
            // TILEMAPS table* — a seventh path into the output, and the only
            // one where user text becomes an object literal's property.
            // Rotated and scaled so `modifiersFor` runs over a layer too, and
            // holding an empty cell and a real tile so both halves of the data
            // survive both toolchains.
            name: `${breakout} ground`,
            type: 'tilemap',
            visible: true,
            transform: { x: 60, y: 60, rotation: 8.25, scaleX: 1.5, scaleY: 1.5 },
            props: {
              assetId: 'sheet-1',
              columns: 3,
              rows: 2,
              data: [0, -1, 2, 3, 0, -1],
              alpha: 0.9,
            },
            children: [],
          },
          {
            id: 'm',
            // No tileset at all, which is the tilemap half of `missingReason`:
            // an export that silently omitted this object would read as an
            // exporter bug rather than as a map nobody finished.
            name: 'unfinished map',
            type: 'tilemap',
            visible: true,
            transform: { x: 800, y: 60, rotation: 0, scaleX: 1, scaleY: 1 },
            props: { assetId: null, columns: 2, rows: 2, data: [-1, -1, -1, -1], alpha: 1 },
            children: [],
          },
          {
            id: 'n',
            // An emitter with a hostile name and a non-default value in every
            // one of its eighteen fields.
            //
            // Its point is not escaping — the config carries no free user text
            // beyond `blendMode` — but that `export-toolchain.spec` compiles
            // the emitted `.ts` under `tsc --strict` against the real Phaser
            // types. That is the only place the config literal's *shape* is
            // checked against `ParticleEmitterConfig`, and a key Phaser renamed
            // between versions would fail there and nowhere else. Rotated and
            // scaled so `modifiersFor` runs over an emitter too.
            name: `${breakout} sparks`,
            type: 'particles',
            visible: true,
            transform: { x: 200, y: 420, rotation: 17.25, scaleX: 1.5, scaleY: 1.5 },
            props: {
              assetId: 'sheet-1',
              frame: 2,
              lifespan: 750,
              speedMin: 30,
              speedMax: 210,
              angleMin: 200,
              angleMax: 340,
              scaleStart: 1.4,
              scaleEnd: 0.2,
              alphaStart: 0.9,
              alphaEnd: 0.1,
              quantity: 3,
              frequency: 80,
              gravityX: 15,
              gravityY: 120,
              tint: '#ff8800',
              blendMode: 'ADD',
              alpha: 0.85,
            },
            children: [],
          },
          {
            id: 'o',
            // No image, which is the emitter half of `missingReason`: it takes
            // `constructorFor`'s null return, exactly as the unfinished map
            // above does.
            name: 'unfinished sparks',
            type: 'particles',
            visible: true,
            transform: { x: 860, y: 420, rotation: 0, scaleX: 1, scaleY: 1 },
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
            children: [],
          },
          {
            id: 'p',
            // Named after the module-level body helper, so `toIdentifier`
            // collides with it. Without this the seeding of `bodyFn` into
            // `buildCreateBody`'s and every factory body's identifier set is
            // untested, and the failure it guards against is silent: an object
            // bound as `arcadeBody` inside `create()` would shadow the function
            // the line beside it calls, and the export would compile.
            name: 'arcade body',
            type: 'rectangle',
            visible: true,
            transform: { x: 780, y: 120, rotation: 0, scaleX: 1, scaleY: 1 },
            props: { width: 60, height: 60, fill: '#8b5cf6', alpha: 1 },
            children: [],
          },
          {
            id: 'q',
            // Named after a sound handle, so `toIdentifier` collides with one.
            // The `arcade body` trick one feature over, and it catches the
            // opposite failure: the sounds are allocated out of `create()`'s
            // identifier set *before* any object is, so this object must come
            // out as `jumpSound2` and the handle must keep `jumpSound`. Getting
            // the order wrong compiles and silently hands a hand-written
            // `jumpSound.play()` a rectangle.
            name: 'jump sound',
            type: 'rectangle',
            visible: true,
            transform: { x: 840, y: 120, rotation: 0, scaleX: 1, scaleY: 1 },
            props: { width: 40, height: 40, fill: '#22d3ee', alpha: 1 },
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
      {
        id: 'scene-2',
        // Deliberately the *same name* as the scene above. A name reaches the
        // output twice over — as a class declaration and as the key handed to
        // `super()` — and a repeat is fatal in both: two `class Main` in one
        // module will not parse, and two scenes under one key has Phaser keep
        // the first and lose the second. Nothing in the editor stops a user
        // calling two scenes the same thing, so the exporter has to.
        name: `Main ${breakout} Scene`,
        width: 960,
        height: 540,
        backgroundColor: '#101820',
        children: [
          {
            id: 'k',
            // The same sheet and the same clip as the first scene's player.
            // Both scenes therefore preload the one texture and register the
            // one animation, which is what the `anims.exists` guard is for —
            // an animation belongs to the game, not to the scene that got
            // there first.
            name: `${breakout} second player`,
            type: 'sprite',
            visible: true,
            transform: { x: 480, y: 270, rotation: 0, scaleX: 4, scaleY: 4 },
            props: {
              assetId: 'sheet-1',
              alpha: 1,
              tint: '#ffffff',
              flipX: false,
              flipY: false,
              frame: 0,
              animationId: 'anim-1',
            },
            // A body in a scene that has *no* `physics` field of its own, so
            // `scenePhysicsOf`'s default branch reaches the exporter in the
            // same file as the scene above, which sets one.
            physics: { kind: 'static' as const, ...NO_MOTION },
            children: [],
          },
        ],
      },
    ],
  };
}
