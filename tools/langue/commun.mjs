/* Les outils de traduction des vidéos (tools/langue, 15 novembre : « range les outils ») : ce qu'ils partagent.
   - un petit serveur local sur le dossier de l'appli (aucun autre serveur à lancer) ;
   - Chromium (Playwright) ouvert sur une vidéo, dans une langue ;
   - le moteur des langues (langues.js) chargé dans Node, pour le SQL ;
   - la mémoire de traduction : tout ce qui est déjà traduit dans la langue ;
   - la clé d'un texte, calculée comme le moteur la cherche (les nombres en {1}, les mois et les jours en {m1}).
   Voir tools/langue/README.md. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
export const existe = f => fs.existsSync(path.join(ROOT, f));
/* Les fichiers de travail d'une langue (récoltes, textes à traduire, traductions) : jamais publiés (voir .gitignore) */
export const travail = (langue, ...p) => { const d = path.join(ROOT, 'tools/langue/travail', langue); fs.mkdirSync(d, {recursive: true}); return path.join(d, ...p); };
export const NOMS_LANGUES = {en: 'anglais', es: 'espagnol', de: 'allemand', it: 'italien', pt: 'portugais', nl: 'néerlandais', ar: 'arabe'};

/* ---------- Les arguments : --langue xx, puis les vidéos (ou « toutes ») ---------- */
export function args(argv = process.argv.slice(2)) {
  const o = {langue: 'en', videos: [], options: {}};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--langue') o.langue = argv[++i];
    else if (a.startsWith('--')) { const [k, v] = a.slice(2).split('='); o.options[k] = v === undefined ? true : v; }
    else o.videos.push(a);
  }
  if (!o.videos.length || o.videos.includes('toutes')) o.videos = videos();
  return o;
}
/* Les vidéos de l'appli : celles que les leçons ouvrent (video:{anim:'assets/anim/<cours>.html…) */
export function videos() {
  return [...new Set([...lire('index.html').matchAll(/video:\{anim:'assets\/anim\/([a-z0-9-]+)\.html/g)].map(m => m[1]))];
}
/* Le titre d'une vidéo (la balise <title>, sans « Requête · ») */
export function titre(c) {
  const m = /<title>([^<]*)<\/title>/.exec(lire(`assets/anim/${c}.html`));
  return m ? m[1].replace(/^Requête · (Projet : )?/, '') : c;
}

/* ---------- Le serveur local ---------- */
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.gif': 'image/gif',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json'};
export function serveur(racine = ROOT) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(racine, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!f.startsWith(racine) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store'});
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({base: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close()})));
}

/* ---------- Chromium ---------- */
export async function navigateur() {
  let pw;
  try { pw = await import('playwright'); } catch (e) { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); }
  return pw.chromium.launch();
}
/* Un contexte d'iPhone vertical à la taille de la scène (1080 × 1920), dans la langue. 16 novembre (l'anglais ouvert à tous) :
   le français aussi est choisi, sinon un navigateur en anglais verrait la vidéo en anglais. */
export async function contexte(browser, langue, opts = {}) {
  const ctx = await browser.newContext({viewport: {width: 1080, height: 1920}, deviceScaleFactor: opts.echelle || 1, serviceWorkers: 'block', locale: !langue || langue === 'fr' ? 'fr-FR' : undefined});
  if (!langue || langue === 'fr') await ctx.addInitScript(() => { try { localStorage.setItem('requete-langue', 'fr'); } catch (e) {} });
  if (langue && langue !== 'fr') await ctx.addInitScript(l => { try { localStorage.setItem('requete-langue-essai', '1'); localStorage.setItem('requete-langue', l); } catch (e) {} }, langue);
  /* Rien ne sort du serveur local (polices, Supabase…) */
  await ctx.route(u => !/^http:\/\/127\.0\.0\.1:\d+\//.test(String(u)) && !/^(data|blob):/.test(String(u)), r => r.fulfill({status: 404, body: ''}));
  return ctx;
}
/* Une vidéo ouverte comme dans l'appli (?app&embed), prête (window.__ready : sa durée, ses repères) */
export async function video(ctx, base, c) {
  const p = await ctx.newPage(); const erreurs = [];
  p.on('pageerror', e => erreurs.push(String(e)));
  await p.goto(`${base}/assets/anim/${c}.html?app&embed`);
  const R = await p.evaluate(() => window.__ready);
  return {p, R, erreurs};
}

/* ---------- Le moteur des langues dans Node (pour le SQL d'une page) ---------- */
export function moteur(langue, pages = []) {
  const local = {'requete-langue-essai': '1', 'requete-langue': langue}, win = {};
  const ctx = {window: win, navigator: {language: 'fr-FR'}, Intl: {DateTimeFormat: () => ({resolvedOptions: () => ({timeZone: 'Europe/Paris'})})},
    location: {hostname: 'localhost', search: ''}, localStorage: {getItem: k => (k in local ? local[k] : null), setItem(k, v) { local[k] = v; }},
    document: {write() {}, documentElement: {}, title: '', addEventListener() {}, currentScript: {getAttribute: () => ''}}, console};
  vm.runInNewContext(lire('langues.js'), ctx);
  vm.runInNewContext(lire(`langue-${langue}.js`), ctx);
  for (const f of pages) if (existe(f)) vm.runInNewContext(lire(f), ctx);
  return win.REQUETE_LANGUE;
}
/* Le contenu d'un fichier de langue ou de page (textes, base, mots), lu sans navigateur */
export function contenu(fichier) {
  /* Un fichier de page peut appeler ajouter() deux fois (ses textes, puis sa voix off, ajoutée par tools/voix/integrer.mjs) :
     tout se cumule. */
  const o = {textes: {}};
  const capte = (code, x) => { for (const k in x || {}) if (k === 'textes') Object.assign(o.textes, x.textes); else o[k] = x[k]; };
  vm.runInNewContext(lire(fichier), {window: {REQUETE_LANGUE: {charger: capte, ajouter: capte}}});
  return o;
}

/* ---------- La mémoire de traduction ---------- */
/* Tout ce qui est déjà traduit dans la langue : son fichier (l'interface, les fiches), les vidéos déjà faites, puis les
   traductions de travail (travail/<langue>/traductions.json), qui l'emportent. */
export function memoire(langue) {
  const m = {};
  if (existe(`langue-${langue}.js`)) Object.assign(m, contenu(`langue-${langue}.js`).textes || {});
  const d = `assets/anim/${langue}`;
  if (existe(d)) for (const f of fs.readdirSync(path.join(ROOT, d)).filter(f => f.endsWith('.js')).sort()) Object.assign(m, contenu(`${d}/${f}`).textes || {});
  const t = travail(langue, 'traductions.json');
  if (fs.existsSync(t)) Object.assign(m, JSON.parse(fs.readFileSync(t, 'utf8')));
  return m;
}

/* ---------- La clé d'un texte ---------- */
/* Comme REQUETE_LANGUE la cherche (langues.js, chercher) : les mois et les jours (les « mots » de la langue) en {m1}, {m2}…,
   puis les nombres en {1}, {2}… ; les morceaux (<1/>, <2>…</2>) et les valeurs déjà posées restent. */
const NUM = /<[^>]*>|\{[a-z0-9]+\}|\d{1,3}(?: \d{3})+(?:,\d+)?|\d+(?:,\d+)?/g;
export function motsRe(mots) {
  const k = Object.keys(mots || {}); if (!k.length) return null;
  return new RegExp('(^|[^A-Za-zÀ-ÿ])(' + k.sort((a, b) => b.length - a.length).map(m => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![A-Za-zÀ-ÿ])', 'gi');
}
export function cle(s, re) {
  let g = String(s).replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim(), j = 0, i = 0;
  if (re) g = g.replace(re, (t, avant) => avant + '{m' + (++j) + '}');
  return g.replace(NUM, n => (n[0] === '<' || n[0] === '{') ? n : '{' + (++i) + '}');
}
/* Dans une traduction dont la clé a des {m…} : les mois et les jours de la langue d'arrivée deviennent {m1}, {m2}… dans l'ordre */
export function moisTraduits(v, mots) {
  const noms = [...new Set(Object.values(mots || {}))]; if (!noms.length) return v;
  const re = new RegExp('\\b(' + noms.sort((a, b) => b.length - a.length).map(m => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'g');
  let j = 0; return v.replace(re, () => '{m' + (++j) + '}');
}
/* Les mêmes nombres ({1}…) et les mêmes morceaux (<1/>, <2>…) des deux côtés */
export function parite(k, v) {
  const f = x => [String([...new Set(x.match(/\{\w+\}/g) || [])].sort()), String((x.match(/<\d+\/?>/g) || []).sort())];
  return JSON.stringify(f(k)) === JSON.stringify(f(v));
}

/* ---------- Les données de la base, qui ne se traduisent pas ---------- */
/* Les clients de NutriBoost (prénoms, noms, villes, adresses, e-mails), les numéros de commande, le code seul, les nombres seuls */
const PRENOMS = 'Sophie Lucas Emma Nathan Chloé Hugo Léa Gabriel Inès Yanis Lina Camille Karim Julie Salma Moussa Diego'.split(' ');
const NOMS = 'Martin Bernard Dubois Petit Moreau Laurent Simon Michel Lefebvre Dupont Roche Garnier Roux Nguyen Haddad Diallo Ramos'.split(' ');
const VILLES = 'Paris Lyon Marseille Bordeaux Toulouse Nantes'.split(' ');
export function donnee(k) {
  const t = String(k).trim();
  if (PRENOMS.includes(t) || NOMS.includes(t) || VILLES.includes(t)) return true;
  if (new RegExp(`^(${PRENOMS.join('|')}) (${NOMS.join('|')})$`).test(t)) return true;
  if (/^[A-Z]{2}$/.test(t)) return true;   // des initiales (LS, NP)
  if (t.includes('@') || /^[\d\s.,:{}€%×x+·/-]*$/.test(t)) return true;
  if (/^[A-Z_ ()*,;.'{}0-9=<>!%-]+$/.test(t)) return true;   // du code tout en majuscules (SELECT, COUNT(*))
  if (/\d+ (rue|avenue|allée|place|boulevard) /.test(t) || /\{\d+\} (rue|avenue|allée|place|boulevard) /.test(t)) return true;
  if (/^(CMD|NB|F)-[\d{}-]+$/.test(t)) return true;
  return false;
}
/* Un texte déjà dans la langue d'arrivée : une traduction de la page, un de ses morceaux (les mots d'un titre découpé, « result. »),
   ou son début coupé par « … » (l'aperçu d'un message). Le moteur le note comme manquant ; il n'y a rien à traduire. */
export function dejaTraduit(x, valeurs) {
  /* les nombres, écrits à la manière de chaque langue (500 000, 500,000, {1}), comptent pour un seul signe */
  const n = s => String(s).replace(/\{\d+\}|\d+(?:[.,\u00a0\u202f ]\d{3})*(?:[.,]\d+)?/g, '#').replace(/\s+/g, ' ').trim();
  const t = n(x); if (!t) return true;
  valeurs = valeurs.map(n);
  const tout = valeurs.join(' \u0001 ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  if (valeurs.includes(t) || valeurs.some(v => v.replace(/<[^>]+>/g, '') === t)) return true;
  if (/…$/.test(t) && tout.includes(t.slice(0, -1).trim())) return true;
  return t.split(' ').length <= 4 && !/[àâçéèêëîïôûùœ]/i.test(t) && tout.includes(t);
}
/* Un nom SQL seul (un en-tête de colonne, une table) : traduit par le moteur, pas par la mémoire */
export const IDENT = /^([a-z_][a-z0-9_]*)([;,]?)$/;

/* ---------- Les fichiers de page (assets/anim/<langue>/<cours>.js) ---------- */
export function lirePage(langue, c) {
  const f = `assets/anim/${langue}/${c}.js`;
  if (!existe(f)) return null;
  const src = lire(f), o = contenu(f);
  /* Tout ce qui suit les textes (la base propre à la page, la voix…) est gardé tel quel */
  const m = /^([\s\S]*?\n  textes: \{\n)([\s\S]*?)\n  \}([\s\S]*)$/.exec(src);
  if (!m) throw new Error(`${f} : forme inattendue (textes: { … })`);
  return {entete: m[1], textes: o.textes || {}, suite: m[3]};
}
export function ecrirePage(langue, c, page) {
  const lignes = Object.entries(page.textes).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n');
  fs.mkdirSync(path.join(ROOT, `assets/anim/${langue}`), {recursive: true});
  fs.writeFileSync(path.join(ROOT, `assets/anim/${langue}/${c}.js`), page.entete + lignes + '\n  }' + page.suite);
}
export function pageNeuve(langue, c) {
  return {entete: `/* La vidéo « ${titre(c)} » en ${NOMS_LANGUES[langue] || langue} : ses textes (voir langues.js et LANGUES.md).\n` +
    `   Les noms, les e-mails, les villes et les adresses des clients restent tels quels. */\n` +
    `window.REQUETE_LANGUE && window.REQUETE_LANGUE.ajouter('${langue}', {\n  textes: {\n`, textes: {}, suite: '\n});\n'};
}
/* La table d'une page (<body data-table="…">) : le contexte des noms SQL cités seuls */
export function tablePage(c) {
  const m = /<body[^>]*data-table="([^"]+)"/.exec(lire(`assets/anim/${c}.html`));
  return m ? m[1] : '';
}
