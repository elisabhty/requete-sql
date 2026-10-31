/* Elisa, 31 octobre, 18 h 49 (capture de « Aide et prise en main ») :
   « pour aide, fais plutôt l’onglet pour contacter, reporter un bug, etc. » ;
   « comprendre mes données dans Données et confidentialité ».
   Le code de l’appli est exécuté avec un faux DOM et un faux serveur. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const site = fs.readFileSync(new URL('../decouvrir/confidentialite.html', import.meta.url), 'utf8');
const ios = fs.readFileSync(new URL('../IOS.md', import.meta.url), 'utf8');
const sql = fs.readFileSync(new URL('../supabase/migrations/20261031175421_nous_contacter.sql', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const flush = () => new Promise(r => setImmediate(r));
const plain = v => JSON.parse(JSON.stringify(v));
const mod = cut('/* ---------- Comprendre mes données ----------', 'function replayOnboarding(){');

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
function mkEl(id) {
  const cls = new Set(), attrs = {};
  return {
    id, value: '', textContent: '', innerHTML: '', hidden: false, disabled: false, placeholder: '', dataset: {}, style: {}, scrollHeight: 90, attrs,
    classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c), toggle: (c, f) => { const on = f === undefined ? !cls.has(c) : !!f; if (on) cls.add(c); else cls.delete(c); return on; } },
    setAttribute: (k, v) => { attrs[k] = String(v); }, focus() { this.focused = true; },
  };
}
function ctx({ ua = IPHONE, touch = 5, store = {}, reply = () => ({ ok: true }), online = true, standalone = false, native = false } = {}) {
  const els = {}, calls = [], buzzes = [];
  const get = id => (els[id] ||= mkEl(id));
  const c = vm.createContext({
    esc, escAttr, JSON, Math, String, Array, Promise, setTimeout: f => f(),
    lqStkSvg: k => `<svg data-k="${k}"></svg>`, appVersionLabel: () => 'Version v2223',
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } },
    navigator: { userAgent: ua, maxTouchPoints: touch, language: 'fr-FR', onLine: online, standalone },
    screen: { width: 390, height: 844 }, innerWidth: 390, innerHeight: 844,
    matchMedia: q => ({ matches: standalone && /standalone/.test(q) }),
    document: { getElementById: id => get(id), querySelectorAll: () => [] },
    clsCle: () => 'K'.repeat(32), buzz: k => buzzes.push(k),
    clsRpc: (f, b) => { calls.push({ fn: f, body: plain(b) }); const r = reply(f, b); return r instanceof Error ? Promise.reject(r) : Promise.resolve(r); },
  });
  c.window = c; if (native) c.Capacitor = { isNativePlatform: () => true };
  vm.runInContext(mod, c);
  return { c, ev: s => vm.runInContext(s, c), el: get, calls, buzzes, store };
}

test('Mon compte : « Aide et prise en main » devient « Nous contacter », dans sa feuille', () => {
  assert.ok(!app.includes('Aide et prise en main') && !app.includes("openLegal('help')") && !app.includes('account-help'), 'plus d’aide');
  assert.ok(app.includes(`<button class="account-setting-row" type="button" onclick="openPlusDetails('plus-contact')"><span class="plus-row-icon help is-stk">\${lqStkSvg(ACCT_STK.contact)}</span><span><b>Nous contacter</b><small>Un bug, une idée, une question</small></span>`));
  assert.ok(app.includes("const ACCT_STK={account:'user',route:'route',bell:'bell',reading:'eye',privacy:'shield',help:'help',contact:'bubble'};"), 'la bulle de discussion');
  assert.ok(app.includes(`<details class="plus-details" id="plus-contact">
      <summary><span>Nous contacter</span><small>Un bug, une idée, une question : on lit tout.</small><i aria-hidden="true">×</i></summary>
      <div class="plus-details-body ct-body" id="ct-body">\${ctHTML()}</div>
    </details>`));
  assert.ok(app.includes("const titles={privacy:'Confidentialité',terms:'Conditions'};"), 'la feuille Aide n’existe plus');
  /* À l’ouverture, le formulaire (pas le « merci » d’avant) */
  assert.ok(app.includes("if(id==='plus-contact'&&typeof ctAvant==='function')ctAvant();"));
  /* « Revoir l’intro » reste dans Profil et objectif */
  assert.ok(app.includes('<div class="at"><b>Revoir l’intro</b><small>Accueil et choix de connexion</small></div>'));
});

