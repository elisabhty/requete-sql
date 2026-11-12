/* Elisa, 5 novembre, 7 h 38 : « Comment rendre plus clairs les liens ? Pour chaque colonne, faire un cadre exemple de donnée
   (ex : 4, ex : menu). Peut-être pliable, mais en tout cas de manière UI/UX, toujours. »
   Les liens : chaque table désignée a sa couleur, et chaque trait prend la couleur de la table qu’il désigne, comme ses
   multiplicités ; la clé étrangère dit où elle va (« → categories ») ; une table touchée allume ses liens, efface les autres, et une
   bulle dit en clair ce qu’elle désigne et qui la désigne ; sous la toile, « Les liens en clair » (pliables) : chaque lien en deux
   phrases et sa jointure toute prête. Les exemples : sous chaque colonne, son cadre « ex : 4 », pris dans une même ligne de la
   table ; l’interrupteur « Exemples » les plie et les déplie (l’appareil s’en souvient). Les onglets de table ont aussi leur cadre. */
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

const initSqlJs = createRequire(import.meta.url)(path.join(ROOT, 'vendor/sqljs/sql-wasm.js'));
const SQL = await initSqlJs({locateFile: f => path.join(ROOT, 'vendor/sqljs', f)});
const ctx = vm.createContext({SCHEMA_META: [], esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  escAttr: s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  plur: (n, mot, pl) => n + ' ' + (Math.abs(n) > 1 ? (pl || mot + 's') : mot)});
vm.runInContext(cut('function quoteIdent(name){', '\n') + '\n' + cut('function tableRowCount(database,name){', '\n}\n') + '\n}\n'
  + cut('function guessFkTarget(col,tables){', 'function courseTableNames(){')
  + cut('const UML_TEINTES=', 'let schCtx=null;')
  + ';this.umlModele=umlModele;this.umlPlan=umlPlan;this.umlHtml=umlHtml;this.umlPanneau=umlPanneau;this.schemaExemples=schemaExemples;'
  + 'this.umlBulle=umlBulle;this.umlAllumes=umlAllumes;this.umlJoin=umlJoin;this.umlPhrases=umlPhrases;this.umlCle=umlCle;this.UML_G=UML_G;'
  + 'this.UML_TEINTES=UML_TEINTES;this.UML_NEUTRE=UML_NEUTRE;this.umlEx=umlEx;', ctx);
vm.runInContext(cut('const DEFI_BASES={', '\nconst ').replace('const DEFI_BASES=', 'DEFI_BASES='), ctx);
const tablesDe = d => d.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0].values.map(v => v[0]);
const ouvrir = sql => { const d = new SQL.Database(); d.run(sql); return d; };
const pur = x => JSON.parse(JSON.stringify(x));

