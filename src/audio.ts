/**
 * The instrument's single native AudioContext (ADR-0006) and its one master
 * gain. Every one-shot feedback sound is routed through that master node so
 * the whole instrument has one consistent level. Note scheduling in
 * `playback.ts` shares this same context via `getAudioContext()`.
 *
 * The `t0` lookahead clock and rAF beat reporting are deliberately untouched.
 */

import type { ElementType } from './types';

type ContextCtor = new () => AudioContext;

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;

function getContextCtor(): ContextCtor | undefined {
  const g = globalThis as unknown as {
    AudioContext?: ContextCtor;
    webkitAudioContext?: ContextCtor;
  };
  return g.AudioContext ?? g.webkitAudioContext;
}

/**
 * Return the one AudioContext, creating it (and its master gain) on first use.
 * Throws when Web Audio is unavailable; callers that must be crash-safe use
 * `tryGetAudioContext()` instead.
 */
export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const Ctor = getContextCtor();
    if (!Ctor) throw new Error('Web Audio is not available');
    audioCtx = new Ctor();
    // A missing createGain (partial Web Audio) simply degrades to a direct
    // connection to destination; the instrument stays playable.
    try {
      const master = audioCtx.createGain();
      master.gain.value = 0.9;
      master.connect(audioCtx.destination);
      masterGain = master;
    } catch {
      masterGain = null;
    }
  }
  return audioCtx;
}

/** Null-safe variant: never throws when Web Audio is missing. */
function tryGetAudioContext(): AudioContext | null {
  try {
    if (!getContextCtor()) return null;
    return getAudioContext();
  } catch {
    return null;
  }
}

/** The node all one-shot sounds connect to (master gain, or destination). */
function getAudioOutput(): AudioNode | null {
  const nodes = audioNodes();
  return nodes ? nodes.out : null;
}

function audioNodes(): { ctx: AudioContext; out: AudioNode } | null {
  const ctx = tryGetAudioContext();
  if (!ctx) return null;
  return { ctx, out: masterGain ?? ctx.destination };
}

// ---------------------------------------------------------------------------
// Element voices (Feedback 2: five material timbres)
// ---------------------------------------------------------------------------

/**
 * One timbre per element. All are a single oscillator + one gain envelope
 * (plus an optional low-pass), with the SAME peak gain so swapping a Stone
 * never jumps in loudness. `decayFactor` scales the tail against the beat
 * duration; the 金 upper partial is added on the same oscillator, never a 2nd.
 */
interface Timbre {
  wave: OscillatorType;
  attack: number;           // seconds — hard attack
  decayFactor: number;      // × noteDuration
  filterStart: number;      // Hz, low-pass cutoff
  filterEnd: number | null; // Hz, optional downward sweep target
  harmonic: number | null;  // 2nd-harmonic amplitude for 金, else null
  noiseTransient?: boolean; // 木: a very short noise burst at the note onset
}

const TIMBRES: Record<ElementType, Timbre> = {
  earth: { wave: 'triangle',  attack: 0.008, decayFactor: 0.75, filterStart: 2000, filterEnd: null, harmonic: null },
  metal: { wave: 'triangle',  attack: 0.002, decayFactor: 1.0,  filterStart: 4200, filterEnd: null, harmonic: 0.32 },
  wood:  { wave: 'sawtooth',  attack: 0.003, decayFactor: 0.35, filterStart: 1500, filterEnd: null, harmonic: null, noiseTransient: true },
  fire:  { wave: 'sawtooth',  attack: 0.003, decayFactor: 0.5,  filterStart: 1200, filterEnd: null, harmonic: null },
  water: { wave: 'sine',      attack: 0.015, decayFactor: 1.0,  filterStart: 900,  filterEnd: 500,  harmonic: null },
};

const VOICE_PEAK = 0.38;

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
  filter: BiquadFilterNode | null;
}

