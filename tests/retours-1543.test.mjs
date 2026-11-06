/* Elisa, 5 novembre, 15 h 43 (quatre captures) :
   - Réf. 1 pour la réf. 2 : « 6 activités à rattraper » (plus « à replacer »), « 3 séances non terminées », « Comment veux-tu
     reprendre ? », les trois façons en boutons radio — la recommandée cochée d’avance —, « Confirmer mon choix » et « Je déciderai
     plus tard » ; « Reprendre à mon rythme », « Tout rattraper aujourd’hui », « environ 48 min ».
   - Réf. 3 : « quand on clique sur Relever un défi, le niveau recommandé est sélectionné ».
   - Au passage : « Fin le 1 décembre » devient « Fin le 1er décembre ».
   Vérifié dans un navigateur (402 et 320 px ; au clavier : les flèches changent le choix). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = nom => cut(`function ${nom}(`, '\n}\n') + '\n}\n';
const N = ' ';
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* La carte, rendue pour de vrai : six activités sur trois séances, le décalage finit le 1er décembre */
function carte(count = 6) {
  const ctx = vm.createContext({ esc, MIN_PAR_ACTIVITE: 6, parseD: s => new Date(s + 'T00:00:00'), itemMeta: id => ({ titre: ['DISTINCT', 'ORDER BY', 'Fonctions de dates et heures', 'A', 'B', 'C', 'D', 'E', 'F', 'G'][id] }) });
  vm.runInContext('var lateRecoveryCollapsed=false;' + cut('const LATE_BANNER_ICO=', 'function activitesRestantesAujourdhui(){'), ctx);
  /* Depuis le 6 novembre, la durée suit les vraies activités (minutesDe) : ici 6 minutes chacune, le retard et les deux du jour */
  ctx.minutesDe = ids => ids.length * 6; ctx.itemDone = () => false;
  ctx.latePlanDetails = () => ({ info: { today: { lessons: [count, count + 1] } }, ids: Array.from({ length: count }, (_, i) => i), count, sessions: 3, todayCount: 2, todayAfter: count + 2 });
  ctx.latePlanShiftPreview = () => ({ end: '2026-12-01' });
  return { ctx, html: ctx.lateRecoveryHTML() };
}

test('réf. 1 : « activités à rattraper », « séances non terminées », « Comment veux-tu reprendre ? »', () => {
  const { html } = carte();
  assert.ok(html.includes('<span class="lr-title" id="late-recovery-title">6 activités à rattraper</span><span class="lr-meta">3 séances non terminées</span>'));
  assert.ok(html.includes('<ul class="lr-chips" aria-label="Activités à rattraper"><li>DISTINCT</li><li>ORDER BY</li><li>Fonctions de dates et heures</li><li class="more">+ 3 autres</li></ul>'));
  /* 6 novembre, 11 h 57 : la phrase dit pourquoi le choix est recommandé (le nombre d’activités, le temps, ton rythme ; late-recovery) */
  assert.ok(html.includes(`<h3 class="lr-q-t" id="lr-q-t">Comment veux-tu reprendre${N}?</h3><p class="lr-lead">Rien n’est perdu, pas besoin de tout faire d’un coup${N}: sur tes 3${N}prochaines séances, ça fait 2 activités de plus chacune.</p>`));
  assert.ok(carte(2).html.includes(`<p class="lr-lead">Rien n’est perdu${N}: avec ta séance du jour, ça fait environ${N}24${N}min. Tu peux tout rattraper aujourd’hui.</p>`), 'peu de retard : aujourd’hui, et pourquoi');
  assert.ok(html.includes('<div class="lr-actions" role="radiogroup" aria-labelledby="lr-q-t">'));
  assert.ok(html.includes('<button type="button" class="lq-btn lr-confirm" onclick="lrConfirmer(this)">Confirmer mon choix</button>') && html.includes('>Je déciderai plus tard</button>'));
  assert.ok(!html.includes('à replacer') && !html.includes('Conseillé') && !html.includes('>Plus tard<'));
  /* L’accueil dit la même chose */
  assert.ok(app.includes("<b>${plur(late.count,'activité')} à rattraper</b><small class=\"jp-meta\">${plur(late.sessions,'séance')} non terminée${late.sessions>1?'s':''}</small>"));
});

