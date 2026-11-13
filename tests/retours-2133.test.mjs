/* Elisa, 11 novembre, 21 h 33 : « Il faut que la micro-interaction de la suppression de notes soit la micro-interaction de suppression
   de partout, qu’elle soit homogène. Pour les nouveaux stickers, ça sera une page. Pour les cartes mémo, ça sera dans les pages finales,
   les bilans. Donc pas de notification. Stickers retirés du tableau, tableau vidé, micro-interaction. Pour les un jour de série, c’est
   une page et pas la notif. Pareil pour les points : lors d’un jeu en solo ou en multijoueur, c’est une page et pas une notif. Et la
   page, elle nous demande d’aller voir le bilan. Pareil pour le rappel enregistré, ça sera une micro-interaction et pas la notif. » */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const fn = name => { const i = app.indexOf(`function ${name}(`); assert.ok(i >= 0, name); const j = app.indexOf('\n}\n', i); return app.slice(i, j + 3); };
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i); assert.ok(j > i, b); return app.slice(i, j); };

/* Un DOM de poche pour la poubelle */
function scene(cartes, o = {}) {
  const log = { anims: [], timers: [], ajoute: [] };
  const el = tag => {
    const e = { tag, style: {}, attrs: {}, kids: [], cls: new Set(), setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.kids.push(c); return c; },
      append(...c) { this.kids.push(...c); }, remove() { this.removed = true; }, animate(k, op) { log.anims.push({ el: this, k, o: op }); return {}; } };
    Object.defineProperty(e, 'className', { get() { return [...e.cls].join(' '); }, set(v) { e.cls = new Set(String(v).split(/\s+/).filter(Boolean)); } });
    e.classList = { add: c => e.cls.add(c), remove: c => e.cls.delete(c) };
    Object.defineProperty(e, 'innerHTML', { get() { return e._h || ''; }, set(v) { e._h = v; e.firstChild = el('i'); } });
    return e;
  };
  const parent = { display: 'flex', rowGap: '8px' };
  const mk = (k, top) => Object.assign(el('div'), { k, isConnected: true, offsetHeight: 60, previousElementSibling: k ? {} : null, parentElement: parent,
    getBoundingClientRect: () => ({ left: 16, right: 377, top, bottom: top + 60, width: 361, height: 60 }) });
  const cs = cartes.map((top, k) => mk(k, top));
  const body = { appendChild: c => { log.ajoute.push(c); return c; } };
  const ctx = vm.createContext({
    innerWidth: 393, innerHeight: 852, Math, Object, String, Array, isFinite,
    document: { createElement: el, body }, getComputedStyle: e => (e === parent ? parent : { paddingTop: '10px', paddingBottom: '10px' }),
    prefersReduceMotion: () => false, buzz() {}, setTimeout: (f, ms) => { log.timers.push([ms, f]); return 1; },
    lqCentreDe: e => e.centre, LV: null, MU: null,
  });
  vm.runInContext(cut('const LQC_INK=', 'function lqCorbSon(') + fn('lqCorbeille'), ctx);
  let fini = 0;
  ctx.lqCorbeille(cs, () => fini++, { son: false, ...o });
  return { log, cs, fini: () => fini, S: log.ajoute[0] };
}

test('la poubelle partout : plusieurs cartes, quatre boulettes au plus, lancées l’une après l’autre ; le couvercle attend la dernière', () => {
  const s = scene([100, 170, 240, 310, 380], { pas: 45 });
  const balles = s.S.kids.filter(k => k.className === 'lqc-x');
  assert.equal(balles.length, 4, 'quatre boulettes au plus');
  const y = s.log.anims.filter(a => balles.some(b => b.kids[0] === a.el)).map(a => a.o.delay);
  assert.deepEqual(y, [420, 540, 660, 780], 'une toutes les 120 ms');
  const cartes = s.log.anims.filter(a => s.cs.includes(a.el));
  assert.equal(cartes.length, 5, 'les cinq cartes se froissent');
  assert.deepEqual(cartes.map(a => a.o.delay), [0, 45, 90, 135, 180], 'en cascade');
  assert.equal(cartes[0].o.duration, 1800 + 360, 'la scène s’allonge du temps des lancers');
  const lid = s.S.kids.find(k => k.className === 'lqc-p lqc-lid').firstChild;
  assert.equal(s.log.anims.filter(a => a.el === lid)[1].o.delay, 810 + 360, 'le couvercle claque après la dernière');
  const fin = s.log.timers.find(([, f]) => { const n = s.fini(); f(); const ok = s.fini() > n; return ok; });
  assert.equal(fin[0], 2160 + 4 * 45, 'la liste se redessine après la dernière carte');
});

test('la poubelle depuis un point (une chose déjà partie) : une boulette, et la suite tout de suite ; hors de l’écran, au milieu', () => {
  const s = scene([], { depuis: { getBoundingClientRect() {}, centre: { x: 200, y: 400 } } });
  assert.equal(s.fini(), 1, 'rien ne se referme : tout de suite');
  assert.equal(s.S.kids.filter(k => k.className === 'lqc-x').length, 1);
  const b = s.S.kids.find(k => k.className === 'lqc-x');
  assert.equal(b.style.transform, 'translateX(178px)', 'née au point, au moins à 90 px de la poubelle (sortie à sa droite)');
  const loin = scene([], { depuis: { x: 200, y: 1400 } });
  const y = loin.S.kids.find(k => k.className === 'lqc-x').kids[0].style.transform;
  assert.equal(y, `translateY(${852 * .48}px)`, 'sous l’écran : la scène se joue au milieu');
  const rien = scene([]);
  assert.equal(rien.fini(), 1); assert.equal(rien.log.ajoute.length, 0, 'ni carte ni point : rien');
});

