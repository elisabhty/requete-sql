/* Notes et écrans vides :
   - le bouton d'un écran vide (« Effacer la recherche », « Voir les questions à revoir ») est toujours sur sa propre ligne,
     sous le texte, jamais collé à la fin d'une phrase ;
   - changer de filtre (Toutes, Épinglées, Avec requête) ne fait pas sauter la page : la rangée de filtres reste en place ;
   - une note coupée (texte ou requête) a un bouton « Voir tout » qui la déplie sur place, sans ouvrir la note. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const fnSrc = name => {
  const a = html.indexOf(`function ${name}(`);
  assert.ok(a >= 0, `function ${name}( présente`);
  return html.slice(a, html.indexOf('\nfunction ', a + 10));
};

test('écrans vides : le bouton passe sous le texte et se centre (notes, console, entretien)', () => {
  const reset = /\.sq-reset\{[^}]*\}/.exec(html);
  assert.ok(reset, 'règle .sq-reset');
  assert.ok(/display:flex;width:fit-content/.test(reset[0]) && /margin:14px auto 0/.test(reset[0]), '« Effacer la recherche » : bloc centré, plus en ligne');
  assert.ok(!/display:inline-flex/.test(reset[0]), 'plus de bouton en ligne après le texte');
  assert.ok(/\.ent-empty button\{display:block;margin:15px auto 0;/.test(html), 'entretien : bouton sous le texte');
  for (const f of ['renderNotesSurface', 'renderConsoleSide']) assert.ok(/class="sq-reset"/.test(fnSrc(f)), `${f} utilise le bouton commun`);
});

test('changer de filtre : la rangée de filtres reste au même endroit de l’écran', () => {
  assert.ok(/notesEnter=false;renderNotes\(\{keepChips:true\}\);/.test(fnSrc('setNotesFilter')), 'le filtre demande un rendu qui garde les filtres en place');
  assert.ok(/function renderNotes\(opts\)\{[\s\S]*?renderNotesHub\(opts\)[\s\S]*?renderNotesScreen\(opts\)/.test(html), 'les options passent aux deux surfaces');
  const surf = fnSrc('renderNotesSurface');
  assert.ok(/html=notesFilterChips\(fCount\)\+noteDupsHtml\(\)\+/.test(surf), 'le bandeau « notes en double » (seulement dans « Toutes ») est sous les filtres, pas au-dessus');
  assert.ok(/const y0=row0\?row0\.getBoundingClientRect\(\)\.top:null;/.test(surf), 'position des filtres avant le rendu');
  assert.ok(/scroller\.scrollTop\+=dy/.test(surf), 'défilement recalé de l’écart');
  assert.ok(/listHost\.style\.minHeight=\(listHost\.offsetHeight\+dy\)\+'px'/.test(surf), 'liste plus courte : on garde de la place sous la liste');
  assert.ok(/on\.focus\(\{preventScroll:true\}\)/.test(surf), 'le focus revient sur le filtre choisi');
  assert.ok(/\.notes-hub \.sq-status\{position:absolute;width:1px;height:1px;margin:0;overflow:hidden;clip-path:inset\(50%\)/.test(html), 'ligne d’état réservée aux lecteurs d’écran : elle ne décale plus les filtres');
});

test('note coupée : « Voir tout » la déplie sur place, sans ouvrir la note', () => {
  const card = fnSrc('noteCardHtml');
  assert.ok(/<button type="button" class="nmore" aria-expanded="false" onclick="event\.stopPropagation\(\);toggleNoteMore\(this\)">Voir tout<\/button>/.test(card), 'bouton dans le pied de la carte');
  assert.ok(/onkeydown="if\(event\.target!==this\)return;/.test(card), 'Entrée sur un bouton de la carte (Voir tout, épingle) n’ouvre pas la note');
  const surf = fnSrc('renderNotesSurface');
  assert.ok(/card\.classList\.toggle\('has-more',clipT\|\|clipQ\)/.test(surf), 'bouton affiché seulement si le texte ou la requête est coupé');
  const tog = fnSrc('toggleNoteMore');
  assert.ok(/classList\.toggle\('is-open'\)/.test(tog) && /'Voir moins':'Voir tout'/.test(tog) && /aria-expanded/.test(tog));
  assert.ok(/\.ncard \.nmore\{display:none\}/.test(html) && /\.ncard\.has-more \.nmore\{display:inline-flex/.test(html));
  assert.ok(/\.ncard\.is-open \.ntxt,\.ncard\.is-open \.ntxt\.is-clip\{max-height:none;-webkit-mask-image:none;mask-image:none\}/.test(html), 'texte déplié en entier, sans fondu');
  assert.ok(/\.ncard\.is-open \.nsql\{display:block;-webkit-line-clamp:unset\}/.test(html), 'requête dépliée en entier');
});

test('liste « Toutes » : une seule section, dont le nombre est celui du filtre « Toutes »', () => {
  const surf = fnSrc('renderNotesSurface');
  assert.ok(/html=notesFilterChips\(fCount\)\+noteDupsHtml\(\)\+notesSectionHtml\('Toutes les notes',list\);/.test(surf));
  assert.ok(!/notesSectionHtml\('Épinglées',pinned\)/.test(surf), 'plus de section « Épinglées 16 » sous le filtre « Toutes 27 »');
});

test('éditeur de note : Supprimer supprime vraiment, et peut être annulé', () => {
  const del = fnSrc('deleteNote');
  /* Avant, quitter l'éditeur réenregistrait la note qu'on venait de supprimer. */
  assert.ok(/editingNote=null; noteView='list';[^]*?backToNotesList\(\);/.test(del), 'l’éditeur est vidé avant le retour à la liste');
  assert.ok(/toastWithAction\('Note supprimée','Tu peux encore l’annuler\.','Annuler',/.test(del), 'toast avec « Annuler »');
  assert.ok(/state\.notes\.splice\(Math\.min\(i,state\.notes\.length\),0,gone\)/.test(del), 'Annuler remet la note à sa place');
  assert.ok(/toastAction\)\{ const f=toastAction; toastAction=null; f\(\); return; \}/.test(fnSrc('toastGo')), 'le bouton du toast lance l’action');
  assert.ok(/<button type="button" class="tgo" id="toast-go">/.test(html), 'bouton du toast : un vrai bouton');
});

