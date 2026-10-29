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

test('le nombre de défis annoncé correspond aux défis de l’appli (CHALLENGES)', () => {
  const start = html.indexOf('const CHALLENGES');
  const body = html.slice(start, html.indexOf('\n];', start));
  const n = (body.match(/^\s*\{\s*id:/gm) || []).length;
  assert.equal(VITRINE.module('sql').defis, n);
  assert.match(fs.readFileSync(path.join(root, 'decouvrir/index.html'), 'utf8'), new RegExp(`${n} défis métier`));
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
