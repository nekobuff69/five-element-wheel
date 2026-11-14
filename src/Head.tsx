import type { CSSProperties, ReactNode } from 'react';
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
  const isBeat = isSpringBack && beat >= 0;

  // A sounded beat shows the element glyph under the seal. The key carries the
  // beat so the press replays on every beat, even consecutive identical
  // elements. On a rest (spring-back beat with no Stone) we still press a quiet
  // empty-seal placeholder so the 10-beat grid reads at the Head; its key also
  // carries the beat so the press replays each rest. The cinnabar .head square
  // itself is unchanged.
  let stone: ReactNode = null;
  if (displayElement !== null) {
    stone = (
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
    );
  } else if (isBeat) {
    stone = (
      <div key={`rest-${beat}`} className="head__stone head__stone--empty" />
    );
  }

  return (
    <div
      className={['head', isSpringBack ? 'head--playing' : '']
        .filter(Boolean)
        .join(' ')}
      data-element={displayElement ?? undefined}
    >
      {stone}
    </div>
  );
}

export default Head;
