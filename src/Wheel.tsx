import type { WheelState, WheelAction, ElementType } from './types';
import { SLOT_ANGLE_SPAN, SLOT_START_ANGLE } from './types';
import Slot from './Slot';
import Head from './Head';
import { useEffect, useRef, useState } from 'react';
import { playTackSound, startPlayback } from './playback';
import { useWheelGesture } from './useWheelGesture';
interface WheelProps {
  state: WheelState;
  dispatch: React.Dispatch<WheelAction>;
}

const SLOT_COUNT = 10;
const SLOT_TOP = 10;
const SLOT_SIZE = 36;
const WHEEL_RADIUS = 150;
const ORIGIN_DISTANCE = WHEEL_RADIUS - (SLOT_TOP + SLOT_SIZE / 2);


function Wheel({ state, dispatch }: WheelProps) {
  const headElement =
    state.currentSlotAtHead !== null
      ? state.slots[state.currentSlotAtHead]
      : null;
  // Playback order: encounter order (as stones passed the head)
  const playbackIndices = state.queuedSlotIndices;
  const wheelRef = useRef<HTMLDivElement>(null!);
  const prevModeRef = useRef(state.mode);



  const [springBackPlayingIndex, setSpringBackPlayingIndex] = useState(-1);
  useWheelGesture(wheelRef, state.mode, (delta) => dispatch({ type: 'WIND', delta }), () => dispatch({ type: 'RELEASE' }));




  useEffect(() => {
    if (state.mode === 'winding' && Math.abs(state.rotation) >= 360) {
      dispatch({ type: 'TACK' });
    }
  }, [state.mode, state.rotation, dispatch]);

  useEffect(() => {
    if (state.mode === 'tack' && prevModeRef.current !== 'tack') {
      playTackSound();
    }
    prevModeRef.current = state.mode;
  }, [state.mode]);




  useEffect(() => {
    if (state.mode !== 'springBack') return;
    const count = state.queuedSlotIndices.length;
    if (count === 0 || !state.direction) {
      dispatch({ type: 'COMPLETE' });
      return;
    }
    const cancel = startPlayback(
      {
        queuedSlotIndices: state.queuedSlotIndices,
        slots: state.slots,
        bpm: state.bpm,
        direction: state.direction,
      },
      (idx) => setSpringBackPlayingIndex(idx),
      () => dispatch({ type: 'COMPLETE' })
    );
    return cancel;
  }, [state.mode, state.queuedSlotIndices, state.slots, state.bpm, state.direction, dispatch]);


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
    dispatch({ type: 'COMPLETE' });
  }
  return (
    <div
      className={`wheel-container${state.mode === 'tack' ? ' wheel-container--tack' : ''}`}
      ref={wheelRef}
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
