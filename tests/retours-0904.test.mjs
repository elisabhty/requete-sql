/* Elisa, 9 novembre, 9 h 04 : « Fais le parcours défis avec tous les écrans pour trouver une incohérence afin de corriger cette
   partie et passer à autre chose ». Le parcours, écran par écran (onglets, Joue seule, la page d’un défi, une salle à deux, le podium,
   Mes stats et Adversaires après la partie), a relevé :
   1. une même durée dite de trois façons : « Résolu en 2 min 40 » dans l’encart vert, « Trouvé en 2 min 41 » dans le bilan (arrondi
      à la seconde la plus proche), « Tu as trouvé en 00:15. » aux résultats de la manche, « Temps moyen 00:58 » dans Mes stats quand le
      bilan dit « 2 min 41 temps moyen ». Partout « Résolu en », la même lecture que le chrono et les paliers (la seconde entamée ne
      compte pas), en clair ; les classements gardent leur colonne chrono 00:15 ;
   2. le bonus du premier coup : « 1er essai +25 » dans le détail des points, « Du premier coup » au barème et dans l’encart vert ;
   3. « En direct » : le dernier trouve, « Plus que toi en course, courage ! » restait sous la barre pendant que son encart passait
      au vert. Le commentateur dit « Tout le monde a trouvé ! » (salle-defis.test.mjs : le déroulé) ;
   4. Facile violet sur l’écran Défis et dans « Ta salle de défi », vert dans la salle d’attente et la barre de la manche (Moyen ambre
      puis jaune) : les couleurs de l’écran Défis partout, le vert reste à la réussite ;
   5. « Premier indice dans 02:23 » en vert, sous « Pas tout à fait. Réessaie ! » : l’ambre des indices et du chrono ;
   6. « 1 adversaire », puis « Défie-les, rejoins leurs salles » : au singulier quand il n’y en a qu’un. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const line = name => cut(`function ${name}(`, '\n') + '\n';

test('une durée se dit d’une seule façon : « Résolu en », la seconde entamée ne compte pas, en clair hors des classements', () => {
  const ctx = vm.createContext({});
  vm.runInContext(line('jeuDureeLisible') + line('jeuChrono'), ctx);
  /* 160,6 s : le chrono affiche 07:20 restantes sur 10:00, l’encart vert « 2 min 40 » ; le bilan disait « 2 min 41 » */
  assert.equal(ctx.jeuDureeLisible(160600), '2 min 40');
  assert.equal(ctx.jeuChrono(160600), '02:40', 'la colonne des classements : le même nombre de secondes');
  const fin = cut("}else if(v==='final'){", '/* Fondu enchaîné');
  assert.ok(fin.includes('const dur=jeuDureeLisible;') && !fin.includes('Math.round(ms/1000)'), 'le bilan lit comme l’encart vert');
  assert.ok(fin.includes('<i class="jr-time">Résolu en ${dur(x.ms)}</i>') && !fin.includes('">Trouvé en'), '« Résolu en » dans le bilan');
  const res = cut("}else if(v.startsWith('res')){", "}else if(v==='final'){");
  /* 16 h 22 (Elisa : « enlève “Résolu en 1 s” ») : aux résultats de la manche, le temps n’est plus que dans le classement (00:01) */
  assert.ok(res.includes("const sub=got?'':'Tu pourras retenter ce défi plus tard.';") && !res.includes('`Tu as trouvé en'), 'aux résultats de la manche');
  assert.ok(res.includes('<em>${jeuChrono(x.ms)}</em>'), 'le classement de la manche garde sa colonne chrono');
  assert.equal((app.match(/Trouvé en \$\{|Tu as trouvé en \$\{/g) || []).length, 0, 'plus de « Trouvé en » nulle part');
  /* Mes stats : en clair, comme le bilan ; la police des chiffres du tableau */
  const perf = cut('function renderDefisPerf(){', '\nfunction ');
  assert.ok(perf.includes("const dl=typeof jeuDureeLisible==='function'?jeuDureeLisible:jeuChrono;"));
  assert.ok(perf.includes('<small>Temps moyen</small><b>${trouves?dl(avg):\'—\'}</b>') && perf.includes('<small>Le plus rapide</small><b>${fast?dl(fast):\'—\'}</b>'));
  assert.ok(perf.includes("${h.ok?` · ${dl(h.ms)}`:''}") && !perf.includes('jeuChrono(h.ms)'), 'l’historique aussi');
  assert.ok(lq.includes('html.lq #scr-defis .perf-times b{font-family:var(--display);letter-spacing:-.01em}'));
});

