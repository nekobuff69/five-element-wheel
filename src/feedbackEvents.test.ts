import { describe, it, expect } from 'vitest';
import { deriveFeedbackEvents } from './feedbackEvents';
import { initialWheelState } from './wheelReducer';
import type { WheelState } from './types';

function state(partial: Partial<WheelState> = {}): WheelState {
  return { ...initialWheelState, ...partial };
}

describe('deriveFeedbackEvents — prev state', () => {
  it('emits nothing when there is no previous state', () => {
    expect(deriveFeedbackEvents(null, state())).toEqual([]);
    expect(
      deriveFeedbackEvents(null, state({ mode: 'winding', queuedSlotIndices: [9] }), {
        playingIndex: 0,
        previousPlayingIndex: -1,
      }),
    ).toEqual([]);
  });
});

describe('deriveFeedbackEvents — winding crossings', () => {
  it('emits one slot-crossed per newly queued slot, in encounter order', () => {
    const prev = state({ mode: 'winding', queuedSlotIndices: [9] });
    const next = state({ mode: 'winding', queuedSlotIndices: [9, 8, 7] });
    expect(deriveFeedbackEvents(prev, next)).toEqual([
      { type: 'slot-crossed', slotIndex: 8, hasStone: false },
      { type: 'slot-crossed', slotIndex: 7, hasStone: false },
    ]);
  });

  it('distinguishes filled and empty slots in hasStone', () => {
    const slots: (WheelState['slots'][number])[] = Array(10).fill(null);
    slots[9] = 'earth';
    // slot 8 stays empty
    const prev = state({ mode: 'winding', slots });
    const next = state({ mode: 'winding', slots, queuedSlotIndices: [9, 8] });
    expect(deriveFeedbackEvents(prev, next)).toEqual([
      { type: 'slot-crossed', slotIndex: 9, hasStone: true },
      { type: 'slot-crossed', slotIndex: 8, hasStone: false },
    ]);
  });

  it('throttles a fast wind to at most 3 crossings, keeping the latest in order', () => {
    const prev = state({ mode: 'winding' });
    const next = state({ mode: 'winding', queuedSlotIndices: [9, 8, 7, 6, 5] });
    expect(deriveFeedbackEvents(prev, next)).toEqual([
      { type: 'slot-crossed', slotIndex: 7, hasStone: false },
      { type: 'slot-crossed', slotIndex: 6, hasStone: false },
      { type: 'slot-crossed', slotIndex: 5, hasStone: false },
    ]);
  });
});

describe('deriveFeedbackEvents — tack', () => {
  it('fires exactly once when |rotation| crosses 360 upward during winding', () => {
    const prev = state({ mode: 'winding', rotation: 359 });
    const next = state({ mode: 'winding', rotation: 360 });
    expect(deriveFeedbackEvents(prev, next)).toEqual([{ type: 'tack' }]);
  });

  it('does not repeat while staying at or above 360, and re-arms after dropping below', () => {
    const at360 = state({ mode: 'winding', rotation: 360 });
    expect(deriveFeedbackEvents(at360, state({ mode: 'winding', rotation: 360 }))).toEqual([]);
    const below = state({ mode: 'winding', rotation: 300 });
    expect(deriveFeedbackEvents(at360, below)).toEqual([]);
    const again = state({ mode: 'winding', rotation: 360 });
    expect(deriveFeedbackEvents(below, again)).toEqual([{ type: 'tack' }]);
  });

  it('emits no crossing or tack events outside winding', () => {
    const prev = state({ mode: 'winding', rotation: 350, queuedSlotIndices: [9] });
    const released = state({ mode: 'springBack', rotation: 360, queuedSlotIndices: [9, 8] });
    expect(deriveFeedbackEvents(prev, released)).toEqual([]);
    const ready = state({ mode: 'ready', rotation: 0 });
    expect(deriveFeedbackEvents(prev, ready)).toEqual([]);
  });
});

