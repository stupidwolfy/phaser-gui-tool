/**
 * The project document.
 *
 * This is the single source of truth for the whole editor: React renders it,
 * Phaser draws it, and `JSON.stringify` of it is exactly what the user saves to
 * their device. Nothing about the editor's live state lives anywhere else.
 *
 * It is deliberately small right now. The shape — a tree of nodes, each with a
 * `type` discriminator, a shared `transform`, and a per-type `props` bag — is
 * what lets later iterations add sprites, tilemaps, particles and the rest
 * without a format break.
 */

/**
 * Bumped whenever a change to these types is not backwards compatible.
 *
 * v2 added `sprite` and the project-level `assets` table. v3 made `children`
 * load-bearing: a `container` node nests other nodes, and every node's position
 * is now relative to its parent rather than to the scene.
 *
 * Files written by an older version still read fine here — a v2 file simply has
 * no containers and an all-empty `children` — but the bump is about the other
 * direction. A v2 build has no `container` case anywhere: its
 * `createDisplayObject` leaves the object undefined and its renderer crashes,
 * and its scene tree would silently drop every nested node. The version check
 * turns both into the "made with a newer version" message.
 *
 * Scene `guides` deliberately did *not* bump it. The rule is "would a deployed
 * older build break on this file", and a v3 build does not: `parseProject`
 * passes `scenes` through verbatim, nothing in that build reads `scene.guides`,
 * so the file opens, draws identically, and even carries the guides back out on
 * a re-save. Guides change nothing about what is drawn for the objects — they
 * are the editor's own furniture that happens to be worth saving. Do not bump
 * this reflexively for the next field of that kind.
 *
 * v4 — sprite sheets and animations — is the other side of that same rule, and
 * it is worth spelling out because it looks superficially like guides did.
 * Neither `asset.sheet` nor `project.animations` crashes a v3 build. They do
 * something worse: `parseAssets` rebuilds every asset field by field and
 * `parseProject` names the project's fields one at a time, so a v3 build drops
 * both on open and writes the file back without them. The user's frame grids
 * and every animation they authored are gone, with nothing on screen having
 * said so — and the sheet a sprite was showing one frame of is suddenly drawn
 * whole. Guides survived an old build precisely because scenes are the one
 * thing passed through verbatim; these do not, so this bumps.
 *
 * v5 — prefabs — bumps for both halves of the rule at once, which is why it is
 * not a judgement call. `project.prefabs` is another field `parseProject` names
 * one at a time, so a v4 build drops the whole library on open and re-saves
 * without it; and an `instance` node is a type a v4 build has no
 * `createDisplayObject` case for, so it leaves the object undefined and
 * crashes, exactly as `container` did to v2. Either alone would bump this.
 *
 * v6 — tilemaps — bumps on that same crash half, and only on it. A `tilemap` is
 * a node type a v5 build has no `createDisplayObject` case for, so it leaves the
 * object undefined and its renderer crashes. Nothing else about the feature
 * needs it: a tileset is an ordinary sliced image, which v4 already reads, and
 * the node's own props ride in on `scenes`, the one part of a file
 * `parseProject` passes through verbatim — so there is no field an older build
 * would silently drop and re-save without. The crash alone is enough, and it is
 * not a judgement call.
 *
 * v7 — particles — is the same crash half again, and only that half. A v6 build
 * has no `'particles'` case in `createDisplayObject`, so it leaves the object
 * undefined and its renderer crashes, exactly as `tilemap` did to v5 and
 * `instance` to v4. Nothing else about the feature needs it: a particle texture
 * is an ordinary image, sliced or not, which v2 already reads, and the emitter's
 * own settings ride in on `scenes` — verbatim, again.
 *
 * Physics bodies did *not* bump it, and this is the guides case rather than any
 * of the four crash cases above. A body is not a node type: it is an optional
 * field on a node and an optional field on a scene, and both of those ride in
 * on `scenes`, which `parseProject` passes through verbatim. A v7 build has a
 * `createDisplayObject` case for every type in the file, reads `node.physics`
 * nowhere, draws the scene identically, and carries both fields back out on a
 * re-save. Nothing is dropped and nothing is undefined. **This stays contingent
 * on `parseProject` not reconstructing the scenes field by field**, exactly as
 * the guides decision is — if it ever starts to, an old build silently loses
 * every body on every save, which is data loss with no crash. `physics.spec.ts`
 * asserts the current version in the saved artefact so a future bump is a
 * deliberate act.
 *
 * v8 — audio — is the *other* half of the rule, and the first bump since v4 to
 * turn on it rather than on a crash. There is no new node type, so a v7 build
 * has a `createDisplayObject` case for everything in the file and draws it
 * identically; what it does instead is worse. `parseProject` names the
 * project's fields one at a time, so a v7 build opening a v8 file drops the
 * whole `audio` table and writes the file back without it — every imported
 * sound gone, with nothing having said so. That is the `animations` case
 * exactly. The scene's own `sounds` list would have survived on its own, riding
 * in on `scenes` as the guides and the bodies do, which is precisely why it is
 * not what bumps this: the table it points at is. `audio.spec.ts` asserts the
 * current version in the saved artefact so a future bump is a deliberate act —
 * as six other specs now do, which is what makes a bump loud on purpose.
 *
 * v9 — nine-slice panels and tile sprites — is back on the crash half, and only
 * that half. A v8 build has no `'nineslice'` and no `'tileSprite'` case in
 * `createDisplayObject`, so it leaves the object undefined and its renderer
 * crashes: `particles` to v7, `tilemap` to v6, `instance` to v5 and `container`
 * to v2 exactly. Nothing else about the feature needs it — both types point at
 * an ordinary image, sliced or not, and their own props ride in on `scenes`,
 * verbatim. Cameras did not bump it and these do, which is the whole difference
 * between a field on a scene and a new kind of object in one.
 *
 * **v10 is the font table, and it is the v8 case rather than any of the crash
 * cases.** There is no crash half at all: fonts add no `NodeType`, so a v9
 * build has a `createDisplayObject` case for everything in the file and draws
 * it without complaint. What it does is drop `project.fonts` on open — the
 * field-by-field reconstruction again — and re-save without it, leaving every
 * text node naming a family whose bytes have just been thrown away. That is
 * strictly worse than the audio case it copies: a sound that loses its table
 * makes no noise, where text that loses its font goes on drawing, in a face
 * the user never chose and with nothing at all having said so.
 *
 * **v11 is texture atlases, and it is the first bump to turn on both halves of
 * the rule at once for the same reason.** `parseAssets` rebuilds every asset
 * field by field, so a v10 build drops `asset.atlas` on open and re-saves
 * without it — the v4 and v10 case. What makes this one worse than either is
 * what the file still holds afterwards: a node's `frame` is now a *name* when
 * its image is cut by an atlas, and a v10 build that has just thrown the atlas
 * away hands that string to `setFrame` and to `add.nineslice`, which is a
 * missing-texture square rather than a crash and rather than anything that says
 * what happened. The grid case at least degraded to "the sheet is drawn whole";
 * this one degrades to nothing being drawn at all.
 *
 * **v12 is tilemap layers, and it is the silent-data-loss half of the rule with
 * no crash half at all — and the worst instance of it so far.** No new
 * `NodeType`, so a v11 build has a `createDisplayObject` case for everything in
 * the file. What it does instead is read `props.data` as `undefined`, have
 * `tileMapOf` pad it out to a grid of `EMPTY_TILE`, and draw an empty map. Then
 * it re-saves the file that way: `scenes` is passed through verbatim, so the
 * node it writes back is the node it read, and every layer of every level in the
 * project is gone with nothing having said so. The v10 font case and the v11
 * atlas case both left something visibly wrong on screen; this one leaves a map
 * that is merely empty, which is indistinguishable from one nobody has painted
 * yet. `tilemap.spec.ts` asserts the 12 in the saved artefact, as ten other
 * specs now do, which is what makes a bump loud on purpose.
 *
 * **v13 is the variable table, and it is the v8 audio case and the v10 font
 * case for a third time — the silent-data-loss half of the rule with no crash
 * half at all.** Rules add no `NodeType`, so a v12 build has a
 * `createDisplayObject` case for everything in the file and draws it exactly as
 * this one does. `scene.rules` alone would not have bumped anything: it rides
 * in on `scenes`, the one part of a file `parseProject` passes through
 * verbatim, so an old build carries every rule back out on a re-save untouched.
 * What bumps this is `project.variables`, which is a *project* table and
 * therefore one of the fields `parseProject` names one at a time — so a v12
 * build drops the whole table on open and re-saves without it. What it leaves
 * behind is the audio case made worse in the way the font case was: the rules
 * survive, still naming variables whose declarations have just been thrown
 * away, so every condition in the project reads nothing and `rulesOf` drops the
 * rules that were the point of the file. A sound that loses its table makes no
 * noise; a game that loses its variables still runs, and stops being the game.
 * `rules.spec.ts` asserts the 13 in the saved artefact, as sixteen other specs
 * now assert their own version, which is what makes a bump a deliberate act.
 *
 * **v14 is a variable that holds text, and it is the silent-data-loss half of
 * the rule with no crash half at all — the v13 case one turn of the screw
 * further.** No new `NodeType`, so a v13 build has a `createDisplayObject` case
 * for everything in the file and draws it exactly as this one does. The
 * `setText` action would not have bumped anything on its own: it rides in on
 * `scenes`, the one part of a file `parseProject` passes through verbatim, so an
 * old build drops it from the *emit* and carries it back out on a re-save
 * untouched. What bumps this is `parseVariables`, which rebuilds the project
 * table field by field and coerces every value with `Number(...)` — so a v13
 * build reads `value: 'ready'` as `NaN`, repairs that to `0`, and writes the
 * file back with a variable that still has its name and its id and holds the
 * wrong kind. Then `rulesOf` drops every rule whose condition or `setVar` named
 * it, because a number variable cannot be compared with text. v13 lost the
 * declarations and the rules went with them, which at least left the panel
 * empty; this one leaves the declarations on screen *looking right* while the
 * rules that were the point of the file quietly go. `rules.spec.ts` asserts the
 * 14 in the saved artefact, as seventeen other specs now assert their own.
 */
export const SCHEMA_VERSION = 14;

/** The Phaser release this editor targets and will export code for. */
export const TARGET_PHASER_VERSION = '4.2.1';

/** Object kinds the editor can currently place. Grows one entry at a time. */
export type NodeType =
  | 'rectangle'
  | 'ellipse'
  | 'text'
  | 'sprite'
  | 'nineslice'
  | 'tileSprite'
  | 'container'
  | 'instance'
  | 'tilemap'
  | 'particles';

/**
 * An imported image, held in the document as a data URL.
 *
 * Storing the bytes rather than a path is what keeps `JSON.stringify(project)`
 * a complete save: a project file that referenced `player.png` on disk would
 * break the moment it was moved or shared, and there is no server here to hold
 * the file instead. The cost is file size, which `importImageFile` bounds.
 *
 * `width`/`height` are the image's intrinsic pixel size, recorded at import so
 * that nothing downstream has to wait on a decode to lay a sprite out.
 */
export interface ImageAsset {
  id: string;
  /** The file name it was imported from, which is what the picker shows. */
  name: string;
  /** Always 'image/png' or 'image/jpeg' — import re-encodes to one of the two. */
  mimeType: string;
  dataUrl: string;
  width: number;
  height: number;
  /**
   * Absent on a plain image; present when the image is a grid of frames.
   *
   * The grid is a property of the *image*, not of any sprite drawing it: two
   * sprites showing different frames of one sheet are reading the same cuts,
   * and an animation is a list of indices that only means anything against
   * them. Recording it per sprite would let two of them disagree about how
   * many frames their own image has.
   *
   * Never present beside `atlas`: an image is cut one way. The refusal is in
   * the store, and `frameGridOf` strips this on read as the second half of it.
   */
  sheet?: FrameGrid;
  /**
   * Absent on a plain image; present when the image is a texture atlas.
   *
   * `sheet`'s argument exactly, and it is worth saying so because a reader will
   * wonder why this is not on the node the way a nine-slice's insets are. An
   * atlas decides how many frames an image *has* and what each one is called,
   * which is a property of the bytes and which two sprites drawing it must not
   * disagree about. An inset decides nothing about the image, which is why that
   * one lives on the use.
   *
   * Read through `atlasOf`, never directly.
   */
  atlas?: AtlasFrame[];
}

/**
 * An imported sound, held in the document as a data URL.
 *
 * The `ImageAsset` argument, unchanged: the bytes are in the document because
 * `JSON.stringify(project)` is the whole of the save, and a path to a file on
 * disk breaks the moment the project moves. The cost is file size, which
 * `importAudioFile` bounds far more tightly than it bounds an image — a minute
 * of ordinary music outweighs a scene's worth of sprites.
 *
 * Nothing here is recorded that a decode can answer. `ImageAsset` stores
 * `width`/`height` because a sprite's size is read on every sync and cannot
 * wait for one; a duration is shown in a single panel row, so it is derived
 * through `audio.ts`'s decode cache instead of being a second copy of a number
 * the file already contains.
 */
export interface AudioAsset {
  id: string;
  /**
   * The file name it was imported from — and, with its extension stripped, the
   * key exported code plays it by. That is why this one is editable where an
   * image's name is not: a texture key is only ever read by generated code,
   * while `this.sound.play('jump')` is the one line the user writes by hand.
   */
  name: string;
  /** One of `AUDIO_MIME_TYPES`; unlike an image's, it is not re-encoded. */
  mimeType: string;
  dataUrl: string;
  /**
   * Seconds, measured by the decode import performs anyway.
   *
   * Recorded for `ImageAsset.width`/`height`'s reason: decoding is
   * asynchronous and a panel row is not, so a duration derived on demand would
   * have every row read "—" for a moment on every open. It is intrinsic to the
   * bytes rather than a second opinion about them, which is what separates it
   * from the fields this schema keeps refusing.
   */
  duration: number;
}

/**
 * An imported font, held in the document as a data URL.
 *
 * The `ImageAsset` and `AudioAsset` argument for the third time — the bytes are
 * in the document because `JSON.stringify(project)` is the whole of the save.
 * What is worth knowing is the one field the other two have not got.
 *
 * **`family` is stored, where an audio key is derived.** `audioKeyOf` works a
 * sound's key out from its name at export time because nothing in the document
 * refers to it; a text node reaches a font by *holding this string* in its
 * `fontFamily`, so it has to be stable for the life of the project and unique
 * within it. Derived once by `fontFamilyFor` at import and never editable
 * afterwards, which is an image's treatment rather than a sound's, and for an
 * image's reason: renaming would break every node that named the old string.
 *
 * There is no metrics field, and that is the `AudioAsset.duration` test coming
 * out the other way. A duration is one number, intrinsic to the bytes, and
 * shown in a panel row that cannot wait for a decode. A font's metrics are
 * neither one number nor meaningful without a size, and nothing in this editor
 * reads them: the canvas measures the glyphs it actually drew, which is what
 * `publishMeasuredBounds` has always done for text.
 */
export interface FontAsset {
  id: string;
  /** The file name it was imported from. Shown in the picker; never a key. */
  name: string;
  /**
   * The CSS family this font is registered under, and the string a text node's
   * `fontFamily` names to use it.
   *
   * An identifier-safe token by construction — see `fontFamilyFor` — which is
   * what lets `fontStackOf` be a plain split and what makes the name safe in
   * every place it is printed.
   */
  family: string;
  /** One of `FONT_MIME_TYPES`; like a sound's, and unlike an image's, not re-encoded. */
  mimeType: string;
  dataUrl: string;
}

/**
 * The `format()` hint for a stored font, which both the editor's `FontFace` and
 * the exported `this.load.font(...)` have to be handed.
 *
 * Here rather than in `fonts.ts` so that the renderer and the exporter read one
 * answer, which is `textStyleOf`'s argument one table over. It is not optional
 * at either call site: a browser handed the wrong hint refuses the font
 * outright, and Phaser's own default is `'truetype'` — so a WOFF2 left to that
 * default is a font that silently fails to load and falls back.
 */
export function fontFormatOf(mimeType: string): string {
  switch (mimeType) {
    case 'font/otf':
      return 'opentype';
    case 'font/woff':
      return 'woff';
    case 'font/woff2':
      return 'woff2';
    default:
      return 'truetype';
  }
}

/**
 * A family name a font may be stored under: a letter, then letters and digits.
 *
 * The gate for a hand-edited file, and the reason nothing downstream has to
 * escape a family. `fontFamilyFor` produces only these, so a family that fails
 * this test came from outside the editor — and `parseFonts` drops the whole
 * entry rather than repairing it, because a repaired family would no longer be
 * the string the text nodes name.
 */
export const FONT_FAMILY = /^[A-Za-z][A-Za-z0-9]*$/;

/**
 * The families a `fontFamily` asks for, in order.
 *
 * The only reader of that field beyond `textStyleOf`, in the `guidesOf` /
 * `frameGridOf` / `sliceInsetsOf` / `soundsOf` / `cameraOf` / `tileMapOf`
 * family, and here because `fontFamily` has always been a CSS *stack* rather
 * than a name: `system-ui, sans-serif` is what a new text node ships with. The
 * renderer asks "which imported fonts does this node need" and the exporter
 * asks "which does this scene preload", and those must be one answer — a node
 * whose stack is `Chunky, sans-serif` has to count as using `Chunky` in both.
 *
 * A plain split is enough because a stored family can hold neither a comma nor
 * a space (`FONT_FAMILY`), so no CSS quoting can ever be involved.
 */
