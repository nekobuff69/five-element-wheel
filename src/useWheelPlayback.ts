import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { WheelState, WheelAction } from './types';
import { startPlayback, type PlaybackControl, getAudioContext } from './playback';

export function useWheelPlayback(
  state: WheelState,
  dispatch: React.Dispatch<WheelAction>,
): {
  springBackPlayingIndex: number;
  playbackRef: React.MutableRefObject<PlaybackControl | null>;
} {
  const playbackRef = useRef<PlaybackControl | null>(null);
  const [springBackPlayingIndex, setSpringBackPlayingIndex] = useState(-1);

  // Spring-back playback: start on springBack, cancel on cleanup
  useEffect(() => {
    // Every fresh playback (a new phrase, a loop interrupt, or a parameter
    // restart that re-runs this effect) must start from an unread position.
    // Otherwise the drop from the previous phrase's last beat to 0 would be
    // derived as a spurious loop-iteration / wash by useFeedback.
    setSpringBackPlayingIndex(-1);
    if (state.mode !== 'springBack') return;
    const count = state.queuedSlotIndices.length;
    if (count === 0 || !state.direction) {
      dispatch({ type: 'COMPLETE' });
      return;
    }
    const control = startPlayback(
      {
        queuedSlotIndices: state.queuedSlotIndices,
        slots: state.slots,
        bpm: state.bpm,
        direction: state.direction,
        loop: state.loop,
        key: state.key,
        octave: state.octave,
      },
      (idx) => setSpringBackPlayingIndex(idx),
      () => dispatch({ type: 'COMPLETE' }),
    );
    playbackRef.current = control;
    return () => {
      control.cancel();
      playbackRef.current = null;
    };
  }, [
    state.mode,
    state.queuedSlotIndices,
    state.bpm,
    state.direction,
    state.loop,
    state.key,
    state.octave,
    dispatch,
  ]);

  // Hot-reload: update scheduled oscillators when slots change mid-playback
  useLayoutEffect(() => {
    if (state.mode !== 'springBack') return;
    if (!playbackRef.current) return;

    const control = playbackRef.current;
    const ctx = getAudioContext();
    const elapsed = ctx.currentTime - control.t0;
    const currentBeat = Math.floor(elapsed / control.beatInterval);

    control.updateSlots(state.slots, currentBeat);
  }, [state.mode, state.slots]);

  return { springBackPlayingIndex, playbackRef };
}
