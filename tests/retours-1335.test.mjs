/* Elisa, 5 novembre, 13 h 35 (capture de la salle d’attente « Invite tes amis ») : « Ne pas mettre c’est bon mais prêt, prête, avec
   animation, en fonction du genre, sinon prêt·e pour quelqu’un qui n’a pas dit son sexe ».
   Le genre reste sur l’appareil (page Confidentialité, et la salle ne partage que le pseudo, les temps et les réactions) : ta ligne
   et ton bouton s’accordent, les autres joueurs gardent « prêt·e ». Vérifié dans un navigateur (430, 375 et 320 px de large). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), sw = lire('sw.js'), conf = lire('decouvrir/confidentialite.html');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const genre = cut('function genreDe(){', 'function obJobNom(');
const pret = cut('/* Elisa, 5 novembre, 13 h 35 : « ne pas mettre c’est bon', '/* Les annonces de la salle');

function salle(g) {
  const horloge = { t: 1000 };
  const ctx = vm.createContext({ state: { profile: { genre: g } }, Date: { now: () => horloge.t }, esc,
    JEU_ICO: { check: '<svg viewBox="0 0 24 24"><path d="M5.5 12.5l4.2 4.2L18.5 8"/></svg>' },
    jeuCur: () => -1, jeuOrder: () => ['a', 'b', 'c'], jeuPresent: () => true, jeuInitial: n => esc(String(n)[0]), jeuChrono: s => s + ' s' });
  vm.runInContext(genre + pret + `
    var JEU={me:'a',hostPid:'a',max:6,rounds:[],shown:new Set(),ready:{b:true},players:{a:{name:'Elisa'},b:{name:'Léa'},c:{name:'Sam'}}};
    function jeuIsReady(p){return p===JEU.hostPid||!!JEU.ready[p];}
    function lignes(){return jeuPlayersHTML('lobby').split('</li>').filter(Boolean);}`, ctx);
  return { ctx, horloge, lignes: () => ctx.lignes() };
}

test('« prête », « prêt » ou « prêt·e » : ta ligne et ton bouton suivent ton genre, les autres joueurs gardent « prêt·e »', () => {
  for (const [g, mot] of [['f', 'prête'], ['h', 'prêt'], ['n', 'prêt·e'], ['', 'prêt·e']]) {
    const { ctx, lignes } = salle(g);
    const [moi, lea, sam] = lignes();
    const Mot = mot[0].toUpperCase() + mot.slice(1);   // 13 h 20 : « Prête » en vert, « En attente » en gris
    assert.ok(moi.includes('Elisa <small>(toi)</small>') && moi.includes(`</i>${Mot}</em>`), `${g || 'sans réponse'} : ${Mot} pour toi`);
    assert.ok(lea.includes('</i>Prêt·e</em>'), 'Léa : son genre n’est pas connu ici');
    assert.ok(sam.includes('<em class="jeu-state is-att">En attente</em>') && !sam.includes('is-ready'));
    assert.equal(ctx.jeuPretBouton(false), `Je suis ${mot}`);
    assert.equal(ctx.jeuPretBouton(true), `${Mot} ✓`, 'prête : le statut « Prête ✓ » (13 h 20)');
  }
  const sans = vm.createContext({});
  vm.runInContext(pret.slice(0, pret.indexOf('const JEU_PRET_MS')), sans);
  assert.equal(sans.jeuPretMot(true), 'prêt·e', 'sans le genre (bac à sable, page à part) : la forme inclusive');
  /* Plus de « c’est bon » dans la salle */
  assert.ok(!app.includes('✓ c’est bon') && !app.includes('C’est bon pour moi'));
  assert.ok(app.includes('onclick="jeuToggleReady()"><span>${jeuPretBouton(!!J.ready[J.me])}</span><i class="jeu-ready-fl" aria-hidden="true">${DEF_CHEV_SVG}</i></button>'));
  assert.ok(app.includes("const l=rd.querySelector('span');if(l)l.textContent=jeuPretBouton(on);}"));
});

