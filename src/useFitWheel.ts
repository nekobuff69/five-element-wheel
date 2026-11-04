import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';

const MAX_WHEEL = 360;
const MIN_WHEEL = 180;

/**
 * Fit the fixed 360px Wheel coordinate system into the space left by the rest
 * of the screen. The Wheel's Slot geometry and gesture math stay in 360px
 * coordinates; only the frame size and --wheel-scale change.
 *
 * See docs/adr/0011-fit-wheel-to-viewport-height.md.
 */
export function useFitWheel(appRef: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const app = appRef.current;
    if (!app) return;
    const frame = app.querySelector<HTMLElement>('.wheel-frame');
    if (!frame) return;

    const apply = () => {
      const cs = getComputedStyle(app);
      const gap = parseFloat(cs.rowGap) || 0;
      const paddingY =
        (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      const paddingX =
        (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);

      // Fixed-position overlays and drag ghosts do not take part in flex layout.
      const siblings = Array.from(app.children).filter(
        (el) =>
          el !== frame &&
          !(el as HTMLElement).classList.contains('guide-overlay') &&
          !(el as HTMLElement).classList.contains('stone-ghost'),
      );
      const chrome =
        siblings.reduce(
          (sum, el) => sum + (el as HTMLElement).offsetHeight,
          0,
        ) +
        gap * siblings.length +
        paddingY;

      const available = app.clientHeight - chrome;
      const maxWidth = app.clientWidth - paddingX;
      const size = Math.max(
        MIN_WHEEL,
        Math.min(MAX_WHEEL, available, maxWidth),
      );

      frame.style.width = `${size}px`;
      frame.style.height = `${size}px`;
      document.documentElement.style.setProperty(
        '--wheel-scale',
        String(size / MAX_WHEEL),
      );
    };

    apply();
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    observer?.observe(app);
    window.addEventListener('resize', apply);
    window.visualViewport?.addEventListener('resize', apply);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', apply);
      window.visualViewport?.removeEventListener('resize', apply);
    };
  }, [appRef]);
}
