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


export function initAudio(): void {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  console.log('[initAudio] ctx.state=', ctx.state);
}


export function playTack(): void {
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

export function playSequence(
  queuedSlotIndices: number[],
  slots: (ElementType | null)[],
  bpm: number,
  direction: WindDirection,
  t0: number
): void {
  const ctx = getAudioContext();
  console.log('[playSequence] ctx.state=', ctx.state, 'queued=', queuedSlotIndices.length, 'bpm=', bpm);

  if (ctx.state === 'suspended') {
    console.log('[playSequence] resuming suspended AudioContext');
    ctx.resume();
  }

  const sorted = [...queuedSlotIndices].sort((a, b) =>
    direction === 'cw' ? a - b : b - a
  );

  const N = sorted.length;
  if (N === 0) return;

  const beatInterval = 60 / bpm;
  const noteDuration = beatInterval * 0.6;

  console.log('[playSequence] scheduling', N, 'notes, beatInterval=', beatInterval.toFixed(2), 's, t0=', t0.toFixed(2));

  sorted.forEach((slotIndex, i) => {
    const element = slots[slotIndex];
    if (!element) return;

    const freq = ELEMENT_TO_FREQ[element];
    if (freq == null) return;

    const startTime = t0 + i * beatInterval;
    const endTime = startTime + noteDuration;

    console.log('[playSequence] note', i, element, freq, 'Hz at t=', startTime.toFixed(2));

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
  });

  console.log('[playSequence] all notes scheduled');
}

export function stopAudio(): void {
  // Native Web Audio nodes are self-cleaning via onended handlers.
  // No-op: kept for API compatibility with callers.
}
