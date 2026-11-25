/* 21 novembre, 8 h 01 (Elisa) : une notification par jour pour qui a accepté les notifications sans être entré dans le paywall (ses
   14 messages), et pour l’abonné qui n’a pas ouvert l’appli depuis 3 jours (ses 3 messages) ; en anglais aussi ; « une notif ne doit
   pas revenir la même semaine ». */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), en = fs.readFileSync(path.join(ROOT, 'langue-en.js'), 'utf8');
const bout = (a, b) => app.slice(app.indexOf(a), app.indexOf(b, app.indexOf(a)));

const ctx = (pwVu) => {
  const c = vm.createContext({ localStorage: { getItem: k => (k === 'rq-pw-vu' ? pwVu : null) } });
  vm.runInContext(bout('const RELANCE_IDS', 'let relanceSig') + "function parseD(s){const d=new Date(s+'T00:00:00');d.setHours(0,0,0,0);return d;}\n"
    + bout('function relanceNumeroDu', 'function relanceAuto') + ';this.R=RELANCE_MSG;this.A=ABSENCE_MSG;this.f=relanceMessageDu;', c);
  return c;
};

test('les textes d’Elisa : 15 relances (le 15e à 8 h 08), 3 pour l’absence, titre puis texte', () => {
  const c = ctx('2026-11-21');
  assert.equal(c.R.length, 15);
  assert.deepEqual([...c.R[14]], ['💍 Peur de l’engagement ?', 'C’est juste un abonnement, pas une demande en mariage.']); assert.equal(c.A.length, 3);
  assert.deepEqual([...c.R[0]], ['👀 SELECT * FROM excuses', 'On a cherché pourquoi tu n’as pas terminé ton abonnement. 0 résultat.']);
  assert.deepEqual([...c.R[13]], ['🤨 On doit s’inquiéter ?', 'Tu étais à un clic de t’abonner. Depuis, silence radio.']);
  assert.deepEqual([...c.A[2]], ['👻 Tu nous as ghostés', 'On avait déjà imaginé notre avenir ensemble… en SQL.']);
});
test('une par jour, le 1er message le lendemain du paywall, jamais deux fois la même semaine', () => {
  const c = ctx('2026-11-21'), jours = Array.from({ length: 60 }, (_, d) => c.f(new Date(2026, 10, 22 + d))[0]);
  assert.equal(jours[0], '👀 SELECT * FROM excuses');
  assert.equal(new Set(jours.slice(0, 15)).size, 15, 'les 15 en 15 jours');
  for (let i = 0; i < jours.length; i++) for (let j = i + 1; j < Math.min(jours.length, i + 7); j++) assert.notEqual(jours[i], jours[j], `jours ${i} et ${j}`);
});
test('qui les reçoit : le rappel accepté ; passé par le paywall sans abonnement, ou abonné absent', () => {
  assert.ok(app.includes("return {relance:on&&pwVu&&(onb?etat==='non':etat!=='oui'),absence:on&&onb&&etat==='oui'};"));
  assert.ok(app.includes("try{const p=await LN.checkPermissions();if(!p||p.display!=='granted')return;}catch(e){return;}"), 'jamais de demande d’autorisation ici');
  assert.ok(app.includes("relanceJours(demain,28,h,m)") && app.includes("relanceJours(new Date(Date.now()+3*864e5),3,h,m)"), '28 jours ; 3, 4 et 5 jours après la dernière ouverture');
  assert.ok(app.includes("if(slide==='paywall'&&!obLegalMode&&typeof relancePwVu==='function')relancePwVu();"));
});
test('en anglais', () => {
  for (const k of ['"On a cherché pourquoi tu n’as pas terminé ton abonnement. {1} résultat.": "We looked for the reason you didn’t finish subscribing. {1} rows returned."',
    '"💔 C’est un LEFT JOIN ?": "💔 Is this a LEFT JOIN?"', '"👻 Tu nous as ghostés": "👻 You ghosted us"', '"💍 Peur de l’engagement ?": "💍 Afraid of commitment?"', '"🍿 Saison {1} : le retour ?": "🍿 Season {1}: the comeback?"']) assert.ok(en.includes(k), k);
});
