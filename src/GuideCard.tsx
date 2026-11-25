import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { GuideMode } from './guideGate';

const GUIDE_LINES = [
  '從頂部拖動五行石，置入輪盤外圍的圓形插槽，十個空位任意選擇。',
  '撥動輪盤，順時針或逆時針轉一圈，聽見卡榫「噠」提示聲時鬆開手指',
  '輪盤轉動，錄入五行音符，旋律循環播放。',
  '播放中可隨時改變旋律，例如，將五行石拖到插槽外，將輪盤朝反方向轉動等等。',
  '主界面下方調、八度和拍速可調',
  '循環可開關',
  '請大膽嘗試，玩不壞。',
];

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

type CardMode = Exclude<GuideMode, 'closed'>;

interface GuideCardProps {
  mode: CardMode;
  onClose: () => void;
  onAcknowledge: () => void;
}

/**
 * The 玩法 card. `firstRun` is the gate: no close button, no backdrop close,
 * Escape is swallowed, and 試一試 is the only way out. `reference` is the
 * original card opened by the ? button.
 */
export default function GuideCard({
  mode,
  onClose,
  onAcknowledge,
}: GuideCardProps) {
  const firstRun = mode === 'firstRun';
  const cardRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hintVisible, setHintVisible] = useState(false);

  // Focus enters the card on open and returns to the trigger on close.
  useEffect(() => {
    const previous = document.activeElement;
    cardRef.current?.focus();
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  // The ↓ hint points at the 試一試 button whenever the copy still overflows
  // below the fold; it disappears once the list is scrolled to its end.
  const syncHint = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !firstRun) {
      setHintVisible(false);
      return;
    }
    const overflowing = el.scrollHeight > el.clientHeight + 1;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    setHintVisible(overflowing && !atBottom);
  }, [firstRun]);

  useEffect(() => {
    const el = scrollRef.current;
    syncHint();
    if (!el) return;
    el.addEventListener('scroll', syncHint, { passive: true });
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(syncHint)
        : null;
    observer?.observe(el);
    window.addEventListener('resize', syncHint);
    return () => {
      el.removeEventListener('scroll', syncHint);
      observer?.disconnect();
      window.removeEventListener('resize', syncHint);
    };
  }, [syncHint]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (!firstRun) onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const card = cardRef.current;
    if (!card) return;
    const focusables = Array.from(
      card.querySelectorAll<HTMLElement>(FOCUSABLE),
    );
    if (focusables.length === 0) {
      event.preventDefault();
      card.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === card)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || active === card)) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="guide-overlay"
      role="presentation"
      onClick={firstRun ? undefined : onClose}
      onKeyDown={onKeyDown}
    >
      <div
        ref={cardRef}
        className={`guide-card${firstRun ? ' guide-card--first-run' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="guide-card__head">
          <span id="guide-title">玩法</span>
          {!firstRun && (
            <button
              type="button"
              className="guide-card__close"
              aria-label="关闭"
              onClick={onClose}
            >
              ×
            </button>
          )}
        </div>
        <div className="guide-card__scroll" ref={scrollRef}>
          <ul className="guide-card__list" id="guide-lines">
            {GUIDE_LINES.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          {firstRun && (
            <button
              type="button"
              className="guide-card__start"
              onClick={onAcknowledge}
            >
              試一試
            </button>
          )}
        </div>
        {firstRun && hintVisible && (
          <div className="guide-card__hint" aria-hidden="true">
            ↓
          </div>
        )}
      </div>
    </div>
  );
}
