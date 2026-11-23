import type { WheelState, WheelAction, WindDirection } from './types';
import { KEY_NAMES } from './types';
import { SLOT_ANGLE_SPAN, SLOT_START_ANGLE, HEAD_ANGLE } from './geometry';

export const initialWheelState: WheelState = {
  mode: 'ready',
  slots: Array(10).fill(null),
  selectedStone: null,
  rotation: 0,
  direction: null,
  queuedSlotIndices: [],
  currentSlotAtHead: null,
  bpm: 180,
  loop: true,
  key: 'F',
  octave: 5,
};


function getSlotAtHead(rotation: number, direction: WindDirection | null | undefined, queuedSlots: number[] = [], excludeQueued: boolean = false): number | null {
  let best: number | null = null;
  let bestDist = Infinity;

  for (let i = 0; i < 10; i++) {
    // Skip slots that have already been queued (capture candidate only)
    if (excludeQueued && queuedSlots.includes(i)) continue;

    const angle = ((SLOT_START_ANGLE + i * SLOT_ANGLE_SPAN + rotation) % 360 + 360) % 360;
    let dist = Math.abs(angle - HEAD_ANGLE);
    if (dist > 180) dist = 360 - dist;

    // Direction bias: break ties toward the slot about to reach the Head
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

interface Crossing {
  slot: number;
  action: 'add' | 'remove';
}

function collectCrossings(
  prevSlot: number,
  newSlot: number,
  prevRotation: number,
  newRotation: number,
  step: number,
  queued: number[]
): Crossing[] {
  const crossings: Crossing[] = [];

  // A Head crossing is reversible: a slot already in the queue crossed back,
  // so it leaves; a slot not yet queued enters. Both happen one slot at a time
  // in traversal order, which keeps the queue a contiguous arc (LIFO undo).
  const consider = (slot: number) => {
    if (!didCross(slot, prevRotation, newRotation, step)) return;
    if (crossings.some((c) => c.slot === slot)) return;
    crossings.push({
      slot,
      action: queued.includes(slot) ? 'remove' : 'add',
    });
  };

  // Walk from prevSlot through newSlot inclusive, checking each for crossing
  let cursor = prevSlot;
  consider(cursor);
  while (cursor !== newSlot) {
    cursor = (cursor + step + 10) % 10;
    consider(cursor);
  }

  return crossings;
}


export function wheelReducer(state: WheelState, action: WheelAction): WheelState {
  switch (action.type) {
    case 'SELECT_STONE': {
      if (state.mode !== 'ready') return state;
      return { ...state, selectedStone: action.element };
    }
    case 'REMOVE_STONE': {
      if (state.mode !== 'ready' && state.mode !== 'springBack') return state;
      if (state.slots[action.slotIndex] === null) return state;
      const newSlots = [...state.slots];
      newSlots[action.slotIndex] = null;
      return { ...state, slots: newSlots };
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

    case 'RESET': {
      return { ...initialWheelState };
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
      const crossings = collectCrossings(prevSlot, newSlot, baseRotation, newRotation, step, effectiveQueued);
      let queued = [...effectiveQueued];
      for (const { slot, action } of crossings) {
        if (action === 'add') {
          if (!queued.includes(slot)) queued.push(slot);
        } else {
          queued = queued.filter((s) => s !== slot);
        }
      }

      // Exclude already-queued slots so the candidate is the next one the Head can capture
      const candidateSlot = getSlotAtHead(newRotation, direction, queued, true);

      return {
        ...state,
        mode: 'winding',
        rotation: newRotation,
        direction,
        queuedSlotIndices: queued,
        currentSlotAtHead: candidateSlot,
      };
    }

    case 'RELEASE': {
      if (state.mode !== 'winding') return state;

      // Capture the candidate if it is close enough to the Head
      let finalQueued = state.queuedSlotIndices;
      const candidateSlot = state.currentSlotAtHead;
      if (candidateSlot !== null && !state.queuedSlotIndices.includes(candidateSlot)) {
        const slotAngle = ((SLOT_START_ANGLE + candidateSlot * SLOT_ANGLE_SPAN + state.rotation) % 360 + 360) % 360;
        let dist = Math.abs(slotAngle - HEAD_ANGLE);
        if (dist > 180) dist = 360 - dist;

        // If within 10° of head, capture it
        if (dist <= 10) {
          finalQueued = [...state.queuedSlotIndices, candidateSlot];
        }
      }

      return {
        ...state,
        mode: 'springBack',
        queuedSlotIndices: finalQueued,
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
        key: state.key,
        octave: state.octave,
    };
    }

    case 'SET_BPM': {
      const bpm = Math.max(120, Math.min(200, action.bpm));
      return { ...state, bpm };
    }

    case 'SET_LOOP': {
      return { ...state, loop: action.loop };
    }
    case 'SET_KEY': {
      if (!KEY_NAMES.includes(action.key as typeof KEY_NAMES[number])) return state;
      return { ...state, key: action.key };
    }

    case 'SET_OCTAVE': {
      const octave = Math.max(3, Math.min(8, action.octave));
      return { ...state, octave };
    }


    default:
      return state;
  }
}
