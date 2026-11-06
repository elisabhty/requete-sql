/* Elisa, 6 novembre, 10 h 16 (captures d’une relecture de « Données et confidentialité ») : « les informations sont pertinentes et
   rassurantes, mais le texte est beaucoup trop dense pour une application mobile » ; « Tes données, tes choix » ; « Tu sais ce qui est
   enregistré et tu gardes le contrôle » ; quatre rubriques fermées par défaut (Sur ton appareil, En ligne, Ta confidentialité, Gérer
   mes données) ; des phrases courtes ; « il faut vérifier ces trois affirmations dans le fonctionnement réel » (Supabase à Paris,
   l’effacement au bout de 24 heures, les requêtes locales) ; un lien vers la politique complète, avec les durées de conservation. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), css = lire('ludique.css'), conf = lire('decouvrir/confidentialite.html');
const migr = fs.readdirSync(path.join(ROOT, 'supabase/migrations')).map(f => lire('supabase/migrations/' + f)).join('\n');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const N = ' ';

function feuille() {
  const els = {};
  const mk = id => { const cls = new Set(), attrs = {}; return { id, hidden: true, attrs, classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c), toggle: (c, f) => { const on = f === undefined ? !cls.has(c) : !!f; if (on) cls.add(c); else cls.delete(c); return on; } }, setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: k => attrs[k] ?? null }; };
  const get = id => (els[id] ||= mk(id));
  const c = vm.createContext({ lqStkSvg: k => `<svg data-k="${k}"></svg>`, buzz() {}, document: { getElementById: get } });
  vm.runInContext(cut('/* ---------- Comprendre mes données ----------', '/* ---------- Nous contacter ----------'), c);
  return { c, get, ev: s => vm.runInContext(s, c) };
}

test('le titre, la phrase de résumé et la ligne des réglages', () => {
  assert.ok(app.includes('<summary><span>Tes données, tes choix</span><small>Tu sais ce qui est enregistré et tu gardes le contrôle.</small><i aria-hidden="true">×</i></summary>'));
  assert.ok(app.includes(`onclick="openPlusDetails('plus-data')"><span class="plus-row-icon privacy is-stk">\${lqStkSvg(ACCT_STK.privacy)}</span><span><b>Tes données, tes choix</b><small>Ce qui est gardé, sauvegarde, effacement</small></span>`));
  assert.ok(!app.includes('<b>Données et confidentialité</b>') && !app.includes('<span>Données et confidentialité</span>'), 'plus l’ancien titre à l’écran');
});

test('quatre rubriques fermées au départ, chacune avec son résumé ; ouvertes, elles le restent ; rouverte, la feuille repart fermée', () => {
  const t = feuille();
  const h = t.ev("accDonneesHTML('<i>actions</i>')");
  const titres = [...h.matchAll(/<span class="dc-tt"><b>([^<]+)<\/b><small>([^<]+)<\/small><\/span>/g)].map(m => [m[1], m[2]]);
  assert.deepEqual(titres, [['Sur ton appareil', 'Tes cours, ta progression et tes bases importées.'], ['En ligne', 'Seulement ce qu’il faut pour jouer à plusieurs et te répondre.'],
    ['Ta confidentialité', 'Personne ne voit tes requêtes.'], ['Gérer mes données', 'Sauvegarder ta progression ou effacer tes informations.']]);
  assert.equal((h.match(/ hidden>/g) || []).length, 4, 'les quatre fermées');
  assert.deepEqual([...h.matchAll(/data-k="([a-z]+)"/g)].map(m => m[1]), ['tel', 'nuage', 'shield', 'export'], 'un autocollant par rubrique');
  /* Ouvrir « En ligne » */
  const b = t.get('dc-t-ligne'); b.attrs['aria-controls'] = 'dc-ligne'; t.c.b = b;
  t.ev('accDonnees(b)');
  assert.equal(t.get('dc-ligne').hidden, false); assert.equal(b.attrs['aria-expanded'], 'true');
  assert.ok(t.ev("accDonneesHTML('')").includes('aria-expanded="true" aria-controls="dc-ligne"'), 'Mon compte redessiné : la rubrique reste ouverte');
  /* Rouvrir la feuille : tout repart fermé */
  const host = { querySelectorAll: s => (s === '.dc-c' ? [t.get('dc-ligne')] : s === '.dc-t,.dc-r' ? [b] : []) };
  b.classList.add('dc-t'); t.c.host = host; t.ev('accDonneesFermer(host)');
  assert.equal(t.get('dc-ligne').hidden, true); assert.equal(b.attrs['aria-expanded'], 'false');
  assert.ok(!t.ev("accDonneesHTML('')").includes('aria-expanded="true"'));
  assert.ok(cut('function openPlusDetails(id){', '\n}').includes("if(id==='plus-data'&&typeof accDonneesFermer==='function')accDonneesFermer(el);"));
});

