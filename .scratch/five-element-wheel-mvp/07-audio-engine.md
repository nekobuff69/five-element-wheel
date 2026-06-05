# Audio engine integration

**Type:** AFK
**Label:** ready-for-agent

## What to build

Integrate tone.js as the audio engine. Initialize the AudioContext on the first stone palette tap (browser autoplay policy requires a user gesture). Wire `Tone.PluckSynth` for plucked-string voices, polyphonic (notes overlap naturally). Implement `playSequence(slots, bpm, direction)` — given the queued slot indices and wind direction, map filled slots to their pentatonic notes (Earth=C4, Metal=D4, Wood=E4, Fire=G4, Water=A4), compute the timing grid from BPM, and schedule all notes on `Tone.Transport` at equal intervals spanning the spring-back duration. The spring-back CSS transition and Transport start simultaneously in the same frame. CW vs CCW direction reverses the slot play order. Implement `playTack()` — a synthesized 30ms noise burst + 800Hz sine blip, no external audio file. Audio scheduling uses `Tone.Transport` timestamps aligned with the CSS transition duration.

## Acceptance criteria

- [ ] AudioContext resumes on first stone palette tap (no sound before user interaction)
- [ ] `Tone.PluckSynth` plays the correct pentatonic notes (C D E G A) mapped to elements
- [ ] Notes are scheduled at evenly-spaced intervals matching the spring-back duration
- [ ] Polyphonic: adjacent notes overlap naturally during decay
- [ ] CW wind + CCW spring-back plays slots in forward order; CCW wind plays reverse order
- [ ] `playTack()` produces an audible mechanical click on tack state
- [ ] Empty slots produce silence (rests) at the correct timing — no note, but the beat grid is maintained
- [ ] Notes stop cleanly when COMPLETE fires; no hanging voices

## Blocked by

- #2 (Wheel state machine)
- #6 (Spring-back + tack)
