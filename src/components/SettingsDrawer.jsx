import { X, RotateCcw, Eye, EyeOff } from 'lucide-react';
import * as Icons from 'lucide-react';

export default function SettingsDrawer({ widgets, visibleWidgets, onToggle, onReset, onClose }) {
  const live = widgets.filter(w => !w.daily);
  const period = widgets.filter(w => w.daily);
  const visibleCount = visibleWidgets.length;

  return (
    <div className="fixed inset-0 z-50 flex fade-in">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[340px] bg-surface border-l border-rule flex flex-col h-full shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-rule">
          <div>
            <h2 className="text-fg font-semibold text-[13px]">Widgets</h2>
            <p className="text-fg-faint text-[11px] mt-0.5">{visibleCount} of {widgets.length} visible</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-fg-quiet hover:text-fg hover:bg-raised rounded-md">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <Group title="Live Metrics">
            {live.map(w => <Row key={w.id} widget={w} visible={visibleWidgets.includes(w.id)} onToggle={() => onToggle(w.id)} />)}
          </Group>
          <Group title="Period Metrics">
            {period.map(w => <Row key={w.id} widget={w} visible={visibleWidgets.includes(w.id)} onToggle={() => onToggle(w.id)} />)}
          </Group>
        </div>

        <div className="p-3 border-t border-rule">
          <button onClick={() => { onReset(); onClose(); }}
            className="w-full flex items-center justify-center gap-2 text-xs text-fg-quiet hover:text-fg hover:bg-raised py-2 rounded-md transition-colors">
            <RotateCcw size={12} />Reset layout &amp; restore all
          </button>
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }) {
  return (
    <div className="mb-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-fg-faint mb-1.5 px-1">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ widget, visible, onToggle }) {
  const Icon = Icons[widget.icon] || Icons.Activity;
  return (
    <div
      className="flex items-center gap-3 p-2 rounded-md border transition-all"
      style={{
        background: visible ? 'var(--bg-raised)' : 'transparent',
        borderColor: visible ? 'var(--rule)' : 'transparent',
        opacity: visible ? 1 : 0.5,
      }}
    >
      <div className="w-7 h-7 rounded-md bg-card border border-rule grid place-items-center flex-shrink-0">
        <Icon size={13} className="text-fg-quiet" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-fg font-medium truncate">{widget.label}</p>
        <p className="font-mono text-[10px] text-fg-faint truncate mt-px">{widget.metricKey}</p>
      </div>
      <button
        onClick={onToggle}
        className="p-1.5 rounded-md transition-colors flex-shrink-0 hover:bg-card"
        style={{ color: visible ? 'var(--accent)' : 'var(--fg-faint)' }}
        title={visible ? 'Hide' : 'Show'}
      >
        {visible ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>
    </div>
  );
}
