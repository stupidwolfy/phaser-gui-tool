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
            // And controls, for that same reason: a definition's children are
            // container children, so this is the second illegal place and the
            // emit has to leave it out too.
            controls: {
              mode: 'platformer' as const,
              scheme: 'arrows' as const,
              speed: 10,
              jump: 10,
              // Asking for buttons from an illegal place, so `touchZonesOf`
              // dropping it is asserted rather than assumed.
              touch: true,
            },
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
        // Likewise for `cameraOf`, and with a non-default value in every field
        // for the reason the body below has one: the toolchain specs compile
        // the emitted `.ts` under `tsc --strict` against the real Phaser types,
        // and that is the only place `setScroll`, `setZoom`, `setRoundPixels`,
        // `setBounds` and `startFollow` ever meet
        // `Phaser.Cameras.Scene2D.Camera`. The follow target is the hostilely
        // named rectangle below, so the emitted call also has to name a binding
        // that survived `toIdentifier`.
        camera: {
          scrollX: 120,
          scrollY: -60,
          zoom: 1.5,
          boundToScene: true,
          roundPixels: true,
          followId: 'a',
          followLerp: 0.15,
        },
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
        // Three rows the export must emit and four it must not, and each of the
        // four is a thing only a hand-edited file or a since-deleted node can
        // hold. `collidersOf` drops them all on read, which is what means
        // nothing downstream needs a guard.
        colliders: [
          // A body against a tilemap layer, which is the pair the whole feature
          // exists for — and the only place `add.collider` meets
          // `Phaser.Tilemaps.TilemapLayer` under `tsc --strict`.
          { id: 'col-1', aId: 'a', bId: 'l', kind: 'collide' as const },
          // And the other function, against a static body.
          { id: 'col-2', aId: 'a', bId: 'g', kind: 'overlap' as const },
          // Kept by the reader and *not* emitted: `m` is a tilemap with no
          // tileset, so it reaches `create()` as a comment rather than a
          // binding. This is the only test of the missing-binding branch, which
          // is `missingReason`'s treatment and the camera follow's.
          { id: 'col-3', aId: 'a', bId: 'm', kind: 'collide' as const },
          // Dangling.
          { id: 'col-4', aId: 'a', bId: 'gone', kind: 'collide' as const },
          // The same node on both sides.
          { id: 'col-5', aId: 'a', bId: 'a', kind: 'collide' as const },
          // A node inside a group, which has no body to find and so is not a
          // direct child the reader will accept — the top-level rule arriving
          // through the collider table.
          { id: 'col-6', aId: 'a', bId: 'e1', kind: 'collide' as const },
          // Two layers, which cannot collide with each other: neither moves.
          { id: 'col-7', aId: 'l', bId: 'm', kind: 'collide' as const },
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
            // Driven, with a non-default value in every field, for the body's
            // reason: the emitted `update()` is the only place `CursorKeys`,
            // `blocked.down` and `setVelocityX` ever meet the real Phaser types
            // under `tsc --strict`. Its name is the hostile one, so the
            // `this.<field>` it is parked on has been through `toIdentifier`
            // as well.
            controls: {
              mode: 'platformer' as const,
              scheme: 'arrows' as const,
              speed: 260,
              jump: 520,
              // On, because the touch helper and the widened `update()` — the
              // keyboard read folded into an `||` — meet `Phaser.Scene`,
              // `GameObjects.Arc` and `Body` under `tsc --strict` nowhere else.
              touch: true,
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
              // Free user text that reaches a JS string literal *and* the
              // runnable page's `<script>` body, and until iteration 22 it was
              // the one field on this node nobody had made hostile \u2014 which is
              // exactly where the holes have always been.
              fontFamily: `${breakout}", cursive`,
              alpha: 1,
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
            children: [],
          },
          {
            id: 'c-styled',
            name: 'styled text',
            type: 'text',
            visible: true,
            transform: { x: 700, y: 300, rotation: 0, scaleX: 1, scaleY: 1 },
            // A non-default value in every one of the twelve typography fields,
            // and carrying no hostile string at all \u2014 it is not here for
            // escaping. It is the only place the emitted style literal's
            // *shape* meets `Phaser.Types.GameObjects.Text.TextStyle` under
            // `tsc --strict`, which is where a key renamed between Phaser
            // versions fails and nowhere else. The hostile emitter's argument,
            // one type over.
            props: {
              text: 'wrapped\nand styled',
              fontSize: 24,
              color: '#ffe066',
              fontFamily: 'Georgia, serif',
              alpha: 0.9,
              bold: true,
              italic: true,
              align: 'center',
              wordWrapWidth: 180,
              lineSpacing: 6,
              letterSpacing: 2,
              strokeColor: '#7a1fa2',
              strokeThickness: 3,
              shadowColor: '#123456',
              shadowOffsetX: 4,
              shadowOffsetY: -2,
              shadowBlur: 5,
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
                // And controls on that same nested node, which the store
                // likewise cannot reach to write. `controlsOf` strips them, so
                // the emitted `update()` must show no trace — the body's
                // argument one field over.
                controls: {
                  mode: 'topDown' as const,
                  scheme: 'wasd' as const,
                  speed: 90,
                  jump: 0,
                  // Likewise, and top-down: if `touchZonesOf` reached a nested
                  // node the pad would sprout an up and a down that nothing in
                  // the emitted `update()` ever reads.
                  touch: true,
                },
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
              // Solid tiles, which reach the emitted `setCollision`. One index
              // repeated and one the tileset does not have, both of which only
              // a hand-edited file can hold: `tileMapOf` normalises them away,
              // so the export must show `[0, 2]` and nothing else.
              collides: [2, 0, 2, 99],
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
            id: 'r',
            // A panel with a hostile name and a non-default value in all ten of
            // its fields.
            //
            // Its point is the emitter's: the config carries no free user text,
            // but `export-toolchain.spec` compiles the emitted `.ts` under
            // `tsc --strict` against the real Phaser types, and this is the only
            // place `add.nineslice`'s ten-argument shape is checked against
            // them. Its arguments are all positional, so an argument inserted or
            // reordered between Phaser versions is a panel drawn wrong with
            // nothing failing — except here. Rotated and scaled so
            // `modifiersFor` runs over one too, and tinted so its `setTint`
            // does.
            name: `${breakout} panel`,
            type: 'nineslice',
            visible: true,
            transform: { x: 240, y: 300, rotation: 12.5, scaleX: 1.25, scaleY: 0.8 },
            props: {
              assetId: 'sheet-1',
              frame: 1,
              width: 220,
              height: 140,
              left: 3,
              right: 2,
              top: 2,
              bottom: 3,
              tint: '#88ccff',
              alpha: 0.9,
            },
            children: [],
          },
          {
            id: 's',
            // Insets that do not fit: 6 + 6 is wider than the 8px frame they
            // are cut from, and the box is narrower still. Only a hand-edited
            // file can hold these — the inspector's fields cannot produce them
            // — and `sliceInsetsOf` is what stops them reaching Phaser, which
            // would draw the panel inside out. The export is the half that
            // matters here: the editor could clamp on its own and still ship a
            // broken game.
            name: 'squeezed panel',
            type: 'nineslice',
            visible: true,
            transform: { x: 520, y: 300, rotation: 0, scaleX: 1, scaleY: 1 },
            props: {
              assetId: 'sheet-1',
              frame: 0,
              width: 10,
              height: 10,
              left: 6,
              right: 6,
              top: 6,
              bottom: 6,
              tint: '#ffffff',
              alpha: 1,
            },
            children: [],
          },
          {
            id: 't',
            // Static, because a repeating wall is the thing a platformer stands
            // on and because this is the only place a body reaches one of the
            // two types iteration 19 added to `PHYSICS_TYPES` — that list is a
            // silent step, so nothing else would notice if it were wrong.
            physics: { kind: 'static' as const, ...NO_MOTION },
            // A tile sprite with a non-default offset and tile scale, which is
            // the only thing that runs `modifiersFor`'s `.setTilePosition` and
            // `.setTileScale` — the one pair of fields `add.tileSprite` has
            // nowhere to take, so a chain that failed to compile would fail
            // only here.
            name: `${breakout} wall`,
            type: 'tileSprite',
            visible: true,
            transform: { x: 700, y: 300, rotation: 7, scaleX: 1, scaleY: 1 },
            props: {
              assetId: 'sheet-1',
              frame: 3,
              width: 180,
              height: 90,
              tilePositionX: 12,
              tilePositionY: -6,
              tileScaleX: 2,
              tileScaleY: 1.5,
              tint: '#ffcc00',
              alpha: 0.75,
            },
            children: [],
          },
          {
            id: 'u',
            // No image, which is the panel half of `missingReason`: it takes
            // `constructorFor`'s null return exactly as the unfinished emitter
            // and the unsliced map do. Scoped assertions matter here — this
            // makes "no image chosen in the editor" correct output for a third
            // node, so a whole-file `not.toContain` on that string is a test
            // about something else that this would break.
            name: 'unfinished panel',
            type: 'nineslice',
            visible: true,
            transform: { x: 900, y: 300, rotation: 0, scaleX: 1, scaleY: 1 },
            props: {
              assetId: null,
              frame: 0,
              width: 120,
              height: 60,
              left: 8,
              right: 8,
              top: 8,
              bottom: 8,
              tint: '#ffffff',
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
              // Every field at its default, on purpose: this is the node that
              // proves a text object made before iteration 22 still exports the
              // three keys it always did and nothing more.
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
