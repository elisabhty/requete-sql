/* Elisa, 17 novembre, 15 h 37 (leçon DISTINCT, moment 3 « À la main ») : « quand on fait rejouer les moments ratés on peut refaire la
   question, mais plus là ». Depuis le 16 novembre, les réponses des vidéos suivent le compte : la synchro rajoutait le moment effacé
   par « Rejouer les moments ratés », et il s’ouvrait déjà fait. Même chose pour « Tout recommencer » et « Recommencer cette leçon ». */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i); assert.ok(j > i, b); return app.slice(i, j); };

/* Les fonctions des marques, avec un compte et une synchro simulés */
function banc() {
  const code = cut("const LV_REJEU_KEY='rq-video-rejeu';", 'function lvAnsGet(');
  const mem = new Map();
  const localStorage = {getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, String(v))};
  const CS = {user: 'u1'};
  const resets = [];
  const cs = {user: 'u1', prog: {reset: async (k, c) => { resets.push([k, c]); return {ok: true}; }}};
  let connecte = true;
  const f = new Function('localStorage', 'CS', 'csPret', 'csPlusTard', code + '\nreturn {LV_REJEU,lvRejeuNoter,lvRejeuBloque,lvRejeuFait,lvRejeuCompte,lvRejeuNettoyer};');
  const api = f(localStorage, CS, () => connecte ? cs : null, () => {});
  return {...api, cs, resets, sans: () => { connecte = false; }};
}

test('rejouer deux moments : ils ne reviennent plus du compte, qui est remis à zéro ; refait, un moment se reprend normalement', async () => {
  const B = banc();
  B.lvRejeuNoter(13, ['p2', 'p4']);
  assert.ok(B.lvRejeuBloque(13, 'p2') && B.lvRejeuBloque(13, 'p4'));
  assert.ok(!B.lvRejeuBloque(13, 'p0') && !B.lvRejeuBloque(13, '0') && !B.lvRejeuBloque(13, 'lecon') && !B.lvRejeuBloque(14, 'p2'));
  const lu = Date.now() - 10;
  await B.lvRejeuCompte(B.cs);
  assert.deepEqual(B.resets, [['video:13', 'RECOMMENCER']]);
  await B.lvRejeuCompte(B.cs);
  assert.equal(B.resets.length, 1, 'une seule remise à zéro par marque');
  B.lvRejeuNettoyer(lu);
  assert.ok(B.lvRejeuBloque(13, 'p2'), 'la lecture faite avant la remise à zéro ne compte pas');
  B.lvRejeuFait(13, 'p2');
  assert.ok(!B.lvRejeuBloque(13, 'p2') && B.lvRejeuBloque(13, 'p4'));
  B.lvRejeuNettoyer(Date.now() + 10);
  assert.ok(!B.lvRejeuBloque(13, 'p4') && !Object.keys(B.LV_REJEU).length);
});

test('tout recommencer : tous les moments ; recommencer la leçon : la leçon et sa vidéo ; sans compte, rien à noter', async () => {
  const B = banc();
  B.lvRejeuNoter(7, ['p*']);
  assert.ok(B.lvRejeuBloque(7, 'p0') && B.lvRejeuBloque(7, 'p11') && !B.lvRejeuBloque(7, '3'));
  B.lvRejeuNoter(9, ['*'], true);
  assert.ok(B.lvRejeuBloque(9, 'lecon') && B.lvRejeuBloque(9, 'p1') && B.lvRejeuBloque(9, '2'));
  await B.lvRejeuCompte(B.cs);
  assert.deepEqual(B.resets.map(r => r[0]).sort(), ['lesson:9', 'video:7']);
  const C = banc(); C.sans(); C.lvRejeuNoter(5, ['p1']);
  assert.ok(!C.lvRejeuBloque(5, 'p1') && !Object.keys(C.LV_REJEU).length);
});

test('les trois boutons notent la remise à zéro ; la synchro la fait sur le compte et n’ajoute pas ce qui est marqué', () => {
  assert.ok(cut('function lvRedo(list){', 'function lvRedoGo').includes("lvRejeuNoter(LV.id,list.map(i=>'p'+i));"));
  assert.ok(app.includes("function lvPkReset(id){ if(typeof lvRejeuNoter==='function')lvRejeuNoter(id,['p*']);"));
  assert.ok(app.includes("lvRejeuNoter(id,['*'],true); }"), 'lvForget : Recommencer cette leçon');
  assert.ok(app.includes("lvAnsSave(); if(typeof lvRejeuFait==='function')lvRejeuFait(id,'p'+i); }"), 'lvPkSet : un moment refait sort de la liste');
  const sync = cut('function csSync(o){', 'const x=csExtraire()');
  assert.ok(sync.indexOf('const lu=Date.now();') < sync.indexOf('cs.prog.pull()') && sync.includes('await lvRejeuCompte(cs);') && sync.includes('lvRejeuNettoyer(lu);'));
  const ap = cut('function csAppliquer(prog,docs,premier){', "else if(kind==='planning'");
  assert.ok(ap.includes("lvRejeuBloque(k,'lecon'))continue;"));
  assert.ok(ap.includes("if(!o[q]&&v&&typeof v==='object'&&!(typeof lvRejeuBloque==='function'&&lvRejeuBloque(k,q))){o[q]=v;m=true;}"));
  assert.ok(ap.includes("!(L[k]&&L[k].done)&&!(typeof lvRejeuBloque==='function'&&lvRejeuBloque(k,'lecon'))"));
});
