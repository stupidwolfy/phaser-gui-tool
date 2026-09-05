import { useEffect, useState } from 'react';
import { AudioImportError, formatAudioSize, formatDuration, importAudioFile } from '../core/audio';
import { countAudioUses, useActiveScene, useEditorStore } from '../core/store';
import { findAudio, soundsOf, type AudioAsset, type SceneSound } from '../core/schema';
import { audioKeyOf } from '../io/exportPhaser';
import { pickAudioFile } from '../io/fileIO';
import { CheckboxField, NumberField, SelectField } from './fields';

/**
 * Importing sounds, and registering them in a scene.
 *
 * `AssetPicker` one medium over, and the same whole of asset management: the
 * bytes live in the document, so there is nowhere else for a sound to be.
 * Errors are shown here rather than raised as a toast for that file's reason —
 * this is where the user is looking, and an import failure usually needs them
 * to do something about it.
 *
 * Two halves, and the split is the feature. The upper list is the project's
 * sounds, shared by every scene. The lower one is what *this* scene registers,
 * which is what the exporter preloads and what it gives a name to. A sound in
 * the table and in no scene ships nothing, which is deliberate: an export
 * should carry the scene, not the editor's whole workbench.
 */

/**
 * The one element anything is auditioned through.
 *
 * One rather than one per row, because two would be two notions of what is
 * playing — the eraser rule from the tile bar and the marker rule from the
 * emitters, arriving a third time. Module-level rather than a ref, so that
 * closing the sheet while something is playing cannot strand a sound with
 * nothing left on screen able to stop it.
 *
 * Which row is playing is held once too, beside it in `AudioSection` rather
 * than per row — the same rule, and the version of it that is easy to get
 * wrong: with a `playing` flag on each row, starting a second sound pauses the
 * first and leaves its ■ showing forever, because nothing told it.
 */
let auditioning: HTMLAudioElement | null = null;

function stopAudition(): void {
  auditioning?.pause();
  auditioning = null;
}

