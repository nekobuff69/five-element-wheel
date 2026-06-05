import type { ElementType } from './types';
import { ELEMENT_COLORS, ELEMENT_SYMBOLS } from './types';

interface HeadProps {
  currentElement: ElementType | null;
  springBackElement: ElementType | null;
  isSpringBack: boolean;
}

function Head({ currentElement, springBackElement, isSpringBack }: HeadProps) {
  const displayElement = isSpringBack ? springBackElement : currentElement;
  return (
    <div className={['head', isSpringBack ? 'head--playing' : ''].filter(Boolean).join(' ')}>
      {displayElement && (
        <div
          key={displayElement}
          className="head__stone"
          style={{ backgroundColor: ELEMENT_COLORS[displayElement] }}
        >
          {ELEMENT_SYMBOLS[displayElement]}
        </div>
      )}
    </div>
  );
}

export default Head;
