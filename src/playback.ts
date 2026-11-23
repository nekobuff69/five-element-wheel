import { type ElementType, type WindDirection } from './types';
import { getElementFrequencies } from './frequencies';
import { getAudioContext, playTackSound, createVoice, type Voice } from './audio';

// The single AudioContext, the tack sound, and the element voice factory all
// live in audio.ts (ADR-0006). Re-export them so existing imports of
// `./playback` keep working. Both note paths below share `createVoice()` so a
// Stone edited mid-loop keeps exactly the same timbre (Feedback 2).
export { getAudioContext, playTackSound };

interface PlaybackConfig {
  queuedSlotIndices: number[];
  slots: (ElementType | null)[];
  bpm: number;
  direction: WindDirection;
  loop: boolean;
  key: string;
  octave: number;
}

interface PlaybackState {
  t0: number;
  beatInterval: number;
  indices: number[];
  slots: (ElementType | null)[];
  count: number;
  rafId: number | null;
  completed: boolean;
  cancelled: boolean;
  currentBeat: number;
  oscillators: (OscillatorInfo | null)[];
  loop: boolean;
  totalScheduledBeats: number;
}
/** Every node a Voice owns, so cancellation never leaves a pre-scheduled sound. */
interface OscillatorInfo extends Voice {
  slotIndex: number;
}

export interface PlaybackControl {
  cancel: () => void;
  updateSlots: (newSlots: (ElementType | null)[], currentBeat: number) => void;
  t0: number;
  beatInterval: number;
}

export function startPlayback(
  config: PlaybackConfig,
  onBeat: (queueIndex: number) => void,
  onComplete: () => void
): PlaybackControl {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const { queuedSlotIndices, slots, bpm, direction, loop, key, octave } = config;
  const indices = queuedSlotIndices;
  const N = indices.length;
  if (N === 0) {
    onComplete();
    return { cancel: () => {}, updateSlots: () => {}, t0: 0, beatInterval: 0 };
  }

  const beatInterval = 60 / bpm;
  const noteDuration = beatInterval * 0.6;
  const t0 = ctx.currentTime + 0.05; // 50ms lookahead

  const freqMap = getElementFrequencies(key, octave);
  const oscillators: (OscillatorInfo | null)[] = [];

  // Schedule a single note at absolute beat index. All sound shaping lives in
  // audio.ts's createVoice(); the initial schedule and hot reload share it, so
  // a Stone edited mid-loop keeps exactly the same timbre.
  function scheduleNote(absoluteBeat: number, slotIndex: number, element: ElementType): void {
    const freq = freqMap[element];
    if (freq == null) return;

    const startTime = t0 + absoluteBeat * beatInterval;
    const voice = createVoice(ctx, element, freq, startTime, noteDuration);

    // Ensure oscillators array is large enough
    while (oscillators.length <= absoluteBeat) {
      oscillators.push(null);
    }
    oscillators[absoluteBeat] = { ...voice, slotIndex };
  }

  // Playback state — initialized before scheduling so scheduleIteration reads pb.slots
  const pb: PlaybackState = {
    t0,
    beatInterval,
    indices,
    slots: [...slots],
    count: N,
    rafId: null,
    completed: false,
    cancelled: false,
    currentBeat: -1,
    oscillators,
    loop,
    totalScheduledBeats: 0,
  };

  // Schedule one iteration starting at the given beat offset
  function scheduleIteration(startBeat: number): void {
    for (let i = 0; i < N; i++) {
      const slotIndex = indices[i];
      const element = pb.slots[slotIndex];
      if (element) {
        scheduleNote(startBeat + i, slotIndex, element);
      }
    }
  }

  // Schedule initial iterations (4 loops worth)
  const INITIAL_ITERATIONS = 4;
  for (let iter = 0; iter < INITIAL_ITERATIONS; iter++) {
    scheduleIteration(iter * N);
  }
  pb.totalScheduledBeats = INITIAL_ITERATIONS * N;


  const tick = () => {
    if (pb.cancelled || pb.completed) return;

    const elapsed = ctx.currentTime - pb.t0;
    const currentBeat = Math.floor(elapsed / pb.beatInterval);
    pb.currentBeat = currentBeat;

    // Extend scheduling if approaching the end (keep at least 1 iteration ahead)
    if (pb.loop && currentBeat >= pb.totalScheduledBeats - pb.count) {
      scheduleIteration(pb.totalScheduledBeats);
      pb.totalScheduledBeats += pb.count;
    }

    // Completion logic: only complete when not looping, after first iteration
    if (!pb.loop && currentBeat >= pb.count) {
      pb.completed = true;
      pb.rafId = null;
      onComplete();
      return;
    }

    // Report the beat position on every beat, including rests, so a Slot can
    // show that it is being read even when it holds no Stone.
    if (currentBeat >= 0) {
      onBeat(currentBeat % pb.count);
    }

    pb.rafId = requestAnimationFrame(tick);
  };

  pb.rafId = requestAnimationFrame(tick);


  /**
   * Stop every node a Voice owns. 木's knock is an AudioBufferSourceNode
   * pre-scheduled up to 4 iterations ahead, so leaving it out lets the knock
   * sound on a future beat even after its Stone has been removed. stop() with
   * no argument cancels a burst that has not fired yet.
   */
  function cancelVoice(info: OscillatorInfo | null): void {
    if (!info) return;
    info.osc.onended = null;
    try { info.osc.stop(); } catch {}
    try { info.osc.disconnect(); } catch {}
    try { info.gain.disconnect(); } catch {}
    if (info.filter) { try { info.filter.disconnect(); } catch {} }
    if (info.noise) {
      info.noise.source.onended = null;
      try { info.noise.source.stop(); } catch {}
      try { info.noise.source.disconnect(); } catch {}
      try { info.noise.gain.disconnect(); } catch {}
    }
  }

  function updateSlots(newSlots: (ElementType | null)[], currentBeat: number): void {
    if (pb.cancelled || pb.completed) return;

    // Update all scheduled iterations from currentBeat onward
    for (let absBeat = currentBeat; absBeat < pb.totalScheduledBeats; absBeat++) {
      const positionInIteration = absBeat % pb.count;
      const slotIndex = pb.indices[positionInIteration];
      const oldElement = pb.slots[slotIndex];
      const newElement = newSlots[slotIndex];

      if (oldElement === newElement) continue;

      // Cancel every node of the existing voice, including 木's knock
      cancelVoice(pb.oscillators[absBeat]);

      if (!newElement) {
        pb.oscillators[absBeat] = null;
        continue;
      }

      const freq = freqMap[newElement];
      if (freq == null) {
        pb.oscillators[absBeat] = null;
        continue;
      }

      // Hot reload re-schedules through the SAME voice factory as scheduleNote,
      // so the edited Stone keeps its timbre on every future iteration.
      const noteDuration = pb.beatInterval * 0.6;
      const baseTime = pb.t0 + absBeat * pb.beatInterval;
      const startTime = Math.max(baseTime, ctx.currentTime + 0.01);
      const voice = createVoice(ctx, newElement, freq, startTime, noteDuration);
      pb.oscillators[absBeat] = { ...voice, slotIndex };
    }

    pb.slots = [...newSlots];
  }


  return {
    cancel: () => {
      pb.cancelled = true;
      if (pb.rafId !== null) {
        cancelAnimationFrame(pb.rafId);
        pb.rafId = null;
      }
      for (const info of pb.oscillators) {
        cancelVoice(info);
      }
    },
    updateSlots,
    t0,
    beatInterval,
  };
}