export function AudioSection() {
  const audio = useEditorStore((s) => s.project.audio);
  const addAudio = useEditorStore((s) => s.addAudio);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Nothing should still be playing once this panel is gone: on mobile it is a
  // sheet, and a sound outliving it has no visible control left at all.
  useEffect(() => stopAudition, []);

  const importAudio = async () => {
    setError(null);
    const file = await pickAudioFile();
    if (!file) return;

    setBusy(true);
    try {
      addAudio(await importAudioFile(file));
    } catch (failure) {
      setError(
        failure instanceof AudioImportError
          ? failure.message
          : `Could not import ${file.name}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="panel__section">Audio</div>

      <button
        className="btn btn--block"
        disabled={busy}
        onClick={() => void importAudio()}
      >
        {busy ? 'Importing…' : 'Import audio…'}
      </button>

      {error && <p className="hint hint--error">{error}</p>}

      {audio.length > 0 && (
        <ul className="assets">
          {audio.map((asset) => (
            <AudioRow
              key={asset.id}
              asset={asset}
              playing={playingId === asset.id}
              onPlayingChange={setPlayingId}
            />
          ))}
        </ul>
      )}

      {audio.length === 0 && !busy && (
        <p className="hint">
          No sounds yet. Import one, then add it to a scene to have the export
          load it.
        </p>
      )}

      {audio.length > 0 && <SceneSoundsSection />}
    </>
  );
}

function AudioRow({
  asset,
  playing,
  onPlayingChange,
}: {
  asset: AudioAsset;
  playing: boolean;
  onPlayingChange: (id: string | null) => void;
}) {
  const removeAudio = useEditorStore((s) => s.removeAudio);
  const addSceneSound = useEditorStore((s) => s.addSceneSound);
  const uses = useEditorStore((s) => countAudioUses(s.project, asset.id));

  const audition = () => {
    stopAudition();
    if (playing) {
      onPlayingChange(null);
      return;
    }
    const element = new Audio(asset.dataUrl);
    element.addEventListener('ended', () => onPlayingChange(null));
    auditioning = element;
    // The press *is* the gesture the autoplay policy wants, so this resolves —
    // but an unhandled rejection would be a page error, and the fixture counts
    // those, so the failure is swallowed rather than surfaced.
    void element.play().then(
      () => onPlayingChange(asset.id),
      () => onPlayingChange(null),
    );
  };

  const remove = () => {
    // Removing takes the scene entries with it, in one undo step — so the
    // warning has to say how many, not just ask "are you sure?".
    if (
      uses > 0 &&
      !window.confirm(
        `${asset.name} is used by ${uses} scene${uses === 1 ? '' : 's'}. ` +
          'Remove it and the entries that play it?',
      )
    ) {
      return;
    }
    stopAudition();
    onPlayingChange(null);
    removeAudio(asset.id);
  };

  return (
    <li className="assets__item">
      <button
        className="icon-btn"
        onClick={audition}
        // Never the bare file name: the mobile tab bar matches single common
        // words exactly, so a sound called "Scene" would put a second button
        // reading exactly "Scene" on the page.
        aria-label={`Audition ${asset.name}`}
        title={playing ? 'Stop' : 'Play this sound'}
      >
        {playing ? '■' : '▶'}
      </button>
      <button
        className="assets__pick"
        onClick={() => addSceneSound(asset.id)}
        title={`Use ${asset.name}`}
      >
        <span className="assets__meta">
          <span className="assets__name">{asset.name}</span>
          {/* The key as well as the name, because "Jump SFX (final).wav" plays
              as `jumpSFXFinal` and the user has to be able to read that before
              typing it into a `play()` call of their own. */}
          <span className="assets__detail">
            {formatDuration(asset.duration)} · {formatAudioSize(asset)} · plays as{' '}
            {audioKeyOf(asset.name)}
          </span>
        </span>
      </button>
      <button
        className="icon-btn icon-btn--danger"
        onClick={remove}
        aria-label={`Remove ${asset.name}`}
        title="Remove sound from the project"
      >
        ✕
      </button>
    </li>
  );
}

/**
 * What this scene registers, which is what the export loads and names.
 *
 * Hidden when the scene registers nothing, the way `WorldSection` hides itself
 * until something has a body: a heading over an empty list is width a 390px
 * panel does not have to spend on saying "nothing here".
 */
function SceneSoundsSection() {
  const project = useEditorStore((s) => s.project);
  const scene = useActiveScene();
  // Derived outside the selector: `soundsOf` builds a fresh array every call,
  // so selecting it directly compares unequal on every store change and loops
  // forever — the `tileMapOf` trap.
  const sounds = soundsOf(project, scene);
  if (sounds.length === 0) return null;

  return (
    <>
      <div className="panel__section">In this scene</div>
      {sounds.map((sound) => (
        <SceneSoundRow key={sound.id} sound={sound} />
      ))}
    </>
  );
}

function SceneSoundRow({ sound }: { sound: SceneSound }) {
  const project = useEditorStore((s) => s.project);
  const updateSceneSound = useEditorStore((s) => s.updateSceneSound);
  const removeSceneSound = useEditorStore((s) => s.removeSceneSound);
  const asset = findAudio(project, sound.audioId);
  if (!asset) return null;

  return (
    <div className="sound-row">
      <div className="sound-row__head">
        <span className="assets__name">{asset.name}</span>
        <button
          className="icon-btn icon-btn--danger"
          onClick={() => removeSceneSound(sound.id)}
          aria-label={`Stop this scene using ${asset.name}`}
          title="Take this sound out of the scene"
        >
          ✕
        </button>
      </div>
      <SelectField
        label="Sound"
        value={sound.audioId}
        options={project.audio.map((entry) => ({ value: entry.id, label: entry.name }))}
        onChange={(audioId) => updateSceneSound(sound.id, { audioId })}
      />
      <NumberField
        label="Volume"
        value={sound.volume}
        step={0.05}
        min={0}
        max={1}
        onChange={(volume) => updateSceneSound(sound.id, { volume })}
      />
      <CheckboxField
        label="Loop"
        value={sound.loop}
        onChange={(loop) => updateSceneSound(sound.id, { loop })}
      />
      {/* "Play on scene start", not "Autoplay": the second reads as the HTML
          `<audio autoplay>` attribute, which is a browser-policy idea a user
          would reasonably confuse with this one. This says where it happens. */}
      <CheckboxField
        label="Play on scene start"
        value={sound.autoplay}
        onChange={(autoplay) => updateSceneSound(sound.id, { autoplay })}
      />
    </div>
  );
}
