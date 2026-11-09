/* 5 novembre, 21 h 09 (Elisa, la capture de l’accueil une fois la séance faite : « Prête pour la suite, Elisa ? », puis « ✓ Ta session ·
   Faite » repoussée sur une deuxième ligne) : « j’aime pas que ça tienne en deux lignes en fait, et supprime « Ton module » en vert ». */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('la séance : « aujourd’hui » à part, pour pouvoir le retirer quand la place manque (avant le 7 novembre : « Ta session · »)', () => {
  /* Elisa, 7 novembre, 8 h 38 (maquette) : « ⌛ 14 min aujourd’hui » ; faute de place, « ⌛ 14 min » */
  const code = cut('  const sesVue=', '\n  /* Elisa, 1er novembre, 19 h 25');
  const txt = (sesEtat, minutes = 12) => vm.runInNewContext(code.replace(/const (sesVue|sesIc|sesSuf|sesTxt)=/g, 'var $1=') + ";sesVue+'|'+sesTxt", { sesEtat, session: { minutes } });
  const suf = '<span class="lq-ses-suf"> aujourd’hui</span>', N = '\u00a0';
  assert.equal(txt('run'), `run|<b class="lq-ses-n" data-n="12">12</b>${N}min${suf}`);
  assert.equal(txt('late', 8), `run|<b class="lq-ses-n" data-n="8">8</b>${N}min${suf}`, 'la séance d’un jour passé se reprend aujourd’hui, comme les autres');
  assert.equal(txt('done'), `done|Fait${suf}`);
  assert.equal(txt('pause'), `pause|Pause${suf}`);
  assert.equal(txt('end'), 'end|Parcours<br>terminé', 'rien à retirer (sur deux lignes : 7 novembre, 10 h 25)');
  assert.ok(lq.includes('html.lq .lq-hero.has-hi .lq-hero-hi.is-court .lq-ses-suf{display:none}') && !lq.includes('.lq-ses-pre'));
});

