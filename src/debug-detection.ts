// Debug harness to trace slot detection during drag
import { wheelReducer, initialWheelState } from './wheelReducer';

function traceDrag(deltas: number[]) {
  let state = initialWheelState;
  console.log('Initial state:');
  console.log(`  rotation: ${state.rotation}, currentSlotAtHead: ${state.currentSlotAtHead}`);
  console.log(`  queued: [${state.queuedSlotIndices.join(', ')}]`);
  console.log('');

  for (let i = 0; i < deltas.length; i++) {
    const delta = deltas[i];
    state = wheelReducer(state, { type: 'WIND', delta });
    console.log(`After delta=${delta}° (total rotation=${state.rotation}°):`);
    console.log(`  direction: ${state.direction}`);
    console.log(`  currentSlotAtHead: ${state.currentSlotAtHead}`);
    console.log(`  queued: [${state.queuedSlotIndices.join(', ')}]`);
    console.log('');
  }

  return state;
}

// Test case 1: Slow CW drag
console.log('=== Test 1: Slow CW drag (10° increments) ===');
traceDrag([10, 10, 10, 10, 10]);

// Test case 2: Fast CW drag
console.log('=== Test 2: Fast CW drag (100° in one go) ===');
traceDrag([100]);

// Test case 3: Incremental drag crossing multiple slots
console.log('=== Test 3: Incremental drag crossing slots 9, 8, 7 ===');
traceDrag([35, 35, 35]);

// Test case 4: CCW drag
console.log('=== Test 4: Slow CCW drag (-10° increments) ===');
traceDrag([-10, -10, -10, -10, -10]);
