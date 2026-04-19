import { useEffect, useState, useMemo } from 'react';
import { Activity, Users, Phone } from 'lucide-react';
import Sparkline from './Sparkline';

// Top-of-dashboard hero: SLA%, agent state breakdown, queue-depth sparkline.
export default function HeroStrip({ queueName, metrics, period, history }) {
  if (!metrics) return null;

  const total = metrics.ongoingTotalAgents || 0;
  const available = metrics.ongoingAvailableAgents || 0;
  const onCall = metrics.ongoingHandlingCalls || 0;
  const other = Math.max(0, total - available - onCall);

  const totalCalls = period?.totalCallsToday || 0;
  const missed = period?.missedToday || 0;
  const abandoned = period?.abandonedToday || 0;
  const answered = period?.answeredToday || 0;

  const sla = totalCalls > 0 ? Math.round(((totalCalls - missed - abandoned) / totalCalls) * 100) : null;
  const slaColor = sla === null ? 'var(--fg-faint)'
    : sla >= 90 ? 'oklch(0.78 0.17 155)'
    : sla >= 75 ? 'oklch(0.82 0.14 70)'
    : 'oklch(0.72 0.2 25)';

  // 30-point rolling queue-depth series from history; pad with zeros.
  const series = useMemo(() => {
    const h = history || [];
    return h.length ? h : [0, 0];
  }, [history]);

  const peak = Math.max(...series, 0);

  return (
    <div className="grid gap-2.5 mb-3.5"
         style={{ gridTemplateColumns: 'minmax(240px, 1fr) minmax(260px, 1.2fr) minmax(280px, 2fr)' }}>
      {/* SLA */}
      <div className="rounded-lg border border-rule bg-card p-4 flex flex-col justify-between overflow-hidden">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: slaColor }} />
          <span className="text-[11px] tracking-wide uppercase text-fg-quiet">Service Level · Today</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono-num font-medium leading-none text-[42px]" style={{ color: slaColor }}>
            {sla === null ? '—' : sla}
          </span>
          {sla !== null && <span className="font-mono text-[18px] text-fg-quiet">%</span>}
          {totalCalls > 0 && (
            <span className="ml-2 text-[11px] text-fg-faint">
              {answered.toLocaleString()}/{totalCalls.toLocaleString()} answered
            </span>
          )}
        </div>
        <div className="h-1 rounded bg-raised overflow-hidden mt-2">
          <div className="h-full transition-all duration-500"
               style={{ width: `${sla ?? 0}%`, background: slaColor }} />
        </div>
      </div>

      {/* Agents */}
      <div className="rounded-lg border border-rule bg-card p-4">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Users size={12} className="text-fg-quiet" />
          <span className="text-[11px] tracking-wide uppercase text-fg-quiet">Agents · {total} logged in</span>
        </div>
        <div className="flex gap-[2px] h-2 rounded overflow-hidden mb-2.5">
          <div style={{ flex: available || 0.01, background: 'oklch(0.78 0.17 155)' }} title={`${available} available`} />
          <div style={{ flex: onCall || 0.01,    background: 'var(--accent)' }} title={`${onCall} on call`} />
          <div style={{ flex: other || 0.01,     background: 'var(--rule-strong)' }} title={`${other} wrap/break`} />
        </div>
        <div className="flex gap-4 text-[11px]">
          <Legend dot="oklch(0.78 0.17 155)" label="Available" value={available} />
          <Legend dot="var(--accent)" label="On call" value={onCall} />
          <Legend dot="var(--fg-faint)" label="Other" value={other} />
        </div>
      </div>

      {/* Queue depth timeline */}
      <div className="rounded-lg border border-rule bg-card px-4 py-3 flex flex-col">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Activity size={12} className="text-fg-quiet" />
            <span className="text-[11px] tracking-wide uppercase text-fg-quiet">Queue Depth · Rolling</span>
          </div>
          <span className="font-mono text-[11px] text-fg-quiet">peak {peak}</span>
        </div>
        <div className="flex-1 min-h-[50px]">
          <Sparkline data={series} width={520} height={50} color="var(--accent)" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}

function Legend({ dot, label, value }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
      <span className="text-fg-quiet">{label}</span>
      <span className="font-mono-num font-medium text-fg">{value}</span>
    </span>
  );
}
