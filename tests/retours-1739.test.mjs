/* Elisa, 31 octobre, 17 h 39 : « Je partirais plutôt sur : ≤ 1 min 200 pts, 1 à 2 min 175, 2 à 3 min 150, 3 à 4 min 125, 4 à 5 min 100,
   5 à 7 min 75, 7 min et + 50 ; puis +25 pts si réussi du premier essai ; en multijoueur, on ajoute le classement : 🥇 +50, 🥈 +30,
   🥉 +20, 4e +10, 5e +0. Une manche parfaite donne 225 pts en solo et 275 pts entre amis, et quelqu’un qui prend 4–5 minutes n’est
   pas massacré. Mettre à jour le cadre point. » Le moteur de la salle a ses tests (salle-defis, salle-points-microinteractions) ;
   ici, le cadre « Comment on marque des points » et le serveur. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const s52 = css.slice(css.indexOf('/* ---------- 52. Retours du 31 octobre, 17 h 39'));
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const consts = cut('const JEU_PALIERS=', '\n') + '\n' + cut('const JEU_ROUND_MS=', '\n') + '\n';

function rulesHTML({ io = false } = {}) {
  const host = { innerHTML: '', get firstElementChild() { return this._sec; } };
  const sec = { cls: new Set(), classList: { add: c => sec.cls.add(c) } };
  host._sec = sec;
  const seen = [];
  const ctx = vm.createContext({
    document: { getElementById: id => (id === 'defis-rules' ? host : null) }, lqStkSvg: k => `<svg data-k="${k}"></svg>`, prefersReduceMotion: () => false,
    IntersectionObserver: io ? class { constructor(f, o) { this.f = f; this.o = o; seen.push(this); } observe(el) { this.el = el; } disconnect() { this.off = true; } } : undefined,
  });
  vm.runInContext(consts + cut('let roomRulesObs=null;', '\nfunction showScreen(){'), ctx);
  vm.runInContext('renderDefisRules()', ctx);
  return { h: host.innerHTML, sec, seen, ctx };
}

test('le cadre « Comment on marque des points » : les paliers en marches, le premier coup, le classement, la manche parfaite', () => {
  const { h, sec } = rulesHTML();
  assert.ok(h.includes('<li class="room-rule-vite"><b>⏱️ Trouvé vite</b><span>jusqu’à 200</span><small>Plus tu trouves vite, plus le défi rapporte. La manche s’arrête à 10&nbsp;min.</small>'));
  const steps = [...h.matchAll(/<li style="--h:(\d+)px;--i:(\d)"><b>(\d+)<\/b><i aria-hidden="true"><\/i><small aria-hidden="true">([^<]+)<\/small><em class="lq-sr"> points ([^<]+)<\/em><\/li>/g)]
    .map(m => [+m[3], m[4], m[5], +m[1]]);
  assert.deepEqual(steps.map(s => s.slice(0, 3)), [
    [200, '≤ 1', 'jusqu’à 1 min'], [175, '1–2', 'de 1 à 2 min'], [150, '2–3', 'de 2 à 3 min'], [125, '3–4', 'de 3 à 4 min'],
    [100, '4–5', 'de 4 à 5 min'], [75, '5–7', 'de 5 à 7 min'], [50, '7 +', 'après 7 min']], 'le tableau d’Elisa, palier par palier (et lu à voix haute)');
  assert.deepEqual(steps.map(s => s[3]), [52, 46, 39, 33, 26, 20, 13], 'des marches qui descendent');
  assert.ok(h.includes('<ol class="room-paliers" aria-label="Points selon le temps pour trouver">') && h.includes('<p class="room-paliers-u" aria-hidden="true">minutes pour trouver</p>'));
  assert.ok(h.includes('<li><b>✨ Du premier coup</b><span>+25</span><small>Ta première requête exécutée est la bonne</small></li>'));
  assert.ok(h.includes('<li><b>🥇 Premier entre amis</b><span>+50</span><small>2e : +30 · 3e : +20 · 4e : +10</small></li>'));
  assert.ok(h.includes('<li><b>⚖️ Égalité</b><span>chrono</span><small>Le plus rapide au total passe devant ; même temps : ex æquo</small></li>'));
  assert.ok(h.includes('<p class="room-rules-max"><span>Manche parfaite</span><b>225</b><small>seul</small><i aria-hidden="true">·</i><b>275</b><small>entre amis</small></p>'));
  assert.ok(!h.includes('Rapidité') && !h.includes('baisse doucement'), 'l’ancien barème est parti');
  assert.ok(sec.cls.has('is-in'), 'sans IntersectionObserver : tout de suite');
  /* Les marches montent quand le cadre arrive à l’écran */
  const o = rulesHTML({ io: true });
  assert.ok(!o.sec.cls.has('is-in') && o.seen.length === 1 && o.seen[0].el === o.sec && o.seen[0].o.threshold === .3);
  o.seen[0].f([{ isIntersecting: true }]);
  assert.ok(o.sec.cls.has('is-in') && o.seen[0].off, 'une fois, puis l’observateur s’arrête');
  vm.runInContext('renderDefisRules();renderDefisRules()', o.ctx);
  assert.ok(o.seen.slice(1, -1).every(x => x.off), 'redessiné : l’ancien observateur est coupé');
});