test('les trois façons, en boutons radio : la recommandée cochée d’avance et en premier, les mots de la réf. 1', () => {
  const { html } = carte();
  const radios = [...html.matchAll(/<button type="button" role="radio" aria-checked="(true|false)" tabindex="(0|-1)" class="lr-option([^"]*)" data-option="(\w+)"/g)].map(m => [m[4], m[1], m[2], m[3].trim()]);
  assert.deepEqual(radios, [['spread', 'true', '0', 'is-on is-reco'], ['shift', 'false', '-1', ''], ['today', 'false', '-1', '']]);
  assert.ok(html.includes('<b>Répartir sur 3 séances</b><em>Recommandé</em></span><small>2 activités de plus par séance</small>'));
  assert.ok(html.includes(`<b>Reprendre à mon rythme</b></span><small>Décale ton planning sans ajouter d’activités. Fin le${N}1er${N}décembre.</small>`), '« 1er décembre », sans coupure');
  assert.ok(html.includes(`<b>Tout rattraper aujourd’hui</b></span><small>8 activités au total · environ${N}48${N}min</small>`));
  assert.ok(html.includes('<span class="lr-radio" aria-hidden="true"><svg'), 'une coche ronde à droite');
  /* Peu de retard : « Tout rattraper aujourd’hui » recommandé, coché d’avance */
  const peu = carte(2).html;
  assert.ok(/aria-checked="true" tabindex="0" class="lr-option is-on is-reco" data-option="today"/.test(peu));
});

test('cocher, au doigt ou aux flèches, puis « Confirmer mon choix » : l’action choisie, une seule fois', () => {
  const { ctx } = carte();
  const fait = [];
  Object.assign(ctx, { decalerPlanning: () => fait.push('shift'), rattraper: () => fait.push('today'), etalerRetard: () => fait.push('spread'), navigator: {}, prefersReduceMotion: () => true });
  const opts = ['spread', 'shift', 'today'].map(k => {
    const b = { dataset: { option: k }, tabIndex: -1, attrs: {}, cls: new Set(), focus() { b.focused = true; } };
    b.classList = { toggle: (c, on) => on ? b.cls.add(c) : b.cls.delete(c), add: c => b.cls.add(c) };
    b.setAttribute = (n, v) => { b.attrs[n] = v; };
    b.closest = () => grp;
    return b;
  });
  const grp = { querySelectorAll: () => opts };
  ctx.lrChoisir(opts[2]);
  assert.equal(vm.runInContext('lateChoix', ctx), 'today');
  assert.deepEqual(opts.map(b => [b.attrs['aria-checked'], b.tabIndex, b.cls.has('is-on')]), [['false', -1, false], ['false', -1, false], ['true', 0, true]]);
  /* Flèche vers le bas depuis le dernier : retour au premier */
  let empeche = false;
  ctx.lrClavier({ key: 'ArrowDown', currentTarget: opts[2], preventDefault: () => { empeche = true; } });
  assert.ok(empeche && opts[0].focused && vm.runInContext('lateChoix', ctx) === 'spread');
  ctx.lrClavier({ key: 'End', currentTarget: opts[0], preventDefault() {} });
  assert.equal(vm.runInContext('lateChoix', ctx), 'today');
  ctx.lrClavier({ key: 'a', currentTarget: opts[2], preventDefault: () => { throw new Error('pas pour les autres touches'); } });
  /* Confirmer applique le choix coché */
  const btn = { dataset: {}, classList: { add() {} }, closest: () => ({ querySelector: () => opts[2] }) };
  ctx.lrConfirmer(btn);
  assert.deepEqual(fait, ['today']);
  ctx.lateChoix = 'shift'; vm.runInContext("lateChoix='shift'", ctx);
  ctx.lrConfirmer({ dataset: {}, classList: { add() {} }, closest: () => null });
  assert.deepEqual(fait, ['today', 'shift']);
  /* Une nouvelle liste d’activités : le choix revient à la recommandée */
  vm.runInContext("lateChoix='today'", ctx);
  ctx.latePlanDetails = () => ({ ids: [9, 8, 7, 6, 5], count: 5, sessions: 2, todayAfter: 7 });
  assert.ok(/aria-checked="true" tabindex="0" class="lr-option is-on is-reco" data-option="spread"/.test(ctx.lateRecoveryHTML()));
});

