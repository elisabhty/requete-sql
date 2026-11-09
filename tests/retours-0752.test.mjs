/* Elisa, 6 novembre, 7 h 52 (trois captures du schéma de la base Agence de voyages) :
   « Efface les « voir » » : la ligne « +4 colonnes » d’une table pliée n’a plus de pastille « Voir › » ; touchée, elle déplie la
   table, et une table dépliée montre toutes ses colonnes (plus de plafond de sept, ni d’onglet à ouvrir).
   « Réf 3 : regarde l’espace que j’ai surligné (avant la colonne) est un peu faible, augmente juste un tout petit peu » : une colonne
   et son exemple tiennent 40 px au lieu de 36, dont 2 au-dessus du nom ; le trait arrive toujours au milieu du nom.
   « Reprendre exactement ce format dans « base » » (les tables de la Console) : chaque table de la Console est la carte du schéma
   UML, à la couleur que la table a dans le schéma ; repliée, ses clés et « +N colonnes » ; dépliée, toutes ses colonnes avec leur
   cadre « ex : », ses liens allumés, puis sa description et ses actions.
   « Enlève Ses colonnes » : la bulle d’une table touchée n’a plus de bouton. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = nom => cut(`function ${nom}(`, '\n}\n') + '\n}\n';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = s => esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const plur = (n, mot) => n + ' ' + (Math.abs(n) > 1 ? mot + 's' : mot);

const initSqlJs = createRequire(import.meta.url)(path.join(ROOT, 'vendor/sqljs/sql-wasm.js'));
const SQL = await initSqlJs({locateFile: f => path.join(ROOT, 'vendor/sqljs', f)});
const UML = cut('function quoteIdent(name){', '\n') + '\n' + fn('tableRowCount') + cut('function guessFkTarget(col,tables){', 'function courseTableNames(){')
  + cut('const UML_TEINTES=', 'let schCtx=null;');
const BASES = cut('const DEFI_BASES={', '\nconst ').replace('const DEFI_BASES=', 'DEFI_BASES=');
const tablesDe = d => d.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0].values.map(v => v[0]);

function schema() {
  const ctx = vm.createContext({SCHEMA_META: [], esc, escAttr, plur});
  vm.runInContext(UML + ';this.umlModele=umlModele;this.umlPlan=umlPlan;this.umlHtml=umlHtml;this.umlBulle=umlBulle;this.UML_G=UML_G;', ctx);
  vm.runInContext(BASES, ctx);
  return ctx;
}

test('le schéma : plus de « Voir », une table dépliée montre toutes ses colonnes, pliée ses clés et « +N colonnes » qui la déplie', () => {
  const ctx = schema(), d = new SQL.Database();
  d.run(ctx.DEFI_BASES.voyages.sql);
  const m = ctx.umlModele(d, tablesDe(d));
  const ouvert = ctx.umlPlan(m, 340, true, new Set());
  for (const c of ouvert.cartes) {
    assert.equal(c.plus, 0, `${c.name} dépliée : pas de « +N colonnes »`);
    assert.equal(c.cols.length, m.tables.find(t => t.name === c.name).cols.length, `${c.name} : toutes ses colonnes`);
  }
  const plie = ctx.umlPlan(m, 340, true, new Set(['avis'])), avis = plie.cartes.find(c => c.name === 'avis');
  assert.deepEqual([...avis.cols.filter(c => !avis.caches.includes(c.c)).map(c => c.c)], ['id', 'client_id', 'circuit_id'], 'pliée : ses clés');
  assert.equal(avis.plus, 3);
  const h = ctx.umlHtml(plie);
  assert.ok(h.includes('<button type="button" class="umd-c is-plus is-deplier" aria-label="Déplier la table avis : ses 6 colonnes" onclick="umlPlier(this,event)"><span>+3 colonnes</span></button>'));
  assert.ok(!h.includes('Voir') && !h.includes('umd-voir') && !app.includes('function schemaOuvrirTable('));
  assert.ok(fn('umlCarte').includes("closest('.umd-pli,.is-deplier'))return;"), 'déplier n’allume pas la table');
  assert.ok(fn('umlPlier').includes("const c=btn&&btn.closest('.umd-t')"), '« +3 colonnes » déplie la carte où il est');
  d.close();
});

test('réf. 3 : un peu plus d’air avant chaque colonne (40 px avec son exemple, 2 au-dessus du nom) ; le trait au milieu du nom', () => {
  const ctx = schema(), d = new SQL.Database();
  d.run(ctx.DEFI_BASES.voyages.sql);
  assert.equal(ctx.UML_G.ligneEx, 40);
  assert.equal(ctx.UML_G.haut, 2);
  const p = ctx.umlPlan(ctx.umlModele(d, tablesDe(d)), 340, true, new Set()), carte = Object.fromEntries(p.cartes.map(c => [c.name, c]));
  const a = p.arcs.find(x => x.de === 'avis' && x.col === 'client_id'), c = carte.avis;
  assert.equal(a.y1, c.y + 34 + 7 + c.cols.findIndex(x => x.c === 'client_id') * 40 + 2 + 10);
  assert.ok(css.includes('html.lq #schema-sheet .umd-t.is-ex .umd-c:not(.is-plus){height:40px;padding-top:2px}'));
  assert.ok(css.includes('transition:height .32s cubic-bezier(.33,1,.68,1),padding-top .32s cubic-bezier(.33,1,.68,1),opacity .22s,background .2s}'), 'le passage aux exemples glisse aussi');
  d.close();
});

test('« Enlève Ses colonnes » : la bulle d’une table touchée dit ses liens, sans bouton', () => {
  const ctx = schema(), d = new SQL.Database();
  d.run(ctx.DEFI_BASES.voyages.sql);
  const m = ctx.umlModele(d, tablesDe(d)), p = ctx.umlPlan(m, 340, true, new Set());
  const b = ctx.umlBulle(m, {t: 'avis'}, p.T);
  assert.ok(b.includes('<span class="umd-bh"><b class="umd-bn">avis</b></span>') && !b.includes('Ses colonnes') && !b.includes('<button type="button" class="umd-bgo"'));
  assert.ok(/<span class="sr">avis désigne clients par \w+<\/span>/.test(b) && /<span class="sr">avis désigne circuits par \w+<\/span>/.test(b));
  assert.ok(!css.includes('.umd-bgo') && !css.includes('@keyframes umdGo'));
  d.close();
});

/* Les tables de la Console, rendues pour de vrai : la base Agence de voyages, en lecture seule. */
function console0752(ouverte) {
  const els = {}, d = new SQL.Database();
  const el = id => (els[id] ||= {id, innerHTML: '', textContent: '', hidden: false, querySelector: () => null, classList: {add() {}}});
  const ctx = vm.createContext({SCHEMA_META: [], esc, escAttr, plur, document: {getElementById: el, querySelector: () => null}, CSS: {escape: s => s},
    activeDbId: 'voyages', openTableSchema: ouverte || null, tableBaselines: {}, tableBaselineKey: n => n, isDemoDb: () => true, hasTableBaseline: () => false,
    listTables: x => tablesDe(x), tableNote: () => '', colNote: (b, t, c) => t === 'avis' && c === 'note' ? 'La note, de 1 à 5.' : '',
    renderConsoleSchemaSummary() {}, dbWsDiff: () => ({}), prefersReduceMotion: () => true,
    NOTE_PLUS_SVG: '<svg/>', CONSOLE_EDIT_SVG: '<svg/>', CONSOLE_RESET_SVG: '<svg/>', CONSOLE_TRASH_SVG: '<svg/>', INFO_SVG: '<svg/>'});
  vm.runInContext(UML + cut('const TBL_GRILLE_SVG=', 'function dbWsDiff(') + fn('renderDbWorkspace'), ctx);
  vm.runInContext(BASES, ctx);
  d.run(ctx.DEFI_BASES.voyages.sql);
  ctx.activeDb = () => d;
  ctx.renderDbWorkspace();
  const m = ctx.umlModele(d, tablesDe(d)), T = ctx.umlTeintes(m, ctx.umlOrdre(m).ordre);
  d.close();
  return {h: els['db-tables'].innerHTML, T};
}

