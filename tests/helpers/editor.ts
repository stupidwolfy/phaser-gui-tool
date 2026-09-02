import { expect, type CDPSession, type Locator, type Page } from '@playwright/test';
import { findColor, type ColorBlob } from './pixels';

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

    const editor = new EditorPage(page, isMobile);
    await page.goto('./');
    await editor.waitForCanvas();
    return editor;
  }

  get canvas(): Locator {
    return this.page.locator('.viewport canvas');
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
      await open.first().getByRole('button', { name: 'Close panel' }).click();
      await expect(open).toHaveCount(0);
    }
    await this.settle();
  }

  // -- scene tree ------------------------------------------------------------

  treeItems(): Locator {
    return this.panel('scene').locator('.tree__item');
  }

  async addObject(label: 'Rectangle' | 'Ellipse' | 'Text' | 'Image' | 'Group'): Promise<void> {
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

  async selectInTree(name: string): Promise<void> {
    await this.openPanel('scene');
    await this.panel('scene').getByRole('button', { name, exact: true }).click();
    await this.settle();
  }

  /**
   * The scene tree's sticky additive-selection toggle. While it is on, a press
   * on a row or on the canvas adds to the selection instead of replacing it —
   * and never starts a move, so a drag test has to turn it off again.
   */
  async setMultiSelect(on: boolean): Promise<void> {
    await this.openPanel('scene');
    const button = this.panel('scene').getByRole('button', { name: 'Multi', exact: true });
    if (((await button.getAttribute('aria-pressed')) === 'true') !== on) await button.click();
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

  async clearGuides(): Promise<void> {
    await this.deselect();
    await this.openPanel('inspect');
    await this.panel('inspect').getByRole('button', { name: 'Clear guides' }).click();
    await this.settle();
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

  /** A checkbox field, whose input carries a different class. */
  checkbox(label: string): Locator {
    return this.labelled(label).locator('input.field__check');
  }

  private labelled(label: string): Locator {
    const exact = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
    return this.panel('inspect')
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
    await this.page.getByRole('button', { name: '↶' }).click();
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
  async newProject(): Promise<void> {
    await this.openPanel('file');
    await this.panel('file')
      .getByRole('button', { name: this.isMobile ? 'New project' : 'New', exact: true })
      .click();
    await this.settle();
  }

  /** Saves the project and returns the file the browser was handed. */
  async saveToFile(): Promise<{ name: string; contents: string }> {
    await this.openPanel('file');
    const download = this.page.waitForEvent('download');
    await this.panel('file')
      .getByRole('button', { name: this.isMobile ? 'Save to device' : 'Save', exact: true })
      .click();
    const file = await download;
    const stream = await file.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return { name: file.suggestedFilename(), contents: Buffer.concat(chunks).toString('utf8') };
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
