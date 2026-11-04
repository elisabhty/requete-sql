/* 4 novembre, 13 h 48 (Elisa) : « Mettre dans la partie avis d’une leçon : veux-tu laisser un commentaire, en mode lien qu’on clique si
   jamais » ; « ok » pour reprendre l’onboarding là où on s’était arrêté (3), pour savoir où les gens abandonnent (4) et pour passer le
   tutoriel du widget après la première leçon (6, « environ 20 écrans avant la première leçon »). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = read('index.html'), css = read('ludique.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const stockage = () => { const m = new Map(); return {getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m}; };

test('l’avis : « Veux-tu laisser un commentaire ? », un lien qui n’apparaît qu’après la note, un champ de 500 signes', () => {
  const ctx = vm.createContext({esc: s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c])});
  vm.runInContext(cut('const AVIS_COM_MAX=500;', 'function avisCommentOuvrir(btn){'), ctx);
  const sans = ctx.avisCommentaireHtml(12, null);
  assert.ok(sans.includes('class="av-com is-cache"'), 'pas encore noté : caché');
  assert.ok(sans.includes('>Veux-tu laisser un commentaire&nbsp;?</button>') && sans.includes('aria-controls="av-com-12"') && sans.includes('maxlength="500"'));
  assert.ok(sans.includes('placeholder="Ce qui t’a plu, ce qui manque, ce qui n’est pas clair…"') && sans.includes('>0/500</small>') && sans.includes('>Envoyer</button>'));
  const note = ctx.avisCommentaireHtml(12, {n: 4});
  assert.ok(note.startsWith('<div class="av-com">'), 'noté : visible');
  const avec = ctx.avisCommentaireHtml(12, {n: 4, c: 'Un exemple de plus <svp>'});
  assert.ok(avec.includes('class="av-com is-fait"') && avec.includes('<p class="av-com-lu">«&nbsp;Un exemple de plus &lt;svp&gt;&nbsp;»</p>') && avec.includes('>Modifier mon commentaire</button>'));
  assert.ok(avec.indexOf('av-com-lu') < avec.indexOf('av-com-lien'), 'le commentaire se relit, puis se modifie');
  assert.ok(avec.includes('>Un exemple de plus &lt;svp&gt;</textarea>') && avec.includes('>24/500</small>'));
  /* Il apparaît dès la note, et la note gardée garde le commentaire */
  assert.ok(cut('function avisPeindre(box,n,star){', 'function avisEclats(star){').includes("const com=box.querySelector('.av-com.is-cache');\n  if(com)com.classList.remove('is-cache');"));
  assert.ok(app.includes("state.avis[id]=Object.assign({n,le:Date.now(),envoye:false},avant&&typeof avant.c==='string'&&avant.c?{c:avant.c}:{});save();"), 'changer sa note ne perd pas le commentaire');
  assert.ok(app.includes('${avisCommentaireHtml(l.id,a)}\n  </section>`;'));
});

