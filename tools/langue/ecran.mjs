/* Le français qui reste dans l'appli en anglais, vu à l'écran (15 novembre, Elisa : « Il y a encore beaucoup de français sur
   l'application »). appli.mjs ne voit que les textes passés par le moteur de traduction ; celui-ci lit l'écran lui-même : à
   chaque onglet et chaque écran ouvert, les textes visibles, les attributs lus à voix haute (aria-label, placeholder, title,
   alt), les alertes et les messages éphémères, dans quatre états (l'accueil tout neuf, le parcours tout neuf, un planning et
   deux leçons, tout fini), plus quelques leçons ouvertes. Un texte « a l'air français » s'il a un accent français ou un petit
   mot qui n'existe qu'en français. La liste, avec l'écran où on l'a vu : tools/langue/travail/<langue>/ecran-francais.json.

     node tools/langue/ecran.mjs --langue en [--profond]

   --profond : en plus, chaque leçon (son écran de fin), chaque carte mémo (recto, verso) et chaque fiche des SGBD. Les clés que
   le moteur a vues sans traduction : travail/<langue>/ecran-manque.json. */
import fs from 'node:fs';
import { serveur, navigateur, travail } from './commun.mjs';

const i = process.argv.indexOf('--langue'), LANGUE = i > 0 ? process.argv[i + 1] : 'en';
const ONGLETS = ['learn', 'planning', 'parcours', 'practice', 'defis', 'collection', 'notes', 'console', 'entretien', 'sgbd', 'library', 'compte'];

/* Dans la page : les textes visibles qui ont l'air français */
function relever(ou) {
  const MOTS = /(^|[^\p{L}])(le|la|les|des|du|une|et|est|pour|avec|dans|sur|pas|tu|ton|ta|tes|vous|votre|vos|ce|cette|ces|qui|que|leçons?|séances?|réviser|jours?|semaines?|ou|au|aux|mon|ma|mes|plus|très|déjà|encore|toutes?|tous|fois|sans|chez|ici|là|ans|ajouter|fermer|retour|suivant|valider|continuer|commencer|terminer|partager|annuler|enregistrer)(?=$|[^\p{L}])/iu;
  const ACCENTS = /[éèêëàâçùûüôîïœÉÈÊÀÇÔ]/;
  const NOMS = /Requête|Léa|Inès|Zoé|Chloé|Maël|Noé|Anaïs|Héloïse|Gaël|Mélissa|Hélène|Jérôme|Agnès|André|Benoît|Clément|Cécile|Dorothée|Émile|Éva|Loïc|Raphaël|Théo|Valérie|Zoë|Ève|Joël|Noël|Aimé|Rémi|Amélie|Océane/g;
  const francais = s => { const t = s.replace(NOMS, ''); return ACCENTS.test(t) || MOTS.test(t); };
  const vus = new Map();
  const visible = el => { if (!el || !el.getClientRects().length) return false; const st = getComputedStyle(el); return st.visibility !== 'hidden' && st.display !== 'none' && +st.opacity > 0.05; };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const t = n.nodeValue.replace(/\s+/g, ' ').trim();
    if (t.length < 2 || !/\p{L}{2}/u.test(t) || !francais(t)) continue;
    const el = n.parentElement; if (!el || el.closest('script,style,code.sql,pre,.cm-editor,[data-notrad]') || !visible(el)) continue;
    vus.set(t, ou);
  }
  for (const el of document.querySelectorAll('[aria-label],[placeholder],[title],img[alt]')) {
    if (el.closest('[data-notrad]')) continue;
    for (const a of ['aria-label', 'placeholder', 'title', 'alt']) { const t = (el.getAttribute(a) || '').trim(); if (t && francais(t) && (visible(el) || a === 'aria-label')) vus.set(`[${a}] ${t}`, ou); }
  }
  for (const t of (window.__messages || [])) if (francais(t)) vus.set(`[message] ${t}`, ou);
  window.__messages = [];
  return [...vus];
}

