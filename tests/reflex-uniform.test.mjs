/* « Le réflexe à retenir » est identique dans les 68 cours (modèle du cours Clé primaire) : trois cartes
   (emoji, phrase, précision facultative, code facultatif sur une ligne), un seul titre, un seul bouton
   « Ajouter dans notes ». Les 22 anciens cours ne gardent ni leur résumé libre, ni leurs règles en
   colonnes, ni l'encadré « À retenir » de fin de cours. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const data = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), data);
const lessons = vm.runInContext('MODULES.flatMap(m=>m.lessons)', data);
const src = html.slice(html.indexOf('function stripNoteHtml('), html.indexOf('function noteFromRetenir('));
const ctx = vm.createContext({});
vm.runInContext(src, ctx);

const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const text = s => decode(s.replace(/<[^>]+>/g, ''));
/* <li><b aria-hidden="true">🔗</b><div><strong>…</strong>[<span>…</span>][<code class="fk-rc">…</code>]</div></li> */
const CARD = /^<li><b aria-hidden="true">([^<]+)<\/b><div><strong>([\s\S]+?)<\/strong>(?:<span>([\s\S]+?)<\/span>)?(?:<code class="fk-rc">([^<\n]+)<\/code>)?<\/div><\/li>$/;

test('68 cours, tous dans le même format', () => {
  assert.equal(lessons.length, 68);
});

test('chaque cours a un réflexe de trois cartes bien formées', () => {
  for (const l of lessons) {
    const r = l.studio && l.studio.reflex;
    assert.ok(r && r.extra, `${l.titre} : réflexe absent`);
    assert.deepEqual(Object.keys(r), ['extra'], `${l.titre} : le réflexe ne contient que « extra » (ni a/b/c, ni note, ni chaîne)`);
    const m = /^<ol class="fk-syn-map is-recap" aria-label="Les trois idées à retenir">([\s\S]+)<\/ol>$/.exec(r.extra);
    assert.ok(m, `${l.titre} : le réflexe est une seule liste de cartes « Les trois idées à retenir »`);
    const items = m[1].split(/(?<=<\/li>)(?=<li>)/);
    assert.equal(items.length, 3, `${l.titre} : trois cartes`);
    for (const it of items) {
      const c = CARD.exec(it);
      assert.ok(c, `${l.titre} : carte mal formée : ${it.slice(0, 90)}`);
      const [, emoji, strong, sub, code] = c;
      assert.ok(/\p{Extended_Pictographic}/u.test(emoji), `${l.titre} : un emoji par carte`);
      const t = text(strong);
      assert.ok(t.length >= 20 && t.length <= 150, `${l.titre} : phrase de ${t.length} caractères : ${t}`);
      if (sub) assert.ok(text(sub).length <= 120, `${l.titre} : précision trop longue : ${text(sub)}`);
      if (code) assert.ok(decode(code).length <= 46, `${l.titre} : code trop long pour une puce : ${decode(code)}`);
    }
    /* Espace insécable avant : ? ! ; (hors code), comme dans les autres textes des cours. */
    const plain = r.extra.replace(/<code[\s\S]*?<\/code>/g, '|').replace(/<[^>]+>/g, '|').replace(/&nbsp;/g, ' ');
    assert.ok(!/ [:?!;]/.test(plain), `${l.titre} : espace ordinaire avant une ponctuation haute : ${(plain.match(/.{12} [:?!;]/) || [''])[0]}`);
  }
});

test('un seul titre et un seul bouton de note, rendus par reflexBlock', () => {
  assert.ok(html.includes("const REFLEX_TITLE='Le réflexe à retenir';"), 'titre unique');
  const fn = html.slice(html.indexOf('function reflexBlock('), html.indexOf('function piegeSqlRunBlock('));
  assert.ok(fn.includes('${REFLEX_TITLE}') && fn.includes('${retenirNoteBtn()}') && fn.includes('${body}'), 'reflexBlock : titre, cartes, bouton de note');
  for (const l of lessons) {
    assert.ok(!l.reflexTitle && !(l.studio && l.studio.reflexTitle), `${l.titre} : pas de titre propre au cours`);
    assert.ok(!l.noReflex, `${l.titre} : pas de cours sans réflexe`);
    const body = [l.situation, l.studio.problem.extra, l.studio.uses.body, (l.studio.why || {}).extra].join('\n');
    assert.ok(!body.includes('coda-note'), `${l.titre} : le bouton « Ajouter dans notes » n'est que dans le réflexe`);
  }
});

test('les anciens cours n’ont plus leurs encadrés de fin de cours qui faisaient doublon', () => {
  for (const l of lessons.filter(x => !x.guided)) {
    const body = [l.situation, l.studio.problem.extra, l.studio.uses.body, (l.studio.why || {}).extra, l.joinRecapAfter || ''].join('\n');
    assert.ok(!/<p class="sit-memo-lab"><i aria-hidden="true">💡<\/i>(À retenir|Le réflexe)<\/p>/.test(body), `${l.titre} : encadré « À retenir » ou « Le réflexe » en plus du réflexe`);
    assert.ok(!/memory-rule|agg-reflex|lr-reflex/.test(l.studio.reflex.extra + body), `${l.titre} : ancien format de réflexe`);
  }
});

test('la note d’un cours reprend ses trois cartes, dans l’ordre', () => {
  for (const l of lessons) {
    const t = ctx.lessonReflexText(l);
    const inner = /^<ol[^>]*>([\s\S]+)<\/ol>$/.exec(l.studio.reflex.extra)[1];
    const cards = inner.split(/(?<=<\/li>)(?=<li>)/).map(it => text(CARD.exec(it)[2]).replace(/\s+/g, ' ').trim());
    let pos = 0;
    for (const c of cards) {
      const i = t.replace(/\s+/g, ' ').indexOf(c, pos);
      assert.ok(i >= 0, `${l.titre} : « ${c.slice(0, 50)} » manque (ou est hors ordre) dans la note`);
      pos = i + c.length;
    }
    assert.ok(t.split('\n').length >= 3, `${l.titre} : au moins trois lignes dans la note`);
  }
});
