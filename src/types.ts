export type ElementType = 'earth' | 'metal' | 'wood' | 'fire' | 'water';

export type WheelMode = 'ready' | 'winding' | 'tack' | 'springBack';

export type WindDirection = 'cw' | 'ccw';

export interface WheelState {
  mode: WheelMode;
  slots: (ElementType | null)[];
  selectedStone: ElementType | null;
  rotation: number;
  direction: WindDirection | null;
  queuedSlotIndices: number[];
  currentSlotAtHead: number | null;
  bpm: number;
}

export type WheelAction =
  | { type: 'SELECT_STONE'; element: ElementType }
  | { type: 'PLACE_STONE'; slotIndex: number }
  | { type: 'CLEAR_ALL' }
  | { type: 'WIND'; delta: number }
  | { type: 'RELEASE' }
  | { type: 'TACK' }
  | { type: 'COMPLETE' }
  | { type: 'SET_BPM'; bpm: number };

export const ELEMENT_TO_NOTE: Record<ElementType, string> = {
  earth: 'C4',
  metal: 'D4',
  wood: 'E4',
  fire: 'G4',
  water: 'A4',
};

export const ELEMENT_COLORS: Record<ElementType, string> = {
  earth: '#8B6914',
  metal: '#A8B8C0',
  wood: '#4CAF50',
  fire: '#E53935',
  water: '#1E88E5',
};
export const ELEMENT_SYMBOLS: Record<ElementType, string> = {
  earth: '土',
  metal: '金',
  wood: '木',
  fire: '火',
  water: '水',
};

