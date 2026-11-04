import type { CSSProperties } from 'react';
import type { WheelState, WheelAction } from './types';
import { ELEMENT_COLORS, ELEMENT_SYMBOLS } from './types';
import { SLOT_ANGLE_SPAN, SLOT_START_ANGLE } from './geometry';
import Slot from './Slot';
import Head from './Head';
import PhraseTraceView from './PhraseTraceView';
import { useRef, useState, useEffect } from 'react';
import { useWheelGesture } from './useWheelGesture';
import { useWheelPlayback } from './useWheelPlayback';
import { useSlotDrag } from './useSlotDrag';

interface WheelProps {
  state: WheelState;
  dispatch: React.Dispatch<WheelAction>;
  snapTargetSlot: number | null;
}

const SLOT_COUNT = 10;
const SLOT_TOP = 40;
const WHEEL_RADIUS = 180;

// Decorative compass geometry, derived from the same constants as the Slots.
const COMPASS_RADIUS = 166;
const COMPASS_SPAN = 9 * SLOT_ANGLE_SPAN; // 300 degrees, leaving a 60 degree reading gap
const TICK_COUNT = 30;

function polar(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: WHEEL_RADIUS + radius * Math.sin(rad),
    y: WHEEL_RADIUS - radius * Math.cos(rad),
  };
}

function arcPath(radius: number) {
  const from = polar(SLOT_START_ANGLE, radius);
  const to = polar(SLOT_START_ANGLE + COMPASS_SPAN, radius);
  return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} A ${radius} ${radius} 0 1 1 ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
}

