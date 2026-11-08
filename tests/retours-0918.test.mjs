/* Elisa, 5 novembre, 9 h 18 (quatre captures : la bulle d’une table, « Les liens en clair », « Quitter la salle ? », une question en
   salle) : « Voir avec une flèche animée plutôt. Quand on clique sur Exemples, j’aime pas le fait que ça saute un peu. Réf 2 : efface
   les traits de couleur côté du cadre. Pouvoir plier déplier les tables dans Schéma : les tables sont dépliées par défaut. On est
   d’accord que tous ont le même nombre d’indices en même temps. Quand une personne a mis la bonne requête, enlever les +25 aux autres
   (le badge) et mettre une animation pour celui qui les a gagnés. Est-ce que le cadre Quitter la salle est bien centré (écriture à
   l’intérieur) ? En même temps qu’on réfléchit, si quelqu’un a fait une requête fausse, une animation avec son pseudo, comme une
   croix, et pareil quand c’est validé. Réf 4 : les badges du haut sont trop proches de la question. » */
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
const fn = name => cut(`function ${name}(`, '\n}\n') + '\n}\n';
const line = name => cut(`function ${name}(`, '\n') + '\n';

const initSqlJs = createRequire(import.meta.url)(path.join(ROOT, 'vendor/sqljs/sql-wasm.js'));
const SQL = await initSqlJs({locateFile: f => path.join(ROOT, 'vendor/sqljs', f)});
const ctx = vm.createContext({SCHEMA_META: [], esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  escAttr: s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  plur: (n, mot, pl) => n + ' ' + (Math.abs(n) > 1 ? (pl || mot + 's') : mot)});
vm.runInContext(cut('function quoteIdent(name){', '\n') + '\n' + cut('function tableRowCount(database,name){', '\n}\n') + '\n}\n'
  + cut('function guessFkTarget(col,tables){', 'function courseTableNames(){')
  + cut('const UML_TEINTES=', 'let schCtx=null;')
  + ';this.umlModele=umlModele;this.umlPlan=umlPlan;this.umlHtml=umlHtml;this.umlBulle=umlBulle;this.UML_G=UML_G;this.UML_FLECHE=UML_FLECHE;', ctx);
vm.runInContext(cut('const DEFI_BASES={', '\nconst ').replace('const DEFI_BASES=', 'DEFI_BASES='), ctx);
const tablesDe = d => d.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0].values.map(v => v[0]);
const ouvrir = sql => { const d = new SQL.Database(); d.run(sql); return d; };