test('les suppressions passent toutes par la poubelle ; la coche reste pour le reste', () => {
  assert.ok(!app.includes('function lqAdieu(') && !app.includes('LQ_POUBELLE_SVG'));
  assert.ok(fn('lqDone').includes("if(lqEstSuppr(label)){ if(typeof lqCorbeille==='function')lqCorbeille([],null,{depuis:el}); return; }"));
  for (const [nom, bout] of [['clearConsoleHistory', "lqCorbeille([...document.querySelectorAll('#console-hist .console-query-row')].slice(0,10),()=>{"],
    ['deleteDbNow', "lqCorbeille([ligne&&ligne.closest('.console-project-row')],()=>{"], ['dbCartesAdieu', 'lqCorbeille(cartes,suite,'],
    ['mergeDuplicateNotes', 'lqCorbeille(r?[...drop]'], ['ctRetirer', 'lqCorbeille([chip],()=>{'], ['deleteNote', 'lqCorbeille(carte,fin,{son})']])
    assert.ok((nom === 'clearConsoleHistory' ? cut('function clearConsoleHistory(){', 'function loadHistSql(') : fn(nom)).includes(bout), nom);
  assert.ok(fn('saveNote').includes('if(empty&&!wasNew){ deleteNote(e.id); return; }') && !app.includes("'Note vide supprimée'"), 'une note vidée : la poubelle aussi');
  assert.ok(fn('clsQuitter').includes("lqDone(document.querySelector('#scr-compte .acct-data'),'Retiré','Tes scores sont retirés du classement.');"));
  assert.ok(cut('async function resetAllProgress(', '\n}\n').includes("lqDone(document.querySelector('#scr-compte .acct-data'),'Effacé','Ta progression est effacée.')"));
});

test('stickers décollés : plus de bandeau ni d’« Annuler », ils rentrent dans leur case en volant (ou dans le compteur)', () => {
  const r = fn('stkRemove'), c = fn('stkClearBoard'), v = fn('stkVolRentrer');
  assert.ok(r.includes('const vols=stkVolPrendre([id]);') && r.includes('stkVolRentrer(vols);') && !r.includes('toast'));
  assert.ok(c.includes('const vols=stkVolPrendre(S.board.map(b=>b.id));') && c.includes('stkVolRentrer(vols);') && !c.includes('toast'));
  assert.ok(v.includes("const c=document.getElementById('stk-sheet-t')?.nextElementSibling;"), 'sa case hors de l’écran : le compteur');
  assert.ok(v.includes('const d=k*90'), 'l’un après l’autre');
  assert.ok(app.includes('.stk-vol{position:fixed;z-index:9997;pointer-events:none;'));
});

test('nouveaux stickers : une page, plusieurs ensemble sur la même ; plus de bandeau', () => {
  assert.ok(!app.includes('function stkAnnounce('));
  const h = fn('stkPageHtml');
  assert.ok(h.includes("const txt=plus?`Tu as gagné ${liste}. Voici tes stickers&nbsp;!`"));
  assert.ok(h.includes("${plus?`${ids.length} nouveaux stickers`:esc(info.name)}") && h.includes('ids.slice(0,3).map(x=>`<span class="mu-st-i">${stkArtHtml(x,\'art\')}</span>`)'));
  assert.ok(h.includes('<span>${Math.max(0,n-ids.length)}</span><span>${n}</span>'), 'le compteur monte d’autant');
  const ctx = vm.createContext({});
  const liste = noms => vm.runInContext(`(${JSON.stringify(noms)}).map(x=>'«'+x+'»')`, ctx);
  assert.equal(liste(['A']).length, 1);
  assert.ok(app.includes('.mu-done.is-multi .mu-st-i:nth-child(1){transform:rotate(-13deg) translateY(7%)}'));
  assert.ok(app.includes('.mu-acc.is-still .mu-done{display:block;opacity:1}'), 'mouvement réduit : le sticker se voit');
});

test('la série du jour et les points : des pages, plus de notifications ; la page des points mène au bilan', () => {
  assert.ok(!app.includes('function lqStreakToast(') && !app.includes('function jeuPtsPop('));
  const p = fn('jeuPtsPage');
  assert.ok(p.includes("const kick=M?`Manche ${M.n+1}/${M.nb} terminée`:issue==='victoire'?'Victoire\\u00a0!':o.solo?'Partie solo terminée':'Partie terminée';") && p.includes("const suite=M?'Voir le classement':issue==='victoire'||issue==='defaite'?'Voir le podium':'Voir le bilan';") && p.includes('<button type="button" class="mu-x" aria-label="${suite}">'));
  assert.ok(p.includes("const fermer=()=>moduleUpClose();") && p.includes("if(auto)MU.timers.push(setTimeout(()=>{if(MU&&MU.el===el)fermer();},FIN_MS));") && p.includes("el.querySelector('.mu-x').addEventListener('click',fermer);"), 'la page se referme seule sur le bilan, ou d’un toucher sur la croix (18 h 48)');
  assert.ok(p.includes("if(MU){ clearTimeout(jeuPtsPage.t); jeuPtsPage.t=setTimeout(()=>jeuPtsPage(o),900); return; }"), 'une page à la fois');
});

test('cartes mémo : le bilan, sans notification ; le rappel enregistré : la coche', () => {
  assert.equal(fn('showUnlock').includes('toast'), false);
  const l = fn('leconSeuleBilan');
  assert.ok(l.indexOf('if(first)showUnlock(current.id);') < l.indexOf('renderLessonFlow();'), 'avant le bilan : « Nouvelle carte mémo ! »');
  const r = fn('rappelEnregistrer');
  assert.ok(!r.includes("toast(") && r.includes("lqDone(ligne(),d.on?'Enregistré':'Désactivé',dit)"));
});
