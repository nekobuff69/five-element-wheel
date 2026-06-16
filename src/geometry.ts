import { SLOT_START_ANGLE, SLOT_ANGLE_SPAN } from './types';

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