test('« base » : les tables de la Console sont les cartes du schéma, chacune à sa couleur ; repliées, leurs clés et « +N colonnes »', () => {
  const {h, T} = console0752();
  const carte = t => { const i = h.indexOf(`data-table="${t}"`); assert.ok(i >= 0, t); return h.slice(i, h.indexOf('</div>\n    </div>', i)); };
  /* La couleur de la table dans le schéma : clients, désignée par avis et reservations, a la sienne ; avis, que rien ne désigne,
     l’encre douce */
  assert.ok(h.includes(`data-table="clients" style="--c:${T.clients[0]};--cs:${T.clients[1]};--ci:${T.clients[2]}"`));
  assert.ok(h.includes('data-table="avis" style="--c:#8E87B8;--cs:#F3F1FA;--ci:#4A4370"'));
  const avis = carte('avis');
  assert.ok(avis.includes('aria-label="Table avis, 25 lignes, 6 colonnes">') && avis.includes('<b class="tbu-n">avis</b><small class="tbu-k" aria-hidden="true">25</small>'));
  assert.ok(avis.includes('<div class="tbu-c is-pk"><span class="tbu-r"><i class="is-pk">PK</i><span class="tbu-cn">id</span><em>INTEGER</em></span></div>'));
  assert.ok(avis.includes(`<div class="tbu-c is-fk is-lien" style="--lc:${T.clients[0]};--lcs:${T.clients[1]};--lci:${T.clients[2]}"><span class="tbu-r"><i class="is-fk">FK</i><span class="tbu-cn">client_<wbr>id</span><b class="tbu-v">→ clients</b></span></div>`),
    'la clé étrangère dit où elle va, à la couleur de la table désignée');
  assert.ok(avis.includes('aria-label="Déplier la table avis : ses 6 colonnes">+3 colonnes</button>') && !avis.includes('<span class="tbu-cn">note</span>'), 'repliée : ses clés, puis « +3 colonnes »');
  assert.ok(!avis.includes('tbu-x') && !avis.includes('tbl-corps'), 'repliée : ni exemples, ni description, ni actions');
  assert.ok(!h.includes('tbl-ico') && !h.includes('tbl-chev') && !h.includes('Structure de la table'), 'plus l’ancienne carte');
});

