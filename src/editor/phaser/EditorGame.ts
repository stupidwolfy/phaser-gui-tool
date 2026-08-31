import Phaser from 'phaser';
import { EditorScene } from './EditorScene';

/** Boots a Phaser game bound to `parent`, sized to fill it. */
export function createEditorGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#12151c',
    scale: {
      // RESIZE gives a 1:1 canvas that fills the parent, which is what an
      // editor viewport wants — FIT would letterbox the workspace.
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
    },
    input: {
      // Two touch pointers for pinch-zoom, plus one spare.
      activePointers: 3,
    },
    render: {
      antialias: true,
    },
    banner: false,
    scene: [EditorScene],
  });
}

export function getEditorScene(game: Phaser.Game): EditorScene | undefined {
  return game.scene.getScene(EditorScene.KEY) as EditorScene | undefined;
}
