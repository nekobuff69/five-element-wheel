import { describe, expect, it } from 'vitest';
import type { ElementType } from './types';
import {
  buildPhraseTrace,
  getPentatonicDegree,
  PENTATONIC_DEGREE_NAMES,
} from './phraseTrace';
import type { PhraseTraceInput } from './phraseTrace';

const FULL_QUEUE = Array.from({ length: 10 }, (_, i) => i);

function slotsOf(count: number, fill: ElementType | null = 'earth') {
  return Array<ElementType | null>(count).fill(fill);
}

function traceOf(overrides: Partial<PhraseTraceInput> = {}) {
  return buildPhraseTrace({
    queuedSlotIndices: FULL_QUEUE,
    slots: slotsOf(10),
    playingIndex: -1,
    previousPlayedUntil: -1,
    previousIteration: 0,
    isPlaying: false,
    ...overrides,
  });
}

describe('pentatonic degree mapping', () => {
  it('orders the five elements as 宫商角徵羽 from low to high', () => {
    expect(PENTATONIC_DEGREE_NAMES).toEqual(['宮', '商', '角', '徵', '羽']);
    expect(getPentatonicDegree('earth')).toBe(0);
    expect(getPentatonicDegree('metal')).toBe(1);
    expect(getPentatonicDegree('wood')).toBe(2);
    expect(getPentatonicDegree('fire')).toBe(3);
    expect(getPentatonicDegree('water')).toBe(4);
    expect(getPentatonicDegree(null)).toBeNull();
  });
});

describe('phrase trace', () => {
  it('joins a fully sounded ten-beat phrase into one line', () => {
    const result = traceOf({ isPlaying: true, playingIndex: 9 });

    expect(result.points).toHaveLength(10);
    expect(result.segments).toHaveLength(9);
    expect(result.playedUntil).toBe(9);
    expect(result.points.every((point) => point.played)).toBe(true);
    expect(result.points[9].current).toBe(true);
    expect(result.points[0].current).toBe(false);
    expect(result.segments[0]).toEqual({ from: 0, to: 1 });
  });

  it('breaks the stroke at a rest and marks the rest explicitly', () => {
    const slots = slotsOf(10);
    slots[4] = null;
    const result = traceOf({ slots, isPlaying: true, playingIndex: 9 });

    expect(result.points[4].rest).toBe(true);
    expect(result.points[4].degree).toBeNull();
    expect(result.points[4].played).toBe(false);
    expect(result.segments).toHaveLength(7);
    expect(result.segments.some((s) => s.from === 3 && s.to === 4)).toBe(false);
    expect(result.segments.some((s) => s.from === 4 && s.to === 5)).toBe(false);
  });

  it('keeps future beats hollow until their beat is reached', () => {
    const result = traceOf({ isPlaying: true, playingIndex: 2 });

    expect(result.playedUntil).toBe(2);
    expect(result.segments).toHaveLength(2);
    expect(result.points.slice(0, 3).every((p) => p.played)).toBe(true);
    expect(result.points.slice(3).every((p) => p.pending)).toBe(true);
    expect(result.points[2].current).toBe(true);
  });

  it('holds the line on a rest beat instead of rolling it back', () => {
    const result = traceOf({
      isPlaying: true,
      playingIndex: -1,
      previousPlayedUntil: 5,
    });

    expect(result.playedUntil).toBe(5);
    expect(result.iteration).toBe(0);
    expect(result.points.slice(0, 6).every((p) => p.played)).toBe(true);
    expect(result.points.slice(6).every((p) => p.pending)).toBe(true);
    expect(result.segments).toHaveLength(5);
  });

  it('starts a new written line when a loop iteration wraps', () => {
    const result = traceOf({
      isPlaying: true,
      playingIndex: 0,
      previousPlayedUntil: 9,
      previousIteration: 3,
    });

    expect(result.playedUntil).toBe(0);
    expect(result.iteration).toBe(4);
    expect(result.points[0].played).toBe(true);
    expect(result.points.slice(1).every((p) => p.pending)).toBe(true);
    expect(result.segments).toHaveLength(0);
  });

  it('does not treat a rest beat as the start of a new iteration', () => {
    const result = traceOf({
      isPlaying: true,
      playingIndex: -1,
      previousPlayedUntil: 0,
      previousIteration: 6,
    });

    expect(result.iteration).toBe(6);
    expect(result.playedUntil).toBe(0);
  });

  it('produces a readable preview before playback with no seals or strokes', () => {
    const result = traceOf();

    expect(result.points).toHaveLength(10);
    expect(result.points.every((p) => p.degree === 0)).toBe(true);
    expect(result.points.every((p) => !p.played && !p.pending)).toBe(true);
    expect(result.segments).toHaveLength(0);
    expect(result.playedUntil).toBe(-1);
  });

  it('clears the played cursor when playback is not active', () => {
    const result = traceOf({
      isPlaying: false,
      playingIndex: 7,
      previousPlayedUntil: 7,
      previousIteration: 2,
    });

    expect(result.playedUntil).toBe(-1);
    expect(result.iteration).toBe(2);
    expect(result.segments).toHaveLength(0);
  });

  it('handles an early release of three queued slots', () => {
    const result = traceOf({
      queuedSlotIndices: [5, 4, 3],
      isPlaying: true,
      playingIndex: 2,
    });

    expect(result.points).toHaveLength(3);
    expect(result.points.map((p) => p.slotIndex)).toEqual([5, 4, 3]);
    expect(result.segments).toEqual([
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ]);
  });

  it('follows encounter order, not slot order, when reading the melody', () => {
    const slots = slotsOf(10, null);
    slots[5] = 'water';
    slots[4] = 'earth';
    slots[3] = 'fire';
    const result = traceOf({
      queuedSlotIndices: [5, 4, 3],
      slots,
      isPlaying: true,
      playingIndex: 2,
    });

    expect(result.points.map((p) => p.degree)).toEqual([4, 0, 3]);
  });

  it('reflects a hot-reloaded Stone as pending at its new degree', () => {
    const slots = slotsOf(10);
    slots[6] = 'water';
    const result = traceOf({ slots, isPlaying: true, playingIndex: 2 });

    expect(result.points[6].element).toBe('water');
    expect(result.points[6].degree).toBe(4);
    expect(result.points[6].pending).toBe(true);
    expect(result.points[6].played).toBe(false);
  });

  it('treats an out-of-range slot as a rest and returns an empty trace for an empty queue', () => {
    const outOfRange = traceOf({
      queuedSlotIndices: [99],
      isPlaying: true,
      playingIndex: 0,
    });
    expect(outOfRange.points[0].rest).toBe(true);
    expect(outOfRange.segments).toHaveLength(0);

    const empty = traceOf({ queuedSlotIndices: [], isPlaying: true });
    expect(empty.points).toHaveLength(0);
    expect(empty.segments).toHaveLength(0);
    expect(empty.playedUntil).toBe(-1);
  });
});
