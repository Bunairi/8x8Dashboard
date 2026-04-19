import { X } from 'lucide-react';

export default function TweaksPanel({ tweaks, setTweaks, onClose }) {
  const set = (k, v) => setTweaks(prev => ({ ...prev, [k]: v }));

  return (
    <div className="fixed right-4 bottom-4 w-[280px] z-[60] bg-surface border border-rule-strong rounded-xl shadow-2xl overflow-hidden fade-in">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-rule">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-fg">Tweaks</span>
        <span className="text-[10px] text-fg-faint ml-1">Press T to toggle</span>
        <div className="flex-1" />
        <button onClick={onClose} className="text-fg-quiet hover:text-fg p-1"><X size={12} /></button>
      </div>
      <div className="p-3.5 flex flex-col gap-3.5 max-h-[70vh] overflow-auto">
        <Row label="Theme">
          <Seg value={tweaks.theme} onChange={v => set('theme', v)}
               options={[{v:'dark',l:'Dark'},{v:'light',l:'Light'}]} />
        </Row>
        <Row label="Density">
          <Seg value={tweaks.density} onChange={v => set('density', v)}
               options={[{v:'cozy',l:'Cozy'},{v:'compact',l:'Compact'}]} />
        </Row>
        <Row label="Card style">
          <Seg value={tweaks.cardStyle} onChange={v => set('cardStyle', v)}
               options={[{v:'bordered',l:'Bordered'},{v:'filled',l:'Filled'},{v:'ghost',l:'Ghost'}]} />
        </Row>
        <Row label={`Accent · ${Math.round(tweaks.accentHue)}°`}>
          <div className="flex gap-1.5">
            {[260, 220, 180, 155, 90, 30, 0, 320].map(h => {
              const active = Math.abs(tweaks.accentHue - h) < 5;
              return (
                <button key={h} onClick={() => set('accentHue', h)}
                  className="w-5 h-5 rounded-full border-0 cursor-pointer"
                  style={{
                    background: `oklch(0.68 0.2 ${h})`,
                    boxShadow: active ? '0 0 0 2px var(--fg)' : 'none',
                  }} />
              );
            })}
          </div>
          <input type="range" min="0" max="360" step="1" value={tweaks.accentHue}
                 onChange={e => set('accentHue', Number(e.target.value))}
                 className="w-full mt-1.5" style={{ accentColor: 'var(--accent)' }} />
        </Row>
        <InlineToggle label="Sparklines on cards" on={tweaks.showSparklines} onToggle={() => set('showSparklines', !tweaks.showSparklines)} />
        <InlineToggle label="Threshold bars" on={tweaks.showThresholdBars} onToggle={() => set('showThresholdBars', !tweaks.showThresholdBars)} />
        <InlineToggle label="Compact header" on={tweaks.headerCompact} onToggle={() => set('headerCompact', !tweaks.headerCompact)} />
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wide text-fg-faint">{label}</span>
      {children}
    </div>
  );
}

function Seg({ options, value, onChange }) {
  return (
    <div className="inline-flex bg-raised border border-rule rounded-md p-0.5 w-full">
      {options.map(o => {
        const active = o.v === value;
        return (
          <button key={o.v} onClick={() => onChange(o.v)}
            className={`flex-1 px-2 py-1 rounded text-[11px] transition-colors ${active ? 'bg-card text-fg font-semibold' : 'text-fg-quiet hover:text-fg'}`}>
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

function InlineToggle({ label, on, onToggle }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-fg">{label}</span>
      <button onClick={onToggle}
        className="relative w-7 h-4 rounded-full border border-rule transition-colors"
        style={{ background: on ? 'var(--accent)' : 'var(--bg-raised)' }}>
        <span className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
              style={{ left: on ? 13 : 2, background: on ? 'white' : 'var(--fg-quiet)' }} />
      </button>
    </div>
  );
}
