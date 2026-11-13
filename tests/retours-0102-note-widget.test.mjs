/* Elisa, 13 novembre, 1 h 02, sur la page du widget (« Je t’encouragerai directement depuis ton écran d’accueil ! ») :
   « par rapport à cette page, la mettre juste après le deuxième cours, et une notif Apple de noter l’application après le premier
   cours ».
   Après la première leçon validée : la fenêtre aux cinq étoiles d’iOS, demandée une fois. Après la deuxième : la page du widget.
   Jamais les deux au même retour à l’accueil. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = lire('index.html');
const pont = lire('resources/ios/widget/App/RequeteWidgetPlugin.swift');
const cut = (a, b) => { const i = html.indexOf(a); assert.ok(i >= 0, a); const j = html.indexOf(b, i + a.length); assert.ok(j > i, b); return html.slice(i, j); };

/* L’accueil, hors de l’app : un nombre de leçons validées, un faux pont natif, des minuteurs qu’on déclenche à la main */
const bloc = cut("const OB_WIDGET_VU='requete-widget-propose';", 'function obWidgetFin(){');
function accueil({ faites = 1, natif = true, note = false, widget = false, enLecon = false, feuille = false, reponse = { ok: true } } = {}) {
  const stock = new Map(); if (note) stock.set('requete-note-demandee', '1'); if (widget) stock.set('requete-widget-propose', '1');
  const minuteurs = [], appels = [];
  const ctx = vm.createContext({
    localStorage: { getItem: k => stock.has(k) ? stock.get(k) : null, setItem: (k, v) => stock.set(k, String(v)), removeItem: k => stock.delete(k) },
    state: { onboarded: true }, allLessons: [1, 2, 3, 4].map(id => ({ id })), lecCompletee: id => id <= ctx.faites, faites,
    activeTab: 'learn', enLecon, feuille, ouverts: [],
    obWidgetPossible: () => natif,
    ilePont: () => natif ? { nativePromise: (p, m, d) => { appels.push(p + ' ' + m); return reponse instanceof Error ? Promise.reject(reponse) : Promise.resolve(reponse); } } : null,
    setTimeout: (f, d) => { minuteurs.push([f, d]); return minuteurs.length; }, clearTimeout: () => {},
    document: { body: { classList: { contains: c => c === 'in-lesson' && ctx.enLecon } }, getElementById: () => null, querySelector: () => ctx.feuille ? {} : null },
  });
  ctx.startOnboarding = s => ctx.ouverts.push(s);
  vm.runInContext(bloc, ctx);
  /* Un retour à l’accueil : obWidgetBientot, puis ses minuteurs, dans l’ordre où ils sont posés */
  const retour = async () => { vm.runInContext('obWidgetBientot()', ctx); while (minuteurs.length) { minuteurs.shift()[0](); } await new Promise(r => setTimeout(r, 0)); };
  return { ctx, stock, appels, minuteurs, retour };
}

test('après la première leçon : la note de l’app est demandée à iOS, une fois ; la page du widget attend la deuxième', async () => {
  const a = accueil({ faites: 1 });
  await a.retour();
  assert.deepEqual(a.appels, ['RequeteWidget noter']);
  assert.equal(a.stock.get('requete-note-demandee'), '1');
  assert.deepEqual([...a.ctx.ouverts], [], 'pas de page du widget après la première leçon');
  /* Les retours suivants, toujours avec une seule leçon : plus rien */
  await a.retour(); await a.retour();
  assert.deepEqual(a.appels, ['RequeteWidget noter'], 'une seule demande');
  assert.deepEqual([...a.ctx.ouverts], []);
  /* La deuxième leçon validée : la page du widget, une fois */
  a.ctx.faites = 2;
  await a.retour();
  assert.deepEqual([...a.ctx.ouverts], ['widget']);
  assert.equal(a.stock.get('requete-widget-propose'), '1');
  await a.retour();
  assert.deepEqual([...a.ctx.ouverts], ['widget']);
  assert.deepEqual(a.appels, ['RequeteWidget noter']);
});

test('jamais les deux au même retour : deux leçons faites d’affilée, la note d’abord, le widget au retour suivant', async () => {
  const a = accueil({ faites: 2 });
  await a.retour();
  assert.deepEqual(a.appels, ['RequeteWidget noter']);
  assert.deepEqual([...a.ctx.ouverts], []);
  await a.retour();
  assert.deepEqual([...a.ctx.ouverts], ['widget']);
});

