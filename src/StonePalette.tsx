import { useState, useCallback, useRef, useEffect } from 'react';
import type { CSSProperties } from 'react';
import type { ElementType, WheelMode } from './types';
import { ELEMENT_COLORS, ELEMENT_SYMBOLS } from './types';
import { findSnapTargetFromDOM } from './geometry';
import type { WheelAction } from './types';

const ELEMENTS: ElementType[] = ['earth', 'metal', 'wood', 'fire', 'water'];
const SNAP_THRESHOLD_PX = 30;

interface StonePaletteProps {
  selectedStone: ElementType | null;
  onSelectStone: (element: ElementType) => void;
  onClear: () => void;
  dispatch: React.Dispatch<WheelAction>;
  wheelMode: WheelMode;
  onSnapTargetChange: (slotIndex: number | null) => void;
}

function StonePalette({ selectedStone, onSelectStone, onClear, dispatch, wheelMode, onSnapTargetChange }: StonePaletteProps) {
  const [draggingElement, setDraggingElement] = useState<ElementType | null>(null);
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number } | null>(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [snapTargetSlot, setSnapTargetSlot] = useState<number | null>(null);
  const snapTargetSlotRef = useRef<number | null>(null);
  const draggingRef = useRef<ElementType | null>(null);
  const onSnapTargetChangeRef = useRef(onSnapTargetChange);
  const dispatchRef = useRef(dispatch);
  useEffect(() => { onSnapTargetChangeRef.current = onSnapTargetChange; });
  useEffect(() => { dispatchRef.current = dispatch; });
  const moveHandlerRef = useRef<((e: PointerEvent) => void) | null>(null);
  const upHandlerRef = useRef<((e: PointerEvent) => void) | null>(null);

  const handlePointerDown = useCallback((el: ElementType) => (e: React.PointerEvent) => {
    e.preventDefault();
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

      // Find nearest slot center for snap detection using DOM positions
      const snap = findSnapTargetFromDOM(cursorX, cursorY, SNAP_THRESHOLD_PX);

      if (snap) {
        setGhostPosition({ x: snap.x, y: snap.y });
        setSnapTargetSlot(snap.slotIndex);
        snapTargetSlotRef.current = snap.slotIndex;
        onSnapTargetChangeRef.current(snap.slotIndex);
        return;
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

      // Start fade-out
      setIsFadingOut(true);

      // Remove listeners immediately so no stray events interfere during fade
      document.removeEventListener('pointermove', moveHandlerRef.current!);
      document.removeEventListener('pointerup', upHandlerRef.current!);

      // Delay state cleanup for fade animation
      setTimeout(() => {
        setDraggingElement(null);
        draggingRef.current = null;
        setGhostPosition(null);
        setSnapTargetSlot(null);
        snapTargetSlotRef.current = null;
        onSnapTargetChangeRef.current(null);
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
          data-element={el}
          style={{ '--stone-color': ELEMENT_COLORS[el] } as CSSProperties}
          onClick={() => onSelectStone(el)}
          onPointerDown={handlePointerDown(el)}
        >
          <span className="stone-palette__core">
            {ELEMENT_SYMBOLS[el]}
          </span>
        </div>
      ))}
      <button className="stone-palette__clear" onClick={onClear}>
        歸零
      </button>
      {draggingElement && (ghostPosition || isFadingOut) && (
        <div
          className={`stone-ghost${isFadingOut ? ' stone-ghost--fading' : ''}`}
          data-element={draggingElement}
          style={
            {
              left: ghostPosition?.x ?? 0,
              top: ghostPosition?.y ?? 0,
              '--stone-color': ELEMENT_COLORS[draggingElement],
            } as CSSProperties
          }
        >
          <span className="stone-ghost__core">
            {ELEMENT_SYMBOLS[draggingElement]}
          </span>
        </div>
      )}
    </div>
  );
}

export default StonePalette;
