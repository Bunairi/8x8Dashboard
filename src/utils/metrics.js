// Metric definitions mapped to the real 8x8 Work call-queue-metrics API field names.
// All live metrics use the "ongoing" prefix as returned by:
//   GET /analytics/work/v1/pbxes/{pbxId}/call-queue-metrics/summary

// Daily stat widgets pull from the /api/daily aggregated CDR response.
// Their metricKey matches the keys returned by aggregateCDR() on the server.
export const DAILY_WIDGETS = [
  {
    id: 'total_calls_today',
    label: 'Total Calls Today',
    description: 'All incoming calls received today',
    metricKey: 'totalCallsToday',
    format: 'number',
    icon: 'PhoneCall',
    color: 'sky',
    thresholds: null,
    defaultLayout: { x: 0, y: 4, w: 2, h: 2 },
    daily: true,
  },
  {
    id: 'answered_today',
    label: 'Calls Answered',
    description: 'Calls successfully answered today',
    metricKey: 'answeredToday',
    format: 'number',
    icon: 'PhoneOutgoing',
    color: 'emerald',
    thresholds: null,
    defaultLayout: { x: 2, y: 4, w: 2, h: 2 },
    daily: true,
  },
  {
    id: 'missed_today',
    label: 'Not Answered',
    description: 'Calls that rang but were not answered today',
    metricKey: 'missedToday',
    format: 'number',
    icon: 'PhoneMissed',
    color: 'red',

    thresholds: { warn: 5, critical: 15 },
    defaultLayout: { x: 4, y: 4, w: 2, h: 2 },
    daily: true,
  },
  {
    id: 'abandoned_today',
    label: 'Abandoned Calls',
    description: 'Callers who hung up before being answered today',
    metricKey: 'abandonedToday',
    format: 'number',
    icon: 'PhoneOff',
    color: 'orange',
    thresholds: { warn: 3, critical: 10 },
    defaultLayout: { x: 6, y: 4, w: 2, h: 2 },
    daily: true,
  },
  {
    id: 'avg_talk_today',
    label: 'Avg Talk Time',
    description: 'Average duration of answered calls today',
    metricKey: 'avgTalkTimeToday',
    format: 'duration',
    icon: 'MessageSquare',
    color: 'teal',
    thresholds: null,
    defaultLayout: { x: 8, y: 4, w: 2, h: 2 },
    daily: true,
  },
  {
    id: 'longest_call_today',
    label: 'Longest Call',
    description: 'Duration of the longest call today',
    metricKey: 'longestCallToday',
    format: 'duration',
    icon: 'Hourglass',
    color: 'violet',
    thresholds: null,
    defaultLayout: { x: 10, y: 4, w: 2, h: 2 },
    daily: true,
  },
];