function Wheel({ state, dispatch, snapTargetSlot }: WheelProps) {
  const headElement =
    state.currentSlotAtHead !== null
      ? state.slots[state.currentSlotAtHead]
      : null;
  // Playback order: encounter order (as stones passed the head)
  const playbackIndices = state.queuedSlotIndices;
  const wheelRef = useRef<HTMLDivElement>(null!);
  const { springBackPlayingIndex, playbackRef } = useWheelPlayback(
    state,
    dispatch,
  );
  useWheelGesture(
    wheelRef,
    state.mode,
    (delta) => dispatch({ type: 'WIND', delta }),
    () => dispatch({ type: 'RELEASE' }),
  );
  const {
    draggingFromSlotIndex,
    ghostElement: slotGhostElement,
    ghostPosition: slotGhostPosition,
    isFadingOut: slotGhostFading,
    snapTargetSlot: slotDragSnapTarget,
    handleSlotPointerDown,
  } = useSlotDrag(dispatch);
  const [showTackFlash, setShowTackFlash] = useState(false);
  const [showHint, setShowHint] = useState(
    state.slots.every((s) => s === null),
  );

  useEffect(() => {
    if (state.mode === 'winding' && Math.abs(state.rotation) >= 360) {
      setShowTackFlash(true);
      const timer = setTimeout(() => setShowTackFlash(false), 300);
      return () => clearTimeout(timer);
    }
    if (state.mode !== 'winding') {
      setShowTackFlash(false);
    }
  }, [state.rotation, state.mode]);

  useEffect(() => {
    if (state.mode === 'winding') {
      setShowHint(false);
    }
  }, [state.mode]);

  function getWheelStyle(): CSSProperties {
    if (state.mode === 'springBack') {
      const count = state.queuedSlotIndices.length;
      const dur = count > 0 ? count * (60 / state.bpm) : 0;
      return {
        transform: 'rotate(0deg)',
        transition: `transform ${dur}s linear`,
      };
    }
    return { transform: `rotate(${state.rotation}deg)` };
  }

  function handleTransitionEnd(e: React.TransitionEvent<HTMLDivElement>) {
    if (state.mode !== 'springBack') return;
    if (e.propertyName !== 'transform') return;
    if (e.target !== e.currentTarget) return;
    // When playback is active, let the rAF onComplete handle the COMPLETE dispatch.
    // The CSS transition may finish before the audio clock has processed the final beat.
    if (playbackRef.current) return;
    dispatch({ type: 'COMPLETE' });
  }

  return (
    <>
      <div className="wheel-frame">
        <div
          className={`wheel-container wheel-container--${state.mode}${showTackFlash ? ' wheel-container--tack-flash' : ''}`}
          ref={wheelRef}
        >
          <div
            className="wheel"
            style={getWheelStyle()}
            onTransitionEnd={handleTransitionEnd}
          >
            <svg
              className="wheel-compass"
              viewBox="0 0 360 360"
              aria-hidden="true"
            >
              <path className="wheel-compass__arc" d={arcPath(COMPASS_RADIUS)} />
              <path
                className="wheel-compass__inner"
                d={arcPath(COMPASS_RADIUS - 14)}
              />
              {Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
                const angle = SLOT_START_ANGLE + (i * COMPASS_SPAN) / TICK_COUNT;
                const inner = polar(angle, COMPASS_RADIUS - 7);
                const outer = polar(
                  angle,
                  COMPASS_RADIUS + (i % 3 === 0 ? 5 : 0),
                );
                return (
                  <line
                    key={i}
                    className={`wheel-compass__tick${i % 3 === 0 ? ' wheel-compass__tick--major' : ''}`}
                    x1={inner.x}
                    y1={inner.y}
                    x2={outer.x}
                    y2={outer.y}
                  />
                );
              })}
            </svg>
            {Array.from({ length: SLOT_COUNT }, (_, i) => {
              const slotAngle = SLOT_START_ANGLE + i * SLOT_ANGLE_SPAN;
              const effectiveRotation =
                state.mode === 'springBack' ? 0 : state.rotation;
              const counterRotation = -(effectiveRotation + slotAngle);
              const sortedPos = playbackIndices.indexOf(i);
              const isCurrentlyPlaying =
                sortedPos >= 0 && sortedPos === springBackPlayingIndex;
              const isDimmed =
                state.mode === 'springBack' &&
                state.slots[i] !== null &&
                !isCurrentlyPlaying;
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    top: `${SLOT_TOP}px`,
                    left: '50%',
                    transform: `translateX(-50%) rotate(${slotAngle}deg)`,
                    transformOrigin: `center ${WHEEL_RADIUS - SLOT_TOP}px`,
                  }}
                >
                  <Slot
                    index={i}
                    element={state.slots[i]}
                    isQueued={playbackIndices.includes(i)}
                    counterRotation={counterRotation}
                    onClick={() => {
                      if (
                        state.slots[i] !== null &&
                        state.slots[i] === state.selectedStone
                      ) {
                        dispatch({ type: 'REMOVE_STONE', slotIndex: i });
                      } else {
                        dispatch({ type: 'PLACE_STONE', slotIndex: i });
                      }
                    }}
                    onPointerDown={
                      state.slots[i] !== null
                        ? (e) => handleSlotPointerDown(i, state.slots[i]!, e)
                        : undefined
                    }
                    mode={state.mode}
                    isDimmed={isDimmed}
                    isCurrentlyPlaying={isCurrentlyPlaying}
                    isSnapTarget={
                      snapTargetSlot === i || slotDragSnapTarget === i
                    }
                    isDraggedAway={draggingFromSlotIndex === i}
                  />
                </div>
              );
            })}
          </div>

          <svg
            className="wheel-needle"
            viewBox="0 0 360 360"
            aria-hidden="true"
          >
            <line
              className="wheel-needle__line"
              x1="180"
              y1="196"
              x2="180"
              y2="332"
            />
            <circle className="wheel-needle__hub" cx="180" cy="180" r="17" />
            <line
              className="wheel-needle__cross"
              x1="166"
              y1="180"
              x2="194"
              y2="180"
            />
            <line
              className="wheel-needle__cross"
              x1="180"
              y1="166"
              x2="180"
              y2="194"
            />
          </svg>

          <Head
            currentElement={headElement}
            springBackElement={
              state.mode === 'springBack' && springBackPlayingIndex >= 0
                ? state.slots[playbackIndices[springBackPlayingIndex]]
                : null
            }
            isSpringBack={state.mode === 'springBack'}
            beat={springBackPlayingIndex}
          />

          <div className="wheel-direction" aria-hidden="true">
            {state.direction === 'cw'
              ? '順 →'
              : state.direction === 'ccw'
                ? '← 逆'
                : ''}
          </div>

          {slotGhostElement && (slotGhostPosition || slotGhostFading) && (
            <div
              className={`stone-ghost${slotGhostFading ? ' stone-ghost--fading' : ''}`}
              data-element={slotGhostElement}
              style={
                {
                  left: slotGhostPosition?.x ?? 0,
                  top: slotGhostPosition?.y ?? 0,
                  '--stone-color': ELEMENT_COLORS[slotGhostElement],
                } as CSSProperties
              }
            >
              <span className="stone-ghost__core">
                {ELEMENT_SYMBOLS[slotGhostElement]}
              </span>
            </div>
          )}
        </div>
      </div>

      <PhraseTraceView
        queuedSlotIndices={state.queuedSlotIndices}
        slots={state.slots}
        playingIndex={springBackPlayingIndex}
        mode={state.mode}
      />

      {showHint && state.mode === 'ready' && (
        <div className="wheel-hint">拖石入巢 · 轉盤上弦 · 鬆手成句</div>
      )}
    </>
  );
}

export default Wheel;