test('les actions sont rangées dans « Gérer mes données », la politique et les textes officiels juste dessous', () => {
  const data = cut('<details class="plus-details" id="plus-data">', '<details class="plus-details" id="plus-contact">');
  const i = data.indexOf('${accDonneesHTML(`'), j = data.indexOf('`)}');
  assert.ok(i > 0 && j > i);
  for (const a of ['exportProgress()', 'importProgress()', 'clsQuitter()', 'resetAllProgress()']) assert.ok(data.slice(i, j).includes(a), a);
  assert.ok(data.indexOf('<p class="dc-legal-t">Pour tout lire</p>') > j);
  assert.ok(data.includes('<b>Politique de confidentialité</b><small>Les durées de conservation, tes droits, les services utilisés</small>'));
});

test('des phrases courtes, et les trois affirmations vérifiées dans le fonctionnement réel', () => {
  const t = feuille();
  const txt = t.ev("accDonneesHTML('')").replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(txt, / [?!;:]/, 'espace insécable avant la ponctuation');
  for (const li of t.ev('DC_RUBRIQUES').flatMap(r => r.c)) assert.ok(li.replace(/<[^>]+>/g, '').split(/\s+/).length <= 32, li);
  /* 1. Supabase à Paris (le projet est en eu-west-3 ; la politique le dit déjà) */
  assert.ok(txt.includes('Tout est hébergé chez Supabase, à Paris.') && conf.includes('hébergée par Supabase à Paris'));
  /* 2. Les salles effacées au bout de 24 heures : les deux ménages, toutes les heures */
  assert.ok(migr.includes("delete from public.jeu_salle where maj < now() - interval '24 hours';") && migr.includes("delete from requete_private.salle where cree<clock_timestamp()-interval '24 hours';"));
  assert.ok(txt.includes(`effacés au bout de 24${N}heures`));
  /* 3. Les requêtes restent sur l’appareil, sauf en salle ; de celles-là, seule l’empreinte est gardée */
  assert.ok(migr.includes("encode(extensions.digest(p_sql,'sha256'),'hex')"), 'jeu_essai_v2 garde l’empreinte, pas la requête');
  assert.ok(txt.includes('tes requêtes ne quittent pas ton appareil, sauf celles des parties en salle, vérifiées en ligne') && txt.includes('Seule son empreinte, un code qui ne permet pas de la relire'));
  /* Les messages de « Contacte-nous » : 3 ans */
  assert.ok(migr.includes("delete from public.contact_message where cree < now() - interval '3 years';") && txt.includes(`Le message est effacé au bout de 3${N}ans.`));
  /* « Effacer la progression » retire les scores (jeu_oublier) ; le pseudo reste */
  assert.ok(cut('async function resetAllProgress(){', '\n}').includes("clsRpc('jeu_oublier',{p_cle:cle})") && txt.includes('tes scores quittent le classement. Ton pseudo reste à toi.'));
});

test('la politique de confidentialité dit combien de temps les données sont gardées', () => {
  assert.ok(conf.includes('<li><a href="#durees">Combien de temps nous gardons tes données</a></li><li><a href="#cookies">'));
  const d = conf.slice(conf.indexOf('<section id="durees">'), conf.indexOf('<section id="cookies">'));
  for (const k of ['au bout de 24&nbsp;heures', 'les réactions dès 10&nbsp;minutes', '3&nbsp;ans après leur envoi', 'tant que tu gardes ton compte', '«&nbsp;Supprimer mon compte&nbsp;» les efface tout de suite'])
    assert.ok(d.includes(k), k);
  assert.ok(migr.includes("delete from public.jeu_msg where m->>'t' in ('ping', 'react') and cree < now() - interval '10 minutes';"), 'les réactions : 10 minutes');
});

test('le style : une carte blanche par rubrique, le lilas sur le titre ouvert ; les autocollants du téléphone et du nuage', () => {
  for (const k of ['html.lq #scr-compte .dc{display:flex;flex-direction:column;gap:10px;margin:16px 18px 4px}',
    'html.lq #scr-compte .dc-r.is-open .dc-t{background:var(--accent-soft)}',
    'html.lq #scr-compte .dc-t:focus-visible{outline:3px solid var(--accent);outline-offset:-3px;border-radius:18px}',
    'html.lq #scr-compte .dc-actions>.acc-row::after{display:none!important}',
    'html.lq[data-reading="large"] #scr-compte .dc-tt small,html.lq[data-reading="large"] #scr-compte .dc-c{font-size:16px}'])
    assert.ok(css.includes(k), k);
  assert.ok(!css.includes('.acc-donnees'), 'le style de l’ancienne carte est parti');
  const stk = cut('function lqStkSvg(k){', '\n}');
  assert.ok(stk.includes("    tel:['<rect x=\"12\" y=\"3.5\" width=\"24\" height=\"41\" rx=\"6.5\"/>',") && stk.includes("    nuage:['<path d=\"M14.5 39h20"));
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=182">'));
});
