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
  // Pointer-local snap target supplied by the drag hooks as an explicit
  // signal; snap-changed is derived from it, not from the WheelState diff.
  snapTarget?: number | null;
  previousSnapTarget?: number | null;
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
  events.push(...deriveHotReload(prev, next, playback?.playingIndex));
  events.push(...deriveParameterRestart(prev, next));
  if (playback) {
    events.push(...deriveSnap(playback));
    events.push(...derivePlayback(next, playback));
  }

  return events;
}

/** A future beat that was edited mid-loop is marked as wet ink, not yet dry. */
function deriveHotReload(
  prev: WheelState,
  next: WheelState,
  playingIndex?: number,
): FeedbackEvent[] {
  if (next.mode !== 'springBack') return [];
  const pending: FeedbackEvent[] = [];
  for (let i = 0; i < next.slots.length; i++) {
    if (prev.slots[i] === next.slots[i]) continue;
    if (!next.queuedSlotIndices.includes(i)) continue;
    // Only future beats: when a playback index is known, a beat whose queue
    // position is already behind the read head is not marked wet. With no
    // playing index (or before playback starts) every queued edit is marked,
    // preserving the pre-signal behaviour.
    if (playingIndex !== undefined && playingIndex >= 0) {
      const pos = next.queuedSlotIndices.indexOf(i);
      if (pos < playingIndex) continue;
    }
    pending.push({ type: 'hot-reload-pending', slotIndex: i });
  }
  return pending;
}

/** One snap-changed per snap-target change; silence when unchanged or null. */
function deriveSnap(playback: PlaybackSignal): FeedbackEvent[] {
  const { snapTarget, previousSnapTarget } = playback;
  if (snapTarget === undefined || snapTarget === null) return [];
  if (snapTarget === previousSnapTarget) return [];
  return [{ type: 'snap-changed', slotIndex: snapTarget }];
}

type RestartValue = string | number | boolean;

/** Ordered bpm → key → octave → loop, each with its exact Chinese label. */
const RESTART_DESCRIPTORS: {
  field: RestartField;
  read: (s: WheelState) => RestartValue;
  format: (from: RestartValue, to: RestartValue) => string;
}[] = [
  { field: 'bpm', read: (s) => s.bpm, format: (a, b) => `重起 · 拍速 ${a}→${b}` },
  { field: 'key', read: (s) => s.key, format: (a, b) => `重起 · 調 ${a}→${b}` },
  { field: 'octave', read: (s) => s.octave, format: (a, b) => `重起 · 八度 ${a}→${b}` },
  {
    field: 'loop',
    read: (s) => s.loop,
    format: (a, b) => `重起 · 循環 ${a ? '開' : '關'}→${b ? '開' : '關'}`,
  },
];

/** A parameter edit restarts the whole phrase; explain why with an inscription. */
function deriveParameterRestart(prev: WheelState, next: WheelState): FeedbackEvent[] {
  if (prev.mode !== 'springBack' || next.mode !== 'springBack') return [];
  const restarts: FeedbackEvent[] = [];
  for (const d of RESTART_DESCRIPTORS) {
    const from = d.read(prev);
    const to = d.read(next);
    if (from !== to) {
      restarts.push({ type: 'parameter-restart', field: d.field, label: d.format(from, to) });
    }
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
  const growth = next.queuedSlotIndices.slice(prefix);
  // A reverse crossing removes a slot from the queue. Undo is LIFO, so the
  // queue tail leaves first — reverse the removed set to recover tick order.
  const removed = baseline
    .filter((s) => !next.queuedSlotIndices.includes(s))
    .reverse();
  const crossed = [...removed, ...growth];
  // Throttle fast winds: at most 3 ticks per frame, keep the latest in order.
  const limited = crossed.length > 3 ? crossed.slice(-3) : crossed;
  return limited.map((slotIndex) => ({
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