test('envoyer le commentaire : gardé sur l’appareil (espaces resserrés, 500 signes), le merci, puis l’envoi avec la note', () => {
  const envoi = cut('function avisCommentEnvoyer(btn){', '/* Les étoiles jusqu’à la note');
  for (const k of ["const c=String(t.value||'').replace(/\\s+/g,' ').trim().slice(0,AVIS_COM_MAX);", 'if(c)a.c=c;else delete a.c;', 'a.envoye=false;a.le=Date.now();save();',
    '<p class="av-com-merci" role="status">Merci pour ton commentaire&nbsp;! 💜</p>', 'avisEnvoyer();'])
    assert.ok(envoi.includes(k), k);
  const e = cut('function avisEnvoyer(){', "if(typeof window!=='undefined'");
  assert.ok(e.includes("p_commentaire:c||null") && e.includes("(state.avis[id].c||'')===c"), 'parti avec le bon commentaire, ou à renvoyer');
  /* La progression le garde, propre */
  const ctx = vm.createContext({psForme: s => s});
  vm.runInContext(cut('function normalizeState(raw){', '/* Un nombre écrit en texte'), ctx);
  const s = ctx.normalizeState({avis: {12: {n: 4, le: 1, c: '  Très   bien\n merci '}, 7: {n: 3, c: 'x'.repeat(700)}, 8: {n: 2, c: 42}}});
  assert.equal(s.avis[12].c, 'Très bien merci'); assert.equal(s.avis[7].c.length, 500); assert.equal(s.avis[8].c, undefined);
  /* La base : la colonne, la fonction à cinq arguments, la vue des commentaires */
  const sql = read('supabase/migrations/20261104160655_avis_lecon.sql');
  for (const k of ['commentaire text check (commentaire is null or char_length(commentaire) <= 500),', 'p_titre text default null, p_commentaire text default null)',
    "v_commentaire text := nullif(left(btrim(regexp_replace(coalesce(p_commentaire, ''), '[[:cntrl:][:space:]]+', ' ', 'g')), 500), '');",
    'commentaire = excluded.commentaire', 'create or replace view public.avis_commentaires with (security_invoker = true) as', 'revoke all on public.avis_commentaires from public, anon, authenticated;'])
    assert.ok(sql.includes(k), k);
  for (const k of ['html.lq #scr-lesson .bravo-avis .av-com.is-cache{display:none}', 'html.lq #scr-lesson .bravo-avis .av-com.is-ouvert>.av-com-lien{display:none}',
    'html.lq #scr-lesson .bravo-avis .av-com-zone textarea{display:block;width:100%;min-height:92px;', '.av-com-champ,.av-com-merci),html.lq #scr-lesson .bravo-avis{animation:none!important}}'])
    assert.ok(css.includes(k), k);
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=140">'));
});

const repriseLab = ({onboarded = false, apercu = false, legal = null} = {}) => {
  const ls = stockage();
  const ctx = vm.createContext({localStorage: ls, JSON, Date, Array, Object, Number,
    state: {onboarded}, obApercu: apercu, obLegalMode: legal, draft: {name: 'Léa', ageRange: '25-34', paysCherche: true, practiceJust: true},
    OB_SLIDES: ['welcome', 'name', 'pays', 'age', 'widget', 'widgetTuto', 'pseudo', 'ready'], OB_WIDGET_SLIDES: ['widget', 'widgetTuto']});
  vm.runInContext(cut('const OB_REPRISE=', '/* ---------- Où l’onboarding perd du monde') + ';this.OB_REPRISE=OB_REPRISE;', ctx);
  return {ctx, ls};
};

test('l’onboarding repris là où on l’a quitté : l’étape et les réponses gardées 14 jours, sans les états d’animation', () => {
  const {ctx, ls} = repriseLab();
  ctx.obRepriseGarder('age');
  const r = JSON.parse(ls.getItem(ctx.OB_REPRISE));
  assert.equal(r.v, 1); assert.equal(r.slide, 'age');
  assert.deepEqual(r.draft, {name: 'Léa', ageRange: '25-34'}, 'sans paysCherche ni practiceJust');
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.obRepriseLire())), {slide: 'age', draft: {name: 'Léa', ageRange: '25-34'}});
  ctx.obRepriseGarder('pseudo');
  assert.equal(ctx.obRepriseLire().slide, 'ready', 'la mini-page du pseudo : la dernière page');
  ctx.obRepriseGarder('welcome'); assert.equal(ctx.obRepriseLire(), null, 'l’accueil : rien à reprendre');
  ctx.obRepriseGarder('widget'); assert.equal(ctx.obRepriseLire(), null, 'le widget (après la première leçon) : pas une reprise');
  ls.setItem(ctx.OB_REPRISE, JSON.stringify({v: 1, at: Date.now() - 15 * 864e5, slide: 'age', draft: {}}));
  assert.equal(ctx.obRepriseLire(), null, 'plus de 14 jours');
  ls.setItem(ctx.OB_REPRISE, '{abîmé'); assert.equal(ctx.obRepriseLire(), null);
  ctx.obRepriseGarder('age'); ctx.obRepriseOublier(); assert.equal(ls.getItem(ctx.OB_REPRISE), null);
  for (const o of [{onboarded: true}, {apercu: true}, {legal: 'privacy'}]) {
    const x = repriseLab(o); x.ctx.obRepriseGarder('age');
    assert.equal(x.ls.getItem(x.ctx.OB_REPRISE), null, JSON.stringify(o));
  }
  /* Branché : gardé à chaque page, repris à l’ouverture (sans la vidéo, avec un bandeau), oublié à la fin */
  const start = cut('function startOnboarding(initial=', 'let obApercu=false;');
  assert.ok(start.includes("const reprise=obEntry==='welcome'&&!state.onboarded&&!obApercu?obRepriseLire():null;"));
  assert.ok(start.includes("Object.assign(draft,reprise.draft);\n    obStep=OB_SLIDES.indexOf(reprise.slide);") && start.includes("obBandeau('On reprend là où tu en étais.')"));
  assert.ok(app.includes("  obRepriseGarder(slide);\n  if(obJustEntered&&!state.onboarded&&!obLegalMode)obCompter(slide);"));
  assert.ok(cut('function finishOnboard(action){', 'function obTerminer(action){').includes('obRepriseOublier();'));
  assert.ok(cut('function obApercuOuvrir(){', 'function obApercuFermer(').includes("obStep=OB_SLIDES.indexOf('welcome');obEntry='welcome';"), 'l’aperçu repart de l’accueil');
});