test('le bonus du premier coup porte le nom du barème : « Du premier coup +25 »', () => {
  const ctx = vm.createContext({ JEU_NIVL: { f: 'Facile', m: 'Moyen', d: 'Difficile' } });
  vm.runInContext(line('jeuPtsDetail'), ctx);
  assert.equal(ctx.jeuPtsDetail({ val: 200, essai: 25, rang: 50, place: 1 }),
    '<span class="jeu-pd"><i>Défi 200</i><i class="is-essai">Du premier coup +25</i><i class="is-rang">1er +50</i></span>');
  assert.ok(!app.includes('1er essai +'), 'plus de « 1er essai »');
  assert.ok(lq.includes('html.lq .jeu-pd i:not(:last-child)::after{content:"·";margin-left:6px;color:#C9C2E6}') && !lq.includes('.jeu-pd i+i::before'), 'la ligne plus longue passe à la ligne sans commencer par « · »');
  assert.ok(app.includes('<li><b>✨ Du premier coup</b><span>+${JEU_PTS_ESSAI}</span>'), 'le nom du barème');
});

test('« En direct » : plus personne en course, le commentateur le dit tout de suite', () => {
  const obs = cut('function jeuDirectObserver(', '\nfunction jeuDitPousser(');
  assert.ok(obs.includes("if(!lice.length&&avantLice>0&&xs.some(x=>{const a=avant[jeuDirectPid(x.pid)];return a&&a.etat!=='ok'&&x.etat==='ok';})){"), 'seulement quand le dernier vient de trouver (pas quand il part)');
  assert.ok(obs.includes("const f=J.dit&&J.dit.n===n?J.dit:null;if(f){f.file=[];f.cur=null;}") && obs.includes("dits.length=0;dits.push({k:'tous',p:6,ico:JEU_ICO.check,html:'Tout le monde a trouvé\\u00a0!'});"), 'la file part, la phrase passe aussitôt');
  assert.ok(app.includes('/^(serie|tete|monte|seul|minute|tous)$/.test(d.k)'), 'dite au lecteur d’écran');
  assert.ok(lq.includes('html.lq #jeu-root .jd-dit-m.is-tous .jd-dit-i{background:#2DB67C;color:#fff}'), 'la coche des trouvailles');
});

test('les niveaux gardent partout les couleurs de l’écran Défis ; le compte à rebours de l’indice n’est plus vert', () => {
  for (const r of ['html.lq .jeu-chip.is-f{color:var(--accent-ink)!important}', 'html.lq .jeu-chip.is-m{color:#B45309!important}', 'html.lq .jeu-chip.is-d{color:#C2323A!important}',
    'html.lq .jeu-bars.is-f{background:var(--accent-soft)}', 'html.lq .jeu-bars.is-f b:nth-child(1){background:var(--accent)}',
    'html.lq .jeu-bars.is-m{background:#FFF3DC}', 'html.lq .jeu-bars.is-m b:nth-child(-n+2){background:#B45309}',
    'html.lq .jeu-bars.is-d{background:#FDEBEC}', 'html.lq .jeu-bars.is-d b{background:#C2323A}'])
    assert.ok(lq.includes(r), r);
  assert.ok(lq.includes('--dx-f:var(--accent-ink);') && lq.includes('--dx-m:#B45309;') && lq.includes('--dx-d:#C2323A;'), 'les jetons de l’écran Défis');
  assert.ok(!/\.jeu-(?:chip|bars)\.is-f[^{]*\{[^}]*(?:#169447|#0F7A3A|#DDF8EA|success)/.test(lq + app), 'Facile n’est plus vert nulle part');
  assert.ok(app.includes('  .jeu-chip.is-f{background:var(--accent-soft);color:var(--accent-ink)}'), 'ni dans le thème de base');
  /* « Premier indice dans 02:23 » */
  assert.ok(lq.includes('html.lq .coach-next i{flex:none;width:16px;height:16px;border-radius:50%;box-shadow:inset 0 0 0 2px var(--sun-lip,#E0A100);position:relative}'));
  assert.ok(lq.includes('background:var(--sun-lip,#E0A100);transform-origin:50% 100%;animation:coachHand 2s linear infinite}'));
  assert.ok(lq.includes('html.lq .coach-next b{color:#8A5A00;font:800 13px/1 var(--mono);font-variant-numeric:tabular-nums}'));
  assert.ok(!/\.coach-next[^{]*\{[^}]*(?:#1E9E68|#147A4E)/.test(lq), 'plus de vert dans la ligne du compte à rebours');
});

