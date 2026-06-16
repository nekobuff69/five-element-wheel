import {
  type ElementType,
  ELEMENT_INTERVALS,
  KEY_NAMES,
} from './types';

const C4 = 261.63;

/**
 * Compute element frequencies in Hz for a given key and octave.
 * Preserves pentatonic intervals: root→M2→M3→P5→M6.
 */
export function getElementFrequencies(
  key: string,
  octave: number,
): Record<ElementType, number> {
  const semitoneFromC = KEY_NAMES.indexOf(
    key as (typeof KEY_NAMES)[number],
  );
  if (semitoneFromC < 0) {
    // Fallback to C if invalid key
    return getElementFrequencies('C', octave);
  }
  const rootFreq = C4 * 2 ** (semitoneFromC / 12 + (octave - 4));
  const result = {} as Record<ElementType, number>;
  for (const el of Object.keys(ELEMENT_INTERVALS) as ElementType[]) {
    result[el] = rootFreq * 2 ** (ELEMENT_INTERVALS[el] / 12);
  }
  return result;
}
