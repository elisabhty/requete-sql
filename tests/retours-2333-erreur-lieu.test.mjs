// 27 novembre, 23 h 33 (Elisa : « ok ») : la statistique « erreur » dit aussi d'où vient l'erreur (o), pour retrouver les
// « Load failed » : le chemin d'un appel réseau coupé (sans paramètres, 4 segments au plus), sinon le fichier et la ligne.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const debut = html.indexOf('function statErreurChemin(');
const fin = html.indexOf("if(typeof window!=='undefined'&&typeof window.addEventListener==='function'){\n  window.addEventListener('load',()=>setTimeout(()=>{try{statOuverture()");

function charger(fetchDeBase) {
  const ctx = { location: { href: 'capacitor://localhost/index.html', hostname: 'localhost' }, window: { fetch: fetchDeBase } };
  const f = new Function('location', 'window', html.slice(debut, fin) + '\nreturn {statErreurChemin, statErreurLieu};');
  return { ...f(ctx.location, ctx.window), window: ctx.window };
}

test('le code est en place et la statistique garde l’endroit', () => {
  assert.ok(debut > 0 && fin > debut);
  assert.match(html, /function statErreur\(m,o\)\{/);
  assert.ok(html.includes("...(o?{o:String(o).replace(/\\s+/g,' ').slice(0,60)}:{})"));
  assert.match(html, /addEventListener\('unhandledrejection',e=>\{try\{const r=e&&e\.reason;statErreur\(r&&r\.message\?r\.message:String\(r\),statErreurLieu\(r\)\);/);
});

test('le chemin appelé : sans paramètres, sans ce qui suit le 4e segment', () => {
  const { statErreurChemin: c } = charger(() => Promise.resolve('ok'));
  assert.equal(c('https://abc.supabase.co/rest/v1/rpc/jeu_identite_v2?x=1'), 'supabase/rest/v1/rpc/jeu_identite_v2');
  assert.equal(c('https://abc.supabase.co/storage/v1/object/contact-pieces/dossier/photo.png'), 'supabase/storage/v1/object/contact-pieces');
  assert.equal(c('https://requeteapp.com/maj/version.json?t=1'), 'requeteapp.com/maj/version.json');
  assert.equal(c('assets/sons/ouverture.m4a'), 'assets/sons/ouverture.m4a');
  assert.equal(c({ url: 'https://abc.supabase.co/auth/v1/token?grant_type=password' }), 'supabase/auth/v1/token');
});

test('un appel réseau coupé garde son chemin ; un appel réussi ne change pas', async () => {
  const { statErreurLieu: l, window } = charger(u => String(u).includes('coupe')
    ? Promise.reject(new TypeError('Load failed')) : Promise.resolve('ok'));
  assert.equal(window.fetch.requeteChemin, true);
  assert.equal(await window.fetch('https://abc.supabase.co/rest/v1/ok'), 'ok');
  await assert.rejects(window.fetch('https://abc.supabase.co/functions/v1/coupe/a/b?k=1'), e => {
    assert.equal(e.message, 'Load failed');
    assert.equal(l(e), 'supabase/functions/v1/coupe/a');
    return true;
  });
});

test('sans appel réseau : le fichier et la ligne', () => {
  const { statErreurLieu: l } = charger(() => Promise.resolve('ok'));
  assert.equal(l({ stack: 'clsRattraper@capacitor://localhost/index.html:29327:12\nx@capacitor://localhost/maj.js:3:1' }), 'index.html:29327');
  assert.equal(l(null), '');
  assert.equal(l({}), '');
});