test('le formulaire : quatre sujets, le message (1000 caractères), l’e-mail facultatif, les infos techniques d’un bug', () => {
  const t = ctx();
  const h = t.ev('ctHTML()');
  for (const s of ['Un bug', 'Une idée', 'Une question', 'Autre chose']) assert.ok(h.includes(`>${s}</button>`), s);
  assert.ok(h.includes('class="ct-type on" role="radio" aria-checked="true" data-k="bug"'), 'un bug par défaut');
  assert.ok(h.includes('<textarea id="ct-msg" maxlength="1000" rows="4" placeholder="Ce qui s’est passé, sur quel écran, ce que tu attendais…"'));
  assert.ok(h.includes('<label class="ct-l" for="ct-mail">Ton e-mail <small>facultatif, pour te répondre</small></label>'));
  assert.ok(h.includes('type="email" inputmode="email" autocomplete="email"'));
  assert.ok(h.includes('<label class="ct-infos" id="ct-infos"><input type="checkbox" checked'), 'cochées pour un bug');
  assert.ok(h.includes('<small>v2223 · iPhone · Safari · navigateur · 390×844</small>'), 'ce qui part, montré avant l’envoi');
  assert.ok(h.includes('<button type="button" class="lq-btn ct-go" id="ct-go" onclick="ctEnvoyer()">Envoyer</button>'));
  assert.ok(h.includes('Ton message part sur le serveur de l’appli, à Paris, seulement pour te répondre et améliorer Requête.'));
  /* Une idée : pas d’infos techniques */
  t.ev("CT.type='idee'");
  assert.ok(t.ev('ctHTML()').includes('<label class="ct-infos" id="ct-infos" hidden>'));
  /* Le brouillon revient d’un lancement à l’autre */
  const d = ctx({ store: { 'rq-contact': JSON.stringify({ type: 'question', msg: 'Bonjour', mail: ' lea@exemple.fr ', infos: false }) } });
  const h2 = d.ev('ctHTML()');
  assert.ok(h2.includes('data-k="question"') && h2.includes('class="ct-type on" role="radio" aria-checked="true" data-k="question"'));
  assert.ok(h2.includes('>Bonjour</textarea>') && h2.includes('value="lea@exemple.fr"') && h2.includes('7 / 1000'));
});

