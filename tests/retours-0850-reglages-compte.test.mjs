/* 20 novembre, 8 h 50 (Elisa : « Ok », pour faire suivre au compte ce qui restait sur l’iPhone) : la vitesse des vidéos et la place
   des stickers sur le tableau partent avec le profil (reglages : vitesse, stk0…, stkN). Un appareil d’avant (sans stkN ni vitesse)
   ne vide pas le tableau et ne remet pas la vitesse à 1. L’heure du rappel suivait déjà le compte. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
const app = fs.readFileSync(path.join(path.resolve(import.meta.dirname, '..'), 'index.html'), 'utf8');
const loc = app.slice(app.indexOf('function csProfilLocal(){'), app.indexOf('function csProfilMaj(cur){'));
const ap = app.slice(app.indexOf('function csProfilAppliquer(d){'), app.indexOf('function compteAutre(id){'));

test('ce qui part : la vitesse, le tableau en morceaux de 200 caractères, et le marqueur stkN', () => {
  assert.ok(loc.includes("reglages.rappelHeure=rappelHeure();"), 'l’heure du rappel, déjà');
  assert.ok(loc.includes("if(typeof LV_RATE==='number')reglages.vitesse=LV_RATE;"));
  assert.ok(loc.includes("if(cur&&cur.length+1+t.length>200){bouts.push(cur);cur='';}") && loc.includes("reglages.stkN=Math.min(20,bouts.length);"));
});
test('ce qui revient : seulement si le profil les connaît ; les stickers gagnés recomptés sans page', () => {
  assert.ok(ap.includes("LV_RATES.includes(r)&&r!==LV_RATE"));
  assert.ok(ap.includes("if(typeof G.stkN==='number'&&typeof stkState==='function'){"));
  assert.ok(ap.includes("if(typeof stkSync==='function'){try{stkSync();}catch(e){}}") && !ap.includes('stkAfterProgress()'));
  assert.ok(ap.includes("if(!/^[a-z0-9]{2,16}$/.test(id||'')||!S.got[id]||board.some(q=>q.id===id))continue;"));
});