export function fontStackOf(fontFamily: string): string[] {
  return String(fontFamily ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * One sound a scene registers, and how it is tuned.
 *
 * On the scene rather than on a node, because a sound is not a display object:
 * it has no transform, no bounds and no name of its own to set, and the scene
 * tree's whole organizing principle is a transform hierarchy. It sits beside
 * `guides` and `physics`, which are scene-level document state for the same
 * kind of reason.
 *
 * What is *not* here is when it plays. Registering a sound is layout; deciding
 * that a coin makes a noise when something touches it is game logic — the
 * argument that keeps `scene.start` out of the document, and the one
 * `ParticlesProps` makes when it refuses an `emitting` field. The export emits
 * a named `const` per entry so that `coinSound.play()`, the one line the user
 * writes, has something to reach. `autoplay` is the single exception, and it is
 * one because scene start is not a trigger the user chooses.
 */
export interface SceneSound {
  id: string;
  audioId: string;
  loop: boolean;
  /** Phaser's own 0..1. */
  volume: number;
  /** Plays as the scene starts — a level's music, which has no other cue. */
  autoplay: boolean;
}

/**
 * How an image is cut into equally sized frames.
 *
 * Exactly the four numbers Phaser's own sprite-sheet parser takes, under the
 * same names, so that `load.spritesheet` in the exported code is handed this
 * object more or less verbatim. Anything the editor could derive instead —
 * a frame count, a column count — is deliberately not stored: two fields over
 * one number is how they come to disagree, and `frameCountOf` computes it with
 * the parser's own arithmetic.
 */
export interface FrameGrid {
  frameWidth: number;
  frameHeight: number;
  /** Blank border around the whole sheet, in pixels. */
  margin: number;
  /** Gap between neighbouring frames, in pixels. */
  spacing: number;
}

/**
 * One frame of a texture atlas: a named rectangle inside the image.
 *
 * The fields are Phaser's own, flattened. Its `JSONHash` parser reads a frame
 * as `{ frame: {x,y,w,h}, trimmed, sourceSize, spriteSourceSize, rotated }`,
 * and `atlasDataOf` puts them back into exactly that shape — so what the
 * document stores is one flat record per frame rather than the packer's
 * nesting. That is a third of the bytes in a file where every image is already
 * base64, and it is the form every reader here actually wants.
 *
 * Trim is carried rather than dropped, because TexturePacker trims by default
 * and a trimmed frame drawn without its offsets is drawn in the wrong place —
 * which reads as the editor being broken, not as an option nobody implemented.
 * Nothing here ever *produces* the flag; it is a pass-through to Phaser's own
 * parser, which has handled it since v3.
 *
 * **Rotation is refused instead**, at the import, and that asymmetry is the
 * decision worth knowing. Trim is off by one number that a fixture can see;
 * rotation turns the frame, interacts with `frameSizeOf`, with a nine-slice's
 * insets and with a tile sprite's pattern, and is *off by default* in every
 * packer — so it would be a field carried on trust, invisible on any symmetric
 * fixture and wrong on a real sprite sheet. `useAdvancedWrap`'s refusal with a
 * sharper edge: not merely unexplained, unverified.
 */
export interface AtlasFrame {
  /** The name the packer gave it — and the string a node stores to draw it. */
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** True when the packer cropped transparent pixels off this frame. */
  trimmed?: boolean;
  /** The size the frame had before it was trimmed. */
  sourceWidth?: number;
  sourceHeight?: number;
  /** Where the trimmed rectangle sits inside that original size. */
  offsetX?: number;
  offsetY?: number;
}

/**
 * The frame name every Phaser texture already carries, and therefore the one
 * name an atlas may not use.
 */
export const BASE_FRAME = '__BASE';

/**
 * The asset's atlas, but only when its frames can actually be cut out.
 *
 * The single reader of `asset.atlas`, in the `guidesOf` / `frameGridOf` /
 * `sliceInsetsOf` / `physicsOf` / `soundsOf` / `cameraOf` / `tileMapOf` /
 * `textStyleOf` / `fontStackOf` / `prefabChildrenOf` family, and it answers
 * three questions at once:
 *
 * - *Is this image cut by an atlas at all?* Null for a grid-cut or plain image,
 *   which is what makes `frameGridOf` and this one a pair rather than two
 *   independent flags.
 * - *Is every frame a rectangle inside the image?* A frame that runs off the
 *   edge samples pixels that are not there. A rotated frame is measured with
 *   its sides swapped, because the packer stores an upright `w`/`h` for a
 *   region it turned on its side.
 * - *Are the names usable?* Non-empty and **unique**, and the uniqueness is not
 *   tidiness: a name is a key in the object literal the exporter emits, and a
 *   repeated key in JavaScript silently keeps the last one — so two frames
 *   sharing a name is one frame drawing as another, in the export only.
 *
 * A dropped frame is dropped rather than repaired, which is the treatment
 * `tileMapOf` gives an out-of-range tile: a node naming it falls back on read,
 * and the atlas can be re-imported whole.
 *
 * A fresh array per call, so `useEditorStore((s) => atlasOf(...))` is an
 * infinite render loop — React error #185, the `tileMapOf` trap for the seventh
 * time. Select the project and derive outside the selector.
 */
export function atlasOf(asset: ImageAsset | undefined): AtlasFrame[] | null {
  const raw = asset?.atlas;
  if (!asset || !Array.isArray(raw) || raw.length === 0) return null;
  // The tie, decided here so it is decided once. Nothing this editor writes can
  // be in that state — `setAssetSheet` and `setAssetAtlas` delete each other's
  // field, and `parseAssets` keeps only one — so this fires on a hand-edited
  // file, and it hands that file to the older of the two cuts rather than to a
  // rule a reader would have to look up.
  if (asset.sheet) return null;

  const seen = new Set<string>();
  const usable: AtlasFrame[] = [];
  for (const frame of raw) {
    if (!frame || typeof frame.name !== 'string' || frame.name === '') continue;
    // Phaser's `Texture.add` answers null for a name the texture already holds,
    // and every texture holds `__BASE` from its constructor — so a frame called
    // that is dropped by Phaser with no warning, and every node naming it draws
    // the whole image instead. Refusing it here means "the atlas did not apply"
    // is never the thing a user has to diagnose. `CSS_GENERICS` one format over.
    if (frame.name === BASE_FRAME) continue;
    if (seen.has(frame.name)) continue;
    const fits =
      Number.isFinite(frame.x) &&
      Number.isFinite(frame.y) &&
      Number.isFinite(frame.width) &&
      Number.isFinite(frame.height) &&
      frame.width > 0 &&
      frame.height > 0 &&
      frame.x >= 0 &&
      frame.y >= 0 &&
      frame.x + frame.width <= asset.width &&
      frame.y + frame.height <= asset.height;
    if (!fits) continue;
    seen.add(frame.name);
    usable.push(frame);
  }
  return usable.length > 0 ? usable : null;
}


/**
 * The atlas as Phaser's own JSON Hash, which is what both the renderer and the
 * exporter hand to it.
 *
 * One builder for two consumers, which is `textStyleOf`'s argument and the
 * sharpest version of it here: `this.textures.addAtlas` in the editor and
 * `this.load.atlas` in the export are two places that must agree exactly about
 * how an image is cut, and a disagreement between them is invisible until the
 * game is in somebody else's hand.
 *
 * `frames` is an object rather than an array on purpose — that is the shape
 * `TextureManager.addAtlas` routes to `JSONHash` on, and it is the compact one,
 * since the name is the key rather than a `filename` field repeated inside
 * every record.
 */
export function atlasDataOf(frames: readonly AtlasFrame[]): AtlasData {
  const out: Record<string, AtlasDataFrame> = {};
  for (const frame of frames) {
    const entry: AtlasDataFrame = {
      frame: { x: frame.x, y: frame.y, w: frame.width, h: frame.height },
    };
    // Both keys or neither: Phaser reads `spriteSourceSize` only when `trimmed`
    // is set, and reads `sourceSize` to know what the frame's size *was*.
    if (frame.trimmed) {
      entry.trimmed = true;
      entry.sourceSize = {
        w: frame.sourceWidth ?? frame.width,
        h: frame.sourceHeight ?? frame.height,
      };
      entry.spriteSourceSize = {
        x: frame.offsetX ?? 0,
        y: frame.offsetY ?? 0,
        w: frame.width,
        h: frame.height,
      };
    }
    out[frame.name] = entry;
  }
  return { frames: out };
}

/** One frame in the shape Phaser's `JSONHash` parser reads. */
export interface AtlasDataFrame {
  frame: { x: number; y: number; w: number; h: number };
  trimmed?: boolean;
  sourceSize?: { w: number; h: number };
  spriteSourceSize?: { x: number; y: number; w: number; h: number };
}

/** A whole atlas in that shape. `frames` is an object, which is what picks it. */
export interface AtlasData {
  frames: Record<string, AtlasDataFrame>;
}

/**
 * The asset's frame grid, but only when it can actually cut a frame out.
 *
 * The single reader of `asset.sheet`, for the reason `guidesOf` is the single
 * reader of `scene.guides`: a grid whose frames are wider than the image, or
 * zero pixels across, would divide by zero in `frameCountOf` and make Phaser's
 * parser warn and produce a texture with no frames in it. Answering "is this a
 * sheet" and "is this grid usable" with one call means no caller can check the
 * first and forget the second.
 */
export function frameGridOf(asset: ImageAsset | undefined): FrameGrid | null {
  const sheet = asset?.sheet;
  // An image is cut one way, and the tie is broken in `atlasOf` rather than
  // here: a grid wins a file that somehow says both, because it is the older of
  // the two and therefore the one an older build could have written. Putting
  // the check on both sides would be circular, and putting it only here would
  // be dead — an atlas-cut asset has no `sheet`, so this already answers null
  // for one, which is what makes `tilesetKeyFor`, `tileMapOf`, the tile palette
  // and `buildPreloadBody` all treat an atlas as "not a tileset" with no edit.
  if (!sheet) return null;
  const usable =
    Number.isFinite(sheet.frameWidth) &&
    Number.isFinite(sheet.frameHeight) &&
    sheet.frameWidth > 0 &&
    sheet.frameHeight > 0 &&
    sheet.frameWidth <= asset.width &&
    sheet.frameHeight <= asset.height;
  return usable ? sheet : null;
}

/**
 * Columns and rows the grid cuts the image into.
 *
 * The arithmetic is copied from Phaser's `Textures.Parsers.SpriteSheet` —
 * margin subtracted once, spacing added back before the division — and it has
 * to stay copied. This is what the inspector's Frame field clamps against and
 * what "12 frames (4×3)" reports, so a formula of our own that rounded
 * differently would offer the user a frame the exported game does not have.
 *
 * A grid that yields nothing in one direction reports one, not zero: it is the
 * whole image, which is the plain-image answer and keeps every caller's
 * arithmetic free of a zero.
 */
export function frameLayoutOf(asset: ImageAsset): { columns: number; rows: number } {
  const sheet = frameGridOf(asset);
  if (!sheet) return { columns: 1, rows: 1 };
  const across = (span: number, frame: number) =>
    Math.max(1, Math.floor((span - sheet.margin + sheet.spacing) / (frame + sheet.spacing)));
  return {
    columns: across(asset.width, sheet.frameWidth),
    rows: across(asset.height, sheet.frameHeight),
  };
}

/**
 * How many frames the sheet cuts into — 1 for a plain image, which is exactly
 * what a single-frame texture is.
 */
export function frameCountOf(asset: ImageAsset | undefined): number {
  if (!asset) return 1;
  const atlas = atlasOf(asset);
  if (atlas) return atlas.length;
  const { columns, rows } = frameLayoutOf(asset);
  return columns * rows;
}

/**
 * The names an atlas cuts the image into, in the order the packer listed them,
 * and empty for an image cut any other way.
 *
 * The order is the packer's rather than sorted, because it is the order the
 * artist's own export produced and it is what makes "every frame, in order" the
 * sensible seed for a new clip.
 */
export function frameNamesOf(asset: ImageAsset | undefined): string[] {
  return atlasOf(asset)?.map((frame) => frame.name) ?? [];
}

/**
 * A frame that certainly exists on the asset — an index into a grid, or a name
 * out of an atlas.
 *
 * One function for the two cuts, because every caller wants the same thing and
 * none of them should be deciding what an unusable frame means. A sprite keeps
 * its frame when its image is swapped for a smaller sheet or a different atlas,
 * and a hand-edited file can name anything at all; Phaser's `setFrame` on a
 * frame that is not there warns and leaves the object on a missing texture.
 *
 * The two halves fall back differently, and each falls back the only way it
 * can: a grid index clamps into range, while a name has no near neighbour to
 * clamp to, so it drops to the atlas's first frame. Both are repairs made on
 * **read** — the document keeps what the user chose, so an atlas re-imported
 * with the name restored brings the node back with it. That is the treatment
 * `tileMapOf` gives an out-of-range tile, and for its reason.
 */
export function resolveFrame(
  asset: ImageAsset | undefined,
  frame: number | string,
): number | string {
  const atlas = atlasOf(asset);
  if (atlas) {
    return atlas.some((entry) => entry.name === frame) ? (frame as string) : atlas[0].name;
  }
  const index = typeof frame === 'number' ? frame : Number(frame);
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(0, Math.floor(index)), frameCountOf(asset) - 1);
}

/**
 * How big one frame of the asset is, in the image's own pixels.
 *
 * The question `sliceInsetsOf` has always asked and used to answer inline off
 * the grid. An atlas's frames are not all one size — that is the whole of what
 * an atlas is — so a panel cut from one has to measure its insets against *its*
 * frame rather than against the image or against some average of them.
 *
 * A trimmed frame reports its untrimmed size, because that is the box Phaser
 * draws it into and therefore the box the insets are cut against.
 */
export function frameSizeOf(
  asset: ImageAsset | undefined,
  frame: number | string,
): { width: number; height: number } | null {
  if (!asset) return null;
  const atlas = atlasOf(asset);
  if (atlas) {
    const entry = atlas.find((candidate) => candidate.name === frame) ?? atlas[0];
    return {
      width: entry.sourceWidth ?? entry.width,
      height: entry.sourceHeight ?? entry.height,
    };
  }
  const grid = frameGridOf(asset);
  if (grid) return { width: grid.frameWidth, height: grid.frameHeight };
  return { width: asset.width, height: asset.height };
}

/**
 * A node's transform is relative to its parent, exactly as Phaser treats a
 * Container's children — the scene itself is the parent of a top-level node, so
 * for those it still reads as scene coordinates.
 */
export interface Transform {
  x: number;
  y: number;
  rotation: number; // degrees, matching what the inspector shows
  scaleX: number;
  scaleY: number;
}

export interface RectangleProps {
  width: number;
  height: number;
  fill: string; // '#rrggbb'
  alpha: number; // 0..1
}

export interface EllipseProps {
  width: number;
  height: number;
  fill: string;
  alpha: number;
}

/**
 * A sprite has no width or height of its own: its size is the asset's intrinsic
 * size times the shared transform scale, exactly as Phaser treats an Image.
 * Carrying a separate display size would mean two fields fighting over one
 * number, since Phaser's `setDisplaySize` is itself just a scale.
 */
export interface SpriteProps {
  /** Null until an image is chosen; the canvas draws a placeholder until then. */
  assetId: string | null;
  alpha: number;
  /** '#ffffff' means untinted, and exports as no `setTint` call at all. */
  tint: string;
  flipX: boolean;
  flipY: boolean;
  /**
   * Which frame of the asset to draw: an index into its grid, or a name out of
   * its atlas. Always 0 for a plain image, which has exactly one frame — so
   * this needs no "is it cut" branch anywhere that reads it, only a
   * `resolveFrame`.
   *
   * A name rather than a position for an atlas, and that is the point of an
   * atlas rather than a detail of it: a packer re-run with one sprite added
   * renumbers every frame after it, so an index would silently redraw half the
   * scene while a name either still exists or visibly does not.
   */
  frame: number | string;
  /**
   * The clip this sprite plays, or null for a still frame.
   *
   * An id rather than the clip itself: several sprites play one animation, and
   * a copy per sprite would mean editing the frame rate in one place and not
   * in the other. It is also what keeps `frame` meaningful — the animation
   * owns the frame while it is playing, and this field is what the sprite
   * falls back to when it is not.
   */
  animationId: string | null;
}

/**
 * A panel drawn as a Phaser `NineSlice`: four insets divide the texture into
 * corners, edges and a middle, and only the middle and the edges stretch.
 *
 * The one type here whose size is its own rather than its texture's, and
 * deliberately so — that is the entire point of it. A `sprite` has no width or
 * height because scaling one is scaling the picture; a panel is scaled *without*
 * scaling its corners, so the box it fills and the picture it fills it with are
 * two different facts and need two different fields.
 *
 * The insets live here rather than on the `ImageAsset`, which is the one place
 * this contradicts `ImageAsset.sheet` and is worth saying why. A frame grid is a
 * property of the bytes: it decides how many frames an image has, and two
 * sprites drawing it must not disagree about that. An inset decides nothing
 * about the image — one 64px rounded-corner texture is a dialog frame with 16px
 * corners and a health bar with 4px ones, and nothing downstream indexes an
 * inset the way a tile index indexes a frame. So it belongs to the use, exactly
 * as a `SceneSound`'s volume does.
 *
 * Read them through `sliceInsetsOf`, never directly: raw they can exceed the
 * frame they are cut from, which Phaser draws inside out.
 */
export interface NineSliceProps {
  /** Null until an image is chosen; the canvas draws the placeholder until then. */
  assetId: string | null;
  /** Which frame of the asset to slice, resolved by `resolveFrame`. */
  frame: number | string;
  width: number;
  height: number;
  /**
   * The four insets, in source pixels. All four are one field each rather than
   * a `{ x, y }` pair, because a nine-slice's whole subject is that the four
   * sides differ — a window frame with a title bar has a `top` unlike its
   * `bottom`, which is the case a symmetric pair could not express.
   *
   * `top` and `bottom` of 0 is Phaser's own three-slice, which stretches
   * horizontally only — a progress bar, and free here rather than a mode flag
   * that would be a second answer to what these four numbers already say.
   */
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** '#ffffff' means untinted, the same convention a sprite's tint uses. */
  tint: string;
  alpha: number;
}

/**
 * A texture repeated across a box: a Phaser `TileSprite`.
 *
 * Its size is its own for `NineSliceProps`' reason — the box and the picture
 * that fills it are two facts, and here the whole point is that the second is
 * smaller than the first and repeats. `tileScale` is the picture's size within
 * that box, which is *not* the transform's scale: scaling the object stretches
 * the box and the pattern with it, while scaling the tile leaves the box where
 * it is and changes how many times the texture fits in it.
 *
 * There is no scroll *speed* here, only an offset. A background that drifts is
 * a `tilePositionX += delta` in the game's own `update()` — behaviour over
 * time, which is game logic and the `scene.start` argument. What the document
 * can say is where the pattern starts, and it says exactly that.
 */
export interface TileSpriteProps {
  /** Null until an image is chosen; the canvas draws the placeholder until then. */
  assetId: string | null;
  /** Which frame of the asset to repeat, resolved by `resolveFrame`. */
  frame: number | string;
  width: number;
  height: number;
  /** Where in the texture the top-left of the box starts, in source pixels. */
  tilePositionX: number;
  tilePositionY: number;
  /** How big one repeat is, as a multiple of the frame's own size. */
  tileScaleX: number;
  tileScaleY: number;
  /** '#ffffff' means untinted, the same convention a sprite's tint uses. */
  tint: string;
  alpha: number;
}

/**
 * The four insets, certainly usable against the texture and the box they will
 * be drawn on.
 *
 * The only reader of `NineSliceProps`' inset fields, in the `frameGridOf` /
 * `tileMapOf` / `guidesOf` / `physicsOf` / `soundsOf` / `cameraOf` family and
 * for their reason: it answers three questions at once, and any one of them
 * forgotten is a panel Phaser draws inside out.
 *
 * - *Is there a source to measure against?* With no asset the frame is the
 *   placeholder's own square, which is what the canvas actually draws.
 * - *How big is one frame of it?* A cut frame, not the whole image — the same
 *   distinction `resolveFrame` is built on, and for an atlas it is this node's
 *   own frame, since no two of them need be the same size.
 * - *Do these four numbers fit?* Phaser needs `left + right` to be no wider
 *   than both the frame it cuts them from and the box it draws them into, and
 *   the same vertically. Exceeding the frame samples pixels that are not there;
 *   exceeding the box overlaps the two corners, which draws the panel inside
 *   out. Scaling the opposing pair down together is what makes a panel narrowed
 *   below its own corners degrade rather than break.
 *
 * A fresh object per call, so `useEditorStore((s) => sliceInsetsOf(...))` is an
 * infinite render loop — React error #185, the `tileMapOf` trap for the fifth
 * time. Select the project and derive outside the selector.
 */
export function sliceInsetsOf(
  asset: ImageAsset | undefined,
  props: NineSliceProps,
  // Only ever reached with no asset, which is the editor drawing its
  // placeholder — an export with no image emits a comment rather than a panel,
  // so the exporter never has a frame size to be missing.
  fallbackFrameSize = 0,
): { left: number; right: number; top: number; bottom: number } {
  // `frameSizeOf` answers for both cuts, and for an atlas it has to be asked
  // about *this node's* frame: an atlas's frames are not all one size, which is
  // the whole of what an atlas is.
  const size = frameSizeOf(asset, props.frame);
  const frameWidth = size?.width ?? fallbackFrameSize;
  const frameHeight = size?.height ?? fallbackFrameSize;

  // Both limits at once: the picture the insets are cut from, and the box they
  // are drawn into. Whichever is smaller is the one that binds.
  const fit = (near: number, far: number, limit: number) => {
    const a = Math.max(0, Math.floor(Number.isFinite(near) ? near : 0));
    const b = Math.max(0, Math.floor(Number.isFinite(far) ? far : 0));
    // `Math.max(0, NaN)` is NaN, so a width a hand-edited file made unusable
    // has to be caught here rather than propagating into all four insets.
    const room = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
    if (a + b <= room) return [a, b] as const;
    // Proportionally, so a frame with a wide left border and a narrow right one
    // still reads as that frame when it is squeezed.
    const total = a + b;
    if (total === 0) return [0, 0] as const;
    const scaled = Math.floor((a / total) * room);
    return [scaled, room - scaled] as const;
  };

  const [left, right] = fit(props.left, props.right, Math.min(frameWidth, props.width));
  const [top, bottom] = fit(props.top, props.bottom, Math.min(frameHeight, props.height));
  return { left, right, top, bottom };
}

/**
 * A container groups other nodes: moving, rotating or scaling it moves its whole
 * subtree, and `children` is its content.
 *
 * It has no size of its own — a Phaser Container is a transform with a display
 * list, and its bounds are whatever its children occupy. Alpha is the one thing
 * worth setting on the group as a whole, and it multiplies down the tree the
 * way Phaser's does.
 */
export interface ContainerProps {
  alpha: number;
}

/** The alignments Phaser's `align` takes that mean something for a paragraph. */
export type TextAlign = 'left' | 'center' | 'right';

/**
 * A text object's content and its typography.
 *
 * The five fields above `bold` are the ones this type shipped with in iteration
 * 1; everything below is iteration 22. Three shape decisions are worth stating,
 * because each looks arbitrary and none is.
 *
 * - **`bold` and `italic` are two booleans, not one `fontStyle` string.**
 *   Phaser's key is a string, but its value is nothing more than those two
 *   independent facts joined by a space. A free string field would accept
 *   `oblique 350`, `x-small` and every other CSS token, which the editor cannot
 *   draw predictably and the exporter would pass straight through into a game.
 *   Two questions get two answers — `NodeControls.touch`'s argument, which was
 *   the same refusal of a third `scheme` value.
 * - **`wordWrapWidth: 0` means "do not wrap"**, a first-class sentinel rather
 *   than `number | null`, because a wrap width of zero has no other meaning —
 *   `EMPTY_TILE`'s call. It also keeps the control a single `NumberField`.
 * - **There is no `padding` field, and that is not an omission.** The padding a
 *   stroke and a shadow need in order not to be clipped by Phaser's text canvas
 *   is a *function* of the stroke and the shadow, not a decision anyone makes,
 *   so `textStyleOf` derives it. A stored one would be two fields free to
 *   disagree about one number: the argument that gives a sprite no width of its
 *   own and a tilemap no tile size of its own.
 */
export interface TextProps {
  text: string;
  fontSize: number;
  color: string;
  fontFamily: string;
  alpha: number;
  bold: boolean;
  italic: boolean;
  /** Only bites on text with more than one line — a wrap, or a newline in the content. */
  align: TextAlign;
  /** The width to wrap at, in the object's own unscaled pixels. 0 is off. */
  wordWrapWidth: number;
  /** Added to the font's own line height, so 0 is single-spaced rather than none. */
  lineSpacing: number;
  /** Added between characters. Phaser 4's own field; negative tightens. */
  letterSpacing: number;
  /** Drawn only while `strokeThickness` is above zero, which is Phaser's rule too. */
  strokeColor: string;
  strokeThickness: number;
  shadowColor: string;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlur: number;
}

/**
 * The subset of `Phaser.Types.GameObjects.Text.TextStyle` this editor writes.
 *
 * Structural rather than an import of Phaser's own type, because
 * `src/core` is the document layer and knows nothing about the renderer — the
 * exporter prints this and the scene hands it to a real `Text`, and
 * `export-toolchain.spec.ts` compiling the emitted `.ts` under `tsc --strict`
 * is what proves the two still line up.
 */
export interface TextStyle {
  fontFamily: string;
  fontSize: string;
  color: string;
  fontStyle: string;
  align: TextAlign;
  wordWrap: { width: number | null };
  lineSpacing: number;
  letterSpacing: number;
  stroke: string;
  strokeThickness: number;
  shadow: {
    offsetX: number;
    offsetY: number;
    color: string;
    blur: number;
    stroke: boolean;
    fill: boolean;
  };
  padding: { x: number; y: number };
}

/** '#rrggbb', or the fallback when a hand-edited file holds something else. */
function textColor(value: unknown, fallback: string): string {
  const clean = String(value ?? '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(clean) ? clean.toLowerCase() : fallback;
}

/**
 * A finite number at or above `min`, for a field a hand-edited file can hold
 * anything in.
 *
 * `typeof` rather than `Number(value)`, which answers 0 for null, for `''` and
 * for an empty array — so a missing font size would coerce to 0, clamp to the
 * minimum and draw a 1px paragraph rather than falling back to a readable one.
 */
function textNumber(value: unknown, fallback: number, min = -Infinity): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, value)
    : fallback;
}

