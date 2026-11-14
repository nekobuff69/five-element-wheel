import { useEffect, useRef } from 'react';
import type { ElementType, WheelMode } from './types';
import {
  buildPhraseTrace,
  PENTATONIC_DEGREE_NAMES,
} from './phraseTrace';

interface PhraseTraceProps {
  queuedSlotIndices: number[];
  slots: (ElementType | null)[];
  playingIndex: number;
  mode: WheelMode;
  washToken: number;
  pendingSlots: number[];
  restartNote: string | null;
}

const BEAT_X = (beat: number) => 26 + beat * 30;
const DEGREE_Y = (degree: number) => 92 - degree * 18;
const MARK_R = 3.5;

/**
 * Presentational only. Reads state, renders the trace, dispatches nothing.
 * The played-until cursor lives in a ref because the beat callback fires on
 * every animation frame with the same index; React bails out on equal state.
 *
 * Only the marks group is keyed by washToken and re-mounts at a loop boundary
 * for a ~180ms wash/re-ink. The grid, degree names and caption never re-mount
 * or animate, so the chart does not flicker. A hot-reloaded future beat is a
 * half-filled cinnabar "wet ink" mark, distinct from the dashed pending hollow
 * and the snap target's dashed ring. The restart inscription replaces the beat
 * readout in the same caption slot (zero added height).
 */
export default function PhraseTraceView({
  queuedSlotIndices,
  slots,
  playingIndex,
  mode,
  washToken,
  pendingSlots,
  restartNote,
}: PhraseTraceProps) {
  const cursor = useRef({ playedUntil: -1, iteration: 0 });

  const isPlaying = mode === 'springBack';
  const trace = buildPhraseTrace({
    queuedSlotIndices,
    slots,
    playingIndex: isPlaying ? playingIndex : -1,
    previousPlayedUntil: cursor.current.playedUntil,
    previousIteration: cursor.current.iteration,
    isPlaying,
  });

  useEffect(() => {
    cursor.current = {
      playedUntil: trace.playedUntil,
      iteration: trace.iteration,
    };
  }, [trace.playedUntil, trace.iteration]);

  const caption = isPlaying
    ? playingIndex >= 0
      ? `第 ${playingIndex + 1} 拍`
      : '休止'
    : mode === 'winding'
      ? '上弦中'
      : '待轉';

  const displayCaption = restartNote ?? caption;

  return (
    <div className="phrase-trace" aria-label="樂句墨跡">
      <div className="phrase-trace__caption">
        <span>一轉 · {trace.points.length} 拍</span>
        <span>{displayCaption}</span>
      </div>
      <svg viewBox="0 0 320 112" role="img" aria-label="十拍為橫軸、五音為縱軸的樂句墨跡">
        <title>樂句墨跡</title>
        <g className="phrase-trace__grid">
          {PENTATONIC_DEGREE_NAMES.map((name, degree) => (
            <g key={name}>
              <line
                className="phrase-trace__rule"
                x1={24}
                y1={DEGREE_Y(degree)}
                x2={300}
                y2={DEGREE_Y(degree)}
              />
              <text
                className="phrase-trace__degree"
                x={6}
                y={DEGREE_Y(degree) + 4}
              >
                {name}
              </text>
            </g>
          ))}
        </g>
        <g
          key={washToken}
          className={`phrase-trace__marks${washToken > 0 ? ' phrase-trace__marks--wash' : ''}`}
        >
          {trace.segments.map((segment) => {
            const from = trace.points[segment.from];
            const to = trace.points[segment.to];
            if (from.degree === null || to.degree === null) return null;
            return (
              <line
                key={`${segment.from}-${segment.to}`}
                className="phrase-trace__stroke"
                x1={BEAT_X(from.beat)}
                y1={DEGREE_Y(from.degree)}
                x2={BEAT_X(to.beat)}
                y2={DEGREE_Y(to.degree)}
              />
            );
          })}
          {trace.points.map((point) => {
            const x = BEAT_X(point.beat);
            const y = point.degree === null ? 92 : DEGREE_Y(point.degree);
            if (point.rest) {
              return (
                <line
                  key={point.beat}
                  className="phrase-trace__rest"
                  x1={x - 3}
                  y1={y}
                  x2={x + 3}
                  y2={y}
                />
              );
            }
            if (point.played) {
              return (
                <rect
                  key={point.beat}
                  className={`phrase-trace__seal${point.current ? ' phrase-trace__seal--current' : ''}`}
                  x={x - 4}
                  y={y - 4}
                  width={8}
                  height={8}
                />
              );
            }
            // Hot-reloaded future beat: half-filled cinnabar, solid ring.
            // Never played and never a rest, and distinct from the dashed
            // pending hollow and the snap target's dashed ring.
            const isWet =
              pendingSlots.includes(point.slotIndex) &&
              !point.played &&
              !point.rest;
            if (isWet) {
              return (
                <g key={point.beat} className="phrase-trace__wet">
                  <circle
                    className="phrase-trace__wet-ring"
                    cx={x}
                    cy={y}
                    r={MARK_R}
                  />
                  <path
                    className="phrase-trace__wet-fill"
                    d={`M ${x} ${y - MARK_R} A ${MARK_R} ${MARK_R} 0 0 1 ${x} ${y + MARK_R} Z`}
                  />
                </g>
              );
            }
            return (
              <circle
                key={point.beat}
                className={`phrase-trace__hollow${point.pending ? ' phrase-trace__hollow--pending' : ''}`}
                cx={x}
                cy={y}
                r={MARK_R}
              />
            );
          })}
        </g>
      </svg>
      {/* Visually hidden, zero-height live region. Its text is the beat caption,
          which changes only once per beat (React leaves the DOM text node alone
          on every other re-render), so the position is announced politely once
          per beat without depending on the restart inscription or wash token. */}
      <span className="phrase-trace__live" aria-live="polite" aria-atomic="true">
        {caption}
      </span>
    </div>
  );
}
