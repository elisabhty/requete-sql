/* Elisa, 13 novembre, 0 h 32 : « maintenant verrouiller les cours en laissant que le premier cours pour un nouvel apprenant, qui va
   du coup suivre son parcours jusqu’à la fin (mettre comme un verrou ou quelque chose comme ça, mais joli) ».
   Le parcours se suit : les leçons validées ou entamées restent ouvertes, avec tout ce qui les précède, plus une seule : la
   prochaine étape. Les autres portent un cadenas partout où elles s’affichent, et openLesson garde la règle d’où qu’on vienne. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = lire('index.html');
const css = lire('ludique.css');
const cut = (a, b) => { const i = html.indexOf(a); assert.ok(i >= 0, a); const j = html.indexOf(b, i + a.length); assert.ok(j > i, b); return html.slice(i, j); };

/* La règle, hors de l’app : 10 leçons aux identifiants en désordre (comme les vrais), un état qu’on choisit */
const regle = cut('const LECON_RANG=new Map();', '/* Planning : la pastille au bout');
const IDS = [0, 2, 13, 4, 5, 6, 22, 7, 8, 9];
function monde({ faites = [], entamees = [], videos = [], enCours, casse = false } = {}) {
  const lessons = {};
  faites.forEach(i => { lessons[IDS[i]] = { done: true }; });
  const ctx = {
    allLessons: IDS.map((id, i) => ({ id, titre: 'Leçon ' + (i + 1) })),
    state: { lessons },
    nbFaites: id => { if (casse) throw new Error('pas prêt'); return entamees.includes(IDS.indexOf(id)) ? 1 : 0; },
    exercicesFaits: () => 0,
    LV_POS: new Set(videos.map(i => IDS[i])),
    pathCurrentLessonId: () => enCours === undefined ? (IDS.find(id => !(lessons[id] && lessons[id].done)) ?? null) : enCours,
  };
  vm.createContext(ctx);
  vm.runInContext(regle + ';globalThis.R={leconRang,leconEntamee,leconFrontiere,leconOuverte,leconCle};', ctx);
  const R = ctx.R;
  return { ...R, ouvertes: () => IDS.map((id, i) => R.leconOuverte(id) ? i + 1 : 0).filter(Boolean) };
}

test('un nouvel apprenant n’a que la première leçon ; chaque leçon validée ouvre la suivante, jusqu’à la fin', () => {
  const neuf = monde();
  assert.equal(neuf.leconFrontiere(), 0);
  assert.deepEqual(neuf.ouvertes(), [1]);
  assert.equal(neuf.leconCle().titre, 'Leçon 1', 'la prochaine étape');
  for (let n = 1; n < IDS.length; n++) {
    const m = monde({ faites: [...Array(n).keys()] });
    assert.deepEqual(m.ouvertes(), [...Array(n + 1).keys()].map(i => i + 1), n + ' validée(s) : une de plus est ouverte');
    assert.equal(m.leconCle().titre, 'Leçon ' + (n + 1));
  }
  const fini = monde({ faites: [...IDS.keys()], enCours: null });
  assert.equal(fini.ouvertes().length, IDS.length, 'parcours terminé : plus aucun cadenas');
  assert.equal(fini.leconFrontiere(), IDS.length - 1);
});

