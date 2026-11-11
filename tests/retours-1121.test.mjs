/* 11 novembre, 11 h 21 (Elisa, dans l’app iPhone, capture d’une nouvelle note, clavier ouvert) : « On ne peut pas aller en bas pour
   chercher Enregistrer ». La feuille de note restait derrière le clavier et ne défilait pas : dans l’app, le plugin Keyboard retire à
   WebKit son propre recul du clavier (visualViewport ne bouge pas) et compte sur la page qui rétrécit au-dessus de lui ; quand elle ne
   rétrécit pas, rien ne le disait à la page. Maintenant la hauteur annoncée du clavier (keyboardWillShow), moins ce dont la page a
   rétréci, fait monter les feuilles (--kb) et la barre des touches SQL ; et dans l’éditeur de note, clavier ouvert, « Enregistrer »
   reste posé au-dessus du clavier pendant que la note défile dessous. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const cut = (a, b) => { const i = html.indexOf(a); assert.ok(i >= 0, a); const j = html.indexOf(b, i + a.length); assert.ok(j > i, b); return html.slice(i, j); };

/* Le clavier de l’app, seul : une fenêtre factice qui reçoit les événements du plugin et change de hauteur quand le test le dit. */
const clavier = () => {
  const l = {};
  const win = { innerHeight: 932, addEventListener: (t, f) => { (l[t] || (l[t] = [])).push(f); } };
  const ctx = vm.createContext({ window: win, syncKbarOffset: () => {} });
  vm.runInContext(cut('let kbNatH=0,kbNatBase=', 'function keyboardInset(){') + ';this.kb=()=>kbNatif();', ctx);
  const fire = (t, data) => (l[t] || []).forEach(f => f(Object.assign({ type: t }, data)));
  const haut = h => { win.innerHeight = h; fire('resize'); };
  return { kb: ctx.kb, fire, haut };
};

test('le clavier de l’app compte, que la page rétrécisse au-dessus de lui ou non', () => {
  { const { kb, fire, haut } = clavier();
    assert.equal(kb(), 0, 'clavier fermé : rien');
    fire('keyboardWillShow', { keyboardHeight: 344 });
    assert.equal(kb(), 344, 'le clavier s’annonce, la page n’a pas encore rétréci : la feuille monte de toute sa hauteur');
    haut(588);
    assert.equal(kb(), 0, 'la page a rétréci au-dessus du clavier : plus rien à monter');
    fire('keyboardWillShow', { keyboardHeight: 380 });
    assert.equal(kb(), 36, 'le clavier grandit (barre de suggestions) : la différence');
    fire('keyboardWillHide'); haut(932);
    assert.equal(kb(), 0, 'il s’en va');
    fire('keyboardWillShow', { keyboardHeight: 344 }); haut(588);
    assert.equal(kb(), 0, 'la hauteur de référence est restée celle de la page entière');
  }
  { const { kb, fire } = clavier();
    fire('keyboardWillShow', { keyboardHeight: 344 });
    assert.equal(kb(), 344, 'la page ne rétrécit pas (la capture d’Elisa) : la feuille monte quand même');
    fire('keyboardDidHide');
    assert.equal(kb(), 0);
  }
});

test('les feuilles, la barre des touches SQL et la ligne « Exécuter » suivent ce clavier', () => {
  assert.ok(html.includes('  return Math.max(raw>40?raw+IOS_KB_OVERLAY:raw,kbNatif());'), 'keyboardInset : aussi le clavier de l’app');
  assert.ok(html.includes("['keyboardWillShow','keyboardDidShow','keyboardWillHide','keyboardDidHide'].forEach(n=>window.addEventListener(n,()=>{ try{ syncKbarOffset(); }catch(e){} }));"),
    'la barre des touches SQL se recale quand le clavier de l’app s’annonce ou s’en va');
  assert.ok(html.includes('-IOS_KB_OVERLAY-kbNatif();'), 'la ligne « Exécuter » reste au-dessus du clavier de l’app');
  const kb = cut('/* Dans l’app, le clavier qui ne fait pas rétrécir la page compte aussi (kbNatif, 11 novembre)', '})();');
  assert.ok(kb.includes('const kb=Math.max(Math.round(window.innerHeight-vv.height-vv.offsetTop),kbNatif());'));
  assert.ok(html.includes("document.documentElement.style.setProperty('--kb',(kb>60?kb:0)+'px');"), '--kb comme avant (réf. 9 du 31 octobre)');
  assert.ok(kb.includes("document.documentElement.style.setProperty('--kb-flot',(kb>60&&!kbNatH?IOS_KB_OVERLAY:0)+'px');"), 'Safari : les barres qui flottent sur le clavier');
  assert.ok(kb.includes("document.documentElement.classList.toggle('kb-ouvert',kb>60||kbNatH>0);"));
  assert.ok(kb.includes("['keyboardWillShow','keyboardDidShow','keyboardWillHide','keyboardDidHide','resize'].forEach(n=>window.addEventListener(n,fit));"), 'recalé aussitôt');
  assert.ok(css.includes('html.lq .viz.on{bottom:calc(var(--kb,0px) - var(--kb-app,0px))!important}'), 'la feuille monte de --kb (dans l’app, #app tient déjà au-dessus du clavier : retours-1150)');
});

test('éditeur de note, clavier ouvert : « Enregistrer » reste au-dessus du clavier, « Supprimer » a sa rangée', () => {
  const ed = cut('function openNote(id,pre){', 'function collectNote(){');
  assert.ok(ed.includes(`    <div class="ne-row ne-act">
      <button class="prim" type="button" onclick="saveNote()">Enregistrer</button>
    </div>\${n?\`
    <div class="ne-row ne-row-del"><button class="del" type="button" onclick="deleteNote('\${e.id}')">Supprimer</button></div>\`:''}\`;`));
  assert.ok(html.includes("const b=document.querySelector('#note-body .ne-row .prim');"), 'saveNote trouve toujours son bouton');
  for (const r of ['html.lq.kb-ouvert body:not(.kbar-on) #note-body{padding-bottom:var(--kb-flot,0px)}',
    'html.lq.kb-ouvert body:not(.kbar-on) #note-body .ne-act{position:sticky;bottom:0;z-index:3;margin:8px -18px 0;padding:12px 18px;background:var(--bg);box-shadow:0 -12px 18px -14px rgba(27,22,64,.28)}',
    'html.lq #note-body .ne-row-del{margin-top:10px}'])
    assert.ok(css.includes(r), r);
  /* Avec la barre des touches SQL (la requête associée), la feuille défile comme avant pour garder « Enregistrer » au-dessus d’elle. */
  assert.ok(cut('function noteSqlEnVue(){', 'if(typeof document!==').includes("const row=body.querySelector('.ne-row'),shell=ta.closest('.ne-sql-shell')||ta;if(!row)return;"));
});
