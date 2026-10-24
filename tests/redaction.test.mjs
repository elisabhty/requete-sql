/* La façon d’écrire d’Elisa, vérifiée sur tous les chapitres du projet (assets/anim/projet-*.html), y compris ceux qui viendront.
   Les règles, leurs exemples, les exceptions et la dette des anciens cours sont dans tests/helpers/redaction.mjs : c’est la charte, écrite en code.
   Ici : (1) les règles se vérifient elles-mêmes sur leurs exemples ; (2) chaque chapitre est relu avec toutes les règles, sans tolérance ;
   (3) la fiche de chaque leçon du projet (index.html) aussi ; (4) ce que chaque chapitre fait de ses textes (aides et corrections en typographie
   française, pas de question en cours de vidéo) ; (5) les anciennes vidéos et les cours en texte ne peuvent pas empirer, et ce qui reste à reprendre
   s’affiche ; (6) quelques garde-fous : la lecture des textes trouve bien de quoi lire, les exceptions servent encore. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as R from './helpers/redaction.mjs';

/* Tous les écarts d’une liste de textes : [{regle, texte, probleme}], exceptions déduites (et notées comme utilisées). */
const utilisees = new Set();
function ecarts(textes, regles = R.REGLES) {
  const out = [];
  for (const t of textes) for (const r of regles) for (const pb of R.probleme(r, t)) {
    const e = R.excepte(r, t, pb);
    if (e) utilisees.add(e); else out.push({regle: r, texte: t, probleme: pb});
  }
  return out;
}
/* Un rapport lisible : par règle, ce qu’Elisa a demandé, puis chaque texte fautif. */
function rapport(liste) {
  const parRegle = new Map();
  for (const e of liste) { if (!parRegle.has(e.regle.id)) parRegle.set(e.regle.id, []); parRegle.get(e.regle.id).push(e); }
  return [...parRegle].map(([, es]) => `\n● ${es[0].regle.titre}\n  ${es[0].regle.demande}\n` +
    es.map(e => `    ${e.texte.page} · ${e.texte.ou} : ${e.probleme}\n      « ${e.texte.plain.slice(0, 140)} »`).join('\n')).join('\n');
}
/* Pour une page des anciens cours : pour chaque règle, les écarts au-delà du plafond de la dette. */
function auDessusDuPlafond(textes, plafond = {}) {
  const out = [];
  for (const r of R.REGLES) {
    const fautifs = ecarts(textes, [r]).map(e => ({texte: e.texte, probleme: e.probleme}));
    if (fautifs.length > (plafond[r.id] || 0)) out.push({regle: r, plafond: plafond[r.id] || 0, fautifs});
  }
  return out;
}
const rapportPlafond = (page, liste) => liste.map(d => `\n● ${page} · ${d.regle.titre} : ${d.fautifs.length} écart(s), ${d.plafond} toléré(s)\n  ${d.regle.demande}\n` +
  d.fautifs.map(e => `    ${e.texte.ou} : ${e.probleme}\n      « ${e.texte.plain.slice(0, 140)} »`).join('\n')).join('\n');
const total = comptes => Object.values(comptes).flatMap(c => Object.entries(c)).reduce((s, [k, n]) => ({...s, [k]: (s[k] || 0) + n}), {});

/* ---------- 1. Les règles se vérifient elles-mêmes ---------- */
test('la charte : chaque règle a un titre, ce qu’Elisa a demandé, des bons et des mauvais exemples', () => {
  const ids = R.REGLES.map(r => r.id);
  assert.equal(new Set(ids).size, ids.length, 'un identifiant par règle');
  assert.ok(R.REGLES.length >= 12, 'toutes les corrections d’écriture sont là');
  for (const r of R.REGLES) {
    assert.ok(r.titre && r.demande && typeof r.verifie === 'function', `${r.id} : titre, demande, vérification`);
    assert.ok(r.bon?.length >= 1 && r.mauvais?.length >= 1, `${r.id} : au moins un bon et un mauvais exemple`);
  }
});
for (const r of R.REGLES) {
  test(`règle « ${r.id} » : ses bons exemples passent, ses mauvais exemples sont refusés`, () => {
    for (const ex of r.bon) {
      const t = R.texteDExemple(r, ex);
      assert.deepEqual(r.verifie(t), [], `bon exemple refusé : ${t.html}`);
    }
    for (const ex of r.mauvais) {
      const t = R.texteDExemple(r, ex);
      assert.ok(r.verifie(t).length > 0, `mauvais exemple accepté : ${t.html}`);
    }
  });
}