async function parcourir(browser, base, nom, etat, apres) {
  const ctx = await browser.newContext({viewport: {width: 393, height: 852}, serviceWorkers: 'block'});
  await ctx.route(u => !String(u).startsWith(base), r => r.fulfill({status: 404, body: ''}));
  await ctx.addInitScript(({LANGUE, etat}) => { try {
    window.__messages = [];
    for (const f of ['alert', 'confirm', 'prompt']) window[f] = m => { window.__messages.push(String(m)); return f === 'confirm' ? false : null; };
    if (sessionStorage.getItem('crawl-pret')) return;
    localStorage.clear();
    localStorage.setItem('requete-langue-essai', '1'); localStorage.setItem('requete-langue', LANGUE);
    if (etat) localStorage.setItem('requete-sql-v3', JSON.stringify(etat));
    sessionStorage.setItem('crawl-pret', '1');
  } catch (e) {} }, {LANGUE, etat});
  const p = await ctx.newPage(), trouves = new Map();
  /* Les messages éphémères (toasts) : tout texte ajouté à la page est relevé à l'arrivée, avant qu'il disparaisse */
  await p.addInitScript(() => { try { new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && /toast|snack|bulle|notif/i.test(n.className || '')) window.__messages.push(n.textContent.replace(/\s+/g, ' ').trim()); })
    .observe(document.documentElement, {childList: true, subtree: true}); } catch (e) {} });
  const noter = async ou => { for (const [t, o] of await p.evaluate(relever, ou).catch(() => [])) if (!trouves.has(t)) trouves.set(t, `${nom} · ${o}`); };
  await p.goto(`${base}/index.html?langue=${LANGUE}`, {waitUntil: 'load'}); await p.waitForTimeout(3500);
  if (apres) { await p.evaluate(apres); await p.waitForTimeout(800); await p.reload({waitUntil: 'load'}); await p.waitForTimeout(3500); }
  await noter('ouverture');
  if (!etat) {
    /* L'accueil tout neuf : on avance d'écran en écran par le bouton principal */
    for (let k = 0; k < 40; k++) {
      const ok = await p.evaluate(() => { const b = [...document.querySelectorAll('button,.btn,[role=button]')].filter(x => x.getClientRects().length && !x.disabled && getComputedStyle(x).visibility !== 'hidden')
        .find(x => /continue|next|start|let.s go|got it|ok|yes|skip|create|choose|see|i.m in|begin|maybe later|not now|allow/i.test(x.textContent)); if (!b) return false; b.click(); return true; });
      await p.waitForTimeout(700); await noter(`accueil, écran ${k + 1}`);
      if (!ok) { const opt = await p.evaluate(() => { const o = [...document.querySelectorAll('.ob-opt,.opt,.choice,[data-val],[data-value]')].find(x => x.getClientRects().length); if (o) { o.click(); return true; } return false; }); if (!opt) break; await p.waitForTimeout(400); }
    }
    await ctx.close(); return trouves;
  }
  const fonctions = await p.evaluate(() => Object.keys(window).filter(k => /^(render|open|show)[A-Z]\w*$/.test(k) && typeof window[k] === 'function' && window[k].length === 0
    && !/^(openLesson|openItem|showScreen|openExternal|openContact|openShare|openStore)/.test(k)));
  for (const t of ONGLETS) {
    await p.evaluate(t => { try { switchTab(t); } catch (e) {} }, t); await p.waitForTimeout(700); await noter(`onglet ${t}`);
    await p.evaluate(() => { try { window.scrollTo(0, document.body.scrollHeight); } catch (e) {} }); await p.waitForTimeout(300); await noter(`onglet ${t} (bas)`);
  }
  for (const f of fonctions) {
    await p.evaluate(f => { try { window[f](); } catch (e) {} }, f); await p.waitForTimeout(450); await noter(`${f}()`);
    await p.evaluate(() => { try { document.querySelectorAll('.sheet.open,.sheet.on,[data-sheet].on,.modal.on,.modal.open').forEach(s => s.classList.remove('open', 'on')); } catch (e) {} });
  }
  /* Chaque leçon (dans l'état « tout fini » : son écran de fin, la récompense, l'avis, la suite), chaque carte mémo (recto et verso),
     chaque fiche des SGBD */
  if (PROFOND) {
    const tout = await p.evaluate(() => { try { return {l: allLessons.map(x => x.id), c: [...new Set([...document.querySelectorAll('[onclick*="openCard("]')].map(e => (/openCard\('([^']+)'/.exec(e.getAttribute('onclick')) || [])[1]).filter(Boolean))], s: SGBD_PAGE.map(x => x.id).filter(Boolean)}; } catch (e) { return {l: [], c: [], s: []}; } });
    for (const id of tout.l) {
      await p.evaluate(id => { try { openLesson(id); } catch (e) {} }, id); await p.waitForTimeout(500); await noter(`leçon ${id}`);
      await p.evaluate(() => { try { window.scrollTo(0, 1e6); document.querySelectorAll('.scroll,.lesson-body,[class*="scroll"]').forEach(x => { x.scrollTop = 1e6; }); } catch (e) {} }); await p.waitForTimeout(250); await noter(`leçon ${id} (bas)`);
      await p.evaluate(() => { try { closeLesson(); } catch (e) {} }); await p.waitForTimeout(200);
    }
    await p.evaluate(() => { try { switchTab('collection'); } catch (e) {} }); await p.waitForTimeout(600);
    const cartes = tout.c.length ? tout.c : await p.evaluate(() => [...new Set([...document.querySelectorAll('[onclick*="openCard("]')].map(e => (/openCard\('([^']+)'/.exec(e.getAttribute('onclick')) || [])[1]).filter(Boolean))]);
    for (const id of cartes) {
      await p.evaluate(id => { try { openCard(id); } catch (e) {} }, id); await p.waitForTimeout(350); await noter(`carte ${id}`);
      await p.evaluate(() => { try { const c = document.querySelector('#card-sheet .mc, #card-sheet [class*="flip"], #card-sheet button'); if (c) c.click(); } catch (e) {} }); await p.waitForTimeout(450); await noter(`carte ${id} (verso)`);
      await p.evaluate(() => { try { closeCard(); } catch (e) {} try { document.querySelectorAll('#card-sheet,#card-back').forEach(x => x.classList.remove('on')); } catch (e) {} }); await p.waitForTimeout(150);
    }
    for (const id of tout.s) {
      await p.evaluate(id => { try { openSgbdSheet(id); } catch (e) {} }, id); await p.waitForTimeout(350); await noter(`SGBD ${id}`);
      await p.evaluate(() => { try { document.querySelectorAll('#sgbd-sheet,#sgbd-back').forEach(x => x.classList.remove('on')); } catch (e) {} });
    }
    console.log(`  ${tout.l.length} leçons, ${cartes.length} cartes, ${tout.s.length} fiches SGBD`);
  }
  /* Quelques leçons : la première, une du milieu, la dernière ; chacune page après page */
  const ids = await p.evaluate(() => { try { const l = allLessons; return [l[0], l[Math.floor(l.length / 3)], l[Math.floor(l.length * 2 / 3)], l[l.length - 1]].map(x => x.id); } catch (e) { return []; } });
  for (const id of ids) {
    await p.evaluate(id => { try { openLesson(id); } catch (e) {} }, id); await p.waitForTimeout(900);
    for (let k = 0; k < 14; k++) {
      await noter(`leçon ${id}, page ${k + 1}`);
      const ok = await p.evaluate(() => { const b = [...document.querySelectorAll('button')].filter(x => x.getClientRects().length && !x.disabled).find(x => /^(continue|next|check|got it|i understand|finish|see the answer)/i.test(x.textContent.trim())); if (!b) { const o = [...document.querySelectorAll('.opt,.choice,.qcm-opt,[data-i]')].find(x => x.getClientRects().length); if (o) o.click(); return !!o; } b.click(); return true; });
      await p.waitForTimeout(600); if (!ok) break;
    }
    await p.evaluate(() => { try { closeLesson && closeLesson(); } catch (e) {} try { switchTab('learn'); } catch (e) {} }); await p.waitForTimeout(500);
  }
  for (const k of await p.evaluate(() => (window.REQUETE_LANGUE && REQUETE_LANGUE.manquants ? REQUETE_LANGUE.manquants() : [])).catch(() => [])) MANQUE.add(k);
  await ctx.close(); return trouves;
}

const PROFOND = process.argv.includes('--profond'), MANQUE = new Set();
const srv = await serveur(), browser = await navigateur(), tous = new Map();
const lecons = id => ({done: true, at: 1000 + id});
const ETATS = [
  ['l’accueil tout neuf', null, null],
  ['le parcours tout neuf', {onboarded: true, name: 'Camille'}, null],
  ['un planning et deux leçons', {onboarded: true, name: 'Camille', lessons: {0: lecons(0), 1: lecons(1)}}, () => { try {
    const b = [...document.querySelectorAll('button')].find(x => /Créer mon planning|Create my schedule/.test(x.textContent)); if (b) b.click(); } catch (e) {} }],
  ['tout fini', {onboarded: true, name: 'Camille'}, () => { try {
    allLessons.forEach(l => { state.lessons = state.lessons || {}; state.lessons[l.id] = {done: true, at: Date.now()}; }); save(); } catch (e) {} }]
];
for (const [nom, etat, apres] of ETATS) {
  const r = await parcourir(browser, srv.base, nom, etat, apres);
  for (const [t, o] of r) if (!tous.has(t)) tous.set(t, o);
  console.log(`${nom} : ${r.size} textes qui ont l’air français`);
}
await browser.close(); srv.close();
const liste = [...tous].sort((a, b) => a[1].localeCompare(b[1])).map(([texte, ecran]) => ({texte, ecran}));
fs.writeFileSync(travail(LANGUE, 'ecran-francais.json'), JSON.stringify(liste, null, 1));
console.log(`${liste.length} textes → tools/langue/travail/${LANGUE}/ecran-francais.json`);
/* Ce que le moteur a vu passer sans traduction (sa clé, telle qu'il la cherche) */
fs.writeFileSync(travail(LANGUE, 'ecran-manque.json'), JSON.stringify([...MANQUE].sort(), null, 1));
console.log(`${MANQUE.size} clés sans traduction → tools/langue/travail/${LANGUE}/ecran-manque.json`);
