require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
const { loginTo8x8, loadSavedSession, clearSavedSession } = require('./puppeteer-auth.cjs');

const app = express();
app.use(cors());
app.use(express.json());

// ─── Config ───────────────────────────────────────────────────────────────────

const INTERNAL_BASE = 'https://analytics.ai.8x8.com';
const INTERNAL_PFX  = '/api/c8/ua-eris/analytics/work/v1';
const CDR_BASE      = 'https://api.8x8.com/analytics/work';

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

// ─── Session (for real-time internal endpoints) ───────────────────────────────

const _saved = loadSavedSession();
let session = {
  cookie:    _saved?.cookie    || process.env.EIGHT_BY_EIGHT_SESSION_COOKIE || null,
  xsrfToken: _saved?.xsrfToken || process.env.EIGHT_BY_EIGHT_XSRF_TOKEN    || null,
};
let loginInProgress = false;

function sessionReady() { return !!(session.cookie && session.xsrfToken); }

async function autoLogin() {
  if (loginInProgress) return false;
  loginInProgress = true;
  try {
    const result = await loginTo8x8();
    session.cookie    = result.cookie;
    session.xsrfToken = result.xsrfToken;
    console.log('[Auth] Session refreshed ✓');
    return true;
  } catch (err) {
    console.error('[Auth] Login failed:', err.message);
    return false;
  } finally {
    loginInProgress = false;
  }
}

async function waitForLogin() {
  const deadline = Date.now() + 60_000;
  while (loginInProgress && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 500));
  }
}

// ─── Official API token (for CDR endpoints) ───────────────────────────────────

let tokenCache = { token: null, expiresAt: 0 };

