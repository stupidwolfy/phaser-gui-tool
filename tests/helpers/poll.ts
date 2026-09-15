/**
 * Polls a reading until it satisfies a claim, and answers with the last one.
 *
 * Its own module because two specs need it: `export.spec.ts`, which runs the
 * exported page as a file, and `play.spec.ts`, which runs the same page inside
 * the editor. A simulation reached by two callers is not a thing to have two
 * copies of.
 *
 * The instrument for anything a *simulation* has to reach, and the reason is
 * the suite's oldest recorded trap wearing a new face: what a running game is
 * doing at one wall-clock instant is a race with the frame rate. A physics page
 * under two Playwright workers and two browsers steps at a different effective
 * rate from one running alone, so a fixed `waitForTimeout` and a single
 * screenshot asserts where the ball *happened to be*, not where it ends up. The
 * ramp test in `export.spec.ts` went green twice standalone and red twice in a full run, on a
 * different assertion each time, which is the shape of a wrong instrument
 * rather than a flaky feature.
 *
 * Polling turns it back into the claim the suite is allowed to make — "it
 * reaches this state", a statement about time passing — and it costs nothing on
 * a correct implementation, which reaches it on the first or second read. A
 * wrong one never reaches it and fails on the timeout with the last reading in
 * the message.
 */
export async function reaches<T>(
  read: () => Promise<T>,
  claim: (value: T) => boolean,
  timeout = 8000,
): Promise<T> {
  const started = Date.now();
  let last = await read();
  while (!claim(last) && Date.now() - started < timeout) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    last = await read();
  }
  return last;
}
