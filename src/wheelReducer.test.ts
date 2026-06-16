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
  expect(initialWheelState.bpm).toBe(180);
  expect(initialWheelState.loop).toBe(true);
  expect(initialWheelState.key).toBe('F');
  expect(initialWheelState.octave).toBe(5);
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
  it('places stone in springBack mode (loop playback)', () => {
    const s = wheelReducer(
      createState({ mode: 'springBack', direction: 'cw', selectedStone: 'fire' }),
      { type: 'PLACE_STONE', slotIndex: 5 },
    );
    expect(s.slots[5]).toBe('fire');
  });

  it('rejects placement in winding mode', () => {
    const wind = cw(select(initialWheelState, 'earth'), 36);
    expect(wind.mode).toBe('winding');
    const s = wheelReducer(wind, { type: 'PLACE_STONE', slotIndex: 3 });
    expect(s).toBe(wind);
  });

// ============================================================ REMOVE_STONE

describe('REMOVE_STONE', () => {
  it('removes stone from a filled slot in ready mode', () => {
    const placed = place(select(initialWheelState, 'wood'), 4);
    expect(placed.slots[4]).toBe('wood');
    const s = wheelReducer(placed, { type: 'REMOVE_STONE', slotIndex: 4 });
    expect(s.slots[4]).toBeNull();
    expect(s.mode).toBe('ready');
  });

  it('is no-op when slot is already empty', () => {
    const s = wheelReducer(initialWheelState, { type: 'REMOVE_STONE', slotIndex: 3 });
    expect(s).toBe(initialWheelState);
  });

  it('removes stone in springBack mode', () => {
    const placed = place(select(initialWheelState, 'fire'), 7);
    const wind = cw(placed, 36);
    const released = wheelReducer(wind, { type: 'RELEASE' });
    expect(released.mode).toBe('springBack');
    const s = wheelReducer(released, { type: 'REMOVE_STONE', slotIndex: 7 });
    expect(s.slots[7]).toBeNull();
  });

  it('is no-op in winding mode', () => {
    const placed = place(select(initialWheelState, 'metal'), 2);
    const s = cw(placed, 36);
    expect(wheelReducer(s, { type: 'REMOVE_STONE', slotIndex: 2 })).toBe(s);
  });

  it('only removes the specified slot, not others', () => {
    let s = select(initialWheelState, 'earth');
    s = place(s, 0);
    s = select(s, 'metal');
    s = place(s, 1);
    s = select(s, 'water');
    s = place(s, 5);
    const removed = wheelReducer(s, { type: 'REMOVE_STONE', slotIndex: 1 });
    expect(removed.slots[0]).toBe('earth');
    expect(removed.slots[1]).toBeNull();
    expect(removed.slots[5]).toBe('water');
    expect(removed.slots.filter(Boolean)).toHaveLength(2);
  });
});

// =============================================================== RESET

