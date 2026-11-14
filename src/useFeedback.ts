import { useEffect, useRef, useState } from 'react';
import type { WheelState } from './types';
import { deriveFeedbackEvents } from './feedbackEvents';
import {
  playCrossingTick,
  playPlacementSound,
  playTackSound,
  haptic,
} from './audio';

export interface FeedbackView {
  tackFlash: boolean;
  restartNote: string | null;
  pendingSlots: number[];
  washToken: number;
}

const TACK_FLASH_MS = 120;
const RESTART_NOTE_MS = 1200;

/**
 * The single consumer of the derived feedback stream. It holds the previous
 * `WheelState`, previous playing index and previous snap target, derives events
 * on every change, and dispatches them to sound, arc flash and haptics — one
 * source for the tack's sound, light and touch. Visual tokens (`tackFlash`,
 * `restartNote`, `pendingSlots`, `washToken`) are consumed by the view layer:
 * Wheel reads the tack flash and PhraseTraceView reads the wash, wet-ink and
 * restart tokens. The snap target is pointer-local state supplied by the two
 * drag hooks as an explicit signal; its snap-changed event is derived from
 * that signal and the snap haptic fires here, like every other output channel.
 */
export function useFeedback(
  state: WheelState,
  playingIndex: number,
  snapTarget: number | null,
): FeedbackView {
  const prevStateRef = useRef<WheelState | null>(null);
  const prevPlayingRef = useRef<number>(-1);
  const prevSnapRef = useRef<number | null>(null);

  const [tackFlash, setTackFlash] = useState(false);
  const [restartNote, setRestartNote] = useState<string | null>(null);
  const [pendingSlots, setPendingSlots] = useState<number[]>([]);
  const [washToken, setWashToken] = useState(0);

  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const events = deriveFeedbackEvents(prevStateRef.current, state, {
      playingIndex,
      previousPlayingIndex: prevPlayingRef.current,
      snapTarget,
      previousSnapTarget: prevSnapRef.current,
    });
    prevStateRef.current = state;
    prevPlayingRef.current = playingIndex;
    prevSnapRef.current = snapTarget;

    for (const ev of events) {
      switch (ev.type) {
        case 'slot-crossed':
          playCrossingTick(ev.hasStone);
          haptic('cross');
          break;
        case 'tack':
          // Sound, arc flash and haptic all fire from this one event.
          playTackSound();
          haptic('tack');
          setTackFlash(true);
          if (flashTimer.current) clearTimeout(flashTimer.current);
          flashTimer.current = setTimeout(() => setTackFlash(false), TACK_FLASH_MS);
          break;
        case 'stone-placed':
          playPlacementSound('place');
          break;
        case 'stone-removed':
          playPlacementSound('remove');
          break;
        case 'loop-iteration':
          setWashToken((t) => t + 1);
          setPendingSlots([]);
          break;
        case 'parameter-restart':
          setRestartNote(ev.label);
          if (noteTimer.current) clearTimeout(noteTimer.current);
          noteTimer.current = setTimeout(() => setRestartNote(null), RESTART_NOTE_MS);
          break;
        case 'hot-reload-pending':
          setPendingSlots((prev) =>
            prev.includes(ev.slotIndex) ? prev : [...prev, ev.slotIndex],
          );
          break;
        case 'snap-changed':
          haptic('snap');
          break;
        case 'beat-read': {
          // The beat that just sounded is no longer wet ink: clear its pending
          // mark so the chart returns to a clean written line. The view layer
          // owns the once-per-beat aria-live announcement; rests stay silent.
          const slotIndex = state.queuedSlotIndices[ev.queueIndex];
          setPendingSlots((prev) =>
            slotIndex === undefined ? prev : prev.filter((s) => s !== slotIndex),
          );
          break;
        }
      }
    }
  }, [state, playingIndex, snapTarget]);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (noteTimer.current) clearTimeout(noteTimer.current);
    },
    [],
  );

  return { tackFlash, restartNote, pendingSlots, washToken };
}
