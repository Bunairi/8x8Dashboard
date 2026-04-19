require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const axios   = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// ─── Config ───────────────────────────────────────────────────────────────────

const ANALYTICS_BASE = 'https://analytics.ai.8x8.com';
const API_PREFIX     = '/api/c8/ua-eris/analytics/work/v1';
const TOKEN_URL      = 'https://api.8x8.com/oauth/v2/token';

const CLIENT_ID      = process.env.EIGHT_BY_EIGHT_CLIENT_ID;
const CLIENT_SECRET  = process.env.EIGHT_BY_EIGHT_CLIENT_SECRET;
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

// ─── OAuth Token Management ───────────────────────────────────────────────────

let tokenCache = { accessToken: null, expiresAt: 0 };

async function getAccessToken() {
  // Return cached token if still valid (with 60s buffer)
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('EIGHT_BY_EIGHT_CLIENT_ID and EIGHT_BY_EIGHT_CLIENT_SECRET must be set in .env');
  }

  console.log('[Auth] Fetching new OAuth token…');
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const response = await axios.post(TOKEN_URL, 'grant_type=client_credentials', {
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
  });

  const { access_token, expires_in } = response.data;
  tokenCache = {
    accessToken: access_token,
    expiresAt:   Date.now() + (expires_in * 1000),
  };

  console.log(`[Auth] Token acquired, expires in ${expires_in}s`);
  return access_token;
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function analyticsGet(path, params = {}) {
  const token = await getAccessToken();
  const url   = `${ANALYTICS_BASE}${API_PREFIX}${path}`;
  console.log(`[GET] ${url}`);
  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept:        'application/json',
    },
    params,
  });
  return response.data;
}

async function analyticsPost(path, body) {
  const token = await getAccessToken();
  const url   = `${ANALYTICS_BASE}${path}`;
  console.log(`[POST] ${url}`);
  const response = await axios.post(url, body, {
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept:         'application/json',
    },
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

app.get('/api/health', async (_req, res) => {
  try {
    await getAccessToken();
    res.json({ status: 'ok', auth: 'oauth', pbxId: PBX_ID || null, queueIds: QUEUE_IDS || null });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
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
    const data    = await analyticsPost('/api/analytics/report/internal/cdr', body);
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
    const data = await analyticsPost('/api/analytics/report/internal/cdr', body);
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
  console.log(`  Auth    : OAuth 2.0 (client_credentials)`);
  console.log(`  PBX ID  : ${PBX_ID || 'MISSING'}`);
  try {
    await getAccessToken();
    console.log('  Token   : acquired ✓\n');
  } catch (err) {
    console.error('  Token   : FAILED —', err.message, '\n');
  }
});
