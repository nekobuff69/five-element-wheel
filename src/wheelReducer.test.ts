import { describe, it, expect } from 'vitest';
import { wheelReducer, initialWheelState } from './wheelReducer';
import type { WheelState } from './types';

function createState(overrides: Partial<WheelState>): WheelState {
  return { ...initialWheelState, ...overrides };
}

// ------------------------------------------------------------------ helpers

function cw(state: WheelState, delta = 36): WheelState {
  return wheelReducer(state, { type: 'WIND', delta });
}

function ccw(state: WheelState, delta = 36): WheelState {
  return wheelReducer(state, { type: 'WIND', delta: -delta });
}

function select(state: WheelState, element: WheelState['selectedStone']): WheelState {
  return wheelReducer(state, { type: 'SELECT_STONE', element: element! });
}

function place(state: WheelState, slotIndex: number): WheelState {
  return wheelReducer(state, { type: 'PLACE_STONE', slotIndex });
}

// ================================================================== initial

describe('initial state', () => {
  it('has all default values', () => {
    expect(initialWheelState.mode).toBe('ready');
    expect(initialWheelState.slots).toEqual(Array(10).fill(null));
    expect(initialWheelState.selectedStone).toBeNull();
    expect(initialWheelState.rotation).toBe(0);
    expect(initialWheelState.direction).toBeNull();
    expect(initialWheelState.queuedSlotIndices).toEqual([]);
    expect(initialWheelState.currentSlotAtHead).toBeNull();
    expect(initialWheelState.bpm).toBe(100);
  });
});

// ============================================================ SELECT_STONE

describe('SELECT_STONE', () => {
  it('sets selectedStone in ready mode', () => {
    const s = wheelReducer(initialWheelState, { type: 'SELECT_STONE', element: 'earth' });
    expect(s.selectedStone).toBe('earth');
    expect(s.mode).toBe('ready');
  });

  it('changes selection', () => {
    const a = wheelReducer(initialWheelState, { type: 'SELECT_STONE', element: 'earth' });
    const b = wheelReducer(a, { type: 'SELECT_STONE', element: 'fire' });
    expect(b.selectedStone).toBe('fire');
  });

  it.each(['winding', 'springBack'] satisfies WheelState['mode'][])(
    'is no-op in %s mode',
    (mode) => {
      const state = createState({ mode, direction: 'cw' });
      expect(wheelReducer(state, { type: 'SELECT_STONE', element: 'earth' })).toBe(state);
    },
  );
});

// ============================================================ PLACE_STONE

describe('PLACE_STONE', () => {
  it('places stone in an empty slot', () => {
    const s = place(select(initialWheelState, 'wood'), 2);
    expect(s.slots[2]).toBe('wood');
    expect(s.slots.filter(Boolean)).toHaveLength(1);
  });

  it('replaces a different stone in the same slot', () => {
    const earth = place(select(initialWheelState, 'earth'), 3);
    const fire = place(select(earth, 'fire'), 3);
    expect(fire.slots[3]).toBe('fire');
    expect(earth.slots[3]).toBe('earth'); // original unchanged
  });

  it('is no-op when no stone is selected', () => {
    expect(wheelReducer(initialWheelState, { type: 'PLACE_STONE', slotIndex: 0 })).toBe(initialWheelState);
  });

  it('is no-op when placing the same stone in the same slot', () => {
    const placed = place(select(initialWheelState, 'metal'), 5);
    expect(wheelReducer(placed, { type: 'PLACE_STONE', slotIndex: 5 })).toBe(placed);
  });

  it('is no-op in winding mode', () => {
    const withStone = select(initialWheelState, 'earth');
    const wind = cw(withStone);
    expect(wheelReducer(wind, { type: 'PLACE_STONE', slotIndex: 3 })).toBe(wind);
  });
});

// =============================================================== CLEAR_ALL

describe('CLEAR_ALL', () => {
  it('clears all filled slots', () => {
    let s = select(initialWheelState, 'earth');
    s = place(s, 0);
    s = select(s, 'metal');
    s = place(s, 1);
    const cleared = wheelReducer(s, { type: 'CLEAR_ALL' });
    expect(cleared.slots.every((x) => x === null)).toBe(true);
  });

  it('is no-op in winding mode', () => {
    const wind = cw(initialWheelState);
    expect(wheelReducer(wind, { type: 'CLEAR_ALL' })).toBe(wind);
  });
});

