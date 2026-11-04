import type { CSSProperties } from 'react';
import type { ElementType } from './types';
import { ELEMENT_COLORS, ELEMENT_SYMBOLS } from './types';

interface HeadProps {
  currentElement: ElementType | null;
  springBackElement: ElementType | null;
  isSpringBack: boolean;
  beat: number;
}

function Head({
  currentElement,
  springBackElement,
  isSpringBack,
  beat,
}: HeadProps) {
  const displayElement = isSpringBack ? springBackElement : currentElement;
  return (
    <div
      className={['head', isSpringBack ? 'head--playing' : '']
        .filter(Boolean)
        .join(' ')}
      data-element={displayElement ?? undefined}
    >
      {displayElement && (
        <div
          key={`${displayElement}-${beat}`}
          className="head__stone"
          style={
            {
              '--stone-color': ELEMENT_COLORS[displayElement],
            } as CSSProperties
          }
        >
          {ELEMENT_SYMBOLS[displayElement]}
        </div>
      )}
    </div>
  );
}

export default Head;
