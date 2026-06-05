import type { WheelState, WheelAction } from './types';
import Slot from './Slot';
import Head from './Head';
import { useEffect, useRef, useState } from 'react';
import { playTack, playSequence, stopAudio } from './audio';
interface WheelProps {
  state: WheelState;
  dispatch: React.Dispatch<WheelAction>;
}

const SLOT_COUNT = 10;
const SLOT_TOP = 10;
const SLOT_SIZE = 36;
const WHEEL_RADIUS = 150;
const ORIGIN_DISTANCE = WHEEL_RADIUS - (SLOT_TOP + SLOT_SIZE / 2);
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
  const wheelRef = useRef<HTMLDivElement>(null!);
  const isDraggingRef = useRef(false);
  const lastAngleRef = useRef<number | null>(null);
  const prevModeRef = useRef(state.mode);
  const springBackRef = useRef(false);
  const hasPlayedRef = useRef(false);

  const [springBackPlayingIndex, setSpringBackPlayingIndex] = useState(-1);

  // Reset playing index when not in springBack
  useEffect(() => {
    if (state.mode !== 'springBack') {
      setSpringBackPlayingIndex(-1);
    }
  }, [state.mode]);

  // Advance springBackPlayingIndex through queued slots at each beat
  useEffect(() => {
    if (state.mode !== 'springBack') return;

    const count = state.queuedSlotIndices.length;
    if (count === 0) return;

    const beatInterval = 60 / state.bpm;

    setSpringBackPlayingIndex(0);

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i < count; i++) {
      const timer = setTimeout(() => {
        setSpringBackPlayingIndex(i);
      }, i * beatInterval * 1000);
      timers.push(timer);
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [state.mode, state.queuedSlotIndices.length, state.bpm]);


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

  useEffect(() => {
    if (state.mode === 'springBack' && !springBackRef.current) {
      springBackRef.current = true;
    }
    if (state.mode !== 'springBack') {
      springBackRef.current = false;
    }
  }, [state.mode]);

  useEffect(() => {
    if (state.mode === 'springBack' && !hasPlayedRef.current) {
      hasPlayedRef.current = true;
      if (state.direction && state.queuedSlotIndices.length > 0) {
        playSequence(
          state.queuedSlotIndices,
          state.slots,
          state.bpm,
          state.direction
        );
      }
    }
    if (state.mode !== 'springBack') {
      hasPlayedRef.current = false;
    }
  }, [state.mode, state.queuedSlotIndices, state.slots, state.bpm, state.direction]);


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

  function handleTransitionEnd() {
    if (state.mode === 'springBack') {
      stopAudio();
      dispatch({ type: 'COMPLETE' });
    }
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
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current || lastAngleRef.current === null) return;
    const container = wheelRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const currentAngle = getAngle(cx, cy, e.clientX, e.clientY);
    const rawDelta = currentAngle - lastAngleRef.current;
    const delta = normalizeDelta(rawDelta);
    lastAngleRef.current = currentAngle;
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
    isDraggingRef.current = false;
    lastAngleRef.current = null;
    dispatch({ type: 'RELEASE' });
  }
  return (
    <div
      className="wheel-container"
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
          const slotAngle = i * 36;
          const effectiveRotation = state.mode === 'springBack' ? 0 : state.rotation;
          const counterRotation = -(effectiveRotation + slotAngle);
          const springBackIndex = state.queuedSlotIndices.indexOf(i);
          const isCurrentlyPlaying = springBackIndex >= 0 && springBackIndex === springBackPlayingIndex;
          const isPlayed = springBackIndex >= 0 && springBackIndex < springBackPlayingIndex;
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
            ? state.slots[state.queuedSlotIndices[springBackPlayingIndex]]
            : null
        }
        isSpringBack={state.mode === 'springBack'}
      />
    </div>
  );
}

export default Wheel;