// =================================================================== WIND

describe('WIND', () => {
  it('transitions from ready to winding', () => {
    const s = cw(initialWheelState, 36);
    expect(s.mode).toBe('winding');
    expect(s.rotation).toBe(36);
  });

  it('accumulates positive rotation for CW', () => {
    const s = cw(cw(initialWheelState, 36), 36);
    expect(s.rotation).toBe(72);
  });

  it('accumulates negative rotation for CCW', () => {
    const s = ccw(ccw(initialWheelState, 36), 36);
    expect(s.rotation).toBe(-72);
  });

  it('sets direction from first non-zero delta (CW)', () => {
    const s = cw(initialWheelState, 10);
    expect(s.direction).toBe('cw');
  });

  it('sets direction from first non-zero delta (CCW)', () => {
    const s = ccw(initialWheelState, 10);
    expect(s.direction).toBe('ccw');
  });

  it('direction is locked after first wind', () => {
    const s = wheelReducer(
      cw(initialWheelState, 36),
      { type: 'WIND', delta: -10 },
    );
    expect(s.direction).toBe('cw');
  });

  it('zero delta does not set direction', () => {
    const s = wheelReducer(initialWheelState, { type: 'WIND', delta: 0 });
    expect(s.direction).toBeNull();
    expect(s.mode).toBe('winding');
  });

  it('caps rotation at 360 (CW)', () => {
    const s = cw(initialWheelState, 400);
    expect(s.rotation).toBe(360);
  });

  it('caps rotation at -360 (CCW)', () => {
    const s = ccw(initialWheelState, 400);
    expect(s.rotation).toBe(-360);
  });

  it('ignores WIND in springBack mode', () => {
    const springing = createState({ mode: 'springBack' });
    expect(wheelReducer(springing, { type: 'WIND', delta: 36 })).toBe(springing);
  });

  it('ignores WIND in complete mode', () => {
    const completed = createState({ mode: 'complete' });
    expect(wheelReducer(completed, { type: 'WIND', delta: 36 })).toBe(completed);
  });
});

// =========================================================== WIND queuing

describe('WIND slot queuing', () => {
  // At rest (rotation=0): slot 5 is at the head.
  //   head position = ((180 - 0) % 360 + 360) % 360 = 180 → 180 / 36 = 5

  it('first CW wind from ready queues the destination slot', () => {
    // delta=36 → rotation=36 → head slot = ((180-36)%360+360)%360/36 = 144/36 = 4
    const s = cw(initialWheelState, 36);
    expect(s.queuedSlotIndices).toEqual([4]);
    expect(s.currentSlotAtHead).toBe(4);
  });

  it('first CCW wind from ready queues the destination slot', () => {
    // delta=-36 → rotation=-36 → head slot = ((180+36)%360+360)%360/36 = 216/36 = 6
    const s = ccw(initialWheelState, 36);
    expect(s.queuedSlotIndices).toEqual([6]);
    expect(s.currentSlotAtHead).toBe(6);
  });

  it('queues intermediate and destination slots on subsequent CW winds', () => {
    // Start: rotation=0, head=5
    // Wind +36: rotation=36, head=4  → queue [4]
    const a = cw(initialWheelState, 36);
    // Wind +36: rotation=72, head=3  → track 4→3 → queue [4,3]
    const b = cw(a, 36);
    expect(b.queuedSlotIndices).toEqual([4, 3]);
    // Wind +36: rotation=108, head=2 → track 3→2 → queue [4,3,2]
    const c = cw(b, 36);
    expect(c.queuedSlotIndices).toEqual([4, 3, 2]);
  });

  it('queues intermediate and destination slots on subsequent CCW winds', () => {
    const a = ccw(initialWheelState, 36); // rotation=-36, head=6 → queue [6]
    const b = ccw(a, 36); // rotation=-72, head=7 → track 6→7 → queue [6,7]
    expect(b.queuedSlotIndices).toEqual([6, 7]);
    const c = ccw(b, 36); // rotation=-108, head=8 → track 7→8 → queue [6,7,8]
    expect(c.queuedSlotIndices).toEqual([6, 7, 8]);
  });

  it('produces 10 unique slots over a full CW rotation (10 × 36°)', () => {
    let s = initialWheelState;
    for (let i = 0; i < 10; i++) {
      s = cw(s, 36);
    }
    expect(s.rotation).toBe(360);
    expect(s.queuedSlotIndices).toHaveLength(10);
    expect(new Set(s.queuedSlotIndices).size).toBe(10);
    // Order: starting from slot 5 at rest, CW moves head backwards:
    // 5→4 → 4→3 → 3→2 → 2→1 → 1→0 → 0→9 → 9→8 → 8→7 → 7→6 → 6→5
    // queued: [4,3,2,1,0,9,8,7,6,5]
    expect(s.queuedSlotIndices).toEqual([4, 3, 2, 1, 0, 9, 8, 7, 6, 5]);
  });

  it('produces 10 unique slots over a full CCW rotation (10 × 36°)', () => {
    let s = initialWheelState;
    for (let i = 0; i < 10; i++) {
      s = ccw(s, 36);
    }
    expect(s.rotation).toBe(-360);
    expect(s.queuedSlotIndices).toHaveLength(10);
    expect(new Set(s.queuedSlotIndices).size).toBe(10);
    // CCW: head moves forward 5→6→7→8→9→0→1→2→3→4→5
    // queued: [6,7,8,9,0,1,2,3,4,5]
    expect(s.queuedSlotIndices).toEqual([6, 7, 8, 9, 0, 1, 2, 3, 4, 5]);
  });

  it('avoids duplicate slot entries when winding past already-queued slots', () => {
    // Wind +36 to queue slot 4, then wind -10 to barely move back
    const a = cw(initialWheelState, 36); // rotation=36, head=4, queue=[4]
    // Wind -10: rotation=26, head = ((180-26)%360+360)%360/36 = 154/36 ≈ 4.28 → round=4
    // Head is still slot 4, no new slots cross
    const b = wheelReducer(a, { type: 'WIND', delta: -10 });
    expect(b.queuedSlotIndices).toEqual([4]); // no duplicates
  });

  it('does not queue anything new on zero delta from ready', () => {
    // delta=0: rotation stays 0, head stays slot 5
    // wasReady=true, newSlot=5 → queue.push(5) since 5 not already queued
    const s = wheelReducer(initialWheelState, { type: 'WIND', delta: 0 });
    expect(s.queuedSlotIndices).toEqual([5]);
  });
});

