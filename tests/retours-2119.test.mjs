/* 5 novembre, 21 h 19 (Elisa, capture de la page de l’engagement, validée) : « C’est noté : ton engagement est pris en compte » ;
   « « Ton engagement » → « Un engagement envers toi-même » : plus personnel et valorisant. « Chaque minute compte pour atteindre ton
   objectif » → « 10 minutes (paramétrable par rapport à ce qu’a sélectionné la personne) par jour peuvent faire toute la différence » :
   plus concret. « Mon engagement personnel » → « Mon engagement » : plus simple. « Continuer » → « C’est parti ! » : plus dynamique pour
   terminer l’onboarding. Une dernière idée : permettre à l’utilisateur de retrouver son engagement dans « Mon compte », sous
   « Parcours et rythme ». »
   - La page : les nouveaux textes ; la phrase suit les minutes et les jours choisis.
   - Le tour fait, la page ne part plus toute seule : la phrase reste à lire, « C’est parti ! » mène à la suite (retours-1941).
   - Mon compte › Mon engagement, sous « Parcours et rythme » : le même certificat, daté du jour où il a été pris ; pas encore pris
     (« Plus tard »), le bouton à l’empreinte le prend ici.
   - Refaire l’onboarding garde l’engagement déjà pris. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = read('index.html');
const lq = read('ludique.css');
const ov = read('onboarding-vitrine.css');
const sw = read('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const lastCut = (a, b) => { const i = app.lastIndexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

/* Les fonctions de l’engagement (le certificat, le bouton, Mon compte), dans un bac à sable */
const LE_5 = new Date(2026, 10, 5, 21, 19).getTime();
const bac = ({ pacte = null, plan = { rythme: 'calme', freq: 7 }, nom = 'Elisa', genre = 'f' } = {}) => {
  const elts = {}, classes = sel => (elts[sel] ||= { cls: new Set(), classList: { add: c => elts[sel].cls.add(c) } });
  const ctx = vm.createContext({
    state: { name: nom, plan, profile: pacte ? { genre, pacte } : { genre } },
    draft: {}, saves: 0,
    esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'),
    document: { getElementById: id => elts['#' + id] || null, querySelector: s => classes(s) },
    performance: { now: () => 0 }, window: {},
  });
  ctx.save = () => { ctx.saves++; };
  vm.runInContext(cut('function genreDe(){', '\n/*').trim() + '\n' + cut('function accord(f,h,n){', '\n'), ctx);
  vm.runInContext(cut('const RYTHMES=[', 'const FREQS=') + cut('function obRythmeMinutes(rythme){', '\n}\n') + '\n}\n', ctx);
  vm.runInContext(cut('const OB_TENIR=1500;', '/* « Pour l’onboarding, il faut que tout tienne sur une page'), ctx);
  return { ctx, elts, run: s => vm.runInContext(s, ctx) };
};

test('la page : « Un engagement envers toi-même », la phrase aux minutes et aux jours choisis, « Mon engagement »', () => {
  const p = lastCut("}else if(slide==='pact'){", "  }else{\n    const p=apercuPlan(");
  assert.ok(p.includes('<h1 class="ob-title" id="ob-title">Un <em>engagement</em> envers <span class="ob-nw">toi-même</span>.</h1>'));
  assert.ok(p.includes('<p class="ob-lead">${pacteLead(b.minutes,f)}</p>') && p.includes('const b=obPlanInfo(),f=draft.freq||7;'));
  assert.ok(!app.includes('Chaque minute compte pour atteindre ton objectif.</p>') && !app.includes('Ton <em>engagement</em>.</h1>'), 'les anciens textes');
  const { run } = bac();
  assert.equal(run('pacteLead(10,7)'), '10 minutes par jour peuvent faire toute la différence.');
  assert.equal(run('pacteLead(20,5)'), '20 minutes par jour en semaine peuvent faire toute la différence.');
  assert.equal(run('pacteLead(30,3)'), '30 minutes, 3 jours par semaine, peuvent faire toute la différence.');
  /* Le certificat */
  const carte = run(`pacteCarteHTML({nom:'Elisa',m:10,f:7,ts:${LE_5},signe:false})`);
  assert.ok(carte.includes('<p class="ob-pact-k">Mon engagement</p>') && !app.includes('Mon engagement personnel</p>'));
  assert.ok(carte.includes('Moi, <b>Elisa</b>, je m’engage à consacrer <b>10 minutes par jour</b> à mon apprentissage.'));
  assert.ok(carte.includes('j’avance chaque jour vers mon objectif.') && carte.includes('<p class="ob-pact-date">Le 5 novembre 2026</p>'));
  assert.ok(carte.startsWith('<div class="ob-pact-card">') && run(`pacteCarteHTML({nom:'',m:20,f:3,signe:true})`).startsWith('<div class="ob-pact-card is-signed">'));
  assert.ok(run(`pacteCarteHTML({nom:'',m:20,f:3})`).includes('Moi, <b>future pro du SQL</b>, je m’engage à consacrer <b>20 minutes</b>, <b>3 jours par semaine</b>, à mon apprentissage.'));
  assert.ok(run(`pacteCarteHTML({nom:'',m:20,f:3})`).includes('j’avance à chaque séance vers mon objectif.'));
  assert.equal(run(`pacteDate(new Date(2026,10,1).getTime())`), 'Le 1er novembre 2026');
});