test('le cadre : des filets pleins, des marches jaunes qui montent, le mouvement réduit respecté', () => {
  for (const part of ['html.lq .room-rules>ul>li+li{border-top:1.5px solid var(--line-2)!important}',
    'html.lq .room-rules .room-paliers{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));align-items:end;',
    'html.lq .room-rules .room-paliers li{display:flex;flex-direction:column;align-items:stretch;justify-content:flex-end;gap:5px;padding:0;border:0!important;',
    'height:var(--h);border-radius:8px 8px 4px 4px;background:var(--sun);', 'transform:scaleY(.12);transform-origin:50% 100%;',
    'html.lq .room-rules.is-in .room-paliers li i{transform:none;opacity:1}', 'html.lq .room-rules-max{display:flex;',
    '.lq-sr{position:absolute!important;width:1px!important;height:1px!important;',
    '@media (prefers-reduced-motion:reduce){html.lq .room-rules .room-paliers li i{transition:none!important}'])
    assert.ok(s52.includes(part), part);
  assert.ok(!/room-rules[^{]*\{[^}]*dashed/.test(s52), 'plus de pointillés');
});

test('Supabase — jeu_score accepte le nouveau barème : de 50 à 225 points par manche trouvée seul, jusqu’à 275 entre amis', () => {
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  assert.equal(files.at(-1), '20261031164606_bareme_paliers.sql', 'la dernière migration, appliquée le 31 octobre');
  const m = fs.readFileSync(new URL(files.at(-1), dir), 'utf8');
  assert.match(m, /or v_pts is null or v_pts < v_ok \* 50 or v_pts > v_ok \* \(case when v_solo then 225 else 275 end\) or v_niv not in \('f', 'm', 'd'\) then/);
  assert.ok(m.includes("grant execute on function public.jeu_score(text, text, jsonb) to anon, authenticated;"));
  /* Le reste de la fonction ne change pas */
  const avant = fs.readFileSync(new URL('20261031160846_pseudos_uniques.sql', dir), 'utf8');
  const body = s => s.slice(s.indexOf('create or replace function public.jeu_score('), s.indexOf('$$;\n', s.indexOf('create or replace function public.jeu_score(')))
    .replace(/v_pts < v_ok \* \d+ or v_pts > v_ok \* \(case when v_solo then \d+ else \d+ end\)/, '');
  assert.equal(body(m), body(avant));
  /* Vérifié sur la vraie base (31 octobre, 17 h 46, sans rien garder) : 225 seul accepté, 226 refusé ; 50 accepté, 49 refusé ;
     3 manches entre amis : 825 accepté, 826 refusé */
  assert.ok(app.includes("const JEU_PALIERS=[[60,200],[120,175],[180,150],[240,125],[300,100],[420,75]],JEU_PTS_MIN=50,JEU_PTS_ESSAI=25,JEU_PTS_RANG=[50,30,20,10];"));
  assert.ok(app.includes('const JEU_ROUND_MS=600000;'), 'la manche s’arrête à 10 min');
  assert.ok(app.includes('(une manche non trouvée compte ${JEU_ROUND_MS/60000} min)'));
});
