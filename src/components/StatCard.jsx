import { useState } from 'react';
import * as Icons from 'lucide-react';
import { formatValue, getThresholdStatus } from '../utils/metrics';
import Sparkline from './Sparkline';
import ThresholdBar from './ThresholdBar';

// Status → color overrides. Neutral by default; status colors reserved for warn/critical.
const STATUS = {
  warn:     { rim: 'rgba(245, 158, 11, 0.35)', fg: 'oklch(0.82 0.14 70)',  tag: 'WARN' },
  critical: { rim: 'rgba(239, 68, 68, 0.5)',   fg: 'oklch(0.72 0.2 25)',   tag: 'CRIT' },
};

export default function StatCard({
  widget, value, history, editMode, onRemove, onLabelChange,
  density = 'cozy', showSparkline = true, showThreshold = true,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(widget.label);

  const Icon = Icons[widget.icon] || Icons.Activity;
  const status = getThresholdStatus(value, widget.thresholds);
  const s = STATUS[status];
  const hasValue = value !== null && value !== undefined;

  const pad = density === 'compact' ? 'p-3' : 'p-4';
  const numClass = density === 'compact' ? 'text-[26px]' : 'text-[32px]';

  const commitLabel = () => {
    setEditing(false);
    if (draft.trim()) onLabelChange(draft.trim()); else setDraft(widget.label);
  };

  return (
    <div
      className={`relative h-full rounded-lg border bg-card ${pad} flex flex-col gap-2 overflow-hidden select-none transition-colors`}
      style={{ borderColor: s ? s.rim : 'var(--rule)' }}
    >
      {/* Status tag */}
      {s && (
        <span className="absolute top-2.5 right-2.5 z-[2] font-mono text-[9px] tracking-wider px-1.5 py-px rounded"
              style={{ color: s.fg, border: `1px solid ${s.rim}`, background: 'rgba(0,0,0,0.2)' }}>
          {s.tag}
        </span>
      )}

      {/* Remove */}
      {editMode && (
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onRemove(); }}
          className="absolute top-2 right-2 z-[3] w-4 h-4 rounded bg-raised border border-rule text-fg-quiet grid place-items-center"
        >
          <Icons.X size={9} />
        </button>
      )}

      {/* Label row */}
      <div className="flex items-center gap-1.5 min-h-[16px]">
        <Icon size={12} className="flex-shrink-0" style={{ color: s ? s.fg : 'var(--fg-quiet)' }} />
        {editing ? (
          <input
            autoFocus value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={e => {
              if (e.key === 'Enter') commitLabel();
              if (e.key === 'Escape') { setEditing(false); setDraft(widget.label); }
            }}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            className="flex-1 bg-transparent outline-none text-xs text-fg border-b"
            style={{ borderColor: 'var(--accent)' }}
          />
        ) : (
          <span
            onDoubleClick={() => { if (editMode) setEditing(true); }}
            className="flex-1 truncate text-[11px] font-medium uppercase tracking-wide text-fg-quiet"
            title={editMode ? 'Double-click to rename' : widget.description}
          >
            {widget.label}
          </span>
        )}
      </div>

      {/* Value + sparkline */}
      <div className="flex items-end justify-between gap-2 flex-1 min-h-0">
        <span
          className={`${numClass} font-mono-num font-medium leading-none whitespace-nowrap`}
          style={{ color: !hasValue ? 'var(--fg-faint)' : s ? s.fg : 'var(--fg)' }}
        >
          {formatValue(value, widget.format)}
        </span>
        {showSparkline && history && history.length > 2 && (
          <Sparkline
            data={history}
            width={density === 'compact' ? 50 : 64}
            height={density === 'compact' ? 18 : 22}
            color={s ? s.fg : 'var(--accent)'}
          />
        )}
      </div>

      {/* Threshold bar */}
      {showThreshold && widget.thresholds && hasValue && (
        <ThresholdBar value={value} thresholds={widget.thresholds} color={s ? s.fg : 'var(--accent)'} />
      )}

      {editMode && (
        <p className="absolute bottom-1.5 left-3 right-3 font-mono text-[9px] text-fg-faint truncate border-t border-rule-faint pt-1"
           title={widget.metricKey}>
          {widget.metricKey}
        </p>
      )}
    </div>
  );
}
