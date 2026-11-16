/* 16 novembre, 6 h 49 (Elisa : « Ouvrir un fichier depuis une autre app. Un CSV ou un Excel reçu par mail, WhatsApp ou dans
   Fichiers : Ouvrir dans Requête, et il arrive dans la Console. Oui, ça je le veux maintenant »).
   Vérifié avec le pont natif simulé (Playwright) : la Console s’ouvre sur « Importer une table » (ventes.csv, ses trois colonnes) ;
   en pleine séance ou pendant le parcours de bienvenue, il attend et le dit ; un fichier illisible le dit (en anglais aussi) ; la copie
   est effacée une fois lue. L’Info.plist produit par le script est valide (plistlib) et n’est complété qu’une fois. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), en = lire('langue-en.js'), ios = lire('scripts/ios-widget.mjs'), pont = lire('resources/ios/widget/App/RequeteWidgetPlugin.swift');

test('l’app iPhone se propose pour les tableaux et les bases (Info.plist)', () => {
  for (const t of ['public.comma-separated-values-text', 'public.tab-separated-values-text', 'public.json', 'org.openxmlformats.spreadsheetml.sheet',
    'com.microsoft.excel.xls', 'org.oasis-open.opendocument.spreadsheet', 'fr.requete.sql', 'fr.requete.sqlite']) assert.ok(ios.includes(`'${t}'`), t);
  assert.ok(ios.includes("importe('fr.requete.sqlite', 'Base SQLite', ['public.data', 'public.database'], ['sqlite', 'sqlite3', 'db', 'db3']"));
  assert.ok(ios.includes('<string>Alternate</string>') && ios.includes('<key>LSSupportsOpeningDocumentsInPlace</key>'), 'une app de plus pour ces fichiers ; une copie');
  assert.ok(ios.includes("if (t.includes('<string>fr.requete.sqlite</string>')) {}"), 'une seule fois');
});

test('le fichier arrive comme un lien, rangé à part, effacé une fois lu', () => {
  assert.ok(pont.includes('if lien.isFileURL {\n            RequeteFichier.recevoir(lien)\n            return\n        }'), 'SceneDelegate → RequeteRaccourci.ouvrir');
  assert.ok(pont.includes('caches.appendingPathComponent("Fichiers", isDirectory: true)') && pont.includes('guard url.path.hasPrefix(base) else { return }'), 'seulement nos copies');
  assert.ok(pont.includes('notifyListeners("fichier", data: f, retainUntilConsumed: true)') && pont.includes('CAPPluginMethod(name: "fichierFini"'));
  assert.ok(pont.includes('RequeteFichier.nettoyer()'), 'les copies oubliées partent au lancement');
  assert.ok(!/\?[^?\n:]*:[^\n]*\?[^?\n:]*:/.test(pont.slice(pont.indexOf('enum RequeteFichier'), pont.indexOf('/// Le jeton de push'))), 'pas deux ternaires sur une ligne');
});

test('la page : la Console et l’import, après le parcours, le paywall ou la séance', () => {
  assert.ok(app.includes("C.addListener('RequeteWidget','fichier',e=>fichierRecu(e));"));
  const f = app.slice(app.indexOf('async function fichierRecuTraiter(){'), app.indexOf('\n}\n', app.indexOf('async function fichierRecuTraiter(){')));
  for (const k of ["if(!state.onboarded)return fichierRecuAttendre('onboarding'", "if(typeof obGardeBloque==='function'&&obGardeBloque())return fichierRecuAttendre('paywall');",
    "if(document.querySelector('#scr-lesson.active,#lesson-video'))return fichierRecuAttendre('seance'", 'C.convertFileSrc(f.chemin)', "switchTab('console');",
    'await onDataImport({target:{files:[fichier],value:\'\'}});', 'fichierRecuFini(f.chemin);']) assert.ok(f.includes(k), k);
  for (const k of ['Termine ton parcours de bienvenue : ton fichier s’ouvrira juste après, dans la Console.', 'Ton fichier t’attend', 'Il s’ouvrira dans la Console à la fin de ta séance.',
    'Il s’ouvrira quand tu auras fini cet import.', 'Fichier illisible', '« {x1} » n’a pas pu être ouvert. Essaie de l’importer depuis la Console, avec « Importer un fichier ».'])
    assert.ok(en.includes(JSON.stringify(k) + ':'), k);
});
