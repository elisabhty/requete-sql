/* Elisa, 8 novembre, 13 h 09 puis 13 h 15 : « Est-ce vraiment un défi le texte ? » ; « dans la situation il n’explique pas vraiment
   le contexte, du style on est dans un escape game ». La consigne s’ouvre sur « La situation » (la question, c’est le titre). ed2 est
   réécrit comme modèle, à valider avant les autres : le lieu et ce qu’on y fait, la donnée en jeu, qui veut quoi et pourquoi, puis
   « À toi de jouer ! ». 13 h 28 puis 13 h 31 : 70, puis 100 mots au plus, pour bien poser le lieu. Les solutions ne changent pas.
   Puis : « Ok c’est beaucoup mieux, on essaie de 150 max pour tous mais pas besoin d’aller jusqu’à là » : les 477 situations
   suivent le modèle, 150 mots au plus, sans remplissage. Chaque détail cité (statuts, types, dates, quantités) vient des données. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const data = vm.runInNewContext(app.slice(app.indexOf('const CHALLENGES=['), app.indexOf('const NIV=')) + ';({challenges:CHALLENGES})');
const mots = s => String(s || '').split(/[\s ]+/).filter(Boolean).length;

test('la consigne s’ouvre sur « La situation » ; l’ancien format (une question seule) garde « La question »', () => {
  const i = app.indexOf('function defiConsigneHTML(c,o){'), f = app.slice(i, app.indexOf('\n}\n', i));
  assert.ok(f.includes('<div class="consigne dq${base?\' has-base\':\'\'}${titre?\' has-titre\':\'\'}">${base}${titre}<span class="tag">La situation</span>${c.situation?'), 'en salle, la base en pastille posée sur le bord du cadre (8 novembre, 18 h 36), puis le titre (21 h 51)');
  assert.ok(f.includes('${titre}<span class="tag">La question</span><p class="defi-ctx">${esc(c&&(c.contexte||c.q)||\'\')'));
});

test('ed2, le modèle : l’escape game, le maître du jeu, les avis, le besoin de Malik, puis le défi', () => {
  const c = data.challenges.find(x => x.id === 'ed2');
  assert.equal(c.situation, 'Au Cadran Fêlé, un escape game lyonnais, des équipes de 2 à 6 joueurs s’enferment dans l’une de ses salles à thème (enquête, épouvante, science-fiction…). Elles ont 60 à 90 minutes pour résoudre les énigmes et sortir. Pendant la partie, un maître du jeu les suit et leur souffle des indices quand elles bloquent. À la sortie, l’équipe peut laisser un avis noté de 1 à 5. Malik, qui dirige les maîtres du jeu, veut les classer selon leur note moyenne avant leurs entretiens annuels. À toi de jouer !');
  assert.match(c.situation, / veut /, 'le besoin');
  assert.ok(mots(c.situation) <= 150, '150 mots au plus');
  assert.ok(c.sol.includes('DENSE_RANK() OVER (ORDER BY AVG(a.note) DESC)'), 'la solution ne change pas');
});

test('les 477 situations suivent le modèle : le lieu d’abord, la personne et son besoin, puis « À toi de jouer ! »', () => {
  assert.equal(data.challenges.length, 477);
  for (const c of data.challenges) {
    const s = c.situation;
    assert.match(s, /^(À|Au|Chez) /, `${c.id} : la situation s’ouvre sur le lieu`);
    assert.match(s, /À toi de jouer !$/, `${c.id} : le défi pour finir`);
    assert.equal(s.split('À toi de jouer').length, 2, `${c.id} : une seule fois`);
    assert.ok(mots(s) <= 150, `${c.id} : ${mots(s)} mots`);
    assert.doesNotMatch(s, /\b(bientôt|prochainement)\b/i, `${c.id} : rien qui date`);
    assert.doesNotMatch(s, /«(?! )|(?<! )»/, `${c.id} : espaces insécables dans les guillemets`);
  }
});

test('le contexte reprend les vraies données de chaque base', () => {
  const S = id => data.challenges.find(x => x.id === id).situation;
  assert.ok(S('af1').includes('programmé, à l’heure, retardé, annulé ou terminé'), 'les cinq statuts des vols');
  assert.ok(S('af26').includes('(Airbus, Boeing ou Embraer)'), 'les trois constructeurs de la flotte');
  assert.ok(S('hd4').includes('de 4 en Neurologie à 12 aux Urgences'), 'les lits des services');
  assert.ok(S('lf7').includes('cellules, eau, roche ou sang'), 'les types d’échantillons');
  assert.ok(S('kf4').includes('le brouillard a fait fermer les remontées du secteur des Crêtes'), 'le 18 février');
  assert.ok(S('tf2').includes('des burgers pour La Bielle'), 'les trois cartes');
  assert.ok(S('vd6').includes('l’Afrique, l’Amérique, l’Asie, l’Europe et l’Océanie'), 'les cinq continents');
  for (const id of ['ed2', 'ef1', 'em3']) assert.ok(!S(id).includes('braquage'), `${id} : la Chambre Forte n’est pas ouverte`);
});

/* Elisa, 8 novembre, 21 h 51 : « mettre le titre dans le cadre blanc avant la situation, de la manière la plus UI UX possible » */
test('le titre du défi en tête du cadre blanc, avant « La situation » ; en salle comme sur la page d’un défi', () => {
  const src = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('function defiConsigneHTML(c,o){'), src.indexOf('\n}\n', src.indexOf('function defiConsigneHTML(c,o){')) + 3);
  const ctx = vm.createContext({ esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), escCode: s => String(s), DEFI_BASES: { wok: { nom: 'Wok Chinois' } },
    defiSituationSeule: s => s, defiAToiHTML: () => '<div class="dq-atoi"></div>', ED_SCHEMA_SVG: '', schAttn: () => '' });
  vm.runInContext(fn, ctx);
  ctx.c = { titre: 'Comment se répartissent les notes ?', base: 'wok', situation: 'À La Perle du Wok…', affiche: ['la note'], ordered: false };
  const salle = vm.runInContext('defiConsigneHTML(c,{base:true,titre:true})', ctx);
  assert.ok(salle.startsWith('<div class="consigne dq has-base has-titre"><span class="dq-chip is-base">Base Wok Chinois</span><h1 class="dq-titre">Comment se répartissent les notes ?</h1><span class="tag">La situation</span>'), salle.slice(0, 200));
  assert.ok(vm.runInContext('defiConsigneHTML(c,{titre:true})', ctx).startsWith('<div class="consigne dq has-titre"><h1 class="dq-titre">'), 'la page d’un défi : sans la pastille, avec le titre');
  assert.ok(!vm.runInContext('defiConsigneHTML(c)', ctx).includes('dq-titre'), 'sans titre demandé : comme avant');
  ctx.c.titre = 'A <b>&'; assert.ok(vm.runInContext('defiConsigneHTML(c,{titre:true})', ctx).includes('<h1 class="dq-titre">A &lt;b>&amp;</h1>'), 'échappé');
  const ouvre = src.slice(src.indexOf('function openChallenge(cid){'), src.indexOf('\n}\n', src.indexOf('function openChallenge(cid){')));
  assert.ok(ouvre.includes('</b></div>\n    ${defiConsigneHTML(c,{titre:true})}') && !ouvre.includes('<h1>${c.titre}</h1>'), 'la page d’un défi : le titre entre dans le cadre');
  for (const k of ['html.lq .consigne.dq>.dq-titre{margin:0 0 14px;padding:0 0 14px;border-bottom:2px solid var(--line-2);color:var(--ink);',
    'font:800 23px/1.16 var(--display);letter-spacing:-.022em;text-wrap:balance}', 'html.lq .consigne.dq.has-base>.dq-titre{margin-top:6px}'])
    assert.ok(css.includes(k), k);
});
