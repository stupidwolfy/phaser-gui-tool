import { SCHEMA_VERSION, TARGET_PHASER_VERSION, type ValidationIssue } from '../core/schema';
import { SECTION_TITLE } from '../core/sections';

/**
 * Everything the Help dialog says, as plain data.
 *
 * Plain strings rather than JSX so that one function can search every word of
 * it, and so the suite can import it: `tests/help.spec.ts` checks the rendered
 * dialog against these tables rather than against a copy of them. Nothing here
 * reads the store or the document — Help describes the editor, not a project.
 */

export interface HelpTopic {
  id: string;
  title: string;
  /** Words a person might search for that the text does not happen to use. */
  keywords: string[];
  /** One entry per paragraph. */
  body: string[];
  /** A numbered list after the paragraphs, for topics that are a task. */
  steps?: string[];
}

/**
 * Every key the editor answers, in the order a person learns them.
 *
 * **The single source for the dialog, and the README table is kept to match it
 * by hand.** A key added to `App.tsx`'s `onKeyDown` belongs here in the same
 * change; `help.spec.ts` presses a sample of these to keep the two honest.
 */
export const SHORTCUTS: readonly { keys: string; does: string }[] = [
  { keys: '?', does: 'Open Help' },
  { keys: '/', does: 'Filter the scene tree' },
  { keys: 'Arrow keys', does: 'Nudge the selection 1px — hold Shift for 10px' },
  { keys: 'Delete / Backspace', does: 'Delete the selection' },
  { keys: 'Escape', does: 'Leave paint mode, otherwise deselect' },
  { keys: 'Ctrl/Cmd + A', does: 'Select every top-level object' },
  { keys: 'Ctrl/Cmd + G', does: 'Wrap the selection in a group' },
  { keys: 'Ctrl/Cmd + D', does: 'Duplicate the selection' },
  { keys: 'Ctrl/Cmd + C, V', does: 'Copy, paste' },
  { keys: 'Ctrl/Cmd + Z', does: 'Undo' },
  { keys: 'Ctrl/Cmd + Shift + Z', does: 'Redo' },
  { keys: 'Ctrl/Cmd + S', does: 'Save' },
  { keys: 'Ctrl/Cmd + O', does: 'Open a project' },
  { keys: '= or +', does: 'Zoom the view in' },
  { keys: '-', does: 'Zoom the view out' },
  { keys: '0', does: 'Zoom the view to 100%' },
  { keys: 'Shift + 1', does: 'Fit the scene to the view' },
];

