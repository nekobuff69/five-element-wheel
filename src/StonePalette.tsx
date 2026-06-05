import type { ElementType } from './types';
import { ELEMENT_COLORS, ELEMENT_SYMBOLS } from './types';

const ELEMENTS: ElementType[] = ['earth', 'metal', 'wood', 'fire', 'water'];

interface StonePaletteProps {
  selectedStone: ElementType | null;
  onSelectStone: (element: ElementType) => void;
  onClear: () => void;
}

function StonePalette({ selectedStone, onSelectStone, onClear }: StonePaletteProps) {
  return (
    <div className="stone-palette">
      {ELEMENTS.map((el) => (
        <div
          key={el}
          className={
            'stone-palette__stone' +
            (selectedStone === el ? ' stone-palette__stone--selected' : '')
          }
          style={{ backgroundColor: ELEMENT_COLORS[el] }}
          onClick={() => onSelectStone(el)}
        >
          {ELEMENT_SYMBOLS[el]}
        </div>
      ))}
      <button className="stone-palette__clear" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}

export default StonePalette;
