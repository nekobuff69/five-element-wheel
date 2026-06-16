import { type ElementType, type WindDirection, ELEMENT_INTERVALS } from './types';

// Compute element frequencies in Hz for a given key and octave
// Preserves pentatonic intervals: root→M2→M3→P5→M6
const C4 = 261.63;
export function getElementFrequencies(key: string, octave: number): Record<ElementType, number> {
  const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const semitoneFromC = KEY_NAMES.indexOf(key);
  if (semitoneFromC < 0) {
    // Fallback to C if invalid key
    return getElementFrequencies('C', octave);
  }
  const rootFreq = C4 * 2 ** (semitoneFromC / 12 + (octave - 4));
  const result = {} as Record<ElementType, number>;
  for (const el of Object.keys(ELEMENT_INTERVALS) as ElementType[]) {
    result[el] = rootFreq * 2 ** (ELEMENT_INTERVALS[el] / 12);
  }
  return result;
}
let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

export function playTackSound(): void {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const now = ctx.currentTime;

  // 30ms noise burst
  const bufferSize = Math.ceil(ctx.sampleRate * 0.03);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / bufferSize);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.3, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

  noise.connect(noiseGain).connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.03);

  // 800Hz sine blip
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, now);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.2, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

  osc.connect(oscGain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.03);
}

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
interface OscillatorInfo {
  osc: OscillatorNode;
  gain: GainNode;
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

  // Schedule a single note at absolute beat index
  function scheduleNote(absoluteBeat: number, slotIndex: number, element: ElementType): void {
    const freq = freqMap[element];
    if (freq == null) return;

    const startTime = t0 + absoluteBeat * beatInterval;
    const endTime = startTime + noteDuration;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.4, startTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, endTime);

    osc.connect(gain).connect(ctx.destination);
    osc.start(startTime);
    osc.stop(endTime);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };

    // Ensure oscillators array is large enough
    while (oscillators.length <= absoluteBeat) {
      oscillators.push(null);
    }
    oscillators[absoluteBeat] = { osc, gain, slotIndex };
  }

  // Schedule one iteration starting at the given beat offset
  function scheduleIteration(startBeat: number): void {
    for (let i = 0; i < N; i++) {
      const slotIndex = indices[i];
      const element = slots[slotIndex];
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

  // rAF loop synced to AudioContext clock
  const pb: PlaybackState = {
    t0,
    beatInterval,
    indices,
    slots,
    count: N,
    rafId: null,
    completed: false,
    cancelled: false,
    currentBeat: -1,
    oscillators,
    loop,
    totalScheduledBeats: INITIAL_ITERATIONS * N,
  };

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

    // Report beat position within iteration for visual feedback
    if (currentBeat >= 0) {
      const positionInIteration = currentBeat % pb.count;
      const slotIdx = pb.indices[positionInIteration];
      if (pb.slots[slotIdx] !== null) {
        onBeat(positionInIteration);
      } else {
        onBeat(-1);
      }
    }

    pb.rafId = requestAnimationFrame(tick);
  };

  pb.rafId = requestAnimationFrame(tick);


  function updateSlots(newSlots: (ElementType | null)[], currentBeat: number): void {
    if (pb.cancelled || pb.completed) return;

    // Update all scheduled iterations from currentBeat onward
    for (let absBeat = currentBeat; absBeat < pb.totalScheduledBeats; absBeat++) {
      const positionInIteration = absBeat % pb.count;
      const slotIndex = pb.indices[positionInIteration];
      const oldElement = pb.slots[slotIndex];
      const newElement = newSlots[slotIndex];

      if (oldElement === newElement) continue;

      // Cancel existing oscillator for this beat
      const existing = pb.oscillators[absBeat];
      if (existing) {
        existing.osc.onended = null;
        try { existing.osc.stop(); } catch {}
        try { existing.osc.disconnect(); } catch {}
        try { existing.gain.disconnect(); } catch {}
      }

      if (!newElement) {
        pb.oscillators[absBeat] = null;
        continue;
      }

      const freq = freqMap[newElement];
      if (freq == null) {
        pb.oscillators[absBeat] = null;
        continue;
      }

      const noteDuration = pb.beatInterval * 0.6;
      const baseTime = pb.t0 + absBeat * pb.beatInterval;
      const startTime = Math.max(baseTime, ctx.currentTime + 0.01);
      const endTime = startTime + noteDuration;

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, pb.t0);
      gain.gain.linearRampToValueAtTime(0.4, startTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, endTime);

      osc.connect(gain).connect(ctx.destination);
      osc.start(startTime);
      osc.stop(endTime);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };

      pb.oscillators[absBeat] = { osc, gain, slotIndex };
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
        if (info) {
          info.osc.onended = null;
          try { info.osc.stop(); } catch {}
          try { info.osc.disconnect(); } catch {}
          try { info.gain.disconnect(); } catch {}
        }
      }
    },
    updateSlots,
    t0,
    beatInterval,
  };
}
