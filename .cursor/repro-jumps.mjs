import fs from 'fs';
import puppeteer from 'puppeteer-core';

const LOG = '/Users/elisablanchart/SQL/.cursor/debug-b42d0a.log';
const URL = 'http://127.0.0.1:8765/index.html';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_VERSION = '2026-08-12-stable-stage';

function log(entry) {
  fs.appendFileSync(LOG, JSON.stringify({ sessionId: 'b42d0a', runId: 'post-fix', timestamp: Date.now(), ...entry }) + '\n');
}

fs.writeFileSync(LOG, '');

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--window-size=390,844', '--disable-web-security'],
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
});

const page = await browser.newPage();
await page.evaluateOnNewDocument((ver) => {
  localStorage.setItem('requete-sql-app-version', ver);
  localStorage.setItem('requete-sql-v3', JSON.stringify({
    lessons: {}, defis: {}, notes: [], plan: { niveau: 'debutant', rythme: 'leger', jours: [1,2,3,4,5], start: Date.now() },
    onboarded: true, name: 'Debug', entretien: {},
  }));
}, APP_VERSION);

await page.setRequestInterception(true);
page.on('request', (req) => {
  if (req.url().includes('/ingest/')) {
    try {
      const body = JSON.parse(req.postData() || '{}');
      log({ source: 'ingest', hypothesisId: body.hypothesisId, location: body.location, message: body.message, data: body.data });
    } catch (e) {}
    return req.respond({ status: 204, body: '' });
  }
  return req.continue();
});

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof window.openLesson === 'function', { timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => {
  document.getElementById('loader')?.remove();
  document.getElementById('onboarding')?.classList.remove('on');
  if (!window.db) {
    window.db = { exec: () => [], run() {}, export: () => new Uint8Array(), close() {} };
    window.baseBytes = new Uint8Array();
  }
});

await page.evaluate(() => openLesson(17));
await page.waitForSelector('#having-grp-viz', { timeout: 20000 });
await new Promise((r) => setTimeout(r, 600));

const result = await page.evaluate(() => {
  const scr = document.getElementById('scr-lesson');
  const root = document.getElementById('having-grp-viz');
  const stage = root.querySelector('.grp-stage');
  const jumps = [];
  let last = 120;
  scr.scrollTop = 120;
  last = scr.scrollTop;
  scr.addEventListener('scroll', () => {
    const now = scr.scrollTop;
    const delta = now - last;
    if (Math.abs(delta) >= 2) jumps.push({ from: last, to: now, delta, why: window.__dbgScrollWhy || 'unknown', phase: root.dataset.phase });
    last = now;
  }, { passive: true });

  const phaseHeights = [];
  for (const phase of [0, 1, 2, 0, 1, 2]) {
    const scrollBefore = scr.scrollTop;
    const hBefore = stage.offsetHeight;
    havingGrpSetPhase(root, phase, { animate: false });
    const hAfter = stage.offsetHeight;
    const scrollAfter = scr.scrollTop;
    phaseHeights.push({ phase, hBefore, hAfter, styleH: stage.style.height, scrollBefore, scrollAfter, scrollDelta: scrollAfter - scrollBefore });
  }
  return { phaseHeights, jumps, uniqueHeights: [...new Set(phaseHeights.map((p) => p.hAfter))] };
});

log({ hypothesisId: 'A', location: 'repro:post-fix', message: 'stable stage verification', data: result });
console.log(JSON.stringify(result, null, 2));
await browser.close();

const ok = result.uniqueHeights.length === 1 && result.phaseHeights.every((p) => p.scrollDelta === 0);
process.exit(ok ? 0 : 1);
