// Thin horizontal threshold indicator — value progress + warn/critical tick marks.
export default function ThresholdBar({ value, thresholds, color = 'currentColor' }) {
  if (!thresholds || value === null || value === undefined) return null;
  const { warn, critical } = thresholds;
  const max = critical * 1.3;
  const pct = Math.min(100, (Number(value) / max) * 100);
  const warnPct = (warn / max) * 100;
  const critPct = (critical / max) * 100;
  return (
    <div className="relative h-[3px] rounded-[2px] overflow-hidden" style={{ background: 'var(--rule-faint)' }}>
      <div className="absolute left-0 top-0 bottom-0 rounded-[2px] transition-[width] duration-500"
           style={{ width: `${pct}%`, background: color }} />
      <div className="absolute top-0 bottom-0 w-px" style={{ left: `${warnPct}%`, background: 'var(--fg-faint)', opacity: 0.5 }} />
      <div className="absolute top-0 bottom-0 w-px" style={{ left: `${critPct}%`, background: 'var(--fg-quiet)', opacity: 0.6 }} />
    </div>
  );
}
