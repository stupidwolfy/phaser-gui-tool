import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { createEditorGame, getEditorScene } from './phaser/EditorGame';

/**
 * React host for the Phaser canvas.
 *
 * The boundary is one-way by design: React owns this div, Phaser owns
 * everything inside it, and the two communicate only through the store.
 */
export function Viewport({ onReady }: { onReady?: (game: Phaser.Game) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    // StrictMode mounts effects twice in development; without this guard that
    // leaves a second orphaned WebGL context behind.
    if (!container || gameRef.current) return;

    const game = createEditorGame(container);
    gameRef.current = game;
    onReady?.(game);

    // Phaser's ScaleManager watches the window, not the parent element — a
    // sheet opening resizes this div without a window resize. `refresh()` on
    // its own reuses a cached parent size and leaves the canvas one resize
    // behind, so re-measure the parent first.
    const observer = new ResizeObserver(() => {
      game.scale.getParentBounds();
      game.scale.refresh();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      game.destroy(true);
      gameRef.current = null;
    };
    // Intentionally mount-only: re-running this would tear down the game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="viewport" data-testid="viewport" />;
}

/** Re-frames the scene in the viewport. Used by the "Fit" toolbar button. */
export function fitView(game: Phaser.Game | null): void {
  if (!game) return;
  getEditorScene(game)?.zoomToFit();
}