describe('deriveFeedbackEvents — stone edits', () => {
  const empty = () => Array<WheelState['slots'][number]>(10).fill(null);

  it('emits stone-placed when a slot goes from empty to filled', () => {
    const before = empty();
    const after = empty();
    after[3] = 'fire';
    expect(deriveFeedbackEvents(state({ slots: before }), state({ slots: after }))).toEqual([
      { type: 'stone-placed', slotIndex: 3 },
    ]);
  });

  it('emits stone-removed when a slot goes from filled to empty', () => {
    const before = empty();
    before[4] = 'water';
    const after = empty();
    expect(deriveFeedbackEvents(state({ slots: before }), state({ slots: after }))).toEqual([
      { type: 'stone-removed', slotIndex: 4 },
    ]);
  });

  it('treats a replace as a placement and a move as removal + placement', () => {
    const replaceBefore = empty();
    replaceBefore[1] = 'earth';
    const replaceAfter = empty();
    replaceAfter[1] = 'metal';
    expect(
      deriveFeedbackEvents(state({ slots: replaceBefore }), state({ slots: replaceAfter })),
    ).toEqual([{ type: 'stone-placed', slotIndex: 1 }]);

    const moveBefore = empty();
    moveBefore[2] = 'wood';
    const moveAfter = empty();
    moveAfter[5] = 'wood';
    expect(
      deriveFeedbackEvents(state({ slots: moveBefore }), state({ slots: moveAfter })),
    ).toEqual([
      { type: 'stone-removed', slotIndex: 2 },
      { type: 'stone-placed', slotIndex: 5 },
    ]);
  });

  it('emits edits during springBack too (hot reload)', () => {
    const before = empty();
    before[6] = 'metal';
    const after = empty();
    after[6] = 'wood';
    expect(
      deriveFeedbackEvents(
        state({ mode: 'springBack', slots: before }),
        state({ mode: 'springBack', slots: after }),
      ),
    ).toEqual([{ type: 'stone-placed', slotIndex: 6 }]);
  });

  it('a full RESET produces no stone-removed events', () => {
    const before = empty();
    before[0] = 'earth';
    before[7] = 'fire';
    const prev = state({
      mode: 'winding',
      rotation: 210,
      queuedSlotIndices: [9, 8],
      slots: before,
      selectedStone: 'earth',
    });
    const next = state({ mode: 'ready', slots: empty(), selectedStone: null });
    expect(deriveFeedbackEvents(prev, next)).toEqual([]);
  });
});

describe('deriveFeedbackEvents — parameter restart', () => {
  it('emits a parameter-restart with a Chinese label when key changes during springBack', () => {
    const prev = state({ mode: 'springBack', key: 'F' });
    const next = state({ mode: 'springBack', key: 'G' });
    expect(deriveFeedbackEvents(prev, next)).toEqual([
      { type: 'parameter-restart', field: 'key', label: '重起 · 調 F→G' },
    ]);
  });

  it('labels bpm, octave and loop changes', () => {
    expect(
      deriveFeedbackEvents(
        state({ mode: 'springBack', bpm: 150 }),
        state({ mode: 'springBack', bpm: 170 }),
      ),
    ).toEqual([{ type: 'parameter-restart', field: 'bpm', label: '重起 · 拍速 150→170' }]);
    expect(
      deriveFeedbackEvents(
        state({ mode: 'springBack', octave: 4 }),
        state({ mode: 'springBack', octave: 5 }),
      ),
    ).toEqual([{ type: 'parameter-restart', field: 'octave', label: '重起 · 八度 4→5' }]);
    expect(
      deriveFeedbackEvents(
        state({ mode: 'springBack', loop: true }),
        state({ mode: 'springBack', loop: false }),
      ),
    ).toEqual([
      { type: 'parameter-restart', field: 'loop', label: '重起 · 循環 開→關' },
    ]);
  });

  it('does not emit parameter-restart unless both modes are springBack', () => {
    expect(
      deriveFeedbackEvents(state({ mode: 'ready', key: 'F' }), state({ mode: 'ready', key: 'G' })),
    ).toEqual([]);
    expect(
      deriveFeedbackEvents(
        state({ mode: 'winding', bpm: 150 }),
        state({ mode: 'winding', bpm: 170 }),
      ),
    ).toEqual([]);
  });
});

describe('deriveFeedbackEvents — playback signal', () => {
  const empty = () => Array<WheelState['slots'][number]>(10).fill(null);
  // queue: beat 0 = slot 9 (a stone), beat 1 = slot 8 (a rest)
  function playing(): WheelState {
    const slots = empty();
    slots[9] = 'earth';
    return state({ mode: 'springBack', queuedSlotIndices: [9, 8], slots });
  }

  it('emits one beat-read per playingIndex change', () => {
    const p = playing();
    expect(
      deriveFeedbackEvents(p, p, { playingIndex: 0, previousPlayingIndex: -1 }),
    ).toEqual([{ type: 'beat-read', queueIndex: 0, hasStone: true }]);
  });

  it('emits beat-read for rests too (hasStone false)', () => {
    const p = playing();
    expect(
      deriveFeedbackEvents(p, p, { playingIndex: 1, previousPlayingIndex: 0 }),
    ).toEqual([{ type: 'beat-read', queueIndex: 1, hasStone: false }]);
  });

  it('emits no beat-read when the index is unchanged', () => {
    const p = playing();
    expect(
      deriveFeedbackEvents(p, p, { playingIndex: 1, previousPlayingIndex: 1 }),
    ).toEqual([]);
  });

  it('emits loop-iteration once when the index wraps to a lower value', () => {
    const p = playing();
    expect(
      deriveFeedbackEvents(p, p, { playingIndex: 0, previousPlayingIndex: 1 }),
    ).toEqual([
      { type: 'beat-read', queueIndex: 0, hasStone: true },
      { type: 'loop-iteration', fromIndex: 1, toIndex: 0 },
    ]);
  });

  it('does not replay missed beats when the index jumps forward', () => {
    const p = playing();
    const many = state({ mode: 'springBack', queuedSlotIndices: [9, 8, 7, 6, 5, 4, 3, 2], slots: p.slots });
    expect(
      deriveFeedbackEvents(many, many, { playingIndex: 7, previousPlayingIndex: 2 }),
    ).toEqual([{ type: 'beat-read', queueIndex: 7, hasStone: false }]);
  });
});

