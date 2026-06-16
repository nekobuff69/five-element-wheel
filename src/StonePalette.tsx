import { useState, useCallback } from 'react';
import type { ElementType } from './types';
import { ELEMENT_COLORS, ELEMENT_SYMBOLS } from './types';
import type { WheelAction } from './types';

const ELEMENTS: ElementType[] = ['earth', 'metal', 'wood', 'fire', 'water'];

interface StonePaletteProps {
  selectedStone: ElementType | null;
  onSelectStone: (element: ElementType) => void;
  onClear: () => void;
  dispatch: React.Dispatch<WheelAction>;
}

function StonePalette({ selectedStone, onSelectStone, onClear, dispatch }: StonePaletteProps) {
  const [draggingElement, setDraggingElement] = useState<ElementType | null>(null);
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number } | null>(null);

  const handlePointerDown = useCallback((el: ElementType) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingElement(el);
    setGhostPosition({ x: e.clientX, y: e.clientY });
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingElement) return;
    setGhostPosition({ x: e.clientX, y: e.clientY });
  }, [draggingElement]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!draggingElement) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const slotEl = el?.closest('[data-slot-index]');
    if (slotEl) {
      const slotIndex = Number(slotEl.getAttribute('data-slot-index'));
      dispatch({ type: 'PLACE_STONE', slotIndex, element: draggingElement });
    }
    setDraggingElement(null);
    setGhostPosition(null);
  }, [draggingElement, dispatch]);

  return (
    <div
      className="stone-palette"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
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
