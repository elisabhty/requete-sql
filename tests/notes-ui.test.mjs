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
  assert.ok(/editingNote=null; noteView='list';\s*backToNotesList\(\);/.test(del), 'l’éditeur est vidé avant le retour à la liste');
  assert.ok(/toastWithAction\('Note supprimée','Tu peux encore l’annuler\.','Annuler',/.test(del), 'toast avec « Annuler »');
  assert.ok(/state\.notes\.splice\(Math\.min\(i,state\.notes\.length\),0,gone\)/.test(del), 'Annuler remet la note à sa place');
  assert.ok(/toastAction\)\{ const f=toastAction; toastAction=null; f\(\); return; \}/.test(fnSrc('toastGo')), 'le bouton du toast lance l’action');
  assert.ok(/<button type="button" class="tgo" id="toast-go">/.test(html), 'bouton du toast : un vrai bouton');
});

test('éditeur de note : Enregistrer et Épingler donnent un retour visible', () => {
  assert.equal((html.match(/\nfunction togglePin\(/g) || []).length, 1, 'une seule fonction togglePin (l’ancienne masquait la nouvelle)');
  const save = fnSrc('saveNote');
  assert.ok(/b\.innerHTML=`\$\{CHECK_SVG\}<span>Enregistrée<\/span>`/.test(save), 'le bouton passe à « ✓ Enregistrée »');
  assert.ok(/toast\(wasNew\?'Note enregistrée':'Modifications enregistrées'/.test(save), 'toast de confirmation');
  const pin = fnSrc('togglePin');
  assert.ok(/persistEditingNote\(\)/.test(pin), 'l’épingle compte tout de suite');
  assert.ok(/toast\(e\.pin\?'Note épinglée':'Note désépinglée'/.test(pin) && /ic\.animate\(/.test(pin), 'toast et épingle qui bascule');
  assert.ok(/toast\(n\.pin\?'Note épinglée':'Note désépinglée'/.test(fnSrc('togglePinFromList')), 'même retour depuis la liste');
  const css = fs.readFileSync(path.join(root, 'ludique.css'), 'utf8');
  assert.ok(/html\.lq \.ne-row \.sec\.pin-on\{background:var\(--accent-soft\)!important;border-color:var\(--accent\)!important/.test(css), '« Épinglée » se voit (le style ludique forçait le bouton en blanc)');
  assert.ok(/\.ne-row button svg\{width:16px;height:16px;flex:none\}/.test(html), 'l’icône d’épingle n’est plus écrasée sur téléphone');
});
