require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const axios   = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL   = 'https://api.8x8.com/analytics/work';
const API_KEY    = process.env.EIGHT_BY_EIGHT_API_KEY;
const USERNAME   = process.env.EIGHT_BY_EIGHT_USERNAME;
const PASSWORD   = process.env.EIGHT_BY_EIGHT_PASSWORD;
const PBX_ID     = process.env.EIGHT_BY_EIGHT_PBX_ID;
const PBX_NAME   = process.env.EIGHT_BY_EIGHT_PBX_NAME;
const QUEUE_IDS  = process.env.EIGHT_BY_EIGHT_QUEUE_IDS;
const TIMEZONE   = process.env.EIGHT_BY_EIGHT_TIMEZONE || 'Canada/Eastern';
const QUEUE_EXT  = process.env.EIGHT_BY_EIGHT_QUEUE_EXTENSION || '';
const QUEUE_NAME = process.env.EIGHT_BY_EIGHT_QUEUE_NAME || '';

const ALL_METRICS = [
  'ongoingTotalAgents', 'ongoingAvailableAgents', 'ongoingHandlingCalls',
  'ongoingOverflowAgents', 'ongoingWaitingCalls', 'ongoingTotalCalls',
  'ongoingAvgWaitingTime', 'ongoingLongestWaitingTime',
  'ongoingAvgTalkingTime', 'ongoingLongestTalkingTime',
  'ongoingTalkingTime', 'ongoingWaitingTime',
  'ongoingAvgOnHoldTime', 'ongoingLongestOnHoldTime', 'ongoingOnHoldTime',
].join(',');

// ─── Token Management ─────────────────────────────────────────────────────────

let tokenCache = { token: null, expiresAt: 0 };

async function getToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }
  if (!API_KEY || !USERNAME || !PASSWORD) {
    throw new Error('EIGHT_BY_EIGHT_API_KEY, USERNAME and PASSWORD must be set in .env');
  }
  console.log('[Auth] Fetching new access token…');
  const body = new URLSearchParams({ username: USERNAME, password: PASSWORD });
  const res  = await axios.post(`${BASE_URL}/v1/oauth/token`, body.toString(), {
    headers: { '8x8-apikey': API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const { access_token, expires_in } = res.data;
  tokenCache = { token: access_token, expiresAt: Date.now() + expires_in * 1000 };
  console.log(`[Auth] Token acquired, expires in ${expires_in}s`);
  return access_token;
}

function authHeaders(token) {
  return { '8x8-apikey': API_KEY, Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function apiGet(url, params = {}) {
  const token = await getToken();
  console.log(`[GET] ${url}`);
  const res = await axios.get(url, { headers: authHeaders(token), params });
  return res.data;
}

// Fetch all CDR pages automatically
async function fetchAllCDR(params) {
  const token   = await getToken();
  let records   = [];
  let scrollId  = null;
  const pageSize = 1000;

  do {
    const reqParams = { ...params, pageSize, ...(scrollId ? { scrollId } : {}) };
    console.log(`[GET] ${BASE_URL}/v2/call-records (scrollId: ${scrollId || 'initial'})`);
    const res = await axios.get(`${BASE_URL}/v2/call-records`, {
      headers: authHeaders(token),
      params:  reqParams,
    });
    const { data, meta } = res.data;
    records  = records.concat(data || []);
    scrollId = (meta?.scrollId && meta.scrollId !== 'No Data') ? meta.scrollId : null;
  } while (scrollId);

  return records;
}

function handleApiError(err, res) {
  const status = err.response?.status;
  const body   = err.response?.data;
  console.error(`[ERR] ${status} —`, JSON.stringify(body) || err.message);
  if (status === 401) return res.status(401).json({ error: 'Auth failed — check API_KEY, USERNAME, PASSWORD', details: body });
  if (status === 403) return res.status(403).json({ error: 'Access denied — check API permissions', details: body });
  if (status === 404) return res.status(404).json({ error: 'Endpoint not found', url: err.config?.url, details: body });
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

app.get('/api/health', async (_req, res) => {
  try {
    await getToken();
    res.json({ status: 'ok', auth: 'apikey+bearer', pbxId: PBX_ID || null });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Real-time queue metrics — polled every 5s by the frontend
app.get('/api/realtime', async (req, res) => {
  if (!PBX_ID) return res.status(400).json({ error: 'EIGHT_BY_EIGHT_PBX_ID not set in .env' });
  const queueIds = req.query.queueIds || QUEUE_IDS || undefined;
  const params   = { metrics: ALL_METRICS };
  if (queueIds) params.queueIds = queueIds;
  try {
    const data = await apiGet(`${BASE_URL}/v1/pbxes/${PBX_ID}/call-queue-metrics/summary`, params);
    res.json({ raw: data, queueIds, timestamp: new Date().toISOString() });
  } catch (err) { handleApiError(err, res); }
});

// Queue list for dropdown
app.get('/api/queues', async (_req, res) => {
  if (!PBX_ID) return res.status(400).json({ error: 'EIGHT_BY_EIGHT_PBX_ID not set in .env' });
  try {
    const data = await apiGet(`${BASE_URL}/v1/pbxes/${PBX_ID}/call-queues`);
    res.json(data);
  } catch (err) { handleApiError(err, res); }
});

// Daily CDR stats
app.get('/api/daily', async (req, res) => {
  if (!PBX_NAME) return res.status(400).json({ error: 'EIGHT_BY_EIGHT_PBX_NAME not set in .env' });
  const { startDate, endDate, startTime, endTime } = req.query;
  const start  = startDate || new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  const end    = endDate   || new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  const tStart = startTime ? `${startTime}:00` : '00:00:00';
  const tEnd   = endTime   ? `${endTime}:59`   : '23:59:59';

  try {
    const records = await fetchAllCDR({
      pbxId: PBX_NAME, timeZone: TIMEZONE,
      startTime: `${start} ${tStart}`, endTime: `${end} ${tEnd}`,
    });
    res.json({ stats: aggregateCDR(records), period: { startDate: start, endDate: end }, timestamp: new Date().toISOString() });
  } catch (err) { handleApiError(err, res); }
});

// Historical CDR export
app.get('/api/historical', async (req, res) => {
  if (!PBX_NAME) return res.status(400).json({ error: 'EIGHT_BY_EIGHT_PBX_NAME not set in .env' });
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate required' });
  try {
    const records = await fetchAllCDR({
      pbxId: PBX_NAME, timeZone: TIMEZONE,
      startTime: `${startDate} 00:00:00`, endTime: `${endDate} 23:59:59`,
    });
    res.json({ data: records, meta: { totalRecordCount: records.length } });
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
  console.log(`  API Key : ${API_KEY ? 'set ✓' : 'MISSING ✗'}`);
  console.log(`  PBX ID  : ${PBX_ID  || 'MISSING'}`);
  try {
    await getToken();
    console.log('  Token   : acquired ✓\n');
  } catch (err) {
    console.error('  Token   : FAILED —', err.message, '\n');
  }
});
