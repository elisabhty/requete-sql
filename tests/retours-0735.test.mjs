/* Elisa, 6 novembre, 7 h 35 (capture de la carte « Prêt pour la suite, Ikk ? ») : « Je veux qu’un agent expert UI/UX m’aide pour
   améliorer le design UI/UX et vérifie si les calculs sont ok ». L’audit (Chromium, 15 scénarios) : chaque chiffre suit sa règle ;
   les erreurs objectives, corrigées ici, sans rien changer à l’allure de la carte :
   1. « Texte plus grand » écrasait le grand « 0 % » (46 → 17 px) ;
   3. l’étiquette « ⌛ 12 min » compte la plus ancienne séance en retard, et VoiceOver disait autre chose (tout le retard) ;
   4. VoiceOver ne lisait ni l’étiquette (un aria-label sur un <span>), ni le niveau (un role="img" dans un bouton nommé), et lisait
      « 0 % » sans dire de quoi ;
   6. la place de l’étiquette se mesurait pendant que son compteur affichait « 0 » ;
   7. pendant « Refaire mon planning », le niveau du compte retombait à 1.
   Le reste (le contraste de l’étiquette, le bonjour sur deux lignes, la définition du %, les minutes forfaitaires) est dans les
   pistes de design proposées à Elisa. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), lq = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = nom => cut(`function ${nom}(`, '\n}\n') + '\n}\n';
const ligne = nom => cut(`function ${nom}(`, '\n') + '\n';

test('1 — « Texte plus grand » : la carte grandit d’un cran sans casser ses titres', () => {
  /* Le grand « 0 % » a laissé la place à la carte « La leçon d’abord » (8 h 49) : la règle générale redevient celle d’avant (avec
     « :not(.lq-parc-n) », elle passait devant les règles de la carte), et la carte a ses propres tailles */
  assert.ok(app.includes('html[data-reading="large"] .screen p:not(.eyebrow),html[data-reading="large"] .screen .sub,html[data-reading="large"] .screen .tip{font-size:17px;line-height:1.75}'));
  assert.ok(!app.includes('lq-parc-n') && !lq.includes('lq-parc-n'), 'plus de grand pourcentage');
  for (const k of ['html.lq[data-reading="large"] .lq-hero.is-lecon .lq-a-meta{font-size:15px;line-height:1.35}', 'html.lq[data-reading="large"] .lq-hero.has-hi p.lq-hi-title{line-height:1.2}',
    'html.lq[data-reading="large"] .lq-hero.is-lecon .lq-cta-t small{font-size:15px!important}', 'html.lq .lq-hero.has-hi .lq-hi-title{font-size:var(--hi-fs,20px)}'])
    assert.ok(lq.includes(k), k);
});

function seances(sessions, done = []) {
  const ctx = vm.createContext({ state: { plan: sessions ? { sessions } : null }, itemDone: id => done.includes(id) });
  vm.runInContext(ligne('jour0') + ligne('auj') + ligne('dstr') + ligne('parseD') + fn('seanceLue'), ctx);
  const jour = n => vm.runInContext(`(()=>{const x=parseD(dstr(auj()));x.setDate(x.getDate()+(${n}));return dstr(x);})()`, ctx);
  return { lu: (s, e) => vm.runInContext('seanceLue', ctx)(s, e), jour, ctx };
}

test('3 et 4 — l’étiquette de la séance se lit, et dit ce que l’écran montre (la séance du bouton, puis tout le retard)', () => {
  const s0 = seances([]);
  const hier = s0.jour(-1), avant = s0.jour(-3), auj = s0.jour(0);
  const { lu } = seances([{ d: avant, lessons: [1, 2] }, { d: s0.jour(-2), lessons: [3, 4] }, { d: hier, lessons: [5, 6] }, { d: auj, lessons: [7, 8] }]);
  /* Le même résumé que le bilan et le planning (session.summary : resteJour), avec les minutes de l’écran */
  const vieille = { d: avant, lessons: [1, 2], remaining: [1, 2], minutes: 12, summary: '6 activités à rattraper' };
  assert.match(lu(vieille, 'late'), /^Séance du [a-zé]+ \d{1,2}(er)? [a-zéû]+ à reprendre\u00a0: 2 activités, environ 12 minutes\. En tout, 6 activités à rattraper\.$/);
  const { lu: lu2 } = seances([{ d: hier, lessons: [5, 6] }, { d: auj, lessons: [7] }]);
  assert.equal(lu2({ d: hier, lessons: [5, 6], remaining: [5, 6], minutes: 12, summary: '2 activités à rattraper' }, 'late'), 'Séance d’hier à reprendre\u00a0: 2 activités à rattraper, environ 12 minutes.', 'rien d’autre en retard : pas de total');
  assert.equal(lu2({ d: auj, lessons: [7, 8], remaining: [8], minutes: 6, summary: '1 activité restante aujourd’hui' }, 'run'), '1 activité restante aujourd’hui, environ 6 minutes.');
  assert.equal(lu2({ d: auj, lessons: [7], remaining: [7], minutes: 6, summary: '1 activité restante · environ 6 min' }, 'run'), '1 activité restante · environ 6 min.', 'sans planning : les minutes une seule fois');
  assert.equal(lu2(null, 'end'), 'Toutes tes activités sont validées.');
  assert.equal(lu2({ d: s0.jour(1), lessons: [9], remaining: [9], minutes: 6, summary: '1 activité prévue demain' }, 'done'), 'Ta séance du jour est faite. 1 activité prévue demain.');
  assert.equal(lu2({ d: s0.jour(1), lessons: [9], remaining: [9], minutes: 6, summary: '1 activité prévue demain' }, 'pause'), 'Pas de séance prévue aujourd’hui. 1 activité prévue demain.');
  const h = fn('renderHomeHero');
  assert.ok(h.includes('<span class="lq-ses is-${sesEtat}"><span class="lq-sr">${esc(seanceLue(session,sesEtat))}</span><i class="lq-ses-ic" aria-hidden="true">'), 'un texte masqué, lu par VoiceOver');
  assert.ok(!h.includes('aria-label="${escAttr(session?.summary'), 'plus d’aria-label sur un simple <span>');
  /* Depuis 8 h 49, plus de « 0 % » : la barre de la leçon se lit (« Vidéo : 1:15 sur 2:50 », « Chrono : 05:48 sur 20:00 ») */
  assert.ok(h.includes('<span class="lq-sr">Vidéo : </span><span>${lvFmt(pos)} sur ${lvFmt(v)}</span>') && h.includes('<span class="lq-sr">Chrono : </span><span>${jeuChrono(pris)} sur ${jeuChrono(JEU_ROUND_MS)}</span>'), 'la barre de la leçon pour VoiceOver');
});