/* ---------- 2. Chaque chapitre du projet : toutes les règles, sans tolérance ---------- */
const PAGES = R.pagesProjet();
test('les chapitres du projet sont tous trouvés, avec de quoi lire', () => {
  assert.ok(PAGES.length >= 8, `huit chapitres au moins (${PAGES.join(', ')})`);
  for (const f of PAGES) {
    const ts = R.textes(f);
    const par = g => ts.filter(t => t.genre === g).length;
    assert.ok(par('legende') >= 25 && par('consigne') >= 6 && par('mail') >= 1 && par('recap') >= 3 && par('etiquette') >= 6, `${f} : légendes ${par('legende')}, consignes ${par('consigne')}, mails ${par('mail')}, récapitulatif ${par('recap')}, chapitres ${par('etiquette')}`);
    assert.ok(ts.length >= 80, `${f} : ${ts.length} textes lus`);
  }
});
for (const f of PAGES) {
  test(`${f} : toutes les règles d’écriture d’Elisa`, () => {
    const liste = ecarts(R.textes(f));
    assert.equal(liste.length, 0, rapport(liste));
  });
}

/* ---------- 3. La fiche de chaque leçon du projet (index.html) ---------- */
test('les leçons du projet sont toutes trouvées dans index.html', () => {
  const lecons = R.leconsDuProjet();
  assert.deepEqual(lecons.map(l => l.page).sort(), PAGES, 'une leçon pour chaque chapitre');
});
for (const l of R.leconsDuProjet()) {
  test(`fiche de la leçon ${l.id} (${l.titre}) : règles d’écriture`, () => {
    const liste = ecarts(R.textesFiche(l.id));
    assert.equal(liste.length, 0, rapport(liste));
  });
}

