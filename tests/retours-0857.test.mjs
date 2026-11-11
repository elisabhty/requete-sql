/* 11 novembre, 8 h 57 (Elisa, quatre captures du lecteur des cours en vidéo : « Il y a des soucis de formatage, regarde que ça
   n’existe pas ailleurs ») :
   1. « SUM, AVG, MIN et MAX » : les huit prix descendaient de 30 px, sur les cases du calcul de la moyenne (191,90 € ÷ 8 = 23,9875).
   2. Le même cours, à 1:47 : l’image vide entre la carte du calcul et le tableau de bord, pendant la légende.
   3. L’intro de « CASE » : un fond violet clair débordait derrière la carte (la classe .nv de la page portait le nom de celle du moteur),
      la pastille de durée passait sous les oreilles de la mascotte (sous-titre sur deux lignes dans WebKit), la rubrique sous
      l’étincelle ; ailleurs, l’étincelle du milieu passait sous le sous-titre (« LEFT JOIN », « WITH ») ou les pastilles (« WHERE »).
   Partout : ?check signale maintenant les textes recouverts, les cadres qui se chevauchent dans le flux d’une carte, les images
   vides pendant une légende, l’intro (pastilles, étincelles) et les scènes peintes (check.js) ; les 83 vidéos ont été passées au
   crible (Chrome et WebKit) et corrigées : 200 images vides de moins (la carte suivante arrive pendant que la précédente s’en va ;
   la carte d’un moment se pose dès « À toi ! »). */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const A = f => fs.readFileSync(path.join(ROOT, 'assets/anim', f), 'utf8');
const core = A('core.js'), moments = A('moments.js'), check = A('check.js');

test('aucune page ne donne de style à une classe que le moteur pose sur une scène (.nv de l’intro)', () => {
  for (const f of fs.readdirSync(path.join(ROOT, 'assets/anim')).filter(f => f.endsWith('.html'))) {
    const css = [...A(f).matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/(^|[},])\s*\.nv\s*[{,:]/m.test(css), `${f} : .nv appartient au moteur (#s0.nv)`);
  }
  const c = A('case.html');
  assert.ok(c.includes('.nval{justify-self:stretch;text-align:center;border-radius:10px;padding:0 8px;background:#8B6CFF;color:#fff;font-weight:800}'));
  assert.equal((c.match(/class="b nval"/g) || []).length, 5);
});

test('l’intro place sa rubrique, son sous-titre et son titre sans rien superposer', () => {
  assert.ok(core.includes("for (let f = 34; tagp && f >= 26; f--) { tagp.style.fontSize = f + 'px'; if (tagp.scrollWidth <= 720) break; }"), 'la rubrique s’arrête avant l’étincelle du coin (880 px)');
  assert.ok(core.includes('while (f1 >= 72 && !fit(f1, 1)) f1 -= 2;') && core.includes('if (f1 >= 72) fsub = f1; else while (!fit(fsub, 2) && fsub > 52) fsub -= 4;'),
    'le sous-titre tient sur une ligne jusqu’à 72 px, sinon deux lignes');
  assert.ok(core.includes("let fs = Math.min(250, Math.max(150, Math.floor((350 - sub.scrollHeight) / 0.95))); title.style.fontSize = fs + 'px';"),
    'le titre laisse les pastilles au-dessus des oreilles de la mascotte');
  /* 968 (haut de la mascotte) − 14 (son balancement) − 18 (écart) = 936 ; 936 − 104 (pastilles) − 48 − 82 − 352 = 350 */
  assert.equal(968 - 14 - 18 - 104 - 48 - 82 - 352, 350);
  /* L’étincelle du milieu (900, 760) : WebKit coupait le sous-titre de « LEFT JOIN » et de « WITH » plus large que Chrome, et les
     pastilles de « WHERE » allaient jusqu’à elle. Elle reste à sa place si c’est libre, sinon juste après les pastilles, sinon dessous. */
  const S2 = ["const free = ([x, y]) => x + 56 <= 1000 && B.every(([l, u, w, v]) => x >= l + w + 24 || x + 76 <= l || y >= u + v + 8 || y + 64 <= u);",
    "const c = [[parseFloat(cs.left), parseFloat(cs.top)], [r + 28, t + (h - 56) / 2], [904, t + h + 26]].find(free);",
    "if (c) Object.assign(s2.style, {left: c[0] + 'px', top: c[1] + 'px'}); }"];
  for (const l of S2) assert.ok(core.includes(l), 'l’étincelle du milieu ne passe ni sous le sous-titre ni sous les pastilles : ' + l);
  /* « WHERE » a son propre moteur (une copie de core.js dans la page) : les mêmes règles, et les mêmes contrôles sous ?check. */
  const wh = A('where.html');
  for (const l of S2.concat(["for (let f = 34; tagp && f >= 26; f--) { tagp.style.fontSize = f + 'px'; if (tagp.scrollWidth <= 720) break; }",
    'while (f1 >= 72 && !fit(f1, 1)) f1 -= 2;', "let fs = Math.min(250, Math.max(150, Math.floor((350 - sub.scrollHeight) / 0.95))); title.style.fontSize = fs + 'px';",
    "const CHECK2 = new URLSearchParams(location.search).has('check') ? await new Promise(res => { const sc = document.createElement('script'); sc.src = 'check.js';",
    'return {duration: OUT_DURATION, coverIssues: COVER,']))
    assert.ok(wh.includes(l), 'where.html : ' + l);
  assert.ok(!wh.includes('/* Sous-titre : deux lignes au plus */'), 'where.html : plus l’ancienne intro');
});

