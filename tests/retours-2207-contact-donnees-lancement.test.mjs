// Elisa, 12 novembre, 22 h 07 : « Le Contacte-nous, mets-le avec Questions fréquentes » (retours-1849) ; « est-ce vraiment obligatoire,
// le sauvegarder en local et réinjecter ? car ils peuvent le modifier, non, et le réinjecter avec de fausses infos ? » (son choix :
// retirer « Restaurer », garder le téléchargement d’une copie) ; « j’ai eu un “Préparation de ta base de données” en ouvrant
// l’appli… bizarre » (son choix : retirer la phrase).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('plus de réinjection : « Restaurer une sauvegarde » est retirée, partout', () => {
  assert.ok(!app.includes('function importProgress(') && !app.includes('onclick="importProgress()"'));
  assert.ok(!app.includes('rq-import-ok') && !app.includes('<b>Restaurer une sauvegarde</b>') && !app.includes("titre:'Remplacer ta progression ?'"));
  /* Plus aucun texte ne promet une sauvegarde à restaurer */
  for (const t of ['à restaurer ici ou sur un autre appareil', 'il se restaure dans Mon compte', 'sauf si tu as fait une sauvegarde avant', 'sauf si tu as exporté ta progression avant',
    'Garde-en une sauvegarde pour la retrouver ailleurs', 'sauvegarde ta progression avant', '<b>Sauvegarder ma progression</b>'])
    assert.ok(!app.includes(t), t);
  assert.ok(!lire('decouvrir/conditions.html').includes('Sauvegarder ma progression'));
});

test('il reste une copie de ses données à télécharger (le droit d’en obtenir une copie)', () => {
  assert.ok(app.includes('<div class="at"><b>Télécharger mes données</b><small>Une copie de ta progression, de tes notes et de ton planning</small></div>'));
  const f = cut('async function exportProgress(){', '\n}\n');
  assert.ok(f.includes('const fileName=`requete-mes-donnees-${new Date().toISOString().slice(0,10)}.json`;'));
  assert.ok(f.includes("'Téléchargées',how==='share'?'C’est fait : ce fichier contient une copie de tes données.':`Fichier téléchargé : ${fileName}`"));
  assert.ok(app.includes('Tu peux télécharger une copie de tes données, effacer ta progression ou supprimer ton compte à tout moment depuis Mon compte. Un effacement est définitif.</p>'));
  assert.ok(app.includes("t:'Gérer mes données',r:'Télécharger une copie de tes données ou effacer tes informations.'"));
  assert.ok(app.includes("'Supprimer l’appli efface aussi ce qui est sur cet appareil. Avec un compte connecté, ta progression reste sur ton compte.'"));
  assert.ok(lire('decouvrir/conditions.html').includes('Tu peux télécharger une copie de tes données à tout moment (Mon compte, «&nbsp;Télécharger mes données&nbsp;»).'));
  /* Le contenu du fichier n’a pas changé (retours-1516) */
  assert.ok(app.includes("return {v:1,app:'requete-sql',exportedAt:new Date().toISOString(),state:normalizeState(state),extra};"));
});

test('démarrage lent de l’appli : l’anneau d’attente, sans la phrase ; le site garde la sienne', () => {
  assert.ok(lq.includes('html.is-native.lq #loader.is-intro.is-long .spinner{opacity:1}'));
  assert.ok(lq.includes('html.is-native.lq #loader.is-intro p{display:none}'));
  assert.ok(!lq.includes('#loader.is-intro.is-long :is(.spinner,p)'));
  assert.ok(app.includes('<p>Préparation de ta base de données…</p></div>'), 'le chargement du site');
  assert.ok(app.includes("setTimeout(function(){if(!L.classList.contains('is-play')&&!L.classList.contains('fade-out'))L.classList.add('is-long');},2600);"));
});
