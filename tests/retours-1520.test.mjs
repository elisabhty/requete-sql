/* 4 novembre, 15 h 20 (Elisa, sur la capture de « Ils apprécient Requête » où Aminata C. s’affichait d’abord) : « mettre la deuxième en
   premier et celle sur l’écran en dernier ». Sofia B. d’abord, Aminata C. en dernier : l’ordre du site, pour tout le monde. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const i = app.indexOf('/* ---------- « Ils apprécient Requête » (Elisa, 4 novembre, 14 h 08) ----------'), j = app.indexOf('/* 14 h 08 (réf. 3) : « mettre une flèche animée', i);
const bloc = app.slice(i, j);

test('les avis : Sofia B. d’abord, Thomas L., puis Aminata C. en dernier, quel que soit l’objectif', () => {
  assert.ok(i > 0 && j > i);
  /* 12 novembre (réf. 1, « ne mets que cette personne, pas les autres ») : l’avis de Sofia B. seul, quel que soit l’objectif */
  assert.ok(bloc.includes('function obTemoinsListe(){return OB_TEMOINS.slice(0,1);}') && !bloc.includes('OB_TEMOINS_ORDRE'), 'plus d’ordre selon l’objectif');
  assert.ok(bloc.includes('  const liste=obTemoinsListe(),r=liste[0],'));
  for (const goal of ['career', 'interview', 'work', 'curious']) {
    const ctx = vm.createContext({ draft: { goal }, escAttr: s => String(s), obNombre: n => String(n), obTypo: s => s, document: { addEventListener() {} } });
    vm.runInContext(bloc, ctx);
    const html = ctx.obTemoinsHtml();
    const pastilles = [...html.matchAll(/aria-label="Témoignage (?:de |d’)([^"]+)" onclick="obTemoinsChoisir\((\d)\)"/g)].map(m => m[1]);
    assert.deepEqual(pastilles, [], goal + ' : un seul avis, pas de pastilles');
    assert.ok(html.includes('src="decouvrir/avis/sofia-b.webp"'), goal + ' : la photo de Sofia B. à l’arrivée');
  }
});