test('les styles : la carte cochée en violet, sa coche qui se pose, « Confirmer mon choix » qui arrive après les choix', () => {
  for (const k of ['html.lq .late-recovery .lr-option.is-on{border-color:var(--accent)!important;background:#F4F1FF!important;',
    'html.lq .late-recovery .lr-option.is-on .lr-radio svg{transform:scale(1)}', 'html.lq .late-recovery .lr-radio svg{width:16px;height:16px;transform:scale(0);',
    'html.lq .late-recovery .lr-q{margin:16px 0 0;padding-top:14px;border-top:2px dashed var(--line)}',
    'html.lq .late-recovery:is(.is-fresh,.is-reveal) .lr-confirm{animation:lrUp .36s ease-out .64s both}',
    'html[data-motion="reduce"].lq .late-recovery .lr-radio,html[data-motion="reduce"].lq .late-recovery .lr-radio svg{transition:none}'])
    assert.ok(lq.includes(k), k);
});

test('« 1er décembre » : le premier du mois a son « er », partout où le planning dit une date', () => {
  const ctx = vm.createContext({ parseD: s => new Date(s + 'T00:00:00') });
  vm.runInContext(fn('dateCourte'), ctx);
  assert.deepEqual(['2026-12-01', '2026-11-11', '2026-11-21'].map(d => ctx.dateCourte(d)), ['1er décembre', '11 novembre', '21 novembre']);
  assert.equal((app.match(/toLocaleDateString\('fr-FR',\{day:'numeric',month:'long'(?:,year:'numeric')?\}\)\.replace\(\/\^1 \/,'1er '\)/g) || []).length, 7);
  assert.equal((app.match(/toLocaleDateString\('fr-FR',\{day:'numeric',month:'long'(?:,year:'numeric')?\}\)(?!\.replace)/g) || []).length, 0, 'aucune date sans son « 1er »');
});

test('réf. 3 : « Relever un défi » sélectionne le niveau recommandé, même après un autre choix ; « Mes défis » n’y touche pas', () => {
  const vus = [], prefs = [];
  const ctx = vm.createContext({ DEFIS: { onglet: 'jouer' }, switchTab: t => vus.push(t), jeuNivAuto: () => 'm', jeuSavePrefs: () => prefs.push(vm.runInContext('[jeuNiv,jeuNivUser].join()', ctx)) });
  vm.runInContext("var jeuNiv='d',jeuNivUser=true;" + cut('let defisVersStats=false;', '/* L’entrée Stickers'), ctx);
  ctx.pratiquerDefis('stats');
  assert.deepEqual([vm.runInContext('jeuNiv', ctx), vm.runInContext('jeuNivUser', ctx)], ['d', true], 'Mes stats : le niveau reste');
  ctx.pratiquerDefis('jouer');
  assert.deepEqual([vm.runInContext('jeuNiv', ctx), vm.runInContext('jeuNivUser', ctx), ctx.DEFIS.onglet], ['m', false, 'jouer']);
  assert.deepEqual(prefs, ['m,false'], 'retenu pour la salle');
  assert.deepEqual(vus, ['defis', 'defis']);
  /* La salle garde le recommandé tant qu’on n’en choisit pas un autre, et le dit */
  assert.ok(app.includes("${k===auto&&!vide?'<em class=\"room-lv-auto\">Niveau recommandé</em>':''}") && app.includes('if(!jeuNivUser)jeuNiv=jeuNivAuto();'));
});
