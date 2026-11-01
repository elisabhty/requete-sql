/* Elisa, 1er novembre, 21 h 21 (cours « Les schémas ») : réf. 1 le mail ; réf. 2 « La base est organisée en deux espaces » et « bien-être
   mal écrit » ; réf. 3 « Range chaque table dans son espace. » ; réf. 4 les étiquettes qui buguent en plein glisser ; réf. 5 le badge. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const anim = f => fs.readFileSync(new URL('../assets/anim/' + f, import.meta.url), 'utf8');

test('réf. 1 : les mails vont à la ligne d’eux-mêmes, sur toute leur largeur', () => {
  const s = anim('projet-schemas.html');
  assert.ok(s.includes("'La base NutriBoost commence à bien grandir, et les tables de la boutique et des ateliers sont toutes mélangées.',"));
  assert.ok(s.includes("'Peux-tu les organiser dans deux espaces distincts, sans supprimer ni recréer aucune table ?'], 'Karim']"));
  for (const f of ['projet-schemas.html', 'projet-delete.html']) {
    const p = anim(f), m = p.slice(p.indexOf('const MAILS = ['), p.indexOf('\n];', p.indexOf('const MAILS = [')));
    assert.ok(!m.includes('<br>'), `${f} : plus de retour posé à la main`);
  }
});

test('réf. 2 et 3 : la légende, la consigne, et le schéma bien_etre', () => {
  const s = anim('projet-schemas.html');
  assert.ok(s.includes('cap(\'c3\', "La base est organisée en deux espaces :<br>la boutique et les ateliers.", 3.6);'));
  assert.ok(s.includes("prompt: 'Range chaque table dans son espace.'"));
  assert.ok(!s.includes('bienetre') && !app.includes('bienetre') && s.includes('bien_etre'));
});

test('réf. 4 : pendant un glisser, l’image ne se réduit ni ne regrossit ; tout se replace à la fin', () => {
  assert.ok(app.includes("const go=(x,y)=>{ if(!g.on){ if(Math.hypot(x-g.sx,y-g.sy)<g.slop)return; if(!can()){ g=null; return; } g.on=true; drag(true); filet(true); on.start(g.sx,g.sy); } on.move(x,y); };"));
  assert.ok(app.includes('try{ on.end(cancel); }finally{ drag(false); }'));
  assert.ok(app.includes('calm=!P.busy&&!P.drag&&!(P.done&&go&&go.hidden);'));
});

test('réf. 5 : le badge en 22 px, un peu plus bas, centré sous le portrait décalé', () => {
  const s = anim('bases-relationnelles.html');
  assert.ok(s.includes('#cap .cap-stk{left:-26px}'));
  assert.ok(s.includes("bottom:-6px;top:auto;translate:-50% 0;rotate:-3deg;padding:6px 13px;border-radius:14px;") && s.includes("font:800 22px/1 var(--display,"));
});
