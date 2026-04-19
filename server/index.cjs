require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const axios   = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// ─── Config ───────────────────────────────────────────────────────────────────

const ANALYTICS_BASE = 'https://api.8x8.com';
const API_PREFIX     = '/analytics/work/v3';
const TOKEN_URL      = 'https://api.8x8.com/oauth/v2/token';

const API_KEY        = process.env.EIGHT_BY_EIGHT_API_KEY;
const PBX_ID         = process.env.EIGHT_BY_EIGHT_PBX_ID;
const PBX_NAME       = process.env.EIGHT_BY_EIGHT_PBX_NAME;
const QUEUE_IDS      = process.env.EIGHT_BY_EIGHT_QUEUE_IDS;
const TIMEZONE       = process.env.EIGHT_BY_EIGHT_TIMEZONE || 'Canada/Eastern';
const QUEUE_EXT      = process.env.EIGHT_BY_EIGHT_QUEUE_EXTENSION || '';
const QUEUE_NAME     = process.env.EIGHT_BY_EIGHT_QUEUE_NAME || '';

const ALL_METRICS = [
  'ongoingTotalAgents', 'ongoingAvailableAgents', 'ongoingHandlingCalls',
  'ongoingOverflowAgents', 'ongoingWaitingCalls', 'ongoingTotalCalls',
  'ongoingAvgWaitingTime', 'ongoingLongestWaitingTime',
  'ongoingAvgTalkingTime', 'ongoingLongestTalkingTime',
  'ongoingTalkingTime', 'ongoingWaitingTime',
  'ongoingAvgOnHoldTime', 'ongoingLongestOnHoldTime', 'ongoingOnHoldTime',
].join(',');

// ─── API Helpers ──────────────────────────────────────────────────────────────

function apiHeaders() {
  if (!API_KEY) throw new Error('EIGHT_BY_EIGHT_API_KEY not set in .env');
  return { '8x8-apikey': API_KEY, Accept: 'application/json' };
}

async function analyticsGet(path, params = {}) {
  const url = `${ANALYTICS_BASE}${API_PREFIX}${path}`;
  console.log(`[GET] ${url}`);
  const response = await axios.get(url, { headers: apiHeaders(), params });
  return response.data;
}

async function analyticsPost(path, body) {
  const url = `${ANALYTICS_BASE}${path}`;
  console.log(`[POST] ${url}`);
  const response = await axios.post(url, body, {
    headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
  });
  return response.data;
}

function handleApiError(err, res) {
  const status = err.response?.status;
  const body   = err.response?.data;
  console.error(`[ERR] ${status} —`, body || err.message);

  if (status === 401) return res.status(401).json({ error: 'OAuth token rejected — check CLIENT_ID and CLIENT_SECRET', details: body });
  if (status === 403) return res.status(403).json({ error: 'Access denied — check API permissions', details: body });
  return res.status(500).json({ error: err.message, details: body });
}

// ─── CDR Helpers ─────────────────────────────────────────────────────────────

function matchesQueue(r) {
  if (!QUEUE_EXT && !QUEUE_NAME) return true;
  if (QUEUE_EXT && String(r.callee) === String(QUEUE_EXT)) return true;
  if (QUEUE_NAME) {
    const name = QUEUE_NAME.toLowerCase();
    if (r.calleeName && r.calleeName.toLowerCase().includes(name)) return true;
    if (Array.isArray(r.callQueues) && r.callQueues.some(q => String(q).toLowerCase().includes(name))) return true;
    if (typeof r.callQueues === 'string' && r.callQueues.toLowerCase().includes(name)) return true;
  }
  return false;
}

