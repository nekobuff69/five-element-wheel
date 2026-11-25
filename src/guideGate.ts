/**
 * First-run gate for the 玩法 card.
 *
 * The card used to be reachable only through the ? button, which demo visitors
 * missed. It now opens itself once per browser session and cannot be dismissed
 * except through 試一試. `?guide=1` forces the gate without consuming the
 * session's first run (see CONTEXT.md → First-run gate).
 */

export const FIRST_RUN_STORAGE_KEY =
  'five-element-wheel.guide.firstRunSeen.v1';
export const FORCE_GUIDE_PARAM = 'guide';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export interface GuideGate {
  isSeen(): boolean;
  markSeen(): void;
}

/**
 * The session's storage when it actually works, otherwise null. Private modes
 * and blocked storage throw on access, not on `typeof`.
 */
export function resolveSessionStorage(): StorageLike | null {
  try {
    const storage = window.sessionStorage;
    const probe = `${FIRST_RUN_STORAGE_KEY}.probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/**
 * The seen flag with an in-memory fallback: a blocked sessionStorage must not
 * re-open the gate on every render, and must never throw into the reducer.
 */
export function createGuideGate(storage: StorageLike | null): GuideGate {
  let memorySeen = false;

  return {
    isSeen() {
      if (memorySeen) return true;
      if (!storage) return false;
      try {
        return storage.getItem(FIRST_RUN_STORAGE_KEY) === '1';
      } catch {
        return false;
      }
    },
    markSeen() {
      memorySeen = true;
      if (!storage) return;
      try {
        storage.setItem(FIRST_RUN_STORAGE_KEY, '1');
      } catch {
        // Quota or a revoked storage after the probe: memory already holds it.
      }
    },
  };
}

/** `?guide=1` re-opens the gate for demo runs. */
export function shouldForceGuide(search: string): boolean {
  return new URLSearchParams(search).get(FORCE_GUIDE_PARAM) === '1';
}

export type GuideMode = 'closed' | 'firstRun' | 'reference';

export function initialGuideMode(
  gate: GuideGate,
  search: string,
): GuideMode {
  if (shouldForceGuide(search)) return 'firstRun';
  return gate.isSeen() ? 'closed' : 'firstRun';
}