// ================================================================ RELEASE

describe('RELEASE', () => {
  it('transitions winding to springBack', () => {
    const s = wheelReducer(cw(initialWheelState, 36), { type: 'RELEASE' });
    expect(s.mode).toBe('springBack');
  });

  it('transitions tack to springBack', () => {
    const tacked = wheelReducer(cw(initialWheelState, 36), { type: 'TACK' });
    const s = wheelReducer(tacked, { type: 'RELEASE' });
    expect(s.mode).toBe('springBack');
  });

  it('preserves queuedSlotIndices on release', () => {
    const wind = cw(cw(initialWheelState, 36), 36);
    const queue = wind.queuedSlotIndices;
    const s = wheelReducer(wind, { type: 'RELEASE' });
    expect(s.mode).toBe('springBack');
    expect(s.queuedSlotIndices).toEqual(queue);
  });

  it.each(['ready', 'springBack', 'complete'] as const)(
    'is no-op in %s mode',
    (mode) => {
      const state = createState({ mode });
      expect(wheelReducer(state, { type: 'RELEASE' })).toBe(state);
    },
  );
});

// =================================================================== TACK

describe('TACK', () => {
  it('transitions winding to tack', () => {
    const s = wheelReducer(cw(initialWheelState, 36), { type: 'TACK' });
    expect(s.mode).toBe('tack');
  });

  it('clears currentSlotAtHead on tack', () => {
    const s = wheelReducer(cw(initialWheelState, 36), { type: 'TACK' });
    expect(s.currentSlotAtHead).toBeNull();
  });

  it.each(['ready', 'tack', 'springBack', 'complete'] as const)(
    'is no-op in %s mode',
    (mode) => {
      const state = createState({ mode, direction: 'cw' });
      expect(wheelReducer(state, { type: 'TACK' })).toBe(state);
    },
  );
});

// =============================================================== COMPLETE

