import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import Toolbar from './components/Toolbar';
import StatCard from './components/StatCard';
import ExportModal from './components/ExportModal';
import SettingsDrawer from './components/SettingsDrawer';
import SessionSetup from './components/SessionSetup';
import PeriodSelector from './components/PeriodSelector';
import HeroStrip from './components/HeroStrip';
import TweaksPanel from './components/TweaksPanel';
import { DEFAULT_WIDGETS, DAILY_WIDGETS, resolveMetric } from './utils/metrics';

const REFRESH_MS = 5000;
const STORAGE_KEY = 'pulse_dash_v2';
const TWEAKS_KEY = 'pulse_tweaks_v2';
const HISTORY_LEN = 20;

const DEFAULT_TWEAKS = {
  theme: 'dark',
  accentHue: 260,
  density: 'cozy',
  cardStyle: 'bordered',
  showSparklines: true,
  showThresholdBars: true,
  headerCompact: false,
};

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}

function makeDefaultLayout(widgets) {
  return widgets.map(w => ({ i: w.id, ...w.defaultLayout }));
}

export default function App() {
  const saved = loadJSON(STORAGE_KEY, {});

  // ── Tweaks ──────────────────────────────────────────────────────
  const [tweaks, setTweaks] = useState(() => ({ ...DEFAULT_TWEAKS, ...loadJSON(TWEAKS_KEY, {}) }));
  useEffect(() => { localStorage.setItem(TWEAKS_KEY, JSON.stringify(tweaks)); }, [tweaks]);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = tweaks.theme;
    root.dataset.cardStyle = tweaks.cardStyle;
    root.style.setProperty('--accent-hue', String(tweaks.accentHue));
  }, [tweaks]);

  // ── Data ────────────────────────────────────────────────────────
  const [data, setData]               = useState(null);
  const [dailyData, setDailyData]     = useState(null);
  const [error, setError]             = useState(null);
  const [loading, setLoading]         = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  // ── Queues ──────────────────────────────────────────────────────
  const [queues, setQueues]               = useState([]);
  const [selectedQueue, setSelectedQueue] = useState(null);

  // ── Dashboard config ────────────────────────────────────────────
  const ALL = useMemo(() => [...DEFAULT_WIDGETS, ...DAILY_WIDGETS], []);
  const [widgets, setWidgets]               = useState(ALL);
  const [visibleWidgets, setVisibleWidgets] = useState(saved.visibleWidgets || ALL.map(w => w.id));
  const [layout, setLayout]                 = useState(saved.layout || makeDefaultLayout(ALL));

  // ── UI ──────────────────────────────────────────────────────────
  const [showExport, setShowExport]       = useState(false);
  const [showSettings, setShowSettings]   = useState(false);
  const [showTweaks, setShowTweaks]       = useState(false);
  const [editMode, setEditMode]           = useState(false);
  const [containerW, setContainerW]       = useState(() => Math.max(320, window.innerWidth - 32));
  const [sessionState, setSessionState]   = useState('unknown');
  const [dailyPeriod, setDailyPeriod]     = useState({
    startDate: new Date().toLocaleDateString('en-CA'),
    endDate:   new Date().toLocaleDateString('en-CA'),
    startTime: '00:00', endTime: '23:59',
  });
  const [dailyLoading, setDailyLoading]   = useState(false);

  const historiesRef = useRef({}); // { metricKey: number[] }
  const intervalRef  = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ visibleWidgets, layout }));
  }, [visibleWidgets, layout]);

  useEffect(() => {
    const onResize = () => setContainerW(Math.max(320, window.innerWidth - 32));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Fetch ───────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const resp = await fetch('/api/realtime');
      if (resp.status === 401) {
        const json = await resp.json();
        setSessionState(json.code === 'SESSION_NOT_CONFIGURED' ? 'missing' : 'expired');
        setLoading(false);
        return;
      }
      if (!resp.ok) throw new Error(`API error ${resp.status}`);
      const json = await resp.json();
      setSessionState('ok');
      setData(json);
      setError(null);
      setLastUpdated(new Date());

      if (json.raw && typeof json.raw === 'object') {
        const ids = Object.keys(json.raw).filter(k => typeof json.raw[k] === 'object');
        if (ids.length > 0) {
          setQueues(ids.map(id => ({ id, name: id })));
          setSelectedQueue(q => q || ids[0]);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDaily = useCallback(async (period) => {
    setDailyLoading(true);
    try {
      const p = period || dailyPeriod;
      const params = new URLSearchParams({
        startDate: p.startDate, endDate: p.endDate,
        startTime: p.startTime || '00:00', endTime: p.endTime || '23:59',
      });
      const resp = await fetch(`/api/daily?${params}`);
      if (!resp.ok) return;
      const json = await resp.json();
      if (json.stats) setDailyData(json.stats);
    } catch {}
    finally { setDailyLoading(false); }
  }, [dailyPeriod]);

  const handlePeriodChange = (p) => { setDailyPeriod(p); fetchDaily(p); };

  useEffect(() => {
    fetchData(); fetchDaily();
    intervalRef.current = setInterval(fetchData, REFRESH_MS);
    const daily = setInterval(() => fetchDaily(), 60_000);
    return () => { clearInterval(intervalRef.current); clearInterval(daily); };
  }, [fetchData, fetchDaily]);

  // ── Metrics + rolling history ───────────────────────────────────
  const getMetrics = useCallback(() => {
    if (!data?.raw) return null;
    if (data.raw.summary && typeof data.raw.summary === 'object') return data.raw.summary;
    if (selectedQueue && data.raw[selectedQueue]) return data.raw[selectedQueue];
    const first = Object.values(data.raw)[0];
    return typeof first === 'object' ? first : data.raw;
  }, [data, selectedQueue]);

  const realtimeMetrics = getMetrics();
  const metrics = { ...(realtimeMetrics || {}), ...(dailyData || {}) };

  // Push into rolling history (only live metrics, not daily)
  useEffect(() => {
    if (!realtimeMetrics) return;
    for (const [k, v] of Object.entries(realtimeMetrics)) {
      if (typeof v !== 'number') continue;
      const arr = historiesRef.current[k] || [];
      arr.push(v);
      if (arr.length > HISTORY_LEN) arr.shift();
      historiesRef.current[k] = arr;
    }
  }, [realtimeMetrics]);

  const visibleDefs = widgets.filter(w => visibleWidgets.includes(w.id));

  const fullLayout = useMemo(() => {
    const ids = new Set(layout.map(l => l.i));
    const extras = widgets.filter(w => !ids.has(w.id)).map(w => ({ i: w.id, ...w.defaultLayout }));
    return [...layout, ...extras];
  }, [layout, widgets]);

  // ── Handlers ────────────────────────────────────────────────────
  const toggleWidget = id =>
    setVisibleWidgets(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const updateLabel = (id, label) =>
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, label } : w));
  const resetLayout = () => {
    setLayout(makeDefaultLayout(ALL));
    setVisibleWidgets(ALL.map(w => w.id));
    setWidgets(ALL);
  };

  // ── Keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches('input,textarea')) return;
      if (e.key === 'e') setEditMode(v => !v);
      else if (e.key === 'r') fetchData();
      else if (e.key === 'w') setShowSettings(v => !v);
      else if (e.key === 't') setShowTweaks(v => !v);
      else if (e.key === 'Escape') {
        setShowSettings(false); setShowExport(false); setShowTweaks(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fetchData]);

  // ── Render ──────────────────────────────────────────────────────
  if (sessionState === 'missing' || sessionState === 'expired') {
    return (
      <SessionSetup
        sessionExpired={sessionState === 'expired'}
        onSave={() => { setSessionState('ok'); fetchData(); }}
      />
    );
  }

  const rowHeight = tweaks.density === 'compact' ? 80 : 96;
  const queueName = queues.find(q => (q.id || q.name) === selectedQueue)?.name || 'Queue';

  return (
    <div className="min-h-screen bg-canvas text-fg">
      <Toolbar
        lastUpdated={lastUpdated}
        loading={loading}
        error={error}
        queues={queues}
        selectedQueue={selectedQueue}
        onSelectQueue={setSelectedQueue}
        onRefresh={fetchData}
        onExport={() => setShowExport(true)}
        onSettings={() => setShowSettings(true)}
        onTweaks={() => setShowTweaks(true)}
        editMode={editMode}
        onToggleEdit={() => setEditMode(e => !e)}
        compact={tweaks.headerCompact}
      />

      <main className="p-4 max-w-screen-2xl mx-auto">
        {editMode && (
          <div className="mb-4 px-4 py-2 rounded-lg text-xs flex items-center justify-between"
               style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', color: 'var(--fg)' }}>
            <span>Drag to reorder · corner handle to resize · double-click label to rename</span>
            <button onClick={() => setEditMode(false)} className="font-medium text-accent hover:underline">Done</button>
          </div>
        )}

        {error && data && (
          <div className="mb-4 px-4 py-2 rounded-lg text-xs"
               style={{ background: 'color-mix(in oklch, red 10%, transparent)', border: '1px solid color-mix(in oklch, red 30%, transparent)', color: 'oklch(0.8 0.15 25)' }}>
            API error: {error} — showing last known data
          </div>
        )}

        {loading && !data ? (
          <div className="flex items-center justify-center h-72">
            <div className="text-center space-y-4">
              <div className="w-10 h-10 rounded-full mx-auto animate-spin"
                   style={{ border: '3px solid var(--rule)', borderTopColor: 'var(--accent)' }} />
              <p className="text-fg-quiet text-sm">Connecting…</p>
            </div>
          </div>
        ) : !data && error ? (
          <div className="flex items-center justify-center h-72">
            <div className="bg-card border border-rule rounded-2xl p-8 max-w-md text-center">
              <p className="text-fg font-semibold mb-2">Connection failed</p>
              <p className="text-fg-quiet text-sm mb-1">{error}</p>
              <p className="text-fg-faint text-xs mt-4">
                Make sure the server is running and your <code className="font-mono">.env</code> credentials are set.
              </p>
              <button onClick={fetchData}
                className="mt-5 px-5 py-2 bg-accent text-white text-sm rounded-lg">Retry</button>
            </div>
          </div>
        ) : (
          <>
            <HeroStrip
              queueName={queueName}
              metrics={realtimeMetrics}
              period={dailyData}
              history={historiesRef.current.ongoingWaitingCalls}
            />

            {/* Live grid */}
            {(() => {
              const live = visibleDefs.filter(w => !w.daily);
              const liveLayout = fullLayout.filter(l => live.some(w => w.id === l.i));
              if (!live.length) return null;
              return (
                <>
                  <div className="flex items-center gap-2 px-1 mb-3 mt-2">
                    <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: 'oklch(0.78 0.17 155)' }} />
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-fg">Live · {queueName}</span>
                    <span className="text-xs text-fg-faint">· refreshes every 5s</span>
                    {lastUpdated && <span className="text-xs text-fg-faint ml-auto font-mono">{lastUpdated.toLocaleTimeString()}</span>}
                  </div>
                  <GridLayout
                    layout={liveLayout}
                    cols={12}
                    rowHeight={rowHeight}
                    width={containerW}
                    isDraggable={editMode}
                    isResizable={editMode}
                    onLayoutChange={nl => setLayout(prev => [...prev.filter(l => !live.some(w => w.id === l.i)), ...nl])}
                    margin={[10, 10]}
                    containerPadding={[0, 0]}
                    draggableHandle=".drag-handle"
                  >
                    {live.map(widget => (
                      <div key={widget.id} className="drag-handle">
                        <StatCard
                          widget={widget}
                          value={resolveMetric(metrics, widget)}
                          history={historiesRef.current[widget.metricKey]}
                          editMode={editMode}
                          onRemove={() => toggleWidget(widget.id)}
                          onLabelChange={label => updateLabel(widget.id, label)}
                          density={tweaks.density}
                          showSparkline={tweaks.showSparklines}
                          showThreshold={tweaks.showThresholdBars}
                        />
                      </div>
                    ))}
                  </GridLayout>
                </>
              );
            })()}

            {/* Period grid */}
            {(() => {
              const period = visibleDefs.filter(w => w.daily);
              const periodLayout = fullLayout.filter(l => period.some(w => w.id === l.i));
              if (!period.length) return null;
              return (
                <div className="mt-6">
                  <PeriodSelector period={dailyPeriod} onPeriodChange={handlePeriodChange} loading={dailyLoading} />
                  <GridLayout
                    layout={periodLayout}
                    cols={12}
                    rowHeight={rowHeight}
                    width={containerW}
                    isDraggable={editMode}
                    isResizable={editMode}
                    onLayoutChange={nl => setLayout(prev => [...prev.filter(l => !period.some(w => w.id === l.i)), ...nl])}
                    margin={[10, 10]}
                    containerPadding={[0, 0]}
                    draggableHandle=".drag-handle"
                  >
                    {period.map(widget => (
                      <div key={widget.id} className="drag-handle">
                        <StatCard
                          widget={widget}
                          value={resolveMetric(metrics, widget)}
                          editMode={editMode}
                          onRemove={() => toggleWidget(widget.id)}
                          onLabelChange={label => updateLabel(widget.id, label)}
                          density={tweaks.density}
                          showSparkline={false}
                          showThreshold={tweaks.showThresholdBars}
                        />
                      </div>
                    ))}
                  </GridLayout>
                </div>
              );
            })()}
          </>
        )}
      </main>

      {showExport && (
        <ExportModal data={data} queues={queues} selectedQueue={selectedQueue} onClose={() => setShowExport(false)} />
      )}
      {showSettings && (
        <SettingsDrawer widgets={widgets} visibleWidgets={visibleWidgets} onToggle={toggleWidget} onReset={resetLayout} onClose={() => setShowSettings(false)} />
      )}
      {showTweaks && (
        <TweaksPanel tweaks={tweaks} setTweaks={setTweaks} onClose={() => setShowTweaks(false)} />
      )}
    </div>
  );
}
