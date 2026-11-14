import type { WheelState } from './types';

/**
 * The single derived feedback stream. A pure diff of two consecutive
 * `WheelState` snapshots (plus an optional playback signal) produces the
 * ordered list of feedback events a player should perceive. The reducer is
 * never an event source; everything here is derived, never dispatched.
 *
 * This is the only automated seam for the audiovisual-feedback feature.
 */
export type RestartField = 'bpm' | 'key' | 'octave' | 'loop';

// `snap-changed` is part of the event vocabulary but is derived from the
// drag snap-target signal (not from two WheelState snapshots), so it is not
// emitted here; a later ticket feeds it from useSlotDrag / the palette.
export type FeedbackEvent =
  | { type: 'slot-crossed'; slotIndex: number; hasStone: boolean }
  | { type: 'tack' }
  | { type: 'stone-placed'; slotIndex: number }
  | { type: 'stone-removed'; slotIndex: number }
  | { type: 'snap-changed'; slotIndex: number | null }
  | { type: 'beat-read'; queueIndex: number; hasStone: boolean }
  | { type: 'loop-iteration'; fromIndex: number; toIndex: number }
  | { type: 'hot-reload-pending'; slotIndex: number }
  | { type: 'parameter-restart'; field: RestartField; label: string };

export interface PlaybackSignal {
  playingIndex: number;
  previousPlayingIndex: number;
}

/**
 * Pure feedback-event derivation. No DOM, no audio hardware, no timers.
 */
export function deriveFeedbackEvents(
  prev: WheelState | null,
  next: WheelState,
  playback?: PlaybackSignal,
): FeedbackEvent[] {
  if (prev === null) return [];

  const events: FeedbackEvent[] = [];

  // --- Winding: crossing ticks and the 360' tack --------------------------
  // Both are winding-only; leaving winding silences ticks and tack alike.
  if (next.mode === 'winding') {
    events.push(...deriveCrossings(prev, next));
    events.push(...deriveTack(prev, next));
  }

  events.push(...deriveStoneEdits(prev, next));
  events.push(...deriveHotReload(prev, next));
  events.push(...deriveParameterRestart(prev, next));
  if (playback) events.push(...derivePlayback(next, playback));

  return events;
}

/** A future beat that was edited mid-loop is marked as wet ink, not yet dry. */
function deriveHotReload(prev: WheelState, next: WheelState): FeedbackEvent[] {
  if (next.mode !== 'springBack') return [];
  const pending: FeedbackEvent[] = [];
  for (let i = 0; i < next.slots.length; i++) {
    if (prev.slots[i] === next.slots[i]) continue;
    if (next.queuedSlotIndices.includes(i)) {
      pending.push({ type: 'hot-reload-pending', slotIndex: i });
    }
  }
  return pending;
}

/** A parameter edit restarts the whole phrase; explain why with an inscription. */
function deriveParameterRestart(prev: WheelState, next: WheelState): FeedbackEvent[] {
  if (prev.mode !== 'springBack' || next.mode !== 'springBack') return [];
  const restarts: FeedbackEvent[] = [];
  if (prev.bpm !== next.bpm) {
    restarts.push({
      type: 'parameter-restart',
      field: 'bpm',
      label: `重起 · 拍速 ${prev.bpm}→${next.bpm}`,
    });
  }
  if (prev.key !== next.key) {
    restarts.push({
      type: 'parameter-restart',
      field: 'key',
      label: `重起 · 調 ${prev.key}→${next.key}`,
    });
  }
  if (prev.octave !== next.octave) {
    restarts.push({
      type: 'parameter-restart',
      field: 'octave',
      label: `重起 · 八度 ${prev.octave}→${next.octave}`,
    });
  }
  if (prev.loop !== next.loop) {
    restarts.push({
      type: 'parameter-restart',
      field: 'loop',
      label: `重起 · 循環 ${prev.loop ? '開' : '關'}→${next.loop ? '開' : '關'}`,
    });
  }
  return restarts;
}