test('où l’onboarding perd du monde : chaque étape comptée une fois par appareil, envoyée en lot, gardée hors ligne', async () => {
  const ls = stockage(), envois = [];
  let enLigne = false;
  const ctx = vm.createContext({localStorage: ls, JSON, Promise, Set, Array, String, obApercu: false, setTimeout: () => 0, clearTimeout: () => {},
    clsCle: () => 'K'.repeat(32), clsRpc: (fn, body) => { envois.push([fn, JSON.parse(JSON.stringify(body))]); return enLigne ? Promise.resolve({ok: true}) : Promise.reject(new Error('hors ligne')); }});
  vm.runInContext(cut('const OB_COMPTE=', "if(typeof window!=='undefined'&&typeof window.addEventListener==='function'){\n  window.addEventListener('load',()=>setTimeout(()=>{try{obCompteEnvoyer();}") + ';this.OB_COMPTE=OB_COMPTE;', ctx);
  for (const e of ['welcome', 'name', 'name', 'pays', 'x y', '']) ctx.obCompter(e);
  assert.deepEqual(JSON.parse(ls.getItem(ctx.OB_COMPTE)), {vues: ['welcome', 'name', 'pays'], parties: []}, 'une fois chacune, et rien d’autre');
  assert.equal(await ctx.obCompteEnvoyer(), false);
  assert.deepEqual(envois[0], ['onboarding_compter', {p_cle: 'K'.repeat(32), p_etapes: ['welcome', 'name', 'pays']}]);
  enLigne = true;
  assert.equal(await ctx.obCompteEnvoyer(), true);
  assert.deepEqual(JSON.parse(ls.getItem(ctx.OB_COMPTE)).parties, ['welcome', 'name', 'pays']);
  ctx.obCompter('age');
  await ctx.obCompteEnvoyer();
  assert.deepEqual(envois.at(-1)[1].p_etapes, ['age'], 'seulement les nouvelles');
  assert.equal(await ctx.obCompteEnvoyer(), false, 'rien à envoyer');
  ctx.obApercu = true; ctx.obCompter('job');
  assert.ok(!JSON.parse(ls.getItem(ctx.OB_COMPTE)).vues.includes('job'), 'pas l’aperçu');
  assert.ok(cut('function finishOnboard(action){', 'function obTerminer(action){').includes("if(!state.onboarded){obCompter('termine');"), 'la fin compte aussi');
  /* La base : une ligne par appareil et par étape, la fonction seule pour écrire, l’entonnoir dans l’ordre du parcours */
  const sql = read('supabase/migrations/20261104160656_onboarding_entonnoir.sql');
  for (const k of ['primary key (cle, etape)', "etape text not null check (etape ~ '^[a-zA-Z]{2,16}$')", 'revoke all on public.onboarding_etape from public, anon, authenticated;',
    'create or replace function public.onboarding_compter(p_cle text, p_etapes text[])', 'security definer', 'v_cle text := public.jeu_cle(p_cle);',
    'on conflict (cle, etape) do nothing;', 'grant execute on function public.onboarding_compter(text, text[]) to anon, authenticated;',
    'create or replace view public.onboarding_entonnoir with (security_invoker = true) as', "('pays', 3, 'Pays')", "('termine', 19, 'Onboarding terminé')",
    'revoke all on public.onboarding_entonnoir from public, anon, authenticated;'])
    assert.ok(sql.includes(k), k);
  /* La confidentialité le dit (la page de l’onboarding et la feuille de secours) */
  assert.equal(app.split('chaque <b>étape du parcours de bienvenue</b> que tu vois est comptée une fois, avec ce même identifiant&nbsp;: ni ton nom, ni tes réponses.').length, 3);
  assert.equal(app.split('Tes <b>avis sur les leçons</b> (la note, et le commentaire si tu en laisses un)').length, 3);
});