test('les exemples : les valeurs d’une même ligne (la quatrième), la première valeur non vide sinon, NULL pour une colonne vide', () => {
  const d = ouvrir(ctx.DEFI_BASES.wok.sql), m = ctx.umlModele(d, tablesDe(d));
  for (const t of m.tables) {
    const r = d.exec(`SELECT * FROM "${t.name}" LIMIT 1 OFFSET ${Math.min(3, t.n - 1)}`)[0];
    for (const c of t.cols) {
      const v = r.values[0][r.columns.indexOf(c.c)];
      if (v != null) assert.equal(c.ex.v, typeof v === 'number' ? String(+v.toFixed(4)) : String(v).replace(/\s+/g, ' ').trim().slice(0, 60), `${t.name}.${c.c}`);
      else assert.ok(c.ex, `${t.name}.${c.c} : un exemple quand même`);
    }
  }
  assert.deepEqual(pur(m.tables.find(t => t.name === 'plats').cols.map(c => c.ex.v)), ['4', 'Raviolis vapeur', '1', '6', '1'], 'le plat 4 : son nom, sa catégorie, son prix');
  d.close();
  const e = ouvrir(`CREATE TABLE notes(id INTEGER PRIMARY KEY, texte TEXT, vide TEXT, prix REAL, image BLOB);
    INSERT INTO notes VALUES (1,'  un   texte  ',NULL,12.5,NULL),(2,'',NULL,0.1234567,x'00ff');
    CREATE TABLE rien(id INTEGER PRIMARY KEY, nom TEXT);`);
  const ex = ctx.schemaExemples(e, 'notes', 2);
  assert.deepEqual(pur(ex), {id: {v: '2', k: 'num'}, texte: {v: "''", k: 'txt'}, vide: {v: 'NULL', k: 'null'}, prix: {v: '0.1235', k: 'num'}, image: {v: '(binaire)', k: 'bin'}},
    'deux lignes : la dernière ; une chaîne vide se lit « \'\' », une colonne toujours vide « NULL »');
  assert.deepEqual(pur(ctx.schemaExemples(e, 'rien', 0)), {}, 'une table sans ligne : pas d’exemple');
  assert.deepEqual(pur(ctx.schemaExemples(null, 'notes', 2)), {}, 'pas encore de base : pas d’exemple');
  const f = ouvrir(`CREATE TABLE t(id INTEGER PRIMARY KEY, a TEXT); INSERT INTO t VALUES (1,'x'),(2,'y'),(3,'z'),(4,NULL),(5,'w');`);
  assert.equal(ctx.schemaExemples(f, 't', 5).a.v, 'x', 'vide dans la quatrième ligne : la première valeur non vide');
  e.close(); f.close();
});

/* Les mêmes règles qu’au 7 h 03 (rien ne se touche), exemples dépliés : chaque colonne sur 40 px (6 novembre, 7 h 52), le trait au
   milieu de son nom, 2 px sous le haut de sa ligne. */
function verifier(m, p, nom) {
  assert.equal(p.cartes.length, m.tables.length, nom);
  assert.equal(p.arcs.length, m.liens.length, nom);
  const parY = [...p.cartes].sort((a, b) => a.y - b.y);
  for (let k = 1; k < parY.length; k++) assert.ok(parY[k].y >= parY[k - 1].y + parY[k - 1].h + 10, `${nom} : ${parY[k].name} sous ${parY[k - 1].name}`);
  const carte = Object.fromEntries(p.cartes.map(c => [c.name, c]));
  for (const c of p.cartes) {
    assert.ok(c.x >= 0 && c.x + c.w <= p.W && c.y + c.h <= p.H, `${nom} : ${c.name} dans la toile`);
    assert.equal(c.h, 34 + 14 + (c.cols.length ? c.cols.length * c.L : 20) + (c.plus ? 20 : 0), `${nom} : ${c.name}, sa hauteur`);
  }
  for (const a of p.arcs) {
    assert.ok(a.xl < carte[a.de].x || a.xl > carte[a.de].x + carte[a.de].w, `${nom} : ${a.de} → ${a.vers}, hors des cartes`);
    const c = carte[a.de], i = c.cols.findIndex(x => x.c === a.col);
    if (i >= 0) assert.equal(a.y1, c.y + 34 + 7 + i * c.L + (c.L > 20 ? 2 : 0) + 10, `${nom} : ${a.de}.${a.col}, le trait au milieu du nom`);
  }
  for (const cote of ['g', 'd']) {
    const ps = p.arcs.filter(a => a.cote === cote).flatMap(a => a.lab).sort((a, b) => a.y - b.y);
    for (let k = 1; k < ps.length; k++) assert.ok(ps[k].y >= ps[k - 1].y + ps[k - 1].h - 0.5 || Math.abs(ps[k].y - ps[k - 1].y) < 0.01 && ps[k].t === ps[k - 1].t, `${nom} : multiplicités (${cote})`);
  }
}