describe('deriveFeedbackEvents — hot reload pending', () => {
  const empty = () => Array<WheelState['slots'][number]>(10).fill(null);

  it('emits hot-reload-pending for an edited queued slot during springBack', () => {
    const before = empty();
    before[9] = 'earth';
    const after = empty();
    after[9] = 'metal';
    const prev = state({ mode: 'springBack', queuedSlotIndices: [9, 8], slots: before });
    const next = state({ mode: 'springBack', queuedSlotIndices: [9, 8], slots: after });
    expect(deriveFeedbackEvents(prev, next)).toEqual([
      { type: 'stone-placed', slotIndex: 9 },
      { type: 'hot-reload-pending', slotIndex: 9 },
    ]);
  });

  it('does not emit hot-reload-pending for a non-queued slot edit', () => {
    const before = empty();
    const after = empty();
    after[3] = 'fire';
    const prev = state({ mode: 'springBack', queuedSlotIndices: [9, 8], slots: before });
    const next = state({ mode: 'springBack', queuedSlotIndices: [9, 8], slots: after });
    expect(deriveFeedbackEvents(prev, next)).toEqual([
      { type: 'stone-placed', slotIndex: 3 },
    ]);
  });
});

describe('deriveFeedbackEvents — snap-changed signal', () => {
  // The snap target is pointer-local state supplied as an explicit signal. A
  // change should read as one magnet click, not a 60fps stream of events.
  it('emits snap-changed with the new slot index when the target changes', () => {
    const s = state();
    expect(
      deriveFeedbackEvents(s, s, {
        playingIndex: -1,
        previousPlayingIndex: -1,
        snapTarget: 4,
        previousSnapTarget: 3,
      }),
    ).toEqual([{ type: 'snap-changed', slotIndex: 4 }]);
  });

  it('emits no snap event when the target is unchanged, null, or absent', () => {
    const s = state();
    // unchanged
    expect(
      deriveFeedbackEvents(s, s, {
        playingIndex: -1,
        previousPlayingIndex: -1,
        snapTarget: 4,
        previousSnapTarget: 4,
      }),
    ).toEqual([]);
    // released / no snap
    expect(
      deriveFeedbackEvents(s, s, {
        playingIndex: -1,
        previousPlayingIndex: -1,
        snapTarget: null,
        previousSnapTarget: 4,
      }),
    ).toEqual([]);
    // no snap fields at all (backwards compatible with a plain playback signal)
    expect(
      deriveFeedbackEvents(s, s, { playingIndex: -1, previousPlayingIndex: -1 }),
    ).toEqual([]);
  });
});

describe('deriveFeedbackEvents — hot reload future beats', () => {
  const empty = () => Array<WheelState['slots'][number]>(10).fill(null);
  // Queue [9, 8, 7, 6, 5]; playingIndex 2 means beat 2 (slot 7) is sounding.
  // A changed slot at queue position < 2 is a past beat, >= 2 is a future beat.
  function editing(slotIndex: number): [WheelState, WheelState] {
    const before = empty();
    before[slotIndex] = 'earth';
    const after = empty();
    after[slotIndex] = 'metal';
    return [
      state({ mode: 'springBack', queuedSlotIndices: [9, 8, 7, 6, 5], slots: before }),
      state({ mode: 'springBack', queuedSlotIndices: [9, 8, 7, 6, 5], slots: after }),
    ];
  }

  it('suppresses hot-reload-pending for a beat already played', () => {
    const [prev, next] = editing(9); // slot 9 is queue position 0 (past)
    expect(
      deriveFeedbackEvents(prev, next, {
        playingIndex: 2,
        previousPlayingIndex: 2,
        snapTarget: null,
        previousSnapTarget: null,
      }),
    ).toEqual([{ type: 'stone-placed', slotIndex: 9 }]);
  });

  it('emits hot-reload-pending for a future beat', () => {
    const [prev, next] = editing(6); // slot 6 is queue position 3 (future)
    expect(
      deriveFeedbackEvents(prev, next, {
        playingIndex: 2,
        previousPlayingIndex: 2,
        snapTarget: null,
        previousSnapTarget: null,
      }),
    ).toEqual([
      { type: 'stone-placed', slotIndex: 6 },
      { type: 'hot-reload-pending', slotIndex: 6 },
    ]);
  });
});
