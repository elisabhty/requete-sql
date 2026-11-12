/* Elisa, 12 novembre, 16 h 03, d’après un fil de X (la connexion en feuille, +10 % de fins d’onboarding) et trois écrans de Knowunity :
   - « ajouter un exemple de notification dans la liste qu’on a déjà, la meilleure que tu trouves, un peu rigolote » : sur la page des
     rappels, la bulle du chat montre un vrai rappel de la liste ;
   - « mettre, comme il a dit, la partie connexion à la moitié de l’écran » : la connexion est une feuille au-dessus de « Ton parcours
     est prêt » ;
   - « intégrer un graphique pour la progression » : la progression projetée du plan, sur « Ton parcours est prêt ! ». */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = lire('index.html'), obv = lire('onboarding-vitrine.css');
const cut = (a, b) => { const i = html.indexOf(a); assert.ok(i > 0, `repère : ${a}`); const j = html.indexOf(b, i); assert.ok(j > i, `repère : ${b}`); return html.slice(i, j); };

test('le rappel : la bulle du chat montre un vrai rappel de la liste, le plus SQL', () => {
  const ctx = vm.createContext({escAttr: s => String(s).replace(/"/g, '&quot;'), esc: s => String(s)});
  vm.runInContext(cut('const RAPPEL_MESSAGES=[', '/* « Est-ce que je pourrais ajouter') + cut('function obRappelExemple(){', 'let obRappelEnCours=false;'), ctx);
  ctx.liste = null;
  vm.runInContext('function rappelListe(){return liste||RAPPEL_MESSAGES;}', ctx);
  const ex = [...vm.runInContext('obRappelExemple()', ctx)];
  assert.deepEqual(ex, ['📉 SELECT motivation', 'Résultat : 0 ligne. On corrige ça ?'], 'pris dans la liste, pas réécrit');
  const h = vm.runInContext('obRappelExempleHTML()', ctx);
  assert.ok(h.includes('role="img" aria-label="Exemple de rappel : 📉 SELECT motivation. Résultat : 0 ligne. On corrige ça ?"'), 'lu comme un exemple');
  assert.ok(h.includes('<img src="assets/icon-192.png" width="20" height="20" alt="" draggable="false"><strong>📉 SELECT motivation</strong><i>maintenant</i>'), 'l’icône de l’appli, le titre, « maintenant »');
  assert.ok(fs.existsSync(path.join(root, 'assets/icon-192.png')));
  /* La liste du site ne l’a plus : le premier de la liste prend sa place. */
  ctx.liste = [['☕ SQL ou café ?', 'Les deux, c’est encore mieux.'], ['a', 'b'], ['c', 'd'], ['e', 'f']];
  assert.deepEqual([...vm.runInContext('obRappelExemple()', ctx)], ['☕ SQL ou café ?', 'Les deux, c’est encore mieux.']);
  assert.ok(lire('rappels.json').includes('SELECT motivation'), 'il est aussi dans la liste du site');
  assert.ok(obv.includes('html #onboarding.ob-vitrine .ob-nx-h strong{flex:1 1 auto;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;'));
});

test('la connexion est une feuille à mi-écran, au-dessus de « Ton parcours est prêt »', () => {
  const p = cut("}else if(slide==='account'){", "}else if(slide==='paywall'){");
  assert.ok(p.includes('<div class="ob-screen ob-profile ob-account is-feuille">${obFlowHeader(slide)}'));
  /* 18 h 12 : « Connecte-toi en un geste, et c’est parti. » à la place de « Garde-le… » */
  assert.ok(p.includes('<button type="button" class="ob-acc-fond" onclick="obBack()" aria-label="${finale?\'Revenir à mon parcours\':\'Revenir en arrière\'}">') && p.includes("const haut=finale?`Ton parcours est prêt${prenom?', '+esc(prenom):''}.`:") && p.includes('<b>${haut}</b><small>Connecte-toi en un geste, et c’est parti.</small></button>'), 'le haut referme la feuille sur le parcours');
  assert.ok(p.includes('<div class="ob-acc-feuille"><i class="ob-acc-poignee" aria-hidden="true"></i><img class="ob-acc-chat" src="assets/chat-cle${chatFixe?\'-fixe\':\'\'}.webp"'), 'la poignée, le chat à la clé sur le bord');
  for (const f of ['chat-cle.webp', 'chat-cle-fixe.webp']) assert.ok(fs.existsSync(path.join(root, 'assets', f)), f);
  assert.ok(p.includes("${authReady?obCompteAtoutsHTML():''}") && p.includes("onclick=\"obStartAuth('${provider}',this)\""), 'ses trois repères, Apple et Google : les mêmes boutons');
  assert.ok(!/sans compte|Plus tard|obSansCompte/i.test(p.slice(p.indexOf('if(!masquee){'), p.indexOf('}else\n    html='))), 'le compte reste le seul chemin');
  assert.ok(html.includes("root.classList.toggle('ob-compte-feuille',slide==='account'&&!obLegalMode&&!(typeof obConnexionMasquee==='function'&&obConnexionMasquee()));"));
  for (const r of ['html #onboarding.ob-vitrine.ob-compte-feuille .ob-slides{background-color:rgba(22,12,70,.4);',
    'html #onboarding.ob-vitrine .ob-screen.ob-account.is-feuille{display:flex;flex-direction:column;min-height:100%;padding-bottom:0!important}',
    'html #onboarding.ob-vitrine .ob-acc-feuille{position:relative;flex:none;display:flex;flex-direction:column;margin:0!important;padding:10px 24px 6px;border-radius:30px 30px 0 0;background:#fff;',
    /* 18 h 12 : la feuille est lavande et porte sa phrase des conditions ; son pied est caché (un seul bloc qui monte) */
    'html #onboarding.ob-vitrine.ob-feuille-seule .ob-foot{display:none!important}',
    'html #onboarding.ob-vitrine .ob-acc-feuille{padding:10px 22px calc(var(--safe-bottom,0px) + max(12px,22px - max(0px,var(--safe-bottom,0px) - 34px)));background:#F4F2FC}',
    '@keyframes obvFeuilleMonte{from{transform:translateY(64vh)}to{transform:none}}'])
    assert.ok(obv.includes(r), r);
  assert.ok(obv.includes('html:not([data-motion="reduce"]) #onboarding.ob-vitrine.ob-enter .ob-screen.ob-account.is-feuille>.ob-acc-feuille,html:not([data-motion="reduce"]) #onboarding.ob-vitrine.ob-compte-feuille.ob-enter .ob-foot{animation:obvFeuilleMonte .5s cubic-bezier(.2,.9,.25,1) both}'), 'la feuille et son pied montent ensemble');
});

test('la progression projetée : la courbe du plan construit, aucun chiffre inventé', () => {
  const jour0 = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const D0 = new Date(2026, 10, 12);
  const seances = [['2026-11-12', [1, 2, 'd1']], ['2026-11-16', [3]], ['2026-11-19', []], ['2026-11-23', [4, 5, 6]], ['2026-11-26', [7, 8]]];
  const ctx = vm.createContext({
    draft: {niveau: 'debutant', rythme: 'regulier', freq: 2}, RYTHMES: [{k: 'court'}, {k: 'regulier'}],
    apercuPlan: () => ({sessions: seances.map(([d, lessons]) => ({d, lessons}))}), auj: () => jour0(D0), parseD: s => jour0(new Date(s + 'T00:00:00')),
    isDefiId: id => typeof id === 'string', plur: (n, m) => n + ' ' + (n > 1 ? m + 's' : m), escAttr: s => String(s), esc: s => String(s), Math, Date,
  });
  vm.runInContext(cut('function obProjection(){', '/* À 100 % : une gerbe de confettis'), ctx);
  const g = JSON.parse(vm.runInContext('JSON.stringify(obProjection())', ctx));
  assert.equal(g.total, 8, 'les leçons du plan, sans les défis');
  assert.equal(g.seances, 4, 'les séances qui ont des leçons');
  assert.deepEqual(g.pts[0], [0, 0], 'part de 0 aujourd’hui');
  assert.deepEqual(g.pts[g.pts.length - 1], [1, 1], 'arrive au total le jour de la dernière séance');
  assert.ok(g.pts.every((q, i) => !i || (q[0] >= g.pts[i - 1][0] && q[1] >= g.pts[i - 1][1])), 'ne redescend jamais');
  assert.equal(g.fin, '26 nov.');
  assert.equal(g.mi.n, 6, 'la moitié (4 leçons) est passée le jour où l’on en a 6');
  assert.equal(g.mi.jour, '23 nov.');
  const h = vm.runInContext('obProjectionHTML()', ctx);
  assert.ok(h.includes('aria-label="Ta progression projetée : de 0 leçon aujourd’hui à 8 leçons le 26 nov., en 4 séances ; la moitié le 23 nov."'));
  assert.ok(h.includes('<b>Ta progression projetée</b><em class="ob-proj-fin">8 leçons</em>') && h.includes('<span>Aujourd’hui</span><span>26 nov.</span>'));
  assert.ok(!/%|élèves|note/i.test(h.replace(/style="[^"]*"/g, '')), 'ni pourcentage d’élèves ni note promise');
  /* Un plan d’une seule séance, ou sans date : pas de courbe. */
  ctx.apercuPlan = () => ({sessions: [{d: '2026-11-12', lessons: [1]}]});
  assert.equal(vm.runInContext('obProjectionHTML()', ctx), '');
});

test('la courbe prend la place des modules une fois le parcours prêt, sans faire bouger la page', () => {
  assert.ok(html.includes("</span>`).join('')}</div>${obProjectionHTML()}</div></div>`;"), 'dans la carte de la construction');
  const r = cut('function obRunBuild(){', 'function obProjection(){');
  assert.ok(r.includes("const h=ch.offsetHeight;if(h<104)return;") && r.includes("pr.style.height=h+'px';bd.classList.add('a-proj');"), 'à la hauteur des modules ; trop peu de place : ils restent');
  assert.ok(r.includes('if(T)obDemoTimers.push(setTimeout(montrer,1100));else montrer();'), 'après la vague des modules ; revenue sur la page : tout de suite');
  for (const c of ['html #onboarding.ob-vitrine .ob-proj{display:none;', 'html #onboarding.ob-vitrine .ob-build.a-proj .ob-build-path{display:none!important}', 'html #onboarding.ob-vitrine .ob-build.a-proj .ob-proj{display:flex}',
    'vector-effect:non-scaling-stroke'])
    assert.ok(obv.includes(c), c);
});