test('4 — le niveau se lit avec la mascotte, et reste à jour quand l’autocollant est gardé d’un rendu à l’autre', () => {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const ctx = vm.createContext({ esc, escAttr: s => esc(s).replace(/"/g, '&quot;') });
  vm.runInContext(cut('const MASCOT_IMG=', 'function mascotReduced(){'), ctx);
  const h = vm.runInContext("mascotMedalHtml({kw:'SELECT',niv:{rank:2,label:'Constructeur de requêtes'},hi:'Ravi de te revoir !'})", ctx);
  assert.ok(h.includes('aria-label="Niveau 2 : Constructeur de requêtes. La mascotte Requête te fait coucou">'));
  assert.ok(h.includes('<span class="mstk-niv" aria-hidden="true"><i><span>Niv.</span>2</i><b>Constructeur de requêtes</b></span>') && !h.includes('role="img"'));
  assert.ok(vm.runInContext('mascotMedalHtml()', ctx).includes('aria-label="La mascotte Requête te fait coucou">'), 'sans niveau, comme avant');
  assert.ok(fn('lqKeepMascot').includes("{const l=fresh.getAttribute('aria-label');if(l!=null&&old.getAttribute('aria-label')!==l)old.setAttribute('aria-label',l);}"));
});

test('6 — l’étiquette se mesure avec son vrai nombre, puis quand les polices sont arrivées', () => {
  const h = fn('renderHomeHero');
  assert.equal((h.match(/lqSesAjuste\(host\);   \/\/ mesuré avec le vrai nombre, avant que le compteur parte de 0 \(audit du 6 novembre, bug 6\)\n\s+lqSesCount\(host\);/g) || []).length, 2, 'les deux rendus');
  assert.ok(!/lqSesCount\(host\);\n\s+(lqPctAnime\(host\);\n\s+)?lqSesAjuste\(host\);/.test(h));
  assert.ok(app.includes("try{if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>lqSesAjuste(document.getElementById('home-hero')));}catch(e){}"));
});

test('7 — le niveau choisi reste pendant « Refaire mon planning » (gardé dans le profil) ; depuis le 6 novembre, 12 h 28, il donne le niveau de défi conseillé', () => {
  assert.ok(fn('jeuNivAuto').includes("let choisi='';try{choisi=(state.plan&&state.plan.niveau)||(state.profile&&state.profile.niveau)||'';}catch(e){}"));
  assert.ok(fn('refairePlan').includes('if(p&&p.niveau)state.profile=Object.assign({},state.profile||{},{niveau:p.niveau});'));
  assert.ok(fn('validerPlan').includes('state.profile=Object.assign({},state.profile||{},{niveau:draft.niveau});'));
  /* La dernière définition de finishOnboard est celle qui sert (la première est remplacée). */
  const fo = app.slice(app.lastIndexOf('function finishOnboard('), app.indexOf('\n}\n', app.lastIndexOf('function finishOnboard(')));
  assert.ok(fo.includes("referral:draft.source==='referral'?(draft.referral||''):'',\n    niveau:draft.niveau,"));
  /* Sur une vraie base de leçons : « J’ai quelques bases » sans planning : le niveau 1, comme tout le monde (« tout le monde commence
     au même endroit »), et les défis conseillés en Moyen */
  const ctx = vm.createContext({ state: { plan: null, profile: { niveau: 'bases' }, lessons: {} }, isDefiId: () => false });
  vm.runInContext(cut('const NIVEAUX=[', '\nconst RYTHMES=') + '\n' + cut('const ACCOUNT_LEVELS=[', 'function lvlBadgeHTML(') + ligne('itemDone') + fn('jeuNivAuto')
    + 'const allLessons=Array.from({length:71},(_,i)=>({id:i}));const MODULES=[{titre:"Jointures",lessons:[{id:30}]}];', ctx);
  assert.equal(vm.runInContext('niveauCompte().rank', ctx), 1);
  assert.equal(vm.runInContext('jeuNivAuto()', ctx), 'm');
  vm.runInContext('state.profile={}', ctx);
  assert.equal(vm.runInContext('jeuNivAuto()', ctx), 'f', 'sans rien : Facile, comme avant');
});
