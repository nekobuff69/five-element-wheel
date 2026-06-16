import { KEY_NAMES } from './types';

interface BPMControlProps {
  bpm: number;
  onBPMChange: (bpm: number) => void;
  key: string;
  onKeyChange: (key: string) => void;
  octave: number;
  onOctaveChange: (octave: number) => void;
}

const OCTAVE_OPTIONS = [-2, -1, 0, 1, 2] as const;

export default function BPMControl({ bpm, onBPMChange, key: currentKey, onKeyChange, octave, onOctaveChange }: BPMControlProps) {
  return (
    <div className="bpm-control">
      <label className="bpm-control__item">
        <span className="bpm-control__label">Key</span>
        <select
          className="bpm-control__select"
          value={currentKey}
          onChange={(e) => onKeyChange(e.target.value)}
        >
          {KEY_NAMES.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>

      <label className="bpm-control__item">
        <span className="bpm-control__label">Oct</span>
        <select
          className={`bpm-control__select bpm-control__octave bpm-control__octave--${octave >= 0 ? 'pos' : 'neg'}`}
          value={octave}
          onChange={(e) => onOctaveChange(Number(e.target.value))}
        >
          {OCTAVE_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o >= 0 ? `+${o}` : `${o}`}
            </option>
          ))}
        </select>
      </label>

      <label className="bpm-control__item">
        <span className="bpm-control__label">BPM</span>
        <input
          type="range"
          className="bpm-control__slider"
          min={60}
          max={180}
          step={1}
          value={bpm}
          onChange={(e) => onBPMChange(Number(e.target.value))}
        />
        <span className="bpm-control__readout">{bpm}</span>
      </label>
    </div>
  );
}