test('pris : « C’est noté : ton engagement est pris en compte. », puis « C’est parti ! » (plus de départ automatique)', () => {
  const { run } = bac();
  assert.equal(run('PACTE_PRIS'), 'C’est noté&nbsp;: ton engagement est pris en compte.');
  assert.equal(run('PACTE_GO'), 'C’est parti !');
  const avant = run("holdZoneHTML('ob-hold',false)"), apres = run("holdZoneHTML('ob-hold',true)");
  assert.ok(avant.includes('id="ob-hold-hint" aria-live="polite">Maintiens ton doigt sur le bouton pour t’engager</p>') && avant.includes('class="ob-hold" id="ob-hold"'));
  assert.ok(apres.includes('aria-live="polite">C’est noté&nbsp;: ton engagement est pris en compte.</p>') && apres.includes('class="ob-hold is-done" id="ob-hold"') && apres.includes('aria-label="Engagement pris"'));
  const p = lastCut("}else if(slide==='pact'){", "  }else{\n    const p=apercuPlan(");
  assert.ok(p.includes("    if(draft.pacte)obSetFooter(PACTE_GO,()=>obGoto('practice'),'','','');\n    else obSetFooter('',null,'Plus tard',()=>obGoto('practice'),'');"));
  const init = cut('function obHoldInit(){', '\n}\n');
  assert.ok(init.includes("obSetFooter(PACTE_GO,()=>obGoto('practice'),'','','');") && init.includes('obCtaWake(n)') && !init.includes('setTimeout'), 'la page reste, le bouton du bas se réveille');
  assert.ok(!app.includes(':prefersReduceMotion()?500:1100'), 'l’ancien départ automatique');
  assert.ok(!app.includes('C’est noté&nbsp;: ton engagement est pris.\''), 'l’ancienne phrase');
  /* Le pied : « Plus tard » s’efface le temps que « C’est parti ! » arrive (19 h 41) */
  assert.ok(ov.includes('html #onboarding.ob-vitrine:has(.ob-hold.is-done) .ob-skip{opacity:0;pointer-events:none;transition:opacity .2s ease}'));
});

test('tout tient sur un écran : « toi-même » d’un bloc, la phrase équilibrée, le bouton resserré au plus petit écran', () => {
  assert.ok(ov.includes('html #onboarding.ob-vitrine .ob-nw{white-space:nowrap}'));
  assert.ok(ov.includes('html #onboarding.ob-vitrine .ob-pact .ob-lead{text-wrap:balance}'));
  assert.ok(ov.includes('html #onboarding.ob-vitrine.ob-fit-5 .ob-pact .ob-hold{width:64px;height:64px;margin:6px 0 4px}'));
  assert.ok(ov.includes('html #onboarding.ob-vitrine.ob-fit-5 .ob-pact .ob-hold-zone{gap:6px;margin-top:8px}'));
  /* Les règles du palier 5 viennent après celles du palier 4, qu’elles remplacent */
  assert.ok(ov.indexOf('html #onboarding.ob-vitrine.ob-fit-5 .ob-pact .ob-hold{') > ov.indexOf('html #onboarding.ob-vitrine.ob-fit-4 .ob-pact .ob-hold{'));
  assert.ok(ov.indexOf('html #onboarding.ob-vitrine.ob-fit-5 .ob-pact .ob-pact-txt{') > ov.indexOf('html #onboarding.ob-vitrine.ob-fit-4 .ob-pact .ob-pact-txt{'));
});

