/* Elisa, 1er novembre, 9 h 30 (capture de « Nous contacter ») : « pouvoir mettre une image, un fichier ».
   Le code du formulaire est exécuté avec un faux DOM, un faux serveur et un faux espace de stockage. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const site = fs.readFileSync(new URL('../decouvrir/confidentialite.html', import.meta.url), 'utf8');
const sql = fs.readFileSync(new URL('../supabase/migrations/20261101083415_contact_pieces_jointes.sql', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const plain = v => JSON.parse(JSON.stringify(v));
const mod = cut('/* ---------- Nous contacter ----------', 'function replayOnboarding(){');

function mkEl(id) {
  const cls = new Set();
  return { id, value: '', textContent: '', innerHTML: '', hidden: false, disabled: false, dataset: {}, style: {}, scrollHeight: 90,
    classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c), toggle: (c, f) => { const on = f === undefined ? !cls.has(c) : !!f; if (on) cls.add(c); else cls.delete(c); return on; } },
    setAttribute() {}, focus() { this.focused = true; }, click() { this.clicked = true; } };
}
const file = (name, size, type = '') => ({ name, size, type });
function ctx({ depot = () => ({ ok: true }), reply = (f, b) => ({ ok: true, pieces: (b.p_pieces || []).length }) } = {}) {
  const els = {}, calls = [], depots = [];
  const get = id => (els[id] ||= mkEl(id));
  let n = 0;
  const c = vm.createContext({
    esc, escAttr, JSON, Math, String, Array, Number, Object, Promise, Uint8Array, setTimeout: f => f(),
    lqStkSvg: k => `<svg data-k="${k}"></svg>`, appVersionLabel: () => 'Version v2241',
    localStorage: { getItem: () => null, setItem() {} },
    navigator: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130.0 Safari/537.36', maxTouchPoints: 0, language: 'fr-FR', onLine: true },
    screen: { width: 1512, height: 982 }, matchMedia: () => ({ matches: false }),
    document: { getElementById: id => get(id), querySelectorAll: () => [], querySelector: () => null },
    CSS: { escape: x => String(x) }, lqCorbeille: (cartes, suite) => suite(), lqSay() {},   /* 11 novembre : la pièce retirée part à la poubelle */
    URL: { createObjectURL: () => 'blob:apercu-' + (++n), revokeObjectURL() {} },
    crypto: { getRandomValues: a => { a.fill(171); return a; } },
    JEU_SB: 'https://sb.test', JEU_SB_KEY: 'sb_publishable_x',
    clsCle: () => 'K'.repeat(32), buzz() {},
    clsRpc: (f, b) => { calls.push({ fn: f, body: plain(b) }); return Promise.resolve(reply(f, b)); },
    fetch: (url, o) => { depots.push({ url, headers: o.headers, body: o.body }); const r = depot(url); return Promise.resolve({ ok: r.ok, status: r.ok ? 200 : 400 }); },
  });
  c.window = c;
  vm.runInContext(mod, c);
  return { c, ev: s => vm.runInContext(s, c), el: get, calls, depots };
}

test('le formulaire : « Joindre une capture ou un fichier », sous le message, le trombone dans sa pastille', () => {
  const t = ctx();
  const h = t.ev('ctHTML()');
  assert.ok(h.indexOf('id="ct-msg"') < h.indexOf('class="ct-ajout"') && h.indexOf('class="ct-ajout"') < h.indexOf('for="ct-mail"'), 'entre le message et l’e-mail');
  assert.ok(h.includes('<b>Joindre une capture ou un fichier</b><small>Image, PDF, CSV, Excel… · 3 au plus</small>'));
  assert.ok(h.includes('<input type="file" id="ct-file" multiple accept="image/*,.pdf,.txt,.sql,.md,.log,.csv,.json,.xlsx,.xls,.sqlite,.sqlite3,.db" hidden'));
  assert.ok(h.includes('<div class="ct-pieces" id="ct-pieces" hidden>'), 'rien de joint au départ');
  assert.ok(h.includes('onpaste="ctColler(event)"') && h.includes('ondrop="ctLache(event)"'), 'coller une capture, glisser un fichier');
  t.ev('ctChoisir()'); assert.ok(t.el('ct-file').clicked);
});