test('« base » : dépliée, toutes ses colonnes avec leur cadre « ex : » et ce qu’elles veulent dire, ses liens allumés, puis le reste', () => {
  const {h, T} = console0752('avis');
  const i = h.indexOf('data-table="avis"'), avis = h.slice(i, h.indexOf('data-table="circuits"'));
  assert.ok(h.includes('class="db-tblock tbu is-open" data-table="avis"') && avis.includes('aria-expanded="true"'));
  assert.ok(avis.includes(`<div class="tbu-c is-fk is-lien is-on" style="--lc:${T.circuits[0]};--lcs:${T.circuits[1]};--lci:${T.circuits[2]}"><span class="tbu-r"><i class="is-fk">FK</i><span class="tbu-cn">circuit_<wbr>id</span><b class="tbu-v">→ circuits</b></span><span class="tbu-xl"><span class="tbu-x"><small>ex&nbsp;:</small><b>11</b></span></span></div>`),
    'comme une table touchée du schéma : ses liens allumés, son exemple');
  assert.ok(avis.includes('<span class="tbu-cn">note</span><em>INTEGER</em></span><span class="tbu-xl"><span class="tbu-x"><small>ex&nbsp;:</small><b>5</b></span><small class="tbu-d">La note, de 1 à 5.</small></span>'), 'le cadre, puis ce que veut dire la colonne');
  assert.ok(!avis.includes('+3 colonnes') && avis.indexOf('<div class="tbl-corps tbu-haut">') < avis.indexOf('<span class="tbu-cn">date_<wbr>avis</span>'), '21 h 24 : la description et les actions, puis toutes ses colonnes');
  assert.ok(avis.indexOf('Aucune description ajoutée') < avis.indexOf('<span>Voir les données</span>') && !avis.includes('drop-table'), 'une base d’entraînement : rien à supprimer');
  /* Les styles : ceux des cartes du schéma, à la taille de la Console */
  for (const k of ['html.lq #scr-console .console-schema-panel .db-tblock.tbu.is-open{box-shadow:0 0 0 2.5px var(--c),0 3px 0 2.5px var(--c)}',
    'html.lq #scr-console .tbu-h{display:flex;align-items:center;gap:8px;width:100%;min-height:44px;', 'background:var(--cs);box-shadow:inset 4px 0 0 var(--c),inset 0 -2px 0 var(--line);',
    'html.lq #scr-console .tbu-c i.is-pk{background:var(--sun);color:#1B1640}', 'html.lq #scr-console .tbu-c.is-fk .tbu-cn{color:#0F7A4C}',
    'html.lq #scr-console .tbu-c.is-on{background:var(--lcs,var(--cs))}', 'html.lq #scr-console .tbu-c.is-lien .tbu-x{background:var(--lcs);box-shadow:none}',
    'html.lq #scr-console .db-tblock:is(.is-more,.is-new,.is-changed) .tbu-k{animation:dbBump'])
    assert.ok(css.includes(k), k);
  assert.ok(!app.includes('const TBL_CHEV_SVG='), 'l’ancien chevron est parti');
});