test('refaire l’onboarding garde l’engagement pris (finishOnboard réécrit le profil)', () => {
  const s = lastCut('function startOnboarding(', '\n  };\n');
  const ligne = "...(profile.pacte&&Number.isFinite(profile.pacte.at)?{pacte:profile.pacte.sig||'empreinte',pacteAt:profile.pacte.at}:{}),";
  assert.ok(s.includes(ligne));
  const draft = profile => vm.runInNewContext(`({${ligne}})`, { profile });
  assert.deepEqual(JSON.parse(JSON.stringify(draft({ pacte: { at: LE_5, sig: 'empreinte' } }))), { pacte: 'empreinte', pacteAt: LE_5 });
  assert.deepEqual(JSON.parse(JSON.stringify(draft({ pacte: { at: LE_5 } }))), { pacte: 'empreinte', pacteAt: LE_5 });
  assert.deepEqual(JSON.parse(JSON.stringify(draft({}))), {});
  assert.deepEqual(JSON.parse(JSON.stringify(draft({ pacte: 'ancien' }))), {}, 'une chaîne (son .at est une méthode) ne compte pas');
  assert.ok(app.includes("...(draft.pacte?{pacte:{at:draft.pacteAt||Date.now(),sig:draft.pacte}}:{})"), 'et finishOnboard le réécrit tel quel');
});

test('Mon compte › Mon engagement : la ligne sous « Parcours et rythme », la feuille, le certificat au rythme du parcours', () => {
  const r = cut('function renderCompte(){', '\nfunction ');
  const parcours = r.indexOf('<b>Parcours et rythme</b>'), ligne = r.indexOf("onclick=\"openPlusDetails('plus-pacte')\""), rappel = r.indexOf('<b>Rappel de séance</b>');
  /* 13 novembre, 15 h 17 : « rappel de séance en bas de parcours et rythme » : Parcours et rythme, Rappel de séance, Mon engagement */
  assert.ok(parcours > 0 && rappel > parcours && ligne > rappel, 'sous « Rappel de séance », lui-même sous « Parcours et rythme »');
  assert.ok(r.includes(`<span class="plus-row-icon is-stk">\${lqStkSvg('pen')}</span><span><b>Mon engagement</b><small id="acct-pacte-sum">\${pacteResume()}</small></span>`));
  assert.ok(r.includes('<details class="plus-details" id="plus-pacte">\n      <summary><span>Un engagement envers <span class="pc-nw">toi-même</span></span><small>${pacteLead(pacteRythme().m,pacteRythme().f)}</small><i aria-hidden="true">×</i></summary>\n      <div class="plus-details-body pc-body">${pacteFeuilleHTML()}</div>\n    </details>'));
  assert.ok(r.includes("  stkPaint(host.querySelector('.acct-badges'));\n  pacteFeuilleBrancher();"), 'le bouton branché à chaque rendu (la feuille peut rester ouverte)');
  /* La ligne */
  let x = bac({ pacte: { at: LE_5, sig: 'empreinte' } });
  assert.equal(x.run('pacteResume()'), 'Pris le 5 novembre · 10 min par jour');
  x = bac({ pacte: { at: LE_5, sig: 'empreinte' }, plan: { rythme: 'regulier', freq: 5 } });
  assert.equal(x.run('pacteResume()'), 'Pris le 5 novembre · 20 min par jour en semaine');
  x = bac({ pacte: { at: new Date(2026, 11, 1).getTime() }, plan: { rythme: 'intensif', freq: 3 } });
  assert.equal(x.run('pacteResume()'), 'Pris le 1er décembre · 30 min, 3 jours par semaine');
  assert.equal(bac().run('pacteResume()'), 'Pas encore pris');
  assert.equal(bac({ pacte: 'ancien' }).run('pacteResume()'), 'Pas encore pris', 'une chaîne (son .at est une méthode) ne compte pas');
  assert.equal(bac({ pacte: { sig: 'empreinte' } }).run('pacteResume()'), 'Pas encore pris', 'un engagement sans date');
  /* La feuille : le certificat tamponné et la phrase, sans rejouer la coche ; pas encore pris, le bouton */
  x = bac({ pacte: { at: LE_5, sig: 'empreinte' } });
  const pris = x.run('pacteFeuilleHTML()');
  assert.ok(pris.startsWith('<div class="pc-pacte is-pris is-deja">') && pris.includes('<div class="ob-pact-card is-signed">'));
  assert.ok(pris.includes('Moi, <b>Elisa</b>, je m’engage à consacrer <b>10 minutes par jour</b>') && pris.includes('Le 5 novembre 2026'));
  assert.ok(pris.includes('id="pc-hold-hint" aria-live="polite">C’est noté&nbsp;: ton engagement est pris en compte.</p>') && pris.includes('class="ob-hold is-done" id="pc-hold"'));
  const vide = bac().run('pacteFeuilleHTML()');
  assert.ok(vide.startsWith('<div class="pc-pacte">') && vide.includes('<div class="ob-pact-card">') && vide.includes('Maintiens ton doigt sur le bouton pour t’engager') && vide.includes('class="ob-hold" id="pc-hold"'));
});

