require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
const { loginTo8x8, loadSavedSession, clearSavedSession } = require('./puppeteer-auth.cjs');

const app = express();
app.use(cors());
app.use(express.json());

// ─── Config ───────────────────────────────────────────────────────────────────

const ANALYTICS_BASE = 'https://analytics.ai.8x8.com';
const API_PREFIX     = '/api/c8/ua-eris/analytics/work/v1';
const PBX_ID         = process.env.EIGHT_BY_EIGHT_PBX_ID;       // base64 id for realtime metrics
const PBX_NAME       = process.env.EIGHT_BY_EIGHT_PBX_NAME;     // short name for CDR e.g. "southbridgecareho"
const USERNAME       = process.env.EIGHT_BY_EIGHT_USERNAME || '';
const PASSWORD       = process.env.EIGHT_BY_EIGHT_PASSWORD || '';
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

// ─── Session State ────────────────────────────────────────────────────────────

// Load saved session from disk (survives restarts) or fall back to .env values
const _savedSession = loadSavedSession();
let session = {
  cookie:    _savedSession?.cookie    || process.env.EIGHT_BY_EIGHT_SESSION_COOKIE || null,
  xsrfToken: _savedSession?.xsrfToken || process.env.EIGHT_BY_EIGHT_XSRF_TOKEN    || null,
};

let puppeteerLoginInProgress = false;

function isSessionConfigured() {
  return !!(session.cookie && session.xsrfToken);
}

async function autoLogin() {
  if (puppeteerLoginInProgress) return false;
  puppeteerLoginInProgress = true;
  try {
    const result = await loginTo8x8();
    session.cookie    = result.cookie;
    session.xsrfToken = result.xsrfToken;
    console.log('[Auth] Session refreshed successfully');
    return true;
  } catch (err) {
    console.error('[Auth] Login failed:', err.message);
    return false;
  } finally {
    puppeteerLoginInProgress = false;
  }
}

// ─── API Helper ───────────────────────────────────────────────────────────────

async function analyticsGetOnce(path, params = {}) {
  const url = `${ANALYTICS_BASE}${API_PREFIX}${path}`;
  console.log(`[GET] ${url}`);
  const response = await axios.get(url, {
    headers: {
      Cookie:         session.cookie,
      'x-xsrf-token': session.xsrfToken,
      Accept:         'application/json',
      'User-Agent':   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer:        'https://analytics.ai.8x8.com/dashboard/callQueues',
    },
    params,
  });
  return response.data;
}

async function waitForLogin() {
  if (!puppeteerLoginInProgress) return;
  // Poll until the in-progress login finishes (max 60 s)
  const deadline = Date.now() + 60_000;
  while (puppeteerLoginInProgress && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 500));
  }
}

async function analyticsGet(path, params = {}) {
  // If a login is in flight, wait for it to finish before proceeding
  await waitForLogin();

  if (!isSessionConfigured()) {
    const err = new Error('SESSION_NOT_CONFIGURED');
    err.code = 'SESSION_NOT_CONFIGURED';
    throw err;
  }

  try {
    return await analyticsGetOnce(path, params);
  } catch (err) {
    const status = err.response?.status;
    const body   = err.response?.data;
    console.error(`[ERR] ${status} — ${JSON.stringify(body)}`);

    // 401 = session expired → re-login
    // 403 = permission denied (wrong account) → surface the error, do NOT re-login
    if (status === 401) {
      clearSavedSession();
      console.log('[Auth] Session expired, attempting auto-refresh…');
      const ok = await autoLogin();
      if (ok) {
        try { return await analyticsGetOnce(path, params); } catch (e2) { /* fall through */ }
      }
      const e = new Error('SESSION_EXPIRED');
      e.code = 'SESSION_EXPIRED';
      throw e;
    }
    if (status === 403) {
      const msg = body?.message || body?.error || 'Access denied (403)';
      const e = new Error(`PERMISSION_DENIED: ${msg}`);
      e.code = 'PERMISSION_DENIED';
      e.status = 403;
      throw e;
    }
    throw err;
  }
}

async function analyticsPostOnce(path, body) {
  const url = `${ANALYTICS_BASE}${path}`;
  console.log(`[POST] ${url}`);
  const response = await axios.post(url, body, {
    headers: {
      Cookie:          session.cookie,
      'x-xsrf-token': session.xsrfToken,
      'Content-Type': 'application/json',
      Accept:         'application/json',
      'User-Agent':   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer:        'https://analytics.ai.8x8.com/voa/reports/callDetailRecords',
    },
  });
  return response.data;
}