test('éditeur de note : Enregistrer donne un retour visible ; l’épingle est sur la carte de la note', () => {
  /* Elisa, 2 novembre, 18 h 45 : « Qu’est-ce que le bouton en trop au milieu ? Il y a trop de bouton ». L’éditeur garde une seule
     action, « Enregistrer » (et « Supprimer » pour une note déjà enregistrée) ; « Ouvrir dans la console » devient un lien à côté de
     « Requête associée » ; l’épingle reste sur chaque carte de la liste. */
  assert.equal((html.match(/\nfunction togglePin\(/g) || []).length, 0, 'plus d’épingle dans l’éditeur');
  const open = fnSrc('openNote');
  assert.ok(!/ne-pin|togglePin\(\)/.test(open) && /<button class="prim" type="button" onclick="saveNote\(\)">Enregistrer<\/button>/.test(open), 'une seule action principale');
  assert.ok(open.includes('<div class="ne-lab"><span>Requête associée</span>${e.sql?`<button class="ne-open" type="button" onclick="noteToConsole()">Ouvrir dans la console ›</button>`:\'\'}</div>'), '« Ouvrir dans la console » : un lien à côté de « Requête associée »');
  assert.ok(/setupEditor\('ne-sql','hl-ne-sql'\);[^]*?syncHL\('ne-sql','hl-ne-sql'\);/.test(open), 'la requête associée se voit dès l’ouverture (elle restait invisible jusqu’à la première frappe)');
  const save = fnSrc('saveNote');
  /* 31 octobre : le même retour que partout où l’on enregistre (lqSaved : menthe, coche qui se dessine, confettis) */
  assert.ok(/lqSaved\(b,'Enregistrée'\)\.then\(/.test(save) && /btn\.innerHTML=`<span class="lq-saved-ico" aria-hidden="true">\$\{CHECK_SVG\}<\/span><span>\$\{esc\(label\|\|'Enregistré'\)\}<\/span>`/.test(html), 'le bouton passe à « ✓ Enregistrée »');
  /* 31 octobre, 1 h 34 (« ne pas mettre de notification mais des micro-interactions ») : le bouton qui passe à « ✓ Enregistrée » suffit ;
     la phrase reste annoncée au lecteur d’écran (lqSay), sans notification à l’écran */
  /* 5 novembre, 22 h 35 : la coche « Créée » ou « Enregistrée » sur la carte de la note, qui l’annonce (lqDone), toujours sans notification */
  assert.ok(/dit=wasNew\?'Note enregistrée':'Modifications enregistrées'/.test(save) && /lqDone\(c,wasNew\?'Créée':'Enregistrée',dit\)/.test(save) && !/toast\(wasNew\?'Note enregistrée'/.test(save), 'annoncé, sans notification');
  assert.ok(/lqSay\(n\.pin\?'Note épinglée/.test(fnSrc('togglePinFromList')) && /lqPinFx\(/.test(fnSrc('togglePinFromList')), 'l’épingle de la carte : la coche qui se plante, annoncée sans notification');
});