/**
 * Everything one text node draws with, in the form Phaser takes it.
 *
 * The only reader of `TextProps`' typography fields, in the `frameGridOf` /
 * `sliceInsetsOf` / `tileMapOf` / `guidesOf` / `physicsOf` / `soundsOf` /
 * `cameraOf` family, and here for the sharpest version of their reason: the
 * renderer and the exporter *both* read it. Before this existed each built its
 * own style object out of the same three keys, written twice, which is how the
 * canvas and the generated game come to disagree about how the text looks —
 * the one kind of failure a user cannot see until the game is in their hand.
 *
 * It answers three questions at once:
 *
 * - *What does Phaser take?* `fontSize` is a CSS string, `fontStyle` is the two
 *   booleans joined, `wordWrap.width` is null rather than 0 when off.
 * - *Are these numbers ones Phaser can be handed?* A hand-edited file can hold
 *   a negative stroke, a NaN blur or an `align` of `"justify "`. Repaired here,
 *   never at a call site.
 * - *How much padding do the stroke and the shadow need?* Phaser sizes a text
 *   object's canvas from the glyphs alone, so a stroke and a shadow are drawn
 *   outside it and clipped. Derived rather than stored — see `TextProps`.
 *
 * **The whole object, every key, defaults included**, and that is load-bearing
 * rather than tidiness: `TextStyle.setStyle` reads each key with
 * `GetValue(style, key, this[key])` and its `setDefaults` argument is false, so
 * an *omitted* key keeps whatever it already had. A style built from only the
 * non-default keys could switch a stroke on and never switch one off. Deciding
 * what to *print* is a separate question, and it is the exporter's.
 *
 * A fresh object per call, so `useEditorStore((s) => textStyleOf(...))` is an
 * infinite render loop — React error #185, the `tileMapOf` trap for the sixth
 * time. Select the node and derive outside the selector.
 */
export function textStyleOf(props: TextProps): TextStyle {
  const strokeThickness = textNumber(props.strokeThickness, 0, 0);
  const shadowOffsetX = textNumber(props.shadowOffsetX, 0);
  const shadowOffsetY = textNumber(props.shadowOffsetY, 0);
  const shadowBlur = textNumber(props.shadowBlur, 0, 0);
  const wrap = textNumber(props.wordWrapWidth, 0, 0);

  // Phaser draws the stroke centred on the glyph edge, so half of it falls
  // outside; the shadow falls outside by its offset and spreads by its blur.
  // Whichever reaches further is what the canvas has to grow by.
  const pad = (offset: number) =>
    Math.ceil(Math.max(strokeThickness / 2, Math.abs(offset) + shadowBlur));

  return {
    // A blank family joins into a font string of ` 32px `, which Canvas cannot
    // parse and which leaves the text drawn in whatever the last object set.
    fontFamily: String(props.fontFamily ?? '').trim() || 'sans-serif',
    fontSize: `${textNumber(props.fontSize, 32, 1)}px`,
    color: textColor(props.color, '#ffffff'),
    fontStyle: [props.bold ? 'bold' : '', props.italic ? 'italic' : ''].filter(Boolean).join(' '),
    align: props.align === 'center' || props.align === 'right' ? props.align : 'left',
    // Null rather than 0: Phaser's own "not wrapping" value, and `0` would be a
    // wrap width every word is wider than.
    wordWrap: { width: wrap > 0 ? wrap : null },
    lineSpacing: textNumber(props.lineSpacing, 0),
    letterSpacing: textNumber(props.letterSpacing, 0),
    stroke: textColor(props.strokeColor, '#000000'),
    strokeThickness,
    shadow: {
      offsetX: shadowOffsetX,
      offsetY: shadowOffsetY,
      color: textColor(props.shadowColor, '#000000'),
      blur: shadowBlur,
      // Both explicitly true, and this is the trap that makes a shadow set
      // through a style object invisible. `Text.setShadow()` defaults `fill` to
      // true, but `TextStyle`'s property map defaults *both* `shadow.fill` and
      // `shadow.stroke` to false — so a shadow given an offset, a colour and a
      // blur and nothing else is computed, is stored, and is never painted.
      stroke: true,
      fill: true,
    },
    padding: { x: pad(shadowOffsetX), y: pad(shadowOffsetY) },
  };
}

/**
 * A placed copy of a prefab.
 *
 * It holds a reference and nothing else: the contents are read from
 * `project.prefabs` every time the node is drawn or exported, so a definition
 * edited once is edited everywhere, in every scene, with no propagation pass to
 * write and nothing that can drift out of step. That is the whole design — an
 * instance that stored its own copy of the children would be a duplicate with
 * extra bookkeeping.
 *
 * What it does own is what makes one placement different from another: its
 * transform, name and visibility, which live on the node like every other
 * node's, plus the alpha below, which multiplies down the subtree the way a
 * container's does.
 */
export interface InstanceProps {
  /** Null when the definition it named is gone; the canvas draws an empty box. */
  prefabId: string | null;
  alpha: number;
}

/**
 * A grid of tiles cut from one sliced image.
 *
 * There is no tileset type here and there is deliberately not going to be one: a
 * tileset *is* an `ImageAsset` with a `sheet`, and a tile index *is* a frame
 * index. `FrameGrid` already holds exactly the four numbers Phaser's
 * `addTilesetImage` takes, under the same names, for the same reason
 * `load.spritesheet` is handed them near-verbatim — so the slicer, the texture
 * key, the re-cut diff and the preload line are all the ones sprite sheets
 * already brought, and two tilemaps drawing one image cannot disagree about how
 * big a tile is.
 *
 * Which is also why there is no tile size stored here. It is the asset's frame
 * size, read back through `tileMapOf`, exactly as a sprite has no width or
 * height of its own. A copy of it on the node would be a second field over one
 * number, which is how the two come to disagree.
 */
export interface TilemapLayerDoc {
  id: string;
  name: string;
  /** Hidden layers draw nothing, here and in the export. */
  visible: boolean;
  /**
   * The tiles, row-major, `columns * rows` of them. `-1` is an empty cell,
   * which is Phaser's own value for one rather than a convention of ours.
   *
   * Flat rather than nested: it is a third of the JSON of an array of arrays,
   * and one array is one thing for `cloneWithNewIds` to copy rather than one
   * per row.
   */
  data: number[];
  /**
   * The frame indices that are solid on *this* layer, ascending, no repeats.
   *
   * On the layer rather than on the node, and the sentence that moved it here
   * is the one iteration 20 wrote to explain why it was not on the asset: "one
   * tileset is a wall in the level and scenery in the layer behind it". That
   * described a feature that did not exist yet. It does now, and it is the
   * whole of why this is per layer.
   *
   * Optional for the reason `guides` is. Read it through `tileMapOf`, never
   * directly.
   */
  collides?: number[];
}

export interface TilemapProps {
  /** The sliced image the tiles come from. Null draws the placeholder grid. */
  assetId: string | null;
  columns: number;
  rows: number;
  /**
   * The passes over the grid, back to front — the way `scene.children` is, and
   * for its reason: the array order *is* the draw order and there is no depth
   * field to disagree with it.
   *
   * The tileset and the grid stay up here, shared by every layer. The tile size
   * is derived from the tileset, so a per-layer tileset would let two layers of
   * one map disagree about how big a cell is — the second field over one number
   * that `ImageAsset.sheet` and a sprite's missing width both exist to refuse.
   */
  layers: TilemapLayerDoc[];
  alpha: number;
  /**
   * The pre-v12 single layer. Written by no build from v12 on, and read only by
   * `tileMapOf`'s migration, which turns it into `layers[0]`. Both funnels in
   * the store delete the pair when they write, so the document holds one shape
   * and only one — `setAssetSheet` and `setAssetAtlas` deleting each other's
   * field, one type over.
   *
   * @deprecated
   */
  data?: number[];
  /** @deprecated the pre-v12 single layer's solid list. */
  collides?: number[];
}

/**
 * A particle emitter: a source that throws copies of one texture around.
 *
 * The first node whose whole point is what it does *over time*, which is why it
 * is stopped in the editor unless the preview toggle is on — the argument that
 * already keeps a sprite's animation still while you place it.
 *
 * Every field is one number and one Phaser config key, flattened out of the
 * `{min, max}` and `{start, end}` pairs Phaser takes, and the set is chosen as
 * the smallest one that makes fire, sparks and falling snow three visibly
 * different objects from the inspector alone. Nothing here is array-valued,
 * which is why `cloneWithNewIds` needs no case for it and `tilemap.props.data`
 * stays the one array in the schema.
 *
 * There is deliberately no `emitting` field. Whether an emitter runs is the
 * preview toggle's answer in the editor and Phaser's default in an export; a
 * document field would be a second answer to the same question, and an emitter
 * that starts switched off and is triggered later is a line of game logic —
 * the argument that keeps `scene.start` out of the document.
 */
export interface ParticlesProps {
  /** Null until an image is chosen; the canvas draws the emitter marker until then. */
  assetId: string | null;
  /**
   * Which frame of the asset each particle draws, resolved by `resolveFrame`
   * exactly as a sprite's is. One frame rather than a list: a `frames` array
   * would be the third array-valued prop in the schema and the third
   * `cloneWithNewIds` special case, for a look a single frame mostly covers.
   */
  frame: number | string;
  /** How long one particle lives, in milliseconds. */
  lifespan: number;
  /** Phaser's `speed: { min, max }`, in pixels per second. */
  speedMin: number;
  speedMax: number;
  /**
   * Phaser's `angle: { min, max }`, the emission direction in degrees. The one
   * field that turns a puff into a jet or into snow with nothing else touched.
   */
  angleMin: number;
  angleMax: number;
  /** Phaser's `scale: { start, end }` — smoke grows, sparks shrink. */
  scaleStart: number;
  scaleEnd: number;
  /**
   * Phaser's `alpha: { start, end }`. Without a fade particles pop out of
   * existence at the end of their life, which reads as a rendering fault
   * rather than as a decision.
   */
  alphaStart: number;
  alphaEnd: number;
  /** Particles per emission, and milliseconds between emissions. */
  quantity: number;
  frequency: number;
  /**
   * The one thing an emission angle cannot express: an arc. An ember that
   * rises and then falls is gravity, not a direction.
   */
  gravityX: number;
  gravityY: number;
  /** '#ffffff' means untinted, the same convention a sprite's tint uses. */
  tint: string;
  /**
   * 'ADD' is what makes fire look like fire rather than a heap of opaque
   * discs. Two options, so a select rather than a number.
   */
  blendMode: 'NORMAL' | 'ADD';
  /** The emitter object's own alpha, as every node type has. */
  alpha: number;
}

export interface NodePropsByType {
  rectangle: RectangleProps;
  ellipse: EllipseProps;
  text: TextProps;
  sprite: SpriteProps;
  nineslice: NineSliceProps;
  tileSprite: TileSpriteProps;
  container: ContainerProps;
  instance: InstanceProps;
  tilemap: TilemapProps;
  particles: ParticlesProps;
}

/**
 * One object in a scene. Modelled as a discriminated union so that
 * `node.type === 'text'` narrows `node.props` to `TextProps` — adding a node
 * kind then makes every unhandled `switch` a compile error, which is the point.
 */
export type GameObjectNode = {
  [K in NodeType]: {
    id: string;
    name: string;
    type: K;
    visible: boolean;
    transform: Transform;
    props: NodePropsByType[K];
    /**
     * An Arcade Physics body, or absent for the great majority of nodes that
     * have none.
     *
     * Here rather than in `props` because it is the one setting that is not
     * per-type: every entry of `NodePropsByType` would otherwise carry the same
     * dozen fields, and `createNode` would have to answer "what is this
     * rectangle's bounce" for an object nobody has asked to simulate. Optional
     * for the reason `guides` is: every file written before this existed has no
     * such field, and `parseProject` passes scenes through without
     * reconstructing them. Read it through `physicsOf`, never directly.
     */
    physics?: PhysicsBody;
    /**
     * What the player drives this object with, or absent for everything the
     * player does not drive.
     *
     * Beside `physics` rather than in `props` for `physics`' reason: it is not
     * a per-type setting, and only a node that already carries a dynamic body
     * can have one at all. Optional for the reason `guides` is, and read
     * through `controlsOf`, never directly.
     */
    controls?: NodeControls;
    /**
     * A tween driving this object's own numbers, or absent for everything that
     * does not move by itself.
     *
     * Beside `physics` and `controls` rather than in `props` for their reason:
     * it is not a per-type setting, and every entry of `NodePropsByType` would
     * otherwise carry the same seven fields. Optional for the reason `guides`
     * is, and read through `tweenOf`, never directly.
     *
     * Unlike those two neighbours there is **no top-level rule** here, and the
     * contrast is the point rather than an omission. A body and a drive-scheme
     * are banned inside a container because both read their owner's `x`/`y` as
     * *world* coordinates every step; a tween writes the object's own
     * properties, which are parent-relative for a container child exactly as
     * the document's are. So `tweenOf` takes no `topLevel` argument, nothing is
     * stripped on read, and `setNodeTween` reaches a node at any depth.
     */
    tween?: NodeTween;
    /**
     * Nested nodes, positioned relative to this one. Only a `container`
     * renders them, but the array is present on every node so that traversal,
     * cloning and the parser never have to branch on the type.
     */
    children: GameObjectNode[];
  };
}[NodeType];

/**
 * The node types that can carry an Arcade body, and the only reader of that
 * list is `physicsOf`.
 *
 * An Arcade body reads its owner's `x`/`y`, `width` and `height` every step, so
 * the object has to have all four and they have to mean what the world thinks
 * they mean. A `rectangle`, an `ellipse`, a `text`, a `sprite`, a `nineslice`
 * and a `tileSprite` all do — the last two carry ComputedSize and Origin like
 * the rest, and a panel or a repeating wall is exactly the kind of thing a
 * platformer stands on. The three that are missing are each missing for their
 * own reason, and none of them is an oversight:
 *
 * - a `container` and an `instance` are Phaser Containers, which Arcade does
 *   not simulate — a body on one would be a box around children that go on
 *   moving independently of it;
 * - a `particles` node has no ComputedSize at all (see EditorScene's wrapper),
 *   so it has no width or height for a body to take;
 * - a `tilemap`'s collision is `setCollision([...])` — a different API about
 *   which *tiles* are solid, and giving the whole layer one rectangular box
 *   would be a half-answer that looks like the real one. That is
 *   `TilemapProps.collides`, and it is why a tilemap is a thing a collider row
 *   may name without ever being in this set.
 */
const PHYSICS_TYPES: ReadonlySet<NodeType> = new Set<NodeType>([
  'rectangle',
  'ellipse',
  'text',
  'sprite',
  'nineslice',
  'tileSprite',
]);

