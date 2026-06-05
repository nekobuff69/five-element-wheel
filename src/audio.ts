import * as Tone from 'tone';
import { ELEMENT_TO_NOTE, type ElementType, type WindDirection } from './types';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

let pluckSynth: Tone.PluckSynth | null = null;
let toneStarted = false;

function ensureToneStarted(): void {
  if (!toneStarted) {
    Tone.start();
    toneStarted = true;
  }
}

function getSynth(): Tone.PluckSynth {
  if (!pluckSynth) {
    pluckSynth = new Tone.PluckSynth({
      attackNoise: 0.1,
      dampening: 4000,
      resonance: 0.7,
    }).toDestination();
  }
  return pluckSynth;
}


export function initAudio(): void {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  ensureToneStarted();
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
  direction: WindDirection
): void {
  ensureToneStarted();
  const synth = getSynth();

  // Sort based on direction: CW=forward(ascending), CCW=reverse(descending)
  const sorted = [...queuedSlotIndices].sort((a, b) =>
    direction === 'cw' ? a - b : b - a
  );

  const N = sorted.length;
  if (N === 0) return;

  const T = N * (60 / bpm);

  // Cancel any previous scheduled events and reset
  Tone.Transport.cancel();
  Tone.Transport.position = 0;

  sorted.forEach((slotIndex, i) => {
    const element = slots[slotIndex];
    if (element) {
      const note = ELEMENT_TO_NOTE[element];
      const time = i * (T / N);
      Tone.Transport.schedule((triggerTime) => {
        synth.triggerAttackRelease(note, '8n', triggerTime);
      }, time);
    }
    // Empty slots: no note — just a rest at this beat position
  });

  // Schedule transport stop at end
  Tone.Transport.schedule(() => {
    Tone.Transport.stop();
  }, T);

  // Start playback
  Tone.Transport.start();
}

export function stopAudio(): void {
  Tone.Transport.cancel();
  Tone.Transport.stop();
}
