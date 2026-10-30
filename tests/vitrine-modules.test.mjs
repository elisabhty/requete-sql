/* Vitrine : le programme du module SQL (decouvrir/modules.js) reprend les chapitres et les leçons de l’appli
   (MODULES dans index.html) : mêmes titres, mêmes résumés, même durée de vidéo. Un cours ajouté, renommé ou
   déplacé dans l’appli doit l’être aussi sur la fiche du module. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext('var window=this;' + fs.readFileSync(path.join(root, 'decouvrir/modules.js'), 'utf8'), ctx);
const { MODULES, VITRINE } = ctx;

/* Chapitres de l’appli : { titre, sous, lessons:[ guide({ id, titre, résumé, … video:{… duree:'2 min 16' …} }) ] } */
const app = (() => {
  const start = html.indexOf('const MODULES = [');
  const body = html.slice(start, html.indexOf('\n];', start));
  const heads = [...body.matchAll(/\{ titre:"([^"]+)", sous:"([^"]+)", lessons:\[/g)];
  return heads.map((h, i) => {
    const seg = body.slice(h.index, i + 1 < heads.length ? heads[i + 1].index : body.length);
    const lecons = seg.split(/(?=guide\(\{ id:\d+,)/).slice(1).map(p => {
      const [, titre, resume] = p.match(/guide\(\{ id:\d+, titre:"([^"]+)", résumé:"([^"]*)"/);
      const d = p.match(/duree:'(\d+) min(?: (\d+))?'/);
      return [titre, resume, d ? +d[1] * 60 + +(d[2] || 0) : 0];
    });
    return { titre: h[1], sous: h[2], lecons };
  });
})();

test('le module SQL de la vitrine a les mêmes chapitres et les mêmes leçons que l’appli', () => {
  const sql = VITRINE.module('sql');
  assert.ok(sql, 'module « sql » présent');
  assert.deepEqual(JSON.parse(JSON.stringify(sql.programme)), app.map(c => ({ titre: c.titre, sous: c.sous, lecons: c.lecons })));
});

test('les chiffres affichés se calculent depuis le programme (62 cours, environ 3 h)', () => {
  const sql = VITRINE.module('sql');
  assert.equal(VITRINE.nbCours(sql), app.reduce((s, c) => s + c.lecons.length, 0));
  assert.equal(VITRINE.duree(VITRINE.secondes(sql)), VITRINE.duree(app.reduce((s, c) => s + c.lecons.reduce((t, l) => t + l[2], 0), 0)));
});

test('chaque module a un id unique, et les affiches d’un module disponible existent', () => {
  const ids = MODULES.map(m => m.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const m of MODULES.filter(m => m.statut !== 'bientot'))
    for (const a of m.affiches || [])
      assert.ok(fs.existsSync(path.join(root, `assets/anim/${a}-thumb.jpg`)), `${m.id} : affiche ${a}`);
});

test('le nombre de cas pratiques annoncé correspond aux défis de l’appli (CHALLENGES)', () => {
  const start = html.indexOf('const CHALLENGES');
  const body = html.slice(start, html.indexOf('\n];', start));
  const n = (body.match(/^\s*\{\s*id:/gm) || []).length;
  assert.equal(VITRINE.module('sql').defis, n);
  assert.match(fs.readFileSync(path.join(root, 'decouvrir/index.html'), 'utf8'), new RegExp(`${n} cas pratiques`));
});

test('le service worker sert la vitrine réseau d’abord, sous sa propre adresse, jamais à la place de index.html', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const vitrine = sw.indexOf("url.pathname.includes('/decouvrir/')");
  const navigation = sw.indexOf("if (req.mode === 'navigate') {");
  const cacheDabord = sw.indexOf('const hit = await cache.match(req, { ignoreSearch: true });');
  assert.ok(vitrine > 0, 'branche decouvrir/ présente');
  assert.ok(vitrine < navigation && vitrine < cacheDabord, 'traitée avant la navigation (rangée sous index.html) et avant le cache d’abord');
  const bloc = sw.slice(vitrine, sw.indexOf('return;\n  }', vitrine));
  assert.match(bloc, /fetch\(req, \{ cache: 'no-cache' \}\)/);
  assert.doesNotMatch(bloc, /index\.html/);
});

test('la vitrine charge vitrine.css et modules.js avec l’empreinte de leur contenu (sinon un navigateur garde l’ancienne version)', async () => {
  const { createHash } = await import('node:crypto');
  const v = f => createHash('sha1').update(fs.readFileSync(path.join(root, 'decouvrir', f))).digest('hex').slice(0, 8);
  for (const page of ['index.html', 'module.html']) {
    const h = fs.readFileSync(path.join(root, 'decouvrir', page), 'utf8');
    assert.ok(h.includes(`src="modules.js?v=${v('modules.js')}"`), `${page} : écrire src="modules.js?v=${v('modules.js')}"`);
  }
  /* Toutes les pages qui chargent vitrine.css (accueil, module, connexion, pages légales…) */
  const pages = fs.readdirSync(path.join(root, 'decouvrir')).filter(f => f.endsWith('.html'));
  const avecCss = pages.filter(f => /href="vitrine\.css/.test(fs.readFileSync(path.join(root, 'decouvrir', f), 'utf8')));
  assert.ok(avecCss.length >= 3, 'au moins l’accueil, la fiche module et la connexion');
  for (const page of avecCss) {
    const h = fs.readFileSync(path.join(root, 'decouvrir', page), 'utf8');
    assert.ok(h.includes(`href="vitrine.css?v=${v('vitrine.css')}"`), `${page} : écrire href="vitrine.css?v=${v('vitrine.css')}"`);
  }
});

test('les pages légales existent et chaque page de la vitrine y mène', () => {
  const legal = ['mentions-legales.html', 'confidentialite.html', 'conditions.html'];
  for (const f of legal) assert.ok(fs.existsSync(path.join(root, 'decouvrir', f)), `decouvrir/${f}`);
  for (const page of ['index.html', 'module.html', ...legal]) {
    const h = fs.readFileSync(path.join(root, 'decouvrir', page), 'utf8');
    for (const f of legal) assert.ok(h.includes(`href="${f}"`), `${page} : lien vers ${f}`);
  }
  const cx = fs.readFileSync(path.join(root, 'decouvrir', 'connexion.html'), 'utf8');
  assert.ok(cx.includes('href="confidentialite.html"') && cx.includes('href="conditions.html"'), 'connexion.html : liens confidentialité et conditions');
});

test('le support 7j/7 n’est promis que si une adresse de contact est réglée', () => {
  const h = fs.readFileSync(path.join(root, 'decouvrir', 'index.html'), 'utf8');
  const sup = [...h.matchAll(/<li class="sup"([^>]*)>/g)];
  assert.ok(sup.length >= 1, 'mention du support présente');
  for (const m of sup) assert.match(m[1], /\bhidden\b/, 'cachée par défaut');
  const css = fs.readFileSync(path.join(root, 'decouvrir', 'vitrine.css'), 'utf8');
  assert.match(css, /\.sup\[hidden\]\{display:none!important\}/, 'hidden l’emporte sur le display des listes');
  assert.match(h, /if\(!CONTACT_EMAIL\)return;\s*\[\]\.forEach\.call\(document\.querySelectorAll\('\.sup'\)/, 'affichée seulement avec CONTACT_EMAIL');
});
