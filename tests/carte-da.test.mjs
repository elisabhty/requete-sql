/* Elisa, 31 octobre, 7 h 57 (la feuille « Carte » d’une carte mémo) : « pareil, élève d’un niveau, surtout le À retenir (DA du site) ».
   6 novembre, 14 h 11 : « les cartes mémo doivent être super bien designées dans la DA du site internet », reformulées selon les grands
   points de chaque leçon ; 15 h 20, elle choisit la direction A du designer, « Scène à collectionner » : une carte, deux faces, la même
   partout. Le recto : la scène violette quadrillée, le numéro en autocollant, le mot-clé jaune. Le verso : « À retenir » (trois points),
   la syntaxe, le piège. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'ludique.css'), 'utf8');
const s62 = css.slice(css.indexOf('/* ---------- 62. Cartes mémo : « Scène à collectionner »'));
const fn = name => { const a = app.indexOf(`function ${name}(`); assert.ok(a > 0, name); return app.slice(a, app.indexOf('\n}', a) + 2); };
const CARTES = vm.runInContext('(' + app.slice(app.indexOf('const CARTES={') + 13, app.indexOf('\n};', app.indexOf('const CARTES={')) + 2) + ')', vm.createContext({}));
const prose = h => h.replace(/<code\b[^>]*>[\s\S]*?<\/code>/g, '‹code›').replace(/<[^>]+>/g, '');

test('chaque carte : son mot-clé, son idée, trois points à retenir, une syntaxe de 30 signes par ligne au plus, son piège', () => {
  const ids = Object.keys(CARTES);
  assert.ok(ids.length >= 50, ids.length + ' cartes');
  for (const id of ids) {
    const c = CARTES[id];
    assert.deepEqual(Object.keys(c).filter(k => !['k', 't', 's', 'points', 'piege', 'dialecte', 'sgbd'].includes(k)), [], `carte ${id} : rien d’autre`);
    assert.ok(c.k && c.t && c.s && c.piege, `carte ${id} : mot-clé, idée, syntaxe, piège`);
    assert.equal(c.points.length, 3, `carte ${id} : trois points`);
    for (const p of [...c.points, c.piege]) {
      for (const tag of ['code', 'b']) assert.equal((p.match(new RegExp(`<${tag}\\b`, 'g')) || []).length, (p.match(new RegExp(`</${tag}>`, 'g')) || []).length, `carte ${id} : <${tag}> fermé`);
      assert.ok(!/<button\b/.test(p), `carte ${id} : pas de renvoi dans un point`);
      const t = prose(p);
      assert.ok(t.length <= 120, `carte ${id} : une phrase courte (${t.length})`);
      assert.ok(!/ [:;?!»]|« /.test(t) && !/'/.test(t), `carte ${id} : espace insécable et apostrophe typographique : ${t}`);
    }
    for (const line of c.s.split('\n')) assert.ok(line.length <= 30, `carte ${id} : « ${line} » tient sur la carte, même à 320 px`);
  }
  assert.deepEqual(Object.keys(CARTES).filter(id => CARTES[id].dialecte).sort(), ['50', '71', '82', '83', '84', '86'], 'six syntaxes que la Console n’exécute pas (FOR UPDATE depuis le 10 novembre ; > ALL, relu le 10 novembre à 9 h 30)');
  assert.deepEqual(Object.fromEntries(Object.keys(CARTES).filter(id => CARTES[id].sgbd).map(id => [id, CARTES[id].sgbd])), {52: 'nombres', 53: 'dates', 54: 'conversion', 76: 'agregats'},
    'les renvois vers « Selon le SGBD » des anciens mémos restent');
});

test('le verso : l’ampoule et « À retenir », les trois points numérotés, la syntaxe en touches, le piège', () => {
  const ctx = vm.createContext({
    CARTES, CARTES_PLUS: {}, allLessons: Object.keys(CARTES).map(id => ({id: +id})), esc: s => String(s), highlight: s => `<span class="hl">${s}</span>`,
    lqStkSvg: k => `<svg data-k="${k}"></svg>`, cardMemoPoints: () => []
  });
  vm.runInContext(app.slice(app.indexOf('const MEMO_LOCK_STK='), app.indexOf('/* Le numéro de collection (01 à 71)')) + app.slice(app.indexOf('let memoListeCache=null;'), app.indexOf('function memoArg(')) + fn('memoSerial') + fn('memoKn') + fn('memoKw') + fn('memoCodes') + fn('memoTab') + fn('memoVerso'), ctx);
  const v = ctx.memoVerso(51);
  assert.ok(v.includes('<h3 class="mc-h"><span class="mc-h-stk" aria-hidden="true"><svg data-k="bulb"></svg></span><span class="mc-h-tag">À retenir</span></h3>'));
  assert.equal((v.match(/<li style="--i:\d">/g) || []).length, 3, 'trois points, qui arrivent l’un après l’autre');
  assert.ok(v.includes('<ol class="mc-pts"><li style="--i:0"><code>UPPER</code> met en majuscules, <code>LOWER</code> en minuscules'), 'une liste numérotée (relue par des débutants le 10 novembre)');
  assert.ok(v.includes('<div class="mc-syn"><p class="mc-lab">Syntaxe</p><div class="ex-code mc-code"><span class="hl">SELECT UPPER(nom)'), 'la syntaxe, colorée');
  assert.ok(v.includes('<aside class="mc-piege" aria-label="Le piège"><p class="mc-piege-tag" aria-hidden="true"><i><svg'), 'le piège, avec son autocollant');
  assert.ok(ctx.memoVerso(84).includes('<p class="mc-lab">Syntaxe <span class="mc-dial">PostgreSQL</span></p>'), 'une syntaxe d’un autre SGBD le dit');
  const v53 = ctx.memoVerso(53);
  assert.ok(v53.includes("</div></div>\n    <p class=\"mc-sgbd\">Pour les autres SGBD, voir la page <button type='button' class='sgbd-link' data-sgbd='dates'>Selon le SGBD</button> de la Bibliothèque.</p>"), 'le renvoi, sous la syntaxe');
  assert.ok(v53.indexOf('mc-sgbd') < v53.indexOf('mc-piege') && !v.includes('mc-sgbd'), 'avant le piège ; rien sur les autres cartes');
  const tete = ctx.memoVerso(51, {head: true});
  assert.ok(tete.startsWith('<p class="mc-verso-top" aria-hidden="true"><b class="mc-num">'), 'retournée au bilan : le rappel du numéro et du mot-clé');
  assert.ok(tete.includes('<h3 class="mc-h" tabindex="-1" data-focus>'), 'le focus se pose sur « À retenir » une fois la carte retournée');
  /* Le mot-clé : jamais coupé ; GROUP BY ne se sépare pas ; une notion en mots passe en Bricolage */
  assert.ok(ctx.memoKw('GROUP BY').includes('GROUP\u00a0BY') && ctx.memoKw('Ordre d’exécution').includes('class="mc-k is-mot"'));
});

