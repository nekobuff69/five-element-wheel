import type { WheelState, WheelAction, WindDirection } from './types';
import { SLOT_ANGLE_SPAN, SLOT_START_ANGLE, HEAD_ANGLE } from './types';

export const initialWheelState: WheelState = {
  mode: 'ready',
  slots: Array(10).fill(null),
  selectedStone: null,
  rotation: 0,
  direction: null,
  queuedSlotIndices: [],
  currentSlotAtHead: null,
  bpm: 100,
  loop: true,
};


function getSlotAtHead(rotation: number, direction: WindDirection | null | undefined, queuedSlots: number[] = [], excludeQueued: boolean = false): number | null {
  let best: number | null = null;
  let bestDist = Infinity;

  for (let i = 0; i < 10; i++) {
    // Skip slots that have already been queued (only for visual feedback)
    if (excludeQueued && queuedSlots.includes(i)) continue;

    const angle = ((SLOT_START_ANGLE + i * SLOT_ANGLE_SPAN + rotation) % 360 + 360) % 360;
    let dist = Math.abs(angle - HEAD_ANGLE);
    if (dist > 180) dist = 360 - dist;

    // Direction bias: break ties toward the approaching slot
    if (direction === 'cw' && i === 9) dist -= 0.01;
    if (direction === 'ccw' && i === 0) dist -= 0.01;

    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }

  return best;
}

function didCross(slot: number, prevRot: number, newRot: number, step: number): boolean {
  const baseAngle = SLOT_START_ANGLE + slot * SLOT_ANGLE_SPAN;
  const prevAngle = ((baseAngle + prevRot) % 360 + 360) % 360;
  const newAngle = ((baseAngle + newRot) % 360 + 360) % 360;
  // CW (step=-1): crossed if slot moved from below 180° to at/above 180°
  // CCW (step=1): crossed if slot moved from above 180° to at/below 180°
  return step === -1
    ? (prevAngle < HEAD_ANGLE && newAngle >= HEAD_ANGLE)
    : (prevAngle > HEAD_ANGLE && newAngle <= HEAD_ANGLE);
}

function collectCrossings(
  prevSlot: number,
  newSlot: number,
  prevRotation: number,
  newRotation: number,
  step: number,
  alreadyQueued: number[]
): number[] {
  const result: number[] = [];

  const wouldCross = (slot: number) =>
    didCross(slot, prevRotation, newRotation, step) &&
    !alreadyQueued.includes(slot) &&
    !result.includes(slot);

  // Walk from prevSlot through newSlot inclusive, checking each for crossing
  let cursor = prevSlot;
  if (wouldCross(cursor)) result.push(cursor);
  while (cursor !== newSlot) {
    cursor = (cursor + step + 10) % 10;
    if (wouldCross(cursor)) result.push(cursor);
  }

  return result;
}


export function wheelReducer(state: WheelState, action: WheelAction): WheelState {
  switch (action.type) {
    case 'SELECT_STONE': {
      if (state.mode !== 'ready') return state;
      return { ...state, selectedStone: action.element };
    }

    case 'PLACE_STONE': {
      if (state.mode !== 'ready' && state.mode !== 'springBack') return state;
      const stoneToPlace = action.element ?? state.selectedStone;
      if (stoneToPlace === null) return state;
      if (state.slots[action.slotIndex] === stoneToPlace) return state;
      const newSlots = [...state.slots];
      newSlots[action.slotIndex] = stoneToPlace;
      return { ...state, slots: newSlots };
    }

    case 'CLEAR_ALL': {
      return { ...state, slots: Array(10).fill(null), queuedSlotIndices: [], mode: 'ready' };
    }

    case 'WIND': {
      if (state.mode !== 'ready' && state.mode !== 'winding' && state.mode !== 'springBack') return state;

      // When interrupting springBack, reset for a fresh wind cycle
      const effectiveQueued = state.mode === 'springBack' ? [] : state.queuedSlotIndices;
      const effectiveDirection = state.mode === 'springBack' ? null : state.direction;

      // Determine direction from first meaningful delta
      let direction: WindDirection | null = effectiveDirection;
      if (direction === null && action.delta !== 0) {
        direction = action.delta > 0 ? 'cw' : 'ccw';
      }

      // Compute prevSlot and newSlot with direction bias:
      // CW → floor favours slot 9 (right of head, approaches first)
      // CCW → round favours slot 0 (left of head, approaches first)
      // When transitioning from springBack, reset rotation to 0 (CSS already animated to 0°)
      const baseRotation = state.mode === 'springBack' ? 0 : state.rotation;
      const prevSlot = getSlotAtHead(baseRotation, direction, effectiveQueued, false)!;

      // Accumulate rotation, cap at ±360
      let newRotation = baseRotation + action.delta;
      if (newRotation > 360) newRotation = 360;
      if (newRotation < -360) newRotation = -360;

      const newSlot = getSlotAtHead(newRotation, direction, effectiveQueued, false)!;
      const step = newRotation > baseRotation ? -1 : 1;
      const newlyCrossed = collectCrossings(prevSlot, newSlot, baseRotation, newRotation, step, effectiveQueued);
      const queued = [...effectiveQueued, ...newlyCrossed];

      // For visual feedback, exclude already-queued slots so glow moves to next approaching slot
      const visualSlot = getSlotAtHead(newRotation, direction, queued, true);

      return {
        ...state,
        mode: 'winding',
        rotation: newRotation,
        direction,
        queuedSlotIndices: queued,
        currentSlotAtHead: visualSlot,
      };
    }

    case 'RELEASE': {
      if (state.mode !== 'winding' && state.mode !== 'tack') return state;

      // Capture the approaching slot if it's close to the head
      let finalQueued = state.queuedSlotIndices;
      const visualSlot = state.currentSlotAtHead;
      if (visualSlot !== null && !state.queuedSlotIndices.includes(visualSlot)) {
        const slotAngle = ((SLOT_START_ANGLE + visualSlot * SLOT_ANGLE_SPAN + state.rotation) % 360 + 360) % 360;
        let dist = Math.abs(slotAngle - HEAD_ANGLE);
        if (dist > 180) dist = 360 - dist;

        // If within 10° of head, capture it
        if (dist <= 10) {
          finalQueued = [...state.queuedSlotIndices, visualSlot];
        }
      }

      return {
        ...state,
        mode: 'springBack',
        queuedSlotIndices: finalQueued,
      };
    }

    case 'TACK': {
      if (state.mode !== 'winding') return state;
      return {
        ...state,
        mode: 'tack',
        currentSlotAtHead: null,
      };
    }

    case 'COMPLETE': {
      if (state.mode !== 'springBack') return state;
      return {
        ...initialWheelState,
        slots: state.slots,
        selectedStone: state.selectedStone,
        bpm: state.bpm,
        loop: state.loop,
      };
    }

    case 'SET_BPM': {
      const bpm = Math.max(60, Math.min(180, action.bpm));
      return { ...state, bpm };
    }

    case 'SET_LOOP': {
      return { ...state, loop: action.loop };
    }

    default:
      return state;
  }
}
