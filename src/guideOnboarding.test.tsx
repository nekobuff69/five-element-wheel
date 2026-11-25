import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { FIRST_RUN_STORAGE_KEY } from './guideGate';

const START_LABEL = '試一試';

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('first-run guide gate', () => {
  it('opens automatically and offers 試一試', () => {
    render(<App />);
    expect(screen.getByRole('dialog', { name: '玩法' })).toBeTruthy();
    expect(screen.getByRole('button', { name: START_LABEL })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '关闭' })).toBeNull();
  });

  it('ignores backdrop clicks and Escape, then dismisses on 試一試', () => {
    render(<App />);
    fireEvent.click(document.querySelector('.guide-overlay')!);
    fireEvent.keyDown(document.querySelector('.guide-card')!, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: '玩法' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: START_LABEL }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sessionStorage.getItem(FIRST_RUN_STORAGE_KEY)).toBe('1');
  });

  it('does not reopen within the same session', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: START_LABEL }));
    cleanup();
    render(<App />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the reference card from the ? button, closable and without 試一試', () => {
    sessionStorage.setItem(FIRST_RUN_STORAGE_KEY, '1');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '玩法' }));
    expect(screen.getByRole('button', { name: '关闭' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: START_LABEL })).toBeNull();

    fireEvent.keyDown(document.querySelector('.guide-card')!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('forces the first-run gate from ?guide=1', () => {
    sessionStorage.setItem(FIRST_RUN_STORAGE_KEY, '1');
    window.history.replaceState({}, '', '/?guide=1');
    render(<App />);
    expect(screen.getByRole('button', { name: START_LABEL })).toBeTruthy();
    expect(sessionStorage.getItem(FIRST_RUN_STORAGE_KEY)).toBe('1');
  });
});
