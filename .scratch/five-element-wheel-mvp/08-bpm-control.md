# BPM control + root note display

**Type:** AFK
**Label:** ready-for-agent

## What to build

Add a BPM range slider (60–180, default 100, step 1) and a root note display label ("C Pentatonic") beside it. The slider dispatches SET_BPM to the reducer. Changing BPM updates the spring-back transition duration and the Transport scheduling interval (via issue #7's audio engine). The readout shows the current BPM value. The root note label is static text ("C Pentatonic") positioned next to the slider. Both controls sit in a compact bar below the stone palette or in an appropriate location that doesn't crowd the wheel.

## Acceptance criteria

- [ ] Range slider renders with min 60, max 180, default 100, step 1
- [ ] Slider dispatches SET_BPM to reducer on change
- [ ] Changing BPM changes the spring-back duration proportionally (higher BPM = faster spring-back)
- [ ] Changing BPM changes Transport note scheduling interval proportionally
- [ ] BPM readout shows current value next to the slider
- [ ] "C Pentatonic" label displays beside the BPM control

## Blocked by

- #7 (Audio engine integration)
