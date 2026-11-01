/* Elisa, 31 octobre, 18 h 22 et 18 h 28 :
   « ne pas pouvoir mettre de majuscules, tout sera en minuscules avec un @ au début + faire attention aux espaces + il y a des gros
     traits blancs ; supprimer “unique dans l’appli” et le texte en bas » (la mini-page du pseudo) ;
   « voir le pseudo en bas du prénom dans Mon compte » ; « réf. 1 : pourquoi “manches trouvées” ? » (la tuile Défis). */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const helpers = cut('function jeuNom(v)', '/* Le pseudo des salles et du classement');

test('le pseudo en identifiant : @, minuscules, sans espace, 15 caractères au plus', () => {
  const ctx = vm.createContext({});
  vm.runInContext(helpers, ctx);
  const f = v => vm.runInContext(`psForme(${JSON.stringify(v)})`, ctx);
  assert.equal(f('  Élisa Blanchart!! '), '@élisablanchart', 'minuscules, accents gardés, sans espace ni ponctuation');
  assert.equal(f('@@Léa.DB'), '@léa.db', 'un seul @, devant');
  assert.equal(f('Léa_SQL-1'), '@léa_sql-1', 'point, tiret bas et tiret gardés');
  assert.equal(f('lea sql'), '@leasql', 'pas d’espace');
  assert.equal(f('😀 '), '', 'rien de lisible : pas de pseudo');
  assert.equal(f('ABCDEFGHIJKLMNOPQRSTU'), '@abcdefghijklmno', '15 caractères après le @');
  assert.equal(vm.runInContext("psHandle('@Léa Sql')", ctx), 'léasql', 'le champ, lui, n’a pas le @ (il est posé devant)');
  /* La saisie : chaque frappe repasse en minuscules, sans espace */
  const got = [];
  const tape = vm.createContext({ prefersReduceMotion: () => false, obInput: (c, v) => got.push([c, v]) });
  vm.runInContext(helpers + cut('function obPseudoTape(el){', 'function obInput('), tape);
  const cls = new Set(), el = { value: 'Léa SQL', offsetWidth: 0, classList: { add: c => cls.add(c), remove: c => cls.delete(c) } };
  tape.el = el; vm.runInContext('obPseudoTape(el)', tape);
  assert.equal(el.value, 'léasql'); assert.ok(cls.has('is-pick'), 'le champ pulse quand il corrige');
  assert.deepEqual(got, [['pseudo', 'léasql']]);
  assert.ok(app.includes("if(champ==='pseudo'){draft.pseudo=psForme(val);"), 'le brouillon garde le @');
  /* L’initiale d’un pseudo : la lettre après le @ */
  const ini = vm.createContext({ esc: s => s });
  vm.runInContext(cut('function jeuInitial(name){', '\n'), ini);
  assert.equal(vm.runInContext("jeuInitial('@elisa')", ini), 'E'); assert.equal(vm.runInContext("jeuInitial('Tom')", ini), 'T');
  /* La progression : un pseudo d’avant passe sous sa forme d’identifiant */
  const ns = vm.createContext({});
  vm.runInContext(helpers + cut('function normalizeState(raw){', 'function normalize('), ns);
  assert.equal(vm.runInContext("normalizeState({salle:{pseudo:'Elisa',pseudoVu:5}}).salle.pseudo", ns), '@elisa');
});

test('la mini-page : le @ dans le champ, sans « unique dans l’appli » ni texte en bas ; plus de bandes claires autour', () => {
  const page = cut("}else if(slide==='pseudo'){", "}else if(slide==='goal'){");
  assert.ok(page.includes('<label class="ob-field ob-field-at"><span>Ton pseudo</span><span class="ob-at-box"><b class="ob-at" aria-hidden="true">@</b><input id="ob-pseudo" type="text" maxlength="15" value="${escAttr(psHandle(v))}" placeholder="lea_sql"'));
  assert.ok(!page.includes('unique dans l’appli') && !page.includes('ob-helper') && !page.includes('Un surnom suffit'));
  for (const part of ['html #onboarding .ob-at{position:absolute;left:18px;', /* Plus précis que « #onboarding.ob-vitrine .ob-field input{padding:0 18px!important} », sinon le @ recouvre la 1re lettre */
    'html #onboarding.ob-vitrine .ob-field.ob-field-at input{padding-left:36px!important;text-transform:lowercase}',
    'html #onboarding .ob-pseudo .ps-etat{margin-top:14px}',
    /* Les bandes en haut (barre d’état) et en bas (barre de Safari) prennent le violet de l’écran, plus le lavande de l’appli */
    'html.lq:has(#onboarding.on){background:#4529CC!important}', 'html.lq:has(#onboarding.on) body{background:#6E50F6!important}'])
    assert.ok(css.includes(part), part);
});

