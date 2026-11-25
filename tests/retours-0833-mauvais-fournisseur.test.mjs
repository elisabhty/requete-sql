/* Elisa, 25 novembre, 8 h 33 : appli réinstallée, « J’ai déjà un compte », Apple alors que son compte est sur Google : « ça a créé un
   compte sans onboarding », ni stickers. Le compte Apple, ouvert par erreur la veille, n’avait qu’un planning (ni pseudo, ni
   progression) et passait pour connu. Et deux comptes neufs (Apple, Google) se renvoyaient « Ce compte est nouveau » sans fin. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const fn = nom => { const i = html.indexOf('function ' + nom + '('); return html.slice(i, html.indexOf('\n}\n', i) + 2); };

test('un compte n’est connu qu’avec de la progression, des notes, ou un planning et un pseudo', () => {
  const connu = (distant, pseudo, planLocal = false) => vm.runInNewContext(fn('obCompteConnu') + ';obCompteConnu({distant})',
    {distant, psMien: () => pseudo, CS: {distant: null}, state: {plan: planLocal ? {sessions: [1]} : null}, Array});
  assert.equal(connu({plan: true, progres: false, notes: false}, ''), false, 'planning seul, sans pseudo : les questions');
  assert.equal(connu({plan: true, progres: false, notes: false}, '@elisa'), true, 'planning et pseudo : connu');
  assert.equal(connu({plan: false, progres: true, notes: false}, ''), true, 'de la progression : connu');
  assert.equal(connu({plan: false, progres: false, notes: true}, ''), true, 'des notes : connu');
  assert.equal(connu({plan: false, progres: false, notes: false}, '@elisa'), false, 'rien : neuf');
  assert.equal(connu(null, '', true), true, 'sans réponse du compte : le planning de l’appareil décide, comme avant');
});

test('l’autre fournisseur n’est proposé qu’une fois (plus de va-et-vient entre deux comptes neufs)', () => {
  assert.ok(html.includes('let obAutreEssaye=false;\nasync function compteChangerFournisseur(a){\n  obAutreEssaye=true;'));
  assert.ok(html.includes('if(autreF&&!obAutreEssaye&&await compteProposerAutre(provider,autreF)){compteChangerFournisseur(autreF);return;}'));
});