test('exemples dépliés ou pliés : chaque base des défis reste lisible, sur l’iPhone comme sur l’ordinateur', () => {
  /* 6 novembre, 7 h 52 (réf. 3 : « l’espace avant la colonne est un peu faible ») : 40 px par colonne et son exemple, dont 2 au-dessus. */
  assert.equal(ctx.UML_G.ligneEx, 40);
  assert.equal(ctx.UML_G.haut, 2);
  assert.equal(ctx.umlEx, true, 'les exemples sont dépliés d’abord');
  for (const [id, b] of Object.entries(ctx.DEFI_BASES)) {
    const d = ouvrir(b.sql), m = ctx.umlModele(d, tablesDe(d));
    for (const W of [322, 622]) for (const ex of [true, false]) {
      const p = ctx.umlPlan(m, W, ex);
      assert.equal(p.ex, ex);
      for (const c of p.cartes) assert.equal(c.L, ex && c.cols.some(x => x.ex) ? 40 : 20, `${id} : ${c.name}`);
      verifier(m, p, `${id} (${W} px, exemples ${ex ? 'dépliés' : 'pliés'})`);
    }
    d.close();
  }
  /* Une table sans ligne n’a pas d’exemple : ses colonnes restent sur 20 px, même dépliés */
  const d = ouvrir(`CREATE TABLE clients(id INTEGER PRIMARY KEY, nom TEXT); INSERT INTO clients VALUES (1,'Ana');
    CREATE TABLE commandes(id INTEGER PRIMARY KEY, client_id INTEGER REFERENCES clients(id));`);
  const p = ctx.umlPlan(ctx.umlModele(d, tablesDe(d)), 322, true);
  assert.deepEqual(pur(p.cartes.map(c => [c.name, c.L])), [['clients', 40], ['commandes', 20]]);
  assert.ok(ctx.umlHtml(p).includes('<div class="umd-t is-ex"') && ctx.umlHtml(p).includes('<div class="umd-t"'));
  d.close();
});

test('les couleurs des liens : chaque table désignée la sienne, le trait et ses multiplicités à la couleur de la table désignée', () => {
  for (const [id, b] of Object.entries(ctx.DEFI_BASES)) {
    const d = ouvrir(b.sql), m = ctx.umlModele(d, tablesDe(d)), p = ctx.umlPlan(m, 322, true);
    const cibles = new Set(m.liens.map(l => l.vers)), carte = Object.fromEntries(p.cartes.map(c => [c.name, c]));
    const couleurs = [...cibles].map(n => carte[n].teinte[0]);
    assert.equal(new Set(couleurs).size, Math.min(cibles.size, 7), `${id} : une couleur par table désignée`);
    for (const c of p.cartes) if (!cibles.has(c.name)) assert.deepEqual(pur(c.teinte), pur(ctx.UML_NEUTRE), `${id} : ${c.name}, que rien ne désigne, à l’encre douce`);
    for (const a of p.arcs) {
      assert.deepEqual([a.c, a.cs, a.ci], pur(carte[a.vers].teinte), `${id} : ${a.de} → ${a.vers}, la couleur de ${a.vers}`);
      assert.equal(m.liens[a.i].col, a.col);
    }
    const h = ctx.umlHtml(p);
    for (const a of p.arcs) {
      assert.ok(h.includes(`<path class="umd-a" d="${a.d}" data-i="${a.i}"`), 'le trait et son lien');
      assert.ok(h.includes(`data-c="${a.col}" style="--lc:${a.c};--lcs:${a.cs};--lci:${a.ci}"><span class="umd-r">`) && h.includes(`<i class="is-fk">FK</i><span>${a.col}</span><b class="umd-v">→ ${a.vers}</b></span>`), `${id} : ${a.de}.${a.col} dit où elle va`);
    }
    d.close();
  }
});