/**
 * The single source of a sounded Stone. Both the initial schedule and the
 * hot-reload re-schedule in `playback.ts` call this factory, so a Stone edited
 * mid-loop keeps exactly the same timbre. Key/octave transposition is applied
 * by the caller via `getElementFrequencies()`; this function only shapes sound.
 *
 * Every optional Web Audio feature is feature-detected: a partial
 * implementation (or the playback test's minimal mock, which has no
 * createBiquadFilter / createPeriodicWave / setPeriodicWave) degrades to a
 * plain oscillator voice rather than throwing, and each note creates exactly
 * ONE oscillator (the 金 partial reuses it). Rests never reach this function.
 */
export function createVoice(
  ctx: AudioContext,
  element: ElementType,
  freq: number,
  startTime: number,
  noteDuration: number,
): Voice {
  const timbre = TIMBRES[element] ?? TIMBRES.earth;
  const out = getAudioOutput() ?? ctx.destination;

  const osc = ctx.createOscillator();
  osc.type = timbre.wave;
  osc.frequency.setValueAtTime(freq, startTime);

  // 金: a quiet 2nd harmonic on the SAME oscillator via setPeriodicWave.
  // Feature-detected so the mock / partial Web Audio keeps the plain triangle.
  if (timbre.harmonic !== null) {
    try {
      if (
        typeof ctx.createPeriodicWave === 'function' &&
        typeof osc.setPeriodicWave === 'function'
      ) {
        const imag = [0, 1, timbre.harmonic]; // DC, fundamental, 2nd partial
        const real = [0, 0, 0];
        osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
      }
    } catch {
      /* partial Web Audio — keep the triangle set above */
    }
  }

  const attackEnd = startTime + timbre.attack;
  const decayEnd = startTime + noteDuration * timbre.decayFactor;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(VOICE_PEAK, attackEnd);
  gain.gain.exponentialRampToValueAtTime(0.001, decayEnd);

  // Optional low-pass (gentle downward sweep for 木 / 水). Feature-detected
  // and try/caught so a partial implementation degrades to an unfiltered voice.
  let filter: BiquadFilterNode | null = null;
  try {
    if (typeof ctx.createBiquadFilter === 'function') {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(timbre.filterStart, startTime);
      if (timbre.filterEnd !== null) {
        f.frequency.exponentialRampToValueAtTime(timbre.filterEnd, decayEnd);
      }
      filter = f;
    }
  } catch {
    filter = null;
  }

  osc.connect(gain);
  if (filter) {
    gain.connect(filter);
    filter.connect(out);
  } else {
    gain.connect(out);
  }

  osc.start(startTime);
  osc.stop(decayEnd + 0.02); // small tail so the decay ramp completes cleanly

  // 木: a ~10ms noise transient at the onset, built from a buffer source —
  // never a second oscillator, so playback.test.ts's exact oscillator count
  // is preserved. makeNoise() feature-detects createBuffer/createBufferSource
  // and returns null when absent; everything else is fully guarded so a
  // partial Web Audio implementation or the minimal test mock degrades to the
  // plain oscillator voice.
  if (timbre.noiseTransient) {
    try {
      const src = makeNoise(ctx, 0.01);
      if (src && typeof ctx.createGain === 'function') {
        const transientGain = ctx.createGain();
        transientGain.gain.setValueAtTime(0.0001, startTime);
        transientGain.gain.linearRampToValueAtTime(VOICE_PEAK * 0.5, startTime + 0.001);
        transientGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.01);
        src.connect(transientGain);
        transientGain.connect(out);
        src.start(startTime);
        src.stop(startTime + 0.01);
      }
    } catch {
      /* partial Web Audio / minimal mock — keep the plain voice */
    }
  }

  osc.onended = () => {
    try { osc.disconnect(); } catch { /* already disconnected */ }
    try { gain.disconnect(); } catch { /* already disconnected */ }
    if (filter) {
      try { filter.disconnect(); } catch { /* already disconnected */ }
    }
  };

  return { osc, gain, filter };
}

/** Unlock/resume audio inside the first pointer-down gesture (mobile Chrome). */
export function unlockAudio(): void {
  const ctx = tryGetAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    try {
      void ctx.resume();
    } catch {
      /* ignore — sound/visual channels still carry the feedback */
    }
  }
}

