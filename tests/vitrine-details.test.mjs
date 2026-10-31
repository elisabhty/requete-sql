/* Vitrine et vidéo : retours d’Elisa du 30 octobre.
   - « Se connecter » reste visible sur mobile (bouton icône animé), sur toutes les pages qui ont la barre du haut ;
   - la flèche de « Ton objectif ? » se voit (couleur d’accent) et reste affichée sans JavaScript ;
   - les cartes chiffrées ne débordent plus de l’écran (320 px, tablette) ;
   - vidéo : le data analyst est dans la carte Apec, avec son année (2022) et sa source, à part des barres 2024-2025 ;
   - vidéo : les trois questions passent dans l’en-tête, la barre SQL et le titre respirent.
   Puis (30 octobre, 13 h 37) :
   - les salaires rejoignent les cartes du haut : la carte « Salaire » garde « Avec l’expérience », le graphique par ville disparaît ;
   - avis : la dernière phrase de la note est retirée, Sofia passe en septembre, l’ordre reste du plus récent au plus ancien ;
   - les 15 parties du programme s’appellent des modules, comme dans l’appli ; la fiche SQL devient un parcours. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(root, 'decouvrir', f), 'utf8');
const css = lire('vitrine.css');
const video = lire('video.html');

test('« Se connecter » est dans la barre de chaque page, en icône sur mobile et en texte sur ordinateur', () => {
  for (const page of ['index.html', 'module.html', 'mentions-legales.html', 'confidentialite.html', 'conditions.html']) {
    const h = lire(page);
    const a = h.match(/<a class="btn btn-s login" href="connexion\.html">([\s\S]*?)<\/a>/);
    assert.ok(a, `${page} : lien de connexion dans la barre`);
    assert.match(a[1], /<svg class="me"[^>]*aria-hidden="true"/, `${page} : icône décorative`);
    assert.match(a[1], /<span class="lbl">Se connecter<\/span>/, `${page} : le texte reste lu par les lecteurs d’écran`);
  }
  /* La règle qui cachait le bouton sur mobile est suivie d’une règle qui l’affiche */
  const cache = css.indexOf('.nav-cta .login{display:none}'), montre = css.indexOf('.nav-cta .login{display:inline-flex;position:relative;width:42px');
  assert.ok(cache >= 0 && montre > cache, 'le bouton icône l’emporte sur l’ancien display:none');
  assert.match(css, /\.nav-cta \.login \.lbl\{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect\(0 0 0 0\)/, 'libellé masqué visuellement, pas supprimé');
  assert.match(css, /@media \(min-width:960px\)\{\s*\.nav-cta \.login\{width:auto/, 'sur ordinateur, le texte revient');
});

test('la flèche de « Ton objectif ? » est en couleur d’accent et visible même sans JavaScript', () => {
  const h = lire('index.html');
  assert.match(h, /<p class="pick-t" id="pick-t">Ton objectif&nbsp;\?<svg class="pick-arw"[^>]*aria-hidden="true"/);
  assert.match(css, /\.pick-t svg\.pick-arw\{[^}]*color:var\(--accent\)/);
  /* Le tracé caché puis dessiné n’existe qu’avec .js : sans script, la flèche est simplement affichée */
  const dash = css.match(/([^\n}]*)svg\.pick-arw path\{stroke-dasharray:1;stroke-dashoffset:1/);
  assert.ok(dash && dash[1].trim().startsWith('.js'), 'stroke-dashoffset réservé à .js');
});

test('les cartes chiffrées tiennent dans l’écran (colonnes en minmax(0, …))', () => {
  assert.match(css, /\.stats\{grid-template-columns:minmax\(0,1fr\)\}\n\.stats>\*\{min-width:0\}/);
  assert.match(css, /@media \(min-width:600px\) and \(max-width:959px\)\{\s*\.stats\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/, 'tablette : deux colonnes');
  assert.match(css, /\.stats\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/, 'ordinateur : trois colonnes qui peuvent rétrécir');
});

test('vidéo : le data analyst est dans la carte Apec, avec son année, à part des barres et sourcé', () => {
  const carte = video.slice(video.indexOf('<div class="abs card" id="apec">'), video.indexOf('<!-- S4b'));
  const da = carte.match(/<div class="dv da">([\s\S]*?)<\/div><\/div>/);
  assert.ok(da, 'ligne data analyst');
  assert.match(da[1], /Offres de data analyst<small>en 2022<\/small>/, 'année affichée');
  assert.doesNotMatch(da[1], /class="b /, 'pas de barre : chiffre de 2022, pas sur l’échelle 2024-2025');
  assert.match(video, /T\.fromTo\(P, \{da: 0\}, \{da: 55,/, 'le compteur monte à +55');
  assert.match(video, /Offres de data analyst \+55 % en 2022<\/b> \(1 345 offres, contre 867 en 2021/, 'chiffres de l’Apec dans les sources');
  assert.ok(video.includes('href="https://corporate.apec.fr/files/live/sites/corporate/files/Nos%20%C3%A9tudes/pdf/les-metiers-cadres-porteurs-en-2023"'), 'lien vers l’édition 2023');
  assert.match(video, /\[31\.5, 'Sources : [^']*éditions 2023, 2025 et 2026\.'\]/, 'source sous la scène');
  assert.match(video, /celles de data analyst de 55 % en 2022, dernier chiffre publié par l’Apec/, 'narration');
  assert.doesNotMatch(video, /ne publie pas de chiffre récent pour les data analysts/);
});

test('vidéo : les trois questions sont dans l’en-tête, la barre SQL et le titre ont de l’air', () => {
  assert.match(video, /#trk\{left:auto;right:80px;top:64px;height:48px/, 'pas à pas dans l’en-tête (56 → 120 px)');
  for (const [n, q] of [[1, 'Combien ça paie'], [2, 'Ça recrute'], [3, 'Quelle compétence']])
    assert.ok(video.includes(`<span class="tq" id="tq${n}"><span class="bd">0${n}<i>✓</i></span><span class="tx">${q}&nbsp;?</span></span>`), `question ${n}`);
  const top = +video.match(/\.sqlp\{left:80px;top:(\d+)px/)[1];
  const ttl = +video.match(/#s2 \.ttl,#s3 \.ttl,#s4 \.ttl,#sai \.ttl,#s5 \.ttl,#s6 \.ttl\{position:absolute;left:80px;top:(\d+)px/)[1];
  assert.ok(top - 120 >= 40, `au moins 40 px entre l’en-tête et la barre SQL (${top - 120})`);
  assert.ok(ttl - (top + 64) >= 40, `au moins 40 px entre la barre SQL et le titre (${ttl - top - 64})`);
  assert.doesNotMatch(video, /#s1 \.sqlp\{top:/, 'même hauteur de barre SQL dans toutes les scènes');
  assert.match(video, /T\.to\('#chap', \{autoAlpha: 0[^)]*\}, 6\.0\);/, 'le chapitre laisse la place aux questions');
  assert.match(video, /T\.fromTo\('#chap', \{autoAlpha: 0\}, \{autoAlpha: 1[^)]*immediateRender: false\}, 67\.05\);/, 'et revient ensuite');
});

test('salaires : une seule carte, la moyenne puis « Avec l’expérience », sans le graphique par ville', () => {
  const h = lire('index.html');
  const carte = h.match(/<div class="panel stat db rv d1" id="salaires">([\s\S]*?)\n        <\/div>\n/);
  assert.ok(carte, 'carte « Salaire » dans les cartes du haut, cible du lien « Salaires »');
  assert.match(carte[1], /<small>Salaire de base moyen<\/small><b><span class="cnt" data-n="44">44<\/span>&nbsp;k€<\/b>/);
  for (const [lo, hi, v, t] of [[20, 40, '40–50', 'Data analyst'], [36, 60, '48–60', 'Senior'], [70, 92, '65–76', 'Responsable']])
    assert.ok(carte[1].includes(`style="--lo:${lo};--hi:${hi}"><span class="xt">${v}&nbsp;k€</span><i><b></b></i><small>${t}</small>`), t);
  /* --lo / --hi sur une échelle de 30 à 80 k€ */
  const k = x => 30 + x / 2;
  assert.deepEqual([[20, 40], [36, 60], [70, 92]].map(([a, b]) => [k(a), k(b)]), [[40, 50], [48, 60], [65, 76]]);
  assert.doesNotMatch(h, /id="cities"|sal-chart|var C=\[\['Paris'|class="fl-mini"|db-range/, 'plus de graphique par ville ni d’ancienne fourchette');
  assert.equal((h.match(/id="salaires"/g) || []).length, 1, 'une seule cible #salaires');
  /* Chaque renvoi de source a sa source, et chaque source est citée */
  const renvois = new Set([...h.matchAll(/href="#(s\d)"/g)].map(m => m[1]));
  const sources = new Set([...h.matchAll(/<li id="(s\d)">/g)].map(m => m[1]));
  assert.deepEqual([...renvois].sort(), [...sources].sort());
  assert.doesNotMatch(css, /\.vcol|\.vc-cols|\.sal-chart|\.fl-mini|\.db-range/, 'styles morts retirés');
});

test('avis : note sans la dernière phrase, Sofia en septembre, du plus récent au plus ancien', () => {
  const h = lire('index.html');
  assert.match(h, /<p class="av-note" id="av-note" hidden>Avis recueillis par Requête auprès de personnes qui utilisent l’appli, publiés avec leur accord et classés du plus récent au plus ancien\.<\/p>/);
  const bloc = h.slice(h.indexOf('var AVIS = ['), h.indexOf('];', h.indexOf('var AVIS = [')));
  const avis = [...bloc.matchAll(/\{prenom:'([^']+)',info:'[^']*',date:'([^']+)'/g)].map(m => [m[1], m[2]]);
  assert.deepEqual(avis.find(a => a[0] === 'Sofia B.'), ['Sofia B.', 'septembre 2026']);
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const rang = d => { const [m, a] = d.split(' '); assert.ok(MOIS.includes(m), d); return +a * 12 + MOIS.indexOf(m); };
  for (let i = 1; i < avis.length; i++) assert.ok(rang(avis[i - 1][1]) >= rang(avis[i][1]), `${avis[i - 1][0]} avant ${avis[i][0]}`);
  assert.match(css, /\.av-track\{--fade:clamp\(32px,10%,96px\);[^}]*padding:22px 20px 64px;[^}]*mask-image:linear-gradient\(90deg,transparent,#000 var\(--fade\)/, 'bords fondus, ombres non coupées');
});

test('programme : les 15 parties sont des modules, comme dans l’appli ; la fiche SQL est un parcours', () => {
  const m = lire('module.html');
  assert.ok(m.includes(`<span class="pp">'+nbChap+' modules</span>`), 'pastille « 15 modules »');
  assert.ok(m.includes(`nb+' cours, '+nbChap+' modules'`) && m.includes(`nbChap+' modules, du plus simple au plus avancé`));
  assert.doesNotMatch(m.replace(/\/\*[\s\S]*?\*\//g, ''), /chapitres|Ce module comprend|Commencer le module|À propos de ce module|Module disponible/);
  assert.match(m, /<p class="label">Ce parcours comprend<\/p>/);
  for (const page of ['index.html', 'module.html', 'mentions-legales.html', 'confidentialite.html', 'conditions.html']) {
    const h = lire(page);
    assert.match(h, /<a href="\.?\/?#modules">Parcours<\/a>/, `${page} : « Parcours » dans la barre`);
    assert.doesNotMatch(h, />Les modules<|>Modules</, `${page} : plus de « Modules » pour la fiche SQL`);
  }
});

test('connexion : le décor tient sur tous les écrans (pas de débordement, pastille ronde à la bonne taille)', () => {
  const h = lire('connexion.html');
  /* Les confettis de l’étiquette « Aperçu » sortaient de l’écran sur mobile (18 px de défilement de côté) */
  assert.match(h, /\.cx-tag::before,\.cx-tag::after\{display:none\}/);
  /* Petits écrans : le collage se règle sur sa largeur ; « Aperçu » passe à gauche, loin du chat */
  const mob = h.slice(h.indexOf('@media (max-width:959px){'), h.indexOf('}\n', h.indexOf('.cx-tag{right:auto;left:22px')) + 2);
  for (const r of ['.cx-stage{container-type:inline-size', '.cx-round{width:clamp(92px,26cqw,104px)', '.cx-masc{--mw:clamp(120px,40cqw,160px)', '.cx-bubble{left:auto;right:22%;top:-34px', '.cx-tag{right:auto;left:22px'])
    assert.ok(mob.includes(r), `mobile : ${r}`);
  /* Ordinateur : le chat se règle sur la largeur et la hauteur du décor ; « GROUP BY » s’efface quand le décor est étroit */
  assert.match(h, /\.cx-stage\{container-type:size\}\n  \.cx-masc\{width:clamp\(150px,min\(34cqw,40cqh\),280px\)\}/);
  assert.match(h, /@container \(max-width:499px\)\{\.k3\{display:none\}\}/);
});

test('langue : bien en vue — dans la barre dès 480 px, en tête du menu sur les petits téléphones ; le français seul actif', () => {
  for (const page of ['index.html', 'module.html', 'mentions-legales.html', 'confidentialite.html', 'conditions.html']) {
    const h = lire(page);
    const sel = h.match(/<div class="lang" data-lang>([\s\S]*?)<\/div><\/div>/);
    assert.ok(sel, `${page} : sélecteur dans la barre`);
    assert.match(sel[1], /<span class="lb-s">FR<\/span><span class="lb-l">Français<\/span>/, `${page} : « FR », ou « Français » en entier sur grand écran`);
    assert.match(sel[1], /<button type="button" class="lang-o on" lang="fr" aria-current="true"><b>FR<\/b>Français/);
    const menu = h.slice(h.indexOf('<nav class="menu" id="menu"'), h.indexOf('</nav>', h.indexOf('<nav class="menu" id="menu"')));
    assert.match(menu, /^<nav class="menu" id="menu" aria-label="Menu" hidden>\n    <div class="lang-row" role="group" aria-label="Langue du site"><p class="lr-h"><svg class="gl"[^>]*>[\s\S]*?<\/svg>Langue du site<\/p>/, `${page} : la langue en tête du menu`);
    assert.ok(menu.includes('<button type="button" class="lang-c on" lang="fr" aria-current="true"><b>FR</b><small>Français</small></button>'), `${page} : français actif`);
    for (const [k, nom] of [['en', 'English'], ['es', 'Español'], ['pt', 'Português']]) {
      assert.match(sel[1], new RegExp(`class="lang-o" lang="${k}" data-soon="[^"]+"><b>${k.toUpperCase()}</b>${nom}<small>Bientôt</small>`), `${page} : ${nom} annoncé dans la barre`);
      assert.ok(menu.includes(`aria-label="${nom} (bientôt)"><b>${k.toUpperCase()}</b><small>${nom}</small></button>`), `${page} : ${nom} dans le menu`);
    }
    assert.ok(h.includes('/* Choix de la langue : le site n’existe qu’en français pour l’instant'), `${page} : script du sélecteur`);
  }
  assert.match(css, /\.lang\{position:relative;display:none\}/);
  assert.match(css, /@media \(min-width:480px\)\{\.lang\{display:block\}\.menu \.lang-row\{display:none\}\}/, 'dans la barre dès 480 px (et plus en double dans le menu)');
  assert.match(css, /@media \(min-width:1100px\)\{\.lang-btn \.lb-s\{display:none\}\.lang-btn \.lb-l\{display:inline\}\}/);
  assert.match(css, /\.menu \.lang-row\{display:grid;[^}]*background:var\(--accent-soft\)/, 'encadré lavande dans le menu');
  assert.doesNotMatch(css, /\.lang-btn \.gl\{display:none\}/, 'le globe reste visible');
});
test('héros : le nouveau texte d’accroche', () => {
  assert.ok(lire('index.html').includes('<p class="lead load l2">65 cours immersifs, un labo SQL interactif et la possibilité d’importer tes propres données. Même si tu n’as jamais codé, tu apprends pas à pas et progresses à ton rythme, en quelques minutes par jour.</p>'));
});

test('héros : la photo est l’avis audio de Sofia, avec les autocollants autour ; voix de synthèse dite dans les mentions légales', () => {
  const h = lire('index.html');
  const hero = h.slice(h.indexOf('<section class="hero"'), h.indexOf('</section>', h.indexOf('<section class="hero"')));
  assert.ok(hero.includes('<div class="ph load l2" id="voix"><img class="ph-img" src="avis/sofia-b.webp" width="640" height="640" alt="Sofia B., Data Analyst junior" fetchpriority="high"><audio preload="none" src="avis/sofia-b.mp3"></audio><p class="sr" id="pv-tx"></p></div>'), 'photo et audio dans le cadre du héros');
  assert.doesNotMatch(hero, /etudiants\.mp4/, 'la vidéo des étudiants est remplacée');
  for (const k of ['<span class="file x">XLSX</span><span class="file c">CSV</span><span class="file s">SQLite</span>', '<span>requete.sql</span>', '<b>Des cas concrets</b>'])
    assert.ok(hero.includes(k), `autocollant gardé : ${k}`);
  /* Plus de section à part, plus de transcription visible ni de mention sous le lecteur */
  assert.doesNotMatch(h, /id="recommandent"|rc-grid|Lire son avis|Voix de synthèse \(ElevenLabs\) · avis réel|class="rc-note"/);
  const bloc = h.slice(h.indexOf('var RECO = ['), h.indexOf('];', h.indexOf('var RECO = [')));
  const recos = [...bloc.matchAll(/\{prenom:'([^']+)',info:'([^']+)',(?:court:'[^']+',)?date:'([^']+)',photo:'([^']+)',mini:'([^']+)',audio:'([^']+)',duree:([\d.]+),\s*onde:\[([^\]]+)\]\}/g)];
  assert.deepEqual(recos.map(r => r[1]), ['Sofia B.', 'Thomas L.', 'Aminata C.'], 'trois avis audio, Sofia d’abord');
  const avis = h.slice(h.indexOf('var AVIS = ['), h.indexOf('];', h.indexOf('var AVIS = [')));
  for (const [, prenom, , date, photo, mini, audio, duree, onde] of recos) {
    for (const f of [photo, mini, audio]) assert.ok(fs.statSync(path.join(root, 'decouvrir', f)).size > 1000, `${prenom} : ${f}`);
    const o = onde.split(',').map(Number);
    assert.equal(o.length, 48, `${prenom} : 48 barres d’onde`);
    assert.ok(o.every(x => x > 0 && x <= 1), `${prenom} : hauteurs entre 0 et 1`);
    assert.ok(+duree > 5 && +duree < 60, `${prenom} : durée`);
    assert.ok(avis.includes(`{prenom:'${prenom}',`) && avis.includes(`date:'${date}'`), `${prenom} : même avis écrit (lu aux lecteurs d’écran) et même date`);
  }
  assert.ok(h.includes("tx.textContent='Avis de '+r.prenom+', '+r.info+', '+r.date+' : « '+texte(r)+' »';"), 'texte de l’avis pour les lecteurs d’écran');
  assert.ok(h.includes('<button type="button" class="pv-play" aria-pressed="false" aria-describedby="pv-tx">'), 'bouton lecture relié au texte');
  assert.match(css, /\.ph-voice\{position:absolute;left:12px;right:12px;bottom:var\(--pv-b,44px\)/, 'lecteur posé dans la photo');
  assert.match(css, /@media \(min-width:700px\) and \(max-width:1099px\)\{\.cases\{display:none\}\}/, '« Des cas concrets » ne couvre ni le lecteur ni le visage');
  const ml = lire('mentions-legales.html');
  assert.ok(ml.includes('<li><a href="#avis">Avis des utilisateurs</a></li>'), 'sommaire des mentions légales');
  assert.match(ml, /<section id="avis"><h2>Avis des utilisateurs<\/h2>[\s\S]*?Les <b>avis audio<\/b> en haut de la page d’accueil sont lus par une <b>voix de synthèse<\/b> générée avec ElevenLabs/);
});
test('plus de point avant les tracés animés : le trait reste caché jusqu’au départ de son dessin', () => {
  assert.match(css, /@keyframes draw\{from\{opacity:1\}to\{stroke-dashoffset:0;opacity:1\}\}/);
  const starts = [...css.matchAll(/([^\n{}]+)\{stroke-dasharray:(?:1|24);stroke-dashoffset:(?:1|24);([^}]*)\}/g)];
  assert.ok(starts.length >= 4, 'soulignement du titre, coches, icône de connexion, flèche');
  for (const m of starts) assert.match(m[2], /^opacity:0/, `${m[1].trim()} : opacity:0 tant que le dessin n’a pas commencé`);
});

test('« Se connecter » partout à la place de « Ouvrir l’appli », et la carte d’avis n’est plus coupée en bas', () => {
  for (const page of ['index.html', 'module.html', 'mentions-legales.html', 'confidentialite.html', 'conditions.html']) {
    const h = lire(page);
    assert.doesNotMatch(h, /Ouvrir l’appli/, `${page} : plus de « Ouvrir l’appli »`);
    const menu = h.slice(h.indexOf('<nav class="menu" id="menu"'), h.indexOf('</nav>', h.indexOf('<nav class="menu" id="menu"')));
    assert.ok(menu.includes('<a class="btn btn-s btn-lg" href="connexion.html">Se connecter</a>'), `${page} : bouton du menu`);
  }
  /* .avis coupait tout ce qui dépassait, y compris l’ombre de sa dernière carte : on ne coupe plus que sur les côtés */
  assert.match(css, /@supports \(overflow:clip\)\{\.avis\{overflow:visible;overflow-x:clip\}\}/);
});

test('avis : Aminata C. (même personne que l’ancien avis « En reconversion »), photos sur les trois cartes écrites', () => {
  const h = lire('index.html');
  assert.doesNotMatch(h, /Julie K\./, 'un seul nom pour un même avis');
  const bloc = h.slice(h.indexOf('var AVIS = ['), h.indexOf('];', h.indexOf('var AVIS = [')));
  const avis = [...bloc.matchAll(/\{prenom:'([^']+)',info:'([^']+)',date:'([^']+)',photo:'([^']+)',note:5,/g)].map(m => [m[1], m[2], m[4]]);
  assert.deepEqual(avis.map(a => a[0]), ['Thomas L.', 'Aminata C.', 'Sofia B.'], 'du plus récent au plus ancien');
  assert.deepEqual(avis.find(a => a[0] === 'Aminata C.').slice(0, 2), ['Aminata C.', '35 ans, en reconversion data']);
  for (const [p, , photo] of avis) assert.ok(fs.statSync(path.join(root, 'decouvrir', photo)).size > 1000, `${p} : ${photo}`);
  /* Les pastilles du héros : une par avis audio, vignettes légères ; plus petites quand la photo est étroite */
  assert.ok(h.includes(`pick.innerHTML=list.map(function(x,j){return '<button type="button" aria-pressed="false" aria-label="Témoignage de '+esc(x.prenom)+'"><img src="'+esc(x.mini||x.photo)+'"`));
  assert.match(css, /@container \(max-width:470px\)\{[^\n]*\.pv-pick\{left:10px;top:10px;gap:4px;padding:3px\}\.pv-pick button\{width:28px;height:28px\}/);
});

test('témoignages : des flèches pour passer de l’un à l’autre (bords de la photo, ou autour du bouton lecture si elle est étroite)', () => {
  const h = lire('index.html');
  /* Dans le lecteur : ‹ lecture › (seulement s’il y a plusieurs avis) */
  assert.ok(h.includes(`bar.innerHTML='<div class="pv-btns">'+(plusieurs?'<button type="button" class="pv-nav pv-in pv-prev">'+FL(0)+'</button>':'')+'<button type="button" class="pv-play"`));
  assert.ok(h.includes(`+(plusieurs?'<button type="button" class="pv-nav pv-in pv-next">'+FL(1)+'</button>':'')+'</div>'`));
  /* Sur les bords de la photo */
  assert.ok(h.includes(`b.className='pv-nav pv-side '+(j?'pv-next':'pv-prev')`));
  /* Toutes les flèches tournent en boucle et disent vers qui elles mènent */
  assert.ok(h.includes(`montrer((cur+(b.classList.contains('pv-next')?1:list.length-1))%list.length)`));
  assert.ok(h.includes(`b.setAttribute('aria-label',(nx?'Témoignage suivant : ':'Témoignage précédent : ')+list[(i+(nx?1:n-1))%n].prenom)`));
  /* Glisser du doigt sur la photo */
  assert.ok(h.includes(`if(Math.abs(dx)>44&&Math.abs(dy)<Math.abs(dx)*.6)montrer(`));
  assert.match(css, /\.ph\{touch-action:pan-y\}/);
  /* Photo étroite : les flèches des bords laissent la place à celles du lecteur */
  assert.match(css, /@container \(max-width:470px\)\{\.pv-side\{display:none\}\.pv-in\{display:grid;/);
  assert.match(css, /\.pv-in\{display:none;/);
  assert.match(css, /\.pv-next\{animation:pvNudge 1s ease-in-out 2\.6s 3\}/, 'la flèche « suivant » fait signe trois fois');
});

test('témoignages : « Ils recommandent » dans le lecteur, pour montrer que ce sont des avis d’utilisateurs', () => {
  const h = lire('index.html');
  assert.ok(h.includes(`+'<div class="pv-main"><p class="pv-cap"><svg viewBox="0 0 24 24" aria-hidden="true">`), 'au-dessus du prénom, dans le lecteur');
  assert.ok(h.includes('<span>Ils recommandent</span><span class="pv-cap-r">&nbsp;Requête</span></p>'));
  assert.ok(h.includes(`bar.setAttribute('aria-label','Témoignage audio de '+r.prenom+', utilisateur de Requête');`), 'dit aussi aux lecteurs d’écran');
  /* Photo étroite : « Requête » puis l’étoile s’effacent, le libellé n’est jamais coupé */
  assert.match(css, /@container \(max-width:470px\)\{[^\n]*\.pv-cap-r\{display:none\}/);
  assert.match(css, /@container \(max-width:300px\)\{\.pv-cap svg\{display:none\}/);
});

test('« cas pratiques » à la place de « défis métier » sur la vitrine, la vidéo et les pages légales', () => {
  const pages = ['index.html', 'module.html', 'connexion.html', 'video.html', 'mentions-legales.html', 'confidentialite.html', 'conditions.html', 'modules.js'];
  for (const f of pages) assert.doesNotMatch(lire(f), /[Dd]éfis? métier/, `${f} : plus de « défis métier »`);
  assert.match(lire('index.html'), /<li>25 cas pratiques<\/li>/, 'ce qui est inclus');
  assert.match(lire('index.html'), /<h3>Cas pratiques et révisions<\/h3>/);
  assert.match(lire('connexion.html'), /<span class="sticker sun">25 cas pratiques<svg/, 'autocollant de la page de connexion');
  const v = lire('video.html');
  assert.ok(v.includes('<span>Des <em>cas pratiques</em>,</span>'), 'titre de la scène');
  assert.ok(v.includes("[101.5, 'Cas pratiques']"), 'chapitre');
  assert.ok(v.includes('<div class="stk sun" id="stk-df">25 cas pratiques<svg'), 'autocollant de la vidéo');
  assert.ok(v.includes('<b>25 cas pratiques</b>'), 'tuile des fonctionnalités');
  assert.ok(v.includes('<div class="df-stamp" id="df-stamp">Cas résolu&nbsp;!</div>'));
  /* Le défi entre amis est une autre fonction de l’appli : il garde son nom */
  assert.match(lire('index.html'), /des défis SQL à lancer entre amis/);
});

test('contact : « Donner mon avis » affiche les étoiles (pas de « Ma note » écrit dans le message)', () => {
  const h = lire('index.html');
  const fs_ = h.match(/<fieldset class="ct-rate" id="ctrate" hidden>([\s\S]*?)<\/fieldset>/);
  assert.ok(fs_, 'étoiles dans le formulaire, cachées par défaut');
  assert.match(fs_[1], /<legend>Ta note<\/legend>/);
  for (let n = 1; n <= 5; n++)
    assert.ok(fs_[1].includes(`<input type="radio" name="note" value="${n}">`) && fs_[1].includes(`<span class="sr">${n} étoile${n > 1 ? 's' : ''} sur 5</span>`), `étoile ${n}`);
  /* Visibles seulement pour « Donner mon avis », avec un libellé de message adapté */
  assert.ok(h.includes(`var majSujet=function(){var a=estAvis();rate.hidden=!a;lbl.textContent=a?'Ton avis, en quelques mots':'Ton message';majDrop();};`));
  /* La note touchée dans « Et toi, tu en penses quoi ? » est cochée dans le formulaire, le message reste vide */
  assert.ok(h.includes(`var nr=note&&f.querySelector('input[name=note][value="'+note+'"]');if(nr){nr.checked=true;nr.dispatchEvent(new Event('change',{bubbles:true}));}`));
  assert.doesNotMatch(h, /ta\.value='Ma note/, 'plus de « Ma note » écrit dans la zone de texte');
  /* La note part quand même en tête du message envoyé */
  assert.ok(h.includes(`var corps=(n?'Ma note : '+n+'/5\\n\\n':'')+msg+`));
  assert.match(css, /\.ct-stars label\.on svg path\{fill:var\(--sun\);stroke:var\(--ink\)\}/);
});

/* Elisa, 30 octobre, 17 h 02 : « pouvoir mettre pièces jointes image fichier ». */
test('contact : pièces jointes (images et fichiers), choisies, glissées ou collées, sans serveur', () => {
  const h = lire('index.html');
  assert.ok(h.includes('<input type="file" id="ctfile" multiple accept="image/*,.pdf,.txt,.csv,.tsv,.xls,.xlsx,.json,.sql,.sqlite,.sqlite3,.db">'), 'plusieurs fichiers : images, PDF, tableurs, SQLite');
  assert.ok(h.includes('<b id="ctdropt">Ajouter une image ou un fichier</b>') && h.includes("dropT.textContent=capt?'Ajouter une capture d’écran':'Ajouter une image ou un fichier';"), 'une capture pour un bug ou un problème de connexion');
  assert.ok(h.includes("if(PJ.length>=5){refus=refus||'5 fichiers au plus") && h.includes("if(file.size>10e6){refus=refus||'« '+file.name+' » dépasse 10\\u00a0Mo.'"), 'limites : 5 fichiers, 10 Mo');
  assert.ok(h.includes("drop.addEventListener('drop',function(e){if(e.dataTransfer&&e.dataTransfer.files.length)ajouterPJ(e.dataTransfer.files);});"), 'glisser-déposer');
  assert.ok(h.includes("if(fs&&fs.length&&!cd.getData('text/plain')){e.preventDefault();var avant=PJ.length;ajouterPJ(fs);"), 'une capture collée dans le message devient une pièce jointe (le texte collé reste du texte)');
  assert.ok(h.includes("x.setAttribute('aria-label','Retirer '+file.name);"), 'chaque fichier se retire');
  /* L’envoi : la feuille de partage de l’appareil reçoit les fichiers ; sinon la messagerie, qui rappelle les fichiers à joindre */
  assert.ok(h.includes("if(CONTACT_EMAIL&&PJ.length&&navigator.canShare&&navigator.share&&navigator.canShare({files:PJ})){") && h.includes("navigator.share({title:'[Requête] '+sujet,text:'À envoyer à '+CONTACT_EMAIL+'\\n\\n'+corps,files:PJ})"), 'partage avec les fichiers');
  assert.ok(h.includes("(PJ.length?'\\n\\nPièces jointes : '+noms:'')") && h.includes('avant d’envoyer.'), 'le message nomme les fichiers');
  assert.ok(h.includes('Ton prénom, ton e-mail, ton message et tes fichiers servent seulement à te répondre.'), 'mention sous le formulaire');
  assert.ok(lire('confidentialite.html').includes('ton message et les fichiers que tu y joins (captures d’écran, documents), seulement pour te répondre.'), 'politique de confidentialité');
  assert.match(css, /\.ct-drop\{position:relative;display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:16px;border:2px dashed #D3C8FF;/);
  assert.match(css, /@media \(hover:none\)\{\.ct-drop-pc\{display:none\}\}/, 'sur téléphone, pas d’invitation à glisser des fichiers');
});

/* Elisa, 30 octobre, 17 h 02, puis 20 h 01 : « Et si le prochain était vers la data ? » (le prochain pas, après « sauter le pas ») */
test('vidéo : « Et si le prochain était vers la data ? », sur deux lignes, sans toucher la source', () => {
  assert.ok(video.includes('<p class="abs" id="rc-link">Et si le prochain<br>était vers la <em>data</em>&nbsp;?</p>'), 'au tutoiement de la vidéo');
  assert.ok(video.includes('selon France Stratégie. Et si le prochain était vers la data ?'), 'texte lu par VoiceOver');
  assert.doesNotMatch(video, /Et si c’était la|Et si ton prochain pas/);
  const top = id => +video.match(new RegExp(`#${id}\\{left:\\d+px;top:(\\d+)px`))[1];
  assert.ok(top('rc-link') + 2 * 52 * 1.1 + 12 < top('src'), 'deux lignes au-dessus de la ligne de source');
  assert.ok(top('rc-cap') + 2 * 50 * 1.2 < top('rc-link'), 'sous « Près d’1 actif sur 2 envisage de sauter le pas. »');
});

/* Elisa, 30 octobre, 17 h 10 : scène « Requête » (« Apprends le SQL maintenant. ») et scène « Fonctionnalités »
   (« Du premier SELECT aux requêtes avancées, progresse à ton rythme. ») : Requête ne propose pas seulement des
   cours, c’est tout un environnement pour apprendre et pratiquer le SQL. */
test('vidéo : « Apprends le SQL maintenant. » puis les neuf tuiles des fonctionnalités, au-dessus des boutons de fin', () => {
  const scene = id => { const i = video.indexOf(`<section class="scene" id="${id}">`); return video.slice(i, video.indexOf('</section>', i)); };
  const s8 = scene('s8'), s9 = scene('s9');
  assert.ok(s8.includes('<h2 class="ttl"><span class="mask"><span>Apprends le SQL</span></span><span class="mask"><span><em>maintenant</em>.</span></span></h2>'), 'titre');
  assert.ok(s8.includes('<p class="abs sub">Pratique sur de vraies<br>données avec <b>Requête</b>.</p>'), 'sous-titre');
  assert.ok(s8.includes('L’app, pensée pour les futurs data analysts.</p>'), 'accroche (Elisa, 20 h 41 : « L’app, pensé pour les futurs data analysts »)');
  assert.doesNotMatch(video, /1<sup>re<\/sup> application|1re application/, 'plus de « 1re application des data analysts »');
  assert.ok(s9.includes('<span>Du premier <code>SELECT</code></span>') && s9.includes('<span>aux requêtes <em>avancées</em>,</span>'), 'titre');
  assert.ok(s9.includes('<p class="abs sub">progresse à ton rythme.</p>'), 'la phrase continue sous le titre');
  const tuiles = [...s9.matchAll(/<div class="ft(?: more)?">.*?<b>(.*?)<\/b><\/div>/g)].map(m => m[1]);
  assert.deepEqual(tuiles, ['65 cours immersifs', 'Un labo&nbsp;SQL interactif', '25 cas pratiques', 'Importe tes propres données',
    '30 questions d’entretien', 'Cartes mémo &amp; stickers', 'Défie tes amis', 'Ta série de jours',
    'Et bien plus encore<small>Découvre-les maintenant&nbsp;!</small>']);
  /* Quatre rangées de deux, puis « Et bien plus encore » sur toute la largeur (Elisa, 20 h 01 : « tout est tassé »).
     Sur ordinateur et tablette (cadre d’au moins 420 px), des tuiles hautes et espacées, finies avant 1 020 px : les deux
     boutons de fin, côte à côte, commencent vers 1 160 px. Sur téléphone, plus serrées, finies avant 880 px : les boutons
     empilés commencent vers 945 px sur un écran de 320 px, 1 010 px sur 390 px. */
  assert.match(video, /\.ft\.more\{grid-column:1\/-1;/);
  const fin = (top, gap, h, hm) => top + 4 * h + 4 * gap + hm;
  const grand = fin(+video.match(/#feat\{left:80px;top:(\d+)px;/)[1], +video.match(/#feat\{[^}]*gap:(\d+)px /)[1],
    +video.match(/\.ft\{position:relative;overflow:hidden;height:(\d+)px;/)[1], +video.match(/\.ft\.more\{grid-column:1\/-1;height:(\d+)px;/)[1]);
  assert.ok(grand <= 1020, `ordinateur : les tuiles finissent à ${grand} px`);
  const tel = video.slice(video.indexOf('@container cadre (max-width:419.98px){'), video.indexOf('\n}', video.indexOf('@container cadre (max-width:419.98px){')));
  const petit = fin(+tel.match(/#feat\{top:(\d+)px;/)[1], +tel.match(/#feat\{top:\d+px;gap:(\d+)px\}/)[1], +tel.match(/\.ft\{height:(\d+)px;/)[1], +tel.match(/\.ft\.more\{height:(\d+)px\}/)[1]);
  assert.ok(petit <= 880, `téléphone : les tuiles finissent à ${petit} px`);
  assert.ok(video.includes('#frame{container:cadre/inline-size}'), 'le cadre de la vidéo est un conteneur');
  assert.match(video, /@container cadre \(min-width:420px\)\{\s*#end\{flex-direction:row;/, 'boutons côte à côte sur un grand cadre');
  /* À la fin : micro-animations (les icônes sautent l’une après l’autre, « Et bien plus encore » brille, « Commencer » scintille) */
  assert.match(video, /#frame:has\(#end\.on\) \.ft \.ico\{animation:ftHop /);
  assert.match(video, /#frame:has\(#end\.on\) \.ft\.more::after\{animation:ftShine /);
  assert.match(video, /#end\.on a::after\{animation:ctaShine /);
  assert.match(video, /#end\.on a,#end\.on button\{animation:endPop [^}]*backwards\}/, 'l’entrée ne bloque pas le survol');
  /* Texte lu par VoiceOver */
  assert.ok(video.includes("'Apprends le SQL maintenant. Pratique sur de vraies données avec Requête. L’app, pensée pour les futurs data analysts. Des cours interactifs"));
  assert.ok(video.includes("'Du premier SELECT aux requêtes avancées, progresse à ton rythme. 65 cours immersifs, un labo SQL interactif, 25 cas pratiques."));
});

/* Elisa, 30 octobre, 17 h 31 : un écran d’onboarding avec des logos de Harvard, Stanford et Emory (« est-ce qu’on peut
   intégrer qchose comme ça dans la vidéo ? »). Pas de logos d’universités : Requête n’a aucun lien avec elles. À la place,
   17 h 56 (« oui ») : une scène « Une méthode qui s’appuie sur la recherche », juste après la démo, avec trois résultats
   publiés, leur source, et ce que fait Requête. La vidéo passe à 2 min 10. */
test('vidéo : la scène « La méthode » cite ses sources, sans logo d’université, et suit le calendrier des révisions de l’appli', () => {
  const i = video.indexOf('<section class="scene" id="sme">'), sc = video.slice(i, video.indexOf('</section>', i));
  assert.ok(i > video.indexOf('<section class="scene" id="s8">') && i < video.indexOf('<section class="scene" id="sdf">'), 'entre la démo et les cas pratiques');
  assert.doesNotMatch(sc, /<img|Harvard|Stanford|Emory|Yale|Oxford|Cambridge|Sorbonne|MIT\b/, 'aucun logo ni nom d’université');
  /* Elisa, 30 octobre, 20 h 01 : « on ne voit pas ce qu’il y a écrit, c’est flou », puis ses textes, mot pour mot */
  assert.ok(sc.includes('<span>Une méthode fondée</span></span><span class="mask"><span>sur la <em>recherche</em>.</span>'), 'titre');
  const txt = h => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
  const cartes = [...sc.matchAll(/<div class="me-c">([\s\S]*?)\n      <\/div>/g)].map(m => [m[1].match(/<h3>([^<]+)<\/h3>/)[1],
    txt(m[1].match(/<p class="me-r">([\s\S]*?)<\/p>/)[1]).replace(/^>_/, ''), txt(m[1].match(/<p class="me-s">([\s\S]*?)<\/p>/)[1])]);
  assert.deepEqual(cartes, [
    ['Pratiquer plutôt qu’écouter', 'Tu écris et tu exécutes de vraies requêtes.', 'L’apprentissage actif améliore les résultats par rapport à un cours uniquement magistral.'],
    ['Se tester avant de voir la réponse', 'Tu cherches d’abord, puis tu découvres la solution.', 'Se tester régulièrement fait partie des techniques d’apprentissage les plus efficaces.'],
    ['Réviser au bon moment', 'Tu retrouves les notions à intervalles réguliers :', 'Espacer les révisions aide à mieux retenir sur la durée.']]);
  assert.ok(sc.includes('<b><span id="me-x15">1,5</span>×</b><p>plus de risques d’échouer avec un enseignement magistral qu’avec un apprentissage actif.</p>'));
  assert.doesNotMatch(sc, /me-n|Environ 6|184&nbsp;articles|<small>/, 'plus de petits chiffres sous les cartes');
  /* Des textes lisibles même quand la vidéo est petite : 23 px au moins dans l’image de 1 080 px */
  const st = video.slice(video.indexOf('/* S8b · La méthode'), video.indexOf('#sdf .ttl,#sdt .ttl{'));
  for (const sel of ['.me-h h3', '.me-r', '.me-s', '.me-jl .jj', '#me-x p']) {
    const px = +st.match(new RegExp(sel.replace(/[.#]/g, '\\$&') + '\\{[^}]*font:\\d+ (\\d+)px'))[1];
    assert.ok(px >= 23, `${sel} : ${px} px`);
  }
  /* Sept secondes pour la lire ; la suite décalée */
  assert.ok(video.includes("[82, 'Requête'], [94.5, 'La méthode'], [101.5, 'Cas pratiques']"), 'chapitre de 7 secondes');
  assert.match(video, /scene\('sme', 94\.5, 101\.5\);/);
  assert.match(video, /scene\('sdf', 101\.5, 111\.5\);/, 'la suite décalée');
  assert.match(video, /const DURATION = 134\.5;/);
  /* Les sources : dans la ligne du bas, et avec leurs chiffres dans le panneau « Sources » */
  assert.ok(video.includes("[94.5, 'Sources : <b>Freeman et al.</b>, PNAS, 2014 · <b>Dunlosky et al.</b>, Psychological Science in the Public Interest, 2013 · <b>Cepeda et al.</b>, Psychological Bulletin, 2006.'],\n  [101.5, '']"), 'ligne de source');
  for (const doi of ['10.1073/pnas.1319030111', '10.1177/1529100612453266', '10.1037/0033-2909.132.3.354'])
    assert.ok(video.includes(`<a href="https://doi.org/${doi}" target="_blank" rel="noopener">`), `panneau Sources : ${doi}`);
  assert.ok(video.includes('méta-analyse de 225 études, cours de sciences à l’université') && video.includes('317 expériences tirées de 184 articles'));
  assert.match(video, /T\.fromTo\(P, \{x15: 1\}, \{x15: 1\.5,/, 'le compteur s’arrête à 1,5');
  assert.doesNotMatch(video, /\{m1: 225|\{m3: 317/);
  /* Ce que fait Requête : le calendrier des révisions est celui de l’appli (INTERVALS) */
  const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const INTERVALS = JSON.parse(app.match(/const INTERVALS=(\[[\d,]+\]);/)[1]);
  assert.deepEqual([...sc.matchAll(/<span class="jj">J\+(\d+)<\/span>/g)].map(m => +m[1]), INTERVALS);
  assert.ok(video.includes('à intervalles réguliers, à J+1, J+3, J+7, J+21 et J+60'), 'texte lu par VoiceOver');
  assert.ok(video.includes('Les résultats de recherche viennent d’études publiées, pas d’une mesure faite sur Requête.'), 'précision dans le panneau Sources');
});

/* Elisa, 30 octobre, 20 h 01 : « met dans la vidéo : défie tes amis (sur les cas pratiques) ». Après « Cas résolu ! », la
   salle de défi de l’appli sur le même cas : son code, « le plus rapide gagne », le classement de la manche (médailles,
   pseudos, temps, points), et les réactions des amis. Depuis le 31 octobre (1 h 34), les points sont ceux de la salle :
   100 pour la réussite, +50, +30, +15 aux trois premiers, et jusqu’à +60 de rapidité ; le chrono s’écrit 00:00. */
test('vidéo : défie tes amis sur le cas pratique, comme la salle de défi de l’appli', () => {
  const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const i = video.indexOf('<section class="scene" id="sdf">'), sc = video.slice(i, video.indexOf('</section>', i));
  const d = sc.slice(sc.indexOf('<div class="abs" id="duel">'));
  assert.ok(sc.indexOf('id="df-stamp"') < sc.indexOf('id="duel"'), 'après le cas résolu');
  assert.ok(d.includes('<b>Défie tes amis</b>') && d.includes('<p class="du-sub">Même cas, même chrono&nbsp;: le plus rapide gagne.</p>'), 'Elisa, 20 h 41');
  assert.ok(app.includes('chacun résout ce défi au même moment, le plus rapide gagne.'), 'la règle de l’appli');
  const code = d.match(/<span class="du-code">Salle <b>([A-Z0-9]+)<\/b><\/span>/)[1], ALPH = app.match(/const JEU_ALPH='([A-Z0-9]+)';/)[1];
  assert.ok(code.length === 6 && [...code].every(c => ALPH.includes(c)), `code de salle ${code}, comme ceux de l’appli`);
  const rangs = [...d.matchAll(/<li(?: class="me")?><span class="du-md">(.)(?:.)?<\/span><span class="du-av"[^>]*>.<\/span><b>([^<]+)<\/b><em class="du-t">(\d\d:\d\d)<\/em><small>\+(\d+)<\/small>/gu)]
    .map(m => [m[2], m[3], +m[4]]);
  assert.deepEqual(rangs, [['Toi', '01:12', 186], ['Inès', '01:31', 159], ['Hugo', '01:48', 139]]);
  /* Les points de l’appli, recalculés : réussite + rang + rapidité (1 point de moins toutes les 3 s, plafonné) */
  const [, OK, RANG, VITE] = app.match(/const JEU_PTS_OK=(\d+),JEU_PTS_RANG=(\[[\d,]+\]),JEU_PTS_VITE=(\d+);/), ROUND = +app.match(/const JEU_ROUND_MS=(\d+);/)[1];
  assert.ok(app.includes('function jeuSpeedPts(ms){return Math.max(0,Math.min(JEU_PTS_VITE,Math.floor((JEU_ROUND_MS-ms)/3000)));}'));
  assert.deepEqual([72, 91, 108].map((s, i) => +OK + JSON.parse(RANG)[i] + Math.max(0, Math.min(+VITE, Math.floor((ROUND - s * 1000) / 3000)))), [186, 159, 139], 'points de l’appli');
  assert.ok(app.includes("<em>${jeuChrono(x.ms)}</em><small>+${x.pts}</small>"), 'la ligne de l’appli : le temps, puis les points gagnés');
  assert.ok(video.includes('const meX = $(\'#me-x15\'), duT = $$(\'#duel .du-t\'), DUS = [72, 91, 108];'), 'les temps montent jusqu’à 01:12, 01:31 et 01:48');
  assert.ok(video.includes("e.textContent = String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');"), 'le chrono s’écrit comme dans l’appli');
  /* Dans la scène des cas pratiques, entre le tampon et la fin de la scène */
  const at = sel => +video.match(new RegExp(`rise\\('${sel}', ([\\d.]+)`))[1];
  assert.ok(at('#duel') > 105.9 && at('#duel') < 110.5);
  assert.ok(video.includes('Et défie tes amis : même cas, même chrono, le plus rapide gagne.'), 'texte lu par VoiceOver');
  /* Elisa, 20 h 41 : l’énoncé du cas réécrit ; c’est celui de l’appli, mot pour mot, en deux temps : la question, puis la consigne */
  const q = app.match(/titre:"Le meilleur client",niv:'\w',q:"([^"]+)"/)[1], vu = t => t.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
  assert.equal(q, 'Quel client a commandé le plus d’unités ? Affiche son prénom et le nombre total d’unités commandées, du plus élevé au plus faible.');
  assert.equal(vu(sc.match(/<p class="df-q">([^<]+)<\/p>/)[1]) + ' ' + sc.match(/<p class="df-i">([^<]+)<\/p>/)[1], q, 'la vidéo montre l’énoncé de l’appli');
  assert.ok(video.includes('« Quel client a commandé le plus d’unités ? »'), 'texte lu par VoiceOver');
});

/* Elisa, 30 octobre, 18 h 05 : « le message n’est pas actualisé avec le nombre de fichiers ». Avec 4 fichiers, la page disait
   encore « 5 fichiers au plus » : le message d’erreur restait après qu’on avait retiré un fichier. Désormais la zone donne le
   compte (« 4 fichiers sur 5 »), se ferme à 5, et un message sur les pièces jointes s’efface dès que la liste change. */
test('contact : la zone des pièces jointes compte les fichiers, et le message suit la liste', async () => {
  const vm = await import('node:vm');
  const h = lire('index.html');
  assert.ok(h.includes('<small id="ctdrops">Capture d’écran, PDF, CSV… jusqu’à 5 fichiers de 10&nbsp;Mo.'), 'aide de la zone, réécrite avec le compte');
  assert.ok(h.includes("x.addEventListener('click',function(){PJ.splice(i,1);oubliePJ();peindrePJ();"), 'retirer un fichier efface le message sur les pièces jointes');
  assert.ok(h.includes('    oubliePJ();\n    if(refus)direPJ(refus,\'ko\');'), 'chaque ajout repart d’un message à jour');
  assert.ok(h.includes("    majDrop();\n  };"), 'la zone se redessine avec la liste');
  assert.ok(h.includes("'capture-'+(++nCapt)+'.'"), 'deux captures collées ne prennent jamais le même nom');
  assert.match(css, /\.ct-drop\.full,\.ct-drop\.full:hover\{cursor:default;/, 'zone fermée à 5 fichiers');
  /* La zone, exécutée seule : 0, 1, 4 et 5 fichiers, sujet ordinaire ou « bug » */
  const src = h.slice(h.indexOf("  var poids=function(o){"), h.indexOf("  var majSujet=function(){"));
  const cls = new Set(), dropT = {textContent: ''}, dropS = {textContent: '', innerHTML: ''}, pjIn = {disabled: false};
  let sujet = 'Une question';
  const ctx = vm.createContext({PJ: [], AIDE: 'AIDE', dropT, dropS, pjIn,
    drop: {classList: {toggle: (c, on) => on ? cls.add(c) : cls.delete(c)}},
    f: {querySelector: () => ({value: sujet})}});
  vm.runInContext(src.replace(/\bvar /g, 'this.'), ctx);
  const zone = n => { ctx.PJ = Array.from({length: n}, () => ({size: 400e3})); vm.runInContext('this.PJ = PJ; majDrop()', ctx); return [dropT.textContent, n ? dropS.textContent : dropS.innerHTML, cls.has('full'), pjIn.disabled]; };
  assert.deepEqual(zone(0), ['Ajouter une image ou un fichier', 'AIDE', false, false]);
  assert.deepEqual(zone(1), ['Ajouter un autre fichier', '1 fichier sur 5 (400\u00a0Ko). Tu peux encore en ajouter 4.', false, false]);
  assert.deepEqual(zone(4), ['Ajouter un autre fichier', '4 fichiers sur 5 (1,6\u00a0Mo). Tu peux encore en ajouter 1.', false, false]);
  assert.deepEqual(zone(5), ['5 fichiers sur 5', 'C’est le maximum\u00a0: retire un fichier pour en ajouter un autre.', true, true]);
  sujet = 'Signaler un bug';
  assert.deepEqual(zone(0).slice(0, 1), ['Ajouter une capture d’écran']);
  assert.deepEqual(zone(2).slice(0, 2), ['Ajouter une autre capture', '2 fichiers sur 5 (800\u00a0Ko). Tu peux encore en ajouter 3.']);
});

/* Elisa, 30 octobre, 18 h 05 (sur la page de la vidéo) : « mettre un bouton se connecter ». */
test('vidéo : « Se connecter » dans la barre du haut, qui mène au formulaire de connexion', () => {
  const bar = video.slice(video.indexOf('<div class="bar top">'), video.indexOf('</div>', video.indexOf('<div class="bar top">')));
  const liens = [...bar.matchAll(/<a class="pill[^"]*" href="([^"]+)"(?: aria-label="([^"]+)")?>/g)].map(m => [m[1], m[2] || '']);
  assert.deepEqual(liens, [['./', 'Retour'], ['connexion.html#cx-form', ''], ['connexion.html', 'Passer la vidéo']]);
  assert.match(bar, /<a class="pill login" href="connexion\.html#cx-form"><svg class="me"[^>]*aria-hidden="true">.*?<\/svg>Se connecter<\/a>/s, 'icône et texte « Se connecter »');
  assert.ok(lire('connexion.html').includes('<form class="cx-card" id="cx-form"'), 'le formulaire de connexion existe');
  /* Sur téléphone, les trois boutons tiennent : « Retour » en flèche, « Passer la vidéo » en « Passer », « Se connecter » écrit */
  assert.match(video, /@media \(max-width:460px\)\{\.bar-r\{gap:8px\}\.pill\{padding:0 13px\}\.pill \.lg\{display:none\}\.pill\.back\{width:44px;/);
  assert.ok(bar.includes('<span class="lg">Retour</span>') && bar.includes('<span>Passer<span class="lg">&nbsp;la vidéo</span></span>'));
});


/* Elisa, 30 octobre, 19 h 48 : sous « Ton objectif ? », « centré mieux formaté » ; les avis : « l’image et l’avis grossissent
   puis rapetissent quand ça passe à l’autre » ; dans la barre du haut : « supprimer Salaires ». */
test('« Salaires » n’est plus dans les menus (barre du haut, menu du téléphone, pieds de page) ; la carte reste', () => {
  for (const page of ['index.html', 'module.html', 'mentions-legales.html', 'confidentialite.html', 'conditions.html'])
    assert.doesNotMatch(lire(page), /<a href="(?:\.\/)?#salaires">Salaires<\/a>/, page);
  const h = lire('index.html'), nav = h.slice(h.indexOf('<nav class="links"'), h.indexOf('</nav>', h.indexOf('<nav class="links"')));
  assert.deepEqual([...nav.matchAll(/<a href="#(\w+)">([^<]+)<\/a>/g)].map(m => m[2]), ['Parcours', 'Pourquoi le SQL', 'Questions']);
  assert.equal((h.match(/id="salaires"/g) || []).length, 1, 'la carte « Salaire » est toujours dans « Pourquoi le SQL »');
});

test('sous « Ton objectif ? » : le lien et les trois promesses sont centrés, en trois colonnes égales sur téléphone', () => {
  const h = lire('index.html');
  /* Le lien passe sur deux lignes entières (« Pas encore sûr·e ? » puis « Découvre les parcours ↓ »), jamais au milieu */
  assert.match(h, /<a class="pick-alt" href="#modules"><span>Pas encore sûr·e&nbsp;\?<\/span> <span>Découvre les parcours<svg[^>]*aria-hidden="true">/);
  assert.match(css, /\.pick-alt\{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;[^}]*text-align:center\}/);
  assert.match(css, /\.pick-alt span\{display:inline-flex;align-items:center;gap:6px;white-space:nowrap\}/);
  /* Les promesses : centrées sous la carte (même largeur qu’elle), coupées toutes au même endroit sur téléphone */
  const tr = h.slice(h.indexOf('<ul class="trust'), h.indexOf('</ul>', h.indexOf('<ul class="trust')));
  assert.deepEqual([...tr.matchAll(/<\/svg><span><span>([^<]+)<\/span> <span>([^<]+)<\/span><\/span><\/li>/g)].map(m => [m[1], m[2]]),
    [['Dès 10&nbsp;min', 'par jour'], ['Rien à', 'installer'], ['Même', 'hors ligne']]);
  assert.match(css, /\.trust\{margin:20px 0 0;display:flex;flex-wrap:wrap;justify-content:center;gap:8px 18px;max-width:470px;/);
  assert.ok(css.includes('.pick{position:relative;margin-top:28px;max-width:470px;'), 'la carte fait 470 px au plus, comme la ligne');
  const etroit = css.slice(css.indexOf('@media (max-width:489.98px),(min-width:700px) and (max-width:959.98px){'));
  assert.match(etroit, /^@media[^{]*\{\s*\.trust\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(etroit, /\.trust li>span>span\{display:block\}/);
});

test('avis : la carte du moment et sa photo grossissent, puis rapetissent quand le carrousel passe à la suivante', async () => {
  const vm = await import('node:vm');
  const h = lire('index.html');
  /* Le carrousel, exécuté seul avec trois cartes de 360 px */
  const src = h.slice(h.indexOf('    var cards=[].slice.call(track.children)'), h.indexOf('    /* Défilement tout seul'));
  const el = i => { const cls = new Set(), on = {}; return {cls, on, offsetLeft: 20 + i * 378, offsetWidth: 360,
    classList: {toggle: (c, v) => v ? cls.add(c) : cls.delete(c)}, addEventListener: (e, f) => { on[e] = f; }}; };
  const cards = [0, 1, 2].map(el), pts = [0, 1, 2].map(el), ev = {}, scrolls = [];
  const track = {children: cards, offsetLeft: 0, clientWidth: 1200, scrollWidth: 1200, scrollLeft: 0,
    addEventListener: (e, f) => { ev[e] = f; }, scrollTo: o => { scrolls.push(o.left); track.scrollLeft = o.left; }};
  const ctx = vm.createContext({track, dots: {children: pts}, REDUIT: false, Math, setTimeout: f => f(), clearTimeout: () => {}});
  vm.runInContext(src, ctx);
  const dumoment = () => cards.map(c => c.cls.has('cur') ? 1 : 0).join('') + '/' + pts.map(p => p.cls.has('on') ? 1 : 0).join('');
  assert.equal(dumoment(), '100/100', 'au départ, le premier avis');
  /* Toutes les cartes tiennent à l’écran : le carrousel avance quand même d’un avis à l’autre, sans défiler */
  for (const attendu of ['010/010', '001/001', '100/100']) { vm.runInContext('vers((cur+1)%cards.length)', ctx); assert.equal(dumoment(), attendu); }
  assert.deepEqual(scrolls, [], 'rien à faire défiler');
  /* Sur téléphone (la piste défile) : le défilement automatique centre l’avis, sans que son passage le change */
  track.clientWidth = 400; track.scrollWidth = 1196;
  vm.runInContext('vers(1)', ctx);
  assert.deepEqual(scrolls, [378]); ev.scroll(); assert.equal(dumoment(), '010/010');
  /* Quand on fait défiler soi-même, l’avis du moment est celui du milieu ; toucher une carte la met en avant */
  ev.pointerdown(); track.scrollLeft = 756; ev.scroll(); assert.equal(dumoment(), '001/001');
  cards[0].on.click(); assert.equal(dumoment(), '100/100');
  /* Ce qui grossit : la carte (qui se redresse) et la photo ; les autres rapetissent */
  assert.match(css, /\.av-card\{scale:\.95;transition:[^}]*scale \.65s cubic-bezier\(\.34,1\.56,\.64,1\)/);
  assert.match(css, /\.av-card\.cur\{scale:1\.04;rotate:calc\(-1 \* var\(--r,0deg\)\);/);
  assert.match(css, /\.av-card\.cur \.av-head\{scale:1\.16\}/);
  assert.match(css, /\.av-card header\{gap:17px\}/, 'la photo agrandie ne touche pas le prénom');
  assert.doesNotMatch(h, /var setDot=/, 'l’avis du moment ne se déduit plus seulement du défilement');
});

/* 30 octobre (21 h) : « une fusée en stickers au lieu du trophée, fusée animée ». */
test('héros : une fusée en autocollant, animée, remplace le trophée de la pastille', () => {
  const h = lire('index.html');
  const k = h.match(/<span class="kicker n1 load">([\s\S]*?)<span>La plateforme qui te fait passer <span class="nw">au niveau supérieur<\/span><\/span><\/span>/);
  assert.ok(k, 'la pastille garde son texte');
  assert.doesNotMatch(k[1], /class="tro"/, 'plus de trophée');
  assert.match(k[1], /^<svg class="fz" viewBox="0 0 48 48" aria-hidden="true"><g transform="rotate\(45 24 24\)">/, 'fusée décorative, penchée vers le haut');
  assert.ok(k[1].includes('<g fill="#fff" stroke="#fff" stroke-width="7" stroke-linejoin="round">'), 'le bord blanc des autocollants');
  assert.ok(k[1].includes('<g stroke="#1B1640" stroke-width="2.5" stroke-linejoin="round">'), 'le trait encre des autocollants');
  assert.match(k[1], /<g class="fz-fl">/, 'la flamme');
  assert.match(k[1], /<g class="fz-tr" /, 'les traînées');
  /* L’autocollant déborde de la pastille : plus de overflow:hidden, le reflet glisse dans son propre fond arrondi */
  const pastille = css.match(/\.kicker\.n1\{[^}]*\}/)[0];
  assert.ok(pastille.endsWith('position:relative}') && !pastille.includes('overflow:hidden'), 'la fusée n’est pas rognée');
  assert.match(css, /\.kicker\.n1::after\{[^}]*inset:0;border-radius:inherit;[^}]*no-repeat;animation:shimfond 4s/);
  assert.match(css, /\.kicker\.n1 \.fz\{[^}]*position:relative;z-index:1;[^}]*animation:fz-arrive \.9s var\(--press\) \.3s backwards,fz-vol 4s ease-in-out 1\.2s infinite\}/, 'elle arrive, puis vole');
  assert.match(css, /\.kicker\.n1 \.fz-fl\{animation:fz-pousse 4s ease-in-out 1\.2s infinite\}/, 'la poussée suit le vol');
  for (const nom of ['shimfond', 'fz-arrive', 'fz-vol', 'fz-pousse', 'fz-flamme', 'fz-trainee']) assert.match(css, new RegExp(`@keyframes ${nom}\\{`), nom);
  /* Mouvement réduit : tout s’arrête, et la règle vient après celles qu’elle annule (même poids) */
  const reduit = css.indexOf('.kicker.n1::after,.kicker.n1 .fz,.kicker.n1 .fz g,.kicker.n1 .fz path{animation:none;transition:none}');
  assert.ok(reduit > css.indexOf('.kicker.n1 .fz-tr path{'), 'mouvement réduit respecté');
});

/* 30 octobre (21 h 10) : « centre le bouton ». Vers 360 px, « Découvrir Requête » passait sur deux lignes, calé à gauche. */
test('connexion : « Découvrir Requête » tient sur une ligne, centré dans son bouton', () => {
  const h = lire('connexion.html');
  assert.ok(h.includes('<a class="cx-back" href="./"><svg viewBox="0 0 24 24"') && h.includes('</svg>Découvrir Requête</a>'));
  const r = h.match(/\n\.cx-back\{([^}]*)\}/)[1];
  assert.ok(r.includes('display:inline-flex;align-items:center;justify-content:center;') && r.includes('white-space:nowrap;'), 'centré, sans retour à la ligne');
  assert.ok(h.includes('@media (max-width:399px){.cx-top{gap:8px}.cx-back{padding:0 11px}}'), 'sur petit écran, il tient à côté du logo');
});

/* 30 octobre (21 h 17) : « fais une carte en dessous avec la partie entretien (à mettre dans l’ordre des autres) au lieu de
   mettre à part », « monte “Requête, bientôt dans ta poche” », et un nouveau texte pour les parcours. */
test('la prépa entretien devient une carte des atouts ; « bientôt dans ta poche » remonte ; texte des parcours', () => {
  const h = lire('index.html');
  assert.ok(!h.includes('<section class="block" id="entretien"'), 'plus de section à part');
  /* Sans la carte « Sans réseau » (30 octobre, 22 h 50), elle suit « Cas pratiques et révisions » */
  const cas = h.indexOf('<div class="panel tile db w3 rv d1 t-cas">'), en = h.indexOf('<div class="panel tile db w6 rv t-en" id="entretien">');
  assert.ok(cas > 0 && en > cas && h.indexOf('<div class="panel tile', cas + 1) === en, 'la carte suit « Cas pratiques et révisions »');
  assert.ok(en < h.indexOf('</section>', h.indexOf('<section class="block" id="programme"')), 'dans « Tout pour apprendre vraiment »');
  const carte = h.slice(en, h.indexOf('</section>', en));
  const tete = carte.match(/<div class="db-head"><span class="db-ic c6"><svg[^>]*aria-hidden="true">[\s\S]*?<\/svg><\/span><span class="db-t"><small>Prépa entretien<\/small><\/span><span class="db-badge or">(\d+) thèmes<\/span><\/div>\s*<h3>Entraîne-toi pour l’entretien<\/h3>/);
  assert.ok(tete, 'même en-tête que les autres cartes : icône, libellé, pastille, puis le titre');
  assert.equal(+tete[1], (carte.match(/<ul class="en-themes"[^>]*>(.*?)<\/ul>/s)[1].match(/<li>/g) || []).length, 'la pastille compte les thèmes');
  assert.ok(h.includes('<a href="#entretien">Prépa entretien</a>'), 'le lien du pied de page mène à la carte');
  assert.match(css, /\.bento \.w6\{grid-column:1\/-1\}/, 'sur toute la largeur de la grille');
  assert.match(css, /@container tuile \(min-width:720px\)\{\s*\.en-in\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(0,1\.12fr\);gap:40px;align-items:start\}/, 'texte et aperçu côte à côte quand la carte est large');
  /* L’ordre des sections : l’appli sur mobile vient juste après les atouts */
  const ordre = [...h.matchAll(/<section class="[^"]*" id="([\w-]+)"/g)].map(m => m[1]);
  assert.deepEqual(ordre.slice(ordre.indexOf('programme'), ordre.indexOf('programme') + 4), ['programme', 'mobile', 'progression', 'comment']);
  /* Les parcours */
  assert.ok(h.includes('<h2 id="modules-h">Un parcours pour <em>chaque objectif</em>.</h2>'));
  assert.ok(h.includes('<p class="sec-lead" style="margin:6px auto 0">Du premier pas au niveau avancé, chaque parcours te guide avec des modules, des cours, des cas pratiques et des révisions pour progresser étape par étape.</p>'));
  assert.ok(!h.includes('Chaque parcours est complet'));
});

/* 30 octobre (21 h 33) : nouveau texte de la page de connexion ; « quand on vient pour la première fois après la connexion,
   il y a un bug dans l’animation, puis on n’atterrit pas sur la page d’accueil directement ». Deux causes : la page de
   l’appli se rechargeait à la première ouverture (le service worker qui s’installe en prend le contrôle), ce qui relançait
   l’animation d’arrivée après un éclair de l’écran de chargement ; et « Se connecter » ouvrait le parcours de bienvenue. */
test('connexion : nouveau texte, « Se connecter » mène à l’accueil, sans rechargement à la première ouverture', async () => {
  const vm = await import('node:vm');
  const cx = lire('connexion.html');
  assert.ok(cx.includes('<h1 id="cx-h">Ta prochaine requête <em>t’attend</em>.</h1>'));
  assert.ok(cx.includes('<p>Retrouve tes cours, tes cas pratiques, tes données, ta collection, exactement là où tu les avais laissés.</p>'));
  assert.ok(cx.includes("const APP = '../?depuis=vitrine', ACCUEIL = '../?depuis=connexion';"), 'chaque bouton dit qu’on arrive de la vitrine');
  assert.ok(cx.includes("enter(go, 'Connexion…', 'C’est parti !', ACCUEIL);"), '« Se connecter » : directement l’accueil');
  assert.ok(cx.includes("enter(e.currentTarget, 'Préparation…', 'Bienvenue !'));") && cx.includes('leave(); });'), 'créer un compte, continuer sans compte : le parcours reste');
  const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  /* Le service worker ne recharge la page que s’il en remplace un autre (une vraie nouvelle version) */
  assert.ok(app.includes('const _swHadController=!!navigator.serviceWorker.controller;'));
  assert.ok(app.includes("if(_swRefreshing||!_swHadController)return;"));
  /* L’arrivée : exécutée seule, avec et sans ?depuis=connexion */
  const src = app.slice(app.indexOf('function maybeOnboard(){'), app.indexOf('function startOnboarding(){', app.indexOf('function maybeOnboard(){')));
  const arrive = (search, onboarded = false) => {
    const appels = [], url = 'https://requete.app/' + search + '#x';
    const store = k => ({removeItem: c => appels.push(`oublie ${k} ${c}`)});
    const ctx = vm.createContext({URL, URLSearchParams, location: {search, href: url}, appels,
      sessionStorage: store('session'), localStorage: store('local'), NAV_KEY: 'nav', NAV_KEY_LONG: 'nav-long',
      history: {state: null, replaceState: (s, t, u) => appels.push('url ' + u)},
      state: {lessons: {}, plan: null, profile: {}, onboarded, accountMode: null},
      apercuPlan: (n, r, f) => ({niveau: n, rythme: r, freq: f, sessions: []}), obVitrineGoal: () => 'reconversion',
      save: () => appels.push('save'), startOnboarding: () => appels.push('parcours'), switchTab: t => appels.push('onglet ' + t),
      renderGreeting() {}, renderHomeHero() {}, renderProgress() {}, renderPlanning() {}, renderCompte() {}});
    vm.runInContext(src + '\nmaybeOnboard();', ctx);
    return {appels, state: ctx.state};
  };
  const a = arrive('?depuis=connexion');
  assert.deepEqual(a.appels, ['url /#x', 'oublie session nav', 'oublie local nav-long', 'save', 'onglet learn'], 'l’adresse est nettoyée, l’ancien écran oublié, puis l’accueil');
  assert.ok(a.state.onboarded && a.state.plan.niveau === 'debutant' && a.state.plan.rythme === 'regulier' && a.state.plan.freq === 7);
  assert.equal(a.state.profile.goal, 'reconversion', 'l’objectif choisi sur la vitrine');
  assert.equal(a.state.accountMode, 'guest');
  assert.deepEqual(arrive('').appels, ['parcours'], 'sans « Se connecter », le parcours de bienvenue');
  /* Chaque connexion ouvre l’accueil, même déjà inscrit : l’écran de la dernière visite est oublié (Elisa, 30 octobre, 22 h 50) */
  assert.deepEqual(arrive('?depuis=connexion', true).appels, ['url /#x', 'oublie session nav', 'oublie local nav-long', 'onglet learn']);
  assert.deepEqual(arrive('?depuis=vitrine', true).appels, ['url /#x', 'oublie session nav', 'oublie local nav-long', 'onglet learn'], '« Créer un compte », « Continuer sans compte »');
  assert.deepEqual(arrive('?depuis=vitrine').appels, ['url /#x', 'oublie session nav', 'oublie local nav-long', 'parcours'], 'pas encore inscrit : le parcours de bienvenue');
  assert.deepEqual(arrive('', true).appels, [], 'l’appli rouverte seule reprend où l’on en était');
  const boot = app.slice(app.indexOf('    maybeOnboard();\n'), app.indexOf('    jeuFromUrl();'));
  assert.equal(boot, '    maybeOnboard();\n    restoreNav();\n', 'restoreNav passe après : il ne trouve plus rien à reprendre');
});