/** One beat-read per index change; a loop-iteration when the read wraps down. */
function derivePlayback(next: WheelState, playback: PlaybackSignal): FeedbackEvent[] {
  const { playingIndex, previousPlayingIndex } = playback;
  if (playingIndex < 0) return [];
  if (playingIndex === previousPlayingIndex) return [];
  const events: FeedbackEvent[] = [];
  const slot = next.queuedSlotIndices[playingIndex];
  events.push({
    type: 'beat-read',
    queueIndex: playingIndex,
    hasStone: slot != null ? next.slots[slot] != null : false,
  });
  if (playingIndex < previousPlayingIndex) {
    events.push({
      type: 'loop-iteration',
      fromIndex: previousPlayingIndex,
      toIndex: playingIndex,
    });
  }
  return events;
}

/**
 * A full RESET collapses a *worked* wheel to its pristine state in one action;
 * it is silence, not a burst of removal sounds. A single stone removal from an
 * otherwise pristine ready wheel is an ordinary edit and must still sound.
 */
function isFullReset(prev: WheelState, next: WheelState): boolean {
  const pristineNext =
    next.mode === 'ready' &&
    next.queuedSlotIndices.length === 0 &&
    next.rotation === 0 &&
    next.selectedStone === null &&
    next.direction === null &&
    next.slots.every((s) => s === null);
  if (!pristineNext) return false;

  const hadSession =
    prev.mode !== 'ready' ||
    prev.rotation !== 0 ||
    prev.queuedSlotIndices.length > 0 ||
    prev.currentSlotAtHead !== null ||
    prev.direction !== null ||
    prev.selectedStone !== null;
  // Clearing several stones at once is a wholesale clear, never a single edit.
  const bulkClear = prev.slots.filter((s) => s !== null).length > 1;
  return hadSession || bulkClear;
}

function deriveStoneEdits(prev: WheelState, next: WheelState): FeedbackEvent[] {
  if (isFullReset(prev, next)) return [];
  const edits: FeedbackEvent[] = [];
  for (let i = 0; i < next.slots.length; i++) {
    if (prev.slots[i] === next.slots[i]) continue;
    if (next.slots[i] != null) {
      edits.push({ type: 'stone-placed', slotIndex: i });
    } else {
      edits.push({ type: 'stone-removed', slotIndex: i });
    }
  }
  return edits;
}

/** Newly queued slots are the growth of the queue during a wind action. */
function deriveCrossings(prev: WheelState, next: WheelState): FeedbackEvent[] {
  // Interrupting a springBack resets the queue in the reducer, so the whole
  // next queue is a fresh set of crossings; otherwise only the appended tail
  // (after the common prefix with prev) is new.
  const baseline = prev.mode === 'springBack' ? [] : prev.queuedSlotIndices;
  let prefix = 0;
  while (
    prefix < baseline.length &&
    prefix < next.queuedSlotIndices.length &&
    baseline[prefix] === next.queuedSlotIndices[prefix]
  ) {
    prefix++;
  }
  let growth = next.queuedSlotIndices.slice(prefix);
  // Throttle fast winds: at most 3 ticks per frame, keep the latest in order.
  if (growth.length > 3) growth = growth.slice(-3);
  return growth.map((slotIndex) => ({
    type: 'slot-crossed' as const,
    slotIndex,
    hasStone: next.slots[slotIndex] != null,
  }));
}

/** The tack fires once, on the upward crossing of |rotation| through 360'. */
function deriveTack(prev: WheelState, next: WheelState): FeedbackEvent[] {
  const prevAbs = Math.abs(prev.rotation);
  const nextAbs = Math.abs(next.rotation);
  if (prevAbs < 360 && nextAbs >= 360) {
    return [{ type: 'tack' }];
  }
  return [];
}