test('la carte d’un moment « À toi » se pose avec sa légende et reste jusqu’à la scène suivante', () => {
  assert.ok(moments.includes('const MOMENT_LEAD = 2.55, MOMENT_TAIL = 0.25;'));
  assert.ok(moments.includes('const i = P.findIndex(p => p.board && t >= p.at - MOMENT_LEAD && t < p.at + MOMENT_TAIL);')
    && moments.includes('if (i >= 0) { if (!X || X.i !== i) { clear(); start(i); X.lead = true; } }') && moments.includes('else if (X && X.lead) clear();'));
  assert.ok(moments.includes('enter: i => { if (X && X.i === i && X.lead) { X.lead = false; return; }') && moments.includes('if (X && X.i === i) { reset();'), 'l’ouverture du moment garde la carte posée (19 h 56 : même sans « À toi ! » devant)');
  assert.ok(moments.includes('if (wait >= 0) { const a = P[wait].at; if (t >= a + MOMENT_TAIL || t < a - 0.001) clear(); return; }'));
  /* « À toi ! » paraît 2,35 s avant l’arrêt (passage à at − 2,45, légende 0,1 s après) : la carte arrive 0,2 s avant elle. */
  assert.ok(moments.includes('const MOMENT_GAP = 2.65;') && moments.includes("gaps.forEach(g => caps.push([r3(g + 0.1), r3(g + MOMENT_GAP), 'À toi !']));"));
});

test('les captures d’Elisa : les prix restent sur place, le tableau de bord arrive pendant que le calcul s’en va', () => {
  const ag = A('agregats.html');
  assert.ok(ag.includes("tl.to(pc, {y: 6, opacity: 0.35, duration: 0.4, ease: 'power2.in', stagger: 0.05}, 58.6);") && !ag.includes('y: 30, opacity: 0.35'));
  /* le calcul s’en va à 75,8 (0,4 s) : le tableau de bord arrive à 75,95, plus à 76,3 */
  assert.ok(ag.includes("hide(['#s3codeb', '#avg3'], 75.8, {y: -40}, 0.4);") && ag.includes("show('#dash3', 75.95, {y: 50});") && ag.includes("cue(75.95, 'whoosh', 0.7);"));
  const cs = A('case.html');
  /* CASE : le troisième moment (103,52) se joue sur le CASE sans ELSE, arrivé pendant que la carte d’avant s’en va */
  assert.ok(cs.includes("hide('#trap4', 102.6);") && cs.includes("sceneOn('#s5', 102.95);") && cs.includes("show('#trap5', 102.95, {y: 50});"));
  assert.ok(cs.includes("{n:5, label:'Sans ELSE',       a:102.95, b:120.7},") && cs.includes("{at: 103.52, from: 97.9, kind: 'pick'"));
  /* SELF JOIN (moment sans carte) : le problème reste à l’image pendant « À toi ! » et la question */
  const sj = A('self-join.html');
  assert.ok(sj.includes("hide(['#pr2', '#ta2', '#goal2'], 61.63, {y: -40}, 0.4);") && sj.includes("sceneOff('#s2', 62.1);") && sj.includes("{at: 61.62, from: 51.0, kind: 'pick'"));
});

test('?check : les nouveaux contrôles vivent dans check.js, chargé par ?check seulement', () => {
  assert.ok(core.includes("const CHECK2 = QS.has('check') ? await new Promise(res => { const sc = document.createElement('script'); sc.src = 'check.js';")
    && core.includes('coverIssues: CHECK2 ? CHECK2(renderAt, out) : undefined,'));
  assert.ok(!core.includes('function coverIssues('), 'pas dans le moteur de l’app');
  for (const k of ["'texte recouvert'", "'cadres qui se chevauchent'", "kind: 'image vide'", "kind: 'intro'", "kind: 'scène peinte'"])
    assert.ok(check.includes(k), k);
  assert.ok(check.includes('if (over && free)'), 'une ligne à moitié couverte (une ligne cachée en entier ne se voit pas)');
  assert.ok(check.includes("if (E.closest('.mb-veil, .ripple, .caret, .strike, .stamp, .fly')) return false;"), 'ce qui se pose exprès sur un texte');
  assert.ok(check.includes("const b = !$('#stage > .mb') && capOn() && !textOn();"), 'une image vide : rien à voir pendant une légende');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert.ok(!sw.includes('anim/check.js'), 'check.js n’est pas dans l’app hors ligne');
});