test('plier une table : elle garde ses clés (ses liens restent sur leurs colonnes), le reste passe dans « +N colonnes » ; dépliée d’abord', () => {
  for (const [id, b] of Object.entries(ctx.DEFI_BASES)) {
    const d = ouvrir(b.sql), m = ctx.umlModele(d, tablesDe(d));
    for (const W of [322, 622]) for (const ex of [true, false]) {
      const libre = ctx.umlPlan(m, W, ex), toutes = new Set(m.tables.map(t => t.name)), p = ctx.umlPlan(m, W, ex, toutes);
      assert.ok(libre.cartes.every(c => !c.plie && !c.caches.length), `${id} : dépliées par défaut`);
      const parY = [...p.cartes].sort((a, b) => a.y - b.y);
      for (let k = 1; k < parY.length; k++) assert.ok(parY[k].y >= parY[k - 1].y + parY[k - 1].h + 10, `${id} : ${parY[k].name} sous ${parY[k - 1].name}`);
      const carte = Object.fromEntries(p.cartes.map(c => [c.name, c]));
      for (const c of p.cartes) {
        assert.ok(c.plie && c.L === 20, `${id} : ${c.name} pliée, sur une ligne par colonne`);
        const vis = c.cols.filter(x => !c.caches.includes(x.c));
        assert.ok(vis.every(x => x.b || m.liens.some(l => (l.de === c.name && l.col === x.c) || l.vers === c.name)), `${id} : ${c.name} ne garde que ses clés`);
        assert.equal(c.h, 34 + 14 + (vis.length ? vis.length * 20 : c.cols.length ? 0 : 20) + (c.plus ? 20 : 0), `${id} : ${c.name}, sa hauteur`);
        const avant = libre.cartes.find(x => x.name === c.name);
        assert.equal(c.cols.length + c.plus - c.caches.length, avant.cols.length + avant.plus, `${id} : ${c.name}, toutes ses colonnes comptées`);
        assert.ok(c.h <= avant.h, `${id} : ${c.name} pliée n’est pas plus haute`);
      }
      for (const a of p.arcs) {
        const c = carte[a.de], vis = c.cols.filter(x => !c.caches.includes(x.c)), i = vis.findIndex(x => x.c === a.col);
        if (i >= 0) assert.equal(a.y1, c.y + 34 + 7 + i * 20 + 10, `${id} : ${a.de}.${a.col}, le trait sur sa colonne restée visible`);
      }
    }
    d.close();
  }
  const d = ouvrir(ctx.DEFI_BASES.wok.sql), m = ctx.umlModele(d, tablesDe(d));
  const h = ctx.umlHtml(ctx.umlPlan(m, 322, true, new Set(['plats'])));
  assert.match(h, /<div class="umd-t is-plie" style="[^"]+" data-t="plats" onclick="umlCarte\(this,event\)"/, 'pliée : sans les exemples');
  assert.ok(h.includes('aria-expanded="false" aria-label="Déplier la table plats" onclick="umlPlier(this,event)">') && h.includes('aria-expanded="true" aria-label="Plier la table categories"'));
  assert.ok(h.includes('<span class="umd-c is-cache" data-c="nom">'), 'la colonne cachée reste dans la page (rien ne saute)');
  /* « +2 colonnes » : un bouton qui déplie la table, sans « Voir » (6 novembre, 7 h 52 : « efface les Voir ») */
  assert.ok(h.includes('<button type="button" class="umd-c is-plus is-deplier" aria-label="Déplier la table plats : ses 5 colonnes" onclick="umlPlier(this,event)"><span>+3 colonnes</span></button>') && h.includes('<span class="umd-c is-plus is-vide"></span>') && !h.includes('Voir'));
  assert.equal((h.match(/is-deplier/g) || []).length, 1, 'dépliées, les autres tables montrent toutes leurs colonnes (commandes et ses huit)');
  d.close();
  assert.ok(app.includes('const umlPlies={};') && fn('umlPlier').includes('if(P.has(t))P.delete(t);else P.add(t);'), 'chaque base garde ses tables pliées le temps de la séance');
  assert.ok(fn('umlCarte').includes("e.target.closest('.umd-pli,.is-deplier'))return;"), 'plier (ni « +2 colonnes ») n’allume pas les liens');
  for (const k of ['html.lq #schema-sheet .umd-pli{flex:none;display:grid;place-items:center;width:28px;height:28px;', 'html.lq #schema-sheet .umd-t.is-plie .umd-pli svg{transform:rotate(-90deg)}',
    'html.lq #schema-sheet .umd-c.is-cache,html.lq #schema-sheet .umd-c.is-plus.is-vide{height:0!important;opacity:0}'])
    assert.ok(css.includes(k), k);
});

test('Exemples et plier sans saut : les cartes, les traits et les pastilles glissent vers leur nouvelle place', () => {
  const mo = fn('umlMorph');
  assert.ok(app.includes('const UML_DUREE=320;'));
  for (const k of ["np.classList.add('is-fixe');", "np.classList.add('is-anim');", 'requestAnimationFrame(pas);', 'body.scrollTop+=dy;', "else np.classList.remove('is-anim');"])
    assert.ok(mo.includes(k), k);
  assert.ok(/prefersReduceMotion\(\)|umlDoux\(\)/.test(mo), 'mouvement réduit : tout se pose d’un coup');
  assert.ok(fn('umlBasculeEx').includes('umlMorph(') && fn('umlPlier').includes('umlMorph('));
  for (const k of ['html.lq #schema-sheet .umd-t:not(.is-ex) .umd-x{opacity:0}', 'transition:height .32s cubic-bezier(.33,1,.68,1)'])
    assert.ok(css.includes(k), k);
});

