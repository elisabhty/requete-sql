/* 4 · Vérifier une vidéo traduite, image par image (toutes les 0,7 s) :
   - le français qui reste visible : des mots outils (le, la, des, avec…), des accents, et les noms SQL français de la base
     (clients, prenom, date_commande…) partout où ils se voient ;
   - les débordements : un texte dont l'étendue réelle sort d'un parent qui coupe (overflow), de sa carte (.card) ou de la scène,
     sur au moins deux images (une animation qui passe ne compte pas) ;
   - ce que le moteur n'a pas trouvé (REQUETE_LANGUE.manquants(), sans les données ni les noms SQL seuls).
   --francais : les débordements aussi dans la vidéo française. --pas=0.7 : l'écart entre deux images.
   node tools/langue/verifier.mjs --langue en projet-vue projet-index [--francais]
   Sortie : la liste par vidéo, et tools/langue/travail/<langue>/verification.json.
   - les boîtes peintes (fond, cadre, ombre) qui sortent de la scène (16 novembre : coupées au bord de l'écran d'un iPhone 15).
   Faux positifs connus (voulus) : un tableau qui défile exprès (bases-relationnelles), des pages qui glissent (limit-offset), un
   commentaire tronqué par « … » (projet-ondelete), un tampon posé à cheval sur sa carte (where). */
import fs from 'node:fs';
import { args, serveur, navigateur, contexte, video, travail, contenu, cle, motsRe, donnee, IDENT, lirePage, dejaTraduit } from './commun.mjs';

const {langue, videos, options} = args(), pas = +(options.pas || 0.7);
const base = contenu(`langue-${langue}.js`), re = motsRe(base.mots);
/* Les noms SQL français qui changent dans la langue (pas id, email, stock…) */
const fr = new Set();
for (const [t, [n, cols]] of Object.entries((base.base && base.base.tables) || {})) { if (t !== n) fr.add(t); for (const [a, b] of Object.entries(cols)) if (a !== b) fr.add(a); }
for (const [a, b] of Object.entries((base.base && base.base.defauts) || {})) if (a !== b && a.length > 3) fr.add(a);
const MOTS = '(^|[\\s(«“])(le|la|les|des|du|une|et|avec|pour|dans|sur|est|sont|aucun|aucune|chaque|ligne|lignes|depuis|toutes?|tous|où|leur|leurs|cette|qui|que|à|au|aux)(?=[\\s,.:;!?)»”]|$)|[àâçèêîôûœ]';
const SQL = '\\b(' + [...fr].sort((a, b) => b.length - a.length).join('|') + ')\\b';

