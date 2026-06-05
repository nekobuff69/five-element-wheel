import type { WheelState, WheelAction, ElementType } from './types';
import Slot from './Slot';
import Head from './Head';
import { useEffect, useRef, useState } from 'react';
import { playTack, playSequence, stopAudio, getAudioContext } from './audio';
interface WheelProps {
  state: WheelState;
  dispatch: React.Dispatch<WheelAction>;
}

const SLOT_COUNT = 10;
const SLOT_TOP = 10;
const SLOT_SIZE = 36;
const WHEEL_RADIUS = 150;
const SLOT_ANGLE_SPAN = 300 / 9; // ~33.33° for 10 slots across 300° arc
const ORIGIN_DISTANCE = WHEEL_RADIUS - (SLOT_TOP + SLOT_SIZE / 2);
const SLOT_START_ANGLE = 210; // Arc starts left of bottom gap, wraps through top
const DRAG_THRESHOLD = 5;
function getAngle(centerX: number, centerY: number, px: number, py: number): number {
  return Math.atan2(py - centerY, px - centerX) * (180 / Math.PI);
}

function normalizeDelta(delta: number): number {
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

function Wheel({ state, dispatch }: WheelProps) {
  const headElement =
    state.currentSlotAtHead !== null
      ? state.slots[state.currentSlotAtHead]
      : null;
  // Playback order: encounter order (as stones passed the head)
  const playbackIndices = state.queuedSlotIndices;
  const wheelRef = useRef<HTMLDivElement>(null!);
  const isDraggingRef = useRef(false);
  const lastAngleRef = useRef<number | null>(null);
  const prevModeRef = useRef(state.mode);
  const dragStartedRef = useRef(false);
  const accumulatedMovementRef = useRef(0);

  const playbackRef = useRef<PlaybackState | null>(null);
interface PlaybackState {
  t0: number;
  beatInterval: number;
  indices: number[];
  slots: (ElementType | null)[];
  count: number;
  rafId: number | null;
  started: boolean;
  completed: boolean;
}


  const [springBackPlayingIndex, setSpringBackPlayingIndex] = useState(-1);




  useEffect(() => {
    if (state.mode === 'winding' && Math.abs(state.rotation) >= 360) {
      dispatch({ type: 'TACK' });
    }
  }, [state.mode, state.rotation, dispatch]);

  useEffect(() => {
    if (state.mode === 'tack' && prevModeRef.current !== 'tack') {
      playTack();
    }
    prevModeRef.current = state.mode;
  }, [state.mode]);




  // Dispatch COMPLETE immediately when spring-back duration is 0
  useEffect(() => {
    if (state.mode === 'springBack') {
      const count = state.queuedSlotIndices.length;
      const dur = count > 0 ? count * (60 / state.bpm) : 0;
      if (dur === 0) {
        stopAudio();
        dispatch({ type: 'COMPLETE' });
      }
    }
  }, [state.mode, state.queuedSlotIndices.length, state.bpm, dispatch]);
  // Advance springBackPlayingIndex via rAF synced to AudioContext clock
  useEffect(() => {
    if (state.mode !== 'springBack') return;

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const count = state.queuedSlotIndices.length;
    if (count === 0) {
      dispatch({ type: 'COMPLETE' });
      return;
    }

    if (!state.direction) {
      dispatch({ type: 'COMPLETE' });
      return;
    }

    const beatInterval = 60 / state.bpm;
    const t0 = ctx.currentTime + 0.05; // 50ms lookahead

    const indices = state.queuedSlotIndices;

    playbackRef.current = {
      t0,
      beatInterval,
      indices: indices,
      slots: state.slots,
      count,
      rafId: null,
      started: false,
      completed: false,
    };

    // Schedule audio
    playSequence(
      state.queuedSlotIndices,
      state.slots,
      state.bpm,
      state.direction,
      t0
    );

    // Start rAF loop
    const tick = () => {
      const pb = playbackRef.current;
      if (!pb || pb.completed) return;

      const elapsed = ctx.currentTime - pb.t0;
      const currentBeat = Math.floor(elapsed / pb.beatInterval);

      // Check if playback has finished
      const totalDuration = pb.count * pb.beatInterval;
      if (elapsed >= totalDuration + pb.beatInterval * 0.5) {
        pb.completed = true;
        pb.rafId = null;
        dispatch({ type: 'COMPLETE' });
        return;
      }

      // Direct lookup: currentBeat is the index into indices
      if (currentBeat >= 0 && currentBeat < pb.indices.length) {
        const slotIdx = pb.indices[currentBeat];
        if (pb.slots[slotIdx] !== null) {
          setSpringBackPlayingIndex(currentBeat);
        } else {
          setSpringBackPlayingIndex(-1);
        }
      }

      // Continue rAF loop
      pb.rafId = requestAnimationFrame(tick);
    };

    playbackRef.current!.rafId = requestAnimationFrame(tick);

    // Cleanup
    return () => {
      const pb = playbackRef.current;
      if (pb && pb.rafId !== null) {
        cancelAnimationFrame(pb.rafId);
        pb.rafId = null;
      }
    };
  }, [
    state.mode,
    state.queuedSlotIndices,
    state.slots,
    state.bpm,
    state.direction,
    dispatch,
  ]);


  function getWheelStyle(): React.CSSProperties {
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
    stopAudio();
    dispatch({ type: 'COMPLETE' });
  }
  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const container = wheelRef.current;
    if (!container) return;
    if (state.mode !== 'ready' && state.mode !== 'winding') return;
    container.setPointerCapture(e.pointerId);
    const rect = container.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    lastAngleRef.current = getAngle(cx, cy, e.clientX, e.clientY);
    isDraggingRef.current = true;
    dragStartedRef.current = false;
    accumulatedMovementRef.current = 0;
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current || lastAngleRef.current === null) return;
    if (state.mode !== 'ready' && state.mode !== 'winding') return;
    const container = wheelRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const currentAngle = getAngle(cx, cy, e.clientX, e.clientY);
    const rawDelta = currentAngle - lastAngleRef.current;
    const delta = normalizeDelta(rawDelta);
    lastAngleRef.current = currentAngle;
    if (!dragStartedRef.current) {
      accumulatedMovementRef.current += Math.abs(delta);
      if (accumulatedMovementRef.current >= DRAG_THRESHOLD) {
        dragStartedRef.current = true;
      } else {
        return;
      }
    }
    if (delta !== 0) {
      dispatch({ type: 'WIND', delta });
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current) return;
    const container = wheelRef.current;
    if (container) {
      container.releasePointerCapture(e.pointerId);
    }
    const wasDragStarted = dragStartedRef.current;
    isDraggingRef.current = false;
    lastAngleRef.current = null;
    dragStartedRef.current = false;
    accumulatedMovementRef.current = 0;
    if (wasDragStarted) {
      dispatch({ type: 'RELEASE' });
    }
  }
  return (
    <div
      className={`wheel-container${state.mode === 'tack' ? ' wheel-container--tack' : ''}`}
      ref={wheelRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        className="wheel"
        style={getWheelStyle()}
        onTransitionEnd={handleTransitionEnd}
      >
        {Array.from({ length: SLOT_COUNT }, (_, i) => {
          const slotAngle = SLOT_START_ANGLE + i * SLOT_ANGLE_SPAN;
          const effectiveRotation = state.mode === 'springBack' ? 0 : state.rotation;
          const counterRotation = -(effectiveRotation + slotAngle);
          const sortedPos = playbackIndices.indexOf(i);
          const isCurrentlyPlaying = sortedPos >= 0 && sortedPos === springBackPlayingIndex;
          const isPlayed = sortedPos >= 0 && sortedPos < springBackPlayingIndex;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: `${SLOT_TOP}px`,
                left: '50%',
                transform: `translateX(-50%) rotate(${slotAngle}deg)`,
                transformOrigin: `center ${ORIGIN_DISTANCE}px`,
              }}
            >
              <Slot
                index={i}
                element={state.slots[i]}
                isAtHead={state.currentSlotAtHead === i}
                counterRotation={counterRotation}
                onClick={() => dispatch({ type: 'PLACE_STONE', slotIndex: i })}
                mode={state.mode}
                isPlayed={isPlayed}
                isCurrentlyPlaying={isCurrentlyPlaying}
              />
            </div>
          );
        })}
      </div>
      <Head
        currentElement={headElement}
        springBackElement={
          state.mode === 'springBack' && springBackPlayingIndex >= 0
            ? state.slots[playbackIndices[springBackPlayingIndex]]
            : null
        }
        isSpringBack={state.mode === 'springBack'}
      />
    </div>
  );
}

export default Wheel;
