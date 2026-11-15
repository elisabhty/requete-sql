/* Elisa, 15 novembre, 13 h : « on va partir sur l’anglais. Et fini le travail du coup avec le site, les widgets et tout. Et dans un
   widget, il y a écrit le chat, machin… Je ne veux pas dire le chat, je veux dire Requête : le chat, il s’appelle Requête. »
   - Le chat s’appelle Requête partout où le widget en parle (« Chut, Requête dort… », « Requête garde ta place », « La pièce de
     Requête ») et dans la page des widgets de l’app.
   - Les widgets et les Live Activities parlent la langue de l’appli : l’app l’écrit dans le groupe d’apps (« langue »), le widget
     traduit ses propres textes (traduit, motsAnglais) ; ce que l’app lui envoie (la prochaine leçon, les questions de la requête de
     poche, la leçon et le défi express, la salle, l’accueil, les raccourcis de l’icône, les rappels) arrive déjà traduit (natifT). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), swift = lire('resources/ios/widget/RequeteWidget/RequeteWidget.swift'), pont = lire('resources/ios/widget/App/RequeteWidgetPlugin.swift');
const entre = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, a); const j = s.indexOf(b, i); assert.ok(j > i, b); return s.slice(i, j); };
const sansCommentaires = s => s.split('\n').map(l => { let q = false; for (let i = 0; i < l.length; i++) { if (l[i] === '\\' && q) { i++; continue; } if (l[i] === '"') q = !q; if (!q && l.startsWith('//', i)) return l.slice(0, i); } return l; }).join('\n');

function moteur(code = 'en') {
  const local = {'requete-maj-canal': '"essai"', 'requete-langue': code}, win = {};
  const ctx = {window: win, navigator: {language: 'fr-FR'}, Intl: {DateTimeFormat: () => ({resolvedOptions: () => ({timeZone: 'Europe/Paris'})})},
    location: {hostname: 'x', search: ''}, localStorage: {getItem: k => (k in local ? local[k] : null), setItem(k, v) { local[k] = v; }},
    document: {write() {}, documentElement: {}, title: '', addEventListener() {}, currentScript: {getAttribute: () => null}}};
  vm.runInNewContext(lire('langues.js'), ctx);
  if (code !== 'fr') vm.runInNewContext(lire(`langue-${code}.js`), ctx);
  vm.runInNewContext(entre(app, 'function natifLangue(){', 'let widgetDernier=') + entre(app, 'function pocheLangue(q){', '\n/* Ta semaine') + '\nthis.pocheLangue=pocheLangue;this.natifT=natifT;', ctx);
  return ctx;
}
const banque = nom => vm.runInNewContext('(' + entre(app, 'const ' + nom + '=', '\n];\n').replace('const ' + nom + '=', '') + '\n])');

test('le chat s’appelle Requête : dans le widget et dans la page des widgets', () => {
  const code = sansCommentaires(swift);
  for (const l of code.match(/"(?:[^"\\]|\\.)*"/g)) assert.doesNotMatch(l, /\b(le|du) chat\b/i, l);
  for (const k of ['"Chut, Requête dort…"', '"Requête garde ta place\\u{202F}: reviens quand tu veux."', '"La pièce de Requête : le feu de la séance du jour',
    '"Ta flamme du jour, et Requête qui change avec la journée."']) assert.ok(swift.includes(k), k);
  for (const k of ['ta flamme du jour et Requête.', 'La flamme du jour et Requête</small>', "d:'La flamme du jour, et Requête qui change avec la journée.'", "d:'La pièce de Requête"])
    assert.ok(app.includes(k), k);
  assert.ok(!/\b(flamme du jour et le chat|pièce du chat|le chat qui change)\b/.test(app));
});

test('le widget lit la langue de l’appli dans le groupe d’apps ; le pont l’y écrit', () => {
  assert.ok(entre(pont, '@objc func maj(_ call: CAPPluginCall) {', '\n    }\n').includes('d.set(call.getString("langue") ?? "fr", forKey: "langue")'));
  const l = entre(swift, 'enum LangueWidget {', '\n}\n');
  assert.ok(l.includes('UserDefaults(suiteName: groupe)?.string(forKey: "langue") == "en"'), 'le français tant que l’app n’a rien dit');
  assert.ok(l.includes('return anglais ? "of" : "sur"') && l.includes('case 2: return "\\(n)nd"') && l.includes('if dizaine >= 11 && dizaine <= 13 { return "\\(n)th" }'));
  const t = entre(swift, 'func traduit(_ texte: String) -> String {', '\n}\n');
  assert.ok(t.includes('if !LangueWidget.anglais { return texte }') && t.includes('if let t = motsAnglais[texte] { return t }') && t.includes('cle += "{\\(nombres.count)}"'));
  assert.ok(app.includes('const data={langue:natifLangue(),serie,jour,'), 'l’app l’envoie avec la série');
});

test('chaque texte du widget a sa traduction, et chaque clé est bien un texte du widget', () => {
  const d = entre(swift, 'private let motsAnglais: [String: String] = [', '\n]');
  const paires = [...d.matchAll(/^ {4}"((?:[^"\\]|\\.)*)": "((?:[^"\\]|\\.)*)",?$/gm)].map(m => [m[1], m[2]]);
  assert.ok(paires.length >= 100, paires.length + ' textes');
  const ailleurs = swift.slice(0, swift.indexOf('private let motsAnglais'));
  for (const [fr, en] of paires) {
    if (!fr.includes('{1}')) assert.ok(ailleurs.includes('"' + fr + '"'), 'écrit dans le widget : ' + fr);
    assert.deepEqual(fr.match(/\{\d\}/g) || [], en.match(/\{\d\}/g) || [], 'mêmes nombres : ' + fr);
    assert.doesNotMatch(en.replace(/Requête/g, ''), /[àâçéèêîôûœ]/, 'en anglais : ' + en);
  }
  /* Ce que le widget affiche passe par traduit, la galerie aussi */
  for (const k of ['.configurationDisplayName(traduit("Ta flamme"))', '.configurationDisplayName(traduit("La cheminée"))', '.configurationDisplayName(traduit("La requête de poche"))',
    '.configurationDisplayName(traduit("Ta semaine"))', 'Text(traduit(leconPhrase(etat)))', 'Text(traduit("Allumer ma flamme"))', 'return traduit("QCM · ") + q.titre',
    'let nom: String = traduit(SemaineRangement.noms[j.rang])', 'if LangueWidget.anglais { return attenteAnglais(e, a) }', 'return Text(minuit, style: .relative) + Text(" left before midnight.")'])
    assert.ok(swift.includes(k), k);
  assert.equal((swift.match(/\.description\(traduit\("/g) || []).length, 5, 'les cinq descriptions de la galerie');
});

test('la requête de poche en anglais : les 318 questions, sans un mot de français (code, réponses, explications)', () => {
  const ctx = moteur('en');
  const FR = /[àâçéèêëîïôûùüœ]|\b(le|la|les|des|une|un|du|est|pas|pour|avec|sans|dans|sur|qui|que|ou|et|nom|prenom|ville|commandes?|produits?|clients?|prix|quantite|fidelite|statut|categorie|valeur|ateliers|inscriptions|avis|entrepot|boutique|villes|pays|titre|tarif|etiquette|cher|bas|doublons|compris)\b/i;
  let n = 0;
  for (const nom of ['POCHE', 'POCHE_PLUS', 'POCHE_ENTRETIEN']) for (const p of banque(nom)) {
    n++;
    const q = {titre: 'Jointures', code: p.q || [], choix: p.c, bon: p.b, oui: p.oui, non: p.non, genre: nom === 'POCHE_ENTRETIEN' ? 'entretien' : (p.g || 'trou'), enonce: p.e || ''};
    const e = ctx.pocheLangue(q);
    assert.equal(e.titre, 'Joins');
    assert.equal(e.bon, p.b, 'la bonne réponse ne bouge pas');
    for (const v of [e.enonce, ...e.code, ...e.choix, e.oui, e.non]) assert.doesNotMatch(String(v).replace(/'[^']*'/g, ''), FR, `${nom} : ${v}`);
  }
  assert.equal(n, 318);
  const un = ctx.pocheLangue({titre: 'SELECT', code: ['-- le prénom et le nom', 'SELECT prenom___ nom', 'FROM clients;'], choix: [',', 'AND', '+'], bon: 0, oui: 'La virgule sépare les colonnes.', non: 'Sans virgule, pas de seconde colonne.', genre: 'trou', enonce: ''});
  assert.deepEqual(JSON.parse(JSON.stringify(un.code)), ['-- first and last name', 'SELECT first_name___ last_name', 'FROM customers;'], 'le trou reste à sa place');
  const erreur = ctx.pocheLangue({titre: 'SELECT', code: ['SELECT prenom', 'FROM clients', "WHERE ville = Paris;"], choix: ['Ligne 1', 'Ligne 2', 'Ligne 3'], bon: 2, oui: 'x', non: 'y', genre: 'erreur', enonce: 'Une ligne est fausse : laquelle ?'});
  assert.deepEqual(JSON.parse(JSON.stringify(erreur.choix)), ['Line 1', 'Line 2', 'Line 3']);
  assert.equal(erreur.enonce, 'One line is wrong: which one?');
  /* En français, la question repart telle quelle */
  const fr = moteur('fr'), q = {titre: 'Jointures', code: ['SELECT prenom'], choix: ['a'], bon: 0, oui: 'o', non: 'n', genre: 'trou', enonce: ''};
  assert.equal(fr.pocheLangue(q), q);
});

test('les rappels en anglais : les 24 messages traduits, le même tirage ; un message en ligne sans traduction n’est pas envoyé', () => {
  const ctx = moteur('en');
  ctx.RAPPELS = JSON.parse(lire('rappels.json')).messages.concat([['🆕 Un message tout neuf', 'Pas encore traduit.']]);
  vm.runInNewContext(entre(app, 'const RAPPEL_MESSAGES=[', '/* « Est-ce que je pourrais') + entre(app, 'function rappelListeLangue(){', '/* App iOS : le rappel passe') +
    '\nfunction rappelListe(){return RAPPELS;}\nthis.liste=rappelListeLangue;', ctx);
  const l = ctx.liste();
  assert.equal(l.length, 24);
  for (const [a, b] of l) assert.doesNotMatch((a + ' ' + b).replace(/Requête/g, ''), /[àâçéèêîôûœ]|\b(tu|ton|ta|une|les|des)\b/i, a);
  assert.ok(l.some(([a]) => a === '📉 SELECT motivation'), 'un titre qui s’écrit pareil, sa seconde ligne traduite');
  assert.ok(app.includes("  if(natifLangue()!=='fr')return rappelMessageLangue(d);") && app.includes('function rappelSignature(){return [natifLangue(),'), 'la langue change le tirage et l’empreinte');
});

test('ce que l’app envoie aux Live Activities et aux raccourcis passe par la traduction', () => {
  for (const k of ["titre:l?`${natifT('Leçon')} ${lessonNumAffiche(l.id)} · ${natifT(l.titre)}`", "action:natifT(`Leçon express · ${n} min`)",
    "defi:c?String(natifT(c.titre)||'').slice(0,80):''", "module:m?`Module ${mi+1} · ${natifT(m.titre)}`:natifT('Cours')",
    "titre:natifT(ILE_OB_TITRES[slide]||'Ton parcours'),bonjour:prenom?`${natifT('Bienvenue')}, ${prenom}`:natifT('Bienvenue sur Requête')",
    "{items:RACCOURCIS.map(x=>Object.assign({},x,{titre:natifT(x.titre),sousTitre:natifT(x.sousTitre)}))}", 'v.prochaine=l?natifT(l.titre):'])
    assert.ok(app.includes(k), k);
  const ctx = moteur('en');
  for (const [fr, en] of [['Leçon express · 4 min', 'Quick lesson · 4 min'], ['Défi express · 3 min', 'Quick challenge · 3 min'], ['Joueur', 'Player'], ['Juge-nous (gentiment) 👀', 'Judge us (gently) 👀']])
    assert.equal(ctx.natifT(fr), en, fr);
});

test('l’outil : tools/langue/natif.mjs liste ce que l’iPhone recevrait sans traduction', () => {
  const t = lire('tools/langue/natif.mjs');
  for (const k of ['POCHE_ENTRETIEN', 'RAPPEL_MESSAGES', 'RACCOURCIS', 'ILE_OB_TITRES', "natifT\\('"]) assert.ok(t.includes(k), k);
  assert.ok(lire('tools/langue/README.md').includes('natif.mjs'));
});
