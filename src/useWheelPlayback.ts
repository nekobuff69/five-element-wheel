import { useEffect, useRef, useState } from 'react';
import type { WheelState, WheelAction } from './types';
import { playTackSound, startPlayback, type PlaybackControl, getAudioContext } from './playback';

export function useWheelPlayback(
  state: WheelState,
  dispatch: React.Dispatch<WheelAction>,
): {
  springBackPlayingIndex: number;
  playbackRef: React.MutableRefObject<PlaybackControl | null>;
} {
  const prevModeRef = useRef(state.mode);
  const playbackRef = useRef<PlaybackControl | null>(null);
  const [springBackPlayingIndex, setSpringBackPlayingIndex] = useState(-1);

  // Tack detection: rotation reaches 360° → dispatch TACK
  useEffect(() => {
    if (state.mode === 'winding' && Math.abs(state.rotation) >= 360) {
      dispatch({ type: 'TACK' });
    }
  }, [state.mode, state.rotation, dispatch]);

  // Tack sound: play when entering tack mode (not staying in it)
  useEffect(() => {
    if (state.mode === 'tack' && prevModeRef.current !== 'tack') {
      playTackSound();
    }
    prevModeRef.current = state.mode;
  }, [state.mode]);

  // Spring-back playback: start on springBack, cancel on cleanup
  useEffect(() => {
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
  useEffect(() => {
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