test('Mon compte : le pseudo sous le prénom ; « manches réussies » partout au lieu de « trouvées »', () => {
  assert.ok(app.includes('<span class="acct-id-copy"><b>${esc(accountTitle)}</b>${lvlBadgeHTML(level,\'is-on-deep\')}${psMien()?`<em class="acct-id-pseudo">${esc(psMien())}</em>`:\'\'}</span>'));
  assert.ok(app.includes("aria-label=\"${escAttr(`Modifier mon profil. ${accountTitle}${psMien()?`, pseudo ${psMien()}`:''}, niveau ${level.rank} : ${level.label}`)}\""));
  assert.ok(css.includes('html.lq .acct-id-copy .acct-id-pseudo{align-self:flex-start;'));
  for (const part of ["`réussie${kd.tr>1?'s':''}`:'à jouer'", "${kd.tr}/${kd.ma} réussie${kd.tr>1?'s':''}",
    '`${kd.tr}/${kd.ma} manches réussies · ${sallePts(kd.pts)}`', "return `${ok}/${n} réussie${ok>1?'s':''}`;",
    "${trouves} ${plur(trouves,'manche')} ${plur(trouves,'réussie')} sur ${manches}", "${h.ok}/${h.n} ${plur(h.ok,'réussie')}"])
    assert.ok(app.includes(part), part);
  assert.ok(!app.includes('manches trouvées') && !app.includes("plur(trouves,'trouvée')") && !app.includes("plur(h.ok,'trouvé')"));
});

test('Supabase — la base met le pseudo sous la même forme (jeu_pseudo_forme), partout', () => {
  const m = fs.readFileSync(new URL('../supabase/migrations/20261031172909_pseudo_arobase.sql', import.meta.url), 'utf8');
  assert.ok(m.includes("select case when h = '' then '' else '@' || h end") && m.includes("left(regexp_replace(lower(coalesce(p, '')), '[^a-z0-9àâäáãåāçćčéèêëēęíìîïīñńóòôöõøōúùûüūýÿœæß._-]', '', 'g'), 15)"));
  const appCar = app.match(/const PS_CAR=\/(\[[^\]]+\])\/g;/)[1];
  assert.ok(m.includes(`'${appCar}'`), 'les mêmes caractères que l’appli');
  assert.equal((m.match(/:= public\.jeu_pseudo_forme\(p_pseudo\);/g) || []).length, 2, 'jeu_pseudo_libre et jeu_pseudo_prendre');
  assert.ok(m.includes("v_c := '@' || left(v_base, 15 - char_length(v_s)) || v_s;"), 'les idées aussi');
  assert.ok(m.includes("v_pseudo := public.jeu_pseudo_forme(v_pseudo);"), 'une ancienne version de l’appli réserve aussi un identifiant');
  assert.ok(m.includes("update public.jeu_pseudo set pseudo = public.jeu_pseudo_forme(pseudo)") && m.includes('update public.jeu_joueur j set pseudo = p.pseudo from public.jeu_pseudo p'), 'les pseudos déjà réservés');
  assert.ok(m.includes('revoke all on function public.jeu_pseudo_forme(text) from public, anon, authenticated;') && !m.includes('grant execute on function public.jeu_pseudo_forme'));
  /* Vérifié sur la vraie base (31 octobre, 18 h 30, sans rien garder) : « Élisa Blanchart!! » → @élisablanchart, « @@Léa.DB » → @léa.db,
     un émoji seul → rien ; réservé en @testarobase ; pris : @testarob_select, @testarobase.db, @testarobase737 ; « Elisa » est devenu @elisa */
});
