import { useState } from 'react';
import { Calendar, ChevronDown, Clock, RefreshCw } from 'lucide-react';

function localDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString('en-CA');
}
function startOfWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toLocaleDateString('en-CA');
}
function startOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

const PRESETS = [
  { label: 'Today',      range: () => ({ start: localDate(0),   end: localDate(0) }) },
  { label: 'Yesterday',  range: () => ({ start: localDate(-1),  end: localDate(-1) }) },
  { label: 'This Week',  range: () => ({ start: startOfWeek(),  end: localDate(0) }) },
  { label: 'This Month', range: () => ({ start: startOfMonth(), end: localDate(0) }) },
];

export default function PeriodSelector({ period, onPeriodChange, loading }) {
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState(localDate(-7));
  const [customEnd, setCustomEnd]     = useState(localDate(0));

  const startTime = period.startTime || '00:00';
  const endTime   = period.endTime   || '23:59';
  const isFullDay = startTime === '00:00' && endTime === '23:59';

  const activeLabel = PRESETS.find(p => {
    const r = p.range();
    return r.start === period.startDate && r.end === period.endDate;
  })?.label || 'Custom';

  const applyPreset = (p) => {
    const r = p.range();
    setShowCustom(false);
    onPeriodChange({ startDate: r.start, endDate: r.end, startTime, endTime });
  };
  const applyCustom = () => {
    if (customStart && customEnd && customStart <= customEnd) {
      setShowCustom(false);
      onPeriodChange({ startDate: customStart, endDate: customEnd, startTime, endTime });
    }
  };
  const applyTime = (field, value) => onPeriodChange({ ...period, [field]: value });

  return (
    <div className="mb-3 space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-fg">Period</span>
          <span className="text-xs text-fg-faint truncate">
            {period.startDate === period.endDate ? period.startDate : `${period.startDate} → ${period.endDate}`}
            {!isFullDay && <span className="ml-1 text-accent">{startTime}–{endTime}</span>}
          </span>
          {loading && <RefreshCw size={11} className="text-fg-faint animate-spin" />}
        </div>

        <div className="inline-flex bg-raised border border-rule rounded-md p-0.5 gap-0.5">
          {PRESETS.map(p => {
            const active = activeLabel === p.label;
            return (
              <button key={p.label} onClick={() => applyPreset(p)}
                className={`px-2.5 py-1 rounded text-[11px] ${active ? 'bg-card text-fg font-semibold' : 'text-fg-quiet hover:text-fg'}`}>
                {p.label}
              </button>
            );
          })}
          <div className="relative">
            <button onClick={() => setShowCustom(o => !o)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] ${activeLabel === 'Custom' ? 'bg-card text-fg font-semibold' : 'text-fg-quiet hover:text-fg'}`}>
              Custom <ChevronDown size={10} />
            </button>
            {showCustom && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowCustom(false)} />
                <div className="absolute right-0 top-full mt-1.5 z-20 bg-surface border border-rule rounded-lg p-3 shadow-2xl w-64">
                  <p className="text-[10px] font-mono uppercase tracking-wide text-fg-faint mb-2">Custom range</p>
                  {[{l:'From', v:customStart, set:setCustomStart}, {l:'To', v:customEnd, set:setCustomEnd}].map(({l,v,set}) => (
                    <div key={l} className="mb-2">
                      <label className="text-[10px] text-fg-faint mb-1 block">{l}</label>
                      <input type="date" value={v} max={localDate(0)}
                        onChange={e => set(e.target.value)}
                        className="w-full bg-raised border border-rule text-fg text-[11px] rounded-md px-2 py-1.5 outline-none focus:border-accent" />
                    </div>
                  ))}
                  <button onClick={applyCustom}
                    disabled={!customStart || !customEnd || customStart > customEnd}
                    className="mt-1 w-full bg-accent text-white text-[11px] py-1.5 rounded-md disabled:opacity-40">
                    Apply
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Clock size={12} className="text-fg-faint" />
        <span className="text-[11px] text-fg-faint">Time</span>
        <input type="time" value={startTime}
          onChange={e => applyTime('startTime', e.target.value)}
          className="bg-raised border border-rule text-fg text-[11px] rounded-md px-2 py-1 outline-none focus:border-accent w-24" />
        <span className="text-fg-faint text-[11px]">to</span>
        <input type="time" value={endTime}
          onChange={e => applyTime('endTime', e.target.value)}
          className="bg-raised border border-rule text-fg text-[11px] rounded-md px-2 py-1 outline-none focus:border-accent w-24" />
        {!isFullDay && (
          <button onClick={() => onPeriodChange({ ...period, startTime: '00:00', endTime: '23:59' })}
            className="text-[11px] text-fg-faint hover:text-fg px-1.5">Reset</button>
        )}
      </div>
    </div>
  );
}