test('si la séance ne tient plus à droite du bonjour, elle se resserre ; sinon elle garde « aujourd’hui » (avant : « Ta session · »)', () => {
  /* Depuis le 6 novembre (audit, bug 5), la place se mesure une fois et la suite se déduit (lqSesAjuste) : la largeur du bonjour à
     20 px (nat), celle de l’étiquette entière (full) et de « Ta session · » (pre) */
  const f = cut('function lqSesAjuste(host){', '\nif(typeof window');
  const essai = ({ W = 342, nat, full = 120, pre = 70, lecon = true, nomW = 60, sans = false }) => {
    const cls = () => { const s = new Set(); return { s, add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)), contains: c => s.has(c) }; };
    const hiC = cls(), cardC = cls(); if (lecon) cardC.add('is-lecon');
    const css = {}, nomCss = {};
    const nom = { offsetWidth: nomW, style: { removeProperty: k => { delete nomCss[k]; }, set maxWidth(v) { nomCss['max-width'] = v; } } };
    const t = { getBoundingClientRect: () => ({}), scrollWidth: nat, style: { setProperty: (k, v) => { css[k] = v; }, removeProperty: k => { delete css[k]; } }, querySelector: s => (s === '.lq-hi-nom' ? nom : null) };
    const m = { offsetWidth: full, querySelector: s => (s === '.lq-ses-suf' && pre ? { offsetWidth: pre } : null) };
    const hi = { clientWidth: W + 1, classList: hiC, closest: s => (s === '.lq-hero' ? { classList: cardC } : null), querySelector: s => (s === '.lq-hi-title' ? t : s === '.journey-session-meta' && !sans ? m : null) };
    const c = vm.createContext({});
    vm.runInContext(f, c);
    c.lqSesAjuste({ querySelector: s => (s === '.lq-hero-hi' ? hi : null) });
    return { court: hiC.s.has('is-court'), serre: hiC.s.has('is-serre'), bas: cardC.s.has('is-ses-bas'), fs: css['--hi-fs'], nom: nomCss['max-width'] };
  };
  assert.deepEqual(essai({ nat: 230, full: 100 }), { court: false, serre: false, bas: false, fs: undefined, nom: undefined }, 'tout tient sur la ligne : rien ne change');
  /* 7 novembre, 8 h 38 : « aujourd’hui » reste tant que le bonjour peut rapetisser d’un rien (jusqu’à 18 px) */
  assert.deepEqual(essai({ nat: 240, full: 100 }), { court: false, serre: false, bas: false, fs: '19.5px', nom: undefined }, '0 : le bonjour à 19,5 px, « 14 min aujourd’hui » entier');
  assert.deepEqual(essai({ nat: 250 }), { court: true, serre: false, bas: false, fs: undefined, nom: undefined }, '1 : « Fait aujourd’hui » ne tient pas : « ✓ Fait »');
  assert.deepEqual(essai({ nat: 300 }), { court: true, serre: false, bas: false, fs: '18.5px', nom: undefined }, '2 : le bonjour rapetisse un peu (jamais sous 17 px)');
  assert.deepEqual(essai({ nat: 340 }), { court: false, serre: false, bas: true, fs: undefined, nom: undefined }, '3 : l’étiquette descend à côté du module, le bonjour garde ses 20 px');
  assert.deepEqual(essai({ nat: 360 }), { court: false, serre: false, bas: true, fs: '19px', nom: undefined }, '4 : … et rapetisse si besoin');
  assert.deepEqual(essai({ nat: 360, lecon: false }), { court: true, serre: false, bas: false, fs: undefined, nom: undefined }, 'la carte de fin : l’étiquette passe dessous, comme avant');
  assert.deepEqual(essai({ W: 290, nat: 420, nomW: 200 }), { court: false, serre: true, bas: true, fs: '16px', nom: '112px' }, '5 : en dernier recours, le prénom s’abrège (jamais le « ? »)');
  assert.deepEqual(essai({ W: 0, nat: 420 }), { court: false, serre: false, bas: false, fs: undefined, nom: undefined }, 'accueil caché : rien n’est décidé');
  /* 7 novembre, 10 h 10 : la carte d’une leçon n’a plus d’étiquette ; le bonjour a toute la ligne */
  assert.deepEqual(essai({ nat: 300, sans: true }), { court: false, serre: false, bas: false, fs: undefined, nom: undefined }, 'sans étiquette : il tient');
  assert.deepEqual(essai({ nat: 400, sans: true }), { court: false, serre: false, bas: false, fs: '17px', nom: undefined }, 'sans étiquette : il rapetisse');
  assert.deepEqual(essai({ nat: 460, nomW: 200, sans: true }), { court: false, serre: true, bas: false, fs: '16px', nom: '132px' }, 'sans étiquette : à 16 px, le prénom s’abrège');
  /* Après chaque rendu des deux cartes, et quand l’écran change de taille */
  /* 6 novembre (audit, bug 6) : mesuré avec le vrai nombre, avant que le compteur parte de 0 */
  assert.ok(app.includes('    lqSesAjuste(host);   // mesuré avec le vrai nombre, avant que le compteur parte de 0 (audit du 6 novembre, bug 6)\n    lqSesCount(host);\n    if(typeof lqFlammeBravo===\'function\')lqFlammeBravo();\n    return;\n  }') && app.includes('  lqSesAjuste(host);   // mesuré avec le vrai nombre, avant que le compteur parte de 0 (audit du 6 novembre, bug 6)\n  lqSesCount(host);\n  lqPctAnime(host);\n  if(typeof lqFlammeBravo===\'function\')lqFlammeBravo();\n}'));
  assert.ok(app.includes("addEventListener('resize',()=>{clearTimeout(lqSesT);lqSesT=setTimeout(()=>lqSesAjuste(document.getElementById('home-hero')),150);});"));
  /* La séance est revenue à droite du bonjour (l’essai sur la ligne du module, abandonné, ne reste pas) */
  /* 7 novembre, 8 h 38 : la phrase de heroSousTitre vient sous la ligne du bonjour */
  assert.ok(app.includes('const heading=`<div class="lq-hero-hi"><p class="lq-hi-title" aria-hidden="true">${hiHtml}</p>${nxt==null?sesMeta:`<span class="lq-sr">${esc(seanceLue(session,sesEtat))}</span>`}</div>${sousT?`<p class="lq-hi-sub">${sousT}</p>`:\'\'}`;') && !app.includes('lq-hero-row') && !lq.includes('.lq-hero-row'));
});

test('plus de « Ton module » en menthe au-dessus du pourcentage (et, depuis le 6 novembre, plus de grand pourcentage du tout)', () => {
  assert.ok(!app.includes('const parc=`') && !app.includes('lq-hero-kicker') && !app.includes("'Ton module'"));
  assert.ok(!lq.includes('lq-hero-kicker'), 'son style est parti avec lui');
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=283">'));
});
