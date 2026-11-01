/* Elisa, 1er novembre, 1 h 01 — réf. 1 : « rejoint la salle » et « Salle introuvable », deux pages de l’ancienne DA, et le crayon,
   dans la DA du site (le crayon discret, clair) ; réf. 2 : « ne pas pouvoir supprimer son pseudo et supprimer les scores du
   classement » ; réf. 3 : « texte coupé » (nom de projet). */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const conf = fs.readFileSync(new URL('../decouvrir/confidentialite.html', import.meta.url), 'utf8');

test('réf. 1 : rejoindre une salle et ses impasses sont la carte de l’écran Défis, code en tuiles', () => {
  assert.ok(app.includes('const etat=(stk,titre,sub,corps,cls)=>`<section class="room-card jeu-etat'));
  assert.ok(app.includes("html=etat('rocket','Tu rejoins la salle…','La salle de ton ami s’ouvre dans un instant.'"), 'on rejoint la salle');
  assert.ok(app.includes("html=etat('help','Salle introuvable',"), 'salle introuvable');
  assert.ok(app.includes("html=etat('user','Cette salle est vide',") && app.includes("html=etat('user','La salle est complète',"));
  assert.ok(!app.includes("head('Salle de défi','Salle introuvable'"), 'plus de page de l’ancienne DA');
  assert.ok(css.includes('html.lq .jeu-etat-code b{display:grid;place-items:center;width:40px;height:48px;'));
});

test('réf. 1 : le crayon est dessiné, discret dans une leçon ou un défi', () => {
  assert.ok(app.includes('<button class="fab" id="fab" onclick="quickNote()" title="Notes" aria-label="Ouvrir les notes"><svg class="fab-pen"'));
  assert.ok(!app.includes('aria-label="Ouvrir les notes">✎</button>'));
  assert.ok(css.includes('html.lq body.in-lesson .fab{display:grid;place-items:center;background:var(--accent-soft)!important;color:var(--accent-ink)!important;border:0!important;'));
});

test('réf. 2 : ni « Supprimer mon pseudo » ni « Retirer mes scores » ; les textes disent de nous écrire', () => {
  const data = app.slice(app.indexOf('<details class="plus-details" id="plus-data">'), app.indexOf('</details>', app.indexOf('<details class="plus-details" id="plus-data">')));
  assert.ok(!data.includes('psSupprimer()') && !data.includes('Retirer mes scores'));
  assert.ok(app.includes('Pour supprimer ton pseudo ou retirer tes scores du classement, écris-nous depuis «&nbsp;Nous contacter&nbsp;».'));
  assert.ok(!conf.includes('«&nbsp;Supprimer mon pseudo&nbsp;»') && !conf.includes('«&nbsp;Retirer mes scores du classement&nbsp;»'));
});

test('réf. 3 : le nom d’un projet s’affiche en entier, coupé après ses _ - .', () => {
  assert.ok(app.includes("<b>${d.id==='cours'?'Base des cours':d.id==='aeroport'?'Base Aéroport':esc(d.name).replace(/([_.-])/g,'$1<wbr>')}</b>"));
  assert.ok(css.includes('html.lq .console-project-copy b{white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:break-word;'));
});

/* 1 h 07 — « Tu joues en tant que » dans la DA du site ; la note sans « jamais tes requêtes » ; les lignes de « Profil et
   objectif » en cartes, cohérentes avec la carte du pseudo. */
test('1 h 07 : la carte du joueur, la note de la salle, les cartes de « Profil et objectif »', () => {
  assert.ok(app.includes('<span class="jeu-me-av"><b class="jeu-av" data-c="0" aria-hidden="true">${jeuInitial(nom)}</b><span class="jeu-me-lock" aria-label="Pseudo verrouillé" role="img">${PS_LOCK_SVG}</span></span>'));
  assert.ok(app.includes("<b>${at?'<i class=\"jeu-me-at\">@</i>':''}${esc(at?nom.slice(1):nom)}</b>"));
  assert.ok(css.includes('html.lq body .jeu-me .jeu-av{display:grid;place-items:center;width:46px;height:46px;'));
  assert.ok(app.includes("const JEU_NOTE_HTML='<p class=\"jeu-note\">🔒 Seuls ton pseudo, tes temps et tes réactions sont partagés.</p>';"));
  assert.ok(!app.includes('sont partagés, jamais tes requêtes'));
  assert.ok(css.includes('html.lq #plus-profile-settings .plus-details-body>.acc-row{width:calc(100% - 36px);margin:0 18px 12px;'));
});

test('1 h 29 : le bouton « Importer » de la Console garde son relief (la barre qui défile lui laisse la place)', () => {
  assert.ok(css.includes('html.lq #scr-console .console-schema-panel .db-bar{padding:2px 2px 6px;margin:-2px -2px -6px}'));
});

test('1 h 32 : la base Aéroport dans « Tes projets », de l’espace sous les retours, plus de phrase sous les projets', () => {
  assert.ok(app.includes("function isDemoDb(id){return id==='cours'||id==='aeroport';}"));
  assert.ok(app.includes("if(!dbCatalog.some(d=>d.id==='aeroport'))dbCatalog.splice(1,0,{id:'aeroport',name:'Aéroport'});"));
  assert.ok(app.includes('    await loadCustomDbs();\n    ensureAeroportDb();'), 'recréée à chaque ouverture');
  assert.ok(app.includes('  const payload=dbCatalog.filter(d=>!isDemoDb(d.id)).map(d=>{'), 'jamais enregistrée avec les projets');
  assert.ok(app.includes("async function renameDb(id){\n  if(isDemoDb(id))return;") && app.includes("function deleteDb(id){\n  if(isDemoDb(id)) return;"), 'ni renommée ni supprimée');
  assert.ok(app.includes("d.id==='aeroport'?'Base Aéroport'"));
  assert.ok(css.includes('html.lq #app .p-bar{height:calc(var(--safe-top) + 52px);padding-bottom:8px;box-sizing:border-box;margin-bottom:calc(-1 * (var(--safe-top) + 52px))}'));
  assert.ok(!app.includes('Chaque projet garde sa base, son brouillon et son historique.'));
});

test('1 h 44 : la description de la base Aéroport est celle du fichier d’Elisa', () => {
  assert.ok(app.includes("id==='aeroport'?DEFI_BASES.aeroport.desc:''"));
  assert.ok(app.includes("desc:'Bienvenue dans les coulisses d’un aéroport international. Vols, passagers, compagnies, avions et bagages : toutes les données nécessaires au fonctionnement de l’aéroport sont réunies ici. Explore la base pour résoudre les différentes missions.'"));
});
