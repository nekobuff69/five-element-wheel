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
};


function getSlotAtHead(rotation: number, direction?: WindDirection | null): number {
  let best = 0;
  let bestDist = Infinity;

  for (let i = 0; i < 10; i++) {
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

  // prevSlot may have crossed (especially on first wind from ready)
  if (didCross(prevSlot, prevRotation, newRotation, step) && !alreadyQueued.includes(prevSlot)) {
    result.push(prevSlot);
  }

  // Track slots between prev and new that crossed
  if (prevSlot !== newSlot) {
    let cursor = prevSlot;
    while (cursor !== newSlot) {
      cursor = (cursor + step + 10) % 10;
      if (didCross(cursor, prevRotation, newRotation, step) && !alreadyQueued.includes(cursor) && !result.includes(cursor)) {
        result.push(cursor);
      }
    }
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
      if (state.mode !== 'ready') return state;
      if (state.selectedStone === null) return state;
      if (state.slots[action.slotIndex] === state.selectedStone) return state;
      const newSlots = [...state.slots];
      newSlots[action.slotIndex] = state.selectedStone;
      return { ...state, slots: newSlots };
    }

    case 'CLEAR_ALL': {
      if (state.mode !== 'ready') return state;
      return { ...state, slots: Array(10).fill(null) };
    }

    case 'WIND': {
      if (state.mode !== 'ready' && state.mode !== 'winding') return state;

      // Determine direction from first meaningful delta
      let direction: WindDirection | null = state.direction;
      if (direction === null && action.delta !== 0) {
        direction = action.delta > 0 ? 'cw' : 'ccw';
      }

      // Compute prevSlot and newSlot with direction bias:
      // CW → floor favours slot 9 (right of head, approaches first)
      // CCW → round favours slot 0 (left of head, approaches first)
      const prevSlot = getSlotAtHead(state.rotation, direction);

      // Accumulate rotation, cap at ±360
      let newRotation = state.rotation + action.delta;
      if (newRotation > 360) newRotation = 360;
      if (newRotation < -360) newRotation = -360;

      const newSlot = getSlotAtHead(newRotation, direction);
      const step = newRotation > state.rotation ? -1 : 1;
      const newlyCrossed = collectCrossings(prevSlot, newSlot, state.rotation, newRotation, step, state.queuedSlotIndices);
      const queued = [...state.queuedSlotIndices, ...newlyCrossed];

      return {
        ...state,
        mode: 'winding',
        rotation: newRotation,
        direction,
        queuedSlotIndices: queued,
        currentSlotAtHead: newSlot,
      };
    }

    case 'RELEASE': {
      if (state.mode !== 'winding' && state.mode !== 'tack') return state;
      return {
        ...state,
        mode: 'springBack',
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
      };
    }

    case 'SET_BPM': {
      const bpm = Math.max(60, Math.min(180, action.bpm));
      return { ...state, bpm };
    }

    default:
      return state;
  }
}
