import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

/* 13 novembre, 20 h 04 (Elisa : « Oui, pour le widget, s’il te plaît ») : quels widgets sont posés, une fois par jour. */
const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html');
const fn = n => { const a = app.indexOf(`function ${n}(`); assert.ok(a > 0, n); return app.slice(a, app.indexOf('\n}\n', a) + 2); };

test('le pont natif : la liste « genre:taille » des widgets posés, rien d’autre', () => {
  const p = lire('resources/ios/widget/App/RequeteWidgetPlugin.swift');
  assert.ok(p.includes('CAPPluginMethod(name: "noter", returnType: CAPPluginReturnPromise),\n        CAPPluginMethod(name: "widgetsPoses", returnType: CAPPluginReturnPromise)\n    ]'));
  assert.ok(p.includes('@objc func widgetsPoses(_ call: CAPPluginCall) {\n        WidgetCenter.shared.getCurrentConfigurations { resultat in'));
  assert.ok(p.includes('liste = infos.map { info in info.kind + ":" + String(describing: info.family) }'));
  assert.ok(p.includes('call.resolve(["ok": true, "widgets": liste])'));
  const i = p.indexOf('@objc func widgetsPoses'), fin = p.indexOf('// MARK: - La leçon en cours (Live Activity)');
  assert.ok(i > 0 && fin > i && p.slice(i, fin).trim().endsWith('}\n}') , 'dans la classe du plugin');
});

test('la page : une fois par jour, le nombre et la liste ; une app sans la méthode, rien', async () => {
  const envoyes = [], vu = {};
  let rep = { ok: true, widgets: ['RequeteSerie:systemSmall', 'RequeteCheminee:systemMedium'] };
  const ctx = vm.createContext({
    window: { Capacitor: { isNativePlatform: () => true, nativePromise: (p, m) => (m === 'widgetsPoses' ? (rep instanceof Error ? Promise.reject(rep) : Promise.resolve(rep)) : Promise.resolve({})) } },
    statActif: () => true, statJour: () => '2026-11-13', STAT_VU: 'vu',
    localStorage: { getItem: () => JSON.stringify(vu) },
    statUneFois: (t, cle, v, d) => { if (vu[cle]) return false; vu[cle] = 1; envoyes.push([t, v, d]); return true; }
  });
  vm.runInContext(fn('statWidgetsPoses'), ctx);
  await ctx.statWidgetsPoses();
  assert.deepEqual(JSON.parse(JSON.stringify(envoyes)), [['widget_pose', 2, { k: 'RequeteCheminee:systemMedium,RequeteSerie:systemSmall' }]]);
  await ctx.statWidgetsPoses();
  assert.equal(envoyes.length, 1, 'une fois par jour');
  ctx.statJour = () => '2026-11-14'; rep = new Error('méthode inconnue');
  await ctx.statWidgetsPoses();
  assert.equal(envoyes.length, 1, 'une app d’avant : rien');
  rep = { ok: true, widgets: [] };
  await ctx.statWidgetsPoses();
  assert.deepEqual(JSON.parse(JSON.stringify(envoyes.at(-1))), ['widget_pose', 0, { k: '' }], 'sans widget : 0');
  assert.ok(fn('raccourcisBrancher').includes('setTimeout(()=>{try{statWidgetsPoses();}catch(e){}},6000);'));
});

test('le serveur : widget_pose, et deux chiffres dans « reglages »', () => {
  const sql = lire('supabase/migrations/20261113190639_stat_widgets_poses.sql');
  assert.ok(sql.includes("'sticker','partage','widget_pose'];") && sql.includes("'widgets_poses'") && sql.includes("'widgets_par_genre'"));
  assert.ok(lire('decouvrir/confidentialite.html').includes('les widgets posés (leur genre et leur taille)'));
});
