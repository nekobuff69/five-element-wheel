import { describe, expect, it } from 'vitest';
import {
  FIRST_RUN_STORAGE_KEY,
  createGuideGate,
  initialGuideMode,
  shouldForceGuide,
} from './guideGate';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

describe('first-run guide gate', () => {
  it('opens on an unseen session', () => {
    const gate = createGuideGate(new MemoryStorage());
    expect(gate.isSeen()).toBe(false);
    expect(initialGuideMode(gate, '')).toBe('firstRun');
  });

  it('stays closed once the flag is written', () => {
    const storage = new MemoryStorage();
    createGuideGate(storage).markSeen();
    expect(initialGuideMode(createGuideGate(storage), '')).toBe('closed');
  });

  it('writes the versioned session key', () => {
    const storage = new MemoryStorage();
    createGuideGate(storage).markSeen();
    expect(storage.getItem(FIRST_RUN_STORAGE_KEY)).toBe('1');
  });

  it('only treats guide=1 as a forced gate', () => {
    expect(shouldForceGuide('?guide=1')).toBe(true);
    expect(shouldForceGuide('?guide=0')).toBe(false);
    expect(shouldForceGuide('?other=1')).toBe(false);
    expect(shouldForceGuide('')).toBe(false);
  });

  it('forces the gate without touching the seen flag', () => {
    const storage = new MemoryStorage();
    createGuideGate(storage).markSeen();
    expect(initialGuideMode(createGuideGate(storage), '?guide=1')).toBe(
      'firstRun',
    );
    expect(storage.getItem(FIRST_RUN_STORAGE_KEY)).toBe('1');
  });

  it('keeps the mark when later writes fail', () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    };
    const gate = createGuideGate(storage);
    expect(gate.isSeen()).toBe(false);
    expect(() => gate.markSeen()).not.toThrow();
    expect(gate.isSeen()).toBe(true);
  });

  it('falls back to memory when storage reads throw', () => {
    const storage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    const gate = createGuideGate(storage);
    expect(() => gate.isSeen()).not.toThrow();
    expect(gate.isSeen()).toBe(false);
    expect(() => gate.markSeen()).not.toThrow();
    expect(gate.isSeen()).toBe(true);
  });

  it('behaves as a session-scoped gate without storage', () => {
    const gate = createGuideGate(null);
    expect(gate.isSeen()).toBe(false);
    gate.markSeen();
    expect(gate.isSeen()).toBe(true);
    expect(createGuideGate(null).isSeen()).toBe(false);
  });
});
