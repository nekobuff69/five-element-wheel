import type { WheelState, WheelAction, ElementType } from './types';
import { ELEMENT_COLORS, ELEMENT_SYMBOLS } from './types';
import { SLOT_ANGLE_SPAN, SLOT_START_ANGLE } from './geometry';
import Slot from './Slot';
import Head from './Head';
import { useRef } from 'react';
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
const SLOT_SIZE = 36;
const WHEEL_RADIUS = 180;


function Wheel({ state, dispatch, snapTargetSlot }: WheelProps) {
  const headElement =
    state.currentSlotAtHead !== null
      ? state.slots[state.currentSlotAtHead]
      : null;
  // Playback order: encounter order (as stones passed the head)
  const playbackIndices = state.queuedSlotIndices;
  const wheelRef = useRef<HTMLDivElement>(null!);
  const { springBackPlayingIndex, playbackRef } = useWheelPlayback(state, dispatch);
  useWheelGesture(wheelRef, state.mode, (delta) => dispatch({ type: 'WIND', delta }), () => dispatch({ type: 'RELEASE' }));
  const {
    draggingFromSlotIndex,
    ghostElement: slotGhostElement,
    ghostPosition: slotGhostPosition,
    isFadingOut: slotGhostFading,
    snapTargetSlot: slotDragSnapTarget,
    handleSlotPointerDown,
  } = useSlotDrag(dispatch);


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
    // When playback is active, let the rAF onComplete handle the COMPLETE dispatch.
    // The CSS transition may finish before the audio clock has processed the final beat.
    if (playbackRef.current) return;
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
                transformOrigin: `center ${WHEEL_RADIUS - SLOT_TOP}px`,
              }}
            >
              <Slot
                index={i}
                element={state.slots[i]}
                isAtHead={state.currentSlotAtHead === i}
                counterRotation={counterRotation}
                onClick={() => {
                  if (state.slots[i] !== null && state.slots[i] === state.selectedStone) {
                    dispatch({ type: 'REMOVE_STONE', slotIndex: i });
                  } else {
                    dispatch({ type: 'PLACE_STONE', slotIndex: i });
                  }
                }}
                onPointerDown={state.slots[i] !== null ? (e) => handleSlotPointerDown(i, state.slots[i]!, e) : undefined}
                mode={state.mode}
                isPlayed={isPlayed}
                isCurrentlyPlaying={isCurrentlyPlaying}
                isSnapTarget={snapTargetSlot === i || slotDragSnapTarget === i}
                isDraggedAway={draggingFromSlotIndex === i}
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
      {slotGhostElement && (slotGhostPosition || slotGhostFading) && (
        <div
          className={`stone-ghost${slotGhostFading ? ' stone-ghost--fading' : ''}`}
          style={{
            left: (slotGhostPosition?.x ?? 0),
            top: (slotGhostPosition?.y ?? 0),
            backgroundColor: ELEMENT_COLORS[slotGhostElement],
          }}
        >
          {ELEMENT_SYMBOLS[slotGhostElement]}
        </div>
      )}
    </div>
  );
}

export default Wheel;
