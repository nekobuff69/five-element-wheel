export const SLOT_ANGLE_SPAN = 300 / 9;
export const SLOT_START_ANGLE = 210;
export const HEAD_ANGLE = 180;
export const SLOT_ORBIT_RADIUS = 122;

/**
 * Compute the screen position of a slot center on the wheel circle,
 * given the wheel center coordinates and orbit radius.
 *
 * Uses the CSS screen convention: y-axis points down, angles are
 * measured clockwise from north (12 o'clock).
 *
 * Does NOT account for wheel rotation — caller must rotate the
 * result around (wheelCenterX, wheelCenterY) if the wheel is rotated.
 */
export function getSlotPosition(
  slotIndex: number,
  wheelCenterX: number,
  wheelCenterY: number,
  wheelRadius: number
): { x: number; y: number } {
  const angleDeg = SLOT_START_ANGLE + slotIndex * SLOT_ANGLE_SPAN;
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: wheelCenterX + wheelRadius * Math.sin(angleRad),
    y: wheelCenterY - wheelRadius * Math.cos(angleRad),
  };
}

export interface SnapTarget {
  slotIndex: number;
  x: number;
  y: number;
}

/**
 * Find the nearest slot center within a distance threshold.
 * Returns the slot index and its screen position, or null if no slot is close enough.
 *
 * @param cursorX - Pointer X in screen coordinates
 * @param cursorY - Pointer Y in screen coordinates
 * @param wheelCenterX - Wheel center X in screen coordinates
 * @param wheelCenterY - Wheel center Y in screen coordinates
 * @param wheelRotation - Current wheel rotation in degrees (affects slot positions)
 * @param slotCount - Number of slots on the wheel (default 10)
 * @param threshold - Max distance (px) for a slot to be considered a snap target (default 30)
 * @param wheelRadius - Orbit radius of the slots (default SLOT_ORBIT_RADIUS)
 */
export function findSnapTarget(
  cursorX: number,
  cursorY: number,
  wheelCenterX: number,
  wheelCenterY: number,
  wheelRotation: number,
  slotCount: number = 10,
  threshold: number = 30,
  wheelRadius: number = SLOT_ORBIT_RADIUS
): SnapTarget | null {
  const Rrad = (wheelRotation * Math.PI) / 180;
  const cosR = Math.cos(Rrad);
  const sinR = Math.sin(Rrad);

  let nearestDist = Infinity;
  let nearestIdx: number | null = null;
  let nearestPos = { x: 0, y: 0 };

  for (let i = 0; i < slotCount; i++) {
    const base = getSlotPosition(i, 0, 0, wheelRadius);
    const dx = base.x * cosR - base.y * sinR;
    const dy = base.x * sinR + base.y * cosR;
    const slotX = wheelCenterX + dx;
    const slotY = wheelCenterY + dy;

    const dist = Math.hypot(slotX - cursorX, slotY - cursorY);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestIdx = i;
      nearestPos = { x: slotX, y: slotY };
    }
  }

  if (nearestIdx !== null && nearestDist <= threshold) {
    return { slotIndex: nearestIdx, x: nearestPos.x, y: nearestPos.y };
  }

  return null;
}

/**
 * Find the nearest slot center within a distance threshold using
 * actual DOM positions (getBoundingClientRect).
 *
 * Unlike the mathematical findSnapTarget, this reads the rendered
 * positions of slot elements, so it works correctly during CSS
 * transitions (e.g. springBack) where state.rotation is stale.
 */
export function findSnapTargetFromDOM(
  cursorX: number,
  cursorY: number,
  threshold: number = 30
): SnapTarget | null {
  const slotEls = document.querySelectorAll<HTMLElement>('.wheel-container [data-slot-index]');
  if (slotEls.length === 0) return null;

  let nearestDist = Infinity;
  let nearestIdx: number | null = null;
  let nearestPos = { x: 0, y: 0 };

  slotEls.forEach((el) => {
    const idx = Number(el.getAttribute('data-slot-index'));
    if (Number.isNaN(idx)) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.hypot(cx - cursorX, cy - cursorY);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestIdx = idx;
      nearestPos = { x: cx, y: cy };
    }
  });

  if (nearestIdx !== null && nearestDist <= threshold) {
    return { slotIndex: nearestIdx, x: nearestPos.x, y: nearestPos.y };
  }

  return null;
}
