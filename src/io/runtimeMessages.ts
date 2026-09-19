/** Identifies messages emitted by the game running in the Play iframe. */
export const RUNTIME_MESSAGE_SOURCE = 'phaser-gui-runtime';

export type RuntimeMessage =
  | {
      source: typeof RUNTIME_MESSAGE_SOURCE;
      runId: string;
      kind: 'ready';
    }
  | {
      source: typeof RUNTIME_MESSAGE_SOURCE;
      runId: string;
      kind: 'error';
      message: string;
      stack?: string;
    };

/**
 * Treat the sandbox as an untrusted sender even though this editor generated
 * its page. Rules and future user hooks execute there, so every field crossing
 * the boundary is checked and bounded before React renders it.
 */
export function runtimeMessageOf(value: unknown): RuntimeMessage | null {
  if (!value || typeof value !== 'object') return null;
  const message = value as Record<string, unknown>;
  if (
    message.source !== RUNTIME_MESSAGE_SOURCE ||
    typeof message.runId !== 'string' ||
    message.runId.length === 0 ||
    message.runId.length > 100
  ) {
    return null;
  }
  if (message.kind === 'ready') {
    return { source: RUNTIME_MESSAGE_SOURCE, runId: message.runId, kind: 'ready' };
  }
  if (
    message.kind !== 'error' ||
    typeof message.message !== 'string' ||
    message.message.length === 0
  ) {
    return null;
  }
  return {
    source: RUNTIME_MESSAGE_SOURCE,
    runId: message.runId,
    kind: 'error',
    message: message.message.slice(0, 2_000),
    ...(typeof message.stack === 'string'
      ? { stack: message.stack.slice(0, 20_000) }
      : {}),
  };
}