test('une flèche animée : des points qui coulent sur les liens allumés, la bulle en flèches (les mots pour les lecteurs d’écran)', () => {
  const d = ouvrir(ctx.DEFI_BASES.wok.sql), m = ctx.umlModele(d, tablesDe(d)), p = ctx.umlPlan(m, 322, true), h = ctx.umlHtml(p);
  assert.equal((h.match(/<path class="umd-f" d="/g) || []).length, p.arcs.length, 'un trait de points par lien');
  for (const k of ['html.lq #schema-sheet .umd-f:is(.is-on,.is-sur){opacity:.95;animation:umdFlux .75s linear infinite}', '@keyframes umdFlux{'])
    assert.ok(css.includes(k), k);
  assert.ok(fn('umlAppliquer').includes("plan.querySelectorAll('.umd-a,.umd-m,.umd-f')"), 'touchée, la table fait couler ses liens');
  assert.ok(ctx.UML_FLECHE.includes('class="umd-ar-l"') && ctx.UML_FLECHE.includes('class="umd-ar-p"') && ctx.UML_FLECHE.includes('aria-hidden="true"'));
  const b = ctx.umlBulle(m, {t: 'plats'}, p.T);
  assert.ok(b.includes(ctx.UML_FLECHE) && !b.includes('Désigne') && b.includes('<span class="sr">plats désigne categories</span>'));
  assert.ok(!b.includes('Ses colonnes'), 'plus de « Ses colonnes » (6 novembre, 7 h 52)');
  const auto = ouvrir(`CREATE TABLE employes(id INTEGER PRIMARY KEY, chef_id INTEGER REFERENCES employes(id)); INSERT INTO employes VALUES (1,NULL);`);
  assert.ok(ctx.umlBulle(ctx.umlModele(auto, ['employes']), {t: 'employes'}, {}).includes('<span class="sr">employes se désigne elle-même</span>'));
  auto.close(); d.close();
  for (const k of ['@keyframes umdArL', '@keyframes umdArP'])
    assert.ok(css.includes(k), k);
  assert.ok(!css.includes('@keyframes umdGo') && !css.includes('.umd-bgo'), 'la flèche de « Ses colonnes » est partie avec lui');
});

test('« Les liens en clair » : plus de trait de couleur sur le côté des cadres', () => {
  const r = css.split('\n').filter(l => l.includes('.umd-li'));
  assert.ok(r.length > 0);
  for (const l of r) assert.ok(!/inset \d+px 0 0 var\(--lc/.test(l), l.slice(0, 90));
  assert.ok(css.includes('box-shadow:inset 0 0 0 1.5px var(--line);'), 'un fin contour, sans barre');
});

test('salle : le +25 du premier coup ne va qu’au premier à trouver (entre amis) ; seul, comme avant', () => {
  const c = vm.createContext({JEU_PALIERS: [[60, 200], [120, 175], [180, 150], [240, 125], [300, 100], [420, 75]], JEU_PTS_MIN: 50, JEU_PTS_ESSAI: 25, JEU_PTS_RANG: [50, 30, 20, 10], JEU_NIV_X: {f: 1, m: 2, d: 4}, JEU_NIV_DUREE: {f: 1, m: 3, d: 5}});
  vm.runInContext(line('jeuValeur') + line('jeuPts') + line('jeuNivManche') + fn('jeuRanking') + line('jeuBonusPris'), c);
  c.JEU = {solo: false, me: 'a', rounds: [{found: {a: 30000, b: 20000, c: 40000}, first: {a: 1, b: 1, c: 1}, one: false}]};
  const pur = x => JSON.parse(JSON.stringify(x));
  const rk = pur(vm.runInContext('jeuRanking(0)', c));
  assert.deepEqual(rk.map(x => [x.pid, x.essai]), [['b', 25], ['a', 0], ['c', 0]], 'b a trouvé le premier, du premier coup');
  c.JEU.rounds[0] = {found: {a: 30000, b: 20000}, first: {a: 1}, one: false};
  assert.deepEqual(pur(vm.runInContext('jeuRanking(0)', c)).map(x => x.essai), [0, 0], 'le premier n’a pas trouvé du premier coup : personne ne prend le +25');
  c.JEU.rounds[0] = {found: {a: 20000, b: 20000}, first: {a: 1, b: 1}, one: false};
  assert.deepEqual(pur(vm.runInContext('jeuRanking(0)', c)).map(x => x.essai), [25, 25], 'ex æquo en tête : chacun le sien');
  c.JEU = {solo: true, me: 'a', rounds: [{found: {a: 50000}, first: {a: 1}}]};
  assert.equal(vm.runInContext('jeuRanking(0)[0].essai', c), 25, 'seul : le premier essai juste');
  /* Le badge « +25 » disparaît dès qu’un autre a trouvé */
  c.JEU = {solo: false, me: 'a', rounds: []};
  assert.equal(vm.runInContext("jeuBonusPris({found:{}})", c), false);
  assert.equal(vm.runInContext("jeuBonusPris({found:{a:1}})", c), false, 'moi seul : rien ne change');
  assert.equal(vm.runInContext("jeuBonusPris({found:{b:1}})", c), true);
  assert.equal(vm.runInContext("jeuBonusPris({found:{b:1},one:true})", c), false, 'manche commencée seule : comme seul');
  assert.ok(app.includes("${r.tries||jeuBonusPris(r)?'':`<i class=\"jeu-val-b\" id=\"jeu-val-b\""), 'le badge n’est plus dessiné');
  const found = cut("    case 'found':{", "    case 'react':");
  assert.ok(found.includes('jeuEvt(true,m.pid,name,m.p1===1&&(premier||r.one));') && found.includes('if(r.found[J.me]==null&&!r.one)jeuBonusOut();'), 'il s’envole chez les autres');
  /* Celui qui l’a pris : la pastille « +25 ✨ » saute sur ses points */
  assert.ok(fn('jeuFoundHTML').includes('${x.essai?`<i class="jeu-done-b" aria-hidden="true">+${x.essai} ✨</i>`:\'\'}'), 'le premier coup du niveau : +25, +50 ou +100 (6 novembre, 15 h)');
  for (const k of ['html.lq .jeu-done-b{position:absolute;', '@keyframes jeuDoneB{', '@keyframes jeuDoneEt{']) assert.ok(css.includes(k), k);
  assert.ok(app.includes('Ta première requête exécutée est la bonne. Seul, tu le gardes toujours ; à plusieurs, si personne n’a trouvé avant toi'), 'la règle dite dans « Comment on marque des points »');
});

test('salle : chaque essai des autres passe en haut de l’écran, son pseudo et une croix ou une coche', () => {
  const made = [];
  const el = () => { const e = {children: [], classList: {list: [], add(c) { this.list.push(c); }, contains: () => false}, style: {removeProperty() {}}, attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; }, prepend(x) { this.children.unshift(x); x.parent = this; }, remove() { this.gone = true; if (this.parent) this.parent.children = this.parent.children.filter(y => y !== this); },
    get lastElementChild() { return this.children.at(-1); }}; made.push(e); return e; };
  const body = {appendChild(x) { this.box = x; }};
  const timers = [];
  const c = vm.createContext({document: {body, createElement: el, getElementById: id => (id === 'jeu-evts' ? body.box || null : null)}, setTimeout: (f, ms) => timers.push([f, ms]),
    prefersReduceMotion: () => false, esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'), JEU_PTS_ESSAI: 25,
    JEU_ICO: {check: '<svg class="ok"/>', cross: '<svg class="ko"/>'}, JEU: {me: 'z'}, jeuOrder: () => ['h', 'b', 'c'], jeuInitial: n => String(n)[0].toUpperCase(),
    JEU_NIV_X: {f: 1, m: 2, d: 4}, jeuNivManche: () => 'f', jeuCur: () => 0});
  vm.runInContext(cut('const JEU_KO_MS=', '\nfunction jeuStop(){'), c);
  c.jeuEvt(false, 'b', 'Léa<3');
  const box = body.box;
  assert.equal(box.id, 'jeu-evts');
  assert.equal(box.attrs['aria-hidden'], 'true', 'le lecteur d’écran l’entend déjà par l’annonce (jeuToast)');
  const ko = box.children[0];
  assert.equal(ko.className, 'jeu-evt is-ko');
  assert.equal(ko.innerHTML, '<b class="jeu-av" data-c="1">L</b><span class="jeu-evt-t"><b>Léa&lt;3</b><small>pas encore</small></span><i class="jeu-evt-i"><svg class="ko"/></i>');
  c.jeuEvt(true, 'c', 'Tom', true);
  const ok = box.children[0];
  assert.equal(ok.className, 'jeu-evt is-ok');
  assert.ok(ok.innerHTML.includes('<small>a trouvé</small></span><i class="jeu-evt-i"><svg class="ok"/></i><em class="jeu-evt-b">+25 ✨</em>'), 'le +25 de celui qui l’a pris');
  c.jeuEvt(false, 'b', 'Léa'); c.jeuEvt(false, 'b', 'Léa');
  assert.equal(box.children.length, 3, 'trois au plus');
  assert.deepEqual(timers.slice(0, 2).map(t => t[1]), [2600, 3400], 'elles s’en vont d’elles-mêmes');
  timers[0][0](); assert.ok(ko.classList.list.includes('is-out'));
  const rate = cut("    case 'rate':{", "    case 'close':{");
  for (const k of ["if((m.g|0)!==J.g||J.solo||mine||!J.synced||replay)return;", "if(!r||r.one||r.found[m.pid]!=null||J.view!=='play'+n)return;",
    'if(m.at&&Date.now()-(m.at-(J.skew||0))>10000)return;', 'jeuEvt(false,m.pid,name);', '(J.koAt=J.koAt||{})[m.pid]=Date.now();'])
    assert.ok(rate.includes(k), k);
  const mates = fn('jeuMatesHTML');
  assert.ok(mates.includes("${koOn?' is-ko':''}") && mates.includes('${koOn?` style="--ko:-${ko}ms"`:\'\'}'), 'son avatar secoue, même si la rangée se redessine pendant le geste');
  assert.ok(fn('jeuEssaiRate').includes("if(typeof jeuRateSend==='function')jeuRateSend(r);") && line('jeuRateSend').includes("if(!J||J.ranked||J.solo||!r||r.one)return;"), 'sans serveur, le joueur l’annonce lui-même');
  assert.ok(fn('jeuStop').includes("document.getElementById('jeu-evts')?.remove();"), 'on quitte la salle : les pastilles partent');
  for (const k of ['#jeu-evts{position:fixed;left:50%;top:calc(var(--safe-top,0px) + 63px);', 'html.lq .jeu-evt.is-ko .jeu-evt-i{background:#FFE1E1;color:#B4232C;animation:jeuEvtNon',
    'html.lq .jeu-mates li.is-ko .jeu-av{animation:jeuMateKo .56s cubic-bezier(.36,.07,.19,.97) var(--ko,0ms) both}', 'html[data-motion="reduce"].lq .jeu-evt,'])
    assert.ok(css.includes(k), k);
});

test('serveur : l’essai manqué annoncé à la salle, le +25 au seul premier (migration appliquée le 5 novembre)', () => {
  const f = path.join(ROOT, 'supabase/migrations/20261105092028_salle_essais_rates_et_premier_essai.sql');
  const sql = fs.readFileSync(f, 'utf8');
  assert.ok(sql.includes("elsif ouverte and not deja and not coalesce(rd.solo,false) then") && sql.includes("jsonb_build_object('v',1,'t','rate','pid',e.pid,'name',mb.pseudo,'u',replace(e.id::text,'-',''),'g',e.generation,'n',e.numero)"));
  assert.ok(sql.includes('exception when others then null;'), 'un relais saturé ne fait pas perdre l’essai');
  assert.ok(sql.includes('+case when premier and (solo or rang=0) then 25 else 0 end'));
  assert.ok(sql.includes('grant execute on function public.jeu_valider_v2(uuid,boolean) to service_role;'));
  assert.ok(!/raise notice|drop /i.test(sql));
});

test('les indices : les mêmes, à la même minute, pour tous (depuis le début de la manche, à l’horloge du serveur)', () => {
  assert.ok(app.includes('const JEU_IND_T=[150000,300000,450000];'));
  assert.ok(fn('coachRoomTick').includes('const due=JEU_IND_T.filter(t=>Date.now()-r.t1>=t).length;'));
  assert.ok(app.includes('if(J.ranked&&m.startAt){const rr=J.rounds[n];rr.t1=+m.startAt-J.skew;rr.t0=rr.t1-JEU_DRAW_MS;}'), 'le début de manche donné par le serveur');
});

test('« Quitter la salle ? » centré ; la question respire sous les badges du haut', () => {
  assert.ok(app.includes("<div class=\"lq-ask-cap${o.danger?' is-danger':''}${o.ico||o.chat?'':' is-nostk'}\">"));   // 7 novembre : ou le chat (o.chat)
  for (const k of ['html.lq .lq-ask:not(.has-field) .lq-ask-cap{padding-left:24px!important;padding-right:24px!important}',
    'html.lq .lq-ask:not(.has-field) .lq-ask-cap.is-nostk{padding-left:62px!important;padding-right:62px!important}',
    'html.lq #scr-lesson .jeu-bar~h1{margin-top:20px!important}'])
    assert.ok(css.includes(k), k);
  assert.ok(css.indexOf('html.lq .lq-ask:not(.has-field) .lq-ask-cap{padding-left:24px') > css.indexOf('html.lq .lq-ask-cap{padding-right:62px!important}'), 'après la règle de la croix');
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=226">'));
});