/* Ce que la page regarde à l'instant T : les textes visibles, leurs défauts */
const regarder = ([T, mots, sql, cible]) => {
  window.renderAt(T);
  const stage = document.getElementById('stage'), S = stage.getBoundingClientRect(), out = [], rg = document.createRange();
  const RM = mots && new RegExp(mots, 'i'), RS = sql && new RegExp(sql);
  const vis = e => { for (let q = e; q && q !== document.body; q = q.parentElement) { const cs = getComputedStyle(q); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.5) return false; } return true; };
  const tw = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
  for (let n; (n = tw.nextNode());) {
    if (!/\S/.test(n.nodeValue)) continue; const e = n.parentElement; if (!e || e.closest('#header, .caret, svg, .ch')) continue;
    rg.selectNodeContents(n); const r = rg.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || !vis(e)) continue;
    const box = e.closest('[id]'), nom = (box ? '#' + box.id : '') + ' .' + String(e.className || e.tagName).split(' ')[0];
    const txt = (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70);
    if (cible !== 'fr') {
      /* la marque, les noms et les adresses des clients, un titre de livre : des données, qui ne se traduisent pas */
      const t = n.nodeValue.replace(/Requête|Inès|Lefèvre|Les Misérables/g, '').replace(/\d+ (rue|avenue|allée|place|boulevard)\b.*$|\b(RUE|AVENUE|ALLÉE|PLACE) DES?\b.*$/gi, '');
      if (RM && RM.test(t)) out.push('français|' + nom + '|' + txt);
      else if (RS && RS.test(t)) out.push('sql-français|' + nom + '|' + txt);
    }
    let def = '';
    for (let q = e; q && q !== stage; q = q.parentElement) { const qs = getComputedStyle(q);
      if (qs.overflowX !== 'visible') { const Q = q.getBoundingClientRect(), bl = parseFloat(qs.borderLeftWidth) || 0, br = parseFloat(qs.borderRightWidth) || 0;
        if (Q.width > 4 && (r.right > Q.right - br + 1.5 || r.left < Q.left + bl - 1.5)) { def = 'rogné'; break; } } }
    if (!def) { const k = e.closest('.card'); if (k) { const K = k.getBoundingClientRect(); if (K.width > 4 && (r.right > K.right + 1.5 || r.left < K.left - 1.5)) def = 'hors-carte'; } }
    if (!def && ((r.right > S.right + 2 && r.left < S.right - 8) || (r.left < S.left - 2 && r.right > S.left + 8))) def = 'hors-scène';
    if (def) out.push(def + '|' + nom + '|' + txt);
  }
  /* 16 novembre (Elisa, sa capture sur l'iPhone 15 : « SELECT first_name, last_name, email » coupé au bord) : une boîte peinte (fond,
     cadre, ombre) qui sort de la scène, même quand son texte y tient encore. Sur un iPhone 15, la scène fait la largeur de l'écran. */
  for (const e of stage.querySelectorAll('*')) {
    if (e.closest('#header, #cap, #chapter, #progress, .blob, .mb, .mb-veil, .pont-pill, .caret') || (e instanceof SVGElement && e.tagName !== 'svg')) continue;
    const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.width > S.width * 1.2) continue;
    if (r.left > S.left - 2 && r.right < S.right + 2) continue;
    if (!vis(e)) continue;
    const cs = getComputedStyle(e);
    if (cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.backgroundImage === 'none' && !(parseFloat(cs.borderLeftWidth) > 0) && cs.boxShadow === 'none') continue;
    let coupe = false;
    for (let q = e.parentElement; q && q !== stage; q = q.parentElement) { const qs = getComputedStyle(q); if (qs.overflowX !== 'visible') { const Q = q.getBoundingClientRect(); if (Q.left > S.left - 2 && Q.right < S.right + 2) { coupe = true; break; } } }
    if (coupe) continue;
    const box = e.closest('[id]');
    out.push('boîte-hors-scène|' + (box ? '#' + box.id : '') + ' .' + String(e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className || e.tagName).split(' ')[0] + '|' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70));
  }
  /* Le code : ses lignes sont découpées en caractères pour la frappe ; on lit la ligne entière */
  if (cible !== 'fr') stage.querySelectorAll('.ln').forEach(e => {
    const r = e.getBoundingClientRect(); if (r.width < 2 || !vis(e)) return;
    const t = (e.textContent || '').replace(/Requête|Inès|Lefèvre/g, ''), box = e.closest('[id]');
    if ((RM && /^\s*--/.test(t) && RM.test(t)) || (RS && RS.test(t.replace(/'[^']*'/g, '')))) out.push('code-français|' + (box ? '#' + box.id : '') + '|' + t.trim().slice(0, 70));
  });
  return out;
};

const srv = await serveur(), b = await navigateur(), res = {};
const langues = options.francais ? [langue, 'fr'] : [langue];
for (const l of langues) {
  const ctx = await contexte(b, l);
  for (const c of videos) {
    const {p, R, erreurs} = await video(ctx, srv.base, c), vus = new Map();
    for (let T = 0.3; T < R.duration; T += pas) {
      for (const x of await p.evaluate(regarder, [T, MOTS, SQL, l])) { const v = vus.get(x); if (v) v.n++; else vus.set(x, {t: T, n: 1}); }
    }
    const liste = [...vus].filter(([x, v]) => v.n >= 2 || /français/.test(x)).map(([x, v]) => `${v.t.toFixed(1)} ×${v.n} ${x}`);
    let reste = [];
    const pg = l !== 'fr' && lirePage(l, c), vals = pg ? Object.values(pg.textes) : [];
    /* ce que le moteur n'a pas trouvé et qui a l'air français (le reste : des noms, du code, de l'anglais déjà écrit) */
    const francais = new RegExp(MOTS, 'i');
    if (l !== 'fr') reste = (await p.evaluate(() => window.REQUETE_LANGUE.manquants())).filter(x => { const k = cle(x, re);
      return !donnee(k) && !IDENT.test(k.trim()) && !dejaTraduit(x, vals) && francais.test(String(x).replace(/Inès|Lefèvre|<[^>]+>/g, ' ')); });
    (res[c] = res[c] || {})[l] = {defauts: liste, reste, erreurs};
    console.log(`== ${c} (${l})`, liste.length ? `${liste.length} à regarder` : 'rien', reste.length ? `· sans traduction ${reste.length}` : '', erreurs.length ? '· ERREURS ' + erreurs.slice(0, 2).join(' | ') : '');
    liste.slice(0, 20).forEach(x => console.log('   ', x)); reste.slice(0, 8).forEach(x => console.log('    reste |', x));
    await p.close();
  }
  await ctx.close();
}
fs.writeFileSync(travail(langue, 'verification.json'), JSON.stringify(res, null, 1));
await b.close(); srv.close();
