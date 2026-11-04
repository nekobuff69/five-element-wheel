import type { CSSProperties } from 'react';
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
}

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
}: SlotProps) {
  const displayElement = isDraggedAway ? null : element;
  const className = [
    'slot',
    displayElement ? 'slot--filled' : 'slot--empty',
    isQueued ? 'slot--queued' : '',
    isSnapTarget ? 'slot--glow' : '',
    isCurrentlyPlaying ? 'slot--playing' : '',
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
        <span className="slot__core">
          {ELEMENT_SYMBOLS[displayElement]}
        </span>
      )}
      <span className="slot__index">{index}</span>
    </div>
  );
}

export default Slot;