function aggregateCDR(records) {
  const filtered  = records.filter(matchesQueue);
  const incoming  = filtered.filter(r => r.direction === 'Incoming');
  const answered  = incoming.filter(r => r.answered && r.answered !== '-' && r.missed !== 'Missed');
  const missed    = incoming.filter(r => r.missed === 'Missed' || r.lastLegDisposition === 'Missed');
  const abandoned = incoming.filter(r => r.abandoned === 'Abandoned');
  const talkTimes = answered.map(r => r.talkTimeMS || 0).filter(t => t > 0);
  const callTimes = incoming.map(r => r.callTime || 0);

  return {
    totalCallsToday:  incoming.length,
    answeredToday:    answered.length,
    missedToday:      missed.length,
    abandonedToday:   abandoned.length,
    avgTalkTimeToday: talkTimes.length ? Math.round(talkTimes.reduce((s, t) => s + t, 0) / talkTimes.length) : 0,
    longestCallToday: callTimes.length ? Math.max(...callTimes) : 0,
    totalRecords:     records.length,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', auth: 'apikey', apiKey: API_KEY ? 'set' : 'MISSING', pbxId: PBX_ID || null, queueIds: QUEUE_IDS || null });
});

app.get('/api/queues', async (_req, res) => {
  if (!PBX_ID) return res.status(400).json({ error: 'EIGHT_BY_EIGHT_PBX_ID not set in .env' });
  try {
    const data = await analyticsGet(`/pbxes/${PBX_ID}/call-queues`);
    res.json(data);
  } catch (err) { handleApiError(err, res); }
});

app.get('/api/realtime', async (req, res) => {
  if (!PBX_ID) return res.status(400).json({ error: 'EIGHT_BY_EIGHT_PBX_ID not set in .env' });
  const queueIds = req.query.queueIds || QUEUE_IDS || undefined;
  const params   = { metrics: ALL_METRICS };
  if (queueIds) params.queueIds = queueIds;
  try {
    const data = await analyticsGet(`/pbxes/${PBX_ID}/call-queue-metrics/summary`, params);
    res.json({ raw: data, queueIds, timestamp: new Date().toISOString() });
  } catch (err) { handleApiError(err, res); }
});

app.get('/api/daily', async (req, res) => {
  if (!PBX_NAME) return res.status(400).json({ error: 'EIGHT_BY_EIGHT_PBX_NAME not set in .env' });
  const { startDate, endDate, startTime, endTime } = req.query;
  const start  = startDate || new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  const end    = endDate   || new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  const tStart = startTime ? `${startTime}:00` : '00:00:00';
  const tEnd   = endTime   ? `${endTime}:59`   : '23:59:59';

  const body = {
    filterOption: [], isCallRecord: true, isSimplified: false,
    timeZone: TIMEZONE, startTime: `${start} ${tStart}`, endTime: `${end} ${tEnd}`,
    intraStartTime: tStart, intraEndTime: tEnd, pageSize: 5000, pbxId: [PBX_NAME],
    sortOption: [{ sortField: 'startTime', sortId: 1, sortOrder: 'DESC' }],
  };
  try {
    const data    = await analyticsPost('/analytics/work/v3/cdr', body);
    const records = data?.data || data?.records || (Array.isArray(data) ? data : []);
    res.json({ stats: aggregateCDR(records), period: { startDate: start, endDate: end }, timestamp: new Date().toISOString() });
  } catch (err) { handleApiError(err, res); }
});

app.get('/api/historical', async (req, res) => {
  if (!PBX_NAME) return res.status(400).json({ error: 'EIGHT_BY_EIGHT_PBX_NAME not set in .env' });
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate required' });

  const body = {
    filterOption: [], isCallRecord: true, isSimplified: false,
    timeZone: TIMEZONE, startTime: `${startDate} 00:00:00`, endTime: `${endDate} 23:59:59`,
    intraStartTime: '00:00:00', intraEndTime: '23:59:00', pageSize: 5000, pbxId: [PBX_NAME],
    sortOption: [{ sortField: 'startTime', sortId: 1, sortOrder: 'DESC' }],
  };
  try {
    const data = await analyticsPost('/analytics/work/v3/cdr', body);
    res.json(data);
  } catch (err) { handleApiError(err, res); }
});

// ─── Serve React build in production ─────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`\n8x8 Dashboard API  →  http://localhost:${PORT}`);
  console.log(`  Auth    : API Key (8x8-apikey header)`);
  console.log(`  API Key : ${API_KEY ? 'set ✓' : 'MISSING ✗'}`);
  console.log(`  PBX ID  : ${PBX_ID || 'MISSING'}\n`);
});