export const DEFAULT_WIDGETS = [
  {
    id: 'waiting_calls',
    label: 'Calls in Queue',
    description: 'Calls currently waiting to be answered',
    metricKey: 'ongoingWaitingCalls',
    format: 'number',
    icon: 'PhoneIncoming',
    color: 'blue',
    thresholds: { warn: 5, critical: 10 },
    defaultLayout: { x: 0, y: 0, w: 2, h: 2 },
  },
  {
    id: 'avg_waiting_time',
    label: 'Avg Wait Time',
    description: 'Average time callers wait before being answered',
    metricKey: 'ongoingAvgWaitingTime',
    format: 'duration',
    icon: 'Clock',
    color: 'amber',
    thresholds: { warn: 60, critical: 180 },
    defaultLayout: { x: 2, y: 0, w: 2, h: 2 },
  },
  {
    id: 'longest_waiting_time',
    label: 'Longest Wait',
    description: 'Longest current wait time in the queue',
    metricKey: 'ongoingLongestWaitingTime',
    format: 'duration',
    icon: 'Timer',
    color: 'orange',
    thresholds: { warn: 120, critical: 300 },
    defaultLayout: { x: 4, y: 0, w: 2, h: 2 },
  },
  {
    id: 'available_agents',
    label: 'Agents Available',
    description: 'Agents ready and waiting for a call',
    metricKey: 'ongoingAvailableAgents',
    format: 'number',
    icon: 'UserCheck',
    color: 'green',
    thresholds: null,
    defaultLayout: { x: 6, y: 0, w: 2, h: 2 },
  },
  {
    id: 'handling_calls',
    label: 'Agents on Call',
    description: 'Agents currently handling an active call',
    metricKey: 'ongoingHandlingCalls',
    format: 'number',
    icon: 'Phone',
    color: 'indigo',
    thresholds: null,
    defaultLayout: { x: 8, y: 0, w: 2, h: 2 },
  },
  {
    id: 'total_agents',
    label: 'Total Agents',
    description: 'Total agents currently logged into this queue',
    metricKey: 'ongoingTotalAgents',
    format: 'number',
    icon: 'Users',
    color: 'sky',
    thresholds: null,
    defaultLayout: { x: 10, y: 0, w: 2, h: 2 },
  },
  {
    id: 'overflow_agents',
    label: 'Overflow Agents',
    description: 'Agents currently handling overflow calls',
    metricKey: 'ongoingOverflowAgents',
    format: 'number',
    icon: 'GitBranch',
    color: 'pink',
    thresholds: { warn: 2, critical: 5 },
    defaultLayout: { x: 0, y: 2, w: 2, h: 2 },
  },
  {
    id: 'total_calls',
    label: 'Total Calls',
    description: 'Total calls currently active in the queue',
    metricKey: 'ongoingTotalCalls',
    format: 'number',
    icon: 'PhoneCall',
    color: 'violet',
    thresholds: null,
    defaultLayout: { x: 2, y: 2, w: 2, h: 2 },
  },
  {
    id: 'avg_talking_time',
    label: 'Avg Talk Time',
    description: 'Average duration of active calls',
    metricKey: 'ongoingAvgTalkingTime',
    format: 'duration',
    icon: 'MessageSquare',
    color: 'teal',
    thresholds: null,
    defaultLayout: { x: 4, y: 2, w: 2, h: 2 },
  },
  {
    id: 'longest_talking_time',
    label: 'Longest Call',
    description: 'Duration of the longest active call',
    metricKey: 'ongoingLongestTalkingTime',
    format: 'duration',
    icon: 'Hourglass',
    color: 'emerald',
    thresholds: null,
    defaultLayout: { x: 6, y: 2, w: 2, h: 2 },
  },
  {
    id: 'avg_on_hold_time',
    label: 'Avg Hold Time',
    description: 'Average time callers spend on hold',
    metricKey: 'ongoingAvgOnHoldTime',
    format: 'duration',
    icon: 'PauseCircle',
    color: 'gray',
    thresholds: { warn: 30, critical: 90 },
    defaultLayout: { x: 8, y: 2, w: 2, h: 2 },
  },
  {
    id: 'longest_on_hold',
    label: 'Longest Hold',
    description: 'Longest current hold time',
    metricKey: 'ongoingLongestOnHoldTime',
    format: 'duration',
    icon: 'Pause',
    color: 'red',
    thresholds: { warn: 60, critical: 180 },
    defaultLayout: { x: 10, y: 2, w: 2, h: 2 },
  },
];

// Resolve a metric value from the API response.
// The API returns data keyed by queueId, e.g.:
//   { "CoWScuh6": { "ongoingWaitingCalls": 3, ... } }
// or a flat object if a single queue is selected.
export function resolveMetric(metricsObj, widget) {
  if (!metricsObj) return null;
  const val = metricsObj[widget.metricKey];
  return val !== undefined ? val : null;
}

// Convert API time values to display strings.
// 8x8 returns durations in milliseconds.
export function formatValue(value, format) {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  if (isNaN(n)) return String(value);

  switch (format) {
    case 'duration': {
      // API returns milliseconds
      const totalSecs = Math.round(n / 1000);
      if (totalSecs < 60) return `${totalSecs}s`;
      const m = Math.floor(totalSecs / 60);
      const s = totalSecs % 60;
      return s > 0 ? `${m}m ${s}s` : `${m}m`;
    }
    case 'percentage':
      return `${Math.round(n)}%`;
    default:
      return String(Math.round(n));
  }
}

export function getThresholdStatus(value, thresholds) {
  if (!thresholds || value === null || value === undefined) return 'normal';
  const n = Number(value);
  const { warn, critical, inverted } = thresholds;
  if (inverted) {
    if (n <= critical) return 'critical';
    if (n <= warn) return 'warn';
  } else {
    if (n >= critical) return 'critical';
    if (n >= warn) return 'warn';
  }
  return 'normal';
}
