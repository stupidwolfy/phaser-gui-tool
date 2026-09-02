import { SCHEMA_VERSION, type Project } from '../../src/core/schema';

/**
 * A project made of everything a project file should not contain.
 *
 * Generated code is built from free user text, and every hole found so far was
 * in a field nobody had thought to make hostile — the `</script>` in a text
 * object first, and then the *scene name*, which reaches `super(...)` and the
 * class declaration. So this covers every string the exporter interpolates,
 * and the rule when a new field starts reaching the output is to add it here.
 */
export function hostileProject(): Project {
  const breakout = '</script><script>window.__pwned = "yes";</script>';

  return {
    schemaVersion: SCHEMA_VERSION,
    // Reaches the generated <title> and a comment in the file header.
    name: `${breakout}</title><img src=x onerror="window.__pwned='title'">`,
    // Reaches the CDN URL, so it must be validated rather than interpolated.
    phaserVersion: '4.2.1"></script><script>window.__pwned="cdn"</script>',
    assets: [],
    activeSceneId: 'scene-1',
    scenes: [
      {
        id: 'scene-1',
        // Reaches both the class name and super(...).
        name: `Main ${breakout} Scene`,
        width: 960,
        height: 540,
        // Reaches a CSS declaration and a JS string; not a hex colour at all.
        backgroundColor: '#1d2330; } body { background: url(javascript:1) } /*',
        children: [
          {
            id: 'a',
            name: breakout,
            type: 'rectangle',
            visible: true,
            transform: { x: 480, y: 270, rotation: 0, scaleX: 1, scaleY: 1 },
            props: { width: 200, height: 120, fill: '#4f8cff', alpha: 1 },
            children: [],
          },
          {
            id: 'b',
            // Blank, so `toIdentifier` has nothing to work with.
            name: '',
            type: 'ellipse',
            visible: true,
            transform: { x: 200, y: 150, rotation: 0, scaleX: 1, scaleY: 1 },
            // Not a colour, so `hexLiteral` has to reject it.
            props: { width: 100, height: 100, fill: '0xdeadbeef); alert(1); //', alpha: 1 },
            children: [],
          },
          {
            id: 'c',
            // Starts with a digit and repeats the identifier of the next one.
            name: '123 name',
            type: 'text',
            visible: true,
            transform: { x: 480, y: 80, rotation: 0, scaleX: 1, scaleY: 1 },
            props: {
              // The comment opener and the two line terminators JSON allows raw
              // in a string but older JS parsers do not.
              text: `${breakout}<!--\u2028\u2029"quoted" \\ backslash`,
              fontSize: 28,
              color: '#ffffff',
              fontFamily: 'system-ui, sans-serif',
              alpha: 1,
            },
            children: [],
          },
          {
            id: 'e',
            // A group carries its own hostile name into an identifier, and its
            // children reach the export through a second path — the nested
            // emit and the `add([...])` list — that the flat cases never take.
            name: `${breakout} group`,
            type: 'container',
            visible: true,
            // A rotation, and a rotated one at three decimals, because that is
            // what the rotate gesture settles on and nothing else in this
            // fixture had a non-zero angle — so `modifiersFor`'s `.setAngle`
            // line reached neither export toolchain.
            transform: { x: 700, y: 400, rotation: 12.5, scaleX: 1, scaleY: 1 },
            props: { alpha: 1 },
            children: [
              {
                id: 'e1',
                name: breakout,
                type: 'rectangle',
                visible: true,
                // Local coordinates: the group puts it at 700,400.
                transform: { x: 0, y: 0, rotation: -37.125, scaleX: 1, scaleY: 1 },
                props: { width: 120, height: 80, fill: '#22d3ee', alpha: 1 },
                children: [],
              },
            ],
          },
          {
            id: 'd',
            name: 'name123',
            type: 'text',
            visible: true,
            transform: { x: 480, y: 460, rotation: 0, scaleX: 1, scaleY: 1 },
            props: {
              text: 'ordinary',
              fontSize: 20,
              color: '#ffb84f',
              fontFamily: 'system-ui, sans-serif',
              alpha: 1,
            },
            children: [],
          },
        ],
      },
    ],
  };
}
