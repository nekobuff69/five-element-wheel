interface BPMControlProps {
  bpm: number;
  onBPMChange: (bpm: number) => void;
}

export default function BPMControl({ bpm, onBPMChange }: BPMControlProps) {
  return (
    <div className="bpm-control">
      <span className="bpm-control__label">C Pentatonic</span>
      <input
        type="range"
        className="bpm-control__slider"
        min={60}
        max={180}
        step={1}
        value={bpm}
        onChange={(e) => onBPMChange(Number(e.target.value))}
      />
      <span className="bpm-control__readout">{bpm} BPM</span>
    </div>
  );
}
