/* 5 novembre, 21 h 09 (Elisa, la capture de l’accueil une fois la séance faite : « Prête pour la suite, Elisa ? », puis « ✓ Ta session ·
   Faite » repoussée sur une deuxième ligne) : « j’aime pas que ça tienne en deux lignes en fait, et supprime « Ton module » en vert ». */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('la séance : « Ta session · » à part, pour pouvoir le retirer quand la place manque', () => {
  const code = cut('  const sesPre=', '\n  /* Elisa, 1er novembre, 19 h 25');
  const txt = ligne => vm.runInNewContext(code.replace(/const (sesPre|sesTxt)=/g, 'var $1=') + ';sesTxt', { sessionLine: ligne, esc: String });
  assert.equal(txt('Ta session · Faite'), '<span class="lq-ses-pre">Ta session · </span>Faite');
  assert.equal(txt('Ta session · 12 min'), '<span class="lq-ses-pre">Ta session · </span><b class="lq-ses-n" data-n="12">12</b> min');
  assert.equal(txt('À reprendre · 8 min'), '<span class="lq-ses-pre">À reprendre · </span><b class="lq-ses-n" data-n="8">8</b> min');
  assert.equal(txt('Parcours terminé'), 'Parcours terminé', 'rien à retirer');
  assert.ok(app.includes(":sesEtat==='done'?'Ta session · Faite':'Ta session · Pause';"), 'les mots de 19 h 48, inchangés');
  assert.ok(lq.includes('html.lq .lq-hero.has-hi .lq-hero-hi.is-court .lq-ses-pre{display:none}'));
});

test('si la séance passe sous le bonjour, elle se resserre ; sinon elle garde « Ta session · »', () => {
  const f = cut('function lqSesAjuste(host){', '\nif(typeof window');
  const essai = ({ largeur = 230, dessous }) => {
    const classes = new Set(['lq-hero-hi']);
    let court = false;
    const t = { getBoundingClientRect: () => ({ width: largeur, top: 78, bottom: 100 }) };
    const m = { getBoundingClientRect: () => ({ top: dessous(court) ? 106 : 81 }) };
    const hi = { classList: { add: c => { classes.add(c); court = classes.has('is-court'); }, remove: c => { classes.delete(c); court = classes.has('is-court'); } },
      querySelector: s => (s === '.lq-hi-title' ? t : s === '.journey-session-meta' ? m : null) };
    const c = vm.createContext({});
    vm.runInContext(f, c);
    c.lqSesAjuste({ querySelector: s => (s === '.lq-hero-hi' ? hi : null) });
    return classes.has('is-court');
  };
  assert.equal(essai({ dessous: court => !court }), true, '« Ta session · Faite » ne tient pas : « ✓ Faite »');
  assert.equal(essai({ dessous: () => false }), false, 'tout tient sur la ligne : rien ne change');
  assert.equal(essai({ largeur: 0, dessous: () => true }), false, 'accueil caché : rien n’est décidé');
  /* Après chaque rendu des deux cartes, et quand l’écran change de taille */
  assert.ok(app.includes('  lqSesCount(host);\n    lqSesAjuste(host);\n    return;\n  }') && app.includes('  lqPctAnime(host);\n  lqSesAjuste(host);\n}'));
  assert.ok(app.includes("addEventListener('resize',()=>{clearTimeout(lqSesT);lqSesT=setTimeout(()=>lqSesAjuste(document.getElementById('home-hero')),150);});"));
  /* La séance est revenue à droite du bonjour (l’essai sur la ligne du module, abandonné, ne reste pas) */
  assert.ok(app.includes('const heading=`<div class="lq-hero-hi"><p class="lq-hi-title" aria-hidden="true">${hiHtml}</p>${sesMeta}</div>`;') && !app.includes('lq-hero-row') && !lq.includes('.lq-hero-row'));
});

test('plus de « Ton module » en menthe au-dessus du pourcentage', () => {
  const parc = cut('  const parc=`', '\n');
  assert.ok(parc.startsWith('  const parc=`<div class="lq-hero-body lq-hero-parc" data-p="${pf}"><p class="lq-parc-n">') && !parc.includes('lq-hero-kicker') && !app.includes("'Ton module'"));
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=171">'));
});