async function analyticsPost(path, body) {
  await waitForLogin();

  if (!isSessionConfigured()) {
    const err = new Error('SESSION_NOT_CONFIGURED');
    err.code = 'SESSION_NOT_CONFIGURED';
    throw err;
  }

  try {
    return await analyticsPostOnce(path, body);
  } catch (err) {
    console.error(`[ERR POST] ${err.response?.status} — ${JSON.stringify(err.response?.data)}`);
    const status = err.response?.status;
    const rbody  = err.response?.data;
    if (status === 401) {
      clearSavedSession();
      console.log('[Auth] Session expired, attempting auto-refresh…');
      const ok = await autoLogin();
      if (ok) {
        try { return await analyticsPostOnce(path, body); } catch (e2) { /* fall through */ }
      }
      const e = new Error('SESSION_EXPIRED');
      e.code = 'SESSION_EXPIRED';
      throw e;
    }
    if (status === 403) {
      const msg = rbody?.message || rbody?.error || 'Access denied (403)';
      const e = new Error(`PERMISSION_DENIED: ${msg}`);
      e.code = 'PERMISSION_DENIED';
      e.status = 403;
      throw e;
    }
    throw err;
  }
}

function todayRange() {
  const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  return { startTime: `${dateStr} 00:00:00`, endTime: `${dateStr} 23:59:59` };
}

function matchesQueue(r) {
  if (!QUEUE_EXT && !QUEUE_NAME) return true; // no filter — include all

  // Match by extension number
  if (QUEUE_EXT && String(r.callee) === String(QUEUE_EXT)) return true;

  // Match by queue name in calleeName or callQueues array
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
    totalCallsToday:   incoming.length,
    answeredToday:     answered.length,
    missedToday:       missed.length,
    abandonedToday:    abandoned.length,
    avgTalkTimeToday:  talkTimes.length ? Math.round(talkTimes.reduce((s, t) => s + t, 0) / talkTimes.length) : 0,
    longestCallToday:  callTimes.length ? Math.max(...callTimes) : 0,
    totalRecords:      records.length,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    pbxId:        PBX_ID  || null,
    sessionReady: isSessionConfigured(),
    queueIds:     QUEUE_IDS || null,
  });
});

// Session management — lets the frontend update cookies without restarting
app.get('/api/session', (_req, res) => {
  res.json({ configured: isSessionConfigured() });
});

app.post('/api/session', (req, res) => {
  const { cookie, xsrfToken } = req.body;
  if (!cookie || !xsrfToken) {
    return res.status(400).json({ error: 'cookie and xsrfToken are required' });
  }
  session.cookie    = cookie;
  session.xsrfToken = xsrfToken;
  console.log('[Session] Updated via API');
  res.json({ ok: true });
});

// Open Chrome for manual login — used by the frontend sign-in screen
app.post('/api/login', async (req, res) => {
  if (puppeteerLoginInProgress) {
    return res.status(409).json({ error: 'Login already in progress — check the Chrome window.' });
  }
  try {
    const ok = await autoLogin();
    if (ok) {
      console.log('[Auth] /api/login succeeded');
      res.json({ ok: true });
    } else {
      res.status(401).json({ error: 'Login failed or timed out.' });
    }
  } catch (err) {
    console.error('[Auth] /api/login failed:', err.message);
    res.status(401).json({ error: err.message });
  }
});