test('choisir : 3 pièces au plus, 5 Mo chacune, des types connus ; une carte par pièce, qu’une croix retire', async () => {
  const t = ctx();
  t.ev('ctHTML()');
  t.c.lot = [file('Capture d’écran 2026-11-01 à 09.30.png', 320000, 'image/png'), file('export.CSV', 2048, ''), file('virus.exe', 100, 'application/x-msdownload')];
  await t.ev('ctFichiers(lot)');
  assert.deepEqual(plain(t.ev('CT.pieces.map(p=>[p.nom,p.type,p.url])')), [['Capture-d-ecran-2026-11-01-a-09-30.png', 'image/png', 'blob:apercu-1'], ['export.csv', 'text/csv', '']]);
  assert.equal(t.el('ct-etat').textContent, '« virus.exe » n’est pas pris : joins une image, un PDF, un texte, un CSV, un JSON, un Excel ou une base SQLite.');
  const l = t.el('ct-pieces');
  assert.equal(l.hidden, false);
  assert.ok(l.innerHTML.includes('<span class="ct-piece-v is-img" aria-hidden="true"><img src="blob:apercu-1" alt=""></span>'), 'la miniature d’une capture');
  assert.ok(l.innerHTML.includes('<span class="ct-piece-v" aria-hidden="true">CSV</span><span class="ct-piece-t"><b>export.csv</b><small>2 Ko</small></span>'), 'l’extension d’un fichier');
  assert.ok(l.innerHTML.includes('aria-label="Retirer export.csv"'));
  t.c.lot = [file('gros.pdf', 6 * 1024 * 1024, 'application/pdf')];
  await t.ev('ctFichiers(lot)');
  assert.equal(t.el('ct-etat').textContent, '« gros.pdf » dépasse 5 Mo.');
  t.c.lot = [file('base.sqlite', 40000), file('notes.sql', 300), file('un-de-trop.json', 10)];
  await t.ev('ctFichiers(lot)');
  assert.equal(t.ev('CT.pieces.length'), 3);
  assert.equal(t.ev('CT.pieces[2].type'), 'application/vnd.sqlite3');
  assert.equal(t.el('ct-etat').textContent, '3 pièces jointes au plus par message.');
  assert.equal(t.el('ct-ajout').hidden, true, 'le bouton se cache à 3');
  t.ev("ctRetirer(CT.pieces[0].id)");
  assert.equal(t.ev('CT.pieces.length'), 2); assert.equal(t.el('ct-ajout').hidden, false); assert.equal(t.el('ct-etat').textContent, '');
});

test('coller : une capture devient une pièce, un texte reste du texte', async () => {
  const t = ctx();
  t.ev('ctHTML()');
  let empeche = 0;
  t.c.ev = { clipboardData: { files: [file('image.png', 5000, 'image/png')], getData: () => '' }, preventDefault: () => empeche++ };
  t.ev('ctColler(ev)'); await new Promise(r => setImmediate(r));
  assert.equal(t.ev('CT.pieces.length'), 1); assert.equal(empeche, 1);
  t.c.ev = { clipboardData: { files: [file('image.png', 5000, 'image/png')], getData: () => 'A1\tB1' }, preventDefault: () => empeche++ };
  t.ev('ctColler(ev)');
  assert.equal(t.ev('CT.pieces.length'), 1, 'un tableau copié depuis Excel colle son texte'); assert.equal(empeche, 1);
});

test('envoyer : chaque pièce part dans « contact-pieces », puis le message avec leurs chemins', async () => {
  const t = ctx();
  t.ev("ctHTML();CT.msg='Le curseur est décalé, capture jointe.'");
  t.c.lot = [file('écran.png', 4000, 'image/png'), file('requete.sql', 120, '')];
  await t.ev('ctFichiers(lot)');
  await t.ev('ctEnvoyer()');
  const hex = 'ab'.repeat(16);
  assert.deepEqual(t.depots.map(d => d.url), [`https://sb.test/storage/v1/object/contact-pieces/${hex}/ecran.png`, `https://sb.test/storage/v1/object/contact-pieces/${hex}/requete.sql`]);
  assert.deepEqual(plain(t.depots[0].headers), { apikey: 'sb_publishable_x', Authorization: 'Bearer sb_publishable_x', 'Content-Type': 'image/png', 'x-upsert': 'false' });
  assert.equal(t.depots[1].headers['Content-Type'], 'text/plain', 'un .sql part en texte');
  assert.deepEqual(t.calls.at(-1).body.p_pieces, [`${hex}/ecran.png`, `${hex}/requete.sql`]);
  assert.equal(t.ev('CT.fini'), true); assert.equal(t.ev('CT.pieces.length'), 0, 'les pièces sont vidées après l’envoi');
  assert.ok(!t.el('ct-body').innerHTML.includes('ct-merci-pj'));
  /* Sans pièce : rien ne part vers le stockage, et pas de p_pieces */
  const s = ctx();
  s.ev("ctHTML();CT.msg='Une idée'"); await s.ev('ctEnvoyer()');
  assert.equal(s.depots.length, 0); assert.ok(!('p_pieces' in s.calls[0].body));
});

