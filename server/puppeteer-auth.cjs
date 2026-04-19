const puppeteer = require('puppeteer-core');
const fs        = require('fs');
const path      = require('path');

const PROFILE_DIR  = path.join(__dirname, 'chrome-profile');
const SESSION_FILE = path.join(__dirname, '.session.json');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  // Linux (Railway/Render/Docker)
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  // Windows
  `C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe`,
  `C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe`,
  `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
  `C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe`,
  `C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe`,
].filter(Boolean);

function findBrowser() {
  const found = CHROME_CANDIDATES.find(p => {
    try { return fs.existsSync(p); } catch { return false; }
  });
  if (!found) throw new Error('Chrome/Edge not found. Set CHROME_PATH in .env');
  return found;
}

function loadSavedSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      if (data.cookie && data.xsrfToken) return data;
    }
  } catch { /* ignore */ }
  return null;
}

function saveSession(data) {
  try { fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2)); } catch { /* ignore */ }
}

function clearSavedSession() {
  try { fs.unlinkSync(SESSION_FILE); } catch { /* ignore */ }
}

// Opens a plain Chrome window — no automation flags that trigger SSO blocks.
// User logs in manually (including 2FA). We watch for the analytics page
// to load and then extract the cookies automatically.
async function loginTo8x8() {
  const executablePath = findBrowser();
  if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });

  console.log('[Auth] Opening Chrome — please log in to 8x8 in the window that appears.');
  console.log('[Auth] Complete any 2FA prompts. The window will close automatically once logged in.');

  const browser = await puppeteer.launch({
    executablePath,
    headless: false,
    userDataDir: PROFILE_DIR,
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1100,750',
      '--window-position=80,40',
    ],
    // Do NOT include any automation-hiding or automation-disabling flags —
    // they themselves can be fingerprinted by enterprise SSO providers.
  });

  try {
    const page = await browser.newPage();

    console.log('[Auth] Navigating to 8x8 analytics…');
    await page.goto('https://analytics.ai.8x8.com/dashboard/callQueues', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait up to 3 minutes for the user to finish logging in
    console.log('[Auth] Waiting for you to log in (up to 3 minutes)…');
    await page.waitForFunction(
      () => window.location.hostname === 'analytics.ai.8x8.com' &&
            !window.location.pathname.includes('login') &&
            !window.location.pathname.includes('auth') &&
            !window.location.pathname.includes('sso') &&
            !window.location.pathname.includes('signin') &&
            !window.location.href.includes('okta') &&
            !window.location.href.includes('microsoftonline') &&
            !window.location.href.includes('accounts.google'),
      { timeout: 180000, polling: 1000 }
    );

    console.log(`[Auth] Logged in — extracting cookies…`);
    const cookies = await page.cookies();

    const sessionCookie = cookies.find(c => c.name === 'SESSION');
    const xsrfCookie    = cookies.find(c => c.name === 'XSRF-TOKEN');

    if (!sessionCookie) {
      throw new Error('SESSION cookie not found after login — please try again.');
    }

    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const result    = { cookie: cookieStr, xsrfToken: xsrfCookie?.value || '' };

    saveSession(result);
    console.log('[Auth] Session saved — Chrome will close now.');
    return result;

  } finally {
    await browser.close();
  }
}

module.exports = { loginTo8x8, loadSavedSession, clearSavedSession };
