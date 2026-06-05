import { useEffect, useRef, useCallback } from 'react';
import type { WheelMode } from './types';

const DRAG_THRESHOLD = 5;

function getAngle(centerX: number, centerY: number, px: number, py: number): number {
  return Math.atan2(py - centerY, px - centerX) * (180 / Math.PI);
}

function normalizeDelta(delta: number): number {
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

export function useWheelGesture(
  wheelRef: React.RefObject<HTMLDivElement | null>,
  mode: WheelMode,
  onWind: (delta: number) => void,
  onRelease: () => void
) {
  const isDraggingRef = useRef(false);
  const lastAngleRef = useRef<number | null>(null);
  const dragStartedRef = useRef(false);
  const accumulatedMovementRef = useRef(0);

  // Keep callbacks and mode in refs to avoid re-binding listeners
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const onWindRef = useRef(onWind);
  onWindRef.current = onWind;
  const onReleaseRef = useRef(onRelease);
  onReleaseRef.current = onRelease;

  const handlePointerDown = useCallback((e: PointerEvent) => {
    const container = wheelRef.current;
    if (!container) return;
    if (modeRef.current !== 'ready' && modeRef.current !== 'winding') return;
    container.setPointerCapture(e.pointerId);
    const rect = container.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    lastAngleRef.current = getAngle(cx, cy, e.clientX, e.clientY);
    isDraggingRef.current = true;
    dragStartedRef.current = false;
    accumulatedMovementRef.current = 0;
  }, [wheelRef]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current || lastAngleRef.current === null) return;
    if (modeRef.current !== 'ready' && modeRef.current !== 'winding') return;
    const container = wheelRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const currentAngle = getAngle(cx, cy, e.clientX, e.clientY);
    const rawDelta = currentAngle - lastAngleRef.current;
    const delta = normalizeDelta(rawDelta);
    lastAngleRef.current = currentAngle;
    if (!dragStartedRef.current) {
      accumulatedMovementRef.current += Math.abs(delta);
      if (accumulatedMovementRef.current >= DRAG_THRESHOLD) {
        dragStartedRef.current = true;
      } else {
        return;
      }
    }
    if (delta !== 0) {
      onWindRef.current(delta);
    }
  }, [wheelRef]);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current) return;
    const container = wheelRef.current;
    if (container) {
      container.releasePointerCapture(e.pointerId);
    }
    const wasDragStarted = dragStartedRef.current;
    isDraggingRef.current = false;
    lastAngleRef.current = null;
    dragStartedRef.current = false;
    accumulatedMovementRef.current = 0;
    if (wasDragStarted) {
      onReleaseRef.current();
    }
  }, [wheelRef]);

  useEffect(() => {
    const el = wheelRef.current;
    if (!el) return;
    el.addEventListener('pointerdown', handlePointerDown);
    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerup', handlePointerUp);
    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
    };
  }, [wheelRef, handlePointerDown, handlePointerMove, handlePointerUp]);
}
