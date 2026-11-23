import type { CSSProperties } from 'react';
import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import type { ElementType, WheelMode } from './types';
import { ELEMENT_COLORS, ELEMENT_SYMBOLS } from './types';

interface SlotProps {
  index: number;
  element: ElementType | null;
  isQueued: boolean;
  counterRotation: number;
  onClick?: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  mode: WheelMode;
  isDimmed: boolean;
  isCurrentlyPlaying: boolean;
  isSnapTarget?: boolean;
  isDraggedAway?: boolean;
  isPending?: boolean;
}

const EXIT_GHOST_MS = 80;

function Slot({
  index,
  element,
  isQueued,
  counterRotation,
  onClick,
  onPointerDown,
  isDimmed,
  isCurrentlyPlaying,
  isSnapTarget,
  isDraggedAway,
  isPending,
}: SlotProps) {
  const displayElement = isDraggedAway ? null : element;

  // A short-lived, view-local ghost of a removed Stone. It is derived purely
  // from the state diff (the `element` prop), so click-to-place, palette drag,
  // slot-to-slot move and drag-off-Wheel all settle/exit identically — no
  // per-path special cases and no new global state.
  const [exitGhost, setExitGhost] = useState<ElementType | null>(null);
  const prevElementRef = useRef<ElementType | null>(element);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    const prev = prevElementRef.current;
    prevElementRef.current = element;
    if (prev !== null && element === null) {
      setExitGhost(prev);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      exitTimerRef.current = setTimeout(
        () => setExitGhost(null),
        EXIT_GHOST_MS,
      );
    } else if (element !== null) {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      setExitGhost(null);
    }
  }, [element]);

  useEffect(
    () => () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    },
    [],
  );

  const className = [
    'slot',
    displayElement ? 'slot--filled' : 'slot--empty',
    isQueued ? 'slot--queued' : '',
    isSnapTarget ? 'slot--glow' : '',
    isCurrentlyPlaying ? 'slot--playing' : '',
    isPending ? 'slot--pending' : '',
    isDimmed ? 'slot--dimmed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const style = {
    '--stone-color': displayElement
      ? ELEMENT_COLORS[displayElement]
      : undefined,
    transform: `rotate(${counterRotation}deg)`,
  } as CSSProperties;

  return (
    <div
      className={className}
      onPointerDown={onPointerDown}
      onClick={onClick}
      data-slot-index={index}
      data-element={displayElement ?? undefined}
      style={style}
    >
      {displayElement && (
        <span key={displayElement} className="slot__core">
          {ELEMENT_SYMBOLS[displayElement]}
        </span>
      )}
      {exitGhost && !displayElement && (
        <span
          key={`exit-${exitGhost}`}
          className="slot__core slot__core--exiting"
          style={
            {
              '--stone-color': ELEMENT_COLORS[exitGhost],
            } as CSSProperties
          }
        >
          {ELEMENT_SYMBOLS[exitGhost]}
        </span>
      )}
    </div>
  );
}

export default Slot;