test('les cartes : un cadre « ex : » sous chaque colonne, à la couleur du lien pour une clé étrangère ; NULL en italique', () => {
  const d = ouvrir(ctx.DEFI_BASES.wok.sql), m = ctx.umlModele(d, tablesDe(d)), h = ctx.umlHtml(ctx.umlPlan(m, 322, true));
  assert.ok(h.includes('<span class="umd-c is-pk" data-c="id"><span class="umd-r"><i class="is-pk">PK</i><span>id</span><em>INTEGER</em></span><span class="umd-x"><small>ex&nbsp;:</small><b>4</b></span></span>'));
  assert.ok(h.includes('<span class="umd-c" data-c="nom"><span class="umd-r"><span>nom</span><em>VARCHAR</em></span><span class="umd-x"><small>ex&nbsp;:</small><b>Raviolis vapeur</b></span></span>'));
  assert.ok(h.includes('<b class="umd-v">→ categories</b></span><span class="umd-x"><small>ex&nbsp;:</small><b>1</b></span>'));
  /* 9 h 18 (« quand on clique sur Exemples, j’aime pas que ça saute ») : pliés, les cadres restent dans la page, la carte les cache
     (sa hauteur passe de 36 à 20 px par ligne, en douceur) */
  const sansEx = ctx.umlHtml(ctx.umlPlan(m, 322, false));
  assert.ok(!sansEx.includes('class="umd-t is-ex') && sansEx.includes('class="umd-x'), 'pliés : les cadres cachés par la carte');
  assert.ok(css.includes('html.lq #schema-sheet .umd-t:not(.is-ex) .umd-x{opacity:0}'));
  assert.ok(h.includes('<button type="button" class="umd-hb" aria-pressed="false"') && h.includes('onclick="umlCarte(this,event)"') && h.includes('aria-label="Table plats, 5 colonnes, 20 lignes : allumer ses relations"'));
  d.close();
  const e = ouvrir(`CREATE TABLE a(id INTEGER PRIMARY KEY, x TEXT); INSERT INTO a VALUES (1,NULL); CREATE TABLE b(id INTEGER PRIMARY KEY, a_id INTEGER REFERENCES a(id)); INSERT INTO b VALUES (1,1);`);
  assert.ok(ctx.umlHtml(ctx.umlPlan(ctx.umlModele(e, tablesDe(e)), 322, true)).includes('<span class="umd-x is-null"><small>ex&nbsp;:</small><b>NULL</b></span>'));
  e.close();
});

