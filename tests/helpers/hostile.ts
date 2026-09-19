import { SCHEMA_VERSION, type Project } from '../../src/core/schema';
import { rectsPng, stripPng } from './png';
import { blockTtf } from './ttf';
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
  restitution: 0,
  frictionAir: 0.01,
  friction: 0.1,
};

export function hostileProject(): Project {
  const breakout = '</script><script>window.__pwned = "yes";</script>';
  // A real four-frame sheet, because the export path for one runs Phaser's own
  // sprite-sheet parser and `generateFrameNumbers` against the actual bytes —
  // a stub data URL would be dropped by `parseAssets` and take the sprite, the
  // clip and this whole path out of the export with it.
  const sheet = `data:image/png;base64,${stripPng(8, ['#ff0000', '#00ff00', '#0000ff', '#ffff00']).toString('base64')}`;
  // Real bytes for the same reason, one cut over: the export path runs Phaser's
  // own atlas parser and `generateFrameNames` against them.
  const atlas = `data:image/png;base64,${rectsPng(32, 16, '#101418', [
    { x: 0, y: 0, w: 32, h: 8, hex: '#ff00ff' },
    { x: 0, y: 8, w: 8, h: 8, hex: '#00ffff' },
  ]).toString('base64')}`;

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
      {
        id: 'atlas-1',
        // Plainly named, deliberately: the texture key path is already hostile
        // through `sheet-1`, and what is new here is the *frame names*, which
        // are the strings this feature added to the output. A hostile file name
        // on top would only make the assertions harder to read.
        name: 'atlas.png',
        mimeType: 'image/png',
        dataUrl: atlas,
        width: 32,
        height: 16,
        // Frames of two different sizes, so the emitted table is not something
        // a grid could have produced — and two hostile names, so the object-key
        // path and the call-argument path each carry one. Non-overlapping and
        // inside the image, or `atlasOf` would drop them and take the whole
        // path out of the export the way a stub data URL would.
        atlas: [
          { name: `${breakout} wide`, x: 0, y: 0, width: 32, height: 8 },
          { name: `${breakout} small`, x: 0, y: 8, width: 8, height: 8 },
        ],
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
    fonts: [
      {
        id: 'font-1',
        // A hostile *file name*, which is the row label in the panel. The
        // family beside it is deliberately a plain token, and that is the point
        // rather than a gap: `FONT_FAMILY` means a hostile family cannot
        // survive an open at all, so the string that actually reaches the
        // export — the `load.font` key and the `fontFamily` in the style
        // literal — is safe by construction. What is left to cover is the name,
        // and the fact that a font used by a text node is emitted at all.
        name: `${breakout} chunky.ttf`,
        family: 'Chunky',
        mimeType: 'font/ttf',
        // Real bytes, for the reason the sheet and the sounds are real: the
        // export tests load this through Phaser's own `FontFile` in a browser,
        // and a stub would be refused by the sanitiser and take the whole font
        // path out of the export with it.
        dataUrl: `data:font/ttf;base64,${blockTtf().toString('base64')}`,
      },
      {
        // Imported and named by no text node, which is the case that proves
        // only *used* fonts are emitted — the rule the images and the sounds
        // already follow, arriving at a table whose per-scene half is a walk.
        id: 'font-2',
        name: 'unused.ttf',
        family: 'Unused',
        dataUrl: `data:font/ttf;base64,${blockTtf(600).toString('base64')}`,
        mimeType: 'font/ttf',
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
      {
        id: 'anim-2',
        // The atlas half: a clip whose frames are *names*, which is the only
        // thing that reaches `generateFrameNames` — and the only place two
        // hostile strings land inside an array literal rather than as a lone
        // argument. Repeating, for `anim-1`'s reason.
        name: `${breakout} shimmer`,
        assetId: 'atlas-1',
        frames: [
          `${breakout} wide`,
          `${breakout} small`,
          `${breakout} wide`,
        ],
        frameRate: 6,
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
            // A tween in a *definition*, which is the only thing that puts
            // `scene.tweens.add` through both toolchains — the one line whose
            // receiver differs between a Scene method and a factory body, and
            // therefore the only place `EmitContext.receiver` is under test for
            // this feature. Unlike the body and the controls above, this one is
            // legal here and the export must emit it: a tween writes the
            // object's own local numbers, which a container child has.
            tween: {
              // At rest, for the reason the rectangle's is — `export.spec`
              // measures this child's colour to prove the factory ran.
              to: { x: 0, alpha: 1 },
              duration: 900,
              delay: 50,
              ease: 'Quad.easeInOut' as const,
              yoyo: true,
              repeat: -1,
              repeatDelay: 120,
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
          {
            id: 'p3',
            // A **labelled text node inside a definition**, and the only test of
            // the label emit's `${ctx.receiver}`: a factory is handed a `scene`
            // where `create()` has `this`, so a helper call hardcoding either
            // one is a `.ts` that does not compile in the other place. The tween
            // block's claim, one statement over — and a label is the second
            // thing on a node that is legal inside a definition, because it
            // writes the object's own text rather than reading world
            // coordinates the way a body and a drive scheme do.
            name: 'coin count',
            type: 'text',
            visible: true,
            transform: { x: 0, y: 40, rotation: 0, scaleX: 1, scaleY: 1 },
            props: {
              text: 'x',
              label: { variableId: 'var-2', decimals: 0, pad: 2 },
              fontSize: 16,
              color: '#ffffff',
              fontFamily: 'system-ui, sans-serif',
              alpha: 1,
              bold: false,
              italic: false,
              align: 'left' as const,
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
        id: 'prefab-2',
        // **Placed nowhere.** No `instance` node in any scene names it; the
        // only thing that does is `rule-1`'s `spawn`, and that is the whole
        // reason it exists. Without `collectPrefabs`' rule pass it gets no
        // factory at all, so the emitted `create()` calls a function that is
        // not declared — a compile error in the `.ts` and a `ReferenceError`
        // in the page, which is the one failure in this feature that is not a
        // wrong picture.
        //
        // Its name is hostile like every other, but its *identifier stem* is
        // chosen to collide with nothing: factory names come out of
        // `moduleNames` before the fifteen helper names, so a prefab called
        // "on key" or "init variables" would take `onKey`/`initVariables` and
        // push the helper to a `2` suffix — and four of those are asserted by
        // name in the suite.
        name: `${breakout} wave`,
        children: [
          {
            id: 'p4',
            // A **sprite**, and it is the load-bearing child: `emittedNodes`
            // has to descend into a rule-named definition or this exports the
            // "no image chosen in the editor" stand-in for an image that *is*
            // chosen, and the page draws a missing-texture square. The same
            // claim `p2` makes for a *placed* definition, arriving from the
            // side no node walk can reach.
            name: 'wave sprite',
            type: 'sprite',
            visible: true,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            props: {
              assetId: 'sheet-1',
              alpha: 1,
              tint: '#ffffff',
              flipX: false,
              flipY: false,
              frame: 2,
              animationId: null,
            },
            children: [],
          },
          {
            id: 'p5',
            // A labelled text child, for `p3`'s reason and one step further
            // out: `collectLabels` is the only one of `emittedNodes`' six
            // callers that did not already take a `project`, so without that
            // parameter this definition's `bindLabel(...)` call is emitted
            // inside a factory while the helper is never declared — the gate
            // that missed one emitting the call and not the function it calls.
            name: 'wave count',
            type: 'text',
            visible: true,
            // And an effect, for this child's own reason one table over:
            // `collectEffects` takes `emittedNodes`' `project` so that it can
            // see inside a definition a *rule* names and nothing places. Without
            // it this factory emits the attach call while the helper is never
            // declared — which is not a wrong picture but a compile error in the
            // emitted `.ts`, and only `export-toolchain.spec.ts` could find it.
            //
            // A pixelate because it puts no colour on the canvas at all, so the
            // two instances' own fill readings a few lines up stay exactly what
            // they were.
            fx: [{ kind: 'pixelate' as const, amount: 1 }],
            transform: { x: 0, y: 30, rotation: 0, scaleX: 1, scaleY: 1 },
            props: {
              text: 'wave ',
              label: { variableId: 'var-2', decimals: 0, pad: 0 },
              fontSize: 16,
              color: '#ffffff',
              fontFamily: 'system-ui, sans-serif',
              alpha: 1,
              bold: false,
              italic: false,
              align: 'left' as const,
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
    ],
    // Three variables, and each is here for its own reason.
    //
    // The first carries hostile free text, which reaches the output in three
    // places `variableKeyOf` and `str()` sit between: an object-literal *key*
    // in the `VARIABLES` table, a call argument to `registry.set`/`get`/`inc`,
    // and the runnable page's own `<script>` body. The atlas frame name's three
    // paths, one table over.
    //
    // The second is plainly named, so the ordinary emit is exercised too.
    //
    // The third derives the same identifier as the second — `toIdentifier`
    // strips the space and lower-cases nothing that matters — so the
    // de-duplication in `collectVariables` actually runs. Two variables sharing
    // one registry key is a *silently shared value at runtime*, which is worse
    // than two sounds sharing a key, so the suffix is the thing being asserted.
    //
    // The fourth holds hostile text in its **value**, which is a different set
    // of `str()` call sites from the first's hostile *name*: an object-literal
    // value in `VARIABLES`, a `registry.set` argument, a condition's right-hand
    // side and a `setText` argument. It is also the only place the widened
    // `Record<string, number | string>` signature meets a string under
    // `tsc --strict`.
    variables: [
      { id: 'var-1', name: `score ${breakout}`, value: 0 },
      { id: 'var-2', name: 'lives', value: 3 },
      { id: 'var-3', name: 'Lives', value: 99 },
      { id: 'var-4', name: 'message', value: `hi ${breakout}` },
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
        physics: { gravityX: -20, gravityY: 480, engine: 'arcade' as const },
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
        // Five rules the export must emit and seven it must not.
        //
        // **Every one of them is deliberately at rest**, and that is the
        // sharpest constraint on this fixture. `NO_MOTION`'s rule and the
        // at-rest tweens', one feature over: `export.spec`'s colour assertions
        // on this project would otherwise be racing a `destroy` and a
        // `setVisible` that are both correct behaviour and neither of which
        // those assertions are about. So every trigger is one nothing in the
        // suite presses — a tap, a key, a timer far longer than any test — and
        // the one `sceneStart` rule touches nothing that is drawn.
        rules: [
          // The whole vocabulary in one rule, and the *only* place the emitted
          // callbacks and registry calls meet `Phaser.Types.Time.TimerEventConfig`,
          // `ArcadePhysicsCallback`, `Tweens.Tween`, `ScenePlugin.start` and
          // `DataManager` under `tsc --strict`. The hostile emitter's argument,
          // five types over. Its name reaches the output as a comment, which is
          // a surface `</script>` breaks and only `commentText` guards.
          {
            id: 'rule-1',
            name: `Collect ${breakout}`,
            when: { kind: 'tap' as const, nodeId: 'a' },
            conditions: [
              { variableId: 'var-1', op: 'gte' as const, value: 3 },
              { variableId: 'var-2', op: 'ne' as const, value: 0 },
              // A text comparison, which is the only place a quoted right-hand
              // side reaches the emitted `if` — and the only place a hostile
              // string does.
              { variableId: 'var-4', op: 'eq' as const, value: `hi ${breakout}` },
            ],
            do: [
              { kind: 'destroy' as const, nodeId: 'b' },
              // The one thing in this list that *builds* rather than changes,
              // and it names the prefab nothing places. Non-default
              // coordinates, like every other field on this rule, because its
              // whole job here is the emitted call's shape meeting the
              // factory's `(scene: Phaser.Scene, x: number, y: number)` under
              // `tsc --strict` — and, in the runnable page, a factory that has
              // to exist and have had its texture preloaded.
              { kind: 'spawn' as const, prefabId: 'prefab-2', x: 137, y: 249 },
              { kind: 'setVisible' as const, nodeId: 'c', visible: false },
              { kind: 'playSound' as const, soundId: 'snd-1' },
              { kind: 'stopSound' as const, soundId: 'snd-3' },
              // `g` is a *still* sprite, so this is the only thing in the suite
              // that fails if `constructorFor`'s gate is not widened — and it
              // fails as a **compile error**, because an `Image` has no `play`.
              { kind: 'playAnimation' as const, nodeId: 'g', animationId: 'anim-1' },
              // `a` carries a full tween, so this is the only thing that emits
              // `paused: true` and a bound handle.
              { kind: 'startTween' as const, nodeId: 'a' },
              { kind: 'setVar' as const, variableId: 'var-1', value: 7 },
              { kind: 'addVar' as const, variableId: 'var-2', by: -1 },
              // Text into a text variable, and a caption onto the one text node
              // in the scene. `d` is the only `setText` target here, and the
              // only thing anywhere that puts `Text.setText` in front of
              // `tsc --strict` — an `Image` has not got one, which is what the
              // reader's `type !== 'text'` refusal is protecting.
              { kind: 'setVar' as const, variableId: 'var-4', value: `done ${breakout}` },
              {
                kind: 'setText' as const,
                nodeId: 'd',
                text: `Score ${breakout}`,
                variableId: 'var-1',
                // The formatted branch of the emit, which routes the read
                // through the same helper a bound label goes through — so this
                // is what proves the two ways of showing a number share one
                // formatter rather than each printing their own arithmetic.
                decimals: 1,
                pad: 4,
              },
              // The same action with no variable, which is the commonest shape
              // and the one that must not take the whole rule with it.
              { kind: 'setText' as const, nodeId: 'd', text: `over ${breakout}` },
              // The five camera effects, every field at a non-default value,
              // because that is the whole of what they are here for: this is
              // the only place the emitted calls meet
              // `Phaser.Cameras.Scene2D.Camera` under `tsc --strict`, and none
              // of them carries a hostile string to escape — they name nothing
              // the document holds, which is the property the reader rests on.
              // They ride on this rule for `NO_MOTION`'s reason: nothing in the
              // suite taps `a`, so an effect that actually ran would have
              // `export.spec.ts`' colour assertions racing a fade that is
              // correct behaviour and is not what those assertions are about.
              { kind: 'cameraShake' as const, duration: 420, intensity: 0.13 },
              { kind: 'cameraFlash' as const, duration: 380, color: '#ff00aa' },
              // Fading *in* rather than out, so the `fadeIn` branch is the one
              // under the compiler — `fade` is what every other fixture emits.
              {
                kind: 'cameraFade' as const,
                duration: 640,
                color: '#0a1b2c',
                fadeIn: true,
              },
              {
                kind: 'cameraPan' as const,
                x: 137,
                y: 249,
                duration: 1234,
                ease: 'Cubic.easeInOut' as const,
              },
              {
                kind: 'cameraZoom' as const,
                zoom: 1.75,
                duration: 987,
                ease: 'Expo.easeOut' as const,
              },
              { kind: 'startScene' as const, sceneId: 'scene-2' },
              { kind: 'restartScene' as const },
            ],
          },
          // A key, which is the only thing that exercises `onKey`'s narrowing
          // of a null keyboard.
          {
            id: 'rule-2',
            name: 'On space',
            when: { kind: 'keyDown' as const, key: 'SPACE' },
            conditions: [],
            do: [{ kind: 'addVar' as const, variableId: 'var-2', by: 1 }],
          },
          // A timer, far longer than any test runs, and non-looping so it can
          // never fire twice even if one did.
          {
            id: 'rule-3',
            name: 'Much later',
            when: { kind: 'timer' as const, delay: 999_000, loop: false },
            conditions: [],
            do: [{ kind: 'addVar' as const, variableId: 'var-1', by: 1 }],
          },
          // The one rule that does fire, and it touches nothing drawn.
          {
            id: 'rule-4',
            name: 'On start',
            when: { kind: 'sceneStart' as const },
            conditions: [],
            do: [{ kind: 'setVar' as const, variableId: 'var-1', value: 0 }],
          },
          // A collide rule on a pair that *has* a row, so the handler is folded
          // into `add.collider`'s third argument rather than emitted beside it.
          {
            id: 'rule-5',
            name: 'On hit',
            when: { kind: 'collide' as const, aId: 'a', bId: 'g' },
            conditions: [],
            do: [{ kind: 'addVar' as const, variableId: 'var-2', by: 1 }],
          },

          // --- and the seven the export must not emit ---

          // A nested node, which has no binding for an action to name — the
          // top-level rule arriving through the rule table.
          {
            id: 'rule-x1',
            name: 'Nested',
            when: { kind: 'tap' as const, nodeId: 'e1' },
            conditions: [],
            do: [{ kind: 'restartScene' as const }],
          },
          // A node inside a prefab definition, which every placement shares —
          // so an action could not say *which* one.
          {
            id: 'rule-x2',
            name: 'In a prefab',
            when: { kind: 'tap' as const, nodeId: 'p1' },
            conditions: [],
            do: [{ kind: 'restartScene' as const }],
          },
          // An Arcade collide rule on a pair with no row. Arcade only separates
          // two things that have been paired, and the handler *is* that call's
          // third argument, so there is nowhere for this one to be emitted.
          {
            id: 'rule-x3',
            name: 'Unpaired',
            when: { kind: 'collide' as const, aId: 'a', bId: 't' },
            conditions: [],
            do: [{ kind: 'restartScene' as const }],
          },
          // **The most important negative in this file**: a condition naming a
          // variable the project has not got. Dropping the *condition* would
          // widen the rule into one that fires always, so the rule goes whole.
          {
            id: 'rule-x4',
            name: 'Gated on nothing',
            when: { kind: 'sceneStart' as const },
            conditions: [{ variableId: 'gone', op: 'gte' as const, value: 1 }],
            do: [{ kind: 'restartScene' as const }],
          },
          // A tap on an emitter, which has neither Origin nor ComputedSize — so
          // Phaser's hit test adds an undefined `displayOriginX` and compares
          // `NaN`. The recorded reason the emitter is drawn inside a wrapper.
          {
            id: 'rule-x5',
            name: 'Tap an emitter',
            when: { kind: 'tap' as const, nodeId: 'n' },
            conditions: [],
            do: [{ kind: 'restartScene' as const }],
          },
          // One action names a node that is gone and the other does not: the
          // rule survives with one action fewer, because a dropped action
          // *narrows* what the rule says.
          {
            id: 'rule-x6',
            name: 'Half gone',
            when: { kind: 'keyDown' as const, key: 'ESC' },
            conditions: [],
            do: [
              { kind: 'destroy' as const, nodeId: 'gone' },
              { kind: 'addVar' as const, variableId: 'var-2', by: 2 },
            ],
          },
          // And one whose *only* action names something gone, which leaves a
          // real listener running an empty callback — indistinguishable from
          // the feature being broken, so the rule goes.
          {
            id: 'rule-x7',
            name: 'All gone',
            when: { kind: 'keyDown' as const, key: 'ENTER' },
            conditions: [],
            do: [{ kind: 'destroy' as const, nodeId: 'gone' }],
          },
          // A caption on a rectangle. Only a `Text` has `setText`, so this is a
          // dropped *action* rather than a dropped rule — and it is the one
          // negative here whose absence would be a **compile error** in the
          // exported `.ts` rather than a wrong picture, since `Rectangle` has no
          // such method. `rule-x6`'s shape, one method over.
          {
            id: 'rule-x8',
            name: 'Write on a box',
            when: { kind: 'keyDown' as const, key: 'TAB' },
            conditions: [],
            do: [
              { kind: 'setText' as const, nodeId: 'a', text: `nope ${breakout}` },
              { kind: 'addVar' as const, variableId: 'var-2', by: 5 },
            ],
          },
          // Arithmetic on text, and a number written into it: both cost the
          // whole rule, because a write dropped on its own leaves every
          // condition in the project testing a value nothing moves. Only a
          // hand-edited file can hold either — the panel offers neither.
          {
            id: 'rule-x9',
            name: 'Count a message',
            when: { kind: 'keyDown' as const, key: 'SHIFT' },
            conditions: [],
            do: [{ kind: 'addVar' as const, variableId: 'var-4', by: 1 }],
          },
          {
            id: 'rule-x10',
            name: 'Number into text',
            when: { kind: 'keyDown' as const, key: 'ALT' },
            conditions: [],
            do: [{ kind: 'setVar' as const, variableId: 'var-4', value: 3 }],
          },
          // An ordering test on text, which `'won' > 'lost'` makes legal
          // JavaScript and nonsense — refused rather than repaired to `eq`,
          // because a repaired gate is a gate nobody wrote.
          {
            id: 'rule-x11',
            name: 'Text in order',
            when: { kind: 'sceneStart' as const },
            conditions: [{ variableId: 'var-4', op: 'gt' as const, value: 'a' }],
            do: [{ kind: 'restartScene' as const }],
          },
          // A `varChange` trigger on the **hostilely named** variable, which is
          // the point of it: its derived registry key reaches `str()` in a
          // third place — an `onVariableChange` argument, beside the object
          // literal key in the variable table and a condition's `registry.get`.
          //
          // At rest, `NO_MOTION`'s rule one trigger over: `var-3` is the one
          // variable nothing in this fixture ever writes, so the listener is
          // registered, type-checked and bundled without ever firing — and
          // `export.spec`'s colour assertions never race a rule that is correct
          // behaviour and is not what they are about.
          {
            id: 'rule-x12',
            name: `Watch ${breakout}`,
            when: { kind: 'varChange' as const, variableId: 'var-1' },
            conditions: [{ variableId: 'var-1', op: 'gte' as const, value: 10 }],
            do: [{ kind: 'setVar' as const, variableId: 'var-2', value: 1 }],
          },
          // And one that writes the variable it watches. It cannot run away —
          // the emitted helper's per-listener guard is what stops that, and
          // `export.spec.ts` proves it by running one — but it is here for the
          // shape rather than the behaviour: this is the only place that guard
          // meets `tsc --strict` and a Vite bundle inside a rule whose body is
          // the same plain JavaScript in all three outputs.
          {
            id: 'rule-x13',
            name: 'Watches its own tail',
            when: { kind: 'varChange' as const, variableId: 'var-3' },
            conditions: [],
            do: [{ kind: 'addVar' as const, variableId: 'var-3', by: 1 }],
          },
          // A trigger naming a variable the table has not got, which only a
          // hand-edited file can hold: it costs the **whole rule**, where a
          // dangling `setText` node costs only the action. A trigger is a moment
          // and there is exactly one, so there is nothing left to attach to.
          {
            id: 'rule-x14',
            name: 'Watches nothing',
            when: { kind: 'varChange' as const, variableId: 'var-gone' },
            conditions: [],
            do: [{ kind: 'restartScene' as const }],
          },
          // Two spawns naming a prefab the library has not got, and they are
          // **a pair on purpose**: one of them alone cannot tell "a dangling
          // prefab costs the action" from "it costs the rule". This one keeps
          // its sibling, so the rule survives one action lighter — `rule-x6`'s
          // shape, and the half that says a dropped action *narrows* what a
          // rule says rather than widening it.
          {
            id: 'rule-x15',
            name: 'Builds half of nothing',
            when: { kind: 'keyDown' as const, key: 'Q' },
            conditions: [],
            do: [
              { kind: 'spawn' as const, prefabId: 'prefab-gone', x: 10, y: 20 },
              { kind: 'addVar' as const, variableId: 'var-2', by: 3 },
            ],
          },
          // And one where it is the *only* action, so the empty-`do` check
          // takes the whole rule — `rule-x7`'s shape, one action over.
          {
            id: 'rule-x16',
            name: 'Builds nothing at all',
            when: { kind: 'keyDown' as const, key: 'R' },
            conditions: [],
            do: [{ kind: 'spawn' as const, prefabId: 'prefab-gone', x: 30, y: 40 }],
          },
        ],
        children: [
          {
            id: 'a',
            name: breakout,
            type: 'rectangle',
            visible: true,
            // Turned, and turned to something that is neither a right angle
            // nor a half turn, because a dynamic body is the only kind whose
            // fit call has to divide the box by the object's own scale — and
            // this is the only place that division ever meets
            // `Phaser.Physics.Arcade.Body` under `tsc --strict`. The tile
            // sprite's static body covers the other branch, at 7 degrees.
            transform: { x: 480, y: 270, rotation: 33.5, scaleX: 1, scaleY: 1 },
            props: { width: 200, height: 120, fill: '#4f8cff', alpha: 1 },
            // A tween driving all six properties with a non-default value in
            // every dial, and here for the emitter config's reason rather than
            // for escaping: this is the only place the emitted config literal's
            // *shape* meets `Phaser.Types.Tweens.TweenBuilderConfig` under
            // `tsc --strict`, which is where a key Phaser renamed between
            // versions fails and nowhere else. The ease is an allowlisted name
            // rather than a hostile string on purpose — `tweenOf` refuses
            // anything else, so a hostile one could never reach the output and
            // asserting on it would be asserting on the parser instead.
            // Every target is the value the object already has, which is
            // `NO_MOTION`'s rule one field over: the point of this fixture is
            // the *shape* of the emit, and an export test that measures this
            // rectangle's colour would otherwise be racing a tween that starts
            // the instant the game boots — a fade to 0.2 and a slide across the
            // scene, both of which are correct behaviour and neither of which
            // that assertion is about. All six keys are still emitted and still
            // meet the config type, which is the whole job.
            tween: {
              to: { x: 480, y: 270, rotation: 33.5, scaleX: 1, scaleY: 1, alpha: 1 },
              duration: 1250,
              delay: 75,
              ease: 'Back.easeInOut' as const,
              yoyo: true,
              repeat: 2,
              repeatDelay: 40,
            },
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
              // Non-default in all three Matter dials as well, for the reason
              // the eight Arcade ones are: this node is the only place either
              // engine's setter chain meets its real Phaser types under
              // `tsc --strict`, and the fixture's Matter scene draws its own
              // body from these same three.
              restitution: 0.6,
              frictionAir: 0.02,
              friction: 0.25,
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
              // A bound label whose caption is the hostile string above and
              // whose variable is the hostile-*named* one, formatted. That puts
              // `str()` in front of two arguments of the `bindLabel` call — a
              // derived registry key and a caption — which are call sites no
              // other node in this fixture reaches, and it is the only place the
              // emitted helper's signature meets `Phaser.GameObjects.Text` and
              // `Phaser.Scene` under `tsc --strict`.
              label: { variableId: 'var-1', decimals: 2, pad: 6 },
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
              // Following a variable that holds **text**, with both dials at
              // their defaults: the branch where the emitted formatter returns
              // its argument untouched, and the one place a string reaches
              // `Text.setText` through the helper rather than through an action.
              label: { variableId: 'var-4', decimals: -1, pad: 0 },
              fontSize: 24,
              color: '#ffe066',
              // An imported family at the head of a stack whose tail is a font
              // the browser supplies. That is what makes this node the one that
              // exercises `fontStackOf` on both halves at once: `Chunky` has to
              // reach `collectFonts` and the scene's `preload`, and `serif` has
              // to reach neither while still being printed in the style.
              fontFamily: 'Chunky, serif',
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
            id: 'atlas-sprite',
            // The atlas's three output paths, one node each. This one is the
            // call argument: `add.sprite(...).play(...)`, so the clip's own
            // named frames reach `generateFrameNames` as well.
            name: 'atlas player',
            type: 'sprite',
            visible: true,
            transform: { x: 150, y: 500, rotation: 0, scaleX: 2, scaleY: 2 },
            props: {
              assetId: 'atlas-1',
              alpha: 1,
              tint: '#ffffff',
              flipX: false,
              flipY: false,
              frame: `${breakout} wide`,
              animationId: 'anim-2',
            },
            children: [],
          },
          {
            id: 'atlas-still',
            // The still half: `add.image(..., "<name>")` rather than a sprite,
            // which is where a frame *name* meets the argument a frame *index*
            // used to occupy — and the one place the emitted call would still
            // compile while asking for a frame that does not exist.
            name: 'atlas still',
            type: 'sprite',
            visible: true,
            transform: { x: 300, y: 500, rotation: 0, scaleX: 2, scaleY: 2 },
            props: {
              assetId: 'atlas-1',
              alpha: 1,
              tint: '#ffffff',
              flipX: false,
              flipY: false,
              frame: `${breakout} small`,
              animationId: null,
            },
            children: [],
          },
          {
            id: 'atlas-panel',
            // A nine-slice over an atlas frame: the ten-argument call, and the
            // one place `sliceInsetsOf` has to measure against *this frame*
            // rather than against the image — an 8x8 frame whose insets would
            // fit the 32x16 picture and not the frame it is actually cut from.
            name: 'atlas panel',
            type: 'nineslice',
            visible: true,
            transform: { x: 450, y: 500, rotation: 0, scaleX: 1, scaleY: 1 },
            props: {
              assetId: 'atlas-1',
              frame: `${breakout} small`,
              width: 80,
              height: 40,
              left: 3,
              right: 3,
              top: 3,
              bottom: 3,
              tint: '#ffffff',
              alpha: 1,
            },
            children: [],
          },
          {
            id: 'atlas-emitter',
            // The emitter config's `frame:` key, which is the third and last
            // place a frame reaches the output — and the only one where it sits
            // inside an object literal that `tsc --strict` checks against
            // `ParticleEmitterConfig`.
            name: 'atlas sparks',
            type: 'particles',
            visible: true,
            transform: { x: 600, y: 500, rotation: 0, scaleX: 1, scaleY: 1 },
            props: {
              assetId: 'atlas-1',
              frame: `${breakout} wide`,
              lifespan: 700,
              speedMin: 20,
              speedMax: 90,
              angleMin: 0,
              angleMax: 360,
              scaleStart: 1,
              scaleEnd: 0,
              alphaStart: 1,
              alphaEnd: 0,
              quantity: 2,
              frequency: 60,
              gravityX: 0,
              gravityY: 0,
              tint: '#ffffff',
              blendMode: 'NORMAL' as const,
              alpha: 1,
            },
            children: [],
          },
          {
            id: 'atlas-missing',
            // A frame the atlas does not have, which only a hand-edited file
            // can hold: the store writes a name out of the picker and the
            // parser keeps whatever is in the file. `resolveFrame` has to fall
            // back to the atlas's first frame rather than emitting a name
            // Phaser would warn on and draw nothing for.
            name: 'atlas gone',
            type: 'sprite',
            visible: true,
            transform: { x: 750, y: 500, rotation: 0, scaleX: 2, scaleY: 2 },
            props: {
              assetId: 'atlas-1',
              alpha: 1,
              tint: '#ffffff',
              flipX: false,
              flipY: false,
              frame: 'no such frame',
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
              layers: [
                {
                  id: 'l-base',
                  name: 'floor',
                  visible: true,
                  data: [0, -1, 2, 3, 0, -1],
                  // Solid tiles, which reach the emitted `setCollision`. One
                  // index repeated and one the tileset does not have, both of
                  // which only a hand-edited file can hold: `tileMapOf`
                  // normalises them away, so the export must show `[0, 2]` and
                  // nothing else.
                  collides: [2, 0, 2, 99],
                },
                {
                  id: 'l-walls',
                  // A hostile *layer* name, which is a ninth path into the
                  // output: it becomes a second `TILEMAPS` object-literal key,
                  // a second variable binding and a second `setName` argument,
                  // none of which existed before layers did. Its own solid list
                  // is different from the floor's, which is the whole claim —
                  // one tileset is a wall here and scenery below.
                  name: `${breakout} walls`,
                  visible: true,
                  data: [-1, 1, -1, -1, -1, 3],
                  collides: [1],
                },
                {
                  id: 'l-hidden',
                  // Hidden, and still emitted: `visible` is a modifier on the
                  // object rather than a reason not to build it, exactly as it
                  // is for every other node.
                  name: 'hidden detail',
                  visible: false,
                  data: [2, 2, 2, 2, 2, 2],
                },
              ],
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
            // Deliberately one layer, so `missingReason`'s branch is reached by
            // a map shaped exactly as every map was before iteration 25.
            props: {
              assetId: null,
              columns: 2,
              rows: 2,
              layers: [
                { id: 'm-base', name: 'Layer 1', visible: true, data: [-1, -1, -1, -1] },
              ],
              alpha: 1,
            },
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
            // A pixelate, and *only* a pixelate, in the scene the exported
            // page actually boots. It is here so that `attachEffects` is a
            // function the running game really calls rather than only one the
            // compiler reads — and it is alone because each live filter puts
            // the whole frame through a framebuffer, which the headless
            // container rasterises on the CPU. Four of them here timed
            // `export.spec.ts`'s hostile run out. The other three kinds sit in
            // `scene-2` below, which is registered and never started: the
            // emitted `.ts` carries every scene, so `tsc --strict` still meets
            // all four shapes.
            //
            // On *this* node because its fill is the one in the project nothing
            // measures, and because its name already collides with the
            // `arcadeBody` helper — so the binding emitted beside it,
            // `arcadeBodyFilters`, is a free test that the suffix rule holds
            // for this feature's binding too.
            fx: [{ kind: 'pixelate' as const, amount: 2 }],
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
            id: 'q2',
            // The `arcade body` trick a third time, for the rule helpers. Both
            // names are drawn from the module's identifier set before any
            // object binding is, so an object called "on tap" must come out as
            // `onTap2` and the helper must keep `onTap` — otherwise the line
            // beside it calls a rectangle.
            name: 'on tap',
            type: 'rectangle',
            visible: true,
            transform: { x: 900, y: 120, rotation: 0, scaleX: 1, scaleY: 1 },
            props: { width: 30, height: 30, fill: '#7ee787', alpha: 1 },
            children: [],
          },
          {
            id: 'q3',
            name: 'init variables',
            type: 'rectangle',
            visible: true,
            transform: { x: 900, y: 170, rotation: 0, scaleX: 1, scaleY: 1 },
            props: { width: 30, height: 30, fill: '#7ee787', alpha: 1 },
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
              // A label naming a variable the project has not got, which only a
              // hand-edited file can hold. It reads as *absent* — the caption
              // alone, no helper call, no import of the helper into a file with
              // nothing to call it — which is why this node still proves the
              // claim below about exporting exactly what it always did.
              label: { variableId: 'gone', decimals: 3, pad: 7 },
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
            // The three effect kinds the booted scene does not carry, with a
            // non-default value in every field of each. They carry no hostile
            // string — numbers are numbers and the colours go through
            // `hexLiteral` — so escaping is not what they are for: this is the
            // only place the emitted calls' *shape* meets `Phaser.Filters.Glow`,
            // `Blur` and `Shadow` under `tsc --strict`, which is where an
            // argument renamed between Phaser versions fails and nowhere else.
            //
            // Here rather than in `scene-1` because this scene is registered and
            // never started, so the compiler reads them and no frame ever pays
            // for them. Three filters in the booted scene is a tax on every test
            // in `export.spec.ts`, and it is one that bought nothing the
            // pixelate above does not already buy.
            fx: [
              {
                kind: 'glow' as const,
                color: '#997722',
                outerStrength: 2,
                innerStrength: 1,
                scale: 1,
              },
              { kind: 'blur' as const, quality: 1, x: 1, y: 1, strength: 2 },
              { kind: 'shadow' as const, x: 2, y: 3, decay: 0.2, power: 2, color: '#123456' },
            ],
            children: [],
          },
        ],
      },
      {
        id: 'scene-3',
        // The Matter scene, and the only one. Three scenes in one file is what
        // proves the engine is the *scene's*: a project with one world of each
        // kind emits an Arcade game-config key, a Matter `super(...)` settings
        // object and both helpers, and nothing about either leaks into the
        // other's class. A single-engine fixture could not state that.
        name: `Turning ${breakout} Scene`,
        width: 960,
        height: 540,
        backgroundColor: '#101820',
        // Gravity in px/s² exactly as the Arcade scene states it, because that
        // is the claim: one field, converted at the emit. A round thousand
        // would hide a factor-of-1000 slip, so it is deliberately not one.
        physics: { gravityX: 0, gravityY: 940, engine: 'matter' as const },
        // Rows that `collidersOf` must drop rather than emit: Matter collides
        // everything already, and `physics.add.collider` is Arcade's — a scene
        // that started Matter has no `this.physics` for it to be called on, so
        // emitting one throws inside `create()` before anything is drawn. Kept
        // in the document so switching the engine back brings them with it.
        colliders: [
          { id: 'mc-1', aId: 'm-floor', bId: 'm-faller', kind: 'collide' as const },
        ],
        children: [
          {
            id: 'm-floor',
            name: `${breakout} ramp`,
            type: 'rectangle',
            visible: true,
            // Turned, and turned to something that is neither a right angle nor
            // a half turn: this is the one node in the fixture whose body is a
            // real turned polygon rather than a box, which is the whole of what
            // this engine is here for.
            transform: { x: 480, y: 400, rotation: 24, scaleX: 3, scaleY: 1 },
            props: { width: 200, height: 24, fill: '#4f8cff', alpha: 1 },
            // Static, so `isStatic: true` reaches both toolchains — and scaled
            // 3x, which is the only thing that catches the helper sizing its
            // shape from `width` rather than `displayWidth`.
            physics: { kind: 'static' as const, ...NO_MOTION },
            children: [],
          },
          {
            id: 'm-faller',
            name: `${breakout} matter faller`,
            type: 'ellipse',
            visible: true,
            transform: { x: 480, y: 100, rotation: 0, scaleX: 1, scaleY: 1 },
            props: { width: 60, height: 60, fill: '#ffb84f', alpha: 1 },
            physics: {
              kind: 'dynamic' as const,
              ...NO_MOTION,
              // Non-default in every dial Matter reads, for the Arcade body's
              // reason: this is the only place the emitted config literal's
              // shape meets `Phaser.Types.Physics.Matter.MatterBodyConfig`
              // under `tsc --strict`, which is where a key renamed between
              // Phaser versions would fail and nowhere else.
              velocityX: 30,
              velocityY: -15,
              angularVelocity: 45,
              mass: 3,
              restitution: 0.4,
              friction: 0.3,
              frictionAir: 0.05,
              allowGravity: true,
              collideWorldBounds: true,
            },
            // Driven, and this one must emit *nothing*: the built-in behaviour
            // writes velocities onto an Arcade body and gates a jump on
            // `blocked.down`, neither of which Matter has. `drivenIn` drops it,
            // so no keyboard block, no `update()` and no `this.<field>` for
            // this scene — asserted rather than assumed.
            controls: {
              scheme: 'arrows' as const,
              mode: 'platformer' as const,
              speed: 200,
              jump: 400,
              touch: true,
            },
            children: [],
          },
        ],
      },
    ],
  };
}