/* ---------- 4. Ce que chaque chapitre fait de ses textes ---------- */
for (const f of PAGES) {
  test(`${f} : pas de question en cours de vidéo, aides et corrections en typographie française`, () => {
    const src = fs.readFileSync(path.join(R.ANIM, f), 'utf8');
    assert.deepEqual(R.donnees(f).QUESTIONS, [], 'pas de question du lecteur au milieu d’une vidéo : les moments « À toi » font participer');
    const aide = src.match(/function hint\(i\)\{[\s\S]*?\n  \}\n/)?.[0] ?? '';
    assert.ok(/\bfr\(/.test(aide), 'les aides passent par fr() (espaces insécables, guillemets, apostrophes)');
    assert.deepEqual([...src.matchAll(/ok:\s*false,\s*why:(?!\s*fr\()[^,}]{0,60}/g)].map(m => m[0]), [], 'chaque correction calculée passe par fr()');
    assert.ok(/why: o\.why \? fr\(o\.why\) : ''/.test(src), 'les corrections écrites dans les réponses passent par fr()');
  });
}

/* ---------- 5. Les anciens cours : la dette ne peut que baisser ---------- */
const VIDEOS = R.pagesAutres();
const LECONS_ANCIENNES = R.toutesLesLecons().filter(l => !l.projet);
test('anciens cours : les vidéos et les leçons en texte sont lues', () => {
  assert.ok(VIDEOS.length >= 40, `${VIDEOS.length} vidéos`);
  for (const f of VIDEOS) assert.ok(R.textesVideo(f).length >= 20, `${f} : ${R.textesVideo(f).length} textes lus`);
  assert.ok(LECONS_ANCIENNES.length >= 50, `${LECONS_ANCIENNES.length} leçons`);
  assert.ok(R.textesFiche(62).length >= 50, 'la leçon Transactions (en texte) est lue en entier');
});
test('anciennes vidéos : aucun écart de plus que ceux déjà connus', () => {
  const rapports = VIDEOS.flatMap(f => {
    const nom = f.replace(/\.html$/, ''), hausses = auDessusDuPlafond(R.textesVideo(f), R.DETTE.videos[nom]);
    return hausses.length ? [rapportPlafond(nom, hausses)] : [];
  });
  assert.equal(rapports.length, 0, rapports.join('\n'));
});
test('anciennes leçons en texte : aucun écart de plus que ceux déjà connus', () => {
  const rapports = LECONS_ANCIENNES.flatMap(l => {
    const hausses = auDessusDuPlafond(R.textesFiche(l.id), R.DETTE.lecons[l.id]);
    return hausses.length ? [rapportPlafond(`leçon ${l.id} (${l.titre})`, hausses)] : [];
  });
  assert.equal(rapports.length, 0, rapports.join('\n'));
});
test('la dette connue : ce qui reste à reprendre dans les anciens cours (et ce qui a déjà été repris)', t => {
  const vid = Object.fromEntries(VIDEOS.map(f => [f.replace(/\.html$/, ''), R.compteParRegle(R.textesVideo(f))]));
  const lec = Object.fromEntries(LECONS_ANCIENNES.map(l => [l.id, R.compteParRegle(R.textesFiche(l.id))]));
  const tv = total(vid), tl = total(lec), titres = Object.fromEntries(R.REGLES.map(r => [r.id, r.titre]));
  for (const [k, n] of Object.entries(tv).sort((a, b) => b[1] - a[1])) t.diagnostic(`vidéos · ${n} × ${titres[k]}`);
  for (const [k, n] of Object.entries(tl).sort((a, b) => b[1] - a[1])) t.diagnostic(`leçons en texte · ${n} × ${titres[k]}`);
  /* Repris depuis le dernier relevé : le plafond de R.DETTE peut baisser. */
  const baisses = [];
  for (const [nom, plafond] of Object.entries(R.DETTE.videos)) for (const [r, n] of Object.entries(plafond)) if ((vid[nom]?.[r] || 0) < n) baisses.push(`vidéo ${nom} · ${r} : ${vid[nom]?.[r] || 0} pour ${n}`);
  for (const [id, plafond] of Object.entries(R.DETTE.lecons)) for (const [r, n] of Object.entries(plafond)) if ((lec[id]?.[r] || 0) < n) baisses.push(`leçon ${id} · ${r} : ${lec[id]?.[r] || 0} pour ${n}`);
  if (baisses.length) t.diagnostic(`DETTE à resserrer dans tests/helpers/redaction.mjs : ${baisses.join(' ; ')}`);
});

/* ---------- 6. Garde-fous ---------- */
test('chaque exception de la charte correspond à un texte qui existe encore', () => {
  const inutiles = R.EXCEPTIONS.filter(e => !utilisees.has(e));
  assert.deepEqual(inutiles.map(e => `${e.regle} · ${e.page} · ${e.contient ?? '(toute la page)'}`), [], 'exception obsolète : à retirer de tests/helpers/redaction.mjs');
});
test('chaque exception dit pourquoi', () => {
  for (const e of R.EXCEPTIONS) assert.ok(e.raison && e.raison.length > 20, `${e.regle} · ${e.page} : une raison est demandée`);
  for (const e of R.EXCEPTIONS) assert.ok(R.REGLES.some(r => r.id === e.regle), `${e.regle} : règle inconnue`);
});
test('à confirmer avec Elisa : ses propres mots qui dérogent à une de ses règles', t => {
  for (const e of R.EXCEPTIONS.filter(x => x.aConfirmer)) t.diagnostic(`${e.page} · « ${e.contient} » → ${e.aConfirmer}`);
});