test('les infos techniques : l’appareil, le navigateur et le mode, rien d’autre', () => {
  const f = (o) => ctx(o).ev('JSON.stringify(ctInfos())');
  assert.deepEqual(JSON.parse(f({})), { version: 'v2223', appareil: 'iPhone', navigateur: 'Safari', mode: 'navigateur', ecran: '390×844', langue: 'fr-FR' });
  assert.equal(JSON.parse(f({ standalone: true })).mode, 'écran d’accueil');
  assert.equal(JSON.parse(f({ native: true })).mode, 'appli');
  const and = JSON.parse(f({ ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' }));
  assert.equal(and.appareil, 'Android'); assert.equal(and.navigateur, 'Chrome');
  const ipad = JSON.parse(f({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', touch: 5 }));
  assert.equal(ipad.appareil, 'iPad', 'un iPad se présente comme un Mac, mais tactile');
  const mac = JSON.parse(f({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:131.0) Gecko/20100101 Firefox/131.0', touch: 0 }));
  assert.equal(mac.appareil, 'Mac'); assert.equal(mac.navigateur, 'Firefox');
  assert.equal(JSON.parse(f({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1' })).navigateur, 'Chrome');
});

test('l’envoi : vérifié, envoyé à contact_envoyer, puis merci ; les refus du serveur expliqués ; le brouillon gardé si ça échoue', async () => {
  const t = ctx();
  t.ev('ctHTML()');
  await t.ev('ctEnvoyer()');
  assert.equal(t.el('ct-etat').textContent, 'Écris ton message, puis envoie-le.'); assert.ok(t.el('ct-msg').focused);
  assert.deepEqual(t.calls, [], 'rien ne part sans message');
  t.el('ct-msg').value = 'Le défi 12 refuse un alias.'; t.ev("ctTape(document.getElementById('ct-msg'))");
  assert.equal(t.el('ct-count').textContent, '27 / 1000');
  t.el('ct-mail').value = 'pas-un-mail'; t.ev("ctMail(document.getElementById('ct-mail'))");
  await t.ev('ctEnvoyer()');
  assert.equal(t.el('ct-etat').textContent, 'Cette adresse e-mail semble incomplète.'); assert.deepEqual(t.calls, []);
  t.el('ct-mail').value = ' Lea@Exemple.fr '; t.ev("ctMail(document.getElementById('ct-mail'))");
  await t.ev('ctEnvoyer()'); await flush();
  assert.deepEqual(t.calls, [{ fn: 'contact_envoyer', body: { p_cle: 'K'.repeat(32), p_type: 'bug', p_message: 'Le défi 12 refuse un alias.', p_email: 'Lea@Exemple.fr',
    p_infos: { version: 'v2223', appareil: 'iPhone', navigateur: 'Safari', mode: 'navigateur', ecran: '390×844', langue: 'fr-FR' } } }]);
  assert.equal(t.ev('CT.fini'), true); assert.deepEqual(t.buzzes.slice(-1), ['success']);
  assert.ok(t.el('ct-body').innerHTML.includes('Merci, c’est envoyé&nbsp;!') && t.el('ct-body').innerHTML.includes('On te répond à <b>Lea@Exemple.fr</b>.'));
  assert.deepEqual(JSON.parse(t.store['rq-contact']), { type: 'bug', msg: '', mail: 'Lea@Exemple.fr', infos: true }, 'le brouillon est vidé, l’e-mail gardé pour la prochaine fois');
  /* Rouvrir la feuille : le formulaire */
  t.ev('ctAvant()'); assert.equal(t.ev('CT.fini'), false); assert.ok(t.el('ct-body').innerHTML.includes('id="ct-msg"'));
  /* Une question, infos décochées : rien de technique ne part */
  t.ev("ctType('question')"); t.ev('ctInfosOn(false)');
  t.el('ct-msg').value = 'Comment exporter ?'; t.ev("ctTape(document.getElementById('ct-msg'))");
  await t.ev('ctEnvoyer()');
  assert.equal(t.calls.at(-1).body.p_infos, null); assert.equal(t.calls.at(-1).body.p_type, 'question');
  /* Les refus du serveur */
  const trop = ctx({ reply: () => ({ ok: false, raison: 'trop' }) });
  trop.ev("ctHTML();CT.msg='Encore un message'");
  await trop.ev('ctEnvoyer()');
  assert.equal(trop.el('ct-etat').textContent, 'Tu as envoyé plusieurs messages d’affilée : réessaie dans quelques minutes.');
  assert.equal(trop.ev('CT.fini'), false); assert.equal(trop.el('ct-go').textContent, 'Envoyer'); assert.equal(trop.el('ct-go').disabled, false);
  const panne = ctx({ reply: () => new Error('réseau') });
  panne.ev("ctHTML();CT.msg='Un bug'");
  await panne.ev('ctEnvoyer()');
  assert.equal(panne.el('ct-etat').textContent, 'L’envoi n’a pas marché. Ton message est gardé : réessaie dans un instant.');
  assert.equal(panne.ev('CT.msg'), 'Un bug');
  const horsLigne = ctx({ online: false });
  horsLigne.ev("ctHTML();CT.msg='Un bug'");
  await horsLigne.ev('ctEnvoyer()');
  assert.deepEqual(horsLigne.calls, []); assert.equal(horsLigne.el('ct-etat').textContent, 'Pas de connexion : ton message est gardé, envoie-le dès que tu es en ligne.');
});

test('Données et confidentialité : « Comprendre mes données » en tête, qui se déplie', () => {
  assert.ok(app.includes(`      <summary><span>Données et confidentialité</span><small>Tu gardes le contrôle de tes informations.</small><i aria-hidden="true">×</i></summary>
      <div class="plus-details-body">
        \${accDonneesHTML()}
        <button class="acc-row" type="button" onclick="exportProgress()">`), 'à la place de l’ancien paragraphe, avant « Exporter »');
  assert.ok(!app.includes('class="account-data-note"'));
  const t = ctx();
  const h = t.ev('accDonneesHTML()');
  assert.ok(h.includes('<button type="button" class="acc-donnees-t" aria-expanded="false" aria-controls="acc-donnees" onclick="accDonnees(this)">'));
  assert.ok(h.includes('<b>Comprendre mes données</b><small>Sans compte, ton apprentissage reste sur cet appareil</small>'));
  assert.ok(h.includes('<div class="acc-donnees-c" id="acc-donnees" hidden>'), 'replié au départ');
  for (const part of ['<h4>Sur cet appareil</h4>', 'tes requêtes ne quittent jamais ton appareil', '<h4>Sur le serveur de l’appli <small>Supabase, à Paris</small></h4>',
    '<b>Ton pseudo</b>', '<b>Le classement</b>', '<b>La salle entre amis</b>', 'effacés au bout de 24&nbsp;h', '<b>Tes messages</b> envoyés depuis «&nbsp;Nous contacter&nbsp;»',
    '<h4>Tu gardes la main</h4>'])
    assert.ok(h.includes(part), part);
  const p = t.el('acc-donnees'); p.hidden = true;
  const btn = mkEl('btn');
  t.c.btn = btn; t.ev('accDonnees(btn)');
  assert.equal(p.hidden, false); assert.equal(btn.attrs['aria-expanded'], 'true'); assert.ok(btn.classList.contains('is-open'));
  t.ev('accDonnees(btn)'); assert.equal(p.hidden, true); assert.equal(btn.attrs['aria-expanded'], 'false');
});

test('la confidentialité dit où partent les messages (appli, site, notes App Store)', () => {
  const li = '<li>Les messages envoyés depuis <b>Nous contacter</b> (Mon compte)&nbsp;: ton message, ton e-mail si tu le donnes et, pour un bug, des infos techniques (version, appareil, navigateur, écran) sont enregistrés sur le serveur de l’appli (Supabase, à Paris), seulement pour te répondre et corriger l’appli, puis effacés au bout de 3&nbsp;ans au plus.</li>';
  assert.equal(app.split(li).length - 1, 2, 'dans la confidentialité de l’appli et dans le choix « sans compte »');
  assert.ok(site.includes('<li><b>Messages de contact.</b> Depuis l’appli (Mon compte, «&nbsp;Nous contacter&nbsp;»), ton message, son sujet'));
  assert.ok(site.includes('ou depuis l’appli (Mon compte, «&nbsp;Nous contacter&nbsp;»).'), 'les droits s’exercent aussi depuis l’appli');
  assert.ok(ios.includes('vue\n  `contact_boite`') || ios.includes('`contact_boite`'), 'où lire les messages');
  assert.ok(ios.includes('« Adresse e-mail » (facultative), « Autre contenu utilisateur » (le message) et « Autres données de\n  diagnostic »'));
});

test('Supabase — les messages : écrits seulement par contact_envoyer, lisibles seulement dans le tableau de bord', () => {
  for (const part of [
    'create table if not exists public.contact_message (',
    "type text not null check (type in ('bug', 'idee', 'question', 'autre'))",
    'message text not null check (char_length(message) between 3 and 1000)',
    'alter table public.contact_message enable row level security;',
    'revoke all on table public.contact_message from anon, authenticated;',
    'security definer\nset search_path = \'\'',
    "where e.key in ('version', 'appareil', 'navigateur', 'mode', 'ecran', 'langue')",
    "cle = v_cle and cree > now() - interval '10 minutes') >= 3",
    "cle = v_cle and cree > now() - interval '1 day') >= 20",
    "where cree > now() - interval '1 hour') >= 300",
    'create or replace view public.contact_boite with (security_invoker = true) as',
    'revoke all on public.contact_boite from anon, authenticated;',
    'grant execute on function public.contact_envoyer(text, text, text, text, jsonb) to anon, authenticated;',
    "delete from public.contact_message where cree < now() - interval '3 years';",
    "select cron.schedule('contact-menage', '29 4 * * *', 'select public.contact_menage()');"])
    assert.ok(sql.includes(part), part);
  /* L’appli envoie exactement ces arguments */
  assert.ok(app.includes("clsRpc('contact_envoyer',{p_cle:clsCle(),p_type:CT.type,p_message:msg,p_email:mail||null,p_infos:CT.type==='bug'&&CT.infos?ctInfos():null})"));
});

test('la DA : pastilles en relief comme le rappel, champs lilas, carte lilas qui se déplie', () => {
  for (const part of [
    'html.lq #scr-compte .ct-type.on{background:var(--accent);border-color:var(--accent);color:#fff;box-shadow:0 3px 0 var(--accent-lip)}',
    'html.lq #scr-compte .ct-msg textarea,html.lq #scr-compte .ct-mail{display:block;width:100%;box-sizing:border-box;',
    'html.lq #scr-compte .ct-infos[hidden]{display:none}',
    'html.lq #scr-compte .ct-go{display:block;width:100%;margin:16px 0 0}',
    'html.lq #scr-compte .acc-donnees{margin:16px 18px 8px;border-radius:18px;background:var(--accent-soft);overflow:hidden}',
    'html.lq #scr-compte .acc-donnees-t.is-open .acc-donnees-chev{transform:rotate(180deg)}',
    'html.lq #scr-compte .acc-donnees-c[hidden]{display:none}'])
    assert.ok(css.includes(part), part);
  assert.ok(!css.includes('account-help-copy'), 'les styles de l’ancienne aide sont partis');
});
