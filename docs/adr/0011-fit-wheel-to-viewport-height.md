# Fit the wheel to the remaining viewport height

The main screen must fit exactly within one mobile viewport with no page scrolling, because dragging the Wheel otherwise triggers a scroll and shifts the instrument under the finger. We measure the non-wheel chrome at runtime and scale the fixed 360px Wheel coordinate system into the remaining space, instead of allowing scroll or shrinking touch targets through width-only media queries. This keeps Slot geometry, angular pointer deltas, and snap detection unchanged (ADR-0002, ADR-0004, ADR-0009) at the cost of a smaller Wheel on short screens.