/**
 * An Arcade Physics body attached to one object.
 *
 * The fields are Phaser's own, under Phaser's names, so the exported code is
 * this object with the setters wrapped round it — the rule `AnimationClip` and
 * `ParticlesProps` already follow.
 *
 * What is here is the body's own standing state: how big it is, where it
 * starts, and how it responds. *Which* pairs collide is not per-body and lives
 * on the scene, in `SceneCollider` — it was refused outright until iteration
 * 20, on the argument that keeps `scene.start` out of the document, and what
 * changed is not that argument but where its line falls: which pairs interact
 * is a standing fact about the world, where what happens when they touch is a
 * sequence of events and is still nowhere in this schema. There are still no
 * overlap callbacks and no `stopAfter`.
 */
export interface PhysicsBody {
  /**
   * A static body never moves and has no velocity, bounce, drag, mass or
   * gravity — Phaser's `StaticBody` does not carry those properties at all,
   * which is why they are not merely ignored for one but absent from the
   * emitted code. The inspector hides them for the same reason.
   */
  kind: 'dynamic' | 'static';
  velocityX: number;
  velocityY: number;
  bounceX: number;
  bounceY: number;
  /** Deceleration in pixels/sec^2, applied while acceleration is zero. */
  dragX: number;
  dragY: number;
  /** Degrees per second. */
  angularVelocity: number;
  mass: number;
  /**
   * `mass` and `immovable` only ever matter inside a collision, and for four
   * iterations this editor emitted no `collider` or `overlap` anywhere — they
   * were here for a line the user was told to write by hand, on the argument
   * that deciding what collides with what is game logic. `SceneCollider` is
   * that line now, so these two are read by something this file generates
   * rather than by something a reader was asked to add.
   */
  immovable: boolean;
  /** False exempts this body from the scene's world gravity. */
  allowGravity: boolean;
  collideWorldBounds: boolean;
  /**
   * Matter's bounciness, 0 to 1. Arcade's `bounceX`/`bounceY` are two numbers
   * because an Arcade body bounces per axis; a Matter body has one restitution
   * for the whole polygon, which is what having a real shape costs and buys.
   *
   * The three fields below are Matter's and are read only by a Matter scene,
   * exactly as the eight above are Arcade's and are read only by an Arcade one.
   * Both sets live on the node together and neither is ever deleted, so
   * switching a scene's engine and switching it back loses nothing — the
   * treatment `physicsOf` already gives a body on a node dragged into a group
   * and out again, and the reason the inspector *hides* the set that is not in
   * force rather than the store dropping it.
   */
  restitution: number;
  /** Matter's per-step drag through the air, 0 to 1. Phaser's default is 0.01. */
  frictionAir: number;
  /** Matter's surface friction against what it slides on, 0 to 1. */
  friction: number;
}

/**
 * The node's body, defaulted and validated in one place.
 *
 * The `guidesOf` / `frameGridOf` / `prefabChildrenOf` / `tileMapOf` family, and
 * for the sharpest version of their reason: it answers three questions at once
 * — may this node type carry a body, is this node somewhere a body would mean
 * anything, and is the stored object well formed — and any one of them
 * forgotten is a body drawn in the wrong place or exported onto an object
 * Arcade cannot simulate.
 *
 * `topLevel` is the second question, and it is a parameter rather than
 * something this function could work out because a node does not know its
 * parent. A body positioned by `x`/`y` that are *parent-relative* is a body in
 * the wrong place, so only a direct child of the scene may have one. A body
 * found deeper reads as absent rather than being deleted — the answer
 * `tileMapOf` gives an out-of-range tile, and for the same reason: a node
 * dragged into a group and back out again is the same node, and throwing its
 * settings away on the way in would be a deletion nothing on screen asked for.
 */
export function physicsOf(
  node: GameObjectNode,
  topLevel: boolean,
): PhysicsBody | null {
  // A fresh object every call, exactly as `tileMapOf` builds one — so
  // `useEditorStore((s) => physicsOf(...))` is an infinite render loop, since
  // zustand compares snapshots by identity. Select the node and derive outside
  // the selector.
  if (!topLevel || !PHYSICS_TYPES.has(node.type)) return null;
  const raw = node.physics;
  if (typeof raw !== 'object' || raw === null) return null;
  const numberOr = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const ratio = (value: unknown, fallback: number) =>
    Math.min(1, Math.max(0, numberOr(value, fallback)));
  return {
    kind: raw.kind === 'static' ? 'static' : 'dynamic',
    velocityX: numberOr(raw.velocityX, 0),
    velocityY: numberOr(raw.velocityY, 0),
    bounceX: numberOr(raw.bounceX, 0),
    bounceY: numberOr(raw.bounceY, 0),
    dragX: numberOr(raw.dragX, 0),
    dragY: numberOr(raw.dragY, 0),
    angularVelocity: numberOr(raw.angularVelocity, 0),
    // Phaser's own default, and zero would be a body every collision sends to
    // infinity rather than a light one.
    mass: Math.max(0.0001, numberOr(raw.mass, 1)),
    immovable: raw.immovable === true,
    allowGravity: raw.allowGravity !== false,
    collideWorldBounds: raw.collideWorldBounds === true,
    // Matter's own defaults, under Matter's own names, so a body that predates
    // the engine choice reads exactly as an untouched Matter body would — the
    // rule that keeps every one of the eight Arcade fields at Phaser's default
    // too. Clamped rather than dropped: all three are ratios Matter multiplies
    // by, and a negative or a runaway one is a simulation that flies apart with
    // nothing on screen saying why.
    restitution: ratio(raw.restitution, 0),
    frictionAir: ratio(raw.frictionAir, 0.01),
    friction: ratio(raw.friction, 0.1),
  };
}

/** Whether the inspector may offer a body for this node type at all. */
export function canHavePhysics(type: NodeType): boolean {
  return PHYSICS_TYPES.has(type);
}

/**
 * How big a body is on an object turned `rotation` degrees.
 *
 * An Arcade body is a rectangle whose sides are the world's, and nothing in
 * Phaser turns one: `Body.updateBounds` reads the object's scale and never its
 * angle. So a body cannot be the shape of a rotated object — the closest thing
 * that exists is the box that *contains* it, which is what this returns, and
 * which is what both the canvas and the export now use.
 *
 * That is a change of answer rather than a change of rule. Until iteration 26
 * the body kept the object's unrotated width and height, so a 300x20 platform
 * stood on end collided as a 300x20 floor — a shape with almost no overlap with
 * the thing on screen, and the one failure a user cannot see until the game is
 * in their hand. The editor drew that box faithfully, which made a correct
 * drawing of a wrong body: `drawBodies`' job is to say what the export builds,
 * and the fix belongs on both sides of it at once.
 *
 * The width is `|w·cos| + |h·sin|` and the height its mirror — the standard
 * bound of a rotated rectangle, in the object's own drawn size, so a scale is
 * already in the numbers handed in. Absolute throughout, because a negative
 * scale flips an object without giving it a negative-width body and Phaser
 * normalises the same way.
 *
 * `bodyIsTurned` is the gate rather than `rotation !== 0`: at a half turn the
 * box is the box, so a project that flips something 180 degrees exports byte
 * for byte what it always did.
 */