test('la fiche : le recto qui s’incline, le verso dessous, « Noter » et « Essayer » (sauf syntaxe d’un autre SGBD)', () => {
  const open = fn('openCard');
  assert.ok(open.includes('<div class="mc mc--big" role="img" aria-label="${escAttr(`Carte ${memoSerial(id)}, ${c.k}\\u00a0: ${c.t}. Module ${mi+1}, ${MODULES[mi].titre}`)}">${memoFace(id,{mod:true,shine:true})}</div>'));
  assert.ok(open.includes('<div class="mc-verso">${memoVerso(id)}</div>'));
  assert.ok(open.includes('<button type="button" class="cd-note-btn" onclick="noteFromCard(${memoArg(id)})"><span class="cd-note-stk" aria-hidden="true">${lqStkSvg(\'note\')}</span>Noter</button>'), 'le carnet de « Noter », à côté d’« Essayer »');
  assert.ok(open.includes('const had=!!cardNoteExisting(id);') && open.includes('<p class="cd-note-btn is-had" role="status"><span class="cd-note-ok" aria-hidden="true">${CHECK_SVG}</span>Dans mes notes</p>'), 'déjà notée : pas un bouton');
  assert.ok(open.includes("${c.dialecte?'':`<button type=\"button\" class=\"cd-try-btn\" onclick=\"cardToConsole(${memoArg(id)})\">${tryIco}Essayer</button>`}"), 'pas d’« Essayer » pour une syntaxe que la Console n’exécute pas');
  assert.ok(open.includes("cardTilt(document.querySelector('#card-body .mc--big'));"));
  assert.ok(fn('noteFromCard').includes('if(had)openNote(had.id); else openNote(null,pre);'));
  const tilt = fn('cardTilt');
  assert.ok(tilt.includes("(typeof prefersReduceMotion==='function'&&prefersReduceMotion())") && tilt.includes("['pointerleave','pointercancel','pointerup'].forEach(t=>el.addEventListener(t,flat));"));
  assert.ok(app.includes("e.target.closest('.lq-head-stk,.mc-h-stk,.perf-stk,.room-stk')"), 'l’ampoule se rallume au toucher');
  const svg = vm.runInContext(fn('lqStkSvg') + ';lqStkSvg("bulb")', vm.createContext({}));
  assert.ok(svg.startsWith('<svg class="lq-stk" viewBox="0 0 48 48"') && svg.includes('#FFC83D'), 'l’ampoule, dans le dessin des autocollants');
  const pre = fn('cardNotePre');
  assert.ok(pre.includes('return {ctx:`Carte ${memoSerial(id)} · ${c.k}`,sql:c.s,txt:txt||noteTextFromHtml(c.m||\'\')};'), 'la note : le numéro, le mot-clé, la syntaxe, les trois points');
});

