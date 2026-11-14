/* Elisa, 14 novembre, 22 h 39 : « Dans le profil du joueur, précisez le niveau » (son choix : son niveau SQL, avec son accord pour
   modifier la base). Le niveau (1 à 5) part avec le pseudo (jeu_niveau), comme le pays ; le profil d’un joueur le lit (jeu_niveaux)
   et le montre en tête de ses pastilles, au neutre ; la page Confidentialité le dit. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), css = lire('ludique.css'), conf = lire('decouvrir/confidentialite.html');
const sql = lire('supabase/migrations/20261114214253_joueur_niveau.sql');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = nom => cut(`function ${nom}(`, '\n}\n') + '\n}\n';

test('la base : une colonne niveau (1 à 5) avec le pseudo, jeu_niveau pour l’écrire, jeu_niveaux pour le lire', () => {
  assert.ok(sql.includes('alter table public.jeu_pseudo add column if not exists niveau smallint;') && sql.includes('check (niveau between 1 and 5)'));
  assert.ok(sql.includes("v_niveau smallint := case when p_niveau between 1 and 5 then p_niveau::smallint end;") && sql.includes("raise exception 'niveau invalide'"));
  assert.ok(sql.includes('update public.jeu_pseudo set niveau = v_niveau where cle = v_cle'), 'seulement sa propre ligne (sa clé)');
  assert.ok(sql.includes('[1:50]') && sql.includes('where p.niveau is not null;'), '50 pseudos au plus, comme jeu_drapeaux');
  assert.ok(sql.includes('grant execute on function public.jeu_niveau(text, integer) to anon, authenticated;') && sql.includes('grant execute on function public.jeu_niveaux(text[]) to anon, authenticated;'));
});

test('l’appli envoie son niveau une fois par changement, avec un pseudo', () => {
  const appels = [];
  const ctx = vm.createContext({ state: { salle: { pseudo: '@lea' } }, DRAP: {}, save: () => {}, clsCle: () => 'k', clsSalle: () => ctx.state.salle,
    jeuSavedNom: () => ctx.state.salle.pseudo, niveauCompte: () => ({ rank: ctx.rang }), rang: 2,
    clsRpc: (f, a) => { appels.push([f, a.p_niveau]); return Promise.resolve({ ok: true }); } });
  vm.runInContext(fn('nivSync'), ctx);
  ctx.nivSync();
  return Promise.resolve().then(() => {
    assert.deepEqual(appels, [['jeu_niveau', 2]]);
    assert.equal(ctx.state.salle.nivEnv, 2);
    ctx.nivSync(); assert.equal(appels.length, 1, 'déjà envoyé : rien');
    ctx.rang = 3; ctx.nivSync(); assert.deepEqual(appels.at(-1), ['jeu_niveau', 3], 'il monte : renvoyé');
    ctx.state.salle.pseudo = ''; ctx.rang = 4; ctx.nivSync(); assert.equal(appels.length, 2, 'sans pseudo : rien');
    assert.ok(app.includes('  paysSync();\n  nivSync();') && fn('stkAfterProgress').includes("if(typeof nivSync==='function')nivSync();"), 'au passage dans les défis, et à la montée de niveau');
    assert.ok(app.includes('if(Number.isInteger(salleSrc.nivEnv)&&salleSrc.nivEnv>=1&&salleSrc.nivEnv<=5)salle.nivEnv=salleSrc.nivEnv;'), 'gardé à la sauvegarde');
  });
});

test('le profil du joueur : « Niv. 3 » et son nom au neutre, en tête des pastilles', () => {
  const ctx = vm.createContext({ esc: s => String(s), escAttr: s => String(s) });
  vm.runInContext(cut('const ACCOUNT_LEVELS=[', '/* acquis :') + fn('nivJoueurNom') + fn('nivPcHTML'), ctx);
  assert.equal(vm.runInContext('nivPcHTML(3)', ctx), '<span class="dx-pc is-lvl" role="img" aria-label="Niveau 3 : Analyste relationnel·le"><i aria-hidden="true">Niv.&nbsp;3</i><span aria-hidden="true">Analyste relationnel·le</span></span>');
  assert.match(vm.runInContext('nivPcHTML(5)', ctx), /SELECT \* FROM légende/);
  assert.match(vm.runInContext('nivPcHTML(1)', ctx), /Explorateur·rice SQL/);
  const f = fn('dxFicheNiveau');
  assert.ok(f.includes("clsRpc('jeu_niveaux',{p_pseudos:[e.n]})") && f.includes('Date.now()-c.at<600000') && f.includes("p.innerHTML=dxFichePcsHTML(e);"));
  assert.ok(fn('dxFiche').includes('dxFicheNiveau(dxFicheEtat);'));
  assert.ok(css.includes('.dx-f-pcs .dx-pc.is-lvl>i{'));
});

test('la page Confidentialité le dit', () => {
  assert.ok(conf.includes('Ton niveau dans le parcours (de 1 à 5, calculé avec tes leçons validées) y est aussi enregistré, pour que les autres joueurs le voient dans ton profil de joueur.'));
});
