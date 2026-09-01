import { test as base, expect, type ConsoleMessage } from '@playwright/test';
import { EditorPage } from './editor';

/**
 * The suite's `test`, with the editor already booted and the console watched.
 *
 * Every spec here asserts an empty console: a Phaser or React error that does
 * not throw all the way up is exactly the class of bug that leaves the document
 * correct and the canvas wrong, which is what this harness exists to catch.
 */

/** Noise that says nothing about the editor's own behaviour. */
const IGNORED = [
  /favicon/i,
  /Failed to load resource: the server responded with a status of 404/i,
];

export const test = base.extend<{ editor: EditorPage; consoleErrors: string[] }>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (message: ConsoleMessage) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (!IGNORED.some((pattern) => pattern.test(text))) errors.push(text);
    });
    page.on('pageerror', (error) => errors.push(`uncaught: ${error.message}`));
    await use(errors);
    expect(errors, 'the editor logged errors').toEqual([]);
  },

  editor: async ({ page, isMobile, consoleErrors }, use) => {
    void consoleErrors; // Attach the listeners before the first navigation.
    await use(await EditorPage.open(page, Boolean(isMobile)));
  },
});

export { expect };
