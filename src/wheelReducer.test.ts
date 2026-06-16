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
    expect(initialWheelState.loop).toBe(true);
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

  it('uses provided element over selectedStone', () => {
    const state = select(initialWheelState, 'earth');
    const result = wheelReducer(state, { type: 'PLACE_STONE', slotIndex: 4, element: 'fire' });
    expect(result.slots[4]).toBe('fire');
    expect(result.selectedStone).toBe('earth'); // selectedStone unchanged
  });

  it('falls back to selectedStone when element not provided', () => {
    const state = select(initialWheelState, 'wood');
    const result = wheelReducer(state, { type: 'PLACE_STONE', slotIndex: 6 });
    expect(result.slots[6]).toBe('wood');
  });

  it('returns state unchanged when neither element nor selectedStone is provided', () => {
    expect(wheelReducer(initialWheelState, { type: 'PLACE_STONE', slotIndex: 0 })).toBe(initialWheelState);
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

});

// =========================================================== WIND queuing

describe('WIND slot queuing', () => {
  // Horseshoe arc: 10 slots across 300°. At rest, slots 0 and 9 are 30° from head.
  // Direction bias: CW → slot 9 wins tie, CCW → slot 0 wins tie.

  it('first CW wind from ready queues the destination slot', () => {
    // delta=36 → only slot 9 crosses 180° (slot 8 at 152° hasn't reached 180°)
    const s = cw(initialWheelState, 36);
    expect(s.queuedSlotIndices).toEqual([9]);
    expect(s.currentSlotAtHead).toBe(9);
  });

  it('first CCW wind from ready queues the destination slot', () => {
    // delta=-36 → rotation=-36 → head slot = 0
    const s = ccw(initialWheelState, 36);
    expect(s.queuedSlotIndices).toEqual([0]);
    expect(s.currentSlotAtHead).toBe(0);
  });

  it('queues intermediate and destination slots on subsequent CW winds', () => {
    // Wind +36: only slot 9 crosses 180° → [9]
    const a = cw(initialWheelState, 36);
    // Wind +36: slot 8 crosses 180° (at 188.67°) → [9,8]
    const b = cw(a, 36);
    expect(b.queuedSlotIndices).toEqual([9, 8]);
    // Wind +36: slot 7 crosses 180° → [9,8,7]
    const c = cw(b, 36);
    expect(c.queuedSlotIndices).toEqual([9, 8, 7]);
  });

  it('queues intermediate and destination slots on subsequent CCW winds', () => {
    const a = ccw(initialWheelState, 36); // rotation=-36, head=0 → queue [0]
    const b = ccw(a, 36); // rotation=-72, head=1 → track 0→1 → queue [0,1]
    expect(b.queuedSlotIndices).toEqual([0, 1]);
    const c = ccw(b, 36); // rotation=-108, head=2 → track 1→2 → queue [0,1,2]
    expect(c.queuedSlotIndices).toEqual([0, 1, 2]);
  });

  it('produces 10 unique slots over a full CW rotation (10 × 36°)', () => {
    let s = initialWheelState;
    for (let i = 0; i < 10; i++) {
      s = cw(s, 36);
    }
    expect(s.rotation).toBe(360);
    expect(s.queuedSlotIndices).toHaveLength(10);
    expect(new Set(s.queuedSlotIndices).size).toBe(10);
    // CW: head moves backwards 0→9→8→7→6→5→4→3→2→1→0
    // (36° step > 33.33° spacing causes intermediate tracking at 180°→216°)
    // queued: [9,8,7,6,5,4,3,2,1,0]
    expect(s.queuedSlotIndices).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  });

  it('produces 10 unique slots over a full CCW rotation (10 × 36°)', () => {
    let s = initialWheelState;
    for (let i = 0; i < 10; i++) {
      s = ccw(s, 36);
    }
    expect(s.rotation).toBe(-360);
    expect(s.queuedSlotIndices).toHaveLength(10);
    expect(new Set(s.queuedSlotIndices).size).toBe(10);
    // CCW: head moves forward 0→1→2→3→4→5→6→7→8→9→0
    // (36° step > 33.33° spacing causes intermediate tracking at -144°→-180°)
    // queued: [0,1,2,3,4,5,6,7,8,9]
    expect(s.queuedSlotIndices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('avoids duplicate slot entries when winding past already-queued slots', () => {
    // Wind +36: only slot 9 crosses 180° → [9]
    const a = cw(initialWheelState, 36);
    // Wind -10 → rotation=26, no new crossings → [9]
    const b = wheelReducer(a, { type: 'WIND', delta: -10 });
    expect(b.queuedSlotIndices).toEqual([9]);
  });

  it('does not queue anything new on zero delta from ready', () => {
    // delta=0: no movement, no slot crosses 180°
    const s = wheelReducer(initialWheelState, { type: 'WIND', delta: 0 });
    expect(s.queuedSlotIndices).toEqual([]);
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

  it.each(['ready', 'springBack'] as const)(
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

  it.each(['ready', 'tack', 'springBack'] as const)(
    'is no-op in %s mode',
    (mode) => {
      const state = createState({ mode, direction: 'cw' });
      expect(wheelReducer(state, { type: 'TACK' })).toBe(state);
    },
  );
});

// =============================================================== COMPLETE

describe('COMPLETE', () => {
  it('transitions springBack to ready (loop=false)', () => {
    const released = wheelReducer(cw(initialWheelState, 36), { type: 'RELEASE' });
    const noLoop = wheelReducer(released, { type: 'SET_LOOP', loop: false });
    const s = wheelReducer(noLoop, { type: 'COMPLETE' });
    expect(s.mode).toBe('ready');
  });

  it('resets rotation, direction, queuedSlotIndices, currentSlotAtHead (loop=false)', () => {
    const wind = cw(cw(initialWheelState, 36), 36);
    const released = wheelReducer(wind, { type: 'RELEASE' });
    const noLoop = wheelReducer(released, { type: 'SET_LOOP', loop: false });
    const s = wheelReducer(noLoop, { type: 'COMPLETE' });
    expect(s.rotation).toBe(0);
    expect(s.direction).toBeNull();
    expect(s.queuedSlotIndices).toEqual([]);
    expect(s.currentSlotAtHead).toBeNull();
  });

  it('preserves slots, selectedStone, and bpm (loop=false)', () => {
    const withSelection = select(initialWheelState, 'earth');
    const placed = place(withSelection, 5);
    const wind = cw(placed, 36);
    const released = wheelReducer(wind, { type: 'RELEASE' });
    const noLoop = wheelReducer(released, { type: 'SET_LOOP', loop: false });
    const s = wheelReducer(noLoop, { type: 'COMPLETE' });
    expect(s.slots[5]).toBe('earth');
    expect(s.selectedStone).toBe('earth');
    expect(s.bpm).toBe(100);
  });

  it.each(['ready', 'winding', 'tack'] as const)(
    'is no-op in %s mode',
    (mode) => {
      const state = createState({ mode, direction: mode === 'winding' ? 'cw' : null });
      expect(wheelReducer(state, { type: 'COMPLETE' })).toBe(state);
    },
  );

  it('COMPLETE with loop=true and queuedSlotIndices > 0 returns springBack', () => {
    const wind = cw(initialWheelState, 36);
    const released = wheelReducer(wind, { type: 'RELEASE' });
    const s = wheelReducer(released, { type: 'COMPLETE' });
    expect(s.mode).toBe('springBack');
  });

  it('COMPLETE with loop=true preserves queuedSlotIndices', () => {
    const wind = cw(cw(initialWheelState, 36), 36);
    const released = wheelReducer(wind, { type: 'RELEASE' });
    const s = wheelReducer(released, { type: 'COMPLETE' });
    expect(s.queuedSlotIndices).toEqual([9, 8]);
  });

  it('COMPLETE with loop=false returns ready', () => {
    const wind = cw(initialWheelState, 36);
    const released = wheelReducer(wind, { type: 'RELEASE' });
    const noLoop = wheelReducer(released, { type: 'SET_LOOP', loop: false });
    const s = wheelReducer(noLoop, { type: 'COMPLETE' });
    expect(s.mode).toBe('ready');
  });

  it('COMPLETE with loop=true but empty queuedSlotIndices returns ready', () => {
    const s = wheelReducer(
      createState({ mode: 'springBack', loop: true, queuedSlotIndices: [], direction: 'cw' }),
      { type: 'COMPLETE' },
    );
    expect(s.mode).toBe('ready');
  });
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

// ================================================================ SET_LOOP

describe('SET_LOOP', () => {
  it('sets loop to false', () => {
    const s = wheelReducer(initialWheelState, { type: 'SET_LOOP', loop: false });
    expect(s.loop).toBe(false);
  });

  it('sets loop to true', () => {
    const s = wheelReducer(
      wheelReducer(initialWheelState, { type: 'SET_LOOP', loop: false }),
      { type: 'SET_LOOP', loop: true },
    );
    expect(s.loop).toBe(true);
  });

  it('works in any state', () => {
    const s = wheelReducer(
      wheelReducer(initialWheelState, { type: 'WIND', delta: 36 }),
      { type: 'SET_LOOP', loop: false },
    );
    expect(s.loop).toBe(false);
  });
});

// ============================================================= full cycles

describe('full cycles', () => {
  it('ready → select → place → CW wind → release → complete preserves state (loop=false)', () => {
    const afterPlace = place(select(initialWheelState, 'earth'), 5);
    const wind = cw(afterPlace, 36);
    expect(wind.mode).toBe('winding');
    const released = wheelReducer(wind, { type: 'RELEASE' });
    expect(released.mode).toBe('springBack');
    const noLoop = wheelReducer(released, { type: 'SET_LOOP', loop: false });
    const completed = wheelReducer(noLoop, { type: 'COMPLETE' });
    expect(completed.mode).toBe('ready');
    expect(completed.slots[5]).toBe('earth');
    expect(completed.rotation).toBe(0);
    expect(completed.direction).toBeNull();
    expect(completed.queuedSlotIndices).toEqual([]);
    expect(completed.currentSlotAtHead).toBeNull();
  });

  it('ready → CCW wind → tack → release → complete returns to ready (loop=false)', () => {
    const wind = ccw(initialWheelState, 36);
    expect(wind.mode).toBe('winding');
    const tacked = wheelReducer(wind, { type: 'TACK' });
    expect(tacked.mode).toBe('tack');
    const released = wheelReducer(tacked, { type: 'RELEASE' });
    expect(released.mode).toBe('springBack');
    const noLoop = wheelReducer(released, { type: 'SET_LOOP', loop: false });
    const completed = wheelReducer(noLoop, { type: 'COMPLETE' });
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

  it('early release after small wind works (loop=false)', () => {
    const wind = cw(initialWheelState, 36);
    const released = wheelReducer(wind, { type: 'RELEASE' });
    expect(released.mode).toBe('springBack');
    const noLoop = wheelReducer(released, { type: 'SET_LOOP', loop: false });
    const completed = wheelReducer(noLoop, { type: 'COMPLETE' });
    expect(completed.mode).toBe('ready');
  });

  it('PLACE_STONE with null selection does nothing', () => {
    expect(wheelReducer(initialWheelState, { type: 'PLACE_STONE', slotIndex: 0 })).toBe(initialWheelState);
  });
});
