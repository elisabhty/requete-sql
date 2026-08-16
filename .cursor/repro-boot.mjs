import fs from 'fs';
import puppeteer from 'puppeteer-core';

const LOG = '/Users/elisablanchart/SQL/.cursor/debug-b42d0a.log';
const URL = 'http://127.0.0.1:8765/index.html';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_VERSION = '2026-08-12-debug-jumps';

function log(entry) {
  fs.appendFileSync(LOG, JSON.stringify({ sessionId: 'b42d0a', runId: 'local-repro', timestamp: Date.now(), ...entry }) + '\n');
}

fs.writeFileSync(LOG, '');

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--window-size=390,844'],
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
});

const page = await browser.newPage();
page.on('console', (msg) => log({ hypothesisId: 'X', location: 'console', message: msg.text() }));
page.on('pageerror', (err) => log({ hypothesisId: 'X', location: 'pageerror', message: String(err) }));

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
    try { const body = JSON.parse(req.postData() || '{}'); log({ source: 'ingest', ...body }); } catch (e) {}
    return req.respond({ status: 204, body: '' });
  }
  return req.continue();
});

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise((r) => setTimeout(r, 3000));
const snap = await page.evaluate(() => ({
  hasOpenLesson: typeof openLesson,
  hasDb: !!window.db,
  hasSQL: !!window.SQL || !!window.initSqlJs,
  loader: document.getElementById('loader')?.style?.display,
  loaderText: document.getElementById('loader')?.innerText?.slice(0, 200),
  onboardOn: document.getElementById('onboarding')?.classList?.contains('on'),
  activeScreen: document.querySelector('.screen.active')?.id,
  bodyText: document.body.innerText.slice(0, 300),
}));
log({ hypothesisId: 'X', location: 'boot-snap', message: 'boot snapshot', data: snap });
console.log(JSON.stringify(snap, null, 2));
await browser.close();
