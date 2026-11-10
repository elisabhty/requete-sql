/* Elisa, 10 novembre, 7 h 56 (« Mettre la leçon en pause depuis l’île : un bouton Pause / Reprendre directement dans l’île pendant
   la vidéo », ok) : la vidéo se met en pause quand on quitte l’app ; l’île le sait et propose « Reprendre » (un lien vers l’app, qui
   relance la vidéo là où elle s’était arrêtée). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html');
const swift = lire('resources/ios/widget/RequeteWidget/RequeteWidget.swift');
const pont = lire('resources/ios/widget/App/RequeteWidgetPlugin.swift');
const entre = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j); };

test('l’état de la leçon dit la pause ; le pont la lit, l’île et l’écran verrouillé montrent « Reprendre »', () => {
  for (const t of [swift, pont]) assert.ok(entre(t, 'struct RequeteLecon: ActivityAttributes {', '\n}\n').includes('var pause: Bool? = nil'));
  assert.ok(entre(pont, 'static func moments(', '\n    }\n').includes('e.pause = call.getBool("pause")'));
  assert.ok(swift.includes('func leconEnPause(_ e: RequeteLecon.ContentState) -> Bool {\n    return e.pause == true && !e.fini\n}'));
  const bouton = entre(swift, 'struct LeconReprendre: View {', '\n}\n');
  assert.ok(bouton.includes('Link(destination: lienSalle("lecon-reprendre"))') && bouton.includes('Image(systemName: "play.fill")') && bouton.includes('Text("Reprendre")'));
  const act = entre(swift, 'struct RequeteLeconActivite: Widget {', '\n}\n');
  assert.ok(act.includes('if leconEnPause(context.state) {\n                            LeconReprendre()'), 'l’île ouverte');
  assert.ok(entre(swift, 'struct LeconVerrouille: View {', '\n}\n').includes('if leconEnPause(etat) {\n                    LeconReprendre()'), 'l’écran verrouillé');
});

test('la page : la pause part dès qu’elle change ; « Reprendre » relance la vidéo', () => {
  const js = entre(app, 'function ilePause(){', '\nfunction ileFin(');
  const appels = [];
  const V = {paused: false, ended: false};
  const ctx = vm.createContext({LV: {id: 4, video: V, fin: false}, ileEtat: {id: 4, pas: 3, vus: null, pause: false},
    ileProgression: () => 0.31, ileMoments: () => null, ileAllumee: () => false, ileAppel: (m, d) => appels.push([m, d])});
  vm.runInContext(js + ';this.ileMaj=ileMaj;', ctx);
  ctx.ileMaj(false); assert.equal(appels.length, 0, 'même dixième, pas de pause : rien');
  V.paused = true; ctx.ileMaj(false);
  assert.deepEqual(JSON.parse(JSON.stringify(appels.pop())), ['leconMaj', {progression: 0.31, allumee: false, pause: true}], 'la pause part tout de suite');
  ctx.ileMaj(false); assert.equal(appels.length, 0, 'déjà dite');
  V.paused = false; ctx.ileMaj(false); assert.equal(appels.pop()[1].pause, false, 'la reprise aussi');
  V.paused = true; V.ended = true; ctx.ileMaj(false); assert.equal(appels.length, 0, 'une vidéo finie n’est pas en pause');
  /* Les événements de la vidéo et le lien de l’île */
  assert.ok(app.includes("if(!video.ended)root.classList.add('is-paused'); lvSyncPP(); if(LV&&LV.video===video)ileMaj(false); lvPosKeep(); });"), 'pause');
  assert.ok(app.includes("if(LV&&LV.op)lvOpClose(); lvSyncPP(); if(LV&&LV.video===video)ileMaj(false); });"), 'lecture');
  const r = entre(app, 'function raccourciOuvrir(type){', '\n  const salle=');
  assert.ok(r.includes("if(type.endsWith('.lecon-reprendre')){") && r.includes('LV.video.paused&&typeof lvPlay===\'function\')lvPlay();'));
});