test('la note ne passe pas par-dessus autre chose, attend la fin de l’animation, et se redemande si iOS n’a pas pu la recevoir', async () => {
  /* Rien avant la première leçon ; rien hors de l’app iPhone (le site) */
  for (const o of [{ faites: 0 }, { natif: false }, { note: true }]) { const a = accueil(o); await a.retour(); assert.deepEqual(a.appels, [], JSON.stringify(o)); }
  /* En pleine leçon ou sous une feuille : ni note ni widget */
  for (const o of [{ enLecon: true }, { feuille: true }]) { const a = accueil({ faites: 2, ...o }); await a.retour(); assert.deepEqual(a.appels, []); assert.deepEqual([...a.ctx.ouverts], []); }
  /* Les délais : 0,9 s après le retour à l’accueil, puis 1,7 s (le cadenas de la leçon suivante s’ouvre en 1,6 s) */
  const a = accueil({ faites: 1 });
  vm.runInContext('obWidgetBientot()', a.ctx);
  assert.equal(a.minuteurs.length, 1); assert.equal(a.minuteurs[0][1], 900);
  a.minuteurs.shift()[0]();
  assert.equal(a.minuteurs.length, 1); assert.equal(a.minuteurs[0][1], 1700);
  assert.deepEqual(a.appels, [], 'pas encore');
  /* Parti de l’accueil entre-temps : la demande ne part pas, et rien n’est noté comme demandé */
  a.ctx.activeTab = 'planning';
  a.minuteurs.shift()[0]();
  assert.deepEqual(a.appels, []);
  assert.equal(a.stock.has('requete-note-demandee'), false);
  /* Le pont n’a pas pu (pas de fenêtre, ou une app plus ancienne sans la méthode) : on redemandera */
  for (const reponse of [{ ok: false }, new Error('méthode inconnue')]) {
    const b = accueil({ faites: 1, reponse });
    await b.retour();
    assert.deepEqual(b.appels, ['RequeteWidget noter']);
    assert.equal(b.stock.has('requete-note-demandee'), false);
    assert.deepEqual([...b.ctx.ouverts], [], 'et le widget n’a pas pris sa place');
  }
  /* Le retour à l’accueil déclenche le tout */
  const bientot = cut('function obWidgetBientot(){', '\n}\n');
  assert.ok(bientot.includes("      if(activeTab!=='learn'||noteProposer())return;\n"), 'la note d’abord ; si elle part, le widget attend le retour suivant');
  assert.ok(bientot.includes("      obWidgetT=setTimeout(()=>{try{if(activeTab==='learn')obWidgetProposer();}catch(e){}},1100);"), 'la page du widget : 2 s après le retour, une fois la leçon suivante ouverte sur le chemin');
  {
    const w = accueil({ faites: 2, note: true });
    vm.runInContext('obWidgetBientot()', w.ctx);
    assert.equal(w.minuteurs[0][1], 900); w.minuteurs.shift()[0]();
    assert.equal(w.minuteurs[0][1], 1100); assert.deepEqual([...w.ctx.ouverts], []);
    w.minuteurs.shift()[0]();
    assert.deepEqual([...w.ctx.ouverts], ['widget']);
  }
  assert.ok(html.includes("  if(name==='learn'&&typeof obWidgetBientot==='function')obWidgetBientot();"));
  assert.ok(bloc.includes('    if(leconsFaitesN()<2)return false;'), 'le widget : à partir de deux leçons');
});

test('côté iPhone : la fenêtre d’Apple (StoreKit), jamais un écran maison ; « Noter Requête » reste dans Mon compte', () => {
  assert.ok(pont.includes('import StoreKit\n'));
  assert.ok(pont.includes('        CAPPluginMethod(name: "abonnementGerer", returnType: CAPPluginReturnPromise),\n        CAPPluginMethod(name: "noter", returnType: CAPPluginReturnPromise)\n    ]'));
  const m = pont.slice(pont.indexOf('    @objc func noter(_ call: CAPPluginCall) {'), pont.indexOf('// MARK: - La leçon en cours'));
  assert.ok(m.includes('guard let scene = self.bridge?.viewController?.view.window?.windowScene else {'));
  assert.ok(m.includes('Task { @MainActor in\n                if #available(iOS 16.0, *) {\n                    AppStore.requestReview(in: scene)\n                } else {\n                    SKStoreReviewController.requestReview(in: scene)\n                }\n                call.resolve(["ok": true])'));
  assert.ok(!m.includes('call.reject('), 'jamais rejeté : ok vaut faux si la fenêtre de l’app manque');
  assert.equal(m.split('}').length, m.split('{').length + 1, 'la méthode se ferme, puis la classe');
  /* La ligne de Mon compte ouvre toujours la page d’avis de l’App Store : c’est elle qui répond à un geste, pas la fenêtre d’iOS */
  const n = cut('function noterAppli(){', '\n}\n');
  assert.ok(n.includes('?action=write-review') && !n.includes("'noter'"));
});
