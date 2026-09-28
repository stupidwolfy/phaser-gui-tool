import { useSyncExternalStore } from 'react';

/**
 * The editor's own view zoom — the user's camera, never the document's.
 *
 * The limits and the step ladder live here rather than in `EditorScene` so the
 * zoom bar can disable a button at exactly the number the scene clamps to: a
 * control that offers what the camera then takes back reads as broken.
 */
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

/** The stops the buttons and keys move between. Wheel and pinch are continuous. */
export const ZOOM_STEPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;

const EPSILON = 1e-3;

/**
 * The next stop strictly beyond `current` in `dir`. A fitted view sits between
 * stops (0.37, say), so a press lands on the neighbouring stop rather than
 * adding a fixed factor — which is what makes 100% reachable by pressing.
 */
export function nextZoomStep(current: number, dir: 1 | -1): number {
  if (dir > 0) {
    return ZOOM_STEPS.find((step) => step > current + EPSILON) ?? MAX_ZOOM;
  }
  for (let index = ZOOM_STEPS.length - 1; index >= 0; index -= 1) {
    if (ZOOM_STEPS[index] < current - EPSILON) return ZOOM_STEPS[index];
  }
  return MIN_ZOOM;
}

export function zoomPercent(zoom: number): number {
  return Math.round(zoom * 100);
}

export function atMinZoom(zoom: number): boolean {
  return zoom <= MIN_ZOOM + EPSILON;
}

export function atMaxZoom(zoom: number): boolean {
  return zoom >= MAX_ZOOM - EPSILON;
}

// A store of one number, outside zustand on purpose. The scene subscribes to
// every zustand change and re-syncs, so a zoom written there would schedule a
// full sync per wheel tick and per pinch frame — `bounds.ts`' argument for
// living outside the store, arriving from the other direction.
let current = 1;
const listeners = new Set<() => void>();

export function getViewZoom(): number {
  return current;
}

/** Called by `EditorScene.update()` whenever the camera's zoom has moved. */
export function publishViewZoom(zoom: number): void {
  if (zoom === current) return;
  current = zoom;
  for (const listener of listeners) listener();
}

function subscribeViewZoom(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useViewZoom(): number {
  return useSyncExternalStore(subscribeViewZoom, getViewZoom);
}
