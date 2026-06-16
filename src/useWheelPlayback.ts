import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { WheelState, WheelAction } from './types';
import { playTackSound, startPlayback, type PlaybackControl, getAudioContext } from './playback';

export function useWheelPlayback(
  state: WheelState,
  dispatch: React.Dispatch<WheelAction>,
): {
  springBackPlayingIndex: number;
  playbackRef: React.MutableRefObject<PlaybackControl | null>;
} {
  const prevRotationRef = useRef(state.rotation);
  const tackPlayedRef = useRef(false);
  const playbackRef = useRef<PlaybackControl | null>(null);
  const [springBackPlayingIndex, setSpringBackPlayingIndex] = useState(-1);

  // Tack detection: rotation crosses 360° threshold during winding → play sound
  useEffect(() => {
    if (state.mode === 'winding') {
      const absRotation = Math.abs(state.rotation);
      const prevAbsRotation = Math.abs(prevRotationRef.current);
      // Crossed 360° threshold (going up)
      if (absRotation >= 360 && prevAbsRotation < 360) {
        if (!tackPlayedRef.current) {
          playTackSound();
          tackPlayedRef.current = true;
        }
      }
      // Reset when rotation drops below 360° (user released early or direction changed)
      if (absRotation < 360) {
        tackPlayedRef.current = false;
      }
    } else {
      // Reset tack flag when not winding
      tackPlayedRef.current = false;
    }
    prevRotationRef.current = state.rotation;
  }, [state.mode, state.rotation]);

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
