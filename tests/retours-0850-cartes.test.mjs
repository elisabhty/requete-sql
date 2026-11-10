/* Elisa, 10 novembre, 8 h 50 (deux captures de Bibliothèque › Cartes mémo) : « Pb de formatage / vérification responsivité avec tous
   les iPhone ; 0 leçon validée sur 5, c’est quoi les 5 ? Vérifie qu’il n’y a pas d’erreur de calcul ailleurs ; ne plus mettre voir
   les leçons sur les cartes. »
   - « Base relationnelle » restait sur une ligne, trop grand, coupé au bord de la carte : Safari mesurait le mot-clé avant de connaître
     la largeur de la carte (100cqi), comme la pastille « Voir la leçon » le 7 novembre (8 h 17). Dans l’album, la taille suit la largeur
     de l’écran ; une notion en mots se mesure à son mot le plus long et passe à la ligne entre ses mots.
   - Plus de « Voir la leçon » sur les cartes à débloquer.
   - Les chiffres : la fiche d’un sticker de module dit ses leçons (en liste) ; jamais « 0 … sur » ; l’en-tête de la collection ne dit
     plus « 0 module complet » ni deux fois le même nombre. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'ludique.css'), 'utf8');
const fn = (debut, fin = '\n}\n') => { const i = app.indexOf(debut); assert.ok(i >= 0, debut); return app.slice(i, app.indexOf(fin, i) + fin.length); };

test('l’album suit la largeur de l’écran (pas la carte), de l’iPhone SE au Pro Max ; plus de « Voir la leçon »', () => {
  const sec = css.slice(css.indexOf('/* ---------- 64. Les cartes de l’album, sur tous les iPhone'));
  for (const r of ['html.lq .mc--album{--mc-w:calc(50vw - 52px)}', '@media (max-width:350px){html.lq .mc--album{--mc-w:calc(50vw - 44px)}}',
    '@media (min-width:600px){html.lq .mc--album{--mc-w:160px}}',
    'html.lq .mc--album .mc-k{font-size:clamp(12px,calc((var(--mc-w) - 30px) / (var(--kn,8) * .6)),calc(21px * var(--mc-fs)))}',
    'html.lq .mc--album .mc-k.is-mot{font-size:clamp(12.5px,calc((var(--mc-w) - 30px) / (var(--kn,8) * .58)),calc(20px * var(--mc-fs)))}',
    'html.lq .mc--album .mc-lesson{font-size:clamp(11px,calc((var(--mc-w) - 32px) / (var(--kn,10) * .62)),calc(14px * var(--mc-fs)))}'])
    assert.ok(sec.includes(r), r);
  assert.ok(!/mc--album[^{]*\{[^}]*cqi/.test(sec), 'rien dans l’album ne dépend de la carte');
  assert.ok(!app.includes('class="mc-go"') && !css.includes('.mc-go'), 'plus de pastille « Voir la leçon »');
  /* Le mot-clé de chaque carte tient dans la carte, de 375 (SE) à 440 px (16 Pro Max) : la taille calculée × la largeur d’un signe. */
  const ctx = vm.createContext({ esc: s => s });
  vm.runInContext(fn('function memoKn(s)', '}\n') + fn('function memoKw(k,cls=\'\'){'), ctx);
  const cartes = vm.runInContext('(' + app.slice(app.indexOf('const CARTES=') + 13, app.indexOf('};\n', app.indexOf('const CARTES=')) + 1) + ')', vm.createContext({}));
  for (const vw of [375, 390, 393, 402, 414, 428, 430, 440]) {
    const w = vw / 2 - 52;
    for (const [id, c] of Object.entries(cartes)) {
      const b = ctx.memoKw(c.k), kn = +b.match(/--kn:(\d+)/)[1], mot = b.includes('is-mot');
      const taille = Math.min(Math.max(mot ? 12.5 : 12, (w - 30) / (kn * (mot ? .58 : .6))), mot ? 20 : 21);
      assert.ok(taille * kn * (mot ? .58 : .6) <= w - 24 + .01, `${vw} px, carte ${id} « ${c.k} » : ${taille.toFixed(1)} px`);
    }
  }
  const base = ctx.memoKw('Base relationnelle');
  assert.ok(base.includes('class="mc-k is-mot"') && base.includes('--kn:13'), '« Base relationnelle » se mesure à « relationnelle »');
  assert.ok(ctx.memoKw('GROUP BY').includes('--kn:8'), 'GROUP BY reste ensemble');
});

test('la fiche d’un sticker de module : ses leçons en liste, jamais « 0 leçon sur 5 »', () => {
  const o = fn('function stkOpen(id){');
  assert.ok(o.includes("const progT=s.kind==='module'?(s.now?`${s.now} leçon${s.now>1?'s':''} validée${s.now>1?'s':''} sur ${s.goal}`:`${s.goal} leçon${s.goal>1?'s':''} dans ce module`)"));
  assert.ok(o.includes(":s.now?`${unit(s.now)} sur ${s.goal}`:`Objectif\\u00a0: ${unit(s.goal)}`;"), 'un accomplissement pas commencé : son objectif');
  assert.ok(o.includes('<ol class="stk-lecons" aria-label="${escAttr(`Les leçons du module ${s.num}`)}">') && o.includes('onclick="stkClose();openLesson(${l.id})"'), 'chaque leçon ouvre sa leçon');
  assert.ok(o.includes('${prog}${lecons}${go?'));
  for (const r of ['html.lq .stk-lecons{display:grid;', 'html.lq .stk-lecons .is-ok b{background:var(--mint);', 'html.lq .stk-lecons .is-suite b{background:var(--accent);color:#fff}'])
    assert.ok(css.includes(r), r);
});

test('l’en-tête de la collection : jamais « 0 carte » ni « 0 module complet », pas deux fois le même nombre', () => {
  const ctx = vm.createContext({ TOTAL_CARTES: 71 });
  vm.runInContext(fn('function collTitre(n)', '}\n') + fn('function collSous(n,mods,reste){'), ctx);
  assert.equal(ctx.collTitre(0), '71 cartes à gagner');
  assert.equal(ctx.collSous(0, 0, 71), 'Une carte à chaque leçon validée');
  assert.equal(ctx.collTitre(1), '1 carte débloquée');
  assert.equal(ctx.collSous(1, 1, 70), '1 module complet · encore 70 à obtenir sur 71');
  assert.equal(ctx.collSous(5, 0, 66), 'encore 66 à obtenir sur 71');
  assert.equal(ctx.collSous(71, 15, 0), '15 modules complets · collection complète');
  assert.ok(app.includes('<strong>${collTitre(n)}</strong><span>${collSous(n,completedModules,locked)}</span>'));
});
