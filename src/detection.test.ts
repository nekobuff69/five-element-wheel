import { describe, it, expect } from 'vitest';
import { wheelReducer, initialWheelState } from './wheelReducer';

describe('wheel drag detection', () => {
  it('detects single slot crossing with small CW drag', () => {
    let state = initialWheelState;
    // Slot 9 at 150°, head at 180°. Need 30° to reach head.
    state = wheelReducer(state, { type: 'WIND', delta: 35 });
    expect(state.queuedSlotIndices).toContain(9);
    expect(state.queuedSlotIndices).toHaveLength(1);
  });

  it('detects multiple slots with larger CW drag', () => {
    let state = initialWheelState;
    // Drag 70° CW should cross slots 9 and 8
    state = wheelReducer(state, { type: 'WIND', delta: 70 });
    expect(state.queuedSlotIndices).toContain(9);
    expect(state.queuedSlotIndices).toContain(8);
    expect(state.queuedSlotIndices).toHaveLength(2);
  });

  it('detects slots in correct order for CW drag', () => {
    let state = initialWheelState;
    state = wheelReducer(state, { type: 'WIND', delta: 100 });
    // Should cross 9, 8, 7 in that order
    expect(state.queuedSlotIndices).toEqual([9, 8, 7]);
  });

  it('detects single slot crossing with small CCW drag', () => {
    let state = initialWheelState;
    // Slot 0 at 210°, head at 180°. Need -30° to reach head.
    state = wheelReducer(state, { type: 'WIND', delta: -35 });
    expect(state.queuedSlotIndices).toContain(0);
    expect(state.queuedSlotIndices).toHaveLength(1);
  });

  it('detects multiple slots with larger CCW drag', () => {
    let state = initialWheelState;
    state = wheelReducer(state, { type: 'WIND', delta: -70 });
    expect(state.queuedSlotIndices).toContain(0);
    expect(state.queuedSlotIndices).toContain(1);
    expect(state.queuedSlotIndices).toHaveLength(2);
  });

  it('detects slots in correct order for CCW drag', () => {
    let state = initialWheelState;
    state = wheelReducer(state, { type: 'WIND', delta: -100 });
    // Should cross 0, 1, 2 in that order
    expect(state.queuedSlotIndices).toEqual([0, 1, 2]);
  });

  it('handles incremental CW drags correctly', () => {
    let state = initialWheelState;
    // Slot 9 starts at 150°, head at 180°, needs 30° to cross
    state = wheelReducer(state, { type: 'WIND', delta: 15 });
    expect(state.queuedSlotIndices).toHaveLength(0); // 15° total, not enough
    state = wheelReducer(state, { type: 'WIND', delta: 15 });
    expect(state.queuedSlotIndices).toHaveLength(1); // 30° total, slot 9 crosses
    expect(state.queuedSlotIndices).toContain(9);
    state = wheelReducer(state, { type: 'WIND', delta: 10 });
    // 40° total, slot 9 already queued, slot 8 at 116.67° needs 63.33° to cross
    expect(state.queuedSlotIndices).toContain(9);
    expect(state.queuedSlotIndices).toHaveLength(1);
  });

  it('handles incremental CCW drags correctly', () => {
    let state = initialWheelState;
    // Slot 0 starts at 210°, head at 180°, needs -30° to cross
    state = wheelReducer(state, { type: 'WIND', delta: -15 });
    expect(state.queuedSlotIndices).toHaveLength(0); // -15° total, not enough
    state = wheelReducer(state, { type: 'WIND', delta: -15 });
    expect(state.queuedSlotIndices).toHaveLength(1); // -30° total, slot 0 crosses
    expect(state.queuedSlotIndices).toContain(0);
    state = wheelReducer(state, { type: 'WIND', delta: -10 });
    // -40° total, slot 0 already queued
    expect(state.queuedSlotIndices).toContain(0);
    expect(state.queuedSlotIndices).toHaveLength(1);
  });

  it('does not double-queue slots on incremental drags', () => {
    let state = initialWheelState;
    state = wheelReducer(state, { type: 'WIND', delta: 35 });
    expect(state.queuedSlotIndices).toEqual([9]);
    state = wheelReducer(state, { type: 'WIND', delta: 10 });
    // Slot 9 already queued, should not be added again
    expect(state.queuedSlotIndices).toEqual([9]);
  });

  it('detects slot crossing after rotation wraps around', () => {
    let state = initialWheelState;
    // Drag past slot 9, continue to slot 8
    state = wheelReducer(state, { type: 'WIND', delta: 40 });
    expect(state.queuedSlotIndices).toEqual([9]);
    state = wheelReducer(state, { type: 'WIND', delta: 30 });
    // Total 70°, should have crossed 9 and 8
    expect(state.queuedSlotIndices).toContain(9);
    expect(state.queuedSlotIndices).toContain(8);
  });
});