test('la DA : scène violette quadrillée, numéro autocollant, mot-clé jaune ajusté à la carte, verso blanc ; « Texte plus grand » et mouvement réduit', () => {
  for (const part of ['--mc-face:linear-gradient(162deg,#5638E6 0%,#4C2FD8 54%,#3F25BE 100%)', 'html.lq[data-reading="large"]{--mc-fs:1.15}',
    'linear-gradient(var(--mc-grid) 1px,transparent 1px) 0 0/18px 18px', 'background:var(--sun);color:var(--mc-ink);font:800 calc(12px * var(--mc-fs))/1 var(--mono)',
    'font-size:clamp(12px,calc((100cqi - 30px) / (var(--kn,8) * .6)),calc(21px * var(--mc-fs)));', 'text-wrap:balance;overflow-wrap:normal;word-break:normal;hyphens:manual',
    'transform:perspective(800px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg))', 'html.lq .mc-pts>li::before{content:counter(mc);',
    'html.lq .mc-pts b{font-weight:750;background:linear-gradient(transparent 62%,rgba(255,200,61,.55) 62%);', 'font-size:min(calc(14px * var(--mc-fs)),calc((100cqi - 30px) / 18.3))',
    'html.lq #card-sheet.viz.on .mc-fiche>.mc--big{animation:mcFlipIn .7s var(--pop) .05s backwards}', 'html.lq #card-sheet.viz.on .mc-fiche .mc-h-stk{animation:cdSwing .9s var(--pop) .55s backwards}',
    'html.lq .mc-h-stk.is-poke svg{animation:lqHeadPoke .6s var(--pop)}'])
    assert.ok(s62.includes(part), part);
  const rm = s62.slice(s62.indexOf('@media (prefers-reduced-motion:reduce)'));
  assert.ok(rm.includes(':is(.mc,.mc-face,.mc-back,.mc-verso,.mc-pts>li,.mc-flip,.mc-flip>.mc-side,.mc-shine,.mc-seal,.mc-hint-ico,.mc-flag,.mc-prize,.mc-h-stk,.mc-h-stk>svg){animation:none!important;transition:none!important}'), 'mouvement réduit : rien ne bouge');
  assert.ok(rm.includes('html[data-motion="reduce"].lq .mc--big .mc-face{transform:none}'), 'le réglage de l’app aussi');
});

test('les cartes mémo, reformulées pour les débutants (Elisa, 10 novembre, 6 h 11)', () => {
  /* Comme l’entretien : des phrases simples, le sujet nommé (pas de point qui commence par « Il » ou « Elle »), pas de « on »,
     et plus de chiffres de la base à recompter (« 10 clients, 6 villes », « 18 lignes, et non 26 ») ni de noms de clients. */
  for (const [id, c] of Object.entries(CARTES)) for (const p of [...c.points, c.piege]) {
    const t = prose(p);
    assert.doesNotMatch(t, /^(Il|Elle|Ils|Elles) /, `carte ${id} : ${t}`);
    assert.doesNotMatch(t, /(^|[^A-Za-zÀ-ÿ’-])on (?!y)/i, `carte ${id} : ${t}`);
    assert.doesNotMatch(t, /Hugo|Inès|Fibre|MARTIN|\b(10|16|18|26) (clients|commandes|lignes)|\b8\b ?:|4 clients/, `carte ${id} : ${t}`);
  }
  assert.equal(CARTES[13].points[0], '<code>DISTINCT</code> retire les lignes en double du résultat.');
});

test('10 novembre : chaque leçon a sa carte mémo (71), et une pastille de code courte ne se coupe pas', () => {
  assert.equal(Object.keys(CARTES).length, 71, 'une carte par leçon (71 leçons)');
  for (const id of [2, 22, 40, 41, 42, 49, 73, 72, 81, 61, 65, 66, 68, 62, 63, 71, 70, 64]) assert.ok(CARTES[id], `la leçon ${id} a sa carte`);
  assert.equal(CARTES[2].k, 'AS', 'la carte de « Renommer avec AS »');
  const ctx = vm.createContext({});
  vm.runInContext(fn('memoCodes'), ctx);
  assert.equal(ctx.memoCodes('<code>nom AS produit</code>'), '<code>nom AS produit</code>', 'courte : nowrap par le CSS');
  assert.equal(ctx.memoCodes('<code>UNBOUNDED PRECEDING AND CURRENT ROW</code>'), '<code class="long">UNBOUNDED PRECEDING AND CURRENT ROW</code>', 'très longue : peut se couper');
  assert.ok(css.includes('html.lq :is(.mc-pts,.mc-piege) code{') && /:is\(\.mc-pts,\.mc-piege\) code\{[^}]*white-space:nowrap\}/.test(css) && css.includes('html.lq :is(.mc-pts,.mc-piege) code.long{white-space:normal}'));
});
