export type ElementType = 'earth' | 'metal' | 'wood' | 'fire' | 'water';

export type WheelMode = 'ready' | 'winding' | 'springBack';

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
  loop: boolean;
  key: string;
  octave: number;
}

export type WheelAction =
  | { type: 'SELECT_STONE'; element: ElementType }
  | { type: 'PLACE_STONE'; slotIndex: number; element?: ElementType }
  | { type: 'REMOVE_STONE'; slotIndex: number }
  | { type: 'RESET' }
  | { type: 'WIND'; delta: number }
  | { type: 'RELEASE' }
  | { type: 'COMPLETE' }
  | { type: 'COMPLETE' }
  | { type: 'SET_BPM'; bpm: number }
  | { type: 'SET_LOOP'; loop: boolean }
  | { type: 'SET_KEY'; key: string }
  | { type: 'SET_OCTAVE'; octave: number };


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

export const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

// Semitone offsets from root preserving C pentatonic intervals
export const ELEMENT_INTERVALS: Record<ElementType, number> = {
  earth: 0,  // root (gōng 宫)
  metal: 2,  // major 2nd (shāng 商)
  wood:  4,  // major 3rd (jué 角)
  fire:  7,  // perfect 5th (zhǐ 徵)
  water: 9,  // major 6th (yǔ 羽)
};

