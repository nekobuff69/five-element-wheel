import { KEY_NAMES } from './types';

interface BPMControlProps {
  bpm: number;
  onBPMChange: (bpm: number) => void;
  currentKey: string;
  onKeyChange: (key: string) => void;
  octave: number;
  onOctaveChange: (octave: number) => void;
}

const OCTAVE_OPTIONS = [3, 4, 5, 6, 7, 8] as const;

export default function BPMControl({
  bpm,
  onBPMChange,
  currentKey,
  onKeyChange,
  octave,
  onOctaveChange,
}: BPMControlProps) {
  return (
    <div className="bpm-control">
      <label className="bpm-control__item">
        <span className="bpm-control__label">調</span>
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
        <span className="bpm-control__label">均</span>
        <select
          className="bpm-control__select bpm-control__octave"
          value={octave}
          onChange={(e) => onOctaveChange(Number(e.target.value))}
        >
          {OCTAVE_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>

      <label className="bpm-control__item">
        <span className="bpm-control__label">拍速</span>
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