test('une pièce qui ne part pas : le message part quand même, et le merci le dit', async () => {
  const t = ctx({ depot: url => ({ ok: !url.endsWith('.pdf') }) });
  t.ev("ctHTML();CT.msg='Deux fichiers'");
  t.c.lot = [file('a.png', 4000, 'image/png'), file('b.pdf', 4000, 'application/pdf')];
  await t.ev('ctFichiers(lot)');
  await t.ev('ctEnvoyer()');
  assert.deepEqual(t.calls.at(-1).body.p_pieces, ['ab'.repeat(16) + '/a.png']);
  assert.equal(t.ev('CT.finiPj'), 1);
  assert.ok(t.el('ct-body').innerHTML.includes('<p class="ct-merci-pj">Une pièce jointe n’a pas pu partir&nbsp;: renvoie-la dans un nouveau message.</p>'));
  t.ev('ctEncore()'); assert.equal(t.ev('CT.finiPj'), 0);
  /* Le serveur refuse le message : les pièces restent, et ne repartent pas une seconde fois */
  const r = ctx({ reply: () => ({ ok: false, raison: 'trop' }) });
  r.ev("ctHTML();CT.msg='Encore'");
  r.c.lot = [file('a.png', 4000, 'image/png')];
  await r.ev('ctFichiers(lot)');
  await r.ev('ctEnvoyer()'); await r.ev('ctEnvoyer()');
  assert.equal(r.depots.length, 1, 'déjà déposée : le chemin est gardé');
  assert.equal(r.ev('CT.pieces.length'), 1);
});

test('Supabase : un espace privé, où l’appli dépose sans jamais lire ; contact_envoyer ne garde que les pièces vraiment déposées', () => {
  for (const part of [
    "values ('contact-pieces', 'contact-pieces', false, 5242880, array[",
    "create policy contact_pieces_depot on storage.objects for insert to anon, authenticated",
    "and name ~ '^[0-9a-f]{32}/[^/]{1,120}$'",
    "where bucket_id = 'contact-pieces' and created_at > now() - interval '1 hour') < 200;",
    "check (pieces is null or cardinality(pieces) <= 3)",
    "from (select distinct unnest(p_pieces[1:3]) as p) x",
    "join storage.objects o on o.bucket_id = 'contact-pieces' and o.name = x.p",
    "grant execute on function public.contact_envoyer(text, text, text, text, jsonb, text[]) to anon, authenticated;",
    "  m.pieces\nfrom public.contact_message m"])
    assert.ok(sql.includes(part), part);
  assert.ok(!/for (select|update|delete|all) to anon/.test(sql), 'aucune lecture, modification ni suppression');
  /* Les types du serveur couvrent ceux de l’appli */
  const types = new Set(sql.match(/'(image|application|text)\/[^']+'/g).map(x => x.slice(1, -1)));
  const TYPES = vm.runInNewContext('(' + cut('const CT_PJ_TYPES=', ';\nconst CT_PJ_ACCEPT').slice('const CT_PJ_TYPES='.length) + ')');
  for (const t of new Set(Object.values(TYPES)))
    assert.ok(types.has(t), t);
});

test('la confidentialité et la DA', () => {
  /* 6 novembre, 10 h 16 : « Tes données, tes choix », rubrique « En ligne » (donnees-choix) */
  assert.ok(app.includes("'<b>«\\u00a0Contacte-nous\\u00a0»</b>\\u00a0: ton message, ce que tu y joins et ton e-mail si tu le donnes, pour te répondre. Le message est effacé au bout de 3\\u00a0ans.',"));
  assert.ok(site.includes('les captures ou fichiers que tu y joins (3 au plus, 5&nbsp;Mo chacun, dans un espace de stockage privé)'));
  for (const part of [
    'html.lq #scr-compte .ct-ajout{display:flex;align-items:center;gap:12px;width:100%;min-height:58px;',
    'border:2px dashed #CFC6F5;border-radius:16px;background:#FAF8FF;',
    'html.lq #scr-compte .ct-ajout-i{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:var(--accent);',
    'html.lq #scr-compte .ct-piece-v img{display:block;width:100%;height:100%;object-fit:cover}',
    'html.lq #scr-compte .ct-pieces[hidden],html.lq #scr-compte .ct-ajout[hidden]{display:none}'])
    assert.ok(css.includes(part), part);
});
