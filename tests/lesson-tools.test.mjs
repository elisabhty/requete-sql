/* En-tête d'un cours : deux boutons, « Schéma » et « Notes » (pastille + nom dessous), visibles sur la leçon, l'exercice
   et le quiz (pas dans un défi ni sur l'écran de fin), à la place de la bulle « Notes ». Carte « Mission accomplie » du cours
   SELECT : les 9 colonnes de la table, la requête qui sélectionne les colonnes utiles, les 5 colonnes à l'arrivée. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'ludique.css'), 'utf8');
const fnSrc = name => {
  const a = html.indexOf(`function ${name}(`);
  assert.ok(a >= 0, `function ${name}( présente`);
  return html.slice(a, html.indexOf('\nfunction ', a + 10));
};

test('en-tête du cours : un bouton « Voir le schéma » et un bouton « Notes », reliés aux feuilles existantes', () => {
  const nav = html.slice(html.indexOf('<section id="scr-lesson"'), html.indexOf('<div class="lesson-wrap" id="lesson-body">'));
  const tools = /<div class="nav-tools" id="nav-tools" hidden>([\s\S]*?)<\/div>/.exec(nav);
  assert.ok(tools, 'bloc nav-tools dans l’en-tête, caché par défaut');
  const buttons = tools[1].match(/<button[\s\S]*?<\/button>/g) || [];
  assert.equal(buttons.length, 2, 'deux boutons');
  assert.ok(/onclick="openSchemaSheet\(\)"[^>]*aria-label="Voir le schéma de la base"/.test(buttons[0]), 'schéma : feuille Schéma, nom accessible');
  assert.ok(/onclick="quickNote\(\)"[^>]*aria-label="Ouvrir mes notes"/.test(buttons[1]), 'notes : feuille Notes, nom accessible');
  /* Une icône seule ne dit pas ce qu'elle ouvre : chaque bouton porte son nom sous la pastille (et ce nom fait partie du nom accessible). */
  assert.ok(/<span class="nav-tool-ico"><svg[\s\S]*?<\/svg><\/span><span class="nav-tool-t">Schéma<\/span><\/button>/.test(buttons[0]), 'légende « Schéma »');
  assert.ok(/<span class="nav-tool-ico"><svg[\s\S]*?<\/svg><\/span><span class="nav-tool-t">Notes<\/span><\/button>/.test(buttons[1]), 'légende « Notes »');
  assert.ok(html.includes('function openSchemaSheet(') && html.includes('function quickNote('), 'les deux feuilles existent');
});

test('les boutons s’affichent sur la leçon, l’exercice et le quiz (étapes 0 à 2), jamais dans un défi', () => {
  const flow = fnSrc('renderLessonFlow');
  assert.ok(/showTools=lessonStep<=2/.test(flow), 'étapes 0, 1 et 2 seulement (pas l’écran de fin)');
  assert.ok(/navTools\.hidden=!showTools/.test(flow) && /classList\.toggle\('has-tools',showTools\)/.test(flow));
  const show = fnSrc('showScreen');
  assert.ok(/mode!=='lesson'/.test(show) && /nav-tools/.test(show) && /remove\('has-tools'\)/.test(show), 'cachés hors d’un cours');
});

test('style : pastilles rondes à droite de l’en-tête avec leur nom dessous, repère de lecture décalé, bulle « Notes » masquée dans un cours', () => {
  assert.ok(/#scr-lesson \.navbar \.nav-tools\{position:absolute;right:12px/.test(css));
  assert.ok(/#scr-lesson \.nav-tool\{[^}]*min-width:44px;display:flex;flex-direction:column/.test(css), 'un seul bouton par outil (pastille + nom), cible tactile d’au moins 44 px');
  assert.ok(/#scr-lesson \.nav-tool-ico\{[^}]*width:36px;height:36px[^}]*border-radius:50%/.test(css), 'pastille ronde de 36 px');
  assert.ok(/#scr-lesson \.nav-tool-t\{font:700 10\.5px\/1\.1 var\(--display\)/.test(css), 'nom sous la pastille');
  assert.ok(/#scr-lesson \.nav-tool:active \.nav-tool-ico\{transform:translateY\(3px\)/.test(css), 'la pastille s’enfonce au toucher');
  assert.ok(/\.navbar\.has-tools \.ls-where\{right:106px\}/.test(css) && /\.navbar\.has-tools \.nav-title\{margin-right:106px\}/.test(css));
  assert.ok(/body\.in-lesson:has\(#scr-lesson\.active \.navbar\.has-tools\) #fab\{display:none!important\}/.test(css));
});

test('cours SELECT, carte « Mission accomplie » : 9 colonnes au départ, SELECT sélectionne, 5 colonnes à l’arrivée', () => {
  const ctx = vm.createContext({});
  vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), ctx);
  const lesson = vm.runInContext('MODULES.flatMap(m=>m.lessons).find(l=>l.id===1)', ctx);
  const body = lesson.studio.uses.body;
  assert.ok(body.includes('Toutes les colonnes de la table <code>clients</code>'));
  assert.ok(body.includes('SELECT prenom, nom, adresse, ville, telephone'));
  assert.ok(body.includes('ne sélectionne que les colonnes utiles'));
  assert.ok(body.includes('colonnes à l’arrivée'));
  assert.ok(body.includes('Celles nécessaires à la livraison'));
  assert.ok(!body.includes('colonnes dans la liste de livraison') && !body.includes('ne garde que les colonnes utiles'));
  /* guideFr met une espace insécable avant « : ». */
  assert.equal(vm.runInContext('GUIDE_DONE[1].s', ctx).replace(/ /g, ' '), 'Chaque client apparaît uniquement avec les informations utiles au transporteur : la liste de livraison est prête.');
});

test('tableaux de résultat des cours : titres de colonnes et valeurs centrés (seul le numéro de ligne « # » reste à droite)', () => {
  assert.ok(/\.exframe \.xf-result \.table-wrap thead th:not\(\.rn\)\{text-align:center\}/.test(css), 'titres centrés');
  assert.ok(/\.exframe \.xf-result \.table-wrap tbody td:not\(\.num\)\{text-align:center\}/.test(css), 'valeurs centrées');
  assert.ok(!/\.exframe \.xf-result \.table-wrap [^{]*\{text-align:left\}/.test(css), 'plus de colonne alignée à gauche dans un cadre de résultat');
});
