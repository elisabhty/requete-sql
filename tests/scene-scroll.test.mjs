/* Une animation de la partie « Situation » (ou du concept) qui change de hauteur — des lignes qui se replient, un
   résultat qui apparaît, du texte qui s'affiche — ne doit pas faire bouger le texte que l'on lit plus bas. L'écran des
   cours n'a pas d'ancrage de défilement (overflow-anchor:none) : la scène décale elle-même le défilement quand elle est
   déjà dépassée. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const mount = html.slice(html.indexOf('function mountProbScene('), html.indexOf('/* Emplacements de requête exécutable dans le texte d’un cours. */'));

test('l’écran des cours n’a pas d’ancrage de défilement : c’est donc la scène qui garde la lecture en place', () => {
  assert.ok(/#scr-lesson\.screen\{[^}]*overflow-anchor:none/.test(html));
  assert.ok(mount.includes('const keepView=change=>'), 'fonction keepView dans le moteur des scènes');
});

test('keepView : scène dépassée → étape sans transition, repère sous la scène gardé en place par un décalage du défilement', () => {
  const kv = mount.slice(mount.indexOf('const viewAnchor='), mount.indexOf('const play=async()=>'));
  assert.ok(/root\.closest\('\.screen'\)/.test(kv), 'écran défilant de la scène');
  assert.ok(/root\.getBoundingClientRect\(\)\.top>=sr\.top-1\)\{change\(\);return;\}/.test(kv), 'scène encore à l’écran : elle s’anime normalement, sans décalage');
  assert.ok(/if\(!anchor\)\{change\(\);return;\}/.test(kv), 'rien d’affiché sous la scène : rien à protéger');
  assert.ok(/classList\.add\('is-instant'\)/.test(kv) && /sc\.scrollTop\+=dh/.test(kv) && /classList\.remove\('is-instant'\)/.test(kv));
  assert.ok(/anchor\.getBoundingClientRect\(\)\.top-y0/.test(kv), 'décalage = déplacement du repère');
});

test('le repère est le premier bloc sous la scène encore à l’écran (pas un bloc déjà passé au-dessus), hors blocs fixes ou collants', () => {
  const ba = html.slice(html.indexOf('function blockAfter('), html.indexOf('function mountProbScene('));
  assert.ok(/for\(let n=el;n&&n!==stop;n=n\.parentElement\)/.test(ba) && /nextElementSibling/.test(ba), 'on cherche parmi les blocs qui suivent, puis ceux qui suivent le parent…');
  assert.ok(/r\.height>0/.test(ba), 'un bloc masqué (hauteur nulle) ne peut pas servir de repère');
  assert.ok(/p!=='fixed'&&p!=='sticky'/.test(ba), 'un bloc fixe ou collant ne bouge pas avec le contenu : il ne peut pas servir de repère');
  const va = mount.slice(mount.indexOf('const viewAnchor='), mount.indexOf('const keepView='));
  assert.ok(/blockAfter\(root,sc,r=>r\.bottom<=sr\.top\)/.test(va), 'un bloc déjà passé au-dessus de l’écran est ignoré : on cherche plus bas');
  assert.ok(/a\.getBoundingClientRect\(\)\.top<sr\.bottom\?a:null/.test(va), 'premier bloc sous l’écran : rien à protéger');
});

test('chaque étape d’une scène passe par keepView — y compris les changements différés (texte, apparitions, cellules qui volent)', () => {
  assert.ok(/keepView\(\(\)=>apply\(s\)\);/.test(mount), 'play : keepView(() => apply(étape))');
  assert.ok(/timers\.push\(setTimeout\(\(\)=>keepView\(f\),ms\)\)/.test(mount), 'later : les changements décalés (stagger) passent aussi par keepView');
  assert.ok(/onfinish=\(\)=>\{keepView\(land\);p\.remove\(\);\}/.test(mount), 'fly : l’arrivée de la cellule (qui change la hauteur) aussi');
  assert.ok(/\.pr-scene\.is-instant \*\{transition:none!important\}/.test(html), 'is-instant : aucune transition');
});

test('commentaire d’une requête : s’il apparaît alors qu’on a défilé plus bas que le cadre, le texte lu ne bouge pas', () => {
  const slots = html.slice(html.indexOf('function initRunSqlSlots('), html.indexOf('function renderStudio('));
  assert.ok(/wrap\.getBoundingClientRect\(\)\.bottom<=sc\.getBoundingClientRect\(\)\.top/.test(slots), 'cadre déjà au-dessus de l’écran');
  assert.ok(/blockAfter\(notes\[notes\.length-1\],sc\)/.test(slots), 'repère : le premier bloc affiché qui suit les commentaires');
  assert.ok(/sc\.scrollTop\+=dy/.test(slots), 'défilement décalé de la hauteur ajoutée');
});