test('l’animation se joue une fois, quand le joueur passe prêt, et reprend où elle en était si la liste est redessinée', () => {
  const { ctx, horloge, lignes } = salle('f');
  let [moi, lea, sam] = lignes();
  assert.ok(/class="[^"]*is-new[^"]*is-pret"><b/.test(moi) && /is-pret"><b/.test(lea) && !sam.includes('is-pret'), 'à l’arrivée : les prêts posent leur pastille');
  horloge.t = 1300; [moi, lea] = lignes();
  assert.ok(moi.includes('is-pret" style="--pret:-300ms"><b') && lea.includes('style="--pret:-300ms"'), 'redessinée : le geste continue');
  assert.ok(!moi.includes('is-new'), 'la ligne elle-même n’entre qu’une fois');
  horloge.t = 1900; [moi, lea, sam] = lignes();
  assert.ok(![moi, lea, sam].some(l => l.includes('is-pret') || l.includes('--pret')), 'passé 900 ms : plus rien ne bouge');
  ctx.JEU.ready.c = true; horloge.t = 2000; sam = lignes()[2];
  assert.ok(sam.includes('is-pret"><b') && sam.includes('</i>Prêt·e</em>'), 'Sam passe prêt : sa pastille saute');
  ctx.JEU.ready.b = false; horloge.t = 2100; lea = lignes()[1];
  assert.ok(lea.includes('En attente') && !('b' in ctx.JEU.pretAt), 'Léa redevient en attente');
  ctx.JEU.ready.b = true; horloge.t = 2200; lea = lignes()[1];
  assert.ok(lea.includes('is-pret"><b'), 'puis de nouveau prête : la pastille resaute');
  /* Les résultats ne touchent pas à la pastille */
  assert.ok(!ctx.jeuPlayersHTML('res').includes('is-pret'));
});

test('la pastille : la coche tourne et se trace, une onde part, l’avatar bondit ; rien ne bouge en mouvement réduit', () => {
  for (const r of [
    '.jeu-players em.jeu-state.is-ready{position:relative;display:inline-flex;align-items:center;gap:5px;padding:3px 10px 3px 3px;border-radius:999px;background:var(--success-soft);color:var(--success);font-family:var(--display);',
    '.jeu-pret-ok{flex:none;display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--success-fill,var(--success));color:#fff}',
    '.jeu-players li.is-pret em.is-ready{animation:jeuPretIn .5s var(--pop) var(--pret,0ms) both}',
    '.jeu-players li.is-pret .jeu-pret-ok{animation:jeuPretOk .46s var(--pop) calc(var(--pret,0ms) + 80ms) both}',
    '.jeu-players li.is-pret .jeu-pret-ok path{animation:jeuPretTrait .3s ease-out calc(var(--pret,0ms) + 240ms) both}',
    '.jeu-players li.is-pret .jeu-av{animation:jeuPretBond .5s var(--pop) var(--pret,0ms) both}',
    '@keyframes jeuPretTrait{from{stroke-dasharray:20 30;stroke-dashoffset:22}to{stroke-dasharray:20 30;stroke-dashoffset:0}}',
    '@media (prefers-reduced-motion:reduce){.jeu-players li.is-pret *,.jeu-players li.is-pret *::after{animation:none!important}}',
    'html[data-motion="reduce"] .jeu-players li.is-pret *,html[data-motion="reduce"] .jeu-players li.is-pret *::after{animation:none!important}'])
    assert.ok(app.includes(r), r);
  /* L’onde reste invisible pendant son attente (pas de « both ») ; le tracé n’est caché que dans l’animation : sans elle, la coche est là */
  const onde = app.match(/\.jeu-players li\.is-pret em\.is-ready::after\{[^}]*\}/)[0];
  assert.ok(onde.includes('opacity:0;') && onde.endsWith('animation:jeuPretOnde .7s ease-out calc(var(--pret,0ms) + 280ms)}'));
  assert.ok(!/jeu-pret-ok path\{[^}]*stroke-dash/.test(app));
});

test('le genre ne sort pas de l’appareil : la salle ne l’envoie pas', () => {
  assert.ok(!cut('function jeuSend(m){', '\n}\n').includes('genre'));
  assert.ok(conf.includes('ton genre et ta profession (si tu les indiques)'), 'Confidentialité : il reste sur l’appareil');
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-13-reglages-v2939';") && app.includes("const SW_CACHE='requete-2026-11-13-reglages-v2939';"));
});