/**
 * A very short, filtered noise burst. Feature-detects createBiquadFilter so a
 * partial Web Audio implementation (or the playback test's minimal mock)
 * degrades to an unfiltered tick rather than throwing.
 */
function makeNoise(ctx: AudioContext, duration: number): AudioBufferSourceNode | null {
  if (
    typeof ctx.createBuffer !== 'function' ||
    typeof ctx.createBufferSource !== 'function'
  ) {
    return null;
  }
  const size = Math.max(1, Math.ceil(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / data.length);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  return src;
}

function envelope(ctx: AudioContext, peak: number, duration: number): GainNode | null {
  if (typeof ctx.createGain !== 'function') return null;
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(peak, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  return gain;
}

function blip(ctx: AudioContext, out: AudioNode, freq: number, peak: number, duration: number, type: OscillatorType): void {
  if (typeof ctx.createOscillator !== 'function') return;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  const gain = envelope(ctx, peak, duration);
  if (!gain) return;
  osc.connect(gain);
  gain.connect(out);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

/** One light carving tick per crossed Slot. Filled is brighter than a rest. */
export function playCrossingTick(hasStone: boolean): void {
  try {
    const nodes = audioNodes();
    if (!nodes) return;
    const { ctx, out } = nodes;
    const duration = hasStone ? 0.018 : 0.012; // 12–18ms
    const src = makeNoise(ctx, duration);
    const gain = envelope(ctx, hasStone ? 0.09 : 0.06, duration);
    if (!src || !gain) return;

    if (typeof ctx.createBiquadFilter === 'function') {
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(hasStone ? 1800 : 700, ctx.currentTime);
      src.connect(filter);
      filter.connect(gain);
    } else {
      src.connect(gain);
    }
    gain.connect(out);
    src.start(ctx.currentTime);
    src.stop(ctx.currentTime + duration);
  } catch {
    /* Web Audio unavailable / partial — degrade silently */
  }
}

/** A short stone-landing (or duller, shorter removal) transient + low blip. */
export function playPlacementSound(kind: 'place' | 'remove'): void {
  try {
    const nodes = audioNodes();
    if (!nodes) return;
    const { ctx, out } = nodes;
    const duration = kind === 'place' ? 0.016 : 0.01;
    const src = makeNoise(ctx, duration);
    const gain = envelope(ctx, kind === 'place' ? 0.08 : 0.05, duration);
    if (src && gain) {
      src.connect(gain);
      gain.connect(out);
      src.start(ctx.currentTime);
      src.stop(ctx.currentTime + duration);
    }
    blip(ctx, out, 180, kind === 'place' ? 0.06 : 0.035, duration, kind === 'place' ? 'sine' : 'triangle');
  } catch {
    /* degrade silently */
  }
}

/**
 * The 360° tack: 30ms noise burst + 800Hz blip, deliberately heavier than a
 * crossing tick, now routed through the single master gain.
 */
export function playTackSound(): void {
  try {
    const nodes = audioNodes();
    if (!nodes) return;
    const { ctx, out } = nodes;
    const now = ctx.currentTime;
    const duration = 0.03;

    const src = makeNoise(ctx, duration);
    const noiseGain = envelope(ctx, 0.3, duration);
    if (src && noiseGain) {
      src.connect(noiseGain);
      noiseGain.connect(out);
      src.start(now);
      src.stop(now + duration);
    }
    blip(ctx, out, 800, 0.2, duration, 'sine');
  } catch {
    /* degrade silently */
  }
}

type HapticKind = 'cross' | 'tack' | 'snap';

const HAPTIC_MS: Record<HapticKind, number> = {
  cross: 8,
  tack: 20,
  snap: 5,
};

/** Third feedback channel; a no-op where navigator.vibrate is unavailable. */
export function haptic(kind: HapticKind): void {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    navigator.vibrate(HAPTIC_MS[kind]);
  } catch {
    /* ignore — sound and visuals always carry the same information */
  }
}
