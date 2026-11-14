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
 * `pendingSlots`, `washToken`) are exposed for the view layer (later tickets).
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
          // Snap haptics need the drag snap signal; reserved for a later ticket.
          break;
        case 'beat-read':
          // aria-live / wet-ink clearing belongs to a later ticket.
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
