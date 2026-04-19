import { useState } from 'react';
import { X, Download, Calendar, Loader2, FileText, History } from 'lucide-react';
import { flattenObject, rowsToCSV, downloadCSV } from '../utils/export';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExportModal({ data, queues, selectedQueue, onClose }) {
  const [mode, setMode] = useState('live');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleLiveExport = () => {
    if (!data) return;
    const queueList = data.queues?.data || (Array.isArray(data.queues) ? data.queues : []);
    if (queueList.length === 0) { setExportError('No queue data available to export.'); return; }

    const rows = queueList.map(q => ({
      queue_name: q.name || '',
      queue_id: q.id || '',
      exported_at: new Date().toISOString(),
      ...flattenObject(q.metrics || q),
    }));

    const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
    downloadCSV(rowsToCSV(rows), `8x8_live_${ts}.csv`);
    setExportSuccess(true);
    setTimeout(onClose, 1200);
  };

  const handleHistoricalExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      if (selectedQueue) params.set('queueId', selectedQueue);

      const resp = await fetch(`/api/historical?${params}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || `HTTP ${resp.status}`);

      const list = json.data || json.queues?.data || (Array.isArray(json) ? json : [json]);
      const rows = list.map(item => ({
        exported_at: new Date().toISOString(),
        ...flattenObject(item),
      }));

      downloadCSV(rowsToCSV(rows), `8x8_historical_${startDate}_to_${endDate}.csv`);
      setExportSuccess(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700/80 rounded-2xl w-full max-w-md shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-white font-semibold">Export Data</h2>
            <p className="text-gray-500 text-xs mt-0.5">Download metrics as CSV</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Mode toggle */}
          <div className="flex rounded-xl bg-gray-800 p-1 gap-1">
            {[
              { id: 'live',       label: 'Current Snapshot', Icon: FileText },
              { id: 'historical', label: 'Historical Range',  Icon: History  },
            ].map(({ id, label, Icon: Ic }) => (
              <button
                key={id}
                onClick={() => { setMode(id); setExportError(null); setExportSuccess(false); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg transition-colors font-medium ${
                  mode === id ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Ic size={13} />
                {label}
              </button>
            ))}
          </div>

          {/* Mode content */}
          {mode === 'live' ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Exports all queue metrics from the <strong className="text-gray-200">current live snapshot</strong> as a single CSV row per queue.
              </p>
              {selectedQueue && (
                <p className="text-xs text-gray-500">
                  Exporting all queues (not just the selected one).
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Pulls <strong className="text-gray-200">historical data</strong> from 8x8 API for the selected date range.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Start Date', val: startDate, set: setStartDate },
                  { label: 'End Date',   val: endDate,   set: setEndDate   },
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <label className="text-xs text-gray-500 mb-1.5 block">{label}</label>
                    <div className="relative">
                      <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                      <input
                        type="date"
                        value={val}
                        max={today()}
                        onChange={e => set(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl pl-8 pr-3 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feedback */}
          {exportError && (
            <div className="text-xs text-red-300 bg-red-900/20 border border-red-500/20 rounded-xl p-3">
              {exportError}
            </div>
          )}
          {exportSuccess && (
            <div className="text-xs text-green-300 bg-green-900/20 border border-green-500/20 rounded-xl p-3">
              Download started!
            </div>
          )}

          {/* Action */}
          <button
            onClick={mode === 'live' ? handleLiveExport : handleHistoricalExport}
            disabled={exporting || exportSuccess}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium text-sm transition-colors shadow-lg shadow-indigo-500/20"
          >
            {exporting ? (
              <><Loader2 size={15} className="animate-spin" /> Fetching from API...</>
            ) : (
              <><Download size={15} /> {mode === 'live' ? 'Download Snapshot CSV' : 'Download Historical CSV'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
