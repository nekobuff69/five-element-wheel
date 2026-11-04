interface LoopToggleProps {
  loop: boolean;
  onToggle: (loop: boolean) => void;
}

export default function LoopToggle({ loop, onToggle }: LoopToggleProps) {
  return (
    <label className="bpm-control ink-switch">
      <span className="bpm-control__label">周而復始</span>
      <input
        type="checkbox"
        className="ink-switch__input"
        checked={loop}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <span className="ink-switch__mark" aria-hidden="true" />
    </label>
  );
}
