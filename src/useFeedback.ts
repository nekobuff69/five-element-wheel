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
 * `WheelState` and previous playing index, derives events on every change, and
 * dispatches them to sound, arc flash and haptics — one source for the tack's
 * sound, light and touch. Visual tokens (`tackFlash`, `restartNote`,
 * `pendingSlots`, `washToken`) are consumed by the view layer: Wheel reads the
 * tack flash and PhraseTraceView reads the wash, wet-ink and restart tokens.
 * The snap-changed haptic is the one exception: snap is transient drag state,
 * emitted directly by the two drag hooks rather than derived from WheelState.
 */
export function useFeedback(state: WheelState, playingIndex: number): FeedbackView {
  const prevStateRef = useRef<WheelState | null>(null);
  const prevPlayingRef = useRef<number>(-1);

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
    });
    prevStateRef.current = state;
    prevPlayingRef.current = playingIndex;

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
          haptic('place');
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
          // Snap is transient drag state, not part of WheelState, so this
          // signal is emitted straight from the two drag hooks (which own the
          // snap-target refs) instead of through deriveFeedbackEvents. The
          // snap haptic is fired there; this branch stays intentionally empty.
          break;
        case 'beat-read':
          // A sounded beat gets a short haptic; rests stay silent. The view
          // layer owns the once-per-beat aria-live announcement, and the wet-ink
          // mark clears via played marks plus the loop-iteration pending reset.
          if (ev.hasStone) haptic('beat');
          break;
      }
    }
  }, [state, playingIndex]);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (noteTimer.current) clearTimeout(noteTimer.current);
    },
    [],
  );

  return { tackFlash, restartNote, pendingSlots, washToken };
}