export function bodyBoxOf(
  width: number,
  height: number,
  rotation: number,
): { width: number; height: number } {
  const w = Math.abs(width);
  const h = Math.abs(height);
  const radians = ((Number.isFinite(rotation) ? rotation : 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return { width: w * cos + h * sin, height: w * sin + h * cos };
}

/** Whether `bodyBoxOf` would answer with anything but the box it was handed. */
export function bodyIsTurned(rotation: number): boolean {
  return Number.isFinite(rotation) && rotation % 180 !== 0;
}

/**
 * The rectangle a body actually occupies, and at what angle — the one place the
 * two engines' answers to that question are given.
 *
 * This is the whole of what choosing Matter buys, so it is worth stating as one
 * function rather than as a branch at each drawing site. Arcade's answer is the
 * box that *holds* the turned object, upright, because nothing in Arcade turns
 * a body. Matter's is the object's own box, turned — a real polygon, which is
 * what a person means when they say the collision shape should follow the
 * shape.
 *
 * `rotation` in the answer is the angle to *draw* the box at, not the node's:
 * for Arcade it is always zero however far the object has been turned, and the
 * difference between those two zeros is exactly the thing the canvas is trying
 * to show. `drawBodies` is one consumer and the exported Matter helper is the
 * other, so the outline and the game cannot disagree — `textStyleOf`'s
 * two-consumer rule, on the one thing here nobody can see until the game is in
 * their hand.
 *
 * A fresh object per call, so `useEditorStore((s) => bodyShapeOf(...))` is
 * React error #185 — the `tileMapOf` trap. Derive it outside the selector.
 */
export function bodyShapeOf(
  engine: PhysicsEngine,
  width: number,
  height: number,
  rotation: number,
): { width: number; height: number; rotation: number } {
  if (engine === 'matter') {
    const turn = Number.isFinite(rotation) ? rotation : 0;
    return { width: Math.abs(width), height: Math.abs(height), rotation: turn };
  }
  return { ...bodyBoxOf(width, height, rotation), rotation: 0 };
}

/**
 * What the player drives an object with.
 *
 * The first thing in this schema that is about what happens while the game is
 * *running*, and it is here because it is a standing fact about the world
 * rather than a sequence of events: which object the player drives, and how it
 * answers the keys. What happens *when* it reaches something is still the
 * user's line to write, exactly as the collider used to be.
 *
 * `mode` is two presets rather than a pile of booleans, because that is how a
 * person picks: a top-down game moves on four axes and never jumps, and a
 * platformer moves on two and jumps, and only while it is standing on
 * something. Splitting them into `moveVertically` and `canJump` would let a
 * user ask for a fifth combination nobody wants and the exporter would have to
 * answer for it.
 */
export interface NodeControls {
  mode: 'platformer' | 'topDown';
  /** Which keys drive it. Both read the same four directions. */
  scheme: 'arrows' | 'wasd';
  /** Pixels per second, applied as a velocity rather than an acceleration. */
  speed: number;
  /**
   * The upward velocity a jump is given, in pixels per second. Platformer
   * only, and zero is a platformer character that cannot jump — which is a
   * thing people build, so it is not repaired to a default.
   */
  jump: number;
  /**
   * Whether the exported game also draws on-screen buttons for this object.
   *
   * A boolean *beside* `scheme` rather than a third value of it, and the two
   * are genuinely orthogonal questions: which keys drive this, and whether
   * there are also buttons to press. A mutually exclusive `'touch'` would mean
   * picking it silently produced a game a desktop cannot play, with nothing in
   * the panel saying so — where this way one export plays in both places.
   *
   * Off by default, because switching it on puts visible buttons into the
   * exported game. That is the rule the asset table, the tilemap helper, the
   * prefab factories and the emitted `update()` itself all already follow: a
   * project that predates a feature exports byte for byte what it always did.
   */
  touch: boolean;
}

/** Phaser's own default, and the speed a body of a few tens of pixels reads at. */
const DEFAULT_SPEED = 200;
/** Enough to clear about two tiles under the gravity `defaultProject` ships. */
const DEFAULT_JUMP = 450;

/**
 * The node's controls, defaulted and validated in one place.
 *
 * The `physicsOf` / `guidesOf` / `soundsOf` / `cameraOf` / `tileMapOf` family,
 * and it answers three questions at once: is this node somewhere driving would
 * mean anything, is it something Arcade can push, and is the stored object well
 * formed. Any one of them forgotten is an exported `update()` calling
 * `setVelocityX` on a `StaticBody`, which does not have one.
 *
 * The top-level rule is the physics rule arriving a third time, after the body
 * and the camera's follow target, and it is the same rule for the same reason:
 * a velocity moves an object in *world* coordinates, and a node inside a
 * container has parent-relative ones. A prefab definition's children are
 * container children by the same mechanism, so this bans a driven node there
 * too without a second check. Found deeper it reads as *absent* rather than
 * being deleted, so a node dragged into a group and back out again keeps it.
 *
 * A fresh object every call, exactly as `physicsOf` builds one — so
 * `useEditorStore((s) => controlsOf(...))` is an infinite render loop (React
 * error #185). Select the node and derive outside the selector.
 */
export function controlsOf(
  node: GameObjectNode,
  topLevel: boolean,
): NodeControls | null {
  // A static body has no velocity at all, so there is nothing for a key to
  // change — the same reason the inspector hides a static body's own velocity
  // rows rather than disabling them.
  const body = physicsOf(node, topLevel);
  if (body === null || body.kind !== 'dynamic') return null;

  const raw = node.controls;
  if (typeof raw !== 'object' || raw === null) return null;

  const numberOr = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

  return {
    mode: raw.mode === 'topDown' ? 'topDown' : 'platformer',
    scheme: raw.scheme === 'wasd' ? 'wasd' : 'arrows',
    // Repaired rather than dropped, which is `soundsOf`'s split: a negative
    // speed is a character that walks backwards from every key, and there is a
    // sensible number to fall back to.
    speed: Math.max(0, numberOr(raw.speed, DEFAULT_SPEED)),
    jump: Math.max(0, numberOr(raw.jump, DEFAULT_JUMP)),
    // Absent reads as off, which is what keeps every file written before this
    // existed exporting exactly what it exported then. The `scheme` ternary
    // above is untouched, which is the whole payoff of not making the buttons
    // a third value of it.
    touch: raw.touch === true,
  };
}

/** The controls a node gets the moment one is switched on. */
export function defaultControls(): NodeControls {
  return {
    mode: 'platformer',
    scheme: 'arrows',
    speed: DEFAULT_SPEED,
    jump: DEFAULT_JUMP,
    touch: false,
  };
}

/**
 * The eases the editor offers, which are exact keys of Phaser's own `EaseMap`.
 *
 * An allowlist rather than free text, and this is stricter than the escaping
 * needs to be. `str()` already sits between this string and the output, so the
 * argument is not injection — it is that `GetEaseFunction` resolves an unknown
 * name to `Power0` and **says nothing at all**: no warning, no error, just a
 * linear tween where the user asked for a bounce. That is the silent-fallback
 * family this file keeps running into, `CSS_GENERICS` and `__BASE` one module
 * over, and the answer is the same — refuse the value rather than discover it
 * on the far side of an export.
 *
 * It is also what makes the inspector's control a `SelectField`: an ease is a
 * name with no near neighbour, so typed by hand it is wrong by one character
 * and silently does something else. The atlas Frame field's argument exactly.
 *
 * Phaser's map holds five `PowerN` aliases and eleven bare family names that
 * all mean `.easeOut`; none of them is here, because two names for one curve is
 * a thing to explain in a dropdown rather than a choice anybody wants.
 */
export const TWEEN_EASES = [
  'Linear',
  'Sine.easeIn',
  'Sine.easeOut',
  'Sine.easeInOut',
  'Quad.easeIn',
  'Quad.easeOut',
  'Quad.easeInOut',
  'Cubic.easeIn',
  'Cubic.easeOut',
  'Cubic.easeInOut',
  'Expo.easeIn',
  'Expo.easeOut',
  'Expo.easeInOut',
  'Back.easeIn',
  'Back.easeOut',
  'Back.easeInOut',
  'Bounce.easeIn',
  'Bounce.easeOut',
  'Bounce.easeInOut',
  'Elastic.easeIn',
  'Elastic.easeOut',
  'Elastic.easeInOut',
] as const;

export type TweenEase = (typeof TWEEN_EASES)[number];

/**
 * The properties a tween may drive, and what each one ends at.
 *
 * A bag of optionals rather than six numbers, because **an absent property is
 * not a zero**: `x: undefined` says "this tween is not about x" and `x: 0` says
 * "end at the left edge". That is `wordWrapWidth: 0`'s sentinel inverted — a
 * wrap width of zero has no second meaning, while every one of these six has a
 * perfectly ordinary zero.
 *
 * The values are **absolute** and in the units the inspector already shows, not
 * Phaser's `'+=100'` relative strings. Phaser takes either; a relative offset
 * would be a second way of saying where something ends up, and absolute is the
 * one that names a *place* — which is what lets the canvas draw the
 * destination, and drawing it is half of what makes this editable by eye.
 *
 * `rotation` keeps the document's name and the document's units and becomes
 * Phaser's `angle` at the emit, for `Transform.rotation`'s reason: degrees are
 * what the inspector shows, and a second unit in a second place is how the two
 * come to disagree.
 */
export interface TweenTargets {
  x?: number;
  y?: number;
  /** Degrees, emitted as Phaser's `angle`. */
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  alpha?: number;
}

/** The property names a tween may drive, for the inspector and the emit alike. */
export const TWEEN_PROPERTIES = [
  'x',
  'y',
  'rotation',
  'scaleX',
  'scaleY',
  'alpha',
] as const;

export type TweenProperty = (typeof TWEEN_PROPERTIES)[number];

/**
 * What each of those properties is called on a Phaser Game Object.
 *
 * One builder with two consumers — `EditorScene`'s tween and the exporter's
 * config literal — which is `textStyleOf`'s and `bodyShapeOf`'s rule on one of
 * the few things here nobody can see until the game is in their hand. Five of
 * the six are the same word twice and look like a table not worth writing; the
 * sixth is the whole reason it exists. `rotation` on a Game Object is
 * **radians**, and Phaser's degrees property is `angle` — so a tween emitted
 * against `rotation: 180` is a perfectly legal tween of 180 radians. It
 * compiles, it runs, it is wrong by a factor of 57, and nothing but a person
 * looking at the game would ever say so.
 */
export const TWEEN_PHASER_KEY: Readonly<Record<TweenProperty, string>> = {
  x: 'x',
  y: 'y',
  rotation: 'angle',
  scaleX: 'scaleX',
  scaleY: 'scaleY',
  alpha: 'alpha',
};

/**
 * A tween attached to one object: where its numbers end up, and how they get
 * there.
 *
 * The fields are Phaser's own under Phaser's names, so `tweens.add` in the
 * exported code is this object with `to` spread into it — the rule
 * `AnimationClip` and the emitter config already follow.
 *
 * **One tween per node, several properties inside it.** Phaser's config takes
 * many properties under one duration and one ease, which is most of what
 * anybody asks for ("slide and fade"). A second tween on one object means a
 * second *duration*, which is a list — and a list is the deliberate hole here
 * rather than a thing that was forgotten.
 */
export interface NodeTween {
  to: TweenTargets;
  /** Milliseconds. */
  duration: number;
  /** Milliseconds before it starts. */
  delay: number;
  ease: TweenEase;
  /** Runs back to where it started before repeating. */
  yoyo: boolean;
  /** Phaser's own: -1 repeats forever, 0 plays once. */
  repeat: number;
  /** Milliseconds paused before each repeat. */
  repeatDelay: number;
}

const DEFAULT_TWEEN_DURATION = 1000;
/**
 * How far a brand-new tween's destination sits from the object.
 *
 * Far enough to be visibly somewhere else at either project's zoom, and small
 * enough that it is still on screen for an object anywhere but hard against the
 * right edge.
 */
const DEFAULT_TWEEN_TRAVEL = 100;

/**
 * The node's tween, defaulted and validated in one place.
 *
 * The `physicsOf` / `controlsOf` / `guidesOf` / `soundsOf` / `cameraOf` /
 * `tileMapOf` family, and it answers four questions at once: is there a tween
 * here, does it drive anything, are the numbers ones Phaser can be handed, and
 * is the ease one the editor offers. Any one of them answered somewhere else is
 * a canvas and an export that disagree about how an object moves — which is the
 * one kind of failure a user cannot see until the game is in their hand.
 *
 * The second question is the one that costs the whole tween rather than being
 * repaired, and it is `soundsOf`'s split: a tween with nothing in `to` is a
 * real Phaser tween that animates no property, holds the object for its
 * duration and looks exactly like the feature being broken. There is no
 * placeholder state for it to be in, so it reads as **absent**.
 *
 * A `duration` of 0 is repaired rather than passed on, which is `followLerp`'s
 * case: Phaser completes such a tween on its first frame, so it is a tween that
 * says it moves something and then does not.
 *
 * A fresh object every call, so `useEditorStore((s) => tweenOf(...))` is an
 * infinite render loop (React error #185) — the `tileMapOf` trap, ninth time.
 * Select the node and derive outside the selector.
 */
export function tweenOf(node: GameObjectNode): NodeTween | null {
  const raw = node.tween;
  if (typeof raw !== 'object' || raw === null) return null;

  const source = raw.to;
  if (typeof source !== 'object' || source === null) return null;

  const to: TweenTargets = {};
  for (const key of TWEEN_PROPERTIES) {
    const value = source[key];
    // A property is either a finite number or it is not part of this tween.
    // Repairing a NaN to 0 would invent a destination nobody named, which for a
    // position is a jump to the origin.
    if (typeof value === 'number' && Number.isFinite(value)) to[key] = value;
  }
  if (Object.keys(to).length === 0) return null;

  const numberOr = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

  return {
    to,
    // At least one millisecond, for the reason above: zero is a tween that
    // completes before it has drawn a frame.
    duration: Math.max(1, numberOr(raw.duration, DEFAULT_TWEEN_DURATION)),
    delay: Math.max(0, numberOr(raw.delay, 0)),
    ease: TWEEN_EASES.includes(raw.ease as TweenEase) ? (raw.ease as TweenEase) : 'Linear',
    yoyo: raw.yoyo === true,
    // Rounded as well as floored at -1, because Phaser counts repeats down and a
    // fractional one never reaches its own end.
    repeat: Math.max(-1, Math.round(numberOr(raw.repeat, 0))),
    repeatDelay: Math.max(0, numberOr(raw.repeatDelay, 0)),
  };
}

/**
 * The tween a node gets the moment one is switched on: a second of travel to
 * the right, and back again, forever.
 *
 * Seeded from the node's own transform and then *offset*, which is `addCollider`
 * adding a row already pointing at two objects rather than at nothing. The
 * first thing anybody does after switching this on is press ▶, and a
 * destination equal to the object's current position is a tween that runs
 * correctly and moves nothing — which is indistinguishable from the feature
 * being broken, and is the failure mode this file warns about more than any
 * other. Seeding from zero instead would open with a ghost parked in the
 * scene's top-left corner, which reads as a second object rather than as a
 * destination.
 *
 * `x` because it is the one property well defined for every node type: a
 * container and an instance have no width of their own, and a sprite has no
 * height. And `yoyo` with `repeat: -1` so the default ends where it began —
 * switching preview off must not look like the editor moved the object, and a
 * one-shot default would leave it parked at the far end for as long as ▶ is on.
 */
export function defaultTween(node: GameObjectNode): NodeTween {
  return {
    to: { x: node.transform.x + DEFAULT_TWEEN_TRAVEL },
    duration: DEFAULT_TWEEN_DURATION,
    delay: 0,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1,
    repeatDelay: 0,
  };
}

/**
 * A line the user placed for things to line up on.
 *
 * Every other line an object can agree with is incidental — it is wherever some
 * other object happens to sit, or wherever the grid falls. A guide is the one
 * the user gets to author, which is why it is document state and saved with the
 * project rather than an editor preference like the grid pitch.
 *
 * `axis` is written out rather than imported as `bounds.ts`'s `Axis`: this
 * module has no imports at all, and the file format should not come to depend
 * on the measured-bounds cache. The two unions are identical, so they
 * interoperate with no cast.
 */
/**
 * Two objects in a scene that Arcade should keep apart, or watch for a touch.
 *
 * The one line iteration 16 told the user to write by hand, and the reason
 * `PhysicsBody` carries a `mass` and an `immovable` that nothing it emitted
 * ever read. It is here now because it is a standing fact about the world —
 * *which* pairs interact — where what should *happen* when they touch is a
 * sequence of events and is still the user's to write, on the handle
 * `add.overlap` returns.
 *
 * Two node ids rather than a nesting or a group: an Arcade collider takes two
 * things, and a group is a second way of naming a set of objects that the
 * scene tree already names one at a time.
 */
export interface SceneCollider {
  /**
   * Its own identity, for a `SceneGuide`'s reason: a row is edited and removed
   * individually, and an index does not survive undo rebuilding the array.
   */
  id: string;
  aId: string;
  bId: string;
  /**
   * `collide` separates them, `overlap` only reports the touch — Phaser's
   * `add.collider` and `add.overlap`. The stored word is "collide" rather than
   * "collider" because it is the one a person reads off a row that says two
   * things collide; the exporter maps it to the method name.
   */
  kind: 'collide' | 'overlap';
}
export interface SceneGuide {
  /** 'x' for a vertical line at a constant x, 'y' for a horizontal one. */
  axis: 'x' | 'y';
  position: number;
  /**
   * Its own identity, for the same reason a node has one: a guide is moved and
   * deleted individually, and an index does not survive undo rebuilding the
   * array.
   */
  id: string;
}

/**
 * A named sequence of frames from one sheet.
 *
 * Project-level, beside the assets and for the same reason: a clip is a way of
 * reading one image, so it belongs wherever that image does rather than in the
 * scene that happens to use it first. That is also what lets two scenes share
 * a "walk" without either owning it.
 *
 * The fields are Phaser's own, under Phaser's names, so `anims.create` in the
 * exported code is this object with the frames expanded.
 */
export interface AnimationClip {
  id: string;
  /**
   * Free text, and the animation key in exported code — so it goes through the
   * same de-duplication object names do rather than being trusted as unique.
   */
  name: string;
  /** The sheet the frame indices are read against. */
  assetId: string;
  /**
   * Frames in playback order — indices into a grid, or names out of an atlas,
   * matching however the clip's own asset is cut. Free to repeat and to run
   * backwards: a ping-pong is `[0, 1, 2, 1]`, which is why this is a list
   * rather than a start and an end.
   *
   * The two never mix within one clip, because a clip names one asset and an
   * asset is cut one way. That is what lets the exporter pick between
   * `generateFrameNumbers` and `generateFrameNames` from the asset rather than
   * from the entries.
   */
  frames: (number | string)[];
  frameRate: number;
  /** Phaser's own: -1 loops forever, 0 plays once. */
  repeat: number;
}

export interface SceneDoc {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundColor: string;
  children: GameObjectNode[];
  /**
   * Optional because every file written before guides existed has no such
   * array, and `parseProject` passes scenes through without reconstructing
   * them. Read it through `guidesOf`, never directly.
   */
  guides?: SceneGuide[];
  /**
   * The Arcade world this scene's bodies live in. Optional for the reason
   * `guides` is, and read through `scenePhysicsOf`, never directly.
   */
  physics?: ScenePhysics;
  /**
   * The sounds this scene registers. Optional for the reason `guides` is, and
   * read through `soundsOf`, never directly.
   */
  sounds?: SceneSound[];
  /**
   * Where the game looks when this scene starts. Optional for the reason
   * `guides` is, and read through `cameraOf`, never directly.
   */
  camera?: SceneCamera;
  /**
   * The pairs Arcade keeps apart, or watches. Optional for the reason `guides`
   * is, and read through `collidersOf`, never directly.
   */
  colliders?: SceneCollider[];
  /**
   * What happens in this scene, and when. Optional for the reason `guides` is,
   * and read through `rulesOf`, never directly.
   */
  rules?: SceneRule[];
}

/**
 * The scene's physics world.
 *
 * Gravity and nothing else. The world's *bounds* are deliberately absent: the
 * scene already has a width and a height, and a second rectangle saying how big
 * the scene is would be two fields free to disagree about one number — the
 * argument that gives a sprite no width of its own and a tilemap no tile size
 * of its own. The exporter emits `setBounds(0, 0, width, height)` from the
 * scene's own size, which is also what Phaser would have defaulted to for a
 * game exactly the size of this scene and what it would *not* have defaulted to
 * for a module dropped into a larger one.
 */
export interface ScenePhysics {
  /** Pixels/sec^2. Positive y is downward, as everywhere else here. */
  gravityX: number;
  gravityY: number;
  /**
   * Which engine simulates this scene's bodies.
   *
   * Per scene rather than per project or per node, and each of those two is
   * refused for its own reason. Per *node* is impossible: gravity, the world
   * bounds and which pairs collide are all properties of a world, so two
   * engines in one scene is two worlds and every one of those settings would
   * need saying twice. Per *project* is merely worse: Phaser resolves physics
   * per scene already — `GetPhysicsPlugins` reads the scene's own settings —
   * so a project-level choice would be this editor imposing a limit Phaser
   * does not have.
   *
   * The whole reason it exists is the collision *shape*. An Arcade body is a
   * rectangle whose sides are the world's and nothing turns one, so a platform
   * stood on end can only ever be approximated by the box that holds it. A
   * Matter body is a real polygon that turns with the object. That is the one
   * thing this choice buys, and it is why the engine picker sits beside the
   * gravity rather than in some general settings panel.
   */
  engine: PhysicsEngine;
}

/**
 * Which physics engine a scene runs.
 *
 * Arcade is the default and always will be: it is what every project made
 * before this existed used, it is the cheaper simulation, and an axis-aligned
 * box is the right body for most of what people build. Matter is the answer to
 * one question — *does the collision shape have to turn with the object* — and
 * a scene should only pay for it when the answer is yes.
 */
export type PhysicsEngine = 'arcade' | 'matter';

/**
 * The scene's gravity, defaulted and validated in one place — `guidesOf`'s
 * sibling, on the other optional field scenes carry.
 */
export function scenePhysicsOf(scene: SceneDoc): ScenePhysics {
  const raw = scene.physics;
  const numberOr = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  // Arcade whenever the file does not say otherwise, which is every project
  // made before iteration 26 and every scene nobody has switched — the rule the
  // asset table, the tilemap helper and the prefab factories all follow, so
  // those export byte for byte what they always did.
  const engine: PhysicsEngine = raw?.engine === 'matter' ? 'matter' : 'arcade';
  if (typeof raw !== 'object' || raw === null) {
    return { gravityX: 0, gravityY: 0, engine: 'arcade' };
  }
  return {
    gravityX: numberOr(raw.gravityX, 0),
    gravityY: numberOr(raw.gravityY, 0),
    engine,
  };
}

/**
 * The scene's guides, defaulted and validated in one place.
 *
 * Scenes are the one part of an opened file that is not rebuilt field by field,
 * so this is where a hand-edited or truncated `guides` array is made safe —
 * `parseAssets` does the same job for the asset table. Being the only reader
 * means no call site has to write `?? []` or wonder whether `position` is a
 * number.
 */
export function guidesOf(scene: SceneDoc): SceneGuide[] {
  if (!Array.isArray(scene.guides)) return [];
  return scene.guides.filter(
    (guide): guide is SceneGuide =>
      typeof guide === 'object' &&
      guide !== null &&
      typeof (guide as SceneGuide).id === 'string' &&
      ((guide as SceneGuide).axis === 'x' || (guide as SceneGuide).axis === 'y') &&
      Number.isFinite((guide as SceneGuide).position),
  );
}

/**
 * The scene's sounds: defaulted, validated, and resolved against the table.
 *
 * The `guidesOf` / `frameGridOf` / `physicsOf` / `tileMapOf` / `prefabChildrenOf`
 * family, answering three questions at once — is there a list, is each entry
 * well formed, and does each one name a sound the project still holds. Any of
 * the three forgotten is an export that does not boot, because
 * `this.sound.add(undefined)` is not a thing Phaser can be asked for.
 *
 * A dangling entry is *dropped* rather than kept and drawn some placeholder
 * way, which is stricter than the treatment a sprite pointing at a missing
 * image gets. The difference is the one `parseAnimations` already draws: a
 * sprite has a placeholder to fall back to and a sound has nothing to be. The
 * editor cannot produce one either way — `removeAudio` takes the entries with
 * the file — so this only ever fires on a file the editor did not write, and
 * dropping here means nothing downstream needs a guard of its own.
 *
 * A fresh array every call, exactly as `tileMapOf` and `physicsOf` build a
 * fresh object — so `useEditorStore((s) => soundsOf(...))` compares unequal on
 * every store change and loops forever (React error #185). Select the project
 * and derive outside the selector.
 */
export function soundsOf(project: Project, scene: SceneDoc): SceneSound[] {
  if (!Array.isArray(scene.sounds)) return [];

  const sounds: SceneSound[] = [];
  for (const candidate of scene.sounds) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const sound = candidate as Partial<SceneSound>;
    if (typeof sound.id !== 'string' || !sound.id) continue;
    // The one thing that costs a row rather than being repaired. Everything
    // else here has a sensible value to fall back to; a reference to a sound
    // the project does not hold has none, and `this.sound.add(undefined)` is
    // not something Phaser can be asked for.
    if (findAudio(project, sound.audioId) === undefined) continue;

    const volume = Number(sound.volume);
    sounds.push({
      id: sound.id,
      audioId: sound.audioId as string,
      loop: sound.loop === true,
      // Clamped rather than rejected: one nonsensical number should not cost
      // the row, which is the treatment `parseSheet` gives a margin.
      volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1,
      autoplay: sound.autoplay === true,
    });
  }
  return sounds;
}

/**
 * Whether a node is something a collider may name.
 *
 * A body is the obvious half; a tilemap is the other, because a layer collides
 * through the tiles marked solid on it rather than through a `PhysicsBody` it
 * has not got. Everything else — a container, an instance, a bare rectangle
 * nobody gave a body — has nothing for Arcade to test against.
 */
function canCollide(node: GameObjectNode): boolean {
  return node.type === 'tilemap' || physicsOf(node, true) !== null;
}

/**
 * The scene's collider table, validated against the scene it belongs to.
 *
 * The `guidesOf` / `physicsOf` / `soundsOf` / `cameraOf` / `tileMapOf` family,
 * and it takes `soundsOf`'s split rather than `cameraOf`'s: there is nothing
 * here to repair. A row is two references and a word, and a reference that
 * names nothing usable has no sensible value to fall back to —
 * `physics.add.collider(undefined, x)` is not something Phaser can be asked
 * for, and unlike a sprite with a missing image there is no placeholder state a
 * collider could be in. So the row goes, and *that* is what means nothing
 * downstream needs a guard of its own.
 *
 * Four things cost a row, and each is a thing only a hand-edited file or a
 * since-deleted node can produce:
 *
 * - a side that is not a direct child of the scene, which is the top-level rule
 *   `physicsOf` and `cameraOf` already state, arriving here for free because a
 *   nested node has no body to find;
 * - a side that is neither a body nor a tilemap;
 * - the same node on both sides, which Arcade would test against itself;
 * - two tilemaps, since a layer only ever collides with something that moves.
 *   That last one is also what keeps `physicsUsedIn` in the exporter correct
 *   with no edit: a surviving row implies a body, so the world it needs is
 *   already switched on.
 *
 * Nothing prunes a dangling row anywhere else — not `deleteNode`, not `undo`,
 * not the scene switcher — exactly as nothing prunes a dangling `followId` or
 * `audioId`. `duplicateScene` is the one place that has to think, because a
 * copied row would otherwise point into the scene it was copied from.
 *
 * A fresh array every call, exactly as `soundsOf` builds one — so
 * `useEditorStore((s) => collidersOf(...))` compares unequal on every store
 * change and loops forever (React error #185). Select the scene and derive
 * outside the selector.
 */
export function collidersOf(scene: SceneDoc): SceneCollider[] {
  if (!Array.isArray(scene.colliders)) return [];
  // A Matter world collides every body with every other one by default, so a
  // row there is not merely unnecessary — `physics.add.collider` is Arcade's
  // and `this.physics` does not exist in a scene that started Matter, so
  // emitting one would throw in `create()` before anything was drawn. Answered
  // here rather than at the three call sites, so the exporter, the scene panel
  // and the object panel all fall silent together: the whole point of one
  // reader is that a row this drops cannot come back to life somewhere else.
  //
  // The rows themselves are kept in the document, exactly as a body's Arcade
  // dials are kept in a Matter scene, so switching the engine back brings every
  // pair back with it.
  if (scenePhysicsOf(scene).engine === 'matter') return [];

  const byId = new Map<string, GameObjectNode>();
  for (const child of scene.children) {
    if (canCollide(child)) byId.set(child.id, child);
  }

  const colliders: SceneCollider[] = [];
  for (const candidate of scene.colliders) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const row = candidate as Partial<SceneCollider>;
    if (typeof row.id !== 'string' || !row.id) continue;
    if (typeof row.aId !== 'string' || typeof row.bId !== 'string') continue;
    if (row.aId === row.bId) continue;

    const a = byId.get(row.aId);
    const b = byId.get(row.bId);
    if (a === undefined || b === undefined) continue;
    if (a.type === 'tilemap' && b.type === 'tilemap') continue;

    colliders.push({
      id: row.id,
      aId: row.aId,
      bId: row.bId,
      kind: row.kind === 'overlap' ? 'overlap' : 'collide',
    });
  }
  return colliders;
}

/**
 * The validated rows that name this node, in document order.
 *
 * `collidersOf` filtered, never `scene.colliders` read a second time — the
 * whole point of that function being the only reader is that a row it has
 * dropped cannot come back to life on some other panel. `touchZonesOf` is built
 * on `controlsOf` for the same reason.
 *
 * It exists because a body that nothing collides with is a body that falls
 * through everything, and the object's own panel is where a person is standing
 * when they need to know that. The scene-wide table is still `collidersOf`;
 * this is that table asked about one object.
 *
 * A fresh array every call, exactly as `collidersOf` builds one, so
 * `useEditorStore((s) => collidersNaming(...))` compares unequal on every store
 * change and loops forever (React error #185) — the `tileMapOf` trap, ninth
 * time. Select the scene and derive outside the selector.
 */
export function collidersNaming(scene: SceneDoc, nodeId: string): SceneCollider[] {
  return collidersOf(scene).filter((row) => row.aId === nodeId || row.bId === nodeId);
}

/** The nodes a collider row may name, which is what the inspector offers. */
export function collidableNodes(scene: SceneDoc): GameObjectNode[] {
  return scene.children.filter(canCollide);
}

/** What one on-screen button does. */
export type TouchKey = 'left' | 'right' | 'up' | 'down' | 'jump';

/** A button, in scene coordinates — which are the game canvas' own. */
export interface TouchButton {
  key: TouchKey;
  /** The glyph drawn in the middle of it, in the editor and in the export. */
  label: string;
  x: number;
  y: number;
  radius: number;
}

/**
 * A button is 7.5% of the scene's shorter side, with a floor: a scene small
 * enough for the proportion to put a button under a fingernail gets the floor
 * instead, and one big enough for the proportion to matter gets a thumb.
 * Proportional rather than fixed because the canvas is scaled to fit whatever
 * screen the game lands on, so a fixed radius would be a different physical
 * size on every device.
 */
const TOUCH_MIN_RADIUS = 24;
const TOUCH_RADIUS_RATIO = 0.075;

/**
 * The nodes this scene's keys and buttons actually drive.
 *
 * `controlsOf`'s two refusals — top level, and a dynamic body — and nothing
 * else. It is a scene-level reader rather than a filter written out three
 * times, for `collidersOf`'s reason: the exporter, the renderer's arrow marks
 * and `touchZonesOf` all have to agree about which objects are driven, and one
 * of them disagreeing is a pad drawn over a game that does not read it.
 *
 * **It used to refuse a Matter scene, and that was a bug rather than a limit.**
 * The reasoning was sound as far as it went — the behaviour is a velocity
 * written onto a body every frame, and a platformer's jump was gated on
 * `blocked.down`, which is Arcade's own flag and which Matter does not have —
 * but the conclusion did not follow. What it produced was a Controls panel that
 * still offered "Player controls" and "On-screen buttons" in a Matter scene,
 * accepted both, and then drew nothing and exported nothing, with no sentence
 * anywhere saying why. That is the failure this file already names twice: a
 * feature that is silently absent reads exactly like one that is broken.
 * Matter's answer to "what is under me" is a collision normal rather than a
 * flag, which is a helper and not a behaviour model — see Matter physics.
 */
