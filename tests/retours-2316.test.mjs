/* Elisa, 6 novembre, 23 h 16, cinq captures de TestFlight :
   - étapes 7, 6 et 5 de l’onboarding : « Il y a des pages qui sautent au niveau de l’onboarding » ; à la question, « La page bouge » :
     elle apparaît puis se décale ou change de taille juste après. Le contenu glissait de 30 px, les réponses et les tuiles grossissaient en
     descendant de 8 px puis dépassaient leur taille, la bulle s’ouvrait en grandissant, la mascotte arrivait d’un rebond tournant.
     Maintenant la page apparaît en fondu, déjà à sa place ; les blocs l’un après l’autre, puis plus rien ne bouge. Le rebond reste au
     toucher d’une réponse. (Vérifié dans le navigateur, étape par étape, en avançant et en reculant : aucune image où un bloc bouge.)
   - « Ta première requête est réussie ! » : « Met le en continuant… juste en bas du bouton jaune ».
   - Réf. 5, « Encore un effort ! » : « il y a des barres en haut et en bas que je veux homogénéiser avec le reste » : sur téléphone, le
     voile de fin couvre tout l’écran, sous l’heure et la barre d’accueil, au lieu de la seule scène du lecteur. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../onboarding-vitrine.css', import.meta.url), 'utf8');
const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i); assert.ok(j > i, b); return app.slice(i, j); };
const keyframes = name => { const i = code.indexOf(`@keyframes ${name}{`); assert.ok(i >= 0, name); return code.slice(i, code.indexOf('}}', i) + 2); };

test('onboarding : en changeant d’étape, la page apparaît en fondu, déjà à sa place', () => {
  for (const k of ['obvOutFwd', 'obvOutBack', 'obvInFwd', 'obvInBack', 'obvApparait'])
    assert.ok(!/transform|translate|scale|rotate/.test(keyframes(k)), `${k} : l’opacité seulement`);
  assert.ok(code.includes('html #onboarding.ob-vitrine .ob-slide.out .ob-screen>:not(.ob-flow-top){animation:obvOutFwd .14s ease-in both!important}'), 'la page qui sort, en fondu court');
  assert.ok(code.includes('  animation-name:obvInFwd;animation-duration:.26s}') && code.includes('  animation-name:obvInBack;animation-duration:.26s}'));
  assert.ok(code.includes('  animation:obvApparait .26s ease-out backwards}'), 'à l’ouverture aussi');
});

test('onboarding : réponses, tuiles, bulle, mascotte et résumés arrivent sans bouger ni grandir', () => {
  assert.ok(code.includes('html #onboarding.ob-vitrine.ob-enter :is(.ob-answer,.ob-tile){animation:obvApparait .24s ease-out backwards;animation-delay:calc(var(--d,0ms) * .5 + .06s)}'), 'l’une après l’autre, en fondu');
  assert.ok(code.includes('html #onboarding.ob-vitrine.ob-enter .ob-bubble{animation:obvApparait .24s ease-out .06s both}'), 'la bulle ne grandit plus');
  assert.ok(code.includes('-webkit-user-drag:none;animation:obvApparait .24s ease-out both,obvStkBob 3.8s ease-in-out .7s infinite}'), 'la mascotte arrive en fondu, puis se balance');
  assert.ok(code.includes('html #onboarding.ob-vitrine :is(.ob-rhythm-summary,.ob-level-hint){animation-name:obvApparait}'), 'redessinés à chaque choix : en fondu');
  assert.ok(code.includes('html:not([data-motion="reduce"]) #onboarding.ob-vitrine.ob-enter .ob-source-tile{animation:obvApparait .24s ease-out calc(var(--d,0ms) * .5) both}'));
  assert.ok(code.includes('html #onboarding.ob-vitrine.ob-selection-update .ob-tile.on{animation:iosSelectedPop'), 'le rebond reste au toucher');
});

test('« En continuant… » juste sous le bouton jaune, avec ses deux liens', () => {
  const page = cut("}else if(slide==='account'){", "}else if(slide==='name'){");
  assert.ok(!page.includes('class="ob-legal-note"'), 'plus dans la page');
  assert.ok(page.includes("obSetFooter(authReady?'':'Continuer',authReady?null:obPasserConnexion,'','',{html:legal});"));
  assert.ok(page.includes('const legal=`En continuant, tu acceptes les <a class="ob-legal-link" href="${escAttr(legalUrl(\'terms\'))}" target="_blank" rel="noopener">Conditions d’utilisation</a> et la <a class="ob-legal-link" href="${escAttr(legalUrl(\'privacy\'))}" target="_blank" rel="noopener">Politique de confidentialité</a>.`;'));
  /* Le pied de page, pour de vrai : la note sous le bouton reçoit le HTML, puis redevient du texte à l’étape suivante */
  const els = {}; const el = id => (els[id] = els[id] || { id, style: {}, classList: { on: new Set(), toggle(c, v) { v ? this.on.add(c) : this.on.delete(c); } }, set innerHTML(v) { this._html = v; this._txt = null; }, set textContent(v) { this._txt = v; this._html = null; } });
  const ctx = vm.createContext({ document: { getElementById: el }, obJustEntered: false, obCtaLibelle(b, t) { b.label = t; }, obCtaWake() {} });
  vm.runInContext(cut('function obSetFooter(', 'function obRythmeMinutes('), ctx);
  ctx.obSetFooter('Continuer', () => {}, '', '', { html: 'En continuant, <a>…</a>' });
  assert.equal(els['ob-foot-note']._html, 'En continuant, <a>…</a>'); assert.ok(els['ob-foot-note'].classList.on.has('is-legal'));
  ctx.obSetFooter('Continuer', () => {}, '', '', 'Ta progression sera sauvegardée sur tous tes appareils.');
  assert.equal(els['ob-foot-note']._txt, 'Ta progression sera sauvegardée sur tous tes appareils.'); assert.ok(!els['ob-foot-note'].classList.on.has('is-legal'), 'les autres notes restent du texte');
  assert.ok(code.includes('html #onboarding.ob-vitrine .ob-foot-note.is-legal{max-width:340px;margin:12px auto 0!important;font-size:11.5px!important;'), '9 novembre, 2 h : 12 px de plus sous le bouton (retours-0031)');
  assert.ok(code.includes('html #onboarding.ob-vitrine .ob-screen.ob-account>:last-child{margin-bottom:auto!important}'), 'la page reste centrée à la verticale');
});

test('« Encore un effort ! » : sur téléphone, le voile couvre tout l’écran, sous l’heure et la barre d’accueil', () => {
  assert.ok(app.includes('@media (max-width:599.98px){\n  .lv-end{position:fixed;inset:0;padding:calc(env(safe-area-inset-top,0px) + 16px) calc(env(safe-area-inset-right,0px) + 16px) calc(env(safe-area-inset-bottom,0px) + 16px) calc(env(safe-area-inset-left,0px) + 16px)}\n}'));
  assert.ok(app.includes('.lv-end{position:absolute;inset:0;display:flex;'), 'sur ordinateur, il reste dans le cadre du lecteur');
  assert.ok(app.includes('.lv-close{position:absolute;z-index:4;'), 'la croix reste au-dessus du voile');
});
