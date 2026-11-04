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
      <header className="ink-header">
        <div className="ink-header__rule" />
        <h1 className="ink-title">五行輪</h1>
        <p className="ink-subtitle">宮商角徵羽 · 十巢 · 一轉一還</p>
      </header>

      <StonePalette
        selectedStone={state.selectedStone}
        onSelectStone={(el) => {
          dispatch({ type: 'SELECT_STONE', element: el });
        }}
        onClear={() => {
          dispatch({ type: 'RESET' });
        }}
        dispatch={dispatch}
        wheelMode={state.mode}
        onSnapTargetChange={setSnapTargetSlot}
      />

      <Wheel state={state} dispatch={dispatch} snapTargetSlot={snapTargetSlot} />

      <div className="ink-inscription">
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
      </div>

      <aside className="ink-marginalia">
        <p>點同色石可去 · 拖出盤外亦去</p>
        <p>轉滿一週有卡榫聲 · 順逆異序</p>
        <p>奏時欲改，須轉過十五度</p>
      </aside>
    </div>
  );
}

export default App;