export function drivenIn(scene: SceneDoc): GameObjectNode[] {
  return scene.children.filter((child) => controlsOf(child, true) !== null);
}

/**
 * Where the exported game draws its on-screen buttons, or `[]` for a scene that
 * asks for none.
 *
 * The `guidesOf` / `physicsOf` / `cameraOf` / `soundsOf` / `tileMapOf` /
 * `collidersOf` family, and it answers three questions at once: does anything
 * in this scene want buttons, which buttons do the modes present in it need,
 * and where do they sit against this scene's size. Any one of them answered
 * somewhere else is a renderer drawing a pad the export does not build, which
 * is the one failure a user cannot see until the game is in their hand.
 *
 * **One set per scene, not per object.** The buttons belong to the canvas, so
 * two driven objects read the same five flags — which is what a player expects,
 * and what falls out of the geometry being the scene's rather than the node's.
 * The modes are therefore a union: any top-down node puts up and down on the
 * pad, any platformer puts a jump button on the right.
 *
 * `scene.children` only, so the top-level rule `controlsOf` enforces is
 * inherited here rather than repeated — a driven node inside a group is not
 * driven, so it asks for no buttons either.
 *
 * That the scene rectangle *is* the game canvas is not an assumption made here:
 * it is the identity `cameraViewOf` already rests on, and the reason a camera
 * has no rectangle of its own.
 *
 * A fresh array every call, exactly as `collidersOf` builds one — so
 * `useEditorStore((s) => touchZonesOf(...))` compares unequal on every store
 * change and loops forever (React error #185). Select the scene and derive
 * outside the selector.
 */
export function touchZonesOf(scene: SceneDoc): TouchButton[] {
  let pad = false;
  let vertical = false;
  let jump = false;
  for (const child of drivenIn(scene)) {
    const controls = controlsOf(child, true);
    if (controls === null || !controls.touch) continue;
    pad = true;
    if (controls.mode === 'topDown') vertical = true;
    else jump = true;
  }
  if (!pad) return [];

  const radius = Math.max(
    TOUCH_MIN_RADIUS,
    Math.min(scene.width, scene.height) * TOUCH_RADIUS_RATIO,
  );
  const margin = radius;
  // The cross's centre, placed so that the whole cross — up and down included —
  // sits inside the margin whether or not this scene has them. That is what
  // keeps left and right where they were when a top-down object joins a
  // platformer one: adding a row must not move the buttons already in use.
  const padX = margin + radius * 3;
  const padY = scene.height - margin - radius * 3;

  const buttons: TouchButton[] = [
    { key: 'left', label: '\u2190', x: padX - radius * 2, y: padY, radius },
    { key: 'right', label: '\u2192', x: padX + radius * 2, y: padY, radius },
  ];
  if (vertical) {
    buttons.push({ key: 'up', label: '\u2191', x: padX, y: padY - radius * 2, radius });
    buttons.push({ key: 'down', label: '\u2193', x: padX, y: padY + radius * 2, radius });
  }
  if (jump) {
    // On the pad's own line rather than in the very corner, so both thumbs rest
    // at the same height — and on the far side, because a jump reached with the
    // hand already holding a direction is the one thing `addPointer(2)` is for.
    buttons.push({
      key: 'jump',
      label: '\u25b2',
      x: scene.width - margin - radius,
      y: padY,
      radius,
    });
  }
  return buttons;
}

/**
 * Where the game looks when this scene starts.
 *
 * The scene already says how big the view is — a camera's viewport is the game
 * canvas, which is this scene's own width and height — so what is left is where
 * that view sits, how far in it is zoomed, what it may not scroll past and what
 * it chases. Nothing here says *when*: an effect over time is game logic, the
 * argument that keeps `scene.start` out of the document.
 *
 * `boundToScene` is a boolean rather than a rectangle for the reason
 * `ScenePhysics` has no bounds of its own: the scene rectangle already says how
 * big the scene is, and a second rectangle saying it again is two fields free
 * to disagree about one number.
 */
export interface SceneCamera {
  /** Top-left of the *unzoomed* viewport in world space, as Phaser stores it. */
  scrollX: number;
  scrollY: number;
  /** Above 1 shows less of the world, below 1 shows more. Never 0. */
  zoom: number;
  /** Whether scrolling is held inside the scene rectangle. */
  boundToScene: boolean;
  /** Phaser's own pixel-art switch, passed on to `startFollow` as well. */
  roundPixels: boolean;
  /**
   * A top-level node this camera follows, or null.
   *
   * Top-level for the reason an Arcade body is: following reads the target's
   * `x`/`y` as world coordinates, and a node inside a container has
   * parent-relative ones. It is the same rule arriving twice, and it is
   * enforced the same way — stripped on read here, refused on write in the
   * store.
   */
  followId: string | null;
  /** How hard it chases: 1 snaps, lower is smoother. Phaser's `lerp`. */
  followLerp: number;
}

/** What a scene's camera is when the file does not say. */
export const DEFAULT_CAMERA: SceneCamera = {
  scrollX: 0,
  scrollY: 0,
  zoom: 1,
  boundToScene: false,
  roundPixels: false,
  followId: null,
  followLerp: 1,
};

/**
 * The scene's camera: defaulted, validated, and resolved against the scene.
 *
 * The `guidesOf` / `scenePhysicsOf` / `soundsOf` / `frameGridOf` / `tileMapOf` /
 * `prefabChildrenOf` family, and it answers three questions at once — is there a
 * camera, are its numbers ones Phaser can be given, and does it follow
 * something a follow could actually work on. Any of the three forgotten is a
 * `setZoom(0)`, which Phaser clamps behind your back, or a
 * `startFollow(undefined)`, which it cannot be asked for at all.
 *
 * Numbers are repaired and the *reference* is dropped, which is `soundsOf`'s
 * split: a nonsensical zoom has a sensible value to fall back to and a
 * `followId` naming nothing has none. Dropping it here is what means nothing
 * downstream needs a guard — no pruning in `deleteNode`, in `undo` or in the
 * scene switcher, exactly as no action prunes a dangling `audioId`.
 *
 * A follow target found below the top level reads as *absent* rather than being
 * deleted, which is the answer `physicsOf` gives a body on a nested node and for
 * its reason: a node dragged into a group and back out is the same node, and
 * throwing the setting away on the way in would be a deletion nothing asked for.
 *
 * A fresh object every call, exactly as `physicsOf` and `tileMapOf` build one —
 * so `useEditorStore((s) => cameraOf(...))` compares unequal on every store
 * change and loops forever (React error #185). Select the scene and derive
 * outside the selector.
 */
export function cameraOf(scene: SceneDoc): SceneCamera {
  const raw = scene.camera;
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_CAMERA };

  const numberOr = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

  const zoom = numberOr(raw.zoom, 1);
  const lerp = numberOr(raw.followLerp, 1);
  const followId =
    typeof raw.followId === 'string' &&
    scene.children.some((child) => child.id === raw.followId)
      ? raw.followId
      : null;

  return {
    scrollX: numberOr(raw.scrollX, 0),
    scrollY: numberOr(raw.scrollY, 0),
    // Phaser clamps a zoom of 0 to 0.001 rather than refusing it, which is a
    // camera showing a thousand scenes at once and nothing saying why.
    zoom: zoom > 0 ? zoom : 1,
    boundToScene: raw.boundToScene === true,
    roundPixels: raw.roundPixels === true,
    followId,
    // Clamped, and a zero repaired rather than kept: Phaser reads a lerp of 0
    // as "do not track on this axis", which is a camera that says it follows
    // something and then does not.
    followLerp: lerp > 0 ? Math.min(1, lerp) : 1,
  };
}

/** Whether a camera is the one every scene has by default. */
export function isDefaultCamera(camera: SceneCamera): boolean {
  return (
    camera.scrollX === DEFAULT_CAMERA.scrollX &&
    camera.scrollY === DEFAULT_CAMERA.scrollY &&
    camera.zoom === DEFAULT_CAMERA.zoom &&
    camera.boundToScene === DEFAULT_CAMERA.boundToScene &&
    camera.roundPixels === DEFAULT_CAMERA.roundPixels &&
    camera.followId === DEFAULT_CAMERA.followId &&
    camera.followLerp === DEFAULT_CAMERA.followLerp
  );
}

/**
 * The part of the world the camera opens on, in scene coordinates.
 *
 * The arithmetic is Phaser's own, from `Camera.preRender` and `clampX`/`clampY`,
 * and it has to stay copied for `frameLayoutOf`'s reason: this is what the
 * editor draws, and a formula of our own would offer the user a shot their
 * exported game does not open on. Two parts of it are easy to get wrong by
 * guessing — the view is centred on the *unzoomed* viewport's middle rather
 * than pinned to its top-left, so zooming closes in on the middle of the shot
 * and not on its corner; and the bounds clamp moves the scroll rather than
 * cropping the view.
 *
 * The viewport is the scene's own width and height because that is the size of
 * the game canvas an export builds — the same "one number, one place" that
 * gives a sprite no width of its own.
 *
 * Where a follow would take it is deliberately not in here. The frame is the
 * shot the scene opens on; a camera in motion is the thing the editor does not
 * run, exactly as it does not run a physics step.
 */
export function cameraViewOf(scene: SceneDoc): { x: number; y: number; width: number; height: number } {
  const camera = cameraOf(scene);
  const width = scene.width / camera.zoom;
  const height = scene.height / camera.zoom;

  // Phaser's `clampX`, where the viewport and the bounds are both the scene's
  // own size — which is what makes the two arguments one number here.
  const clamp = (scroll: number, display: number, size: number) => {
    if (!camera.boundToScene) return scroll;
    const low = (display - size) / 2;
    const high = Math.max(low, low + size - display);
    return Math.min(high, Math.max(low, scroll));
  };

  const scrollX = clamp(camera.scrollX, width, scene.width);
  const scrollY = clamp(camera.scrollY, height, scene.height);

  return {
    x: scrollX + scene.width / 2 - width / 2,
    y: scrollY + scene.height / 2 - height / 2,
    width,
    height,
  };
}

/**
 * A reusable object graph, named and stored once for the whole project.
 *
 * Project-level for the reason the animations are: a prefab is a thing the
 * project knows how to build, not something a scene owns, and two scenes share
 * one without either being the owner. What a scene holds is an `instance` node
 * pointing at this by id.
 *
 * `children` is a list rather than a single root node so that "these three
 * things" is expressible without inventing a wrapper the user did not ask for.
 * An instance draws them inside its own container, which is where the grouping
 * actually comes from.
 */
export interface Prefab {
  id: string;
  /**
   * Free text, and the factory function's name in exported code — so it goes
   * through the same `toIdentifier` de-duplication object names do rather than
   * being trusted to be a usable identifier, or to be unique.
   */
  name: string;
  children: GameObjectNode[];
}


/* -------------------------------------------------------------------------- */
/*  Rules                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The keys a rule may listen for, as Phaser names them.
 *
 * `Phaser.Input.Keyboard.KeyCodes`' own names, which are also the suffixes
 * `keyboard.on('keydown-SPACE')` dispatches on — Phaser builds its `KeyMap` by
 * inverting that table, so the two cannot disagree.
 *
 * An allowlist rather than a free string field, and **the argument is not
 * injection** — `str()` already sits between this and the output. It is that
 * `keyboard.on('keydown-BANANA', ...)` registers a listener on an event string
 * nothing ever emits: no warning, no error, no throw, and a key that simply
 * never works. That is `TWEEN_EASES`' argument to the character, one plugin
 * over, and it is what makes the control a `SelectField`.
 */
export const RULE_KEYS: readonly string[] = [
  'SPACE', 'ENTER', 'ESC', 'SHIFT', 'CTRL', 'ALT', 'TAB', 'BACKSPACE',
  'LEFT', 'RIGHT', 'UP', 'DOWN',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  'ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
];

/**
 * The node types a `tap` trigger may name.
 *
 * Presently the same six as `PHYSICS_TYPES`, and deliberately a **second list**
 * rather than a reuse of that one: they answer different questions — one is
 * about whether Arcade can simulate a body, this is about whether Phaser can
 * build a hit area — and they come apart the moment either changes. The note in
 * `EditorScene` about `ParticleEmitter` gaining ComputedSize is exactly the
 * change that would move this list and not that one.
 *
 * Each of the four left out is left out for a mechanical reason rather than a
 * preference, and each is said in the panel rather than being silently absent:
 *
 * - a `container` and an `instance` are Phaser Containers, whose `width` and
 *   `height` are 0 until something sets them — and a group's box is measured by
 *   the *renderer* (`bounds.ts`) from its children, which a pure function of the
 *   document cannot see. A tap on a group in a running game is a tap on
 *   whichever child was under the finger, which is a question about children
 *   that a rule naming one node cannot ask.
 * - a `tilemap` emits one object per layer, so a tap on it has no single
 *   target; and a tap on a map is really a tap on a *tile*, which is a per-cell
 *   question this document has nowhere to put.
 * - a `particles` node has neither Origin nor ComputedSize, so Phaser's
 *   `pointWithinHitArea` adds an undefined `displayOriginX` and tests `NaN`.
 *   That is the recorded reason the emitter is drawn inside a wrapper at all.
 */
const TAPPABLE_TYPES: ReadonlySet<NodeType> = new Set<NodeType>([
  'rectangle',
  'ellipse',
  'text',
  'sprite',
  'nineslice',
  'tileSprite',
]);

/** Whether a `tap` trigger may name this node type, for the inspector. */
export function canBeTapped(type: NodeType): boolean {
  return TAPPABLE_TYPES.has(type);
}

/**
 * The moment a rule fires at.
 *
 * Every one of the five is a moment **Phaser already delivers**: `create()`, a
 * collider's own callback, `pointerdown`, `keydown-<KEY>` and a `TimerEvent`.
 * Not one of them is polled, and that is not a coincidence — it is the
 * constraint that chose them, and it is the line this feature draws in place of
 * the one iteration 20 drew. A sixth trigger of the form "while..." or "when the
 * score passes ten" would be the first that has to be watched for on every
 * frame, which is the first that needs an emitted `update()`, which is exactly
 * where the line now falls.
 */
export type RuleTrigger =
  | { kind: 'sceneStart' }
  | { kind: 'collide'; aId: string; bId: string }
  | { kind: 'tap'; nodeId: string }
  | { kind: 'keyDown'; key: string }
  | { kind: 'timer'; delay: number; loop: boolean };

/** The comparisons a condition may make. */
export type RuleOperator = 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte';

export const RULE_OPERATORS: readonly RuleOperator[] = [
  'eq',
  'ne',
  'lt',
  'lte',
  'gt',
  'gte',
];

/**
 * The comparisons that mean anything about text.
 *
 * Read by the panel's operator picker and matched by `ruleConditionsOf`'s
 * refusal, so the control and the reader cannot disagree about which tests a
 * text variable may carry — `RULE_OPERATOR_JS`'s one-builder rule, applied to
 * the *set* rather than to the spelling. `'won' > 'lost'` is a comparison
 * JavaScript performs happily, on code points, and nobody asks for.
 */
export const TEXT_OPERATORS: readonly RuleOperator[] = ['eq', 'ne'];

/**
 * What each comparison is written as in JavaScript.
 *
 * The one builder for it, read by the panel's label and by the emit —
 * `TWEEN_PHASER_KEY`'s rule, and for its reason: a document word and a language
 * operator are two different things, and conflating them is the kind of mistake
 * nobody can see until the game is in their hand. `eq` is `===` rather than
 * `==`, because the registry holds whatever was last written to it and a
 * coercing comparison would make `0` and `false` the same answer.
 */
export const RULE_OPERATOR_JS: Record<RuleOperator, string> = {
  eq: '===',
  ne: '!==',
  lt: '<',
  lte: '<=',
  gt: '>',
  gte: '>=',
};

/** How each comparison reads on a panel row. */
export const RULE_OPERATOR_LABEL: Record<RuleOperator, string> = {
  eq: 'is',
  ne: 'is not',
  lt: 'is under',
  lte: 'is at most',
  gt: 'is over',
  gte: 'is at least',
};

/**
 * One test a rule makes before it does anything.
 *
 * It reads a **variable** and nothing else — never a live property of an object.
 * That is the second thing this feature refuses rather than a hole in it. A
 * variable is the one quantity here that survives `scene.start`, that validates
 * against a table the document holds, and that is *one shape across the whole
 * union* — where `x` on a tilemap, `alpha` on a particles wrapper and `width` on
 * a sprite are three different questions. It is `TWEEN_PROPERTIES`' refusal of a
 * seventh property, arriving in a condition.
 *
 * No `id`, unlike `SceneGuide`, `SceneCollider` and `TilemapLayerDoc`. Each of
 * those carries one because something *outside* the array names it — a row on
 * another panel, or `activeLayerId`. Nothing names a condition: it has no
 * existence outside the rule that holds it, and that rule is itself keyed. Said
 * out loud, because on this list "no id needed" and "forgot the id" look
 * identical.
 */
export interface RuleCondition {
  variableId: string;
  op: RuleOperator;
  /**
   * What the variable is compared against, in the variable's own kind.
   *
   * A text variable may only be tested with `eq` or `ne`: `'won' > 'lost'` is a
   * comparison JavaScript performs and nobody asks for, and an ordering test on
   * text is therefore refused on read rather than repaired — see `rulesOf`.
   */
  value: VariableValue;
}

/**
 * One thing a rule does.
 *
 * A closed union of verbs, each naming a thing the document already holds — a
 * node in this scene, a scene in this project, a sound this scene registers, a
 * clip, a variable. Nothing here is parsed and nothing is interpolated as code.
 * That is the whole of what makes a rule data rather than a program.
 *
 * `setText` is the one verb carrying **free user text**, and that is a narrower
 * thing than it sounds: the string is a caption, printed through `str()` into a
 * string literal exactly as an object's name and a text node's own content
 * already are. What it is not is a *template* — there is no syntax inside it, so
 * nothing reads it and nothing can be hidden in it. A variable's value is
 * appended by naming the variable in a field of its own, which is why the
 * document holds a `variableId` beside the text rather than a `{score}` a parser
 * would have to find. One value, after the caption: two variables in one caption
 * is an expression, which is the line this vocabulary does not cross.
 *
 * `playSound` names a **`SceneSound` row**, not an `audioId`, and that is the
 * one choice here worth defending. `buildSoundLines` already binds one
 * `const jumpSound` per row in `create()`'s prologue, so the action emits a name
 * that exists over a key `preload()` has already loaded, and `collectAudio`,
 * `usedIn`, `missingReason` and the preload gate all need no edit at all. An
 * `audioId` would name a sound the scene may not register — and `sound.add` on a
 * key the cache does not hold *throws inside `create()` before a single object
 * is added*, which Audio already records as worse than the image case.
 *
 * It is also the sentence this iteration exists to write. Audio said:
 * "`jumpSound.play()` is the user's line to write, exactly as the collider is."
 * This is where the document writes it, on the handle iteration 17 built for it.
 */
export type RuleAction =
  | { kind: 'startScene'; sceneId: string }
  | { kind: 'restartScene' }
  | { kind: 'destroy'; nodeId: string }
  | { kind: 'setVisible'; nodeId: string; visible: boolean }
  | { kind: 'setText'; nodeId: string; text: string; variableId?: string }
  | { kind: 'playSound'; soundId: string }
  | { kind: 'stopSound'; soundId: string }
  | { kind: 'playAnimation'; nodeId: string; animationId: string }
  | { kind: 'startTween'; nodeId: string }
  /** The value is in the variable's own kind; `addVar` below stays arithmetic. */
  | { kind: 'setVar'; variableId: string; value: VariableValue }
  | { kind: 'addVar'; variableId: string; by: number };

