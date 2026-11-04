import type { ElementType } from './types';
import { ELEMENT_INTERVALS } from './types';

/** Pentatonic degrees in ascending pitch order, derived from the interval table. */
export const PENTATONIC_DEGREE_NAMES = ['宮', '商', '角', '徵', '羽'] as const;

const ELEMENTS_BY_DEGREE = (
  Object.keys(ELEMENT_INTERVALS) as ElementType[]
).sort((a, b) => ELEMENT_INTERVALS[a] - ELEMENT_INTERVALS[b]);

/** 0 = 宫 (root), 4 = 羽 (M6). Returns null for a rest. */
export function getPentatonicDegree(element: ElementType | null): number | null {
  if (element === null) return null;
  const degree = ELEMENTS_BY_DEGREE.indexOf(element);
  return degree < 0 ? null : degree;
}

export interface PhraseTracePoint {
  beat: number;
  slotIndex: number;
  element: ElementType | null;
  degree: number | null;
  rest: boolean;
  played: boolean;
  current: boolean;
  pending: boolean;
}

export interface PhraseTraceSegment {
  from: number;
  to: number;
}

export interface PhraseTraceResult {
  points: PhraseTracePoint[];
  segments: PhraseTraceSegment[];
  playedUntil: number;
  iteration: number;
}

export interface PhraseTraceInput {
  queuedSlotIndices: number[];
  slots: (ElementType | null)[];
  /** springBackPlayingIndex: -1 on rest beats and while idle. */
  playingIndex: number;
  previousPlayedUntil: number;
  previousIteration: number;
  isPlaying: boolean;
}

/**
 * Pure computation of the phrase trace.
 *
 * Three time-scale rules are encoded here so the view layer stays dumb:
 *  - A rest beat reports -1 and must hold the line instead of rolling it back.
 *  - A playing index below the previous played-until marks a new loop iteration.
 *  - Only consecutive sounded beats are joined; a rest breaks the stroke.
 */
export function buildPhraseTrace(input: PhraseTraceInput): PhraseTraceResult {
  const {
    queuedSlotIndices,
    slots,
    playingIndex,
    previousPlayedUntil,
    previousIteration,
    isPlaying,
  } = input;

  const points: PhraseTracePoint[] = [];
  const segments: PhraseTraceSegment[] = [];

  let playedUntil = -1;
  let iteration = previousIteration;

  if (isPlaying) {
    if (playingIndex < 0) {
      playedUntil = previousPlayedUntil;
    } else if (playingIndex < previousPlayedUntil) {
      playedUntil = playingIndex;
      iteration = previousIteration + 1;
    } else {
      playedUntil = Math.max(previousPlayedUntil, playingIndex);
    }
  }

  for (let beat = 0; beat < queuedSlotIndices.length; beat++) {
    const slotIndex = queuedSlotIndices[beat];
    const element = slots[slotIndex] ?? null;
    const rest = element === null;
    const played = !rest && isPlaying && beat <= playedUntil;
    const current = !rest && isPlaying && beat === playingIndex;
    const pending = !rest && isPlaying && !played;

    points.push({
      beat,
      slotIndex,
      element,
      degree: getPentatonicDegree(element),
      rest,
      played,
      current,
      pending,
    });

    if (beat > 0 && played && points[beat - 1].played) {
      segments.push({ from: beat - 1, to: beat });
    }
  }

  return { points, segments, playedUntil, iteration };
}