test('pas encore pris : le doigt maintenu dans la feuille le prend, la ligne et le certificat suivent', () => {
  const x = bac();
  const appels = [];
  x.ctx.holdBrancher = (b, hint, o) => appels.push({ b, hint, o });
  x.elts['#pc-hold'] = { id: 'pc-hold' }; x.elts['#pc-hold-hint'] = { id: 'pc-hold-hint' }; x.elts['#acct-pacte-sum'] = { textContent: 'Pas encore pris' };
  x.run('pacteFeuilleBrancher()');
  assert.equal(appels.length, 1);
  assert.equal(appels[0].b.id, 'pc-hold'); assert.equal(appels[0].hint.id, 'pc-hold-hint');
  assert.equal(appels[0].o.suite, undefined, 'déjà pris, le bouton ne mène nulle part');
  const t0 = Date.now();
  appels[0].o.fini();
  const p = x.ctx.state.profile.pacte;
  assert.equal(p.sig, 'empreinte'); assert.ok(p.at >= t0 && p.at <= Date.now());
  assert.equal(x.ctx.saves, 1, 'enregistré');
  assert.ok(x.elts['#plus-pacte .ob-pact-card'].cls.has('is-signed') && x.elts['#plus-pacte .pc-pacte'].cls.has('is-pris'), 'le tampon se pose');
  assert.ok(!x.elts['#plus-pacte .pc-pacte'].cls.has('is-deja'), 'la coche se trace (son rebond, cette fois)');
  assert.match(x.elts['#acct-pacte-sum'].textContent, /^Pris le \d{1,2}(er)? [a-zéû]+ · 10 min par jour$/);
  /* Le bouton à l’empreinte est le même qu’à l’onboarding : holdBrancher, branché une seule fois par bouton */
  const h = cut('function holdBrancher(b,hint,o){', '\n}\n');
  assert.ok(h.includes('if(!b||b.dataset.pret)return;b.dataset.pret=\'1\';o=o||{};') && h.includes('if(o.fini)o.fini();') && h.includes('if(performance.now()-finiA>1500&&o.suite)o.suite();'));
});

test('la feuille : la DA de la vitrine, le bouton qui ne fait pas défiler, tout tient sur les petits iPhone', () => {
  const i = lq.indexOf('/* ---------- Retours du 5 novembre, 21 h 19 ----------');
  assert.ok(i > 0);
  const c = lq.slice(i);
  assert.ok(c.includes('linear-gradient(170deg,#6E50F6 0%,#5538E6 48%,#4529CC 100%)'), 'le violet de la vitrine');
  assert.match(c, /html\.lq #plus-pacte \.ob-hold\{[^}]*touch-action:none;/);
  assert.ok(c.includes('html.lq #plus-pacte .pc-nw{white-space:nowrap}'));
  assert.ok(c.includes('html.lq #plus-pacte .pc-pacte.is-deja .ob-hold{display:none}'), 'déjà pris : la phrase, sans le bouton');
  assert.ok(c.includes('@media (max-height:760px){') && c.includes('@media (max-height:600px){'));
  assert.ok(c.includes("html.lq #plus-pacte>summary>small{display:none!important}"));
  /* Les animations, seulement si le mouvement n’est pas réduit, et pas pour la coche déjà là */
  const m = c.indexOf('@media (prefers-reduced-motion:no-preference){');
  assert.ok(m > 0 && !/animation:obv/.test(c.slice(0, m)));
  assert.ok(c.slice(m).includes('#plus-pacte .pc-pacte:not(.is-deja) .ob-hold.is-done{animation:obvHoldOk .5s var(--v-pop)}'));
  assert.ok(ov.includes('@keyframes obvHoldOk{') && ov.includes('@keyframes obvHoldHalo{'), 'les mêmes mouvements que l’onboarding');
  /* Les feuilles et le cache rafraîchis */
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=374">') && app.includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=68">'));
  assert.ok(sw.includes("'./onboarding-vitrine.css?v=68'") && sw.includes("const CACHE = 'requete-2026-11-14-pages-v3003';"));
});