export const HELP_TOPICS: readonly HelpTopic[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    keywords: ['add', 'object', 'rectangle', 'move', 'drag', 'touch', 'phone', 'basics', 'begin'],
    body: [
      'A project holds one or more scenes, and a scene holds objects. Add an object from the row of + buttons in the Scene panel; it lands in the middle of the scene and is selected.',
      'Drag an object on the canvas to move it, pull its corner handle to resize it and turn it with the knob above it. Every change can be undone.',
      'On a phone, the first tap on an object only selects it; drag it with a second touch. A fingertip covers enough of the screen that honouring the first touch as a drag would move whatever it grazed.',
      'The Properties panel edits whatever is selected. With nothing selected it edits the scene itself.',
    ],
  },
  {
    id: 'shortcuts',
    title: 'Keyboard shortcuts',
    keywords: ['keys', 'keyboard', 'hotkey', 'ctrl', 'cmd', 'shortcut', 'undo', 'redo', 'copy', 'paste', 'duplicate', 'nudge', 'zoom'],
    body: [
      'Shortcuts do nothing while you are typing in a field, and nothing while the game is playing: the game has the keyboard then, which is how a player-driven object reads the arrow keys. Stop is the way back.',
    ],
  },
  {
    id: 'saving',
    title: 'Saving and opening files',
    keywords: ['save', 'open', 'file', 'download', 'zip', 'autosave', 'draft', 'privacy', 'upload', 'device'],
    body: [
      'Projects are saved to your own device. Nothing is uploaded anywhere, and there are no accounts.',
      'In desktop Chrome and Edge, Save writes back to the same file. Everywhere else — including phones — Save downloads a .phaser.zip file, and Open uses a normal file picker.',
      'Images, sounds and fonts travel inside the project file, so a project opens the same on any machine. Older .phaser.json files still open; saving them again writes a .phaser.zip.',
      'The editor also keeps a draft of your work in this browser as you go. That draft is small (about 5 MB), so a project with large images may be too big for it — the editor says so when that happens. Save to a file to be sure.',
    ],
  },
  {
    id: 'export',
    title: 'Exporting to Phaser',
    keywords: ['export', 'code', 'typescript', 'javascript', 'html', 'ts', 'js', 'scene class', 'download', 'bundle', 'zip', 'vite', 'deploy', 'npm'],
    body: [
      'Export turns the project into real Phaser code. The .ts and .js files are Scene classes that drop into an existing Phaser project; the .html file is a complete game page that runs when opened in a browser.',
      'The .zip bundle is a whole project to keep building: a Vite project with the scenes as source, every image, sound and font as a file, and a README. Run npm install, then npm run dev to play it or npm run build for a minified site in dist/ that runs from any web host. Before it downloads, the bundle dialog lists every file, the total size and any warnings.',
      'Every scene is exported. The one you are looking at is the one the game starts on.',
      'On a phone the export buttons are in the File panel.',
    ],
  },
  {
    id: 'play-preview',
    title: 'Play game and Preview motion',
    keywords: ['play', 'run', 'test', 'preview', 'animate', 'stop', 'restart', 'game'],
    body: [
      'Play game runs the exported game over the editor, so you can try physics, controls, rules and camera effects without downloading anything. Stop returns to the editor with the project exactly as it was — nothing the game does is written back.',
      'Preview motion is different: it only animates the editor canvas — sprite animations, particle emitters and tweens — so you can watch them while you edit. It appears in the toolbar once the project has something that moves.',
      'Play starts fresh every time, so values the game remembers between plays are not kept here.',
    ],
  },
  {
    id: 'project-settings',
    title: 'Project settings',
    keywords: ['settings', 'project', 'game', 'start', 'boot', 'first scene', 'size', 'resolution', 'viewport', 'scale', 'scaling', 'fit', 'pixel', 'pixel art', 'blurry', 'smoothing', 'renderer', 'webgl', 'canvas', 'title'],
    body: [
      'Project settings describe the game as a whole rather than one scene. They sit at the top of the Properties panel when nothing is selected, and they apply to Play game and to every export alike.',
      'Start scene is the scene the game opens on. Left as "Scene being edited", the game starts wherever you were working, as it always has.',
      "Game size fixes the size of the game's canvas. Left as each scene's own size, the game takes the size of the scene it starts on. A fixed size also sizes the camera frame and the on-screen buttons in every scene.",
      'Scaling decides how the canvas fits a screen: Fit shows the whole game with bars around it, Fill covers the screen and crops the edges, and None draws it at its own size.',
      'Pixel art turns off smoothing on every image, so small sprites scaled up stay crisp. The canvas in the editor shows it too.',
      'Renderer is usually best left on Auto. Effects and masks need WebGL, so the Canvas renderer draws them as nothing, and the editor warns you about that.',
    ],
  },
  {
    id: 'selection-groups',
    title: 'Selecting, grouping and arranging',
    keywords: ['select', 'multi', 'multiple', 'group', 'container', 'order', 'front', 'back', 'layer', 'parent', 'tree', 'filter', 'search', 'find', 'expand', 'collapse'],
    body: [
      'Turn on Multi in the Scene panel and tap objects to build a selection, or Shift/Ctrl-click on a desktop. While Multi is on a press never moves anything; turn it off to drag what you picked.',
      'Group wraps the selection in a container. Everything inside a group moves with it. Select a group from the Scene panel, then drag any of its contents to move it.',
      'Draw order is the order of the Scene panel list: the first row is furthest back. Arrange in the Properties panel moves an object forward or back.',
      'To find an object in a long list, type part of its name or its type in the Scene panel filter, or press /. Matches are shown with the groups they sit in. Escape clears the filter. The buttons beside it expand or collapse every group, and selecting an object on the canvas opens the groups above its row.',
    ],
  },
  {
    id: 'snapping-guides',
    title: 'Snapping, grids, guides and aligning',
    keywords: ['snap', 'magnet', 'grid', 'guide', 'align', 'distribute', 'centre', 'center', 'spacing'],
    body: [
      'With the magnet on, a dragged object snaps to other objects’ edges and centres, to equal spacing in a row, and to the scene. The # button adds a grid; set its size under Snapping.',
      'Guides are lines of your own, saved with the scene. Add them under Guides, drag them on the canvas, and drag one off the scene to remove it.',
      'Align lines several selected objects up by their edges or centres, or centres one object in the scene.',
    ],
  },
  {
    id: 'assets',
    title: 'Images, animation, sound and fonts',
    keywords: ['image', 'sprite', 'sheet', 'frame', 'atlas', 'animation', 'clip', 'audio', 'sound', 'music', 'font', 'import'],
    body: [
      'Import an image into a sprite from its Image section. Slice it into a sprite sheet with a frame size, or attach a texture atlas from a packer such as TexturePacker, then pick the frame the sprite shows.',
      'An animation is a list of frames with a frame rate. Build one under Animation — "0-3, 7" picks and orders frames — and choose Preview motion to watch it.',
      'Sounds are added to a scene under Audio; fonts are imported from a text object’s font picker. All of them are stored inside the project file.',
    ],
  },
  {
    id: 'tilemaps',
    title: 'Tilemaps',
    keywords: ['tile', 'tilemap', 'tileset', 'paint', 'brush', 'layer', 'level', 'map', 'solid', 'wall'],
    body: [
      'A tilemap is painted from an image sliced into equal tiles. Pick that image as the tileset, press Edit tiles under Brush, and paint on the canvas. Escape or Done painting leaves paint mode.',
      'A map can have several layers, drawn back to front. Mark tiles as solid under Collision to make walls a player cannot walk through in the game.',
    ],
  },
  {
    id: 'particles-tweens',
    title: 'Particles and tweens',
    keywords: ['particles', 'emitter', 'effect', 'smoke', 'fire', 'tween', 'move', 'fade', 'follow', 'trail'],
    body: [
      'A particle emitter throws copies of an image. It is shown as a pink marker until Preview motion is on, because a canvas that keeps moving makes things hard to place.',
      'A tween moves an object’s position, angle, scale or alpha to a destination and back. Its destination is drawn as a dashed outline.',
      'Rules can start, stop or burst an emitter, and start a tween, at a moment in the game.',
    ],
  },
  {
    id: 'physics',
    title: 'Physics, collisions and controls',
    keywords: ['physics', 'body', 'gravity', 'arcade', 'matter', 'collide', 'collision', 'collider', 'controls', 'player', 'jump', 'platformer', 'keys'],
    body: [
      'Give a top-level object a body under Physics. Dynamic bodies fall and move; static bodies stay put and are good for floors and walls. Gravity belongs to the scene.',
      'The editor draws bodies but never runs them — try them with Play game. In Arcade physics, two bodies only stop each other when a collision says so: add one under Collides with, or the object falls straight through.',
      'A scene can use Matter physics instead, where bodies turn with their objects and everything collides with everything.',
      'Controls lets the arrow keys or WASD drive an object with a dynamic body, top-down or as a platformer, with optional on-screen buttons for phones.',
    ],
  },
  {
    id: 'rules-variables',
    title: 'Rules and variables',
    keywords: ['rule', 'event', 'trigger', 'when', 'action', 'variable', 'score', 'logic', 'timer', 'tap', 'spawn', 'destroy'],
    body: [
      'A rule says what happens at a moment: when the scene starts, when two objects collide, when an object is tapped, when a key is pressed, on a timer, or when a variable changes. Its conditions are checked then, and its actions run in order.',
      'Variables are numbers or text the whole game shares, such as a score. A text object can show one live, and a variable can be remembered between plays.',
      'Rules run only in the game. The editor never fires them, so use Play game to try them.',
    ],
  },
  {
    id: 'camera',
    title: 'The game camera',
    keywords: ['camera', 'scroll', 'zoom', 'follow', 'shake', 'fade', 'view', 'bounds'],
    body: [
      'Each scene has a camera: where it starts, how far it is zoomed, and what it follows. When it differs from the default the canvas draws the shot it opens on as a violet frame.',
      'The camera settings never change your view in the editor, and the editor’s zoom never changes the game’s camera.',
    ],
  },
  {
    id: 'effects',
    title: 'Effects, blend modes and scroll',
    keywords: ['effect', 'filter', 'glow', 'blur', 'shadow', 'pixelate', 'mask', 'blend', 'add', 'multiply', 'screen', 'parallax', 'hud', 'scroll factor'],
    body: [
      'Effects draw a glow, blur, drop shadow, pixelate or mask over an object, in the editor and in the game alike. They need WebGL.',
      'A blend mode sets how an object mixes with what is behind it.',
      'Scroll factor sets how far an object moves when the camera does: 0 keeps it on screen like a HUD, and values between 0 and 1 make a parallax background.',
    ],
  },
  {
    id: 'prefabs-scenes',
    title: 'Prefabs and scenes',
    keywords: ['prefab', 'reuse', 'instance', 'copy', 'scene', 'level', 'menu', 'duplicate'],
    body: [
      'Save a group as a prefab to place it as often as you like. Edit the prefab once and every placement changes. Manage prefabs in the Scene panel.',
      'Add scenes with + Scene and switch between them with the scene chips. Duplicate and delete the current scene from its own panel, with nothing selected.',
    ],
  },
  {
    id: 'validation',
    title: 'Errors and warnings',
    keywords: ['error', 'warning', 'issue', 'problem', 'blocked', 'validation', 'missing', 'broken'],
    body: [
      'Before saving, playing or exporting, the editor checks the project. Issues are listed at the bottom of the screen and marked on the section that holds them; press one to go to it.',
      'An error — a scene with no size, a number that is not a number — blocks Play game and export, because the game would not run.',
      'A warning — a missing image, a reference to something deleted, a malformed colour — does not block anything: the game still runs, and leaves that part out or uses a default.',
    ],
  },
];

