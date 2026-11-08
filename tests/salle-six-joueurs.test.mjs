import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = lire('index.html'), css = lire('ludique.css');

/* Elisa, 8 novembre, 22 h 27 : « alors accepte 6 max dans une salle, comme ça on a deux lignes pleines -> corrige dans les pages
   (textes etc) ». Six joueurs par salle (l’hôte et 5 invités) au lieu de 5 : « En direct » a trois colonnes, deux lignes pleines. */
test('six joueurs par salle : l’appli, ses textes et les trois colonnes d’« En direct »', () => {
  assert.ok(app.includes('const JEU_MAX=6;'), 'six au plus');
  assert.ok(app.includes('max:solo?1:JEU_MAX'), 'seul : une place');
  assert.ok(app.includes('invite jusqu’à ${JEU_MAX-1} joueurs, ou ouvre ta salle à tous.'), 'le cadre du haut : « jusqu’à 5 joueurs »');
  assert.ok(app.includes("complete:['Salle complète&nbsp;!','Elle accueille déjà 6 joueurs, le maximum.']"), 'la feuille du code, salle pleine');
  assert.ok(app.includes('<span><b>${JEU_MAX}</b>\\u00a0joueurs max</span>'), '« Créer ma partie » : « 6 joueurs max »');
  assert.ok(app.includes('`Une salle accueille ${J.max} joueurs au maximum.'), 'la salle complète');
  assert.ok(app.includes('+s.nb<(+s.max||JEU_MAX)') && app.includes('max:+s.max||JEU_MAX'), 'les salles ouvertes : 6 par défaut');
  assert.ok(!app.includes('Elle accueille déjà 5') && !app.includes('<p class="room-sub">Choisis ton niveau et invite jusqu’à 4 joueurs'), 'plus de « 5 » ni de « 4 invités »');
  assert.ok(css.includes('html.lq #jeu-root .jeu-direct-av{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));'), 'trois colonnes : deux lignes pleines à six');
  assert.ok(app.includes('c:ordre.indexOf(pid)%6'), 'six couleurs d’avatar, une par joueur');
});

test('six joueurs par salle : la base laisse entrer le 6e et montre la salle tant qu’elle a moins de 6 joueurs', () => {
  const f = readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter(x => x.endsWith('_salle_six_joueurs.sql'));
  assert.equal(f.length, 1);
  const sql = lire('supabase/migrations/' + f[0]);
  assert.ok(sql.includes("avant constant text := 'case when r.solo then 1 else 5 end';") && sql.includes(') / length(avant) <> 3 then'),
    'les trois « 5 » de jeu_envoyer_v2 (deux « salle pleine », le réglage), ou rien');
  assert.ok(sql.includes("neuf := replace(def, avant, 'case when r.solo then 1 else 6 end');"));
  assert.ok(sql.includes("neuf := replace(replace(def, 'having count(v.pid) < 5', 'having count(v.pid) < 6'), '''max'', 5,', '''max'', 6,');"));
  assert.ok(sql.includes("pg_get_functiondef('public.jeu_envoyer_v2(text,jsonb,text)'::regprocedure)") && sql.includes("pg_get_functiondef('public.jeu_salles_ouvertes(text)'::regprocedure)"),
    'les fonctions telles qu’elles sont en service');
});

test('six joueurs par salle : la salle dans l’île (fonction jeu-ile, Live Activity)', () => {
  const h = lire('supabase/functions/jeu-ile/handler.mjs');
  assert.ok(h.includes('const MAX_JOUEURS = 6;') && h.includes('e.joueurs.length > MAX_JOUEURS') && h.includes('r = entier(j.r, 0, MAX_JOUEURS)')
    && h.includes('r.cibles.slice(0, MAX_JOUEURS - 1)'), 'six joueurs, cinq autres à prévenir');
  const w = lire('resources/ios/widget/RequeteWidget/RequeteWidget.swift');
  assert.ok(w.includes('private static let teintes: [Color] = [violetVif, braise, menthe, dore, lilas, framboise]'), 'six couleurs');
  assert.ok(w.includes('Array(joueurs.prefix(AvatarsSalle.teintes.count))') && w.includes('AvatarsSalle.teintes[i % AvatarsSalle.teintes.count]'), 'six pastilles');
  assert.ok(!w.includes('prefix(5)') && !w.includes('« 2/5 »'));
  assert.ok(lire('resources/ios/widget/App/RequeteWidgetPlugin.swift').includes('let places: Int = call.getInt("max") ?? 6'));
  assert.ok(lire('IOS.md').includes('« 2/6 » (six joueurs par salle depuis le 8 novembre)'));
});