test('la toile touchée : les liens d’une table ou un seul lien, leurs tables et leurs deux colonnes ; la bulle en clair', () => {
  const d = ouvrir(ctx.DEFI_BASES.wok.sql), m = ctx.umlModele(d, tablesDe(d)), p = ctx.umlPlan(m, 322, true);
  const a = ctx.umlAllumes(m, {t: 'plats'});
  assert.deepEqual(pur([...a.on].map(i => m.liens[i].de + '.' + m.liens[i].col)).sort(), ['lignes_commande.plat_id', 'plats.categorie_id', 'plats_ingredients.plat_id']);
  assert.deepEqual(pur([...a.tables]).sort(), ['categories', 'lignes_commande', 'plats', 'plats_ingredients']);
  for (const k of ['plats\u0001categorie_id', 'categories\u0001id', 'plats\u0001id', 'lignes_commande\u0001plat_id']) assert.ok(a.cols.has(k), k);
  assert.equal(ctx.umlAllumes(m, null).on.size, 0);
  const i = m.liens.findIndex(l => l.de === 'avis' && l.col === 'commande_id'), un = ctx.umlAllumes(m, {i});
  assert.deepEqual(pur([...un.on]), [i]);
  assert.deepEqual(pur([...un.tables]).sort(), ['avis', 'commandes']);
  /* La bulle d’une table : ce qu’elle désigne, qui la désigne (chacune à toucher) ; plus de « Ses colonnes » (6 novembre, 7 h 52) */
  const b = ctx.umlBulle(m, {t: 'plats'}, p.T);
  assert.ok(b.includes('<span class="umd-bh"><b class="umd-bn">plats</b></span>') && !b.includes('Ses colonnes') && !b.includes('umd-bgo'));
  /* 9 h 18 (« voir avec une flèche animée plutôt ») : plus de « Désigne » ni de « Désignée par » : la table, une flèche, la table
     qu’elle désigne (à sa couleur) ; les tables qui la désignent, une flèche, elle. Les mots restent pour les lecteurs d’écran. */
  const fl = vm.runInContext('UML_FLECHE', ctx);
  assert.ok(!b.includes('<span>Désigne</span>') && !b.includes('<span>Désignée par</span>'));
  /* 9 novembre, 21 h 15 : une relation par ligne, « Elle désigne » / « La désignent », la colonne dessous */
  assert.ok(b.includes('<p class="umd-bcap">Elle désigne</p><p class="umd-bl is-rel" style="--lc:#2F80ED"><span class="sr">plats désigne categories par ') && b.includes('>plats</b>' + fl + '<button type="button" class="umd-bp" style="--c:#2F80ED;')
    && b.includes('data-t="categories" onclick="umlFocusTable(this.dataset.t,true)">categories</button></p><small class="umd-bvia"><code>plats.'));
  assert.ok(b.includes('<p class="umd-bcap">La désignent</p>') && /<span class="sr">lignes_commande désigne plats par \w+<\/span>/.test(b) && /<span class="sr">plats_ingredients désigne plats par \w+<\/span>/.test(b));
  assert.ok(b.includes('>lignes_commande</button>' + fl + '<b class="umd-bme"'), 'chaque table qui la désigne, sa flèche, elle');
  assert.ok(b.includes('onclick="umlFocus(null)" aria-label="Tout rallumer"'));
  assert.ok(/désigne serveurs par \w+<\/span>/.test(ctx.umlBulle(m, {t: 'serveurs'}, p.T)) && !ctx.umlBulle(m, {t: 'serveurs'}, p.T).includes('<span class="sr">serveurs désigne '));
  /* La bulle d’un lien : ses phrases, sa jointure */
  const bl = ctx.umlBulle(m, {i}, p.T);
  assert.ok(bl.startsWith('<div class="umd-bc is-lien" style="--c:') && bl.includes('<code class="umd-j">FROM avis JOIN commandes ON avis.commande_id = commandes.id</code>'));
  d.close();
  const e = ouvrir(`CREATE TABLE seule(id INTEGER PRIMARY KEY); CREATE TABLE autre(id INTEGER PRIMARY KEY);`);
  const me = ctx.umlModele(e, tablesDe(e));
  assert.ok(ctx.umlBulle(me, {t: 'seule'}, {}).includes('<p class="umd-bl is-vide">Aucune relation&nbsp;: elle ne désigne aucune table, et aucune ne la désigne.</p>'));
  e.close();
});

