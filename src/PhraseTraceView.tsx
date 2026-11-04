import { useEffect, useRef, useState } from 'react';
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
}

const BEAT_X = (beat: number) => 26 + beat * 30;
const DEGREE_Y = (degree: number) => 92 - degree * 18;
const RENEW_MS = 640;

/**
 * Presentational only. Reads state, renders the trace, dispatches nothing.
 * The played-until cursor lives in a ref because the beat callback fires on
 * every animation frame with the same index; React bails out on equal state.
 */
export default function PhraseTraceView({
  queuedSlotIndices,
  slots,
  playingIndex,
  mode,
}: PhraseTraceProps) {
  const cursor = useRef({ playedUntil: -1, iteration: 0 });
  const lastIteration = useRef(0);
  const [renewing, setRenewing] = useState(false);

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

  useEffect(() => {
    if (trace.iteration === lastIteration.current) return;
    lastIteration.current = trace.iteration;
    setRenewing(true);
    const timer = window.setTimeout(() => setRenewing(false), RENEW_MS);
    return () => window.clearTimeout(timer);
  }, [trace.iteration]);

  const caption = isPlaying
    ? playingIndex >= 0
      ? `第 ${playingIndex + 1} 拍`
      : '休止'
    : mode === 'winding'
      ? '上弦中'
      : '待轉';

  return (
    <div
      className={`phrase-trace${renewing ? ' phrase-trace--renewing' : ''}`}
      aria-label="樂句墨跡"
    >
      <div className="phrase-trace__caption">
        <span>一轉 · {trace.points.length} 拍</span>
        <span>{caption}</span>
      </div>
      <svg viewBox="0 0 320 112" role="img" aria-label="十拍為橫軸、五音為縱軸的樂句墨跡">
        <title>樂句墨跡</title>
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
          return (
            <circle
              key={point.beat}
              className={`phrase-trace__hollow${point.pending ? ' phrase-trace__hollow--pending' : ''}`}
              cx={x}
              cy={y}
              r={3.5}
            />
          );
        })}
      </svg>
      <div className="phrase-trace__footnote">墨跡一輪而盡 · 空巢斷筆</div>
    </div>
  );
}
