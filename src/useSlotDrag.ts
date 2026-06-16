import { useState, useCallback, useRef, useEffect } from 'react';
import type { ElementType, WheelAction } from './types';
import { findSnapTarget, SLOT_ORBIT_RADIUS } from './geometry';

const SNAP_THRESHOLD_PX = 30;
const SLOT_COUNT = 10;

export function useSlotDrag(
  dispatch: React.Dispatch<WheelAction>,
  wheelRotation: number,
) {
  const [sourceSlotIndex, setSourceSlotIndex] = useState<number | null>(null);
  const [ghostElement, setGhostElement] = useState<ElementType | null>(null);
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number } | null>(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [snapTargetSlot, setSnapTargetSlot] = useState<number | null>(null);

  // Refs for stable async event handlers
  const sourceSlotRef = useRef<number | null>(null);
  const snapTargetRef = useRef<number | null>(null);
  const dispatchRef = useRef(dispatch);
  const ghostElementRef = useRef<ElementType | null>(null);
  const wheelRotationRef = useRef(wheelRotation);

  useEffect(() => { dispatchRef.current = dispatch; });
  useEffect(() => { wheelRotationRef.current = wheelRotation; });
  useEffect(() => { ghostElementRef.current = ghostElement; });

  const moveHandlerRef = useRef<((e: PointerEvent) => void) | null>(null);
  const upHandlerRef = useRef<((e: PointerEvent) => void) | null>(null);

  const handleSlotPointerDown = useCallback((
    slotIndex: number,
    element: ElementType,
    e: React.PointerEvent,
  ) => {
    e.stopPropagation();
    e.preventDefault();

    setSourceSlotIndex(slotIndex);
    sourceSlotRef.current = slotIndex;
    setGhostElement(element);
    ghostElementRef.current = element;
    setGhostPosition({ x: e.clientX, y: e.clientY });
    setIsFadingOut(false);
    setSnapTargetSlot(null);
    snapTargetRef.current = null;

    document.addEventListener('pointermove', moveHandlerRef.current!);
    document.addEventListener('pointerup', upHandlerRef.current!);
  }, []);

  // Create stable native event handlers once
  useEffect(() => {
    moveHandlerRef.current = (e: PointerEvent) => {
      const sourceIdx = sourceSlotRef.current;
      if (sourceIdx === null) return;

      const cursorX = e.clientX;
      const cursorY = e.clientY;

      const wheelEl = document.querySelector('.wheel-container');
      if (wheelEl) {
        const rect = wheelEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const snap = findSnapTarget(
          cursorX, cursorY,
          cx, cy,
          wheelRotationRef.current,
          SLOT_COUNT,
          SNAP_THRESHOLD_PX,
          SLOT_ORBIT_RADIUS,
        );

        if (snap && snap.slotIndex !== sourceIdx) {
          setGhostPosition({ x: snap.x, y: snap.y });
          setSnapTargetSlot(snap.slotIndex);
          snapTargetRef.current = snap.slotIndex;
          return;
        }
      }

      // No snap — follow cursor
      setGhostPosition({ x: cursorX, y: cursorY });
      setSnapTargetSlot(null);
      snapTargetRef.current = null;
    };

    upHandlerRef.current = (_e: PointerEvent) => {
      const sourceIdx = sourceSlotRef.current;
      if (sourceIdx === null) return;

      const targetSlot = snapTargetRef.current;
      const dispatch = dispatchRef.current;

      // Clear snap target state
      setSnapTargetSlot(null);
      snapTargetRef.current = null;

      if (targetSlot !== null && targetSlot !== sourceIdx) {
        // Move/replace: remove from source, place at target
        const element = ghostElementRef.current;
        dispatch({ type: 'REMOVE_STONE', slotIndex: sourceIdx });
        if (element !== null) {
          dispatch({ type: 'PLACE_STONE', slotIndex: targetSlot, element });
        }
      } else if (targetSlot === null) {
        // Dropped on void — remove from source
        dispatch({ type: 'REMOVE_STONE', slotIndex: sourceIdx });
      }
      // Dropped on same slot — no-op

      // Fade out ghost
      setIsFadingOut(true);

      document.removeEventListener('pointermove', moveHandlerRef.current!);
      document.removeEventListener('pointerup', upHandlerRef.current!);

      setTimeout(() => {
        setSourceSlotIndex(null);
        sourceSlotRef.current = null;
        setGhostElement(null);
        setGhostPosition(null);
        setIsFadingOut(false);
      }, 200);
    };
  }, []);

  // Cleanup document listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('pointermove', moveHandlerRef.current!);
      document.removeEventListener('pointerup', upHandlerRef.current!);
    };
  }, []);

  return {
    draggingFromSlotIndex: sourceSlotIndex,
    ghostElement,
    ghostPosition,
    isFadingOut,
    snapTargetSlot,
    handleSlotPointerDown,
  };
}
