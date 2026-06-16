import type { ElementType, WheelMode } from './types';
import { ELEMENT_COLORS, ELEMENT_SYMBOLS } from './types';

interface SlotProps {
  index: number;
  element: ElementType | null;
  isAtHead: boolean;
  counterRotation: number;
  onClick?: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  mode: WheelMode;
  isPlayed: boolean;
  isCurrentlyPlaying: boolean;
  isSnapTarget?: boolean;
  isDraggedAway?: boolean;
}

function Slot({ index, element, isAtHead, counterRotation, onClick, onPointerDown, mode, isPlayed, isCurrentlyPlaying, isSnapTarget, isDraggedAway }: SlotProps) {
  const displayElement = isDraggedAway ? null : element;
  const className = [
    'slot',
    displayElement ? 'slot--filled' : 'slot--empty',
    isAtHead ? 'slot--at-head' : '',
    isAtHead && displayElement && mode === 'winding' ? 'slot--glow' : '',
    isSnapTarget ? 'slot--glow' : '',
    isCurrentlyPlaying ? 'slot--playing' : '',
    isPlayed ? 'slot--dimmed' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={className}
      onPointerDown={onPointerDown}
      onClick={onClick}
      data-slot-index={index}
      style={{
        backgroundColor: displayElement ? ELEMENT_COLORS[displayElement] : undefined,
        transform: `rotate(${counterRotation}deg)`,
      }}
    >
      {displayElement && ELEMENT_SYMBOLS[displayElement]}
      <span className="slot__index">{index}</span>
    </div>
  );
}

export default Slot;
