import { useState } from 'react';
import { RefreshCw, Download, Settings, Edit3, Sliders, ChevronDown } from 'lucide-react';

export default function Toolbar({
  lastUpdated, loading, error, queues, selectedQueue,
  onSelectQueue, onRefresh, onExport, onSettings, onTweaks,
  editMode, onToggleEdit, compact,
}) {
  const [queueOpen, setQueueOpen] = useState(false);
  const selectedName = queues.find(q => (q.id || q.name) === selectedQueue)?.name || 'All Queues';
  const ago = lastUpdated ? Math.max(0, Math.floor((Date.now() - lastUpdated.getTime()) / 1000)) : null;

  return (
    <header
      className={`sticky top-0 z-50 bg-surface border-b border-rule backdrop-blur-md ${compact ? 'py-2 px-5' : 'py-3 px-6'}`}
    >
      <div className="flex items-center gap-4 max-w-screen-2xl mx-auto flex-wrap">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md grid place-items-center"
               style={{ background: 'linear-gradient(135deg, var(--accent), color-mix(in oklch, var(--accent) 60%, black))',
                        boxShadow: '0 0 0 1px var(--rule)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7 L5 10 L8 4 L11 8" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="leading-none">
            <div className="text-[13px] font-semibold text-fg">Pulse</div>
            <div className="text-[9px] tracking-[1px] uppercase text-fg-faint mt-0.5">Queue Ops</div>
          </div>
        </div>

        <div className="w-px h-5 bg-rule" />

        {/* Queue switcher */}
        {queues.length > 0 && queues.length <= 6 ? (
          <div className="inline-flex bg-raised border border-rule rounded-md p-0.5 gap-0.5">
            {queues.map(q => {
              const id = q.id || q.name;
              const active = id === selectedQueue;
              return (
                <button key={id} onClick={() => onSelectQueue(id)}
                  className={`px-3 py-1 rounded text-xs whitespace-nowrap transition-colors flex items-center gap-1.5 ${active ? 'bg-card text-fg font-semibold' : 'text-fg-quiet hover:text-fg'}`}
                  style={active ? { boxShadow: '0 0 0 1px var(--rule)' } : undefined}
                >
                  <span className="w-1.5 h-1.5 rounded-full"
                        style={{ background: active ? 'var(--accent)' : 'var(--fg-faint)',
                                 boxShadow: active ? '0 0 6px var(--accent)' : 'none' }} />
                  {q.name}
                </button>
              );
            })}
          </div>
        ) : queues.length > 0 ? (
          <div className="relative">
            <button onClick={() => setQueueOpen(o => !o)}
              className="flex items-center gap-2 bg-raised border border-rule hover:border-rule-strong rounded-md text-xs text-fg px-3 py-1.5">
              <span className="truncate max-w-[160px]">{selectedName}</span>
              <ChevronDown size={12} className="text-fg-quiet" />
            </button>
            {queueOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setQueueOpen(false)} />
                <div className="absolute top-full left-0 mt-1 bg-surface border border-rule rounded-lg shadow-2xl py-1 min-w-[200px] z-20">
                  {queues.map(q => {
                    const id = q.id || q.name;
                    return (
                      <button key={id}
                        onClick={() => { onSelectQueue(id); setQueueOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-xs transition-colors ${id === selectedQueue ? 'text-accent bg-raised' : 'text-fg hover:bg-raised'}`}>
                        {q.name}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ) : null}

        <div className="flex-1" />

        {/* Live status pill */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-raised border border-rule font-mono text-[11px] text-fg-quiet">
          <span className="w-1.5 h-1.5 rounded-full pulse-dot"
                style={{ background: error ? 'oklch(0.72 0.2 25)' : 'oklch(0.78 0.17 155)',
                         boxShadow: error ? '0 0 6px oklch(0.72 0.2 25)' : '0 0 6px oklch(0.78 0.17 155)' }} />
          <span>{error ? 'ERROR' : 'LIVE'}</span>
          <span className="opacity-40">·</span>
          <span>{ago === null ? '—' : `${ago}s ago`}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <IconBtn onClick={onRefresh} title="Refresh (R)"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /></IconBtn>
          <IconBtn onClick={onToggleEdit} title="Edit (E)" active={editMode}><Edit3 size={13} /></IconBtn>
          <IconBtn onClick={onSettings} title="Widgets (W)"><Settings size={13} /></IconBtn>
          <IconBtn onClick={onTweaks} title="Tweaks (T)"><Sliders size={13} /></IconBtn>
          <button onClick={onExport}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-raised border border-rule text-xs text-fg hover:border-rule-strong">
            <Download size={12} /><span>Export</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function IconBtn({ children, active, onClick, title }) {
  return (
    <button
      onClick={onClick} title={title}
      className="grid place-items-center w-[30px] h-[30px] rounded-md border transition-colors"
      style={{
        background: active ? 'color-mix(in oklch, var(--accent) 15%, var(--bg-raised))' : 'var(--bg-raised)',
        borderColor: active ? 'var(--accent)' : 'var(--rule)',
        color: active ? 'var(--accent)' : 'var(--fg)',
      }}
    >
      {children}
    </button>
  );
}
