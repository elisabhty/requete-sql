// La mise à jour à distance de l’appli iPhone, côté site (Elisa, 13 novembre, 11 h 49 : « modifier un cours, ajouter un parcours,
// modifier une faute, sans passer par une mise en prod Apple »). Ce script fabrique ce que l’appli lit (maj.js) :
//   - maj/version.json : la version que chaque iPhone doit avoir (et, à part, la version d’essai) ;
//   - maj/<version>/manifeste.json : la liste de tous les fichiers de cette version, avec l’empreinte SHA-256 de chacun et
//     l’adresse où le prendre. L’iPhone reprend dans l’appli tout fichier qu’il a déjà (même empreinte) : il ne télécharge
//     que ce qui a changé.
//
// Il tourne à chaque mise en ligne du site (.github/workflows/deploy-pages.yml : « node scripts/maj-paquet.mjs --ci »), à
// partir de maj/publication.json, que scripts/maj-publier.mjs remplit. Publier une version de l’appli est donc un geste à
// part : mettre le site en ligne ne change rien pour les iPhone tant que maj/publication.json ne bouge pas.
//
// Pourquoi à chaque mise en ligne : la version publiée est figée (un commit précis), mais le site, lui, continue de changer.
// Un fichier de la version publiée encore identique sur le site est pris à son adresse habituelle
// (https://requeteapp.com/index.html) ; un fichier qui a changé depuis est recopié sous maj/<version>/www/. Rien n’est gardé
// dans Git : tout est refait ici, puis vérifié (chaque adresse du manifeste mène bien à un fichier de la bonne empreinte).
//
// Une erreur ici arrête la mise en ligne : le site reste tel qu’il était, les iPhone aussi.
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, rmSync, copyFileSync, mkdtempSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

export const ORIGINE = 'https://requeteapp.com/';
/* Les mêmes bornes que maj.js (manifesteSur) : un manifeste trop court ou trop long est refusé par l’iPhone. */
export const FICHIERS_MIN = 50;
export const FICHIERS_MAX = 6000;

export function empreinte(fichier) { return createHash('sha256').update(readFileSync(fichier)).digest('hex'); }

/* Tous les fichiers d’un dossier, chemins relatifs avec « / », triés. Les fichiers cachés (.DS_Store) restent dehors. */
export function lister(dossier, prefixe = '') {
  const liste = [];
  for (const nom of readdirSync(join(dossier, prefixe)).sort()) {
    if (nom.startsWith('.')) continue;
    const rel = prefixe ? prefixe + '/' + nom : nom;
    const s = statSync(join(dossier, rel));
    if (s.isDirectory()) liste.push(...lister(dossier, rel));
    else if (s.isFile()) liste.push(rel);
  }
  return liste;
}

export function adresse(chemin) { return chemin.split('/').map(encodeURIComponent).join('/'); }

/* Le numéro de version d’un maj.js (« var NOM = 'requete-2026-11-13-accueil-v2934'; » donne 2928). */
export function versionDe(texte) {
  const m = /var NOM = '([^']+)';/.exec(String(texte));
  const n = m && /v(\d+)$/.exec(m[1]);
  return n ? +n[1] : 0;
}

function entier(x) { const n = Math.floor(+x); return n > 0 && Number.isFinite(n) ? n : 0; }

/* Le manifeste d’une version.
   www : le contenu de l’appli à cette version (le dossier que Capacitor embarque).
   site : le site tel qu’il part en ligne ; maj/<version>/ y est écrit. */
export function fabriquer({www, site, version, origine = ORIGINE}) {
  const v = entier(version);
  if (!v) throw new Error('version invalide : ' + version);
  const fichiers = lister(www);
  if (fichiers.length < FICHIERS_MIN || fichiers.length > FICHIERS_MAX) throw new Error(`${fichiers.length} fichiers : hors des bornes (${FICHIERS_MIN} à ${FICHIERS_MAX})`);
  for (const indispensable of ['index.html', 'maj.js', 'sw.js']) if (!fichiers.includes(indispensable)) throw new Error('fichier absent de la version : ' + indispensable);
  const vue = versionDe(readFileSync(join(www, 'maj.js'), 'utf8'));
  if (vue !== v) throw new Error(`maj.js de cette version dit v${vue}, la publication dit v${v}`);
  const dossier = join(site, 'maj', String(v));
  rmSync(dossier, {recursive: true, force: true});
  mkdirSync(dossier, {recursive: true});
  const manifeste = [];
  let copies = 0, octets = 0;
  for (const f of fichiers) {
    /* Le plugin lit « .br » comme un fichier compressé, et refuse les chemins qui sortent du dossier. */
    if (f.endsWith('.br') || f.includes('..') || f.includes('\\') || f.startsWith('/')) throw new Error('nom de fichier refusé : ' + f);
    const source = join(www, f);
    const h = empreinte(source);
    const enLigne = join(site, f);
    let url;
    if (existsSync(enLigne) && statSync(enLigne).isFile() && statSync(enLigne).size === statSync(source).size && empreinte(enLigne) === h) {
      url = origine + adresse(f);
    } else {
      const copie = join(dossier, 'www', f);
      mkdirSync(dirname(copie), {recursive: true});
      copyFileSync(source, copie);
      copies++; octets += statSync(source).size;
      url = origine + 'maj/' + v + '/www/' + adresse(f);
    }
    manifeste.push({file_name: f, file_hash: h, download_url: url});
  }
  writeFileSync(join(dossier, 'manifeste.json'), JSON.stringify(manifeste));
  return {version: v, fichiers: manifeste.length, copies, octets, manifeste: origine + 'maj/' + v + '/manifeste.json', chemin: join(dossier, 'manifeste.json')};
}

