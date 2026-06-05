import type { ElementType, WheelMode } from './types';
import { ELEMENT_COLORS, ELEMENT_SYMBOLS } from './types';

interface SlotProps {
  element: ElementType | null;
  isAtHead: boolean;
  counterRotation: number;
  onClick?: () => void;
  mode: WheelMode;
  isPlayed: boolean;
  isCurrentlyPlaying: boolean;
}

function Slot({ element, isAtHead, counterRotation, onClick, mode, isPlayed, isCurrentlyPlaying }: SlotProps) {
  const className = [
    'slot',
    element ? 'slot--filled' : 'slot--empty',
    isAtHead ? 'slot--at-head' : '',
    isAtHead && element && mode === 'winding' ? 'slot--glow' : '',
    isCurrentlyPlaying ? 'slot--playing' : '',
    isPlayed ? 'slot--dimmed' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        backgroundColor: element ? ELEMENT_COLORS[element] : undefined,
        transform: `rotate(${counterRotation}deg)`,
      }}
    >
      {element && ELEMENT_SYMBOLS[element]}
    </div>
  );
}

export default Slot;
