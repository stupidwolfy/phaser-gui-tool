import { useShallow } from 'zustand/react/shallow';
import { countAnimationUses, useEditorStore } from '../core/store';
import {
  animationsForAsset,
  findAnimation,
  findAsset,
  frameCountOf,
  frameGridOf,
  type AnimationClip,
} from '../core/schema';
import { CheckboxField, NumberField, SelectField, TextField } from './fields';

/**
 * Choosing, creating and editing the clip a sprite plays.
 *
 * An animation is project state like an image is, so this edits the shared clip
 * rather than something belonging to the sprite in front of you — changing the
 * frame rate here changes it for every sprite playing it, which is the point of
 * clips being shared at all. The panel says so rather than hiding it.
 */

const NO_ANIMATION = '';

/**
 * The frame list as text, with runs collapsed into ranges.
 *
 * A twelve-frame sheet is almost always played straight through, and
 * "0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11" in a 390px-wide field is unreadable
 * and unedittable — while "0-11" is both, and is what a person would write.
 * Runs of one stay bare, so "0-3, 7" is exactly as short as it can be.
 */
export function formatFrameList(frames: number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < frames.length; ) {
    let end = i;
    while (end + 1 < frames.length && frames[end + 1] === frames[end] + 1) end += 1;
    // Two in a row is written out: "0-1" is no shorter than "0, 1" and reads
    // as though a range were meant to be longer.
    parts.push(end > i + 1 ? `${frames[i]}-${frames[end]}` : frames.slice(i, end + 1).join(', '));
    i = end + 1;
  }
  return parts.join(', ');
}

/**
 * Text back into a frame list, accepting both what `formatFrameList` writes and
 * what someone types instead.
 *
 * Descending ranges count down — "3-0" is a sequence played backwards, which is
 * something the list can express and a start/end pair could not. Anything
 * unparseable in a part is dropped rather than failing the whole field: this
 * runs on every keystroke, so half-typed input is the normal case and must not
 * throw the rest of the list away.
 */
export function parseFrameList(text: string): number[] {
  const frames: number[] = [];
  for (const part of text.split(',')) {
    const range = /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(part);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      const step = from <= to ? 1 : -1;
      for (let frame = from; step > 0 ? frame <= to : frame >= to; frame += step) {
        frames.push(frame);
      }
      continue;
    }
    const single = /^\s*(\d+)\s*$/.exec(part);
    if (single) frames.push(Number(single[1]));
  }
  return frames;
}

export function AnimationEditor({
  nodeId,
  assetId,
  animationId,
  onPick,
}: {
  nodeId: string;
  assetId: string | null;
  animationId: string | null;
  onPick: (animationId: string | null) => void;
}) {
  const asset = useEditorStore((s) => findAsset(s.project, assetId));
  // useShallow because the filter builds a new array every call, and zustand
  // compares snapshots by identity — the same reason `useSelectionNodes` does.
  const clips = useEditorStore(useShallow((s) => animationsForAsset(s.project, assetId)));
  const clip = useEditorStore((s) => findAnimation(s.project, animationId));
  const addAnimationFor = useEditorStore((s) => s.addAnimationFor);

  // Only a sheet has a sequence to animate: a plain image is one frame, and a
  // one-frame animation is a still picture with a frame rate.
  if (!asset || !frameGridOf(asset)) {
    return (
      <p className="hint">
        Slice this image into frames above to animate it.
      </p>
    );
  }

  return (
    <>
      <div className="field-row">
        <SelectField
          label="Plays"
          value={animationId ?? NO_ANIMATION}
          options={[
            { value: NO_ANIMATION, label: 'Nothing — a still frame' },
            ...clips.map((entry) => ({ value: entry.id, label: entry.name })),
          ]}
          onChange={(value) => onPick(value === NO_ANIMATION ? null : value)}
        />
      </div>

      <button className="btn btn--block" onClick={() => addAnimationFor(nodeId)}>
        New animation from all {frameCountOf(asset)} frames
      </button>

      {clip && <ClipFields clip={clip} frameCount={frameCountOf(asset)} />}
    </>
  );
}

function ClipFields({ clip, frameCount }: { clip: AnimationClip; frameCount: number }) {
  const updateAnimation = useEditorStore((s) => s.updateAnimation);
  const removeAnimation = useEditorStore((s) => s.removeAnimation);
  const uses = useEditorStore((s) => countAnimationUses(s.project, clip.id));

  return (
    <>
      {/* "Animation name" rather than "Name": the object's own name field is a
          few rows up in the same panel, and two fields labelled Name is
          ambiguous to a reader as well as to a locator. It is also the name the
          exported code plays by, which "Name" alone does not suggest. */}
      <TextField
        label="Animation name"
        value={clip.name}
        onChange={(name) => updateAnimation(clip.id, { name })}
      />
      <TextField
        label="Frames"
        value={formatFrameList(clip.frames)}
        onChange={(text) => updateAnimation(clip.id, { frames: parseFrameList(text) })}
      />
      <div className="field-row">
        <NumberField
          label="Frames/sec"
          value={clip.frameRate}
          min={1}
          onChange={(frameRate) => updateAnimation(clip.id, { frameRate })}
        />
      </div>
      <CheckboxField
        label="Loop forever"
        value={clip.repeat === -1}
        // Phaser counts repeats *after* the first play, so 0 is "play once".
        onChange={(loop) => updateAnimation(clip.id, { repeat: loop ? -1 : 0 })}
      />
      <p className="hint">
        Frames 0–{frameCount - 1} of this image.
        {uses > 1 && ` Shared by ${uses} sprites — editing it changes all of them.`}
      </p>
      <button
        className="btn btn--block btn--danger"
        onClick={() => removeAnimation(clip.id)}
      >
        Delete animation
      </button>
    </>
  );
}