// List queues for dropdown
app.get('/api/queues', async (_req, res) => {
  if (!PBX_ID) return res.status(400).json({ error: 'EIGHT_BY_EIGHT_PBX_ID not set in .env' });
  try {
    const data = await analyticsGet(`/pbxes/${PBX_ID}/call-queues`);
    res.json(data);
  } catch (err) {
    if (err.code === 'SESSION_NOT_CONFIGURED') return res.status(401).json({ code: err.code });
    if (err.code === 'SESSION_EXPIRED')        return res.status(401).json({ code: err.code });
    if (err.code === 'PERMISSION_DENIED')      return res.status(403).json({ code: err.code, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Real-time metrics — polled every 5 s
app.get('/api/realtime', async (req, res) => {
  if (!PBX_ID) return res.status(400).json({ error: 'EIGHT_BY_EIGHT_PBX_ID not set in .env' });

  const queueIds = req.query.queueIds || QUEUE_IDS || undefined;
  const params   = { metrics: ALL_METRICS };
  if (queueIds) params.queueIds = queueIds;

  try {
    const data = await analyticsGet(`/pbxes/${PBX_ID}/call-queue-metrics/summary`, params);
    res.json({ raw: data, queueIds, timestamp: new Date().toISOString() });
  } catch (err) {
    if (err.code === 'SESSION_NOT_CONFIGURED') return res.status(401).json({ code: err.code });
    if (err.code === 'SESSION_EXPIRED')        return res.status(401).json({ code: err.code });
    if (err.code === 'PERMISSION_DENIED')      return res.status(403).json({ code: err.code, error: err.message });
    res.status(500).json({ error: err.message, details: err.response?.data });
  }
});


// Daily/period stats — aggregated from CDR
// Accepts optional startDate / endDate query params (YYYY-MM-DD), defaults to today
app.get('/api/daily', async (req, res) => {
  if (!PBX_NAME) return res.status(400).json({ error: 'EIGHT_BY_EIGHT_PBX_NAME not set in .env' });

  const { startDate, endDate, startTime, endTime } = req.query;
  const start = startDate || new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  const end   = endDate   || new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  const tStart = startTime ? `${startTime}:00` : '00:00:00';
  const tEnd   = endTime   ? `${endTime}:59`   : '23:59:59';

  const body = {
    filterOption:   [],
    isCallRecord:   true,
    isSimplified:   false,
    timeZone:       TIMEZONE,
    startTime:      `${start} ${tStart}`,
    endTime:        `${end} ${tEnd}`,
    intraStartTime: tStart,
    intraEndTime:   tEnd,
    pageSize:       5000,
    pbxId:          [PBX_NAME],
    sortOption:     [{ sortField: 'startTime', sortId: 1, sortOrder: 'DESC' }],
  };

  try {
    const data    = await analyticsPost('/api/analytics/report/internal/cdr', body);
    const records = data?.data || data?.records || (Array.isArray(data) ? data : []);
    res.json({ stats: aggregateCDR(records), period: { startDate: start, endDate: end }, timestamp: new Date().toISOString() });
  } catch (err) {
    if (err.code === 'SESSION_NOT_CONFIGURED') return res.status(401).json({ code: err.code });
    if (err.code === 'SESSION_EXPIRED')        return res.status(401).json({ code: err.code });
    if (err.code === 'PERMISSION_DENIED')      return res.status(403).json({ code: err.code, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Historical CDR export (date range)
app.get('/api/historical', async (req, res) => {
  if (!PBX_NAME) return res.status(400).json({ error: 'EIGHT_BY_EIGHT_PBX_NAME not set in .env' });

  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate required' });

  const body = {
    filterOption: [],
    isCallRecord: true,
    isSimplified: false,
    timeZone: TIMEZONE,
    startTime: `${startDate} 00:00:00`,
    endTime:   `${endDate} 23:59:59`,
    intraStartTime: '00:00:00',
    intraEndTime:   '23:59:00',
    pageSize: 5000,
    pbxId: [PBX_NAME],
    sortOption: [{ sortField: 'startTime', sortId: 1, sortOrder: 'DESC' }],
  };

  try {
    const data = await analyticsPost('/api/analytics/report/internal/cdr', body);
    res.json(data);
  } catch (err) {
    if (err.code === 'SESSION_NOT_CONFIGURED') return res.status(401).json({ code: err.code });
    if (err.code === 'SESSION_EXPIRED')        return res.status(401).json({ code: err.code });
    if (err.code === 'PERMISSION_DENIED')      return res.status(403).json({ code: err.code, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Daily stats discovery — probes candidate endpoints for today's totals
app.get('/api/discover-daily', async (req, res) => {
  if (!PBX_ID) return res.status(400).json({ error: 'PBX_ID not set' });

  const today    = new Date().toISOString().slice(0, 10);
  const queueIds = QUEUE_IDS || undefined;
  const results  = [];

  async function probe(label, path, params = {}) {
    try {
      const data = await analyticsGet(path, params);
      results.push({ label, ok: true, data });
    } catch (err) {
      results.push({ label, ok: false, status: err.response?.status || err.status, error: err.response?.data || err.message });
    }
  }

  // Same summary endpoint but with date range = today
  await probe('summary?startDate=today (named metrics)', `/pbxes/${PBX_ID}/call-queue-metrics/summary`, {
    startDate: today, endDate: today,
    metrics: 'totalCalls,handledCalls,abandonedCalls,missedCalls,droppedCalls,avgHandleTime,avgWaitTime,serviceLevelPercent',
    ...(queueIds ? { queueIds } : {}),
  });

  await probe('summary?startDate=today (no metric filter)', `/pbxes/${PBX_ID}/call-queue-metrics/summary`, {
    startDate: today, endDate: today,
    ...(queueIds ? { queueIds } : {}),
  });

  // Candidate daily/historical paths
  for (const p of [
    `/pbxes/${PBX_ID}/call-queue-metrics/history`,
    `/pbxes/${PBX_ID}/call-queue-metrics/daily`,
    `/pbxes/${PBX_ID}/call-queue-metrics/aggregated`,
    `/pbxes/${PBX_ID}/call-queue-metrics/interval`,
    `/pbxes/${PBX_ID}/queue-metrics/summary`,
    `/pbxes/${PBX_ID}/agent-metrics/summary`,
    `/pbxes/${PBX_ID}/call-statistics`,
    `/pbxes/${PBX_ID}/reports/call-queues`,
  ]) {
    await probe(p, p, { startDate: today, endDate: today, ...(queueIds ? { queueIds } : {}) });
  }

  res.json(results);
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
  console.log(`  PBX ID  : ${PBX_ID  || 'MISSING'}`);

  if (isSessionConfigured()) {
    console.log(`  Session : ${_savedSession ? 'restored from disk ✓' : 'loaded from .env ✓'}\n`);
  } else {
    console.log('  Session : launching Chrome — log in to 8x8 in the window that opens…\n');
    await autoLogin();
    console.log(`  Session : ${isSessionConfigured() ? 'ready ✓' : 'login failed'}\n`);
  }
});