/** Every action kind, for the inspector's picker. */
export const RULE_ACTION_KINDS: readonly RuleAction['kind'][] = [
  'destroy',
  'setVisible',
  'setText',
  'playSound',
  'stopSound',
  'playAnimation',
  'startTween',
  'setVar',
  'addVar',
  'startScene',
  'restartScene',
];

/** Every trigger kind, for the inspector's picker. */
export const RULE_TRIGGER_KINDS: readonly RuleTrigger['kind'][] = [
  'sceneStart',
  'collide',
  'tap',
  'keyDown',
  'timer',
];

/**
 * One rule: a moment, a gate, and a list of verbs.
 *
 * The conditions are **one gate on the whole list**, read once, at the moment —
 * not a branch inside it. And the actions are a list, never a program: no order
 * that depends on a result, no value that depends on a value, no nesting. That
 * second half is what refuses OR, `onComplete`, arithmetic and callback
 * parameters in one breath.
 */
export interface SceneRule {
  /**
   * Its own identity, for a `SceneCollider`'s reason: a rule is edited and
   * removed individually, and an index does not survive undo rebuilding the
   * array. It is also what the conditions and actions inside it are keyed by,
   * since they have none of their own.
   */
  id: string;
  /** Free user text, shown on the panel and emitted as a comment. */
  name: string;
  when: RuleTrigger;
  conditions: RuleCondition[];
  do: RuleAction[];
}

/** The smallest timer delay a rule may ask for, in milliseconds. */
const MIN_TIMER_DELAY = 1;

/**
 * This scene's rules, validated against the project and the scene they belong
 * to.
 *
 * The `guidesOf` / `soundsOf` / `collidersOf` / `cameraOf` / `tileMapOf` family,
 * answering six questions at once: is there a list, is each row well formed,
 * does the trigger name a moment this scene can deliver, does every reference
 * name something that still exists *at the top level*, does every condition read
 * a variable the project holds, and is there anything left to do.
 *
 * **The policy is deliberately not uniform, and the sentence underneath it had
 * never needed saying before:**
 *
 * > A repair may narrow what the document says. It may never widen it.
 *
 * Every reader in this file has only ever narrowed. `soundsOf` clamps a volume,
 * `cameraOf` repairs a zoom, `tileMapOf` drops a tile the tileset has not got,
 * `collidersOf` drops a row, `physicsOf` and `controlsOf` strip a body from a
 * nested node. It never had to be said, because until now nothing in this
 * document *could* be widened by a repair. A dropped **condition** is the first
 * thing that can: `if score >= 10` removed is not a rule that does less, it is a
 * rule that now fires **always**. So a condition naming a variable the project
 * has not got costs the whole rule, where an action naming a missing node costs
 * only that action.
 *
 * A dangling variable in an **action** costs the whole rule too, and that is the
 * same argument reaching one step further. A variable is the one thing a rule
 * names that *another rule reads*: drop an `addVar` and every condition
 * elsewhere in the project goes on testing a number that was supposed to have
 * moved, silently. `destroy` has no such reach, so it goes alone.
 *
 * **A variable's kind is read the same way, and that is the same sentence a
 * third time.** A condition comparing text with `>`, a condition whose comparand
 * is not the kind the variable holds, a `setVar` writing a number into a piece of
 * text, an `addVar` on one: every one costs the whole rule. None of them is
 * repairable — coercing `"3"` to `3` *invents* a comparison, and dropping a
 * `setVar` leaves the project testing a value nothing writes. A `setText` is the
 * other side of it: its node costs only the action, because a node reaches
 * nothing outside the rule, while its variable costs the rule.
 *
 * The trigger/action asymmetry follows from what each one *is*: a trigger is a
 * moment and there is exactly one, so an unknown kind leaves nothing to attach
 * to; an action is one line of a list the rest of which still means something,
 * and the empty-`do` check below catches the case where it was the only one.
 * That is `tweenOf`'s "an unknown ease is repaired, an empty `to` is not",
 * inverted.
 *
 * **Top-level only, and the reason is not `physicsOf`'s.** A body is banned
 * inside a container because it reads world coordinates; a rule is banned there
 * because `buildCreateBody`'s bindings map is keyed off `scene.children`, so a
 * nested node has no binding for an action to name — and because a prefab
 * definition's children share their node ids across every placement, so
 * `destroy` could not say *which* coin. That is `containerBounds`' "two coins on
 * screen would fight over one map entry", arriving in the document.
 *
 * A fresh array every call, exactly as `collidersOf` builds one — so
 * `useEditorStore((s) => rulesOf(...))` compares unequal on every store change
 * and loops forever (React error #185). The `tileMapOf` trap, tenth time. Select
 * the project and derive outside the selector.
 */
export function rulesOf(project: Project, scene: SceneDoc): SceneRule[] {
  if (!Array.isArray(scene.rules)) return [];

  // Only the scene's own children, which is how the top-level rule is inherited
  // rather than repeated — `touchZonesOf` reading `scene.children` alone.
  const byId = new Map<string, GameObjectNode>();
  for (const child of scene.children) byId.set(child.id, child);
  const colliders = collidersOf(scene);
  const sounds = new Set(soundsOf(project, scene).map((sound) => sound.id));
  const scenes = new Set(project.scenes.map((entry) => entry.id));
  const matter = scenePhysicsOf(scene).engine === 'matter';

  const rules: SceneRule[] = [];
  const seen = new Set<string>();
  for (const candidate of scene.rules) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const row = candidate as Partial<SceneRule>;
    if (typeof row.id !== 'string' || !row.id) continue;
    // De-duplicated for `tileMapOf`'s layer-id reason: a repeated id would have
    // a press on one row edit another, and React would key two rows the same.
    if (seen.has(row.id)) continue;

    const when = ruleTriggerOf(row.when, byId, colliders, matter);
    if (when === null) continue;

    const conditions = ruleConditionsOf(row.conditions, project);
    if (conditions === null) continue;

    const actions = ruleActionsOf(row.do, byId, sounds, scenes, project);
    // A rule with nothing left to do is a real listener running an empty
    // callback, which is indistinguishable from the feature being broken —
    // `tweenOf`'s empty-`to` refusal, one level up.
    if (actions.length === 0) continue;

    seen.add(row.id);
    rules.push({
      id: row.id,
      name: typeof row.name === 'string' ? row.name : 'Rule',
      when,
      conditions,
      do: actions,
    });
  }
  return rules;
}

/** The trigger half of `rulesOf`, or null when the whole rule has to go. */
function ruleTriggerOf(
  raw: unknown,
  byId: Map<string, GameObjectNode>,
  colliders: SceneCollider[],
  matter: boolean,
): RuleTrigger | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const when = raw as Partial<RuleTrigger> & Record<string, unknown>;

  switch (when.kind) {
    case 'sceneStart':
      return { kind: 'sceneStart' };

    case 'collide': {
      const aId = typeof when.aId === 'string' ? when.aId : '';
      const bId = typeof when.bId === 'string' ? when.bId : '';
      if (!aId || !bId || aId === bId) return null;
      if (!byId.has(aId) || !byId.has(bId)) return null;
      if (matter) {
        // Matter needs no collider row, and the reason is better than "the two
        // engines differ". `collidersOf` answers [] for Matter *because* Matter
        // already collides everything with everything, so a row saying "these
        // two meet" says nothing it has not done. That argument does not
        // transfer by a single word: "when these two touch, *do this*" is
        // something Matter does not do on its own at all. So this is the one
        // place a Matter scene needs more emitted code than an Arcade one.
        //
        // A tilemap is refused here, though: a TilemapLayer is not a Matter
        // body unless `convertTilemapLayer` is called, and this exporter never
        // emits one.
        if (byId.get(aId)?.type === 'tilemap' || byId.get(bId)?.type === 'tilemap') {
          return null;
        }
        return { kind: 'collide', aId, bId };
      }
      // Arcade's handler *is* the third argument of the `add.collider` call the
      // row already emits, so a rule changes that line rather than adding one —
      // two calls on one pair would separate twice. Binding to the row is also
      // what keeps one notion of what collides, and what lets the rule inherit
      // the row's own `collide`/`overlap` word rather than inventing a
      // parameter of its own.
      const paired = colliders.some(
        (row) =>
          (row.aId === aId && row.bId === bId) || (row.aId === bId && row.bId === aId),
      );
      return paired ? { kind: 'collide', aId, bId } : null;
    }

    case 'tap': {
      const nodeId = typeof when.nodeId === 'string' ? when.nodeId : '';
      const node = byId.get(nodeId);
      if (!node || !TAPPABLE_TYPES.has(node.type)) return null;
      return { kind: 'tap', nodeId };
    }

    case 'keyDown': {
      const key = typeof when.key === 'string' ? when.key : '';
      // The allowlist, and it costs the rule rather than being repaired: a key
      // resolved to some other key is a game that does the wrong thing, and a
      // key left as typed is a listener that never fires and says nothing.
      return RULE_KEYS.includes(key) ? { kind: 'keyDown', key } : null;
    }

    case 'timer': {
      const delay = Number(when.delay);
      // Repaired rather than dropped, which is `tweenOf`'s treatment of a
      // duration: a rate is a number with a sensible floor, where a gate is not.
      //
      // The floor is the whole of the protection against the one thing in this
      // vocabulary that can run away: a looping timer at 0ms fires on every
      // step of the game loop, and under `addVar` that is a counter in the
      // thousands within a second.
      return {
        kind: 'timer',
        delay: Number.isFinite(delay) ? Math.max(MIN_TIMER_DELAY, delay) : 1000,
        loop: when.loop === true,
      };
    }

    default:
      return null;
  }
}

/** The condition half of `rulesOf`, or null when the whole rule has to go. */
function ruleConditionsOf(raw: unknown, project: Project): RuleCondition[] | null {
  // Absent means "no checks", which is what every rule the editor writes with
  // an empty list already means.
  if (raw === undefined || raw === null) return [];
  // *Present and not a list* is a different thing entirely, and it costs the
  // rule. Reading `conditions: "score > 10"` as "no conditions" would turn a
  // gated rule into an unconditional one — the widening this whole function is
  // organised around, arriving through the one door that looks like a
  // formality. Only a hand-edited file can hold it.
  if (!Array.isArray(raw)) return null;

  const conditions: RuleCondition[] = [];
  for (const candidate of raw) {
    if (typeof candidate !== 'object' || candidate === null) return null;
    const row = candidate as Partial<RuleCondition>;
    // Every one of these costs the whole rule rather than the condition,
    // because dropping a condition *widens* what the rule says — see `rulesOf`.
    if (typeof row.variableId !== 'string') return null;
    const variable = findVariable(project, row.variableId);
    if (variable === undefined) return null;
    if (row.op === undefined || !RULE_OPERATORS.includes(row.op)) return null;

    // The comparand is read in the variable's own kind, and a mismatch costs the
    // rule for the widening reason again: `"3" >= 3` is a test JavaScript will
    // happily perform and nobody wrote, and dropping the gate instead would have
    // the rule fire always. Coercing is refused for the same reason — a repair
    // that *invents* a comparison is a repair that widens.
    const kind = variableKindOf(variable);
    if (kind === 'text') {
      if (typeof row.value !== 'string') return null;
      // Only equality means anything about text. An ordering operator is
      // refused rather than repaired to `eq`, because `eq` is a different test
      // from the one on the row and nobody asked for it.
      if (row.op !== 'eq' && row.op !== 'ne') return null;
      conditions.push({ variableId: row.variableId, op: row.op, value: row.value });
      continue;
    }
    if (typeof row.value !== 'number' || !Number.isFinite(row.value)) return null;
    conditions.push({ variableId: row.variableId, op: row.op, value: row.value });
  }
  return conditions;
}

/** The action half of `rulesOf`. A bad action costs itself and nothing else. */
function ruleActionsOf(
  raw: unknown,
  byId: Map<string, GameObjectNode>,
  sounds: Set<string>,
  scenes: Set<string>,
  project: Project,
): RuleAction[] {
  if (!Array.isArray(raw)) return [];

  const actions: RuleAction[] = [];
  for (const candidate of raw) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const row = candidate as Partial<RuleAction> & Record<string, unknown>;
    const nodeId = typeof row.nodeId === 'string' ? row.nodeId : '';
    const variableId = typeof row.variableId === 'string' ? row.variableId : '';

    switch (row.kind) {
      case 'restartScene':
        actions.push({ kind: 'restartScene' });
        break;

      case 'startScene': {
        const sceneId = typeof row.sceneId === 'string' ? row.sceneId : '';
        // `scene.start(undefined)` is not something Phaser can be asked for.
        if (scenes.has(sceneId)) actions.push({ kind: 'startScene', sceneId });
        break;
      }

      case 'destroy':
        if (byId.has(nodeId)) actions.push({ kind: 'destroy', nodeId });
        break;

      case 'setVisible':
        if (byId.has(nodeId)) {
          actions.push({ kind: 'setVisible', nodeId, visible: row.visible === true });
        }
        break;

      case 'setText': {
        // Only a `Text` has `setText`, which is a fact about Phaser rather than
        // a list that can go stale — `playAnimation`'s sprite check to the
        // character, and the reason there is no `TEXT_TYPES` beside
        // `TAPPABLE_TYPES` for one entry.
        if (byId.get(nodeId)?.type !== 'text') break;
        // Free text with nothing to repair it to, so a non-string costs the
        // action. A node has no reach beyond the rule that names it.
        if (typeof row.text !== 'string') break;
        // **Absent and empty are one state — "just this caption" — and the test
        // has to come before `findVariable`.** The `variableId` local above
        // reads a missing field as `''`, which `findVariable` answers
        // `undefined` for; reusing it here would take the whole rule with every
        // plain label in the project. The trap is invisible on a document the
        // editor writes, because the panel writes `undefined`.
        if (variableId === '') {
          actions.push({ kind: 'setText', nodeId, text: row.text });
          break;
        }
        // A dangling variable costs the whole *rule*, `setVar`'s rule and for
        // its reason: a variable is the one thing a rule names that another
        // rule reads — and this is the first action that *reads* one, so a
        // caption whose value is gone goes on claiming to show a number the
        // project has not got.
        if (findVariable(project, variableId) === undefined) return [];
        actions.push({ kind: 'setText', nodeId, text: row.text, variableId });
        break;
      }

      case 'playSound':
      case 'stopSound': {
        const soundId = typeof row.soundId === 'string' ? row.soundId : '';
        if (sounds.has(soundId)) actions.push({ kind: row.kind, soundId });
        break;
      }

      case 'playAnimation': {
        const animationId = typeof row.animationId === 'string' ? row.animationId : '';
        // Only a sprite carries an AnimationState, which is a fact about Phaser
        // rather than a list that can go stale — `collectAnimations`' own note.
        if (byId.get(nodeId)?.type !== 'sprite') break;
        if (findAnimation(project, animationId) === undefined) break;
        actions.push({ kind: 'playAnimation', nodeId, animationId });
        break;
      }

      case 'startTween':
        // A tween that drives nothing is one `tweenOf` already answers null
        // for, so an action to start it would emit a handle nothing bound.
        if (byId.has(nodeId) && tweenOf(byId.get(nodeId) as GameObjectNode) !== null) {
          actions.push({ kind: 'startTween', nodeId });
        }
        break;

      case 'setVar':
      case 'addVar': {
        // A dangling variable costs the whole *rule*, not the action — see
        // `rulesOf`. Answered by returning an empty list so the caller drops it.
        const variable = findVariable(project, variableId);
        if (variable === undefined) return [];
        const text = variableKindOf(variable) === 'text';

        if (row.kind === 'addVar') {
          // `registry.inc` on a piece of text is arithmetic on text, so adding
          // to a text variable is refused — and it costs the whole rule, by the
          // reach argument above: an `addVar` dropped on its own leaves every
          // condition in the project testing a value that was supposed to have
          // moved.
          if (text) return [];
          if (typeof row.by !== 'number' || !Number.isFinite(row.by)) break;
          actions.push({ kind: 'addVar', variableId, by: row.by });
          break;
        }

        // A value of the wrong kind is the same reach again: setting a score to
        // `"ten"` is not a thing to repair, and dropping the action alone would
        // leave the rest of the project testing a number nothing writes.
        if (text) {
          if (typeof row.value !== 'string') return [];
          actions.push({ kind: 'setVar', variableId, value: row.value });
          break;
        }
        if (typeof row.value !== 'number') return [];
        // A non-finite number costs the action, because a repair to zero is an
        // action that quietly does nothing.
        if (!Number.isFinite(row.value)) break;
        actions.push({ kind: 'setVar', variableId, value: row.value });
        break;
      }

      default:
        break;
    }
  }
  return actions;
}

/**
 * The validated rules that name this node, in document order.
 *
 * `rulesOf` filtered, never `scene.rules` read a second time — the whole point
 * of that function being the only reader is that a rule it has dropped cannot
 * come back to life on some other panel. `collidersNaming`'s rule, and
 * `touchZonesOf`-on-`controlsOf`'s reason.
 *
 * It matches a node named in the **trigger or in any action**, because both are
 * reasons a person standing on that object's panel would want to know a rule
 * exists.
 *
 * A fresh array every call ⇒ React error #185 in a selector, the `tileMapOf`
 * trap for the eleventh time.
 */
export function rulesNaming(
  project: Project,
  scene: SceneDoc,
  nodeId: string,
): SceneRule[] {
  return rulesOf(project, scene).filter((rule) => ruleNames(rule, nodeId));
}

/** Whether one rule names a node, in its trigger or in any of its actions. */
export function ruleNames(rule: SceneRule, nodeId: string): boolean {
  const when = rule.when;
  if (when.kind === 'tap' && when.nodeId === nodeId) return true;
  if (when.kind === 'collide' && (when.aId === nodeId || when.bId === nodeId)) return true;
  return rule.do.some(
    (action) => 'nodeId' in action && action.nodeId === nodeId,
  );
}

/** Whether one rule reads or writes a variable, in a condition or an action. */
export function ruleUsesVariable(rule: SceneRule, variableId: string): boolean {
  if (rule.conditions.some((condition) => condition.variableId === variableId)) return true;
  return rule.do.some(
    (action) => 'variableId' in action && action.variableId === variableId,
  );
}

/**
 * A number or a piece of text the game keeps, declared once and shared by every
 * scene.
 *
 * Project-level for the reason `animations` and `prefabs` are, with one
 * addition that settles it on its own: a variable has to survive
 * `scene.start`, which is itself one of the things a rule can do. It is
 * emitted through Phaser's `this.registry` — the game-wide `DataManager`,
 * which is the only store that outlives a change of scene. `this.data` is the
 * per-scene one and would silently reset on every restart, which for a score
 * is the whole of what a score is not.
 *
 * `value` is the *initial* value and nothing else. The exported helper sets it
 * with a `has(key) ||` guard, so it is applied once per game rather than once
 * per `create()` — the `anims.exists` and `sound.get(key) ??` guard for the
 * third time, and for their reason: `create()` runs again every time a scene
 * starts, which is the ordinary way a game returns to its menu. That guard is
 * also the strictly more expressive choice, which is what settles it. The
 * document can already say "reset this when the level starts", because
 * `sceneStart -> setVar score 0` is two things it already holds; unguarded, it
 * could not say *don't*.
 *
 * The name is free user text and the registry key is derived from it at export
 * time, never stored — `audioKeyOf`'s treatment rather than `FontAsset.family`'s,
 * and the test CLAUDE.md already states is the one that decides between them:
 * a family *is* the link, so it must be stable for the life of the project,
 * while nothing in this document ever names a registry key. Conditions and
 * actions name `id`. That is what keeps renaming free.
 *
 * **A variable holds a number or a piece of text, and its kind is the *type of
 * its value* rather than a field beside it.** One field, for the reason a sprite
 * has no width of its own and a tilemap no tile size: two fields answering one
 * question is how they come to disagree, and a `kind: 'text'` over a `value: 0`
 * is a variable the panel and the emit would describe differently. `atlasOf`'s
 * tie-break needed a rule because an image can be cut two ways at once; a value
 * cannot be two types at once, so there is nothing here to break a tie between.
 *
 * Text arrives with `setText` rather than before it, which is the sequencing
 * CLAUDE.md already argued: the only thing anybody wants a text variable for is
 * a name to *show*, and a variable nothing can display is a variable with no use.
 */
