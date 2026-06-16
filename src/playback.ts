import { type ElementType, type WindDirection } from './types';

// Map element types to frequencies in Hz (C pentatonic: C4 D4 E4 G4 A4)
const ELEMENT_TO_FREQ: Record<ElementType, number> = {
  earth: 261.63,  // C4
  metal: 293.66,  // D4
  wood:  329.63,  // E4
  fire:  392.00,  // G4
  water: 440.00,  // A4
};

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

  const { queuedSlotIndices, slots, bpm, direction } = config;
  const indices = queuedSlotIndices;
  const N = indices.length;
  if (N === 0) {
    onComplete();
    return { cancel: () => {}, updateSlots: () => {}, t0: 0, beatInterval: 0 };
  }

  const beatInterval = 60 / bpm;
  const noteDuration = beatInterval * 0.6;
  const t0 = ctx.currentTime + 0.05; // 50ms lookahead

  const oscillators: (OscillatorInfo | null)[] = new Array(N).fill(null);
  // Schedule audio notes
  indices.forEach((slotIndex, i) => {
    const element = slots[slotIndex];
    if (!element) return;

    const freq = ELEMENT_TO_FREQ[element];
    if (freq == null) return;

    const startTime = t0 + i * beatInterval;
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
    oscillators[i] = { osc, gain, slotIndex };
  });

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
  };

  const tick = () => {
    if (pb.cancelled || pb.completed) return;

    const elapsed = ctx.currentTime - pb.t0;
    const currentBeat = Math.floor(elapsed / pb.beatInterval);
    pb.currentBeat = currentBeat;

    const totalDuration = pb.count * pb.beatInterval;
    if (elapsed >= totalDuration + pb.beatInterval * 0.5) {
      pb.completed = true;
      pb.rafId = null;
      onComplete();
      return;
    }

    if (currentBeat >= 0 && currentBeat < pb.indices.length) {
      const slotIdx = pb.indices[currentBeat];
      if (pb.slots[slotIdx] !== null) {
        onBeat(currentBeat);
      } else {
        onBeat(-1);
      }
    }

    pb.rafId = requestAnimationFrame(tick);
  };

  pb.rafId = requestAnimationFrame(tick);

  function updateSlots(newSlots: (ElementType | null)[], currentBeat: number): void {
    if (pb.cancelled || pb.completed) return;

    const startIdx = Math.max(0, Math.min(currentBeat, pb.count));

    for (let i = startIdx; i < pb.count; i++) {
      const slotIndex = pb.indices[i];
      const oldElement = pb.slots[slotIndex];
      const newElement = newSlots[slotIndex];

      if (oldElement === newElement) continue;

      // Cancel existing oscillator for this beat
      const existing = pb.oscillators[i];
      if (existing) {
        existing.osc.onended = null;
        try { existing.osc.stop(); } catch {}
        try { existing.osc.disconnect(); } catch {}
        try { existing.gain.disconnect(); } catch {}
      }

      if (!newElement) {
        pb.oscillators[i] = null;
        continue;
      }

      const freq = ELEMENT_TO_FREQ[newElement];
      if (freq == null) {
        pb.oscillators[i] = null;
        continue;
      }

      const noteDuration = pb.beatInterval * 0.6;
      const baseTime = pb.t0 + i * pb.beatInterval;
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

      pb.oscillators[i] = { osc, gain, slotIndex };
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
