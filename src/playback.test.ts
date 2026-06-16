import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { startPlayback, type PlaybackControl } from './playback';
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

let mockCurrentTime = 0;
let oscillatorIdCounter = 0;
const createdOscillators: MockOscillator[] = [];
const createdGains: MockGain[] = [];

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
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn().mockReturnThis(),
      start: vi.fn(),
      stop: vi.fn(),
    })),
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
    bpm = 100,
  ): PlaybackControl {
    const slots: (ElementType | null)[] = Array(10).fill(null);
    slotElements.forEach((el, i) => { slots[i] = el; });

    const control = startPlayback(
      { queuedSlotIndices: queuedIndices, slots, bpm, direction: 'cw' },
      vi.fn(),
      vi.fn(),
    );
    // Reset all mock call counts so only updateSlots actions are measured
    vi.clearAllMocks();
    return control;
  }

  it('cancels future oscillators when updating slots', () => {
    // Beat 0: slot 0 = earth, Beat 1: slot 3 = metal
    const control = startFresh(['earth', null, null, 'metal', null], [0, 3]);

    // currentBeat=1: beat 0 already played, beat 1 is future
    const newSlots: (ElementType | null)[] = Array(10).fill(null);
    newSlots[0] = 'earth'; // unchanged
    newSlots[3] = 'fire';  // changed

    control.updateSlots(newSlots, 1);

    // Beat 0 oscillator unchanged (element same → skipped)
    expect(createdOscillators[0].stop).not.toHaveBeenCalled();

    // Beat 1 oscillator stopped
    expect(createdOscillators[1].stop).toHaveBeenCalled();

    // New oscillator created for fire (G4 = 392.00)
    expect(createdOscillators.length).toBe(3);
    expect(createdOscillators[2].frequency.setValueAtTime).toHaveBeenCalledWith(
      392.00,
      expect.any(Number),
    );
  });

  it('re-schedules all beats when currentBeat is 0', () => {
    const control = startFresh(['wood', null, null, 'water', null], [0, 3]);

    const newSlots: (ElementType | null)[] = Array(10).fill(null);
    newSlots[0] = 'fire';
    newSlots[3] = 'earth';

    control.updateSlots(newSlots, 0);

    // Both original oscillators stopped
    expect(createdOscillators[0].stop).toHaveBeenCalled();
    expect(createdOscillators[1].stop).toHaveBeenCalled();

    // Two new oscillators created
    expect(createdOscillators.length).toBe(4);

    // First replacement: fire (G4 = 392.00)
    expect(createdOscillators[2].frequency.setValueAtTime).toHaveBeenCalledWith(
      392.00,
      expect.any(Number),
    );
    // Second replacement: earth (C4 = 261.63)
    expect(createdOscillators[3].frequency.setValueAtTime).toHaveBeenCalledWith(
      261.63,
      expect.any(Number),
    );
  });

  it('does not touch oscillators for already-played beats', () => {
    // Beat 0: slot 0 = earth, Beat 1: slot 1 = metal
    const control = startFresh(['earth', 'metal', null, null, null], [0, 1]);

    const newSlots: (ElementType | null)[] = Array(10).fill(null);
    newSlots[0] = 'fire';  // changed, but already played
    newSlots[1] = 'earth'; // changed, future

    control.updateSlots(newSlots, 1);

    // Beat 0 oscillator NOT stopped (already played)
    expect(createdOscillators[0].stop).not.toHaveBeenCalled();

    // Beat 1 oscillator stopped and replaced
    expect(createdOscillators[1].stop).toHaveBeenCalled();
    expect(createdOscillators.length).toBe(3);
  });

  it('is no-op when currentBeat equals or exceeds beat count', () => {
    const control = startFresh(['earth', 'metal', null, null, null], [0, 1]);
    const initialCount = createdOscillators.length;

    // currentBeat = 2 >= count = 2 → nothing to update
    const newSlots: (ElementType | null)[] = Array(10).fill(null);
    newSlots[0] = 'fire';
    control.updateSlots(newSlots, 2);

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
    const control = startFresh(['earth', 'metal', null, null, null], [0, 1]);

    // Clear slot 1 (metal → null), keep slot 0 (earth)
    const clearedSlots: (ElementType | null)[] = Array(10).fill(null);
    clearedSlots[0] = 'earth';

    control.updateSlots(clearedSlots, 1);

    // Beat 0 unchanged (already played)
    expect(createdOscillators[0].stop).not.toHaveBeenCalled();

    // Beat 1 oscillator stopped and NOT replaced (null)
    expect(createdOscillators[1].stop).toHaveBeenCalled();

    // No new oscillators created (only the 2 originals)
    expect(createdOscillators.length).toBe(2);
  });
});
