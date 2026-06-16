import { useReducer, useState } from 'react';
import { wheelReducer, initialWheelState } from './wheelReducer';
import Wheel from './Wheel';
import StonePalette from './StonePalette';
import BPMControl from './BPMControl';
import LoopToggle from './LoopToggle';

function App() {
  const [state, dispatch] = useReducer(wheelReducer, initialWheelState);
  const [snapTargetSlot, setSnapTargetSlot] = useState<number | null>(null);

  return (
    <div className="app">
      <StonePalette
        selectedStone={state.selectedStone}
        onSelectStone={(el) => {
          dispatch({ type: 'SELECT_STONE', element: el });
        }}
        onClear={() => {
          dispatch({ type: 'CLEAR_ALL' });
        }}
        dispatch={dispatch}
        wheelMode={state.mode}
        onSnapTargetChange={setSnapTargetSlot}
      />
      <BPMControl
        bpm={state.bpm}
        onBPMChange={(bpm) => dispatch({ type: 'SET_BPM', bpm })}
        currentKey={state.key}
        onKeyChange={(key) => dispatch({ type: 'SET_KEY', key })}
        octave={state.octave}
        onOctaveChange={(octave) => dispatch({ type: 'SET_OCTAVE', octave })}
      />
      <LoopToggle
        loop={state.loop}
        onToggle={(loop) => dispatch({ type: 'SET_LOOP', loop })}
      />
      <Wheel state={state} dispatch={dispatch} snapTargetSlot={snapTargetSlot} />
    </div>
  );
}

export default App;
