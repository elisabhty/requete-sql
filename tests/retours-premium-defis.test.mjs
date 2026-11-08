/* Elisa, 8 novembre, 11 h 08, sur la feuille « Ta salle de défi » (le niveau, ×4 en pastille jaune, 5 joueurs max en verre, la coche
   au bout de la ligne) : « Voilà parfait, c’est le niveau que j’attends ; modifie donc les pages défis pour ce niveau premium ».
   Les pastilles de la feuille dans toutes les pages Défis (le niveau en blanc avec ses barres, les points en jaune après la pièce, les
   joueurs avec leurs silhouettes ; sur le violet, le verre clair) ; Joueurs, Mes stats et ta place au classement dans le bandeau violet
   de la feuille (l’autocollant, le surtitre menthe, le titre jaune, les pastilles) ; la carte du joueur et la fiche aussi.
   Vérifié dans Chrome (393, 375 et 320 px) : Jouer, Classement, Joueurs, Mes stats, la fiche ; « 3 manches » et le rang tiennent à 393. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const fn = name => { const i = app.indexOf(`function ${name}(`); assert.ok(i > 0, name); return app.slice(i, app.indexOf('\n}\n', i) + 3); };
const ligne = name => { const i = app.indexOf(`function ${name}(`); assert.ok(i > 0, name); return app.slice(i, app.indexOf('\n', i) + 1); };
const cst = name => { const i = app.indexOf(`const ${name}=`); assert.ok(i > 0, name); return app.slice(i, app.indexOf('\n', i) + 1); };

function bac(o = {}) {
  const ctx = vm.createContext(Object.assign({ JEU_NIVL: { f: 'Facile', m: 'Moyen', d: 'Difficile' } }, o));
  vm.runInContext(cst('DX_PIECE_SVG') + cst('DX_GENS_SVG') + ['dxBarres', 'dxPc', 'dxPcNiv', 'dxPcPts', 'dxPcGens'].map(ligne).join(''), ctx);
  return ctx;
}

test('les pastilles de la feuille : le niveau et ses barres, la pièce et les points, les silhouettes et les joueurs ; le texte d’un tenant', () => {
  const c = bac();
  assert.equal(c.dxPcNiv('d'), '<span class="dx-pc is-niv is-d is-blanc"><i class="jeu-bars is-d" aria-hidden="true"><b></b><b></b><b></b></i><span>Difficile</span></span>');
  assert.equal(c.dxPcNiv('m', 'is-verre'), '<span class="dx-pc is-niv is-m is-verre"><i class="jeu-bars is-m" aria-hidden="true"><b></b><b></b><b></b></i><span>Moyen</span></span>');
  assert.ok(c.dxPcPts('310 pts').startsWith('<span class="dx-pc is-pts"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.6" fill="#fff"') && c.dxPcPts('310 pts').endsWith('</svg><span>310 pts</span></span>'));
  assert.ok(c.dxPcGens('2/5').startsWith('<span class="dx-pc is-gens is-doux"><svg') && c.dxPcGens('2/5').endsWith('<span>2/5</span></span>'));
  /* « 3<sup>e</sup> en France » reste d’un tenant : le texte dans un seul span (sinon l’écart des pastilles le coupait en trois) */
  assert.equal(c.dxPc('is-blanc', '3<sup>e</sup> en France'), '<span class="dx-pc is-blanc"><span>3<sup>e</sup> en France</span></span>');
  assert.ok(cst('DX_PIECE_SVG').includes('fill="#FFC83D"') && cst('DX_GENS_SVG').includes('stroke="currentColor"'), 'la pièce de la feuille, les silhouettes de « Retrouver mes adversaires »');
});

test('Jouer : la carte du joueur (la pastille jaune et le rang), le coefficient de chaque niveau (la pièce, jaune sur le niveau choisi), les salles en pastilles', () => {
  const moi = fn('defisMoiHTML');
  assert.ok(moi.includes("const ligne=k.pts||rang?`${dxPcPts(sallePts(k.pts))}${rang?`<span class=\"dx-me-rang\">${rang}</span>`:''}`:lt;"));
  assert.ok(fn('jeuNiveauxHTML').includes('`<span class="room-lv-x" aria-hidden="true">${DX_PIECE_SVG}×${x}<small>pts</small></span>`'));
  const salle = fn('salleLigneHTML');
  assert.ok(salle.includes('<span class="dx-nom">${esc(n)}</span>${dxPcGens(`${s.nb}/${s.max}`)}</b><small class="dx-pcs">${dxPcNiv(s.niv)}<span class="dx-pc-t">${qui?\'salle ouverte\':m}</span></small>'));
  for (const r of ['html.lq #scr-defis .room-level .room-lv-x{gap:4px;min-width:0;padding:3px 10px 3px 4px;border-radius:999px;background:var(--dx-tuile);',
    'html.lq #scr-defis .room-level.on .room-lv-x{background:var(--sun);box-shadow:0 2px 0 var(--sun-lip);color:var(--ink)}',
    'html.lq #scr-defis .dx-rapide .room-level.on .room-lv-x::after{background:linear-gradient(100deg,rgba(255,255,255,0),rgba(255,255,255,.75) 50%,rgba(255,255,255,0))}',
    'html.lq #scr-defis .dx-me>.jeu-av{box-sizing:border-box;border:2px solid #fff;box-shadow:0 0 0 2px var(--ink),0 2px 0 2px var(--ink)}',
    '@media (max-width:380px){html.lq #scr-defis .dx-list .dx-t small.dx-pcs .dx-pc .jeu-bars{display:none}'])
    assert.ok(lq.includes(r), r);
});

