import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { startPlayback, type PlaybackControl } from './playback';
import { playCrossingTick, playTackSound } from './audio';
import type { ElementType } from './types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

interface MockOscillator {
  id: number;
  type: string;
  frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
}

interface MockGain {
  gain: {
    setValueAtTime: ReturnType<typeof vi.fn>;
    linearRampToValueAtTime: ReturnType<typeof vi.fn>;
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  };
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

interface MockNoiseSource {
  buffer: unknown;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
}

let mockCurrentTime = 0;
let oscillatorIdCounter = 0;
const createdOscillators: MockOscillator[] = [];
const createdGains: MockGain[] = [];
const createdNoiseSources: MockNoiseSource[] = [];

function createMockCtx() {
  return {
    get currentTime() { return mockCurrentTime; },
    set currentTime(v: number) { mockCurrentTime = v; },
    state: 'running',
    sampleRate: 44100,
    destination: {},
    resume: vi.fn(),
    createBuffer: vi.fn(() => ({
      getChannelData: vi.fn(() => new Float32Array(1323)),
    })),
    createBufferSource: vi.fn((): MockNoiseSource => {
      const src: MockNoiseSource = {
        buffer: null,
        connect: vi.fn().mockReturnThis(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
        onended: null,
      };
      createdNoiseSources.push(src);
      return src;
    }),
    createOscillator: vi.fn((): MockOscillator => {
      const id = ++oscillatorIdCounter;
      const osc: MockOscillator = {
        id,
        type: '',
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn().mockReturnThis(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
        onended: null,
      };
      createdOscillators.push(osc);
      return osc;
    }),
    createGain: vi.fn((): MockGain => {
      const gain: MockGain = {
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn().mockReturnThis(),
        disconnect: vi.fn(),
      };
      createdGains.push(gain);
      return gain;
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('startPlayback updateSlots', () => {
  let mockCtx: ReturnType<typeof createMockCtx>;
  const originalRAF = globalThis.requestAnimationFrame;
  const originalCAF = globalThis.cancelAnimationFrame;

  beforeAll(() => {
    globalThis.requestAnimationFrame = vi.fn() as unknown as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = vi.fn() as unknown as typeof cancelAnimationFrame;
  });

  afterAll(() => {
    globalThis.requestAnimationFrame = originalRAF;
    globalThis.cancelAnimationFrame = originalCAF;
  });

  beforeEach(() => {
    mockCtx = createMockCtx();
    mockCurrentTime = 0;
    oscillatorIdCounter = 0;
    createdOscillators.length = 0;
    createdGains.length = 0;
    createdNoiseSources.length = 0;
    (globalThis as any).AudioContext = vi.fn(() => mockCtx);
  });

  afterEach(() => {
    delete (globalThis as any).AudioContext;
  });

  /**
   * Start playback and reset mock call counts so assertions only
   * reflect updateSlots calls, not the initial scheduling.
   */
  function startFresh(
    slotElements: (ElementType | null)[],
    queuedIndices: number[],
    bpm = 160,
  ): PlaybackControl {
    const slots: (ElementType | null)[] = Array(10).fill(null);
    slotElements.forEach((el, i) => { slots[i] = el; });

    const control = startPlayback(
      { queuedSlotIndices: queuedIndices, slots, bpm, direction: 'cw', loop: false, key: 'C', octave: 4 },
      vi.fn(),
      vi.fn(),
    );
    // Reset all mock call counts so only updateSlots actions are measured
    vi.clearAllMocks();
    return control;
  }

  it('cancels future oscillators when updating slots', () => {
    // Beat 0: slot 0 = earth, Beat 1: slot 3 = metal
    // With 4 iterations: 8 total beats scheduled (2 per iteration × 4)
    const control = startFresh(['earth', null, null, 'metal', null], [0, 3]);

    // currentBeat=1: beat 0 already played, beats 1-7 are future
    const newSlots: (ElementType | null)[] = Array(10).fill(null);
    newSlots[0] = 'earth'; // unchanged
    newSlots[3] = 'fire';  // changed

    control.updateSlots(newSlots, 1);

    // Beat 0 oscillator unchanged (element same → skipped)
    expect(createdOscillators[0].stop).not.toHaveBeenCalled();

    // Beat 1 oscillator stopped (first occurrence of position 1)
    expect(createdOscillators[1].stop).toHaveBeenCalled();

    // 4 new oscillators created for fire (beats 1,3,5,7 all at position 1)
    // 8 original + 4 new = 12 total
    expect(createdOscillators.length).toBe(12);
    expect(createdOscillators[8].frequency.setValueAtTime).toHaveBeenCalledWith(
      expect.closeTo(392, 1),
      expect.any(Number),
    );
  });


  it('re-schedules all beats when currentBeat is 0', () => {
    // With 4 iterations: 8 total beats scheduled
    const control = startFresh(['wood', null, null, 'water', null], [0, 3]);

    const newSlots: (ElementType | null)[] = Array(10).fill(null);
    newSlots[0] = 'fire';
    newSlots[3] = 'earth';

    control.updateSlots(newSlots, 0);

    // Both original oscillators stopped (first occurrence of each position)
    expect(createdOscillators[0].stop).toHaveBeenCalled();
    expect(createdOscillators[1].stop).toHaveBeenCalled();

    // All 8 beats updated: 8 stopped + 8 new = 16 total
    expect(createdOscillators.length).toBe(16);

    expect(createdOscillators[8].frequency.setValueAtTime).toHaveBeenCalledWith(
      expect.closeTo(392, 1),
      expect.any(Number),
    );
    // Second replacement: earth (C4 = 261.63) at position 1
    expect(createdOscillators[9].frequency.setValueAtTime).toHaveBeenCalledWith(
      expect.closeTo(261.63, 2),
      expect.any(Number),
    );
  });

  it('does not touch oscillators for already-played beats', () => {
    // Beat 0: slot 0 = earth, Beat 1: slot 1 = metal
    // With 4 iterations: 8 total beats scheduled
    const control = startFresh(['earth', 'metal', null, null, null], [0, 1]);

    const newSlots: (ElementType | null)[] = Array(10).fill(null);
    newSlots[0] = 'fire';  // changed
    newSlots[1] = 'earth'; // changed

    control.updateSlots(newSlots, 1);

    // Beat 0 oscillator NOT stopped (absBeat < currentBeat)
    expect(createdOscillators[0].stop).not.toHaveBeenCalled();

    // Beat 1 oscillator stopped and replaced
    expect(createdOscillators[1].stop).toHaveBeenCalled();
    // 7 beats updated (1-7), 7 stopped + 7 new = 15 total
    expect(createdOscillators.length).toBe(15);
  });


  it('is no-op when currentBeat equals or exceeds totalScheduledBeats', () => {
    const control = startFresh(['earth', 'metal', null, null, null], [0, 1]);
    const initialCount = createdOscillators.length;

    // currentBeat = 8 >= totalScheduledBeats = 8 → nothing to update
    const newSlots: (ElementType | null)[] = Array(10).fill(null);
    newSlots[0] = 'fire';
    control.updateSlots(newSlots, 8);

    expect(createdOscillators.length).toBe(initialCount);
    expect(createdOscillators[0].stop).not.toHaveBeenCalled();
    expect(createdOscillators[1].stop).not.toHaveBeenCalled();
  });


  it('skips re-schedule when element has not changed', () => {
    const control = startFresh(['earth', null, null, null, null], [0]);
    const initialCount = createdOscillators.length;

    // Same element at slot 0
    const sameSlots: (ElementType | null)[] = Array(10).fill(null);
    sameSlots[0] = 'earth';
    control.updateSlots(sameSlots, 0);

    expect(createdOscillators.length).toBe(initialCount);
    expect(createdOscillators[0].stop).not.toHaveBeenCalled();
  });

  it('handles clearing a slot to null during playback', () => {
    // Beat 0: slot 0 = earth, Beat 1: slot 1 = metal
    // With 4 iterations: 8 total beats scheduled
    const control = startFresh(['earth', 'metal', null, null, null], [0, 1]);

    // Clear slot 1 (metal → null), keep slot 0 (earth)
    const clearedSlots: (ElementType | null)[] = Array(10).fill(null);
    clearedSlots[0] = 'earth';

    control.updateSlots(clearedSlots, 1);

    // Beat 0 unchanged (absBeat < currentBeat)
    expect(createdOscillators[0].stop).not.toHaveBeenCalled();

    // Beat 1 oscillator stopped and NOT replaced (null)
    expect(createdOscillators[1].stop).toHaveBeenCalled();

    // 4 oscillators stopped (beats 1,3,5,7 at position 1), 0 new = 8 total
    expect(createdOscillators.length).toBe(8);
  });

  // Regression: 木 carries a 10ms noise "knock" on top of its oscillator.
  // Those bursts are pre-scheduled 4 iterations ahead, so removing the Stone
  // must cancel them too — otherwise the knock keeps sounding on empty Slots.
  it('stops the wood noise transient when its stone is removed mid-loop', () => {
    const control = startFresh(['wood', null, null, null, null], [0, 1]);
    const bursts = [...createdNoiseSources];
    expect(bursts.length).toBeGreaterThan(0);

    const clearedSlots: (ElementType | null)[] = Array(10).fill(null);
    control.updateSlots(clearedSlots, 0);

    for (const src of bursts) {
      // stop() with no argument = immediate cancellation of a future burst
      expect(src.stop.mock.calls.some((args) => args.length === 0)).toBe(true);
    }
  });

  it('stops the wood noise transient when playback is cancelled', () => {
    const control = startFresh(['wood', null, null, null, null], [0, 1]);
    const bursts = [...createdNoiseSources];
    expect(bursts.length).toBeGreaterThan(0);

    control.cancel();

    for (const src of bursts) {
      expect(src.stop.mock.calls.some((args) => args.length === 0)).toBe(true);
    }
  });

  it('cancels the wood knock when the stone is replaced by another element', () => {
    const control = startFresh(['wood', null, null, null, null], [0, 1]);
    const bursts = [...createdNoiseSources];
    expect(bursts.length).toBeGreaterThan(0);

    const replaced: (ElementType | null)[] = Array(10).fill(null);
    replaced[0] = 'earth';
    control.updateSlots(replaced, 0);

    for (const src of bursts) {
      expect(src.stop.mock.calls.some((args) => args.length === 0)).toBe(true);
    }
    // earth has no noise transient, so the replacement must not add a burst
    expect(createdNoiseSources.length).toBe(bursts.length);
  });
});

// One-shots are also AudioScheduledSourceNodes; their gain / filter nodes must
// be released when the burst ends, or every gesture leaves nodes on the master.
describe('audio one-shot node cleanup', () => {
  beforeEach(() => {
    mockCurrentTime = 0;
    createdOscillators.length = 0;
    createdGains.length = 0;
    createdNoiseSources.length = 0;
    (globalThis as any).AudioContext = vi.fn(() => createMockCtx());
  });

  afterEach(() => {
    delete (globalThis as any).AudioContext;
  });

  it('releases the crossing tick burst and its gain on end', () => {
    playCrossingTick(true);
    const src = createdNoiseSources[createdNoiseSources.length - 1];
    const gain = createdGains[createdGains.length - 1];
    expect(src?.onended).toBeTypeOf('function');
    src!.onended!();
    expect(src!.disconnect).toHaveBeenCalled();
    expect(gain!.disconnect).toHaveBeenCalled();
  });

  it('releases the tack noise burst and the blip oscillator on end', () => {
    playTackSound();
    const src = createdNoiseSources[createdNoiseSources.length - 1];
    const osc = createdOscillators[createdOscillators.length - 1];
    expect(src?.onended).toBeTypeOf('function');
    expect(osc?.onended).toBeTypeOf('function');
    src!.onended!();
    osc!.onended!();
    expect(src!.disconnect).toHaveBeenCalled();
    expect(osc!.disconnect).toHaveBeenCalled();
  });
});