/* Chaque adresse du manifeste mène, sur le site tel qu’il part en ligne, à un fichier de la bonne empreinte. */
export function controler({site, manifeste, origine = ORIGINE}) {
  const liste = typeof manifeste === 'string' ? JSON.parse(readFileSync(manifeste, 'utf8')) : manifeste;
  const vus = new Set();
  for (const e of liste) {
    if (!e || typeof e.file_name !== 'string' || !/^[0-9a-f]{64}$/.test(String(e.file_hash)) || typeof e.download_url !== 'string') throw new Error('entrée de manifeste invalide : ' + JSON.stringify(e));
    if (vus.has(e.file_name)) throw new Error('fichier en double : ' + e.file_name);
    vus.add(e.file_name);
    if (!e.download_url.startsWith(origine)) throw new Error('adresse hors du site : ' + e.download_url);
    const chemin = e.download_url.slice(origine.length).split('/').map(decodeURIComponent);
    if (chemin.some(p => !p || p === '..' || p.startsWith('.'))) throw new Error('adresse refusée : ' + e.download_url);
    const fichier = join(site, ...chemin);
    if (!existsSync(fichier) || empreinte(fichier) !== e.file_hash) throw new Error('le site ne sert pas ce fichier à cette empreinte : ' + e.download_url);
  }
  return liste.length;
}

/* L’annonce (maj/version.json) à partir de ce qui est publié. construire(commit) rend le dossier www de ce commit. */
export function annoncer({publication, site, construire, origine = ORIGINE, maintenant = new Date()}) {
  const pub = publication && typeof publication === 'object' ? publication : {};
  const faire = cible => {
    if (!cible || typeof cible !== 'object' || !entier(cible.version)) return null;
    if (!/^[0-9a-f]{40}$/.test(String(cible.commit))) throw new Error('commit invalide pour v' + cible.version + ' : ' + cible.commit);
    const r = fabriquer({www: construire(cible.commit), site, version: cible.version, origine});
    controler({site, manifeste: r.chemin, origine});
    const a = {version: r.version, manifeste: r.manifeste, fichiers: r.fichiers};
    for (const k of ['natifMin', 'natifMax']) if (cible[k]) a[k] = String(cible[k]);
    return {annonce: a, bilan: r};
  };
  const tous = faire(pub);
  const essai = pub.essai && entier(pub.essai.version) > (tous ? tous.annonce.version : 0) ? faire(pub.essai) : null;
  const annonce = tous ? {...tous.annonce} : {version: 0};
  if (essai) annonce.essai = essai.annonce;
  annonce.le = maintenant.toISOString();
  mkdirSync(join(site, 'maj'), {recursive: true});
  writeFileSync(join(site, 'maj', 'version.json'), JSON.stringify(annonce, null, 1) + '\n');
  return {annonce, tous: tous && tous.bilan, essai: essai && essai.bilan};
}

/* Le contenu de l’appli à un commit donné : ce commit, sorti à part, puis les mêmes scripts que « npm run build:www ». */
export function construireDepuisGit(racine) {
  const faits = new Map();
  const git = (...args) => execFileSync('git', args, {cwd: racine, stdio: ['ignore', 'pipe', 'pipe']}).toString();
  const construire = commit => {
    if (faits.has(commit)) return faits.get(commit);
    try { git('cat-file', '-e', commit + '^{commit}'); } catch (e) { git('fetch', '--depth=1', 'origin', commit); }
    const dossier = mkdtempSync(join(tmpdir(), 'requete-maj-'));
    git('worktree', 'add', '--detach', '--force', dossier, commit);
    for (const script of ['scripts/compte-moteurs.mjs', 'scripts/build-www.mjs']) execFileSync(process.execPath, [script], {cwd: dossier, stdio: ['ignore', 'pipe', 'inherit']});
    faits.set(commit, join(dossier, 'www'));
    return faits.get(commit);
  };
  construire.ranger = () => {
    for (const www of faits.values()) { try { git('worktree', 'remove', '--force', dirname(www)); } catch (e) { rmSync(dirname(www), {recursive: true, force: true}); } }
    faits.clear();
  };
  return construire;
}

function mo(octets) { return (octets / 1048576).toFixed(1).replace('.', ',') + ' Mo'; }

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const racine = fileURLToPath(new URL('..', import.meta.url));
  const fichier = join(racine, 'maj', 'publication.json');
  const publication = existsSync(fichier) ? JSON.parse(readFileSync(fichier, 'utf8')) : {version: 0};
  const construire = construireDepuisGit(racine);
  try {
    const r = annoncer({publication, site: racine, construire});
    const dire = (nom, b) => { if (b) console.log(`${nom} : v${b.version}, ${b.fichiers} fichiers, dont ${b.copies} recopiés sous maj/${b.version}/www (${mo(b.octets)})`); };
    if (!r.tous && !r.essai) console.log('Aucune version publiée : les iPhone gardent le contenu de leur appli.');
    dire('Pour tous', r.tous);
    dire('En essai', r.essai);
  } finally {
    construire.ranger();
  }
}