test('Joueurs, Mes stats, ta place : le bandeau violet de la feuille, ses pastilles en verre ; la fiche aussi', () => {
  const amis = fn('defisAmisPeindre');
  assert.ok(amis.includes('<div class="dx-amis-tete dx-bande"><span class="room-stk" aria-hidden="true">${lqStkSvg(\'epees\')}</span><div><p class="room-kicker" id="dx-amis-k">Tes adversaires</p><h2 id="dx-amis-h">${amisTitre(n)}</h2>'));
  assert.ok(amis.includes("${n?'<p class=\"room-sub\">Défie-les, rejoins leurs salles, prends ta revanche.</p>':''}<p class=\"dx-bande-pcs\" id=\"dx-amis-pcs\">${amisPcsHTML(amis)}</p>"));
  /* Les pastilles du bandeau : qui attend dans une salle ouverte (le point vert), combien de duels */
  const c = bac({ drapCle: n => String(n).replace(/^@/, '').toLowerCase(), DEFIS: { salles: [{ hote: '@kev', joueurs: [{ pseudo: '@tom' }] }] } });
  vm.runInContext(fn('amisPcsHTML'), c);
  const pcs = c.amisPcsHTML([{ n: '@tom', g: 4 }, { n: '@zoe', g: 1 }]);
  assert.equal(pcs, '<span class="dx-pc is-verre is-live"><i class="dx-dot" aria-hidden="true"></i><span>1 en salle</span></span><span class="dx-pc is-verre"><span>5 duels</span></span>');
  assert.equal(c.amisPcsHTML([]), '', 'sans adversaire : rien');
  assert.ok(fn('amisListesPeindre').includes("const pc=document.getElementById('dx-amis-pcs'),ph=amisPcsHTML(amis);if(pc&&pc.innerHTML!==ph)pc.innerHTML=ph;"), 'les salles changent : les pastilles suivent');
  const stats = fn('defisStatsPeindre');
  assert.ok(stats.includes('<div class="dx-bande dx-stats-bande"><span class="room-stk dx-fiche-av" aria-hidden="true">') && stats.includes("if(nom&&!r&&!DEFIS.cls.busy.carte&&clsOn())clsRangsCharger();"));
  assert.ok(app.includes('<div id="defis-stats" class="defis-panel" aria-labelledby="dx-stats-k dx-stats-h" hidden>'), '« Mes stats » puis ton pseudo, au lecteur d’écran');
  assert.ok(fn('clsRangsCharger').includes("if(DEFIS.onglet==='stats')defisStatsPeindre();"), 'les rangs arrivent : les pastilles de Mes stats aussi');
  const place = fn('clsPlacePeindre');
  assert.ok(place.includes('<div class="dx-bande dx-place-bande" role="group" aria-labelledby="dx-place-t">') && place.includes("<p class=\"room-kicker\">${DEFIS.periode==='semaine'?'Ta place cette semaine':'Ta place'}</p>"));
  assert.ok(place.includes('<p class="dx-bande-pcs">${dxPcPts(`${clsPts(pts)}\\u00a0pts`)}${versPage}</p>') && place.includes('if(tete)tete.hidden=true;'));
  const fiche = fn('dxFicheHTML');
  assert.ok(fiche.includes("const pcs=(e.lieu?dxPc('is-blanc',esc(e.lieu)):'')+(m?dxPc('is-verre is-adv','Ton adversaire'):'');") && fiche.includes('<p class="room-sub dx-f-pcs" id="dx-f-p">${pcs}</p>'));
  assert.ok(fiche.includes('<small class="dx-pcs">${dxPcNiv(s.niv)}${dxPcGens(`${s.nb}/${s.max}`)}</small>'));
});

test('la feuille de style : les pastilles et le bandeau, dans les Défis seulement ; « Page 3 › » se touche à 44 px', () => {
  const v2 = lq.slice(lq.lastIndexOf('/*', lq.indexOf('Défis v2 · 21. Le niveau de « Ta salle de défi »')));
  assert.ok(v2.length > 5000);
  for (const r of ['html.lq :is(#scr-defis,.dx-feuille) .dx-pc{display:inline-flex;align-items:center;gap:5px;flex:none;min-height:24px;',
    'html.lq :is(#scr-defis,.dx-feuille) .dx-pc.is-pts{padding-left:4px;background:var(--sun);color:var(--ink);box-shadow:0 2px 0 var(--sun-lip)}',
    'html.lq :is(#scr-defis,.dx-feuille) .dx-pc.is-verre{background:rgba(255,255,255,.14);color:#fff;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.34)}',
    'html.lq :is(#scr-defis,.dx-feuille) .dx-pc.is-d .jeu-bars b{background:var(--dx-d)}',
    'html.lq #scr-defis .dx-bande{position:relative;isolation:isolate;overflow:hidden;display:flex;align-items:center;gap:14px;',
    'html.lq #scr-defis .dx-bande h2{margin:3px 0 0;overflow:hidden;color:var(--sun-hi)!important;',
    'html.lq #scr-defis .dx-place-go::after{content:"";position:absolute;inset:-8px -4px}',
    'html.lq #scr-defis .dx-stats-tete>.dx-bande{flex:1;min-width:0;margin:0 var(--gut,20px)}'])
    assert.ok(v2.includes(r), r);
  const regles = v2.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map(r => r.trim()).filter(r => r.includes('{') && !r.startsWith('@'));
  assert.ok(regles.length > 40 && regles.every(r => /^html\.lq(\[[^\]]+\])? (#scr-defis|\.dx-feuille|:is\(#scr-defis,\.dx-feuille\))/.test(r.split('{')[0].trim())), 'rien hors des Défis');
});
