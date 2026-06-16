import { useState, useCallback, useRef, useEffect } from 'react';
import type { ElementType, WheelMode } from './types';
import { ELEMENT_COLORS, ELEMENT_SYMBOLS, SLOT_ORBIT_RADIUS } from './types';
import type { WheelAction } from './types';
import { getSlotPosition } from './geometry';

const ELEMENTS: ElementType[] = ['earth', 'metal', 'wood', 'fire', 'water'];
const SLOT_COUNT = 10;
const SNAP_THRESHOLD_PX = 30;

interface StonePaletteProps {
  selectedStone: ElementType | null;
  onSelectStone: (element: ElementType) => void;
  onClear: () => void;
  dispatch: React.Dispatch<WheelAction>;
  wheelRotation: number;
  wheelMode: WheelMode;
  onSnapTargetChange: (slotIndex: number | null) => void;
}

function StonePalette({ selectedStone, onSelectStone, onClear, dispatch, wheelRotation, wheelMode, onSnapTargetChange }: StonePaletteProps) {
  const [draggingElement, setDraggingElement] = useState<ElementType | null>(null);
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number } | null>(null);
  const [snapTargetSlot, setSnapTargetSlot] = useState<number | null>(null);
  const snapTargetSlotRef = useRef<number | null>(null);
  const draggingRef = useRef<ElementType | null>(null);
  const wheelRotationRef = useRef(wheelRotation);
  const onSnapTargetChangeRef = useRef(onSnapTargetChange);
  const dispatchRef = useRef(dispatch);
  useEffect(() => { wheelRotationRef.current = wheelRotation; });
  useEffect(() => { onSnapTargetChangeRef.current = onSnapTargetChange; });
  useEffect(() => { dispatchRef.current = dispatch; });
  const moveHandlerRef = useRef<((e: PointerEvent) => void) | null>(null);
  const upHandlerRef = useRef<((e: PointerEvent) => void) | null>(null);

  const handlePointerDown = useCallback((el: ElementType) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingElement(el);
    draggingRef.current = el;
    setGhostPosition({ x: e.clientX, y: e.clientY });
    document.addEventListener('pointermove', moveHandlerRef.current!);
    document.addEventListener('pointerup', upHandlerRef.current!);
  }, []);

  // Stable native pointer event handlers (created once, read from refs)
  useEffect(() => {
    moveHandlerRef.current = (e: PointerEvent) => {
      const el = draggingRef.current;
      if (!el) return;

      const cursorX = e.clientX;
      const cursorY = e.clientY;

      // Find nearest slot center for snap detection
      const wheelEl = document.querySelector('.wheel-container');
      if (wheelEl) {
        const rect = wheelEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const Rrad = (wheelRotationRef.current * Math.PI) / 180;
        const cosR = Math.cos(Rrad);
        const sinR = Math.sin(Rrad);

        let nearestDist = Infinity;
        let nearestIdx: number | null = null;
        let nearestPos = { x: 0, y: 0 };

        for (let i = 0; i < SLOT_COUNT; i++) {
          const base = getSlotPosition(i, 0, 0, SLOT_ORBIT_RADIUS);
          const dx = base.x * cosR - base.y * sinR;
          const dy = base.x * sinR + base.y * cosR;
          const slotX = cx + dx;
          const slotY = cy + dy;

          const dist = Math.hypot(slotX - cursorX, slotY - cursorY);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestIdx = i;
            nearestPos = { x: slotX, y: slotY };
          }
        }

        if (nearestIdx !== null && nearestDist <= SNAP_THRESHOLD_PX) {
          setGhostPosition(nearestPos);
          setSnapTargetSlot(nearestIdx);
          snapTargetSlotRef.current = nearestIdx;
          onSnapTargetChangeRef.current(nearestIdx);
          return;
        }
      }

      // No snap — follow cursor
      setGhostPosition({ x: cursorX, y: cursorY });
      setSnapTargetSlot(null);
      snapTargetSlotRef.current = null;
      onSnapTargetChangeRef.current(null);
    };

    upHandlerRef.current = (e: PointerEvent) => {
      const el = draggingRef.current;
      if (!el) return;

      const targetSlot = snapTargetSlotRef.current;
      if (targetSlot !== null) {
        dispatchRef.current({ type: 'PLACE_STONE', slotIndex: targetSlot, element: el });
      } else {
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const slotEl = target?.closest('[data-slot-index]');
        if (slotEl) {
          const slotIndex = Number(slotEl.getAttribute('data-slot-index'));
          dispatchRef.current({ type: 'PLACE_STONE', slotIndex, element: el });
        }
      }

      setDraggingElement(null);
      draggingRef.current = null;
      setGhostPosition(null);
      setSnapTargetSlot(null);
      snapTargetSlotRef.current = null;
      onSnapTargetChangeRef.current(null);

      document.removeEventListener('pointermove', moveHandlerRef.current!);
      document.removeEventListener('pointerup', upHandlerRef.current!);
    };
  }, []);

  // Cleanup document listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('pointermove', moveHandlerRef.current!);
      document.removeEventListener('pointerup', upHandlerRef.current!);
    };
  }, []);

  return (
    <div
      className="stone-palette"
    >
      {ELEMENTS.map((el) => (
        <div
          key={el}
          className={
            'stone-palette__stone' +
            (selectedStone === el ? ' stone-palette__stone--selected' : '')
          }
          style={{ backgroundColor: ELEMENT_COLORS[el] }}
          onClick={() => onSelectStone(el)}
          onPointerDown={handlePointerDown(el)}
        >
          {ELEMENT_SYMBOLS[el]}
        </div>
      ))}
      <button className="stone-palette__clear" onClick={onClear}>
        Clear
      </button>
      {draggingElement && ghostPosition && (
        <div
          className="stone-ghost"
          style={{
            left: ghostPosition.x,
            top: ghostPosition.y,
            backgroundColor: ELEMENT_COLORS[draggingElement],
          }}
        >
          {ELEMENT_SYMBOLS[draggingElement]}
        </div>
      )}
    </div>
  );
}

export default StonePalette;
