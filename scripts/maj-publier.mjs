// Publier une version de l’appli iPhone sans repasser par Apple (voir maj.js et scripts/maj-paquet.mjs).
// Ce script ne fait qu’une chose : écrire dans maj/publication.json quelle version (quel commit) les iPhone doivent avoir.
// Rien ne part tant que ce fichier n’est pas enregistré dans Git et poussé : c’est la mise en ligne du site qui fabrique
// alors maj/version.json, que l’appli lit.
//
//   node scripts/maj-publier.mjs                  la version du dernier commit, pour tous
//   node scripts/maj-publier.mjs --essai          la version du dernier commit, pour les iPhone en essai seulement
//   node scripts/maj-publier.mjs --natif-min 1.1  … réservée aux applis 1.1 et plus (elle utilise du natif ajouté en 1.1)
//   node scripts/maj-publier.mjs --retirer        plus aucune version pour tous : les iPhone reviennent au contenu de leur appli
//   node scripts/maj-publier.mjs --retirer --essai   plus de version d’essai
//   node scripts/maj-publier.mjs --etat           ce qui est publié
//
// Ce qui peut partir ainsi : tout ce qui est dans www/ (les cours, les textes, les écrans, les styles, les voix).
// Ce qui passe toujours par Apple : le natif (widgets, île, plugins, icône, écran de lancement, achats côté App Store).
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {versionDe} from './maj-paquet.mjs';

function entier(x) { const n = Math.floor(+x); return n > 0 && Number.isFinite(n) ? n : 0; }

/* La nouvelle publication, à partir de l’ancienne. Sans effet de bord : les tests s’en servent. */
export function publier(ancienne, {commit, version, essai = false, retirer = false, natifMin = '', le = new Date().toISOString().slice(0, 10)} = {}) {
  const pub = ancienne && typeof ancienne === 'object' ? JSON.parse(JSON.stringify(ancienne)) : {};
  const garder = pub.essai && typeof pub.essai === 'object' && entier(pub.essai.version) ? pub.essai : null;
  if (retirer) {
    if (essai) { const reste = {...pub}; delete reste.essai; return entier(reste.version) ? reste : {version: 0}; }
    return garder ? {version: 0, essai: garder} : {version: 0};
  }
  const v = entier(version);
  if (!v) throw new Error('version invalide : ' + version);
  if (!/^[0-9a-f]{40}$/.test(String(commit))) throw new Error('commit invalide : ' + commit);
  if (natifMin && !/^\d+(\.\d+){0,2}$/.test(String(natifMin))) throw new Error('--natif-min attend une version de l’appli, comme 1.1');
  const cible = {version: v, commit: String(commit), le};
  if (natifMin) cible.natifMin = String(natifMin);
  if (essai) {
    if (v <= entier(pub.version)) throw new Error(`la version publiée pour tous (v${entier(pub.version)}) est au moins aussi récente que v${v} : un essai ne servirait à rien`);
    const reste = {...pub}; delete reste.essai;
    return {...(entier(reste.version) ? reste : {version: 0}), essai: cible};
  }
  /* Publiée pour tous : une version d’essai plus ancienne, ou la même, n’a plus lieu d’être. */
  return garder && entier(garder.version) > v ? {...cible, essai: garder} : cible;
}

export function decrire(pub) {
  const lignes = [];
  const v = entier(pub && pub.version);
  lignes.push(v ? `Pour tous : v${v} (commit ${String(pub.commit).slice(0, 8)}, publiée le ${pub.le || '?'}${pub.natifMin ? ', appli ' + pub.natifMin + ' et plus' : ''})` : 'Pour tous : aucune version publiée (les iPhone gardent le contenu de leur appli)');
  const e = pub && pub.essai;
  if (e && entier(e.version)) lignes.push(`En essai : v${entier(e.version)} (commit ${String(e.commit).slice(0, 8)}, publiée le ${e.le || '?'}${e.natifMin ? ', appli ' + e.natifMin + ' et plus' : ''})`);
  return lignes.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const racine = fileURLToPath(new URL('..', import.meta.url));
  const fichier = join(racine, 'maj', 'publication.json');
  const args = process.argv.slice(2);
  const a = nom => args.includes(nom);
  const valeur = nom => { const i = args.indexOf(nom); return i >= 0 ? String(args[i + 1] || '') : ''; };
  const ancienne = existsSync(fichier) ? JSON.parse(readFileSync(fichier, 'utf8')) : {version: 0};
  if (a('--etat')) { console.log(decrire(ancienne)); process.exit(0); }
  const git = (...p) => execFileSync('git', p, {cwd: racine}).toString().trim();
  let nouvelle;
  try {
    if (a('--retirer')) nouvelle = publier(ancienne, {retirer: true, essai: a('--essai')});
    else {
      /* La version publiée est celle du dernier commit : un fichier modifié sans être enregistré dans Git n’en ferait pas partie. */
      const sale = git('status', '--porcelain', '--untracked-files=no').split('\n').filter(l => l.trim() && !l.endsWith('maj/publication.json'));
      if (sale.length) throw new Error('des modifications ne sont pas encore enregistrées dans Git (git status) : enregistre-les d’abord, la version publiée est celle du dernier commit');
      const lire = f => readFileSync(join(racine, f), 'utf8');
      const version = versionDe(lire('maj.js'));
      const nom = `requete-${/var NOM = 'requete-([^']+)';/.exec(lire('maj.js'))[1]}`;
      if (!lire('index.html').includes(`const SW_CACHE='${nom}';`) || !lire('sw.js').includes(`const CACHE = '${nom}';`)) throw new Error('maj.js, index.html et sw.js ne portent pas le même numéro de version');
      nouvelle = publier(ancienne, {commit: git('rev-parse', 'HEAD'), version, essai: a('--essai'), natifMin: valeur('--natif-min')});
    }
  } catch (e) { console.error('Rien n’est publié : ' + e.message); process.exit(1); }
  mkdirSync(join(racine, 'maj'), {recursive: true});
  writeFileSync(fichier, JSON.stringify(nouvelle, null, 2) + '\n');
  console.log(decrire(nouvelle));
  console.log('\nRien n’est encore parti. Pour publier :\n  git add maj/publication.json && git commit -m "Publie l’appli" && git push origin main\n');
}