describe('RESET', () => {
  it('clears all filled slots', () => {
    let s = select(initialWheelState, 'earth');
    s = place(s, 0);
    s = select(s, 'metal');
    s = place(s, 1);
    const cleared = wheelReducer(s, { type: 'RESET' });
    expect(cleared.slots.every((x) => x === null)).toBe(true);
  });

  it('resets to ready with empty slots when mode is winding', () => {
    let s = select(initialWheelState, 'earth');
    s = place(s, 0);
    s = cw(s);
    const cleared = wheelReducer(s, { type: 'RESET' });
    expect(cleared.mode).toBe('ready');
    expect(cleared.slots.every((x) => x === null)).toBe(true);
  });

  it('resets to ready with empty slots when mode is springBack', () => {
    let s = select(initialWheelState, 'earth');
    s = place(s, 0);
    s = cw(s);
    s = wheelReducer(s, { type: 'RELEASE' });
    const cleared = wheelReducer(s, { type: 'RESET' });
    expect(cleared.mode).toBe('ready');
    expect(cleared.slots.every((x) => x === null)).toBe(true);
  });

  it('clears queuedSlotIndices to []', () => {
    let s = cw(initialWheelState);
    s = cw(s);
    expect(s.queuedSlotIndices.length).toBeGreaterThan(0);
    const cleared = wheelReducer(s, { type: 'RESET' });
    expect(cleared.queuedSlotIndices).toEqual([]);
  });

  it('still works in ready mode', () => {
    let s = select(initialWheelState, 'water');
    s = place(s, 3);
    const cleared = wheelReducer(s, { type: 'RESET' });
    expect(cleared.mode).toBe('ready');
    expect(cleared.slots.every((x) => x === null)).toBe(true);
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

  it('WIND from springBack transitions to winding', () => {
    const springing = createState({ mode: 'springBack', direction: 'cw', rotation: -10 });
    const s = wheelReducer(springing, { type: 'WIND', delta: 36 });
    expect(s.mode).toBe('winding');
  });

  it('WIND from springBack preserves existing slots', () => {
    const springing = createState({
      mode: 'springBack',
      direction: 'cw',
      rotation: -10,
      slots: ['earth', null, null, null, null, null, null, null, null, null],
    });
    const s = wheelReducer(springing, { type: 'WIND', delta: 36 });
    expect(s.slots[0]).toBe('earth');
  });

  it('WIND from springBack resets queuedSlotIndices', () => {
    const springing = createState({
      mode: 'springBack',
      direction: 'cw',
      rotation: 0,
      queuedSlotIndices: [9, 8, 7],
    });
    const s = wheelReducer(springing, { type: 'WIND', delta: 10 });
    expect(s.queuedSlotIndices).toEqual([]);
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
    // After slot 9 is queued, glow moves to next approaching slot (8)
    expect(s.currentSlotAtHead).toBe(8);
  });

  it('first CCW wind from ready queues the destination slot', () => {
    // delta=-36 → rotation=-36 → head slot = 0
    const s = ccw(initialWheelState, 36);
    expect(s.queuedSlotIndices).toEqual([0]);
    // After slot 0 is queued, glow moves to next approaching slot (1)
    expect(s.currentSlotAtHead).toBe(1);
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
    expect(s.bpm).toBe(180);
  });

  it.each(['ready', 'winding'] as const)(
    'is no-op in %s mode',
    (mode) => {
      const state = createState({ mode, direction: mode === 'winding' ? 'cw' : null });
      expect(wheelReducer(state, { type: 'COMPLETE' })).toBe(state);
    },
  );

  it('COMPLETE always resets to ready regardless of loop state', () => {
    const wind = cw(initialWheelState, 36);
    const released = wheelReducer(wind, { type: 'RELEASE' });
    const s = wheelReducer(released, { type: 'COMPLETE' });
    expect(s.mode).toBe('ready');
  });

  it('COMPLETE with loop=true resets rotation to 0', () => {
    const wind = cw(cw(initialWheelState, 36), 36);
    const released = wheelReducer(wind, { type: 'RELEASE' });
    expect(released.rotation).toBeGreaterThan(0); // rotation was accumulated during wind
    const s = wheelReducer(released, { type: 'COMPLETE' });
    expect(s.rotation).toBe(0);
  });
  it('COMPLETE clears queuedSlotIndices', () => {
    const wind = cw(cw(initialWheelState, 36), 36);
    const released = wheelReducer(wind, { type: 'RELEASE' });
    const s = wheelReducer(released, { type: 'COMPLETE' });
    expect(s.queuedSlotIndices).toEqual([]);
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
// ================================================================ SET_KEY

describe('SET_KEY', () => {
  it('sets key to C', () => {
    const s = wheelReducer(initialWheelState, { type: 'SET_KEY', key: 'C' });
    expect(s.key).toBe('C');
  });

  it('sets key to G', () => {
    const s = wheelReducer(initialWheelState, { type: 'SET_KEY', key: 'G' });
    expect(s.key).toBe('G');
  });

  it('sets key to F#', () => {
    const s = wheelReducer(initialWheelState, { type: 'SET_KEY', key: 'F#' });
    expect(s.key).toBe('F#');
  });

  it('rejects invalid key', () => {
    const s = wheelReducer(initialWheelState, { type: 'SET_KEY', key: 'Z' });
    expect(s.key).toBe('F'); // unchanged
  });

  it('works in any state', () => {
    const wind = cw(initialWheelState, 36);
    const s = wheelReducer(wind, { type: 'SET_KEY', key: 'A' });
    expect(s.key).toBe('A');
  });
});

// =============================================================== SET_OCTAVE

describe('SET_OCTAVE', () => {
  it('sets octave to 4', () => {
    const s = wheelReducer(initialWheelState, { type: 'SET_OCTAVE', octave: 4 });
    expect(s.octave).toBe(4);
  });

  it('sets octave to 5', () => {
    const s = wheelReducer(initialWheelState, { type: 'SET_OCTAVE', octave: 5 });
    expect(s.octave).toBe(5);
  });

  it('sets octave to 3', () => {
    const s = wheelReducer(initialWheelState, { type: 'SET_OCTAVE', octave: 3 });
    expect(s.octave).toBe(3);
  });

  it('clamps above 8 to 8', () => {
    const s = wheelReducer(initialWheelState, { type: 'SET_OCTAVE', octave: 10 });
    expect(s.octave).toBe(8);
  });

  it('clamps below 3 to 3', () => {
    const s = wheelReducer(initialWheelState, { type: 'SET_OCTAVE', octave: 1 });
    expect(s.octave).toBe(3);
  });

  it('works in any state', () => {
    const wind = cw(initialWheelState, 36);
    const s = wheelReducer(wind, { type: 'SET_OCTAVE', octave: 6 });
    expect(s.octave).toBe(6);
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

  it('fast CCW drag captures all crossing slots including newSlot', () => {
    // Fast drag that crosses both slot 0 and slot 1 in one WIND event
    // Slot 0: 210° → 140° (crossed 180°)
    // Slot 1: 243.3° → 173.3° (crossed 180°)
    const s = ccw(initialWheelState, 70);
    expect(s.queuedSlotIndices).toContain(0);
    expect(s.queuedSlotIndices).toContain(1);
    expect(s.queuedSlotIndices).toHaveLength(2);
  });

  it('RELEASE captures approaching slot within 10° of head', () => {
    // Wind CCW by 25° → slot 0 goes from 210° to 185° (5° above head)
    // Slot is glowing but hasn't technically crossed yet
    const wound = ccw(initialWheelState, 25);
    expect(wound.currentSlotAtHead).toBe(0); // Slot 0 is glowing
    expect(wound.queuedSlotIndices).not.toContain(0); // But not queued yet

    // Release should capture it since it's within 10° of head
    const released = wheelReducer(wound, { type: 'RELEASE' });
    expect(released.queuedSlotIndices).toContain(0);
  });

  it('RELEASE does not capture slot far from head', () => {
    // Wind CCW by 10° → slot 0 goes from 210° to 200° (20° above head)
    const wound = ccw(initialWheelState, 10);
    expect(wound.currentSlotAtHead).toBe(0);
    expect(wound.queuedSlotIndices).not.toContain(0);

    // Release should NOT capture it since it's > 10° from head
    const released = wheelReducer(wound, { type: 'RELEASE' });
    expect(released.queuedSlotIndices).not.toContain(0);
  });
});