/** Which topic explains the section with this title. Keyed by `Section` title. */
export const HELP_TOPIC_FOR_SECTION: Readonly<Record<string, string>> = {
  Snapping: 'snapping-guides',
  Guides: 'snapping-guides',
  Align: 'snapping-guides',
  Selection: 'selection-groups',
  Objects: 'selection-groups',
  Arrange: 'selection-groups',
  Parent: 'selection-groups',
  [SECTION_TITLE.container]: 'selection-groups',
  [SECTION_TITLE.sprite]: 'assets',
  'Sprite sheet': 'assets',
  Animation: 'assets',
  Audio: 'assets',
  [SECTION_TITLE.tilemap]: 'tilemaps',
  Tileset: 'tilemaps',
  Grid: 'tilemaps',
  Layers: 'tilemaps',
  Brush: 'tilemaps',
  Collision: 'tilemaps',
  [SECTION_TITLE.particles]: 'particles-tweens',
  Emission: 'particles-tweens',
  Particle: 'particles-tweens',
  Follow: 'particles-tweens',
  Tween: 'particles-tweens',
  Physics: 'physics',
  'Physics world': 'physics',
  Collisions: 'physics',
  'Collides with': 'physics',
  Controls: 'physics',
  Rules: 'rules-variables',
  Variables: 'rules-variables',
  'Project settings': 'project-settings',
  Camera: 'camera',
  Effects: 'effects',
  Blend: 'effects',
  Scroll: 'effects',
  [SECTION_TITLE.instance]: 'prefabs-scenes',
};

