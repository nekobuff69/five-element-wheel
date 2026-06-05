import type { WheelState, WheelAction, WindDirection } from './types';

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
  // Horseshoe arc: 10 slots across 300°, starting at 210°, 33.33° apart
  // Gap of 60° centered at 180° (head position)
  const SLOT_ANGLE_SPAN = 300 / 9;
  const x = (-30 - rotation) % 360;
  const normalized = (x + 360) % 360;
  const raw = normalized / SLOT_ANGLE_SPAN;
  // Bias toward the slot approaching from the correct side of the gap:
  // CW → slot 9 (right of head) approaches first → floor
  // CCW → slot 0 (left of head) approaches first → round
  const slotIndex = direction === 'cw' ? Math.floor(raw) : Math.round(raw);
  return ((slotIndex % 10) + 10) % 10;

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

      const wasReady = state.mode === 'ready';

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
      const queued = [...state.queuedSlotIndices];

      // Track new slots crossing the head
      if (wasReady) {
        // First wind — push the starting slot (it crosses the head during this wind)
        if (!queued.includes(prevSlot)) {
          queued.push(prevSlot);
        }
      }
      if (prevSlot !== newSlot) {
        // Track any slots between prev and new
        const step = newRotation > state.rotation ? -1 : 1;
        let cursor = prevSlot;
        while (cursor !== newSlot) {
          cursor = (cursor + step + 10) % 10;
          if (!queued.includes(cursor)) {
            queued.push(cursor);
          }
        }
      }
      if (!queued.includes(newSlot)) {
        queued.push(newSlot);
      }

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