test('le widget après la première leçon : une fois, de retour à l’accueil, dans l’app iPhone ; il rend ensuite la main', () => {
  assert.ok(app.includes("const OB_FIN_SLIDES=['source','rappel'];") && app.includes("const OB_WIDGET_SLIDES=['widget','widgetTuto'];"));
  const flux = cut('function obFinFlux(){', 'function obFinSuivante(');
  assert.ok(!flux.includes("'widget'") && !flux.includes('obWidgetPossible'), 'plus dans le tunnel');
  const lab = ({onboarded = true, natif = true, vu = false, fait = true, enLecon = false, ouvert = false} = {}) => {
    const ls = stockage(); if (vu) ls.setItem('requete-widget-propose', '1');
    const ctx = vm.createContext({localStorage: ls, state: {onboarded}, allLessons: [{id: 1}, {id: 2}], lecCompletee: id => fait && id === 2,
      obWidgetPossible: () => natif, ouverts: [], activeTab: 'learn', setTimeout: f => { f(); return 1; }, clearTimeout: () => {},
      document: {body: {classList: {contains: c => c === 'in-lesson' && enLecon}}, getElementById: id => id === 'onboarding' ? {classList: {contains: () => ouvert}} : null, querySelector: () => null}});
    ctx.startOnboarding = s => ctx.ouverts.push(s);
    vm.runInContext(cut("const OB_WIDGET_VU='requete-widget-propose';", 'function obWidgetFin(){'), ctx);
    return {ctx, ls};
  };
  const ok = lab();
  assert.equal(ok.ctx.obWidgetProposer(), true); assert.deepEqual([...ok.ctx.ouverts], ['widget']);
  assert.equal(ok.ls.getItem('requete-widget-propose'), '1');
  assert.equal(ok.ctx.obWidgetProposer(), false, 'une seule fois');
  for (const o of [{fait: false}, {natif: false}, {vu: true}, {onboarded: false}, {enLecon: true}, {ouvert: true}]) assert.equal(lab(o).ctx.obWidgetProposer(), false, JSON.stringify(o));
  /* Le retour à l’accueil le propose ; ses deux boutons rendent la main */
  assert.ok(app.includes("  activeTab=name;\n  syncTabBack(name);\n  if(name==='learn'&&typeof obWidgetBientot==='function')obWidgetBientot();"));
  assert.ok(app.includes("obSetFooter('Continuer',()=>obGoto('widgetTuto'),'Pas maintenant',obWidgetFin,'');") && app.includes("obSetFooter('C’est fait\\u00a0!',obWidgetFin,'','','');"));
  const fin = cut('function obWidgetFin(){', '\n}\n');
  assert.ok(fin.includes("localStorage.setItem(OB_WIDGET_VU,'1')") && fin.includes('closeOnboardingAuth();'));
  assert.ok(app.includes("  else if(slide==='widget')obGoto('widgetTuto');\n  else if(slide==='widgetTuto')obWidgetFin();"), 'Suivant, au balayage');
});