export interface ProjectVariable {
  id: string;
  /** Free user text. `variableKeyOf` derives the registry key from it. */
  name: string;
  /** The value the game starts with, set once rather than once per scene. */
  value: VariableValue;
}

/** What a variable, a condition's comparand and a `setVar`'s target all hold. */
export type VariableValue = number | string;

/** Which of the two a variable holds, derived from the value and never stored. */
export type VariableKind = 'number' | 'text';

/** Both kinds, for the panel's picker. */
export const VARIABLE_KINDS: readonly VariableKind[] = ['number', 'text'];

/**
 * Which kind a variable holds.
 *
 * The only reader of a value's *type*, so the panel, the condition's field, the
 * reader's refusals and the emit cannot disagree about what a variable is — the
 * `guidesOf` / `frameGridOf` / `tweenOf` family's argument for a one-line
 * function. It answers `'number'` for anything that is not a string, which is
 * also what a hand-edited file holding `null` should read as: `parseVariables`
 * has already repaired that to `0` on the way in.
 */
export function variableKindOf(variable: ProjectVariable): VariableKind {
  return typeof variable.value === 'string' ? 'text' : 'number';
}

/**
 * One value, read as the other kind.
 *
 * The one converter, read by the variables row, a condition's variable picker
 * and a `setVar`'s — so switching a kind means one thing everywhere. A number
 * that a piece of text does not describe lands on `0` rather than on `NaN`,
 * which is `parseVariables`' own repair and for its reason: `NaN` is a value
 * every comparison answers false to, with nothing saying why.
 */
export function coerceVariableValue(value: VariableValue, kind: VariableKind): VariableValue {
  if (kind === 'text') return typeof value === 'string' ? value : String(value);
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface Project {
  schemaVersion: number;
  name: string;
  /** Recorded so a future exporter can tell which Phaser API to emit. */
  phaserVersion: string;
  /**
   * Images, shared across every scene. Project-level rather than per-scene so
   * that one import can back sprites in several scenes without duplicating the
   * bytes — the single largest thing in the file.
   */
  assets: ImageAsset[];
  /**
   * Sounds, shared across every scene for the reason the images are: two levels
   * playing one theme should carry its bytes once, and those bytes are the
   * largest thing in the file after the images.
   *
   * What a scene holds is a `SceneSound` pointing in here by id, which is the
   * `animations` arrangement rather than the `assets` one — a sound is tuned
   * per scene (a menu's theme is quieter than a boss fight's) while the file it
   * plays is the same file.
   */
  audio: AudioAsset[];
  /**
   * Fonts, shared across every scene for the reason the images and sounds are.
   *
   * What a text node holds is not a pointer in here at all: it names a
   * `family`, which is the same field it has always used to name Georgia. That
   * is the whole design — see `FontAsset` — and it is why this table has no
   * per-node or per-scene companion the way `audio` has `SceneSound`. A font is
   * not tuned; it is either the family a node names or it is not.
   */
  fonts: FontAsset[];
  /**
   * Animations, shared across every scene exactly as the assets they read are.
   *
   * A separate table rather than a field on the asset because a clip is
   * removed, renamed and re-pointed on its own, and because the exporter emits
   * only the clips a scene actually plays — which is a filter over a list, not
   * a walk into every asset.
   */
  animations: AnimationClip[];
  /**
   * Prefab definitions, shared across every scene as the assets and clips are.
   *
   * The single copy is the point: an `instance` node in a scene stores only an
   * id into this table, so editing an entry here changes every placement of it
   * everywhere at once. Nothing propagates, because nothing was ever copied.
   */
  prefabs: Prefab[];
  /**
   * The numbers the game keeps, shared across every scene.
   *
   * Project-level rather than per-scene because a variable has to survive
   * `scene.start` — see `ProjectVariable`. That is a stronger reason than the
   * one the tables above it have: an image is shared because copying the bytes
   * would be wasteful, where a score shared per scene would not be a score.
   */
  variables: ProjectVariable[];
  scenes: SceneDoc[];
  activeSceneId: string;
}

export function findAsset(
  project: Project,
  id: string | null | undefined,
): ImageAsset | undefined {
  return id ? project.assets.find((asset) => asset.id === id) : undefined;
}

export function findAudio(
  project: Project,
  id: string | null | undefined,
): AudioAsset | undefined {
  return id ? project.audio.find((asset) => asset.id === id) : undefined;
}

/**
 * The variable an id names, if the project still holds it.
 *
 * The `findAsset` / `findAudio` / `findAnimation` row. Every caller treats
 * `undefined` as "this rule names a variable the project has not got", which
 * `rulesOf` answers by dropping the whole rule rather than the part — see the
 * widening argument there.
 */
export function findVariable(
  project: Project,
  id: string | null | undefined,
): ProjectVariable | undefined {
  return id ? project.variables.find((variable) => variable.id === id) : undefined;
}

/**
 * The imported font a family names, if any.
 *
 * The `findAsset` / `findAudio` / `findAnimation` row, and **the only one keyed
 * by something other than an id** — because a text node names a font rather
 * than pointing at one. There is deliberately no `findFont(project, id)` beside
 * it: nothing in the document holds a font id, so a by-id finder would have no
 * caller and would imply a kind of reference this design does not have.
 *
 * A family matching nothing is not a failure. It is `system-ui`, or `Georgia`,
 * or a font the project no longer carries — all of which mean the same thing to
 * a browser and are drawn the same way, which is what makes "no font chosen",
 * "the font is gone" and "an ordinary system family" one state and one code
 * path.
 */
export function fontByFamily(
  project: Project,
  family: string | null | undefined,
): FontAsset | undefined {
  return family ? project.fonts.find((asset) => asset.family === family) : undefined;
}

export function findAnimation(
  project: Project,
  id: string | null | undefined,
): AnimationClip | undefined {
  return id ? project.animations.find((clip) => clip.id === id) : undefined;
}

export function findPrefab(
  project: Project,
  id: string | null | undefined,
): Prefab | undefined {
  return id ? project.prefabs.find((prefab) => prefab.id === id) : undefined;
}

/** Whether this subtree places a prefab anywhere inside it. */
export function containsInstance(nodes: GameObjectNode[]): boolean {
  return nodes.some(
    (node) => node.type === 'instance' || containsInstance(node.children),
  );
}

/**
 * The children an instance node draws, or an empty list.
 *
 * The only place `InstanceProps.prefabId` is ever dereferenced — the job
 * `guidesOf` does for a scene's guides and `frameGridOf` does for an asset's
 * sheet. Being the single reader means no caller can check "is the prefab
 * there" and forget "are its children an array", and the dangling case has one
 * answer instead of one per call site.
 *
 * A missing definition draws an empty instance rather than throwing, the
 * treatment a sprite whose image is gone already gets: one unreadable reference
 * should not cost the user the rest of the scene.
 *
 * **It also strips any instance out of what it returns, recursively, and that
 * is the whole of the cycle story.** A prefab containing an instance of itself
 * is two id strings and an infinite recursion in the renderer and the exporter
 * both, and a hand-edited file can hold one whatever the store refuses to
 * build. Answering with a tree that contains no instances at all means nothing
 * downstream needs a depth cap, a visited set or a termination argument — the
 * recursion is finite because the data handed to it is. The store refuses to
 * *create* a nested definition for the same reason, so this only ever fires on
 * a file the editor did not write.
 *
 * The definition's own array comes back by identity when there was nothing to
 * strip, which is every sync of every well-formed project.
 */
export function prefabChildrenOf(
  project: Project,
  node: GameObjectNode,
): GameObjectNode[] {
  if (node.type !== 'instance') return [];
  const prefab = findPrefab(project, node.props.prefabId);
  if (!Array.isArray(prefab?.children)) return [];
  return withoutInstances(prefab.children);
}

function withoutInstances(nodes: GameObjectNode[]): GameObjectNode[] {
  if (!containsInstance(nodes)) return nodes;
  return nodes
    .filter((node) => node.type !== 'instance')
    .map((node) => ({ ...node, children: withoutInstances(node.children) }));
}

/** An empty cell, which is Phaser's own value for one. */
export const EMPTY_TILE = -1;

/**
 * The most tiles a map may be across or down.
 *
 * A bound rather than a preference: history is whole-project snapshots, the
 * document is a file the user carries around, and 256x256 is 65,536 numbers per
 * map already. Phaser's own GPU layer stops at 4096, which is four hundred times
 * the JSON this editor should ever be asked to hold in a browser tab.
 */
export const MAX_TILEMAP_SIDE = 256;

/**
 * The id the pre-v12 single grid migrates to.
 *
 * A constant rather than a fresh one per call: `tileMapOf` runs on every render
 * and every sync, and React keys and the store's `activeLayerId` both hold this
 * string — a new id each time would re-mount the row and lose the selection.
 */
export const LEGACY_LAYER_ID = 'base';

/** The tile size a map is drawn at while it has no usable tileset. */
export const FALLBACK_TILE = 32;

/** One cell of a tilemap, in tile coordinates rather than pixels. */
export interface TileCell {
  column: number;
  row: number;
}

/** A tilemap as it can actually be drawn, however the document says it. */
/** One layer of a `TileMap`, resolved and safe to hand to Phaser. */
export interface TileLayer {
  id: string;
  name: string;
  visible: boolean;
  /** Exactly `columns * rows` entries, each `-1` or a frame the tileset has. */
  data: number[];
  /**
   * The solid frame indices, ascending and deduplicated, every one of them a
   * frame the tileset actually has.
   */
  collides: number[];
}

export interface TileMap {
  /** The tileset image, or undefined when there is none to draw. */
  asset: ImageAsset | undefined;
  tileWidth: number;
  tileHeight: number;
  columns: number;
  rows: number;
  /** Back to front, and never empty: a map always has at least one layer. */
  layers: TileLayer[];
  /** How many distinct tiles the tileset offers; never zero. */
  tileCount: number;
}

/**
 * A tilemap node's props, resolved against the project and made usable.
 *
 * The only reader of `TilemapProps`, in the family `frameGridOf`, `guidesOf` and
 * `prefabChildrenOf` belong to, and for the sharpest version of their reason:
 * every consumer here would otherwise have to ask seven separate questions — is
 * there a tileset, how big is a tile, does this map have layers at all or is it
 * a file written before they existed, is each layer's `data` the length the grid
 * says, is every entry a frame that exists, is every solid index one too, and is
 * every layer id usable — and any one of them forgotten is a Phaser warning and
 * a missing-texture cell. Answering all seven in one call means the renderer,
 * the exporter, the palette and the paint gesture cannot disagree.
 *
 * The padding and truncation are the hand-edited-file backstop, not the resize
 * path: `resizeTilemap` re-shapes the array row by row, because reinterpreting a
 * flat array under a new column count shifts every row after the first. What
 * arrives here has already been re-shaped, or was never written by this editor.
 *
 * A tile the tileset does not have reads as *empty*, not as the nearest one it
 * does. That is the opposite of `resolveFrame`, deliberately: a sprite has no way
 * to show "no frame", so clamping is the only answer there, while `-1` is a
 * first-class value here and Phaser's own. It is also what lets a re-cut leave
 * the document alone — the map goes blank while the sheet is mid-edit and comes
 * back whole the moment the numbers are right again, where rewriting the stored
 * indices would have thrown the level away over a mistyped margin.
 *
 * Each layer's `data` and `collides` keep their identity when the document's
 * arrays are already well formed, so a sync that changes nothing allocates
 * nothing. That is what `EditorScene.applyNode`'s per-layer tile diff and
 * `drawPaintGrid`'s signature gate both read: a fresh array every call would
 * re-put all 65,536 tiles on every store change. The layer objects and the
 * layer array itself are fresh per call and nothing compares those — which is
 * also why `useEditorStore((s) => tileMapOf(...))` is React error #185, the
 * trap this function has carried since iteration 14.
 */
export function tileMapOf(project: Project, props: TilemapProps): TileMap {
  const asset = findAsset(project, props.assetId);
  const grid = frameGridOf(asset);
  const tileCount = frameCountOf(asset);

  const side = (value: number) =>
    Number.isFinite(value) ? Math.min(Math.max(1, Math.floor(value)), MAX_TILEMAP_SIDE) : 1;
  const columns = side(props.columns);
  const rows = side(props.rows);

  const size = columns * rows;
  const clamp = (value: number) => {
    const tile = Math.floor(value);
    return Number.isFinite(tile) && tile >= 0 && tile < tileCount ? tile : EMPTY_TILE;
  };

  // The migration, and the only place the pre-v12 shape is read. A file written
  // before layers existed has its one grid become `Layer 1` under a constant id,
  // because a derived id has to be stable across calls: React keys and the
  // store's `activeLayerId` both hold it.
  const source: TilemapLayerDoc[] =
    Array.isArray(props.layers) && props.layers.length > 0
      ? props.layers
      : [
          {
            id: LEGACY_LAYER_ID,
            name: 'Layer 1',
            visible: true,
            data: Array.isArray(props.data) ? props.data : [],
            ...(Array.isArray(props.collides) ? { collides: props.collides } : {}),
          },
        ];

  // Ids are made unique here rather than trusted: they are React keys and the
  // store's `activeLayerId`, so a hand-edited file repeating one would have a
  // press on one row edit another. The editor cannot write a repeat.
  const seen = new Set<string>();
  const layers = source.map((layer, index) => {
    const rawData = Array.isArray(layer.data) ? layer.data : [];
    let data = rawData;
    if (rawData.length !== size || rawData.some((tile) => clamp(tile) !== tile)) {
      data = Array.from({ length: size }, (_, cell) => clamp(rawData[cell]));
    }

    // A solid index the tileset does not have is dropped rather than clamped, for
    // the reason an out-of-range tile reads as empty: a re-cut must be able to
    // blank the answer and give it back whole, not rewrite what the user marked
    // over a mistyped margin. Sorted and deduplicated here so that `setCollision`
    // is emitted the same way whatever order the file listed them in.
    const rawSolid = Array.isArray(layer.collides) ? layer.collides : [];
    const solid = new Set<number>();
    for (const value of rawSolid) {
      const tile = Math.floor(value);
      if (Number.isFinite(tile) && tile >= 0 && tile < tileCount) solid.add(tile);
    }
    const sorted = [...solid].sort((a, b) => a - b);
    const collides =
      rawSolid.length === sorted.length && sorted.every((tile, cell) => rawSolid[cell] === tile)
        ? rawSolid
        : sorted;

    let id = typeof layer.id === 'string' && layer.id ? layer.id : `${LEGACY_LAYER_ID}-${index}`;
    while (seen.has(id)) id = `${id}-${index}`;
    seen.add(id);
    const name = typeof layer.name === 'string' && layer.name ? layer.name : `Layer ${index + 1}`;
    const visible = layer.visible !== false;
    return { id, name, visible, data, collides };
  });

  return {
    asset,
    tileWidth: grid ? grid.frameWidth : FALLBACK_TILE,
    tileHeight: grid ? grid.frameHeight : FALLBACK_TILE,
    columns,
    rows,
    layers,
    tileCount,
  };
}

/** A layer of a `TileMap` by id, or the frontmost when the id names nothing. */
export function tileLayerOf(map: TileMap, layerId: string | null): TileLayer {
  return map.layers.find((layer) => layer.id === layerId) ?? map.layers[map.layers.length - 1];
}

/** The clips that read a given sheet, which is what a sprite may choose from. */
export function animationsForAsset(
  project: Project,
  assetId: string | null | undefined,
): AnimationClip[] {
  return assetId ? project.animations.filter((clip) => clip.assetId === assetId) : [];
}

export const newId = (): string =>
  // randomUUID needs a secure context; file:// and some in-app browsers lack it.
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function findNode(
  nodes: GameObjectNode[],
  id: string,
): GameObjectNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findNode(node.children, id);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * The node holding `id`, or null when it sits at the top level of the scene.
 *
 * Null therefore also covers "no such node", which every caller here wants:
 * both cases mean "no parent to compose against".
 */
export function findParent(
  nodes: GameObjectNode[],
  id: string,
  parent: GameObjectNode | null = null,
): GameObjectNode | null {
  for (const node of nodes) {
    if (node.id === id) return parent;
    const hit = findParent(node.children, id, node);
    if (hit) return hit;
  }
  return null;
}

/**
 * The array `id` lives in — its parent's children, or the scene's own list.
 *
 * Draw order is array order at every level, so this is what raise, lower and
 * the tree's drag-to-reorder all work against.
 */
export function siblingsOf(root: GameObjectNode[], id: string): GameObjectNode[] {
  const parent = findParent(root, id);
  return parent ? parent.children : root;
}

/** True when `id` is `node` itself or anywhere beneath it. */
export function containsNode(node: GameObjectNode, id: string): boolean {
  return node.id === id || node.children.some((child) => containsNode(child, id));
}

/**
 * The transform a child of `parent` is composed against: position, rotation and
 * scale accumulated from the scene down.
 *
 * Phaser composes a Container's transform onto its children the same way, so
 * this is what lets the editor convert between a node's local coordinates and
 * where it actually is on the canvas.
 */
export function worldTransformOf(
  nodes: GameObjectNode[],
  id: string | null,
): Transform {
  if (!id) return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
  const parent = findParent(nodes, id);
  const node = findNode(nodes, id);
  if (!node) return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
  return composeTransform(worldTransformOf(nodes, parent?.id ?? null), node.transform);
}

/** Applies a parent transform to a local one, giving the world transform. */
export function composeTransform(parent: Transform, local: Transform): Transform {
  const angle = (parent.rotation * Math.PI) / 180;
  const x = local.x * parent.scaleX;
  const y = local.y * parent.scaleY;
  return {
    x: parent.x + x * Math.cos(angle) - y * Math.sin(angle),
    y: parent.y + x * Math.sin(angle) + y * Math.cos(angle),
    rotation: parent.rotation + local.rotation,
    scaleX: parent.scaleX * local.scaleX,
    scaleY: parent.scaleY * local.scaleY,
  };
}

/**
 * The inverse: the local transform a node needs under `parent` to stay exactly
 * where it is now. This is what keeps an object still on the canvas when it is
 * dragged into or out of a container.
 *
 * A parent that is both rotated and scaled unevenly composes a skew, which
 * neither this nor Phaser's own transform can represent; the position is still
 * exact and only the child's apparent proportions shift.
 */
export function localTransformIn(parent: Transform, world: Transform): Transform {
  const angle = (-parent.rotation * Math.PI) / 180;
  const dx = world.x - parent.x;
  const dy = world.y - parent.y;
  // A zero-scaled parent has collapsed its children to a point; there is no
  // local position that undoes that, so fall back to the parent's origin.
  const scaleX = parent.scaleX || 1;
  const scaleY = parent.scaleY || 1;
  return {
    x: (dx * Math.cos(angle) - dy * Math.sin(angle)) / scaleX,
    y: (dx * Math.sin(angle) + dy * Math.cos(angle)) / scaleY,
    rotation: world.rotation - parent.rotation,
    scaleX: world.scaleX / scaleX,
    scaleY: world.scaleY / scaleY,
  };
}
