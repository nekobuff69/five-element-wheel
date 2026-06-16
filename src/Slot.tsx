import type { ElementType, WheelMode } from './types';
import { ELEMENT_COLORS, ELEMENT_SYMBOLS } from './types';

interface SlotProps {
  index: number;
  element: ElementType | null;
  isAtHead: boolean;
  counterRotation: number;
  onClick?: () => void;
  mode: WheelMode;
  isPlayed: boolean;
  isCurrentlyPlaying: boolean;
  isSnapTarget?: boolean;
}

function Slot({ index, element, isAtHead, counterRotation, onClick, mode, isPlayed, isCurrentlyPlaying, isSnapTarget }: SlotProps) {
  const className = [
    'slot',
    element ? 'slot--filled' : 'slot--empty',
    isAtHead ? 'slot--at-head' : '',
    isAtHead && element && mode === 'winding' ? 'slot--glow' : '',
    isSnapTarget ? 'slot--glow' : '',
    isCurrentlyPlaying ? 'slot--playing' : '',
    isPlayed ? 'slot--dimmed' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={className}
      onClick={onClick}
      data-slot-index={index}
      style={{
        backgroundColor: element ? ELEMENT_COLORS[element] : undefined,
        transform: `rotate(${counterRotation}deg)`,
      }}
    >
      {element && ELEMENT_SYMBOLS[element]}
      <span className="slot__index">{index}</span>
    </div>
  );
}

export default Slot;