test('les liens en clair : deux phrases (l’élision comprise), la jointure toute prête, l’alias d’une table qui se désigne', () => {
  const d = ouvrir(ctx.DEFI_BASES.wok.sql), m = ctx.umlModele(d, tablesDe(d));
  const l = m.liens.find(x => x.de === 'avis' && x.col === 'client_id');
  assert.deepEqual(pur(ctx.umlPhrases(l)), ['Chaque ligne d’<code>avis</code> désigne exactement une ligne de <code>clients</code>.',
    'Une ligne de <code>clients</code> peut être désignée par plusieurs lignes d’<code>avis</code>, ou par aucune.']);
  const c = m.liens.find(x => x.de === 'commandes' && x.col === 'client_id');
  assert.equal(ctx.umlPhrases(c)[0], 'Chaque ligne de <code>commandes</code> désigne une ligne de <code>clients</code>, ou aucune (sa clé peut être vide).');
  assert.equal(ctx.umlPhrases(m.liens.find(x => x.de === 'avis' && x.col === 'commande_id'))[1], 'Une ligne de <code>commandes</code> est désignée par une ligne d’<code>avis</code> au plus (la clé est unique).');
  assert.equal(ctx.umlJoin(m, c), 'FROM commandes JOIN clients ON commandes.client_id = clients.id');
  const h = ctx.umlPanneau(m, 322, true);
  assert.ok(h.includes('<details class="umd-liens" id="umd-liens" ontoggle="umlListeToggle(this)">'), 'pliée d’abord');
  assert.ok(h.includes('<b>Les relations en clair</b><small>10</small>'));
  assert.equal((h.match(/<li><button type="button" class="umd-li" data-i="\d+" style="--lc:/g) || []).length, 10);
  assert.ok(h.includes('onclick="umlFocusLien(0)"><span class="umd-lt"><code>avis.client_id</code><span class="umd-fl" aria-hidden="true">→</span><span class="sr">désigne</span><code>clients.id</code></span><span class="umd-lp"><b>1</b>'));
  d.close();
  /* Une table qui se désigne : un alias tiré du nom de sa clé ; un nom à espaces, entre guillemets ; la clé primaire désignée sans être nommée */
  const e = ouvrir(`CREATE TABLE employes(id INTEGER PRIMARY KEY, chef_id INTEGER REFERENCES employes(id));
    CREATE TABLE "Ventes 2024"(num INTEGER PRIMARY KEY, employe_id INTEGER REFERENCES employes);`);
  const me = ctx.umlModele(e, tablesDe(e));
  assert.equal(ctx.umlJoin(me, me.liens.find(x => x.de === 'employes')), 'FROM employes JOIN employes AS chef ON employes.chef_id = chef.id');
  assert.equal(ctx.umlJoin(me, me.liens.find(x => x.de === 'Ventes 2024')), 'FROM "Ventes 2024" JOIN employes ON "Ventes 2024".employe_id = employes.id');
  assert.equal(ctx.umlCle(me, me.liens.find(x => x.de === 'Ventes 2024')), 'id');
  e.close();
});

test('le panneau : l’interrupteur « Exemples », « Les liens en clair », la bulle, la légende et la note', () => {
  const d = ouvrir(ctx.DEFI_BASES.zoo.sql), m = ctx.umlModele(d, tablesDe(d));
  const h = ctx.umlPanneau(m, 322, true, true), plie = ctx.umlPanneau(m, 322, true, false);
  assert.ok(h.includes('<div class="umd-outils"><button type="button" class="umd-bt is-ex" aria-pressed="true" onclick="umlBasculeEx(this)" aria-label="Exemples de données"><span class="umd-sw" aria-hidden="true"></span>Exemples</button><button type="button" class="umd-bt" onclick="umlVersLiens()">'));
  assert.ok(plie.includes('aria-pressed="false" onclick="umlBasculeEx(this)"') && !plie.includes('class="umd-t is-ex'));
  assert.ok(h.includes('<div class="umd-toile" id="umd-toile" onclick="umlToileClic(event)">'));
  assert.ok(h.includes('<div class="umd-bulle" id="umd-bulle" role="status" aria-live="polite" hidden></div>'));
  assert.ok(h.includes('<span class="umd-lg is-v"><b>→</b>la table qu’elle désigne</span>') && h.includes('<span class="umd-lg is-x"><b>ex&nbsp;:</b>une valeur de la table</span>'));
  assert.ok(h.includes('Chaque trait va d’une clé étrangère (FK) à la clé primaire (PK) qu’elle désigne, dans la couleur de cette table. Touche une table&nbsp;: ses relations s’allument.'));
  d.close();
  /* Une base sans ligne ni lien : ni interrupteur, ni liste, ni légende des liens */
  const e = ouvrir(`CREATE TABLE a(id INTEGER PRIMARY KEY); CREATE TABLE b(id INTEGER PRIMARY KEY);`);
  const v = ctx.umlPanneau(ctx.umlModele(e, tablesDe(e)), 322, true);
  assert.ok(!v.includes('umd-outils') && !v.includes('umd-liens') && !v.includes('class="umd-lg is-v"') && v.includes('<p class="umd-note">Dessiné à partir de la base&nbsp;:'));
  e.close();
});

test('les gestes : toucher une table l’allume (encore : tout se rallume), la toile vide éteint, la liste défile jusqu’au lien', () => {
  const ca = cut('function umlCarte(el,e){', '\n');
  assert.ok(ca.includes('umlFocus(umlSel&&umlSel.t===t?null:{t})') && ca.includes("e.target.closest('.umd-pli,.is-deplier'))return;"), 'la flèche « plier » (et « +4 colonnes », qui déplie) n’allume rien');
  assert.ok(cut('function umlToileClic(e){', '\n').includes("e.target.closest('.umd-t')))umlFocus(null)"));
  assert.ok(cut('function umlFocusLien(i){', '\n').includes('umlFocus({i:+i},true)'));
  const ap = cut('function umlAppliquer(){', '\n}\n');
  for (const k of ["plan.classList.toggle('is-focus',!!s&&(s.i!=null||on.size>0));", "x.classList.toggle('is-on',(x.dataset.is||x.dataset.i).split(' ').some(i=>on.has(+i)))", "b.classList.toggle('is-sel',sel); b.classList.toggle('is-lie',!sel&&tables.has(t)); if(hb)hb.setAttribute('aria-pressed',String(sel));",
    "r.classList.toggle('is-on',!!t&&cols.has(t.dataset.t+'\\u0001'+r.dataset.c))", "bulle.hidden=!s;"])
    assert.ok(ap.includes(k), k);
  const bas = cut('function umlBasculeEx(btn){', '\n}\n');
  assert.ok(bas.includes("localStorage.setItem('rq-uml-ex',umlEx?'1':'0')") && bas.includes('umlMorph(umlPlan(umlDernier.m,umlDernier.W,umlEx,umlPliesDe()));'), '9 h 18 : les cartes changent de taille en douceur');
  assert.ok(app.includes("let umlEx=umlPref('rq-uml-ex',true);") && cut('function umlListeToggle(d){', '\n').includes("localStorage.setItem('rq-uml-liens'"));
  const des = cut('function umlDessiner(maj){', '\n}\n');
  assert.ok(des.includes("t.firstElementChild.classList.add('is-maj')") && des.includes('body.scrollTop+=apres.getBoundingClientRect().top-avant;') && des.includes('umlAppliquer();'));
  assert.ok(cut('function umlDefiler(){', '\n}\n').includes("behavior:umlDoux()?'smooth':'auto'"));
  assert.ok(cut('function umlSurligne(el,on,e){', '\n}\n').includes("x.classList.toggle('is-sur',!!on)"), 'à la souris : épaissis, sans rien éteindre');
  assert.ok(cut('function renderSchemaSheet(){', 'const schTabSel={},schBaseOuverte={};').includes('umlSel=null;'), 'une autre base : rien d’allumé');
});

test('les onglets de table : chaque colonne a son cadre « ex : », la clé étrangère y dit où elle va', () => {
  const r = cut('function renderSchemaSheet(){', 'const schTabSel={},schBaseOuverte={};');
  assert.ok(r.includes('const exs=mt?Object.fromEntries(mt.cols.map(c=>[c.c,c.ex])):schemaExemples(database,name,n);'), 'les mêmes valeurs que sur le schéma UML');
  /* 9 novembre, 21 h 30 : comme sa carte dans la Console : « → la table » à droite, le cadre « ex : » dessous */
  assert.ok(r.includes('const droite=c.ref?`<b class="cref">→ ${esc(c.ref)}</b>`:`<span class="ct">${esc(typeof umlType===\'function\'?umlType(c.t):c.t)}</span>`;') && r.includes('<span class="cxl">${x?`<span class="cx${x.k===\'null\'?\' is-null\':\'\'}"><small>ex&nbsp;:</small><b>${esc(x.v)}</b></span>`:\'\'}'));
  assert.ok(!r.includes('${c.ref?`<span class="cref">→ ${esc(c.ref)}</span>`:\'\'}\n        <span class="ct">'), '« → categories » ne repousse plus le type à la ligne');
  for (const k of ['html.lq #schema-sheet .sch-col .cxl{flex-basis:100%;order:9;', 'html.lq #schema-sheet .sch-col .cx{display:inline-flex;align-items:center;gap:5px;',
    'html.lq #schema-sheet .sch-col .cx.is-fk{background:#EAFBF2;', 'html.lq #schema-sheet .sch-col .cx.is-null b{font-style:italic;'])
    assert.ok(css.includes(k), k);
});

test('la DA : les traits en couleur, la table touchée et le reste effacé, la bulle collée en bas, la liste pliable, les animations', () => {
  for (const k of ['html.lq #schema-sheet .umd-a{fill:none;stroke:var(--lc,#9A92C9);stroke-width:2.4;', 'html.lq #schema-sheet .umd-a:is(.is-on,.is-sur){stroke-width:3.4;opacity:1}',
    'html.lq #schema-sheet .umd-m:is(.is-on,.is-sur) rect{fill:var(--lc)}', 'html.lq #schema-sheet .umd-plan.is-focus .umd-a:not(.is-on){opacity:.1}',
    'html.lq #schema-sheet .umd-plan.is-focus .umd-t:not(.is-sel):not(.is-lie){opacity:.4;filter:saturate(.35)}', 'html.lq #schema-sheet .umd-t.is-sel::after{box-shadow:inset 0 0 0 2.5px var(--c)}',
    'html.lq #schema-sheet .umd-t.is-ex .umd-c:not(.is-plus){height:40px;padding-top:2px}', 'html.lq #schema-sheet .umd-c.is-on{background:var(--lcs,var(--cs))}',
    'html.lq #schema-sheet .umd-v{flex:0 3 auto;min-width:34px;max-width:58%;margin-left:auto;', 'html.lq #schema-sheet .umd-x{display:flex;align-items:center;gap:4px;align-self:flex-start;max-width:100%;height:14px;',
    'html.lq #schema-sheet .umd-bulle{position:sticky;bottom:-6px;z-index:3;', 'html.lq #schema-sheet .umd-liens[open] .umd-chev{transform:rotate(180deg)}',
    'html.lq #schema-sheet .umd-j{display:block;padding:8px 10px;border-radius:11px;background:var(--code-bg);color:var(--code-ink);',
    'html.lq #schema-sheet .umd-bt.is-ex[aria-pressed="true"] .umd-sw::after{transform:translateX(12px)}',
    /* « backwards » : après l’arrivée, une carte pressée s’enfonce et l’effacement s’applique */
    'html.lq #schema-sheet.on .umd-t{animation:umdCarte .45s cubic-bezier(.2,.8,.3,1.2) backwards;', 'html.lq #schema-sheet.on .umd-a{animation:umdTrait .5s ease-out backwards;',
    'html.lq #schema-sheet.on .umd-plan.is-maj .umd-t{animation:none}', '@keyframes umdTrait{from{opacity:0}}',
    'html[data-motion="reduce"].lq #schema-sheet :is(.umd-t,.umd-a,.umd-m,.umd-x,.umd-bc,.umd-f,.umd-ar-l,.umd-ar-p){animation:none!important}'])
    assert.ok(css.includes(k), k);
  assert.ok(!css.includes('.umd-a{opacity:0;animation') && !css.includes('animation:umdCarte .45s cubic-bezier(.2,.8,.3,1.2) both'), 'plus de remplissage qui fige l’opacité');
  assert.ok(!/:is\([^)]*::after/.test(css), 'pas de pseudo-élément dans :is()');
  assert.ok(/<link rel="stylesheet" href="ludique\.css\?v=\d+">/.test(app), 'la feuille de style est rechargée');
});
