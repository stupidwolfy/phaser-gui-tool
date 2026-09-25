import { expect, type CDPSession, type Dialog, type Locator, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { PREFS_KEY } from '../../src/io/prefs';
import {
  countColorIn,
  findColor,
  findColorBox,
  type ColorBlob,
  type ColorBox,
} from './pixels';

/** The default scene, from `src/core/defaults.ts`. */
export const SCENE = { width: 960, height: 540 };
/** `EditorScene.zoomToFit` leaves this much margin around the scene. */
const FIT_MARGIN = 0.9;

/**
 * How much of the bottom of the canvas the screenshots throw away.
 *
 * The move bar and the toast both float *over* the canvas down there, and the
 * move bar's confirm button is `--accent`, which is also the default rectangle
 * fill — it was counted as part of the object the first time this harness was
 * written. The clip is applied to the screenshot only: pointer coordinates are
 * still computed from the full canvas box, because computing them from the
 * clipped one lands every touch in empty space and makes every assertion
 * quietly read "nothing moved".
 */
const OVERLAY_BAND = 130;

/**
 * How far the priming move travels before the real drag is measured. Anything
 * over Phaser's 8px `dragDistanceThreshold` will do.
 *
 * Exported because it is not only a harness detail: Phaser captures the
 * pointer-to-object offset when the drag actually starts, so the object ends
 * this much *behind* wherever the pointer was aimed. A test that needs the
 * object to finish on a particular spot — rather than needing to know how far
 * it travelled — has to aim past it by exactly this.
 */
export const PRIME = 12;

/**
 * How far beyond an object's top edge the rotate knob is parked, in screen
 * pixels — `ROTATE_HANDLE_OFFSET` in `EditorScene`.
 *
 * Exported for the same reason `PRIME` is: it is not only a harness detail. The
 * knob sits a fixed distance from the object *on screen* at every zoom, which
 * is what keeps it reachable on a phone and what lets a test work out where it
 * is from geometry alone rather than reaching into the scene. Change it there
 * without changing it here and the suite misses the knob entirely, then reports
 * that rotation does nothing.
 */
export const ROTATE_HANDLE_OFFSET = 28;

export interface Point {
  x: number;
  y: number;
}

/**
 * Set in the page to stop `open`'s init script re-seeding the section
 * preference. It has to be a marker rather than a one-off removal, because
 * `addInitScript` runs again on every navigation — so a spec that cleared the
 * key and reloaded would come back with it seeded again.
 */
const SHIPPED_DEFAULTS_KEY = 'phaser-gui-tool:test:shipped-defaults';

export type PanelName = 'scene' | 'inspect' | 'file';

/** Mobile sheet titles, which are also how the suite finds each sheet. */
const SHEET_TITLE: Record<PanelName, string> = {
  scene: 'Scene',
  inspect: 'Properties',
  file: 'File',
};

/**
 * Everything the specs need to drive the editor, in one place, because the two
 * form factors reach the same controls very differently: on desktop the panels
 * are always on screen, on mobile they are modal sheets that have to be opened
 * and — crucially — closed again before anything can touch the canvas.
 */
export class EditorPage {
  private cdp?: CDPSession;
  /** Which pointer a `{ hold: true }` drag left down, so endDrag can lift it. */
  private held: 'mouse' | 'touch' | null = null;

  private constructor(
    readonly page: Page,
    readonly isMobile: boolean,
  ) {}

  static async open(page: Page, isMobile: boolean): Promise<EditorPage> {
    // Headless Chromium exposes the File System Access API but can never
    // resolve it — there is no picker UI — so a save through it hangs forever.
    // Removing it also makes both projects exercise the download/<input>
    // fallback, which is the path every phone takes anyway.
    await page.addInitScript(() => {
      delete (window as unknown as Record<string, unknown>).showSaveFilePicker;
      delete (window as unknown as Record<string, unknown>).showOpenFilePicker;
    });

    // The inspector's sections ship collapsed, and the suite reaches their
    // controls two ways: through the async helpers below, which could be taught
    // to expand first, and directly — `editor.panel('inspect').getByRole(…)` —
    // in some forty places, which could not, because `panel()` is a synchronous
    // locator factory and `openPanel()` returns immediately on desktop. So the
    // preference is seeded instead of the call sites being rewritten.
    //
    // This is a real user configuration, not a back door: it is the state the
    // panel's own Expand-all button writes, under the key it writes it to, so
    // production code carries no test-only branch.
    //
    // The decisive argument is not the edit count, though. Several existing
    // assertions are *absence* assertions — `physics.spec.ts`'s `toHaveCount(0)`
    // for a section that should not be there, `behaviour.spec.ts`'s empty-state
    // sentences — and a collapsed neighbour turns every one of them into a
    // statement that is true for the wrong reason. Seeding everything open
    // keeps the DOM the suite sees identical to the one it was written against.
    //
    // `useShippedSectionDefaults` below opts out, for the one spec whose
    // subject is the collapsing itself.
    await page.addInitScript(
      ([key, optOut]) => {
        try {
          if (localStorage.getItem(optOut) === null) {
            localStorage.setItem(
              key,
              JSON.stringify({ sections: { openByDefault: true, overrides: {} } }),
            );
          }
        } catch {
          /* A browser with storage disabled still gets the shipped default. */
        }
      },
      [PREFS_KEY, SHIPPED_DEFAULTS_KEY] as const,
    );

    const editor = new EditorPage(page, isMobile);
    await page.goto('./');
    await editor.waitForCanvas();
    return editor;
  }

  get canvas(): Locator {
    return this.page.locator('.viewport canvas');
  }

  /**
   * Reloads the page, which comes back on the autosaved draft.
   *
   * The one way to reach a genuinely cold boot from inside a test. Everything
   * else a spec can do — `newProject`, `openFile` — happens in a page that has
   * already decoded whatever it is about to be handed, because the decode
   * caches in `assets.ts`, `audio.ts` and `fonts.ts` are module-level and
   * survive any amount of opening and closing. So a spec whose subject is *the
   * asynchronous load itself* has to come through here, or it silently asserts
   * the synchronous path twice.
   */
  async reload(): Promise<void> {
    await this.page.reload();
    await this.waitForCanvas();
  }

  /** Resolves once Phaser has booted and drawn at least one frame. */
  async waitForCanvas(): Promise<void> {
    await expect(this.canvas).toBeVisible();
    await this.settle();
  }

  /**
   * Waits for the renderer to catch up with the store.
   *
   * Two animation frames rather than one: a store change lands during the
   * frame that is already in flight, so the first rAF can still be showing the
   * previous state.
   */
  async settle(): Promise<void> {
    await this.page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
  }

  // -- panels ----------------------------------------------------------------

  /** The container the given panel's controls live in, per form factor. */
  panel(name: PanelName): Locator {
    if (!this.isMobile) {
      if (name === 'scene') return this.page.locator('.app__side--left');
      if (name === 'inspect') return this.page.locator('.app__side--right');
      return this.page.locator('.toolbar');
    }
    // A closed sheet is translated off-screen rather than hidden, so it is
    // still a match for any locator — the open one has to be picked by title.
    // Matched on the sheet's own header: the inspector's body also contains
    // the word "Scene" when nothing is selected, which made a body-wide text
    // filter match two sheets at once.
    return this.page
      .locator('.sheet')
      .filter({ has: this.page.locator('.sheet__header', { hasText: SHEET_TITLE[name] }) });
  }

  /** No-op on desktop, where every panel is already on screen. */
  async openPanel(name: PanelName): Promise<void> {
    if (!this.isMobile) return;
    const sheet = this.panel(name);
    if (await sheet.evaluate((element) => element.classList.contains('is-open'))) return;
    // `exact`, and not by accident: the tab bar's labels are single common
    // words, so a substring match picks up any panel button whose own label
    // happens to contain one — "Centre in scene ↔" matched the Scene tab, and
    // every mobile test that opened a panel failed at once, nowhere near the
    // feature that added the button.
    await this.page
      .getByRole('button', { name: SHEET_TITLE[name], exact: true })
      .click();
    await expect(sheet).toHaveClass(/is-open/);
    // The sheet shrinks the viewport, which re-fits the camera.
    await this.settle();
  }

  /**
   * Closes whatever sheet is open. Mandatory before any canvas interaction: a
   * tap aimed at the canvas otherwise lands on the sheet covering it.
   */
  async closePanels(): Promise<void> {
    if (!this.isMobile) return;
    const open = this.page.locator('.sheet.is-open');
    while ((await open.count()) > 0) {
      // `Close <title> panel`: named by the sheet it closes, so that a screen
      // reader hears which of the three it is.
      await open.first().getByRole('button', { name: /^Close .+ panel$/ }).click();
      await expect(open).toHaveCount(0);
    }
    await this.settle();
  }

  // -- scene tree ------------------------------------------------------------

  treeItems(): Locator {
    return this.panel('scene').locator('.tree__item');
  }

  async addObject(
    label:
      | 'Rectangle'
      | 'Ellipse'
      | 'Text'
      | 'Image'
      | 'Panel'
      | 'Tiled'
      | 'Group'
      | 'Tiles'
      | 'Particles',
  ): Promise<void> {
    await this.openPanel('scene');
    await this.panel('scene').getByRole('button', { name: `+ ${label}` }).click();
    await this.settle();
  }

  /**
   * Empties the scene, leaving a project with no objects in it.
   *
   * A new project ships three example objects, which is right for someone
   * opening the editor and wrong for any test whose claim is about *which*
   * objects took part: they are three more boxes to snap to, three more
   * colours a centroid can pick up. Deleting them by the tree's own row button
   * keeps this honest — nothing here reaches past the UI into the store.
   */
  async clearScene(): Promise<void> {
    await this.openPanel('scene');
    const rows = this.panel('scene').locator('.tree__item');
    for (let guard = 0; (await rows.count()) > 0 && guard < 50; guard += 1) {
      await rows.first().getByRole('button', { name: /^Delete / }).click();
    }
    await this.settle();
  }

  /**
   * Places an instance of a prefab from the scene panel's library.
   *
   * Every button there carries the `+ ` prefix, and the locator relies on it:
   * a prefab a user names "Scene" would otherwise be a button reading exactly
   * "Scene", which is the mobile tab bar's own label matched exactly.
   */
  async placePrefab(name: string): Promise<void> {
    await this.openPanel('scene');
    await this.panel('scene').getByRole('button', { name: `+ ${name}` }).click();
    await this.settle();
  }

  /**
   * Opens the prefab library's own controls in the scene panel — rename and
   * delete for every definition, placed or not.
   *
   * Pressed only when it is not already open: it is a toggle, and a second
   * press from a test that did not know would close the very cards it wants.
   */
  async managePrefabs(): Promise<void> {
    await this.openPanel('scene');
    const toggle = this.panel('scene').getByRole('button', { name: 'Manage prefabs' });
    if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
    await this.settle();
  }

  /**
   * An input in the prefab library, found by its label's exact text.
   *
   * `field()` is scoped to the inspector, and must stay so: on the desktop
   * layout both panels are on screen together, so a page-wide lookup would find
   * the inspector's `Prefab name` beside the library's `Prefab 1 name`.
   */
  libraryField(label: string): Locator {
    return this.labelled(label, 'scene').locator('input.field__input');
  }

  /** Types into a library field the way `setField` types into the inspector's. */
  async setLibraryField(label: string, value: string): Promise<void> {
    await this.managePrefabs();
    const input = this.libraryField(label);
    await input.fill(value);
    await input.blur();
    await this.settle();
  }

  /** Deletes a prefab from the library, by its named button. */
  async deletePrefabFromLibrary(name: string): Promise<void> {
    await this.managePrefabs();
    await this.panel('scene')
      .getByRole('button', { name: `Delete prefab ${name}`, exact: true })
      .click();
    await this.settle();
  }

  /** Turns the current selection into a prefab, from the inspector. */
  async saveAsPrefab(): Promise<void> {
    await this.openPanel('inspect');
    await this.panel('inspect').getByRole('button', { name: 'Save as prefab' }).click();
    await this.settle();
  }

  async selectInTree(name: string): Promise<void> {
    await this.openPanel('scene');
    // By the row's name text rather than its accessible name, which is
    // `<name>, <type>` so a screen reader says what kind of object it is.
    // A selected row's name carries a CSS ` (selected)` suffix, which Playwright
    // reads as text; it is allowed here so a selected row can still be found.
    const exact = new RegExp(
      `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( \\(selected\\))?$`,
    );
    await this.panel('scene')
      .locator('.tree__label[data-tree-object]')
      .filter({ has: this.page.locator('.tree__name', { hasText: exact }) })
      .click();
    await this.settle();
  }

  // -- scenes ----------------------------------------------------------------

  /** Adds a scene and switches to it, from the scene panel's switcher row. */
  async addScene(): Promise<void> {
    await this.openPanel('scene');
    await this.panel('scene').getByRole('button', { name: '+ Scene', exact: true }).click();
    await this.settle();
  }

  /**
   * Switches to a scene by name.
   *
   * The chips are labelled `Switch to <name>` rather than by the bare name: the
   * mobile tab bar's own labels are single common words matched exactly, so a
   * scene called "Scene" would otherwise put a second button reading exactly
   * "Scene" on the page and take every mobile test that opens a panel with it.
   */
  async switchToScene(name: string): Promise<void> {
    await this.openPanel('scene');
    await this.panel('scene').getByRole('button', { name: `Switch to ${name}` }).click();
    await this.settle();
  }

  /**
   * Duplicates or deletes the scene being edited.
   *
   * Both live in the inspector beside the scene's own fields, which the
   * inspector shows only while nothing is selected — so these deselect first
   * rather than leaving the caller to remember, the way `setGridSize` does.
   */
  async duplicateScene(): Promise<void> {
    await this.deselect();
    await this.openPanel('inspect');
    await this.panel('inspect').getByRole('button', { name: 'Duplicate scene' }).click();
    await this.settle();
  }

  async deleteScene(): Promise<void> {
    await this.deselect();
    await this.openPanel('inspect');
    await this.panel('inspect').getByRole('button', { name: 'Delete scene' }).click();
    await this.settle();
  }

  /**
   * The scene tree's sticky additive-selection toggle. While it is on, a press
   * on a row or on the canvas adds to the selection instead of replacing it —
   * and never starts a move, so a drag test has to turn it off again.
   */
  async setMultiSelect(on: boolean): Promise<void> {
    await this.openPanel('scene');
    // `Multi ✓` while on: the active state's tick is CSS content, and Chromium
    // counts generated content towards an accessible name.
    const button = this.panel('scene').getByRole('button', { name: /^Multi( ✓)?$/ });
    if (((await button.getAttribute('aria-pressed')) === 'true') !== on) await button.click();
    await this.settle();
  }

  // -- tilemaps --------------------------------------------------------------

  // Cutting a tileset is `sliceSheet`: a tileset *is* a sliced image, so the
  // slicer is the same panel and the helper is the same one.

  /** Picks the brush from the inspector's palette. */
  async pickTile(index: number): Promise<void> {
    await this.openPanel('inspect');
    await this.panel('inspect')
      .getByRole('button', { name: `Tile ${index}`, exact: true })
      .click();
    await this.settle();
  }

  /** Picks the eraser, from the same palette and the same field. */
  async pickEraser(): Promise<void> {
    await this.openPanel('inspect');
    await this.panel('inspect')
      .getByRole('button', { name: 'Erase tiles', exact: true })
      .first()
      .click();
    await this.settle();
  }

  /**
   * Enters or leaves paint mode from the inspector's button.
   *
   * The bar over the canvas has a ✓ that does the same thing, and the mobile
   * tests reach it through here anyway: the button is a toggle, so one helper
   * covers both directions and neither test has to know which control it is
   * looking at.
   */
  async setPainting(on: boolean): Promise<void> {
    await this.openPanel('inspect');
    const button = this.panel('inspect').getByRole('button', {
      name: on ? 'Edit tiles' : 'Done painting',
      exact: true,
    });
    if ((await button.count()) > 0) await button.click();
    await this.settle();
  }

  /**
   * Adds a layer to the selected map. Adding also selects it, exactly as adding
   * an object selects it — so a test paints on the new layer without a second
   * call, and the multi-select suite's trap arrives here too.
   */
  async addLayer(): Promise<void> {
    await this.openPanel('inspect');
    await this.panel('inspect').getByRole('button', { name: '+ Layer', exact: true }).click();
    await this.settle();
  }

  /**
   * Makes one layer the one the brush, the fill and the collision grid are
   * about, from the inspector's list.
   *
   * `.first()` because the paint bar carries a row with the same accessible
   * name while paint mode is on, which is the whole point of it being there —
   * `pickLayerInBar` scopes to that sheet's own group to reach it deliberately.
   */
  async selectLayer(name: string): Promise<void> {
    await this.openPanel('inspect');
    await this.panel('inspect')
      .getByRole('button', { name: `Paint on ${name}`, exact: true })
      .first()
      .click();
    await this.settle();
  }

  /** The same choice from the bar over the canvas, mid-gesture. */
  async pickLayerInBar(name: string): Promise<void> {
    await this.closePanels();
    await this.page.getByRole('button', { name: 'Choose a layer', exact: true }).click();
    // Scoped to the bar's own sheet: on desktop the inspector is not hidden by
    // `closePanels`, so it still carries a row with this exact name — which is
    // the point of the two controls writing one field, and the reason this
    // locator has to say which of them it means.
    await this.page
      .getByRole('group', { name: 'Layers', exact: true })
      .getByRole('button', { name: `Paint on ${name}`, exact: true })
      .click();
    await this.settle();
  }

  /** Renames the active layer. */
  async renameLayer(name: string): Promise<void> {
    await this.setField('Layer name', name);
  }

  /** Shows or hides one layer. */
  async setLayerVisible(name: string, visible: boolean): Promise<void> {
    await this.openPanel('inspect');
    const button = this.panel('inspect').getByRole('button', {
      name: visible ? `Show layer ${name}` : `Hide layer ${name}`,
      exact: true,
    });
    if ((await button.count()) > 0) await button.click();
    await this.settle();
  }

  /** Moves one layer forward or back in the draw order. */
  async moveLayer(name: string, direction: 'forward' | 'back'): Promise<void> {
    await this.openPanel('inspect');
    await this.panel('inspect')
      .getByRole('button', { name: `Move ${name} ${direction}`, exact: true })
      .click();
    await this.settle();
  }

  /** Deletes one layer, or reports that the button refuses. */
  async removeLayer(name: string): Promise<boolean> {
    await this.openPanel('inspect');
    const button = this.panel('inspect').getByRole('button', {
      name: `Delete layer ${name}`,
      exact: true,
    });
    if (await button.isDisabled()) return false;
    await button.click();
    await this.settle();
    return true;
  }

  /** Fills every cell of the selected map with the current brush. */
  async fillTiles(): Promise<void> {
    await this.openPanel('inspect');
    await this.panel('inspect')
      .getByRole('button', { name: /^(Fill with this tile|Clear every tile)$/ })
      .click();
    await this.settle();
  }

  /**
   * A press on the canvas that lays one tile, aimed in *scene* coordinates.
   *
   * `tap` and not `drag`: a stroke is a press plus its moves, and the shortest
   * one is a press on its own. On touch this is deliberately *not* the two-step
   * gesture `drag` sends — paint mode has taken the press, so the tap that
   * would have selected paints instead, and a priming tap would lay a tile
   * nobody asked for.
   *
   * Scene coordinates rather than page ones, and that is the whole reason this
   * takes them: entering paint mode opens the inspector, on mobile a sheet that
   * shortens the canvas and re-fits the camera — so a page coordinate worked
   * out before the sheet closed points somewhere else entirely by the time the
   * tap lands. Converting on this side of `closePanels` makes that impossible
   * to get wrong.
   */
  async paintCell(scenePoint: Point): Promise<void> {
    await this.closePanels();
    await this.tap(await this.sceneToScreen(scenePoint));
    await this.settle();
  }

  /**
   * The toolbar's snap toggle. In the toolbar rather than a panel because it
   * has to be reachable while the canvas is visible, which on mobile a sheet
   * is not.
   */
  async setSnapping(on: boolean): Promise<void> {
    await this.closePanels();
    const button = this.page.getByRole('button', { name: 'Snap to objects' });
    if (((await button.getAttribute('aria-pressed')) === 'true') !== on) await button.click();
    await this.settle();
  }

  /**
   * The toolbar's grid toggle, the other half of the snapping pair, and off by
   * default so that every test not about the grid is unaffected by it.
   */
  async setGrid(on: boolean): Promise<void> {
    await this.closePanels();
    const button = this.page.getByRole('button', { name: 'Snap to grid' });
    if (((await button.getAttribute('aria-pressed')) === 'true') !== on) await button.click();
    await this.settle();
  }

  /**
   * The grid's pitch, which lives in the Scene panel — and the Scene panel is
   * what the inspector shows only while nothing is selected, so this clears the
   * selection first rather than leaving the caller to remember.
   */
  async setGridSize(size: number): Promise<void> {
    await this.deselect();
    await this.setField('Grid size', size);
  }

  /**
   * The rotate gesture's angular pitch, which lives in the Scene panel beside
   * the grid's — and the Scene panel is what the inspector shows only while
   * nothing is selected, so this clears the selection first. Set the step
   * *before* selecting the object the test means to turn.
   */
  async setAngleStep(degrees: number): Promise<void> {
    await this.deselect();
    await this.setField('Angle step°', degrees);
  }

  /**
   * Adds a guide down or across the middle of the scene.
   *
   * The buttons live in the Scene panel, which the inspector shows only while
   * nothing is selected — so this deselects first rather than leaving the
   * caller to remember, the way `setGridSize` does.
   */
  async addGuide(axis: 'x' | 'y'): Promise<void> {
    await this.deselect();
    await this.openPanel('inspect');
    await this.panel('inspect')
      .getByRole('button', { name: axis === 'x' ? '+ Guide ↕' : '+ Guide ↔' })
      .click();
    await this.settle();
  }

  /** The Scene panel's guide visibility toggle, which also governs snapping. */
  async setGuidesVisible(on: boolean): Promise<void> {
    await this.deselect();
    await this.openPanel('inspect');
    const box = this.checkbox('Show guides');
    if ((await box.isChecked()) !== on) await box.click();
    await this.settle();
  }

  /**
   * Switches the selected object's Arcade body on or off.
   *
   * The checkbox is at the very bottom of the inspector, below the per-type
   * section, so on a phone it is off the bottom of the sheet until Playwright
   * scrolls to it — which `check`/`uncheck` do for themselves, unlike `click`.
   */
  async setPhysics(on: boolean): Promise<void> {
    await this.openPanel('inspect');
    const box = this.checkbox('Physics body');
    if (on) await box.check();
    else await box.uncheck();
    await this.settle();
  }

  /** Reads back whether the selected object has a body. */
  async hasPhysics(): Promise<boolean> {
    await this.openPanel('inspect');
    return this.checkbox('Physics body').isChecked();
  }

  /**
   * The scene's gravity, which lives in `SceneInspector` — so this deselects
   * first, exactly as the guide helpers do: that panel only renders with an
   * empty selection.
   */
  async setGravity(x: number, y: number): Promise<void> {
    await this.deselect();
    await this.setField('Gravity X', x);
    await this.setField('Gravity Y', y);
  }

  /**
   * The scene's physics engine, which lives beside the gravity in
   * `SceneInspector` — so this deselects first, exactly as `setGravity` does.
   *
   * Matched by the option's leading word rather than its whole label, because
   * the labels say what each engine is *for* ("Arcade — fast, upright boxes")
   * and a test should not have to restate a sentence to pick a value.
   */
  async setSceneEngine(engine: 'arcade' | 'matter'): Promise<void> {
    await this.deselect();
    await this.openPanel('inspect');
    await this.choice('Physics engine').selectOption(engine);
    await this.settle();
  }

  /** A `SelectField`'s current value, as the document stores it. */
  async selectValue(label: string): Promise<string> {
    await this.openPanel('inspect');
    return this.choice(label).inputValue();
  }

  /**
   * The scene's camera, which lives in `SceneInspector` beside the gravity —
   * so this deselects first, exactly as `setGravity` and the guide helpers do.
   */
  async setCamera(patch: { x?: number; y?: number; zoom?: number }): Promise<void> {
    await this.deselect();
    if (patch.x !== undefined) await this.setField('Camera X', patch.x);
    if (patch.y !== undefined) await this.setField('Camera Y', patch.y);
    if (patch.zoom !== undefined) await this.setField('Camera zoom', patch.zoom);
  }

  /** A checkbox in the scene panel, which is only rendered with nothing selected. */
  async setSceneFlag(label: string, on: boolean): Promise<void> {
    await this.deselect();
    await this.openPanel('inspect');
    const box = this.checkbox(label);
    if (on) await box.check();
    else await box.uncheck();
    await this.settle();
  }

  /**
   * Switches the selected object's player controls on or off. Only ever
   * offered for a top-level node with a *dynamic* body, so the field is absent
   * rather than disabled everywhere else — which is what `controlsOffered`
   * below is for.
   */
  async setControls(on: boolean): Promise<void> {
    await this.openPanel('inspect');
    const box = this.checkbox('Player controls');
    if (on) await box.check();
    else await box.uncheck();
    await this.settle();
  }

  /**
   * The selected object's on-screen buttons, which live under Controls and are
   * therefore offered only where controls are.
   */
  async setTouchControls(on: boolean): Promise<void> {
    await this.openPanel('inspect');
    const box = this.checkbox('On-screen buttons');
    if (on) await box.check();
    else await box.uncheck();
    await this.settle();
  }

  /** Whether the selected object is offered controls at all. */
  async controlsOffered(): Promise<boolean> {
    await this.openPanel('inspect');
    return (await this.checkbox('Player controls').count()) > 0;
  }

  /**
   * Switches the selected object's tween on or off.
   *
   * Offered for every object at every depth, unlike a body — a tween writes the
   * object's own local properties, so there is no top-level rule and therefore
   * no `tweenOffered` sibling to `controlsOffered`.
   */
  async setTween(on: boolean): Promise<void> {
    await this.openPanel('inspect');
    const box = this.checkbox('Tween this object');
    if (on) await box.check();
    else await box.uncheck();
    await this.settle();
  }

  /** Reads back whether the selected object has a tween. */
  async hasTween(): Promise<boolean> {
    await this.openPanel('inspect');
    return this.checkbox('Tween this object').isChecked();
  }

  /**
   * Points one of the tween's six properties at a value, or clears it.
   *
   * Two controls per property — a checkbox that switches the target on and a
   * number field beside it — so this presses the first and then types into the
   * second, which is the order a person uses and the only order in which the
   * field exists.
   */
  async setTweenTarget(property: string, value: number | null): Promise<void> {
    await this.openPanel('inspect');
    const box = this.checkbox(`Tween ${property}`);
    if (value === null) {
      await box.uncheck();
      await this.settle();
      return;
    }
    if (!(await box.isChecked())) await box.check();
    await this.setField(`Tween ${property} to`, value);
  }

  /**
   * Marks one of the tileset's frames solid, or lets it go back to scenery.
   *
   * The Collision grid, never the Brush one: both are in the tilemap's own
   * inspector section and both draw the same tileset, which is why the solid
   * cells are named "Solid tile N" and the brush cells "Tile N".
   */
  async setTileSolid(index: number, solid: boolean): Promise<void> {
    await this.openPanel('inspect');
    const cell = this.panel('inspect').getByRole('button', { name: `Solid tile ${index}` });
    if ((await cell.getAttribute('aria-pressed')) !== String(solid)) await cell.click();
    await this.settle();
  }

  /**
   * Adds a collision row and points it at two objects by name.
   *
   * In `SceneInspector` beside the gravity, so this deselects first — exactly
   * as `setGravity` and `setCamera` do, and for their reason: that panel only
   * renders with an empty selection.
   */
  async addCollider(
    a: string,
    b: string,
    kind: 'Solid' | 'Overlap' = 'Solid',
    row = 1,
  ): Promise<void> {
    await this.deselect();
    await this.openPanel('inspect');
    await this.panel('inspect').getByRole('button', { name: '+ Collision' }).click();
    await this.settle();
    await this.setChoice(`Collides ${row}`, a);
    await this.setChoice(`With ${row}`, b);
    await this.setChoice(`How ${row}`, kind);
  }

  /**
   * Adds a collision from the selected object's *own* panel.
   *
   * `addCollider`'s sibling, and the path a person actually takes. That one
   * deselects into `SceneInspector`, which is exactly the panel nobody finds:
   * it needs an empty selection, and giving two objects bodies never leaves you
   * with one. This one leaves the selection alone, so a test using it asserts
   * the reachable route rather than the reachable-in-principle one.
   */
  async addColliderOnNode(
    other: string,
    kind: 'Solid' | 'Overlap' = 'Solid',
    row = 1,
  ): Promise<void> {
    await this.openPanel('inspect');
    await this.panel('inspect').getByRole('button', { name: '+ Add a collision' }).click();
    await this.settle();
    await this.setChoice(`Collides with ${row}`, other);
    await this.setChoice(`Collision ${row} is`, kind);
  }

  /** A physics checkbox other than the on/off one, by its label. */
  async setPhysicsFlag(label: string, on: boolean): Promise<void> {
    await this.openPanel('inspect');
    const box = this.checkbox(label);
    if (on) await box.check();
    else await box.uncheck();
    await this.settle();
  }

  async clearGuides(): Promise<void> {
    await this.deselect();
    await this.openPanel('inspect');
    await this.panel('inspect').getByRole('button', { name: 'Clear guides' }).click();
    await this.settle();
  }

  /**
   * Cuts the selected sprite's image into square frames of `frameSize`.
   *
   * The controls live in the sprite's own inspector section, so the sprite has
   * to be selected already — which it is, since adding an object selects it and
   * importing an image needs the same panel open.
   */
  async sliceSheet(frameSize: number): Promise<void> {
    await this.openPanel('inspect');
    const box = this.checkbox('Sliced into frames');
    if (!(await box.isChecked())) await box.click();
    await this.setField('Frame W', frameSize);
    await this.setField('Frame H', frameSize);
    await this.settle();
  }

  /**
   * Removes the frame grid from the selected object's image, so the image is
   * one whole picture again.
   *
   * The checkbox rather than a zero in the size fields: a frame of zero is an
   * unusable grid, which is a different state — the editor keeps the numbers
   * and says to fix them — and the fields refuse it anyway.
   */
  async unsliceSheet(): Promise<void> {
    await this.openPanel('inspect');
    const box = this.checkbox('Sliced into frames');
    if (await box.isChecked()) await box.click();
    await this.settle();
  }

  /**
   * Attaches a texture atlas to the selected object's image, or replaces the
   * one it has.
   *
   * One method for both, because the panel is one button for both: replacing is
   * the ordinary case, since an atlas is re-exported every time the artwork
   * changes.
   *
   * **The mime is passed empty on purpose**, which is `importFont`'s reason
   * arriving one format over. Playwright will happily supply
   * `application/json`, and a picker on a desktop usually does too — but a
   * packer that writes a `.atlas` extension, or a phone's document picker,
   * reports something else or nothing, so an empty one is the honest fixture
   * and the only one that exercises the extension half of the accept list.
   */
  async attachAtlas(file: { name: string; contents: string }): Promise<void> {
    await this.openPanel('inspect');
    const chooser = this.page.waitForEvent('filechooser');
    await this.panel('inspect')
      .getByRole('button', { name: /^(Attach|Replace) atlas…$/ })
      .click();
    await (await chooser).setFiles({
      name: file.name,
      mimeType: '',
      buffer: Buffer.from(file.contents, 'utf8'),
    });
    await expect(
      this.panel('inspect').getByRole('button', { name: 'Remove atlas' }),
    ).toBeVisible();
    await this.settle();
  }

  /**
   * Removes it, so the image is one whole picture again — `unsliceSheet`'s
   * sibling, and a button rather than a checkbox for the same reason that one
   * is a checkbox: there is no "empty atlas" to type.
   */
  async removeAtlas(): Promise<void> {
    await this.openPanel('inspect');
    await this.panel('inspect').getByRole('button', { name: 'Remove atlas' }).click();
    await this.settle();
  }

  /**
   * Picks a named frame on the selected object.
   *
   * Two helpers rather than one with two modes, because these are two controls:
   * a grid's frame is a number field reached through `setField('Frame', n)`,
   * and an atlas's is a select. Merging them would hide exactly the difference
   * the atlas suite exists to assert.
   */
  async setFrameName(name: string): Promise<void> {
    await this.openPanel('inspect');
    await this.choice('Frame').selectOption(name);
    await this.settle();
  }

  /** The frame names the Frame select offers, in order. */
  async frameOptions(): Promise<string[]> {
    await this.openPanel('inspect');
    return this.choice('Frame').locator('option').allTextContents();
  }

  /** Creates a clip over every frame and plays it on the selected sprite. */
  async addAnimation(): Promise<void> {
    await this.openPanel('inspect');
    await this.panel('inspect')
      .getByRole('button', { name: /^New animation from all/ })
      .click();
    await this.settle();
  }

  /**
   * The toolbar's preview toggle, which only exists once the project holds
   * something that moves — an animation clip or a particle emitter — so this is
   * called after `addAnimation` or after adding a Particles node, never before.
   */
  async setPreview(on: boolean): Promise<void> {
    await this.closePanels();
    const button = this.page.getByRole('button', { name: 'Preview motion' });
    if (((await button.getAttribute('aria-pressed')) === 'true') !== on) await button.click();
    await this.settle();
  }

  // -- play ------------------------------------------------------------------

  /**
   * The frame the game runs in, or an empty locator when nothing is playing.
   *
   * Reached by class rather than by role, the way a section head is: the
   * overlay's own `role="dialog"` carries the accessible name `Play game`,
   * which is also the toolbar button's — matching by role would be ambiguous
   * the moment both are on the page, which is every moment after the press.
   */
  playFrame(): Locator {
    return this.page.locator('.play__frame');
  }

  /**
   * Presses Play and waits for the game to have drawn a frame.
   *
   * `closePanels` first for the reason every canvas gesture needs it on mobile:
   * a sheet is a modal over the canvas and the toolbar button is behind it.
   */
  async play(): Promise<void> {
    await this.closePanels();
    await this.page.getByRole('button', { name: 'Play game' }).click();
    await this.waitForPlay();
  }

  /** Throws the running game away and returns to the editor. */
  async stopPlay(): Promise<void> {
    await this.page.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(this.playFrame()).toHaveCount(0);
    await this.settle();
  }

  /** Discards the running game and starts the same page over in a fresh frame. */
  async restartPlay(): Promise<void> {
    await this.page.getByRole('button', { name: 'Restart', exact: true }).click();
    await this.waitForPlay();
  }

  /**
   * Waits until the frame holds a booted game.
   *
   * The canvas is the signal rather than the iframe's `load`, which fires when
   * the document has parsed and says nothing about whether Phaser started —
   * `runExportedPage` in `export.spec.ts` waits on exactly the same thing for
   * exactly that reason. The rAF is the parent's, which is enough: it is a
   * frame of wall-clock time, and the game's own loop is running by then.
   */
  private async waitForPlay(): Promise<void> {
    await expect(this.playFrame()).toBeVisible();
    await expect(
      this.page.frameLocator('.play__frame').locator('canvas'),
    ).toBeVisible();
    await this.settle();
  }

  /**
   * How many frame pixels one scene unit is, inside the running game.
   *
   * Derived rather than read out of the game, exactly as `zoom` is derived from
   * `zoomToFit`: the exported page asks for `Phaser.Scale.FIT`, so the canvas
   * takes the larger scale that still fits the scene in the frame, and it stays
   * there because nothing here resizes the frame mid-run.
   *
   * It is what makes a claim about a running game portable between the two
   * projects, and the mobile one is why it exists. A 960x540 scene letterboxed
   * into a 390x792 frame draws about 219 pixels tall — so a threshold measured
   * against the *frame* is most of the game on one project and a fifth of it on
   * the other, which is the shape of a test that passes on one and quietly
   * measures something else on the other.
   */
  async playScale(): Promise<number> {
    const box = await this.playFrame().boundingBox();
    if (!box) throw new Error('the play frame has no box — did the overlay not mount?');
    return Math.min(box.width / SCENE.width, box.height / SCENE.height);
  }

  /**
   * Where a colour is drawn *inside the running game*, in frame pixels.
   *
   * The instrument for every claim here, and the first in this file that does
   * not go through `shot`. Three differences from `findDrawn` are worth knowing
   * before writing a claim with it:
   *
   * - It screenshots the **iframe element**, because the editor's canvas is
   *   behind the overlay and reading that would report the scene the game was
   *   generated from rather than the game.
   * - There is no band to clip. The move bar and the toast are the editor's,
   *   and the overlay covers both — which is also why `OVERLAY_BAND` has no
   *   part in this.
   * - The reading is in the *game's* own scale, not the editor's zoom: the
   *   exported page asks for `Scale.FIT`, so it letterboxes itself into
   *   whatever box the frame happens to be. Assert relative travel, never an
   *   absolute landing point.
   *
   * One simplification in its favour: an export draws no editor chrome at all —
   * no selection outline, no handles, no guides, no grid — so the fixture
   * clearance every other spec is shaped around does not apply in here. Said
   * out loud because "no clearance needed" and "forgot the clearance" read
   * identically.
   */
  async findInPlay(hex: string, tolerance?: number): Promise<ColorBlob> {
    const png = await this.playFrame().screenshot();
    return findColor(this.page, png, hex, tolerance);
  }

  /**
   * Where the rotate knob is, in page coordinates, for an object centred on
   * `pivot` whose own half-height is `halfHeight` scene units.
   *
   * Derived rather than read out of Phaser, the way `sceneToScreen` is: the
   * knob is the object's top edge plus a constant *screen* offset, so the
   * radius is a scene distance times the zoom plus a screen distance.
   */
  async rotateHandleAt(pivot: Point, halfHeight: number, rotationDeg = 0): Promise<Point> {
    const centre = await this.sceneToScreen(pivot);
    const zoom = await this.zoom();
    const reach = halfHeight * zoom + ROTATE_HANDLE_OFFSET;
    const radians = ((rotationDeg - 90) * Math.PI) / 180;
    return { x: centre.x + Math.cos(radians) * reach, y: centre.y + Math.sin(radians) * reach };
  }

  /**
   * Clears the selection with a press on empty canvas — which is also what
   * switches the inspector back to the scene's own panel.
   */
  async deselect(): Promise<void> {
    await this.closePanels();
    const box = await this.canvasBox();
    // The top-left corner of the viewport: outside the fitted scene rectangle
    // at either project's zoom, so it cannot land on an object.
    await this.tap({ x: box.x + 6, y: box.y + 6 });
  }

  /** The tree header's object count, which reads "n of m" while several are selected. */
  selectionCount(): Locator {
    return this.panel('scene').locator('.panel__count');
  }

  // -- inspector -------------------------------------------------------------

  /**
   * A section's disclosure head, by its exact title.
   *
   * Located by class rather than by role, deliberately. A head is a button
   * whose accessible name is its title, and several titles are also the names
   * of controls in the same panel — `SECTION_TITLE` contains "Group", "Text",
   * "Image" and "Panel", and `multi-select.spec.ts` already clicks a button
   * named exactly "Group". Reaching a head by role would put those one strict
   * mode violation apart.
   */
  sectionHead(title: string): Locator {
    return this.panel('inspect')
      .locator('.section__head')
      .filter({ has: this.page.locator('.section__title', { hasText: new RegExp(`^${title}$`) }) });
  }

  async toggleSection(title: string): Promise<void> {
    await this.openPanel('inspect');
    await this.sectionHead(title).click();
    await this.settle();
  }

  async sectionIsOpen(title: string): Promise<boolean> {
    await this.openPanel('inspect');
    return (await this.sectionHead(title).getAttribute('aria-expanded')) === 'true';
  }

  /**
   * Drops the harness's seeded "every section open" and comes back on what a
   * first-time user actually gets.
   *
   * Sets a marker rather than only clearing the key, because `open`'s init
   * script runs again on every navigation and would otherwise re-seed the
   * preference during the reload this performs.
   */
  async useShippedSectionDefaults(): Promise<void> {
    await this.page.evaluate(
      ([key, optOut]) => {
        localStorage.setItem(optOut, '1');
        localStorage.removeItem(key);
      },
      [PREFS_KEY, SHIPPED_DEFAULTS_KEY] as const,
    );
    await this.reload();
  }

  /**
   * An inspector input, found by its label's exact text.
   *
   * Not `getByLabel`: a colour field is one <label> wrapping two inputs (the
   * swatch and the hex text box), so the accessible name matches both and the
   * locator is ambiguous. The class picks the text box, which is the one worth
   * typing into.
   */
  field(label: string): Locator {
    return this.labelled(label).locator('input.field__input');
  }

  /** A `SelectField`'s `<select>`, which carries the same class as an input. */
  choice(label: string): Locator {
    return this.labelled(label).locator('select.field__input');
  }

  /** Picks an option by its visible label. */
  async setChoice(label: string, option: string): Promise<void> {
    await this.openPanel('inspect');
    await this.choice(label).selectOption({ label: option });
    await this.settle();
  }

  /** A checkbox field, whose input carries a different class. */
  checkbox(label: string): Locator {
    return this.labelled(label).locator('input.field__check');
  }

  private labelled(label: string, panel: PanelName = 'inspect'): Locator {
    const exact = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
    return this.panel(panel)
      .locator('label.field')
      .filter({ has: this.page.locator('.field__label').filter({ hasText: exact }) });
  }

  async fieldValue(label: string): Promise<string> {
    await this.openPanel('inspect');
    return this.field(label).inputValue();
  }

  async numberValue(label: string): Promise<number> {
    return Number(await this.fieldValue(label));
  }

  /**
   * Types into an inspector field the way a user does — fill, then blur, since
   * the fields open an undo transaction on focus and close it on blur.
   */
  async setField(label: string, value: string | number): Promise<void> {
    await this.openPanel('inspect');
    const input = this.field(label);
    await input.fill(String(value));
    await input.blur();
    await this.settle();
  }

  // -- canvas geometry -------------------------------------------------------

  async canvasBox(): Promise<{ x: number; y: number; width: number; height: number }> {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('the canvas has no box — did Phaser fail to boot?');
    return box;
  }

  /**
   * The camera's zoom, derived rather than read out of Phaser: `zoomToFit`
   * frames the whole scene with a fixed margin, and the camera stays fitted
   * until the user pans or zooms, which no test here does.
   */
  async zoom(): Promise<number> {
    const box = await this.canvasBox();
    return (
      Math.min(box.width / SCENE.width, box.height / SCENE.height) * FIT_MARGIN
    );
  }

  /** Scene coordinates -> page coordinates, for aiming a pointer. */
  async sceneToScreen(point: Point): Promise<Point> {
    const box = await this.canvasBox();
    const zoom = await this.zoom();
    return {
      x: box.x + box.width / 2 + (point.x - SCENE.width / 2) * zoom,
      y: box.y + box.height / 2 + (point.y - SCENE.height / 2) * zoom,
    };
  }

  // -- canvas pixels ---------------------------------------------------------

  /**
   * A screenshot of the canvas with the overlay band clipped off, plus the page
   * coordinate its top-left corner corresponds to, so a centroid measured in it
   * can be compared against a point from `sceneToScreen`.
   */
  async shot(): Promise<{ png: Buffer; origin: Point }> {
    const box = await this.canvasBox();
    const clip = {
      x: box.x,
      y: box.y,
      width: box.width,
      height: Math.max(1, box.height - OVERLAY_BAND),
    };
    return { png: await this.page.screenshot({ clip }), origin: { x: clip.x, y: clip.y } };
  }

  /** Where the given colour is drawn, in page coordinates. */
  async findDrawn(hex: string, tolerance?: number): Promise<ColorBlob> {
    const { png, origin } = await this.shot();
    const blob = await findColor(this.page, png, hex, tolerance);
    return blob.count === 0
      ? blob
      : { count: blob.count, x: blob.x + origin.x, y: blob.y + origin.y };
  }

  /**
   * The box a colour is drawn in, in page coordinates.
   *
   * `findDrawn`'s reading for an *outline*, where a centroid is not the steady
   * one: see `findColorBox`. Both edges have to be on screen for it to mean
   * anything.
   */
  /**
   * How much of a colour is drawn inside one rectangle of *page* coordinates —
   * the reading `findDrawn` and `findDrawnBox` cannot make, for two shapes that
   * share a centre and a bounding box. See `countColorIn`.
   */
  async countDrawnIn(
    hex: string,
    region: { x: number; y: number; width: number; height: number },
    tolerance?: number,
  ): Promise<number> {
    const { png, origin } = await this.shot();
    return countColorIn(
      this.page,
      png,
      hex,
      { ...region, x: region.x - origin.x, y: region.y - origin.y },
      tolerance,
    );
  }

  async findDrawnBox(hex: string, tolerance?: number): Promise<ColorBox> {
    const { png, origin } = await this.shot();
    const box = await findColorBox(this.page, png, hex, tolerance);
    return box.count === 0 ? box : { ...box, x: box.x + origin.x, y: box.y + origin.y };
  }

  // -- pointer ---------------------------------------------------------------

  private async touch(): Promise<CDPSession> {
    this.cdp ??= await this.page.context().newCDPSession(this.page);
    return this.cdp;
  }

  /** A tap, which on touch is a selection and nothing else. */
  async tap(point: Point): Promise<void> {
    if (this.isMobile) await this.page.touchscreen.tap(point.x, point.y);
    else await this.page.mouse.click(point.x, point.y);
    await this.settle();
  }

  /**
   * Drags on the canvas, with the gesture each form factor actually uses, and
   * returns the displacement the dragged object should actually take.
   *
   * Mouse: press and drag in one gesture, which also selects.
   * Touch: two-step. The first press only selects; only the already-selected
   * object can be dragged, so `select` sends that first tap.
   *
   * Two details are not decoration. Phaser starts a drag only once the pointer
   * has moved `dragDistanceThreshold` (8px, so a fingertip's wobble does not
   * register as a move), and it captures the pointer-to-object offset *at that
   * moment* — so every drag, in the editor as much as in this harness, leaves
   * the object behind by however far the pointer had travelled when the drag
   * began. This sends one deliberate `PRIME` move and waits a frame for Phaser
   * to process it, which pins that distance to a known value instead of
   * whatever the machine's frame timing happened to make it; the returned
   * displacement is `to - from` less that priming move.
   */
  async drag(from: Point, to: Point, { select = true, hold = false } = {}): Promise<Point> {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length <= PRIME) throw new Error('drag is too short to clear Phaser\'s threshold');
    const prime = { x: ((to.x - from.x) / length) * PRIME, y: ((to.y - from.y) / length) * PRIME };
    const primed = { x: from.x + prime.x, y: from.y + prime.y };

    const steps = 8;
    const at = (i: number) => ({
      x: primed.x + ((to.x - primed.x) * i) / steps,
      y: primed.y + ((to.y - primed.y) * i) / steps,
    });

    if (!this.isMobile) {
      await this.page.mouse.move(from.x, from.y);
      await this.page.mouse.down();
      await this.settle();
      await this.page.mouse.move(primed.x, primed.y);
      await this.settle();
      for (let i = 1; i <= steps; i += 1) {
        const point = at(i);
        await this.page.mouse.move(point.x, point.y);
      }
      await this.settle();
      if (hold) this.held = 'mouse';
      else await this.page.mouse.up();
      await this.settle();
      return { x: to.x - primed.x, y: to.y - primed.y };
    }

    if (select) await this.tap(from);

    // Real touch events through CDP rather than Playwright's mouse: the whole
    // two-step rule keys off `pointer.wasTouch`, so a mouse drag would take the
    // desktop branch and never exercise it. Emulated touch is still not real
    // touch — it bypasses the browser's own gesture heuristics — so a clean
    // pass here is necessary, not sufficient.
    const cdp = await this.touch();
    const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: Point[]) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });

    await send('touchStart', [from]);
    await this.settle();
    await send('touchMove', [primed]);
    await this.settle();
    for (let i = 1; i <= steps; i += 1) await send('touchMove', [at(i)]);
    await this.settle();
    if (hold) this.held = 'touch';
    else await send('touchEnd', []);
    await this.settle();
    return { x: to.x - primed.x, y: to.y - primed.y };
  }

  /**
   * Ends a drag left down by `{ hold: true }`.
   *
   * Held drags exist for the one thing that is only true mid-gesture: the snap
   * guides are drawn while the pointer is down and cleared when it lifts, so a
   * test that always completes the drag can never see them.
   */
  async endDrag(): Promise<void> {
    if (this.held === 'mouse') await this.page.mouse.up();
    else if (this.held === 'touch') {
      const cdp = await this.touch();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    this.held = null;
    await this.settle();
  }

  // -- commands --------------------------------------------------------------

  async undo(): Promise<void> {
    // The toolbar button rather than Ctrl+Z, because it is the only one of the
    // two a phone has.
    await this.closePanels();
    await this.page.getByRole('button', { name: 'Undo', exact: true }).click();
    await this.settle();
  }

  /**
   * Imports an image into the project through the `<input type="file">` path,
   * which is the one a phone takes and the only one the picker offers.
   * A sprite must be selected: the importer lives in its inspector section.
   */
  async importImage(file: { name: string; buffer: Buffer }): Promise<void> {
    await this.openPanel('inspect');
    const chooser = this.page.waitForEvent('filechooser');
    await this.panel('inspect').getByRole('button', { name: 'Import image…' }).click();
    await (await chooser).setFiles({
      name: file.name,
      mimeType: 'image/png',
      buffer: file.buffer,
    });
    // By title: the row's own text is the name, size and byte count, so the
    // title is the only stable handle on it.
    await expect(this.panel('inspect').getByTitle(`Use ${file.name}`)).toBeVisible();
    await this.settle();
  }

  /** Discards the project and starts a new one. */
  /**
   * Imports a sound through the `<input type="file">` path, which is the only
   * one the audio picker offers.
   *
   * Nothing may be selected: the audio panel lives in `SceneInspector`, which
   * is the inspector shown when the selection is empty — so unlike
   * `importImage`, this deselects first rather than assuming a node.
   */
  async importAudio(file: { name: string; buffer: Buffer }): Promise<void> {
    await this.deselect();
    await this.openPanel('inspect');
    const chooser = this.page.waitForEvent('filechooser');
    await this.panel('inspect').getByRole('button', { name: 'Import audio…' }).click();
    await (await chooser).setFiles({
      name: file.name,
      mimeType: 'audio/wav',
      buffer: file.buffer,
    });
    // By title, because the row's own text is a duration, a size and a key —
    // the same reason `importImage` waits on one.
    await expect(this.panel('inspect').getByTitle(`Use ${file.name}`)).toBeVisible();
    await this.settle();
  }

  /**
   * Imports a font through the `<input type="file">` path, which is the only
   * one the font picker offers.
   *
   * A text object must be selected: the picker lives in its inspector section,
   * where a sprite's image picker is, so this assumes a node the way
   * `importImage` does rather than deselecting the way `importAudio` does.
   *
   * **The mime is passed empty on purpose, and that is the point of the
   * helper.** Playwright will happily supply `font/ttf`, which is what a
   * desktop Linux picker reports and what nothing else does — phones and
   * several browsers report `application/octet-stream` or nothing at all. An
   * empty one is therefore the honest fixture, and it is the only thing that
   * exercises `fontMimeOf`'s extension fallback: with a clean mime handed in,
   * a regression that dropped that fallback would pass the whole suite and
   * fail on every real phone.
   */
  async importFont(file: { name: string; buffer: Buffer }): Promise<void> {
    await this.openPanel('inspect');
    const chooser = this.page.waitForEvent('filechooser');
    await this.panel('inspect').getByRole('button', { name: 'Import font…' }).click();
    await (await chooser).setFiles({ name: file.name, mimeType: '', buffer: file.buffer });
    // By title, because the row's own text is a size and a family — the same
    // reason `importImage` and `importAudio` each wait on one.
    await expect(this.panel('inspect').getByTitle(`Use ${file.name}`)).toBeVisible();
    await this.settle();
  }

  /** Registers an already-imported sound in the active scene. */
  async addSceneSound(name: string): Promise<void> {
    await this.deselect();
    await this.openPanel('inspect');
    await this.panel('inspect').getByTitle(`Use ${name}`).click();
    await this.settle();
  }

  /**
   * Declares a variable in the scene panel and returns the key it reads as.
   *
   * Deselects first, because `VariablesSection` lives in `SceneInspector`,
   * which renders only with an empty selection — `addSceneSound`'s reason.
   */
  async addVariable(): Promise<void> {
    await this.deselect();
    await this.openPanel('inspect');
    await this.panel('inspect')
      .getByTitle('Declare a number or a line of text the game keeps')
      .click();
    await this.settle();
  }

  /**
   * Switches what kind of value a variable holds.
   *
   * A document edit rather than a display toggle: the store converts the value
   * and every rule that reads or writes the variable in the same step, so a
   * caller switching a kind mid-test is asserting that migration too.
   */
  async setVariableKind(index: number, kind: 'Number' | 'Text'): Promise<void> {
    await this.deselect();
    await this.openPanel('inspect');
    await this.setChoice(`Variable ${index} holds`, kind);
    await this.settle();
  }

  /**
   * Renames a declared variable and sets what it starts at.
   *
   * `value` takes either kind, because the field is one question under one
   * label and only its input type changes — a text variable is set by passing a
   * string, after `setVariableKind`.
   */
  async setVariable(index: number, name: string, value: number | string): Promise<void> {
    await this.deselect();
    await this.openPanel('inspect');
    await this.setField(`Variable ${index} name`, name);
    await this.setField(`Variable ${index} starts at`, value);
    await this.settle();
  }

  /**
   * What the panel says a variable reads as in exported code.
   *
   * By index, like every other variable field, because the text of this row
   * *is* the derived key — so the thing being read cannot also be the thing
   * that locates it.
   */
  async variableKey(index: number): Promise<string> {
    await this.deselect();
    await this.openPanel('inspect');
    const hint = this.panel('inspect').getByTitle(`Variable ${index} key`);
    return (await hint.innerText()).replace('reads as ', '').trim();
  }

  /** Deletes a declared variable by name. */
  async removeVariable(name: string): Promise<void> {
    await this.deselect();
    await this.openPanel('inspect');
    await this.panel('inspect').getByTitle(`Delete variable ${name}`).click();
    await this.settle();
  }

  // -- labels ----------------------------------------------------------------

  /**
   * Binds the selected text node's caption to a variable, or unbinds it.
   *
   * One control for both, because a label naming nothing is not a label — which
   * is why there is no `clearLabel` beside this and no checkbox to find.
   */
  async setLabelVariable(name: string | null): Promise<void> {
    await this.openPanel('inspect');
    await this.setChoice('Shows variable', name ?? 'Nothing');
    await this.settle();
  }

  /** Sets one or both of a bound label's format dials on the selected node. */
  async setLabelFormat(format: { decimals?: number; pad?: number }): Promise<void> {
    await this.openPanel('inspect');
    if (format.decimals !== undefined) await this.setField('Decimal places', format.decimals);
    if (format.pad !== undefined) await this.setField('Pad to width', format.pad);
    await this.settle();
  }

  // -- rules -----------------------------------------------------------------

  /** Adds a rule from the scene panel, and returns the name it arrived under. */
  async addRule(): Promise<string> {
    await this.deselect();
    await this.openPanel('inspect');
    await this.panel('inspect').getByTitle('Add a rule to this scene').click();
    await this.settle();
    return this.lastRuleName();
  }

  /** Adds a rule from the selected object's own panel. */
  async addRuleOnNode(name: string): Promise<string> {
    await this.openPanel('inspect');
    await this.panel('inspect').getByTitle(`Add a rule about ${name}`).click();
    await this.settle();
    return this.lastRuleName();
  }

  /** The name of the last rule in whichever panel is open. */
  private async lastRuleName(): Promise<string> {
    const titles = await this.panel('inspect')
      .locator('.rule__summary')
      .last()
      .getAttribute('title');
    return (titles ?? '').replace('Edit ', '');
  }

  /** How many rules the open panel is listing. */
  async ruleCount(): Promise<number> {
    await this.openPanel('inspect');
    return this.panel('inspect').locator('.rule__summary').count();
  }

  /** Expands a rule so its fields can be reached. */
  async openRule(name: string): Promise<void> {
    await this.openPanel('inspect');
    const summary = this.panel('inspect').getByTitle(`Edit ${name}`);
    if (!(await summary.innerText()).startsWith('▾')) await summary.click();
    await this.settle();
  }

  /** Deletes a rule by name, from whichever panel is open. */
  async removeRule(name: string): Promise<void> {
    await this.openRule(name);
    await this.panel('inspect').getByTitle(`Delete rule ${name}`).click();
    await this.settle();
  }

  /** Points a rule at a different moment. Expands it first. */
  async setRuleTrigger(name: string, index: number, option: string): Promise<void> {
    await this.openRule(name);
    await this.setChoice(`Rule ${index} when`, option);
    await this.settle();
  }

  /**
   * Discards the project and starts a new one.
   *
   * The confirm has to be accepted, and without that this method **silently
   * does nothing** on a dirty project: `handleNew` asks before discarding, and
   * Playwright dismisses a dialog it has no handler for. Every existing caller
   * happens to follow this with `openFile`, which replaces the project anyway —
   * so the no-op was invisible until a test called this and then went on using
   * the editor, and saw the old project's assets still in it.
   *
   * Scoped with `on`/`off` rather than `once`: on a clean project no dialog
   * fires at all, and a `once` left armed would accept the next dialog from
   * anywhere in the test — a remove confirm, say, which some specs deliberately
   * dismiss.
   */
  async newProject(): Promise<void> {
    const accept = (dialog: Dialog) => void dialog.accept();
    this.page.on('dialog', accept);
    try {
      await this.openPanel('file');
      await this.panel('file')
        .getByRole('button', { name: this.isMobile ? 'New project' : 'New', exact: true })
        .click();
      await this.settle();
    } finally {
      this.page.off('dialog', accept);
    }
  }

  /** Saves the project and returns the file the browser was handed. */
  async saveToFile(): Promise<{ name: string; contents: string; archive: Buffer }> {
    await this.openPanel('file');
    const download = this.page.waitForEvent('download');
    await this.panel('file')
      .getByRole('button', { name: this.isMobile ? 'Save to device' : 'Save', exact: true })
      .click();
    const file = await download;
    const stream = await file.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const archive = Buffer.concat(chunks);
    const entries = unzipSync(archive);
    const manifest = JSON.parse(strFromU8(entries['project.json'])) as Record<string, unknown>;
    // Preserve the JSON-shaped view used throughout the older editing tests,
    // while returning the real archive for ZIP-specific assertions and opens.
    for (const key of ['assets', 'audio', 'fonts'] as const) {
      const records = (manifest[key] ?? []) as Array<Record<string, unknown>>;
      manifest[key] = records.map(({ path, mimeType, ...record }) => ({
        ...record,
        mimeType,
        dataUrl: `data:${mimeType};base64,${Buffer.from(entries[path as string]).toString('base64')}`,
      }));
    }
    return { name: file.suggestedFilename(), contents: JSON.stringify(manifest), archive };
  }

  /** Opens a project file through the `<input type="file">` path. */
  async openFile(path: string): Promise<void> {
    await this.openPanel('file');
    const chooser = this.page.waitForEvent('filechooser');
    await this.panel('file')
      .getByRole('button', { name: this.isMobile ? 'Open project…' : 'Open', exact: true })
      .click();
    await (await chooser).setFiles(path);
    await this.settle();
  }

  /** Exports generated code and returns it. */
  async exportCode(kind: 'ts' | 'js' | 'html'): Promise<{ name: string; contents: string }> {
    await this.openPanel('file');
    const label = this.isMobile
      ? { ts: 'Scene class (.ts)', js: 'Scene class (.js)', html: 'Runnable page (.html)' }[kind]
      : `.${kind}`;
    const download = this.page.waitForEvent('download');
    await this.panel('file').getByRole('button', { name: label, exact: true }).click();
    const file = await download;
    const stream = await file.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return { name: file.suggestedFilename(), contents: Buffer.concat(chunks).toString('utf8') };
  }
}