async function getCDRToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.token;
  const creds = Buffer.from(`${API_KEY}:${API_KEY}`).toString('base64');
  // Work Analytics uses apikey + username/password
  const body  = new URLSearchParams({ username: USERNAME, password: PASSWORD });
  const res   = await axios.post(`${CDR_BASE}/v1/oauth/token`, body.toString(), {
    headers: { '8x8-apikey': API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const { access_token, expires_in } = res.data;
  tokenCache = { token: access_token, expiresAt: Date.now() + expires_in * 1000 };
  console.log(`[CDR Auth] Token acquired, expires in ${expires_in}s`);
  return access_token;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

// Internal analytics.ai.8x8.com — uses cookie session
async function internalGet(path, params = {}) {
  await waitForLogin();
  const url = `${INTERNAL_BASE}${INTERNAL_PFX}${path}`;
  console.log(`[GET] ${url}`);
  const res = await axios.get(url, {
    headers: {
      Cookie:         session.cookie,
      'x-xsrf-token': session.xsrfToken,
      Accept:         'application/json',
      'User-Agent':   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer:        'https://analytics.ai.8x8.com/dashboard/callQueues',
    },
    params,
  });
  return res.data;
}

async function internalGetWithRetry(path, params = {}) {
  if (!sessionReady()) {
    await autoLogin();
  }
  try {
    return await internalGet(path, params);
  } catch (err) {
    if (err.response?.status === 401) {
      clearSavedSession();
      console.log('[Auth] Session expired — re-logging in…');
      const ok = await autoLogin();
      if (ok) return await internalGet(path, params);
      throw new Error('SESSION_EXPIRED');
    }
    throw err;
  }
}

// Official api.8x8.com — uses Bearer token, paginated
async function fetchAllCDR(params) {
  const token    = await getCDRToken();
  let records    = [];
  let scrollId   = null;
  const pageSize = 1000;

  do {
    const reqParams = { ...params, pageSize, ...(scrollId ? { scrollId } : {}) };
    console.log(`[CDR] Fetching page (scrollId: ${scrollId || 'initial'})`);
    const res = await axios.get(`${CDR_BASE}/v2/call-records`, {
      headers: { '8x8-apikey': API_KEY, Authorization: `Bearer ${token}`, Accept: 'application/json' },
      params: reqParams,
    });
    const { data, meta } = res.data;
    records  = records.concat(data || []);
    scrollId = (meta?.scrollId && meta.scrollId !== 'No Data') ? meta.scrollId : null;
  } while (scrollId);

  return records;
}

function handleErr(err, res) {
  const status = err.response?.status;
  const body   = err.response?.data;
  console.error(`[ERR] ${status} —`, JSON.stringify(body) || err.message);
  if (err.message === 'SESSION_EXPIRED') return res.status(401).json({ code: 'SESSION_EXPIRED' });
  if (status === 401) return res.status(401).json({ code: 'SESSION_EXPIRED' });
  if (status === 403) return res.status(403).json({ error: 'Access denied', details: body });
  return res.status(500).json({ error: err.message, details: body });
}

// ─── CDR helpers ─────────────────────────────────────────────────────────────

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
  res.json({ status: 'ok', sessionReady: sessionReady(), pbxId: PBX_ID || null });
});

app.get('/api/session', (_req, res) => res.json({ configured: sessionReady() }));

app.post('/api/login', async (req, res) => {
  if (loginInProgress) return res.status(409).json({ error: 'Login already in progress — check the Chrome window.' });
  const ok = await autoLogin();
  ok ? res.json({ ok: true }) : res.status(401).json({ error: 'Login failed or timed out.' });
});

app.get('/api/queues', async (_req, res) => {
  if (!PBX_ID) return res.status(400).json({ error: 'EIGHT_BY_EIGHT_PBX_ID not set in .env' });
  try {
    const data = await internalGetWithRetry(`/pbxes/${PBX_ID}/call-queues`);
    res.json(data);
  } catch (err) { handleErr(err, res); }
});

app.get('/api/realtime', async (req, res) => {
  if (!PBX_ID) return res.status(400).json({ error: 'EIGHT_BY_EIGHT_PBX_ID not set in .env' });
  const queueIds = req.query.queueIds || QUEUE_IDS || undefined;
  const params   = { metrics: ALL_METRICS };
  if (queueIds) params.queueIds = queueIds;
  try {
    const data = await internalGetWithRetry(`/pbxes/${PBX_ID}/call-queue-metrics/summary`, params);
    res.json({ raw: data, queueIds, timestamp: new Date().toISOString() });
  } catch (err) { handleErr(err, res); }
});

app.get('/api/daily', async (req, res) => {
  if (!PBX_NAME) return res.status(400).json({ error: 'EIGHT_BY_EIGHT_PBX_NAME not set in .env' });
  const { startDate, endDate, startTime, endTime } = req.query;
  const start  = startDate || new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  const end    = endDate   || new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  const tStart = startTime ? `${startTime}:00` : '00:00:00';
  const tEnd   = endTime   ? `${endTime}:59`   : '23:59:59';
  try {
    const records = await fetchAllCDR({ pbxId: PBX_NAME, timeZone: TIMEZONE, startTime: `${start} ${tStart}`, endTime: `${end} ${tEnd}` });
    res.json({ stats: aggregateCDR(records), period: { startDate: start, endDate: end }, timestamp: new Date().toISOString() });
  } catch (err) { handleErr(err, res); }
});

app.get('/api/historical', async (req, res) => {
  if (!PBX_NAME) return res.status(400).json({ error: 'EIGHT_BY_EIGHT_PBX_NAME not set in .env' });
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate required' });
  try {
    const records = await fetchAllCDR({ pbxId: PBX_NAME, timeZone: TIMEZONE, startTime: `${startDate} 00:00:00`, endTime: `${endDate} 23:59:59` });
    res.json({ data: records, meta: { totalRecordCount: records.length } });
  } catch (err) { handleErr(err, res); }
});

// ─── Serve React build in production ─────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../dist/index.html')));
}

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`\n8x8 Dashboard  →  http://localhost:${PORT}`);
  console.log(`  Real-time : Puppeteer session (internal API)`);
  console.log(`  CDR/Daily : Official 8x8 Work Analytics API`);
  console.log(`  PBX ID    : ${PBX_ID || 'MISSING'}`);

  if (sessionReady()) {
    console.log(`  Session   : loaded ✓\n`);
  } else {
    console.log(`  Session   : launching Chrome for login…\n`);
    await autoLogin();
  }
});
