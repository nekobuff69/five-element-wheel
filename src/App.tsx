import { useReducer, useRef, useState } from 'react';
import { wheelReducer, initialWheelState } from './wheelReducer';
import Wheel from './Wheel';
import StonePalette from './StonePalette';
import BPMControl from './BPMControl';
import LoopToggle from './LoopToggle';
import { useFitWheel } from './useFitWheel';

const GUIDE_LINES = [
  '從頂部拖動五行石，置入輪盤外圍的圓形插槽，十個空位任意選擇。',
  '撥動輪盤，順時針或逆時針轉一圈，聽見卡榫「噠」提示聲時鬆開手指',
  '輪盤轉動，錄入五行音符，旋律循環播放。',
  '播放中可隨時改變旋律，例如，將五行石拖到插槽外，將輪盤朝反方向轉動等等。',
  '主界面下方調、八度和拍速可調',
  '循環可開關',
  '請大膽嘗試，玩不壞。',
];

function App() {
  const [state, dispatch] = useReducer(wheelReducer, initialWheelState);
  const [snapTargetSlot, setSnapTargetSlot] = useState<number | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const appRef = useRef<HTMLDivElement>(null);
  useFitWheel(appRef);

  return (
    <div className="app" ref={appRef}>
      <header className="ink-header">
        <h1 className="ink-title">五行輪</h1>
        <div className="ink-header__rule" />
        <button
          type="button"
          className="guide-trigger"
          aria-label="玩法"
          title="玩法"
          onClick={() => setGuideOpen(true)}
        >
          ？
        </button>
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

      {guideOpen && (
        <div
          className="guide-overlay"
          onClick={() => setGuideOpen(false)}
          role="presentation"
        >
          <div
            className="guide-card"
            role="dialog"
            aria-modal="true"
            aria-label="玩法"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="guide-card__head">
              <span>玩法</span>
              <button
                type="button"
                className="guide-card__close"
                aria-label="关闭"
                onClick={() => setGuideOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="guide-card__body">
              <ul className="guide-card__list">
                {GUIDE_LINES.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
