interface LoopToggleProps {
  loop: boolean;
  onToggle: (loop: boolean) => void;
}

export default function LoopToggle({ loop, onToggle }: LoopToggleProps) {
  return (
    <label className="bpm-control">
      <span className="bpm-control__label">Loop</span>
      <input
        type="checkbox"
        className="bpm-control__slider"
        checked={loop}
        onChange={(e) => onToggle(e.target.checked)}
      />
    </label>
  );
}
