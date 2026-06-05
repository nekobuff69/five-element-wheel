import { useReducer } from 'react';
import { wheelReducer, initialWheelState } from './wheelReducer';
import Wheel from './Wheel';
import StonePalette from './StonePalette';
import BPMControl from './BPMControl';

function App() {
  const [state, dispatch] = useReducer(wheelReducer, initialWheelState);

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
      />
      <BPMControl
        bpm={state.bpm}
        onBPMChange={(bpm) => dispatch({ type: 'SET_BPM', bpm })}
      />
      <Wheel state={state} dispatch={dispatch} />
    </div>
  );
}

export default App;
