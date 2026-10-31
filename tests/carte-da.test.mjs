/* Elisa, 31 octobre, 7 h 57 (la feuille « Carte » d’une carte mémo) : « pareil, élève d’un niveau, surtout le À retenir (DA du site) ». */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'ludique.css'), 'utf8');
const s45 = css.slice(css.indexOf('/* ---------- 45. La fiche d’une carte mémo dans la DA de la vitrine'));
const fn = name => { const a = app.indexOf(`function ${name}(`); assert.ok(a > 0, name); return app.slice(a, app.indexOf('\n}', a) + 2); };
const ctx = vm.createContext({});
vm.runInContext(fn('cardMemoPoints') + fn('cardMemoHtml'), ctx);
const CARTES = vm.runInContext('(' + app.slice(app.indexOf('const CARTES={') + 13, app.indexOf('\n};', app.indexOf('const CARTES={')) + 2) + ')', vm.createContext({}));

test('« À retenir » en points : une phrase par ligne, rien de perdu, jamais de coupure dans le code ni dans un renvoi', () => {
  const ids = Object.keys(CARTES);
  assert.ok(ids.length >= 40, ids.length + ' cartes');
  for (const id of ids) {
    const m = CARTES[id].m, pts = ctx.cardMemoPoints(m);
    const back = pts.join(' ').replace(/<span class="cd-arr">→<\/span>/g, '→').replace(/\s+/g, ' ').trim();
    assert.equal(back, m.replace(/\s+/g, ' ').trim(), `carte ${id} : le texte est le même`);
    for (const p of pts) {
      assert.equal((p.match(/<code\b/g) || []).length, (p.match(/<\/code>/g) || []).length, `carte ${id} : un code entier par ligne`);
      assert.equal((p.match(/<button\b/g) || []).length, (p.match(/<\/button>/g) || []).length, `carte ${id} : un renvoi entier par ligne`);
    }
    assert.ok(pts.length <= 8, `carte ${id} : ${pts.length} lignes`);
  }
  const t = ctx.cardMemoPoints(CARTES[51].m);
  assert.deepEqual(Array.from(t, x => x.replace(/<[^>]+>/g, '')), ['Demande-toi ce que tu veux faire au texte.', 'Forme → UPPER / LOWER.', 'Nettoyer → TRIM, REPLACE.', 'Découper → SUBSTR.', 'Chercher → INSTR.', 'Assembler → ||.', 'Ces fonctions changent l’affichage, pas la table.']);
  assert.ok(t[1].includes('Forme <span class="cd-arr">→</span> <code>UPPER</code>'), 'la flèche prend la couleur de l’appli');
  assert.ok(ctx.cardMemoHtml(CARTES[51].m).startsWith('<ul class="cd-pts"><li style="--i:0">Demande-toi'), 'liste cochée');
  assert.equal(ctx.cardMemoHtml('<code>GROUP BY</code> rassemble les lignes.'), '<code>GROUP BY</code> rassemble les lignes.', 'une seule phrase : le texte tel quel');
  assert.deepEqual(Array.from(ctx.cardMemoPoints("Pour les autres SGBD, voir la page <button type='button' class='sgbd-link' data-sgbd='dates'>Selon le SGBD</button> de la Bibliothèque.")), ["Pour les autres SGBD, voir la page <button type='button' class='sgbd-link' data-sgbd='dates'>Selon le SGBD</button> de la Bibliothèque."]);
});

test('la feuille : l’ampoule autocollante et l’étiquette « À retenir », le carnet de « Ajouter à mes notes », la carte qui s’incline', () => {
  const open = fn('openCard');
  assert.ok(open.includes('<p class="cd-lab memo"><span class="cd-memo-stk" aria-hidden="true">${lqStkSvg(\'bulb\')}</span><span class="cd-memo-tag">À retenir</span></p>'));
  assert.ok(open.includes('<div class="cd-memo">${cardMemoHtml(c.m)}</div>'), 'même bloc, toujours suivi du bouton');
  assert.ok(open.includes('<span class="coda-note-stk" aria-hidden="true">${lqStkSvg(\'note\')}</span>Ajouter à mes notes</button>'));
  assert.ok(open.includes('<div class="cd-share collectible">${collectibleFace(id)}<i class="cd-shine" aria-hidden="true"></i></div>'));
  assert.ok(open.includes("cardTilt(document.querySelector('#card-body .cd-share'));"));
  const tilt = fn('cardTilt');
  assert.ok(tilt.includes("(typeof prefersReduceMotion==='function'&&prefersReduceMotion())") && tilt.includes("['pointerleave','pointercancel','pointerup'].forEach(t=>el.addEventListener(t,flat));"));
  assert.ok(app.includes("e.target.closest('.lq-head-stk,.cd-memo-stk')"), 'l’ampoule se rallume au toucher');
  const svg = vm.runInContext(fn('lqStkSvg') + ';lqStkSvg("bulb")', vm.createContext({}));
  assert.ok(svg.startsWith('<svg class="lq-stk" viewBox="0 0 48 48"') && svg.includes('#FFC83D'), 'l’ampoule, dans le dessin des autocollants');
});

test('la DA : carte en scène violette, « À retenir » en fiche cochée, code en touches, mots surlignés, « Syntaxe » au tiret', () => {
  for (const part of ['html.lq #card-sheet .cd-share.collectible{position:relative;isolation:isolate;overflow:hidden;', 'background:var(--deep)!important',
    'transform:perspective(800px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg))', 'html.lq #card-sheet.viz.on .cd-share.collectible{animation:cdFlipIn .72s var(--pop) .05s backwards!important}',
    'html.lq #card-sheet .cd-share .memo-copy>b{color:var(--sun-hi);', 'html.lq #card-sheet .cd-share .memo-num{', 'html.lq #card-body .cd-memo-tag{', 'html.lq #card-body .cd-pts>li::before{',
    'html.lq #card-sheet.viz.on .cd-pts>li{animation:cdPtIn', 'html.lq #card-body .cd-memo b{color:var(--ink);font-weight:750;background:linear-gradient(transparent 60%,rgba(255,200,61,.55) 60%);',
    'html.lq #card-body .cd-memo code{padding:1px 6px;border:1.5px solid #D9CFFF;', 'html.lq #card-body .cd-lab:not(.memo){display:flex;align-items:center;gap:8px;margin-left:4px;margin-right:4px;margin-bottom:10px;'])
    assert.ok(s45.includes(part), part);
  assert.ok(!/#card-body \.cd-lab:not\(\.memo\)\{[^}]*margin:0/.test(s45), '« Syntaxe » garde ses 26 px sous le bouton');
  const rm = s45.slice(s45.indexOf('@media (prefers-reduced-motion:reduce)'));
  for (const sel of ['#card-sheet .cd-share.collectible', '#card-sheet .cd-shine', '#card-body .cd-memo-stk', '#card-body .cd-pts>li'])
    assert.ok(rm.includes(sel), 'mouvement réduit : ' + sel);
});