describe('COMPLETE', () => {
  it('transitions springBack to ready', () => {
    const released = wheelReducer(cw(initialWheelState, 36), { type: 'RELEASE' });
    const s = wheelReducer(released, { type: 'COMPLETE' });
    expect(s.mode).toBe('ready');
  });

  it('resets rotation, direction, queuedSlotIndices, currentSlotAtHead', () => {
    const wind = cw(cw(initialWheelState, 36), 36);
    const released = wheelReducer(wind, { type: 'RELEASE' });
    const s = wheelReducer(released, { type: 'COMPLETE' });
    expect(s.rotation).toBe(0);
    expect(s.direction).toBeNull();
    expect(s.queuedSlotIndices).toEqual([]);
    expect(s.currentSlotAtHead).toBeNull();
  });

  it('preserves slots, selectedStone, and bpm', () => {
    const withSelection = select(initialWheelState, 'earth');
    const placed = place(withSelection, 5);
    const wind = cw(placed, 36);
    const released = wheelReducer(wind, { type: 'RELEASE' });
    const s = wheelReducer(released, { type: 'COMPLETE' });
    expect(s.slots[5]).toBe('earth');
    expect(s.selectedStone).toBe('earth');
    expect(s.bpm).toBe(100);
  });

  it.each(['ready', 'winding', 'tack', 'complete'] as const)(
    'is no-op in %s mode',
    (mode) => {
      const state = createState({ mode, direction: mode === 'winding' ? 'cw' : null });
      expect(wheelReducer(state, { type: 'COMPLETE' })).toBe(state);
    },
  );
});

// ================================================================ SET_BPM

describe('SET_BPM', () => {
  it('sets bpm to a value within range', () => {
    const s = wheelReducer(initialWheelState, { type: 'SET_BPM', bpm: 120 });
    expect(s.bpm).toBe(120);
  });

  it('clamps below 60 to 60', () => {
    const s = wheelReducer(initialWheelState, { type: 'SET_BPM', bpm: 30 });
    expect(s.bpm).toBe(60);
  });

  it('clamps above 180 to 180', () => {
    const s = wheelReducer(initialWheelState, { type: 'SET_BPM', bpm: 250 });
    expect(s.bpm).toBe(180);
  });

  it('works in any state', () => {
    const wind = cw(initialWheelState, 36);
    const s = wheelReducer(wind, { type: 'SET_BPM', bpm: 72 });
    expect(s.bpm).toBe(72);
  });
});

// ============================================================= full cycles

describe('full cycles', () => {
  it('ready → select → place → CW wind → release → complete preserves state', () => {
    const afterPlace = place(select(initialWheelState, 'earth'), 5);
    const wind = cw(afterPlace, 36);
    expect(wind.mode).toBe('winding');
    const released = wheelReducer(wind, { type: 'RELEASE' });
    expect(released.mode).toBe('springBack');
    const completed = wheelReducer(released, { type: 'COMPLETE' });
    expect(completed.mode).toBe('ready');
    expect(completed.slots[5]).toBe('earth');
    expect(completed.rotation).toBe(0);
    expect(completed.direction).toBeNull();
    expect(completed.queuedSlotIndices).toEqual([]);
    expect(completed.currentSlotAtHead).toBeNull();
  });

  it('ready → CCW wind → tack → release → complete returns to ready', () => {
    const wind = ccw(initialWheelState, 36);
    expect(wind.mode).toBe('winding');
    const tacked = wheelReducer(wind, { type: 'TACK' });
    expect(tacked.mode).toBe('tack');
    const released = wheelReducer(tacked, { type: 'RELEASE' });
    expect(released.mode).toBe('springBack');
    const completed = wheelReducer(released, { type: 'COMPLETE' });
    expect(completed.mode).toBe('ready');
  });
});

// ============================================================== edge cases

describe('edge cases', () => {
  it('all 10 slots can be filled', () => {
    const stones = ['earth', 'metal', 'wood', 'fire', 'water'] as const;
    let s = initialWheelState;
    for (let i = 0; i < 10; i++) {
      s = select(s, stones[i % stones.length]);
      s = place(s, i);
    }
    expect(s.slots.every((x) => x !== null)).toBe(true);
    expect(s.slots.filter((x) => x === 'earth')).toHaveLength(2); // indices 0 and 5
  });

  it('early release after small wind works', () => {
    const wind = cw(initialWheelState, 36);
    const released = wheelReducer(wind, { type: 'RELEASE' });
    expect(released.mode).toBe('springBack');
    const completed = wheelReducer(released, { type: 'COMPLETE' });
    expect(completed.mode).toBe('ready');
  });

  it('PLACE_STONE with null selection does nothing', () => {
    expect(wheelReducer(initialWheelState, { type: 'PLACE_STONE', slotIndex: 0 })).toBe(initialWheelState);
  });
});
