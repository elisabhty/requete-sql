/* 15 novembre, 17 h 45 (Elisa : « Il y a encore beaucoup de français sur l’application ») : l’appli en anglais relue écran par écran
   (node tools/langue/ecran.mjs --langue en --profond : chaque onglet, chaque écran, chaque leçon, chaque carte, chaque fiche SGBD).
   Ce qui restait : le bilan d’une leçon (récompense, avis, suite), les cartes mémo (verso, syntaxe, lecteur d’écran), la fin du
   parcours, les 142 questions d’entretien et leurs écrans ; et trois trous du moteur (langues.js). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), MOTEUR = lire('langues.js'), sw = lire('sw.js');

function moteur() {
  const local = {'requete-maj-canal': '"essai"', 'requete-langue': 'en'}, win = {}, ecrits = [];
  const ctx = {window: win, navigator: {language: 'fr-FR'}, Intl: {DateTimeFormat: () => ({resolvedOptions: () => ({timeZone: 'Europe/Paris'})})},
    location: {hostname: 'x', search: ''}, localStorage: {getItem: k => (k in local ? local[k] : null), setItem(k, v) { local[k] = v; }},
    document: {write: h => ecrits.push(h), documentElement: {}, title: '', addEventListener() {},
      currentScript: {getAttribute: a => (a === 'src' ? 'langues.js?v=7' : null), hasAttribute: a => a === 'data-defis'}}};
  vm.runInNewContext(MOTEUR, ctx);
  vm.runInNewContext(lire('langue-en.js'), ctx);
  vm.runInNewContext(lire('langue-en-entretien.js'), ctx);
  return {L: ctx.window.REQUETE_LANGUE, win, ecrits};
}

test('le bilan d’une leçon, les cartes mémo, la fin du parcours : en anglais', () => {
  const {L} = moteur();
  const attendus = {
    'Leçon au complet': 'Lesson complete', 'Ta récompense': 'Your reward', 'Ton avis reste anonyme.': 'Your rating stays anonymous.',
    'Touche une carte pour la retourner': 'Tap a card to flip it', '3 exercices réussis sur 5': '3 of 5 exercises passed',
    '1 activité restante · environ 3 min': '1 activity left · about 3 min', 'Séance suivante': 'Next session',
    'Bravo, tu as complété le parcours !': 'Well done, you’ve completed the path!', 'Plus que 13 min': '13 min left',
    'garde les valeurs comprises entre deux limites.': 'keeps the values between two bounds.',
    'Module 3 · en cours': 'Module 3 · in progress', 'Pour les autres SGBD, voir la page': 'For other DBMSs, see the'
  };
  for (const [fr, en] of Object.entries(attendus)) assert.equal(L.t(fr), en, fr);
});

test('les morceaux d’une phrase gardent leurs titres pour le lecteur d’écran, en français comme avant', () => {
  /* Le titre de la leçon et « Leçon au complet » se traduisent chacun (lgNt : data-notrad dans une autre langue seulement) */
  assert.ok(app.includes("<p class=\"bravo-lesson\">${esc(l.titre)}<small${typeof lgNt==='function'?lgNt():''}>${(typeof jeuTr==='function'?jeuTr:String)(l.leconSeule?'Leçon au complet':'Exercice et quiz au complet')}</small></p>"));
  assert.ok(app.includes("function lgNt(){return jeuTrEn()?' data-notrad':'';}"));
  /* Les cartes : en anglais, une phrase écrite pour la langue ; en français, la même qu’avant (bravo-actions, retours-cartes-memo-a) */
  assert.ok(app.includes("`Card ${n}, ${jeuTr(c.k)}: ${jeuTr(c.t)}. Flip the card`:`Carte ${n}, ${c.k}\\u00a0: ${c.t}. Retourner la carte`"));
  assert.ok(app.includes('<div class="ex-code mc-code"${typeof lgNt===\'function\'?lgNt():\'\'}>${highlight(typeof langueSql===\'function\'?langueSql(c.s):c.s)}</div>'), 'la syntaxe d’une carte, écrite pour la base de la langue');
});

test('les questions d’entretien : un fichier par langue, chargé par l’appli, gardé hors ligne', () => {
  const {win, ecrits} = moteur();
  assert.ok(ecrits.join('').includes('<script src="langue-en-entretien.js?v=1"><\/script>'), 'langues.js le charge (data-defis : l’appli seulement)');
  assert.ok(sw.includes("'./langue-en-entretien.js?v=1',"));
  const E = win.REQUETE_ENTRETIEN.en, s = app.indexOf('const ENTRETIEN=['), f = app.indexOf('\n];', s);
  const FR = vm.runInNewContext('(' + app.slice(s + 'const ENTRETIEN='.length, f + 2) + ')');
  assert.equal(FR.length, 142);
  for (const q of FR) {
    const t = E.questions[q.id];
    assert.ok(t && t.q && t.a, `${q.id} traduite`);
    assert.equal((t.a.match(/<code>/g) || []).length, (q.a.match(/<code>/g) || []).length, `${q.id} : les mêmes morceaux de code`);
    assert.ok(!/[éèêàçù]/.test(t.q + t.a + (t.syntaxe || '')), `${q.id} : pas de français`);
  }
  assert.equal(E.questions['ent-v2-113'].q, 'Are LEFT JOIN and LEFT OUTER JOIN the same thing?');
  /* L’appli prend la question dans la langue ; la famille et le niveau restent les clés des filtres */
  assert.ok(app.includes("function entAllItems(){ return ENTRETIEN.map((q,i)=>({q:typeof entLangue==='function'?entLangue(q):q,id:entId(q,i),n:entNum(q),i})); }"));
  assert.ok(/function entLangue\(q\)\{[^\n]*REQUETE_ENTRETIEN[^\n]*traduite:true/.test(app));
  assert.ok(app.includes("<h1 id=\"ent-focus-title\"${typeof entNt==='function'?entNt(x.q):''}>"));
});

test('le moteur : les attributs d’un morceau, d’une zone de saisie ; une valeur nommée qui ne cache pas un autre texte', () => {
  assert.ok(MOTEUR.includes("for (n = 0; n < etat.morceaux.length; n++) if (etat.morceaux[n].nodeType === 1 && etat.morceaux[n].attributes && etat.morceaux[n].attributes.length) attributs(etat.morceaux[n]);"));
  assert.ok(MOTEUR.includes("(el.nodeName === 'TEXTAREA' || el.nodeName === 'INPUT') && !el.hasAttribute('data-notrad')) { attributs(el); return; }"));
  const {L} = moteur();
  /* La prochaine étape (« Transactions ») est retenue : un texte qui la contient se traduit quand même */
  L.valeur('etape', () => 'Transactions');
  assert.equal(L.t('Module 12 · Transactions et concurrence'), 'Module 12 · Transactions and concurrency');
  assert.equal(L.t('Les leçons s’ouvrent l’une après l’autre. Ta prochaine étape : <1>Transactions</1>.'), 'Lessons open one after the other. Your next step: <1>Transactions</1>.');
});
