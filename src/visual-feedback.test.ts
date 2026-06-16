import { describe, it, expect } from 'vitest';
import { wheelReducer, initialWheelState } from './wheelReducer';

// Helper to access the internal getSlotAtHead function
// We'll test it indirectly through the reducer's currentSlotAtHead field

describe('getSlotAtHead visual feedback', () => {
  it('identifies correct slot at head during CW wind', () => {
    let state = initialWheelState;

    // At rotation=0, slot 9 is at 150° (30° from head)
    state = wheelReducer(state, { type: 'WIND', delta: 1 });
    // Slot 9 now at 151°, still closest to head, not queued yet
    expect(state.currentSlotAtHead).toBe(9);

    // Continue to slot 9 at head (crosses 180°)
    state = wheelReducer(state, { type: 'WIND', delta: 29 });
    // Slot 9 now at 180° (at head), gets queued
    // Glow moves to next approaching slot (8)
    expect(state.currentSlotAtHead).toBe(8);

    // Continue past slot 9
    state = wheelReducer(state, { type: 'WIND', delta: 10 });
    // Slot 9 at 190° (queued), slot 8 at 156.67°
    // Slot 8 is now closest to head (not queued)
    expect(state.currentSlotAtHead).toBe(8);
  });

  it('identifies correct slot at head after rotation', () => {
    let state = initialWheelState;

    // Rotate to slot 8 position (33.33°)
    state = wheelReducer(state, { type: 'WIND', delta: 33.33 });
    // Slot 9 at 183.33° (crossed, queued), slot 8 at 150°
    // Slot 9 is queued, so glow moves to slot 8 (next approaching)
    expect(state.currentSlotAtHead).toBe(8);

    // Continue a bit more
    state = wheelReducer(state, { type: 'WIND', delta: 5 });
    // Slot 9 at 188.33° (queued), slot 8 at 155°
    // Slot 8 is 25° from head, still closest non-queued slot
    expect(state.currentSlotAtHead).toBe(8);
  });

  it('identifies correct slot at head during CCW wind', () => {
    let state = initialWheelState;

    // At rotation=0, slot 0 is at 210° (30° from head)
    state = wheelReducer(state, { type: 'WIND', delta: -1 });
    // Slot 0 now at 209°, still closest to head, not queued yet
    expect(state.currentSlotAtHead).toBe(0);

    // Continue to slot 0 at head (crosses 180°)
    state = wheelReducer(state, { type: 'WIND', delta: -29 });
    // Slot 0 now at 180° (at head), gets queued
    // Glow moves to next approaching slot (1)
    expect(state.currentSlotAtHead).toBe(1);

    // Continue past slot 0
    state = wheelReducer(state, { type: 'WIND', delta: -10 });
    // Slot 0 at 170° (queued), slot 1 at 243.33°
    // Slot 1 is now closest non-queued slot to head
    expect(state.currentSlotAtHead).toBe(1);
  });

  it('transitions to next slot when current slot moves past head', () => {
    let state = initialWheelState;
    
    // Rotate CW until slot 9 is past head and slot 8 is approaching
    state = wheelReducer(state, { type: 'WIND', delta: 50 });
    // Slot 9 at 200°, slot 8 at 166.67°
    // Slot 9 is 20° from head, slot 8 is 13.33° from head
    // Slot 8 should now be closest!
    expect(state.currentSlotAtHead).toBe(8);
  });
});