/**
 * The topic a validation issue links to: the section's own topic when the issue
 * names a section that has one, since that is where the fix is, and otherwise
 * the general one about what errors and warnings mean.
 */
export function helpTopicForIssue(issue: ValidationIssue): string {
  const section = issue.inspectorSection;
  return (section && HELP_TOPIC_FOR_SECTION[section]) || 'validation';
}

export function findHelpTopic(id: string): HelpTopic | undefined {
  return HELP_TOPICS.find((topic) => topic.id === id);
}

const tokens = (text: string) => text.toLowerCase().split(/[^a-z0-9+/.-]+/).filter(Boolean);

/**
 * The topics matching every word of `query`, best first. A word in the title
 * outweighs one among the keywords, which outweighs one in the body; an empty
 * query answers every topic in its own order. The shortcut table is searched as
 * part of the shortcuts topic, so "undo" finds it.
 */
export function searchHelp(query: string): HelpTopic[] {
  const words = tokens(query);
  if (words.length === 0) return [...HELP_TOPICS];
  const scored: { topic: HelpTopic; score: number; index: number }[] = [];
  HELP_TOPICS.forEach((topic, index) => {
    const title = topic.title.toLowerCase();
    const keywords = topic.keywords.map((word) => word.toLowerCase());
    let body = [...topic.body, ...(topic.steps ?? [])].join(' ').toLowerCase();
    if (topic.id === 'shortcuts') {
      body += ' ' + SHORTCUTS.map((row) => `${row.keys} ${row.does}`).join(' ').toLowerCase();
    }
    let score = 0;
    for (const word of words) {
      if (title.includes(word)) score += 3;
      else if (keywords.some((keyword) => keyword.startsWith(word))) score += 2;
      else if (body.includes(word)) score += 1;
      else return;
    }
    scored.push({ topic, score, index });
  });
  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.topic);
}

export const HELP_LINKS = {
  docs: 'https://github.com/stupidwolfy/phaser-gui-tool#readme',
  feedback: 'https://github.com/stupidwolfy/phaser-gui-tool/issues',
} as const;

export const HELP_VERSIONS = {
  phaser: TARGET_PHASER_VERSION,
  schema: SCHEMA_VERSION,
} as const;