test('personne ne perd une leçon où il est déjà allé : validée, entamée, ou en cours dans un ancien parcours', () => {
  /* Progression en désordre (d’avant le verrou) : tout ce qui précède la plus avancée reste ouvert, et la suivante */
  const desordre = monde({ faites: [0, 1, 4] });
  assert.deepEqual(desordre.ouvertes(), [1, 2, 3, 4, 5, 6]);
  assert.equal(desordre.leconCle().titre, 'Leçon 6', 'celle qui, validée, ouvre la suivante');
  /* Une leçon entamée (un exercice fait, ou la vidéo commencée) reste ouverte, sans ouvrir la suivante */
  assert.deepEqual(monde({ entamees: [3] }).ouvertes(), [1, 2, 3, 4]);
  assert.deepEqual(monde({ videos: [6] }).ouvertes(), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(monde({ videos: [6] }).leconEntamee(IDS[6]), true);
  assert.equal(monde().leconEntamee(IDS[6]), false);
  /* Un ancien parcours parti plus loin que la première leçon : sa leçon en cours est ouverte */
  assert.deepEqual(monde({ enCours: IDS[5] }).ouvertes(), [1, 2, 3, 4, 5, 6]);
  /* Le rang suit l’ordre du parcours, pas les identifiants */
  assert.equal(monde().leconRang(13), 2);
  assert.equal(monde().leconRang(999), -1);
  assert.equal(monde().leconOuverte(999), true, 'une leçon inconnue n’est pas « verrouillée » : openLesson l’écarte avant');
  /* Les compteurs pas encore prêts (au tout début du chargement) : la règle répond quand même */
  assert.deepEqual(monde({ casse: true }).ouvertes(), [1]);
});

test('openLesson garde la règle d’où qu’on vienne ; la reprise au lancement n’ouvre pas une leçon verrouillée', () => {
  const o = cut('function openLesson(id, restoreStep){', 'stkLeaveLesson();');
  assert.ok(o.includes("  const l=allLessons.find(x=>x.id===id); if(!l)return;\n"));
  assert.ok(o.includes("  lqPathCurrent=undefined;\n  if(!leconOuverte(id)){if(!restoringNav)leconVerrouDire(id);return;}\n"), 'avant tout le reste : ni statistique, ni écran de leçon');
  assert.ok(o.indexOf('leconOuverte(id)') < o.indexOf("stat('lecon_debut'"));
  assert.ok(html.includes("}else if(nav.view==='lesson'&&nav.lessonId!=null&&allLessons.some(l=>l.id===nav.lessonId)&&leconOuverte(nav.lessonId)){"), 'sinon : l’onglet d’où l’on venait');
  /* Toutes les entrées passent par openLesson (les défis ne sont pas verrouillés) */
  assert.ok(html.includes('function openItem(id,step){if(isDefiId(id))openChallenge(id);else openLesson(id,step);}'));
});

test('toucher un cadenas : il remue, puis la feuille dit la prochaine étape, et « Y aller » y mène', async () => {
  const f = cut('function leconVerrouDire(id){', '\n}\n') + '\n}';
  const vu = { classes: [], ouvert: [] };
  const ligne = { classList: { add: c => vu.classes.push('+' + c), remove: c => vu.classes.push('-' + c) }, offsetWidth: 1 };
  let demande = null, repond;
  const ctx = {
    leconCle: () => ({ id: 13, titre: 'WHERE & <b>' }), leconEntamee: () => vu.entamee === true,
    buzz: t => { vu.buzz = t; }, esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    document: { querySelectorAll: sel => { vu.sel = sel; return [ligne]; } }, setTimeout: (fn) => { fn(); },
    lqAsk: o => { demande = o; return new Promise(r => { repond = r; }); }, openLesson: id => vu.ouvert.push(id),
  };
  vm.createContext(ctx);
  vm.runInContext(f + ';leconVerrouDire(22);', ctx);
  assert.equal(vu.buzz, 'warning');
  assert.equal(vu.sel, '.is-verrou[data-lid="22"]');
  assert.deepEqual(vu.classes, ['-lq-non', '+lq-non', '-lq-non']);
  assert.equal(demande.ico, '🔒');
  assert.equal(demande.titre, 'Leçon verrouillée');
  assert.equal(demande.texteHtml, 'Les leçons s’ouvrent l’une après l’autre. Ta prochaine étape : <b>WHERE &amp; &lt;b&gt;</b>.', 'le titre est échappé');
  assert.equal(demande.oui, 'Y aller');
  assert.equal(demande.non, 'Plus tard');
  assert.ok(!/bient[oô]t|prochainement/i.test(demande.texteHtml));
  repond(true); await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(vu.ouvert, [13], '« Y aller » ouvre la prochaine étape');
  /* « Plus tard » : rien ; une leçon déjà entamée : « Reprendre ma leçon » */
  vu.ouvert.length = 0; vu.entamee = true;
  vm.runInContext('leconVerrouDire(22);', ctx);
  assert.equal(demande.oui, 'Reprendre ma leçon');
  repond(false); await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(vu.ouvert, []);
  /* Le cadenas de la feuille : un autocollant de l’app */
  assert.ok(html.includes("'ℹ️':'info','🔒':'cadenas'};"));
  assert.ok(html.includes("    cadenas:['<rect x=\"8\" y=\"21\" width=\"32\" height=\"22\" rx=\"7\"/>"));
});

test('le cadenas se voit partout où une leçon s’affiche : le parcours, la recherche, les modules, le planning, l’avancement', () => {
  /* La ligne d’une leçon (accueil et recherche) : le cadenas à la place du numéro, dit aux lecteurs d’écran */
  const l = cut('function lessonListRow(l){', '\n}\n');
  assert.ok(l.includes('  const ferme=!ok&&!cur&&!leconOuverte(l.id);'));
  assert.ok(l.includes('class="row ${ok?\'done-row\':\'\'} ${cur?\'current\':\'\'}${ferme?\' is-verrou\':\'\'}" data-lid="${l.id}" onclick="openLesson(${l.id})"'));
  assert.ok(l.includes('<div class="lz-num ${numCls}">${ferme?LQ_CADENAS_SVG+\'<span class="lz-sr">Verrouillée : </span>\':due?\'↻\':(lessonPos(l.id)?.li??l.id)}</div>'));
  assert.ok(html.includes("const LQ_CADENAS_SVG='<svg class=\"lq-cad\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\""), 'un tracé, pas un émoji');
  assert.ok(html.includes('<path class="lq-cad-anse" d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/>'));
  /* Un module pas encore atteint : un cadenas au coin de sa tuile, et il se déplie toujours (c’est un <details>) */
  const m = cut('function renderModules(){', 'const toolsOpen=');
  assert.ok(m.includes('    const ferme=!complete&&!leconOuverte(mod.lessons[0].id);'));
  assert.ok(m.includes("${moduleIndex===curMod?' is-current':''}${ferme?' is-verrou':''}\" data-module-index"));
  assert.ok(m.includes('${ferme?`<i class="home-module-cad" role="img" aria-label="Module verrouillé">${LQ_CADENAS_SVG}</i>`:\'\'}</span>'));
  /* Le planning : la pastille à la place de « Validé », sur le jour choisi et sur la prochaine séance ; jamais sur un défi */
  assert.ok(html.includes("const PL_VERROU='<span class=\"pl-chip-verrou\" role=\"img\" aria-label=\"Verrouillée\">'+LQ_CADENAS_SVG+'</span>';"));
  assert.equal(html.split('const ferme=!ok&&!m.defi&&!leconOuverte(id);').length - 1, 2);
  assert.equal(html.split("'<span class=\"pl-chip-valid\"><i aria-hidden=\"true\">✓</i>Validé</span>':ferme?PL_VERROU:''}").length - 1, 2);
  assert.ok(html.includes('class="pl-next-row${ok?\' ok\':\'\'}${ferme?\' is-verrou\':\'\'}"${ferme?` data-lid="${id}"`:\'\'} onclick="openItem(${arg})"'));
  /* « Ma progression par module » : le bouton d’un module verrouillé */
  assert.ok(html.includes('${typeof leconOuverte===\'function\'&&!leconOuverte(m.next??m.first)?`<button type="button" class="is-verrou" data-lid="${m.next??m.first}" aria-label="Module verrouillé : ${escAttr(m.title)}" onclick="openLesson(${m.next??m.first})">${LQ_CADENAS_SVG}<span>Verrouillé</span></button>`:'));
});

test('joli : lilas pâle sur le chemin, et quand une leçon s’ouvre son cadenas se lève, se dore et s’efface', () => {
  const debut = css.indexOf('Le parcours se suit — 13 novembre, 0 h 32'), fin = css.indexOf('Défis — la refonte du 7 novembre');
  assert.ok(debut > 0 && fin > debut, 'avant la refonte des défis');
  const b = css.slice(debut, fin);
  assert.ok(!b.includes('drop-shadow('));
  assert.ok(b.includes('html.lq #scr-learn #modules .home-module .row.is-verrou .lz-num,\nhtml.lq #course-search-results .row.is-verrou .lz-num{--lipc:#E4DEF7;display:grid!important;place-items:center;background:#F7F4FF!important;border-color:#E4DEF7!important;color:#ADA2DA!important}'));
  assert.ok(b.includes('html.lq #course-search-results .row.is-verrou .lz-body small{color:var(--ink-3)!important}'), 'le titre reste lisible');
  assert.ok(b.includes('html.lq .home-module-num .home-module-cad{position:absolute;right:-8px;bottom:-8px;'));
  assert.ok(b.includes('html.lq #app .pl-chip-verrou{flex:none;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;'));
  assert.ok(b.includes('html.lq .lz-sr{position:absolute!important;width:1px;height:1px;'));
  /* Touché : non de la tête */
  assert.ok(b.includes('html.lq .pgr-mod>button.is-verrou.lq-non .lq-cad{animation:lqCadNon .5s ease both!important}'));
  assert.ok(b.includes('@keyframes lqCadNon{0%,100%{transform:none}18%{transform:translateX(-5px) rotate(-8deg)}'));
  /* Ouverture : le cadenas tient jusqu’à ce que le repère « Tu es ici » arrive (1,2 s), puis s’efface */
  assert.ok(b.includes('pointer-events:none;opacity:0;animation:lqCadPart 1.6s ease both}'));
  assert.ok(b.includes('.lz-ouvre .lq-cad-anse{transform-box:fill-box;transform-origin:100% 100%;animation:lqCadAnse 1.6s ease both}'));
  assert.ok(b.includes('@keyframes lqCadPart{0%,58%{opacity:1;transform:none;color:#ADA2DA}66%{opacity:1;transform:scale(1.12);color:#E0A100}78%{opacity:1;transform:scale(1.04);color:#E0A100}100%{opacity:0;transform:scale(.5);color:#E0A100}}'));
  assert.ok(css.includes('html.lq #scr-learn #modules .home-module .row.current.lq-arrive .lz-num{animation:lqNodeIn .55s var(--pop) 1.2s both!important}'));
  /* L’accueil repère la leçon qui vient de s’ouvrir (une ou deux : pas de pluie de cadenas quand une progression revient d’un coup) */
  const m = cut('function renderModules(){', '  lqAfterModules(host);');
  assert.ok(m.includes("    const fermees=new Set(allLessons.slice(leconFrontiere()+1).map(l=>String(l.id)));"));
  assert.ok(m.includes("      if(ouvertes.length&&ouvertes.length<=2)ouvertes.forEach(id=>{"));
  assert.ok(m.includes("row.classList.add('lq-ouvre');row.insertAdjacentHTML('beforeend','<i class=\"lz-ouvre\" aria-hidden=\"true\">'+LQ_CADENAS_SVG+'</i>');"));
  assert.ok(m.includes('    lqFermeSnapshot=fermees;'));
  /* Mouvement réduit : la règle générale coupe toute animation ; le cadenas d’ouverture, invisible au repos, ne reste pas posé */
  assert.ok(css.includes('html.lq *,html.lq *::before,html.lq *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}'));
});
