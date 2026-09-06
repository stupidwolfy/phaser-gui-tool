import { useShallow } from 'zustand/react/shallow';
import { countAnimationUses, useEditorStore } from '../core/store';
import {
  animationsForAsset,
  findAnimation,
  findAsset,
  atlasOf,
  frameCountOf,
  frameGridOf,
  frameNamesOf,
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
export function formatFrameList(frames: readonly (number | string)[]): string {
  // Names are written out and never collapsed, and that is not a gap. A range
  // is arithmetic on indices; `hero_run_01-hero_run_04` would mean inventing a
  // naming convention and reading it back — which is `generateFrameNames`'
  // `prefix`/`zeroPad` scheme entering the document as a second way to say what
  // a list already says, and it would only work on names that happen to be
  // numbered. A comma list is what a person would write for names anyway.
  if (frames.some((frame) => typeof frame === 'string')) return frames.join(', ');

  const indices = frames as readonly number[];
  const parts: string[] = [];
  for (let i = 0; i < indices.length; ) {
    let end = i;
    while (end + 1 < indices.length && indices[end + 1] === indices[end] + 1) end += 1;
    // Two in a row is written out: "0-1" is no shorter than "0, 1" and reads
    // as though a range were meant to be longer.
    parts.push(
      end > i + 1 ? `${indices[i]}-${indices[end]}` : indices.slice(i, end + 1).join(', '),
    );
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
export function parseFrameList(text: string, names?: readonly string[]): (number | string)[] {
  // A cut of names parses as names, full stop — a frame called "3" is a legal
  // atlas frame and coercing it to the number 3 would silently ask a grid
  // question of an atlas. Which cut applies is the *asset's* answer, passed in,
  // rather than something sniffed per part where a half-typed list could
  // disagree with itself halfway down.
  if (names && names.length > 0) {
    const known = new Set(names);
    return text
      .split(',')
      .map((part) => part.trim())
      .filter((part) => known.has(part));
  }

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

  // Only a cut image has a sequence to animate, either way it was cut: a plain
  // image is one frame, and a one-frame animation is a still picture with a
  // frame rate.
  if (!asset || (!frameGridOf(asset) && !atlasOf(asset))) {
    return (
      <p className="hint">
        Slice this image into frames above, or attach an atlas, to animate it.
      </p>
    );
  }
  const names = frameNamesOf(asset);

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

      {clip && <ClipFields clip={clip} frameCount={frameCountOf(asset)} names={names} />}
    </>
  );
}

function ClipFields({
  clip,
  frameCount,
  names,
}: {
  clip: AnimationClip;
  frameCount: number;
  names: readonly string[];
}) {
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
        onChange={(text) => updateAnimation(clip.id, { frames: parseFrameList(text, names) })}
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
        {names.length > 0
          ? `Named frames of this atlas, in order, separated by commas: ${names.join(', ')}.`
          : `Frames 0–${frameCount - 1} of this image.`}
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
