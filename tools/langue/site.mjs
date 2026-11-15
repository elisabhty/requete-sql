/* Le site (decouvrir/) dans une autre langue : des pages statiques, écrites dans decouvrir/<langue>/ à partir des pages françaises
   et d'un dictionnaire (tools/langue/site/<langue>.json : texte français → traduction). Le français reste la source : une page
   française modifiée se reconstruit d'une commande.

     node tools/langue/site.mjs --langue en recolter     les textes à traduire (travail/<langue>/site-a-traduire.json)
     node tools/langue/site.mjs --langue en construire   les pages decouvrir/<langue>/*.html et decouvrir/<langue>/modules.js
     node tools/langue/site.mjs --langue en verifier     les pages construites, ouvertes : du français visible, une adresse cassée
     node tools/langue/site.mjs --langue en publier      le jour où la langue sort d'essai : le menu des pages françaises y mène,
                                                         les pages de la langue entrent dans les moteurs de recherche (puis construire)

   Ce qui se traduit :
   - un « bloc » : un élément dont tout le contenu est du texte et des balises de mise en forme (b, a, span, code, br…), d'un seul
     morceau : sa clé est son HTML intérieur (« Apprends le <b>SQL</b> »), sa traduction aussi ;
   - les attributs lus par une personne ou un moteur de recherche : alt, title, aria-label, placeholder, content des balises meta,
     data-soon ;
   - les chaînes des scripts de la page et de modules.js qui contiennent du texte (une carte de module écrite en JavaScript) ;
   - les questions de la FAQ en JSON-LD, chaîne par chaîne.
   Les adresses relatives sont recalculées (la page est un dossier plus bas) ; les pages du site restent entre elles dans la langue. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { ROOT, lire, travail, serveur, navigateur } from './commun.mjs';

const i = process.argv.indexOf('--langue'), LANGUE = i > 0 ? process.argv[i + 1] : 'en';
const ACTION = process.argv.find(a => ['recolter', 'construire', 'verifier', 'publier'].includes(a)) || 'recolter';
const PAGES = ['index.html', 'module.html', 'video.html', 'conditions.html', 'confidentialite.html', 'mentions-legales.html', 'connexion.html'];
const DICO = path.join(ROOT, 'tools/langue/site', LANGUE + '.json');
const SORTIE = path.join(ROOT, 'decouvrir', LANGUE);
/* Les adresses hreflang : complètes, comme les veut Google (15 novembre, le site anglais ouvert) */
const SITE = 'https://requeteapp.com/decouvrir/';
const LOCALES = {en: 'en_US', es: 'es_ES', de: 'de_DE', it: 'it_IT', pt: 'pt_PT'};

const propre = s => String(s).replace(/[\u00a0\u202f\u2009]/g, ' ').replace(/\s+/g, ' ').trim();
const texteVisible = s => /[A-Za-zÀ-ÿ]{2}/.test(String(s).replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, ' '));
export const dico = () => (fs.existsSync(DICO) ? JSON.parse(fs.readFileSync(DICO, 'utf8')) : {});

/* ---------- Les chaînes d'un script ---------- */
/* Les chaînes '…', "…" et `…` (sans ${…}) d'un code JavaScript, avec leur place. Les commentaires sont sautés. */
export function chaines(code) {
  const out = [];
  for (let k = 0; k < code.length; k++) {
    const c = code[k];
    if (c === '/' && code[k + 1] === '/') { while (k < code.length && code[k] !== '\n') k++; continue; }
    if (c === '/' && code[k + 1] === '*') { const f = code.indexOf('*/', k + 2); k = f < 0 ? code.length : f + 1; continue; }
    if (c === "'" || c === '"' || c === '`') {
      let j = k + 1, v = '';
      while (j < code.length && code[j] !== c) { if (code[j] === '\\') { v += code[j] + code[j + 1]; j += 2; continue; } if (c !== '`' && code[j] === '\n') break; v += code[j]; j++; }
      if (code[j] === c) { out.push({debut: k, fin: j + 1, q: c, v}); k = j; }
    }
  }
  return out;
}
/* Une chaîne de code à traduire : du texte pour une personne (des mots, ou une balise avec des mots), pas une classe ni un nom */
const aTraduire = v => !/\$\{/.test(v) && (/(aria-label|alt|title|placeholder)=\\?"[^"]*[A-Za-zÀ-ÿ]{3}/.test(v) || texteVisible(v)) && (/[a-zà-ÿ]{2,}[ ’'\u00a0][a-zà-ÿ0-9]/i.test(v.replace(/<[^>]*>/g, ' ')) || /[À-ÿ]/.test(v) || />[^<]*[A-Za-zÀ-ÿ]{3}[^<]*</.test(v) || /(aria-label|alt|title|placeholder)=\\?"[^"]*[A-Za-zÀ-ÿ]{3}/.test(v))
  && !/^[\w-]+(\.[\w-]+)*$/.test(v) && !/^(#|\.|\[)[\w\s.#:[\]="'-]*$/.test(v) && !/^[a-z][\w-]*( [a-z][\w-]*)*$/.test(v) && !/^\[?Requête\]?$/.test(v);
/* Remplace les chaînes traduites d'un code ; garde les guillemets d'origine (une apostrophe ’ n'en est pas un) */
export function traduireCode(code, D, manque) {
  let out = '', pos = 0;
  for (const s of chaines(code)) {
    /* Un morceau court que la récolte ne prend pas (« ' fichier' », « ' et ' ») : sa clé « js:… », telle qu'elle est écrite */
    const exact = D['js:' + s.v];
    if (exact == null && !aTraduire(s.v)) continue;
    const brut = exact != null ? exact : D[propre(s.v)];
    if (brut == null) { if (manque) manque.add(propre(s.v)); continue; }
    /* Les espaces du bord de la chaîne d'origine restent (« ' étoile' ») */
    const t = exact != null ? brut : (s.v.match(/^(\s|\\u00a0)*/)[0] + brut + s.v.match(/(\s|\\u00a0)*$/)[0]);
    const echappe = String(t).replace(/\\(?!u[0-9a-fA-F]{4}|n)/g, '\\\\').split(s.q).join('\\' + s.q).replace(/\n/g, '\\n');
    out += code.slice(pos, s.debut) + s.q + echappe + s.q; pos = s.fin;
  }
  return out + code.slice(pos);
}

/* ---------- Dans la page (Chromium, scripts coupés) ---------- */
function relever() {
  const INLINE = new Set(['A', 'B', 'STRONG', 'EM', 'I', 'SPAN', 'CODE', 'BR', 'SMALL', 'SUP', 'SUB', 'ABBR', 'KBD', 'MARK', 'S', 'U', 'IMG', 'WBR', 'TIME', 'Q', 'BDI']);
  const ATTRS = ['alt', 'title', 'aria-label', 'placeholder', 'data-soon', 'data-titre', 'data-label'];
  const propre = s => String(s).replace(/[\u00a0\u202f\u2009]/g, ' ').replace(/\s+/g, ' ').trim();
  const lettres = s => /[A-Za-zÀ-ÿ]{2}/.test(s);
  const enLigne = el => [...el.childNodes].every(n => n.nodeType !== 1 || (n.namespaceURI === 'http://www.w3.org/2000/svg' ? true : INLINE.has(n.tagName) && enLigne(n)));
  const blocs = [], attrs = [];
  const marcher = el => {
    if (['SCRIPT', 'STYLE', 'TEMPLATE', 'svg'].includes(el.tagName) || el.namespaceURI === 'http://www.w3.org/2000/svg' || el.hasAttribute('data-notrad')) return;
    if (el !== document.body && enLigne(el) && lettres(el.textContent)) { blocs.push(el); return; }
    for (const c of el.children) marcher(c);
  };
  marcher(document.body);
  document.querySelectorAll('*').forEach(el => {
    for (const a of ATTRS) if (el.hasAttribute(a) && lettres(el.getAttribute(a))) attrs.push([el, a]);
    if (el.tagName === 'META' && el.hasAttribute('content') && /^(description|og:title|og:description|twitter:title|twitter:description|og:site_name)$/.test(el.getAttribute('name') || el.getAttribute('property') || '')) attrs.push([el, 'content']);
  });
  const titre = document.querySelector('title');
  /* La clé d'un bloc : son HTML intérieur, chaque dessin (svg, img) remplacé par <1/>, <2/>… ; mettre(el, t) remet les dessins */
  const objets = el => [...el.querySelectorAll('svg, img')].filter(x => !x.parentElement.closest('svg'));
  const cle = el => {
    const c = el.cloneNode(true), o = objets(c);
    o.forEach((x, n) => x.replaceWith(document.createTextNode('\u0001' + (n + 1) + '\u0001')));
    return propre(c.innerHTML.replace(/\u0001(\d+)\u0001/g, '<$1/>'));
  };
  const mettre = (el, t) => {
    const o = objets(el).map(x => x.outerHTML);
    el.innerHTML = String(t).replace(/<(\d+)\/>/g, (m, n) => o[n - 1] || '');
  };
  return {blocs, attrs, titre, propre, cle, mettre};
}

/* La page française, scripts coupés ; une redirection (meta refresh) est mise de côté le temps de la lire, puis rendue telle quelle */
async function pagesFrancaises(browser, base, f) {
  const ctx = await browser.newContext({javaScriptEnabled: false});
  const p = await ctx.newPage();
  await p.route(`${base}/decouvrir/${f}`, r => r.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: lire('decouvrir/' + f).replace(/http-equiv="refresh"/g, 'http-equiv="x-refresh"')}));
  await p.goto(`${base}/decouvrir/${f}`, {waitUntil: 'domcontentloaded'});
  return {ctx, p};
}

async function recolter() {
  const D = dico(), vus = new Map();
  const ajoute = (fr, page, type) => { const k = propre(fr); if (!k || !texteVisible(k)) return; if (!vus.has(k)) vus.set(k, {fr: k, en: D[k] ?? null, pages: [], type}); const x = vus.get(k); if (!x.pages.includes(page)) x.pages.push(page); };
  const srv = await serveur(), browser = await navigateur();
  for (const f of PAGES) {
    const {ctx, p} = await pagesFrancaises(browser, srv.base, f);
    const r = await p.evaluate(`(${relever})()`.replace('return {blocs, attrs, titre, propre, cle, mettre};', 'return {blocs: blocs.map(cle), attrs: attrs.map(([e, a]) => propre(e.getAttribute(a))), titre: titre ? propre(titre.textContent) : ""};'));
    r.blocs.forEach(b => ajoute(b, f, 'bloc')); r.attrs.forEach(a => ajoute(a, f, 'attribut')); if (r.titre) ajoute(r.titre, f, 'titre');
    const html = lire('decouvrir/' + f);
    for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/ld\+json/.test(m[1])) { const walk = o => { if (typeof o === 'string') ajoute(o, f, 'faq'); else if (o && typeof o === 'object') Object.entries(o).forEach(([k, v]) => { if (!k.startsWith('@')) walk(v); }); }; try { walk(JSON.parse(m[2])); } catch (e) {} continue; }
      for (const s of chaines(m[2])) if (aTraduire(s.v)) ajoute(s.v, f, 'script');
    }
    await ctx.close();
  }
  for (const s of chaines(lire('decouvrir/modules.js'))) if (aTraduire(s.v)) ajoute(s.v, 'modules.js', 'script');
  await browser.close(); srv.close();
  const tous = [...vus.values()], reste = tous.filter(x => x.en == null);
  fs.writeFileSync(travail(LANGUE, 'site-a-traduire.json'), JSON.stringify(reste, null, 1));
  fs.writeFileSync(travail(LANGUE, 'site-tout.json'), JSON.stringify(tous, null, 1));
  console.log(`${tous.length} textes, ${reste.length} sans traduction (${reste.reduce((n, x) => n + x.fr.length, 0)} caractères) → ${path.relative(ROOT, travail(LANGUE, 'site-a-traduire.json'))}`);
}

/* ---------- Construire ---------- */
/* Les vignettes des cours : celles de la langue (assets/anim/<langue>/<cours>-thumb.webp), écrites dans la page ou bâties par un
   script (« '<img src="../assets/anim/'+a+'-thumb.jpg"' ») ; une vignette qui manque dans la langue garde la française. */
function vignettes(t) {
  const toutes = fs.readdirSync(path.join(ROOT, 'assets/anim', LANGUE)).filter(x => x.endsWith('-thumb.webp')).length >= 71;
  t = t.replace(/((?:\.\.\/)+)assets\/anim\/([\w-]+)-thumb\.jpg/g, (m, pre, c) => (fs.existsSync(path.join(ROOT, 'assets/anim', LANGUE, c + '-thumb.webp')) ? `${pre}assets/anim/${LANGUE}/${c}-thumb.webp` : m));
  if (toutes) t = t.replace(/((?:\.\.\/)+)assets\/anim\/'\+(\w+)\+'-thumb\.jpg/g, `$1assets/anim/${LANGUE}/'+$2+'-thumb.webp`);
  return t;
}

/* Un fichier du site cité dans une chaîne de script (« avis/sofia-b-mini.webp », « mascotte.webp ») : vu d'un dossier plus bas. La voix
   (voix/…, avis/….mp3) reste à chercher dans le dossier de la langue : tant qu'elle n'y est pas, la vidéo et les avis restent muets
   plutôt que de parler français sous un texte traduit. */
export function cheminsCode(code) {
  let out = '', pos = 0;
  for (const s of chaines(code)) {
    const v = s.v;
    if (!/^[\w\-./]+\.(webp|png|jpe?g|svg|gif|mp4|json|css|woff2?)$/i.test(v) || v.startsWith('../') || v.startsWith('voix/')) continue;
    if (!fs.existsSync(path.join(ROOT, 'decouvrir', v)) || fs.existsSync(path.join(SORTIE, v))) continue;
    out += code.slice(pos, s.debut) + s.q + '../' + v + s.q; pos = s.fin;
  }
  return out + code.slice(pos);
}

/* Une adresse de la page française, vue depuis decouvrir/<langue>/ (sans dépendance : elle sert aussi dans la page) */
export function adresse(u) {
  const pages = ['index.html', 'module.html', 'video.html', 'conditions.html', 'confidentialite.html', 'mentions-legales.html', 'connexion.html', 'modules.js', './', '', '.'];
  if (!u || /^([a-z]+:|#|\/\/|data:|blob:|\$\{|'|")/i.test(u)) return u;
  if (u.startsWith('../')) return '../' + u;
  if (u.startsWith('voix/')) return u;
  return pages.includes(u.split(/[?#]/)[0]) ? u : '../' + u;
}

async function construire() {
  const D = dico(), manque = new Set();
  fs.mkdirSync(SORTIE, {recursive: true});
  const srv = await serveur(), browser = await navigateur();
  for (const f of PAGES) {
    const {ctx, p} = await pagesFrancaises(browser, srv.base, f);
    const res = await p.evaluate(({D, LANGUE, LOCALE, f, relever, adresseSrc, autres, publie}) => {
      const adresse = new Function('return ' + adresseSrc)();
      const r = new Function('return (' + relever + ')()')(), manque = [];
      const tr = s => { const k = r.propre(s); if (!k) return s; if (Object.prototype.hasOwnProperty.call(D, k)) return D[k]; manque.push(k); return null; };
      /* Les attributs d'abord : un dessin d'un bloc (une image et son alt) est remis tel qu'il est alors, déjà traduit */
      const cles = r.blocs.map(r.cle);
      for (const [el, a] of r.attrs) { const t = tr(el.getAttribute(a)); if (t != null) el.setAttribute(a, t); }
      r.blocs.forEach((b, n) => { const t = tr(cles[n]); if (t != null) r.mettre(b, t); });
      if (r.titre) { const t = tr(r.titre.textContent); if (t != null) r.titre.textContent = t; }
      document.documentElement.lang = LANGUE;
      const og = document.querySelector('meta[property="og:locale"]'); if (og) og.setAttribute('content', LOCALE);
      /* Les adresses : un dossier plus bas */
      for (const el of document.querySelectorAll('[src],[href],[poster],[srcset],[data-src]')) {
        for (const a of ['src', 'href', 'poster', 'data-src']) if (el.hasAttribute(a)) el.setAttribute(a, adresse(el.getAttribute(a)));
        if (el.hasAttribute('srcset')) el.setAttribute('srcset', el.getAttribute('srcset').split(',').map(x => { const [u, ...d] = x.trim().split(/\s+/); return [adresse(u), ...d].join(' '); }).join(', '));
      }
      const ogi = document.querySelector('meta[property="og:image"]'); if (ogi) ogi.setAttribute('content', adresse(ogi.getAttribute('content')));
      /* La page dans les autres langues (hreflang), et pas encore dans les moteurs de recherche tant que la langue est en essai */
      const head = document.head, nom = f === 'index.html' ? '' : f;
      head.querySelectorAll('link[rel="alternate"][hreflang]').forEach(l => l.remove());
      for (const [code, href] of autres) { const l = document.createElement('link'); l.rel = 'alternate'; l.hreflang = code; l.href = href + nom; head.appendChild(l); }
      if (!publie) { const robots = document.createElement('meta'); robots.name = 'robots'; robots.content = 'noindex'; head.appendChild(robots); }
      /* Le choix de la langue : celle de la page est cochée ; le français mène à la page française (data-href) */
      for (const o of document.querySelectorAll('.lang-o[lang], .lang-c[lang]')) {
        const l = o.getAttribute('lang');
        if (l === LANGUE) { o.classList.add('on'); o.setAttribute('aria-current', 'true'); o.removeAttribute('data-soon'); o.removeAttribute('data-href'); }
        else if (l === 'fr') { o.classList.remove('on'); o.removeAttribute('aria-current'); o.setAttribute('data-href', '../' + (f === 'index.html' ? '' : f)); }
      }
      if (document.querySelector('[data-href]')) {
        const s = document.createElement('script');
        s.textContent = "document.addEventListener('click',function(e){var o=e.target.closest&&e.target.closest('[data-href]');if(o)location.href=o.getAttribute('data-href')+location.hash;});";
        document.body.appendChild(s);
      }
      /* Les scripts sont gardés pour la suite (traduits dans Node) : on les repère */
      [...document.querySelectorAll('script:not([src])')].forEach((s, n) => s.setAttribute('data-n', n));
      return {html: '<!doctype html>\n' + document.documentElement.outerHTML, manque};
    }, {D, LANGUE, LOCALE: LOCALES[LANGUE] || LANGUE, f, relever: relever.toString(), adresseSrc: adresse.toString(), autres: [['fr', SITE], [LANGUE, SITE + LANGUE + '/'], ['x-default', SITE]], publie: estPubliee()});
    res.manque.forEach(m => manque.add(m));
    /* Les scripts de la page : les chaînes traduites, les adresses écrites dans le code recalculées ; le JSON-LD, chaîne par chaîne */
    let html = res.html.replace(/<script([^>]*?) data-n="\d+"([^>]*)>([\s\S]*?)<\/script>/g, (tout, a1, a2, code) => {
      const attrs = a1 + a2;
      if (/ld\+json/.test(attrs)) {
        try { const o = JSON.parse(code); const walk = x => (typeof x === 'string' ? (D[propre(x)] ?? (texteVisible(x) ? (manque.add(propre(x)), x) : x)) : Array.isArray(x) ? x.map(walk) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, k.startsWith('@') ? v : walk(v)])) : x); return `<script${attrs}>\n${JSON.stringify(walk(o))}\n</script>`; } catch (e) { return tout; }
      }
      /* D'abord « ../ » → « ../../ » sur le code d'origine ; ensuite les adresses relatives au site (qui gagnent un seul « ../ ») */
      const t = cheminsCode(traduireCode(code, D, manque).replace(/(['"`])\.\.\//g, '$1../../'))
        .replace(/((?:src|href|poster)=\\?["'])(?![a-z]+:|#|\/\/|data:|\$\{|\.\.\/)([^"'\\$]+)/gi, (m, a, u) => a + adresse(u));
      return `<script${attrs}>${t}</script>`;
    });
    /* Les modules de chaque formateur (data-mods, titres français séparés par « | ») : les titres du catalogue traduit, sans quoi
       le nombre de cours de la carte ne se compte pas (15 novembre, le site anglais ouvert) */
    html = html.replace(/data-mods="([^"]*)"/g, (m, l) => `data-mods="${l.split('|').map(t => D['js:' + t] ?? D[propre(t)] ?? (manque.add(t), t)).join('|')}"`);
    /* Les url(…) des styles de la page (les polices, des images) */
    html = html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/g, (m, a, css) => `<style${a}>${css.replace(/url\((['"]?)(?![a-z]+:|data:|#)([^'")]+)\1\)/gi, (x, q, u) => `url(${q}${adresse(u)}${q})`)}</style>`)
      .replace(/style="([^"]*url\([^"]*)"/g, (m, st) => `style="${st.replace(/url\((['"]?|&quot;)(?![a-z]+:|data:|#)([^'")&]+)\1\)/gi, (x, q, u) => `url(${q}${adresse(u)}${q})`)}"`);
    /* Un morceau que la récolte ne prend pas (des chiffres sans mots, « 41&nbsp;k€ ») : sa clé « html:… », remplacée telle quelle
       dans la page traduite (15 novembre : la vidéo aux États-Unis, ses ventes par région en dollars) */
    for (const [k, v] of Object.entries(D)) if (k.startsWith('html:')) html = html.split(k.slice(5)).join(v);
    fs.writeFileSync(path.join(SORTIE, f), vignettes(html).replace(/http-equiv="x-refresh"/g, 'http-equiv="refresh"'));
    await ctx.close();
  }
  /* Le catalogue des modules */
  const mod = vignettes(traduireCode(lire('decouvrir/modules.js'), D, manque).replace(/(['"`])\.\.\//g, '$1../../'));
  fs.writeFileSync(path.join(SORTIE, 'modules.js'), mod);
  await browser.close(); srv.close();
  fs.writeFileSync(travail(LANGUE, 'site-manque.json'), JSON.stringify([...manque], null, 1));
  /* L'empreinte des pages françaises et du dictionnaire au moment de la construction : un test dit quand reconstruire */
  fs.writeFileSync(path.join(SORTIE, 'sources.json'), JSON.stringify(empreintes(), null, 1) + '\n');
  console.log(`${PAGES.length} pages et modules.js écrits dans decouvrir/${LANGUE}/ ; ${manque.size} textes sans traduction (restés en français) → travail/${LANGUE}/site-manque.json`);
}

export function empreintes() {
  const h = f => crypto.createHash('sha1').update(lire(f)).digest('hex').slice(0, 12);
  return Object.fromEntries(PAGES.map(f => 'decouvrir/' + f).concat(['decouvrir/modules.js', `tools/langue/site/${LANGUE}.json`]).map(f => [f, h(f)]));
}

/* ---------- Publier (le jour où la langue sort d'essai) ---------- */
const NOMS = {en: 'English', es: 'Español', pt: 'Português', de: 'Deutsch', it: 'Italiano'};
/* La langue est publiée quand la page d'accueil française y mène */
export const estPubliee = () => lire('decouvrir/index.html').includes(`lang="${LANGUE}" data-href="${LANGUE}/`);
function publier() {
  for (const f of PAGES) {
    let h = lire('decouvrir/' + f), avant = h;
    const nom = f === 'index.html' ? '' : f;
    /* Le choix de la langue (menu et menu mobile) : la langue mène à sa page, sans « Bientôt » */
    h = h.replace(new RegExp(`(<button type="button" class="lang-[oc]" lang="${LANGUE}") data-soon="[^"]*"(?: aria-label="[^"]*")?>(.*?)</button>`, 'g'),
      (m, deb, contenu) => `${deb} data-href="${LANGUE}/${nom}">${contenu.replace(/<small>[^<]*<\/small>$/, m.includes('lang-c') ? '$&' : '')}</button>`);
    if (!h.includes('if(o.dataset.href)')) h = h.replace("if(o.dataset.soon)dire(o.dataset.soon,o.getAttribute('lang'));", "if(o.dataset.href){location.href=o.dataset.href+location.hash;return;}if(o.dataset.soon)dire(o.dataset.soon,o.getAttribute('lang'));");
    /* La page dans l'autre langue, pour les moteurs de recherche */
    h = h.replace(/<link rel="alternate" hreflang=[^>]*>\n/g, '');
    h = h.replace('</head>', `<link rel="alternate" hreflang="fr" href="${SITE}${nom}">\n<link rel="alternate" hreflang="${LANGUE}" href="${SITE}${LANGUE}/${nom}">\n<link rel="alternate" hreflang="x-default" href="${SITE}${nom}">\n</head>`);
    if (h !== avant) { fs.writeFileSync(path.join(ROOT, 'decouvrir', f), h); console.log('publié dans le menu :', f); }
  }
  console.log(`${NOMS[LANGUE] || LANGUE} : reconstruire les pages (construire) pour qu'elles entrent dans les moteurs de recherche.`);
}

/* ---------- Vérifier ---------- */
async function verifier() {
  const srv = await serveur(), browser = await navigateur(), rapport = [];
  const FR = /\b(le|la|les|des|une|du|est|pas|pour|avec|sans|dans|sur|qui|que|tu|ton|ta|tes|vous|nous|leçons?|données|requêtes?)\b|[àâçéèêëîïôûùüœ]/i;
  for (const f of PAGES) {
    for (const largeur of [390, 1280]) {
      const ctx = await browser.newContext({viewport: {width: largeur, height: 900}, serviceWorkers: 'block'});
      const p = await ctx.newPage(), casses = [], erreurs = [];
      p.on('response', r => { if (r.status() >= 400 && r.url().startsWith(srv.base)) casses.push(r.url().slice(srv.base.length)); });
      p.on('pageerror', e => erreurs.push(String(e)));
      await ctx.route(u => !String(u).startsWith(srv.base), r => r.fulfill({status: 204, body: ''}));
      await p.goto(`${srv.base}/decouvrir/${LANGUE}/${f}`, {waitUntil: 'load'}).catch(() => {});
      await p.waitForTimeout(1200);
      const textes = await p.evaluate(FRs => {
        const FR = new RegExp(FRs, 'i'), out = new Set();
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n; (n = w.nextNode());) {
          const el = n.parentElement; if (!el || el.closest('script,style,[data-notrad],[lang="fr"]')) continue;
          const t = n.textContent.replace(/\s+/g, ' ').trim(); if (t.length > 1 && FR.test(t.replace(/Requête/g, ''))) out.add(t.slice(0, 140));
        }
        document.querySelectorAll('[alt],[aria-label],[title],[placeholder]').forEach(el => ['alt', 'aria-label', 'title', 'placeholder'].forEach(a => { const v = el.getAttribute(a); if (v && FR.test(v.replace(/Requête/g, ''))) out.add(`[${a}] ${v.slice(0, 120)}`); }));
        return [...out];
      }, FR.source);
      rapport.push({page: f, largeur, francais: textes, casses: [...new Set(casses)], erreurs});
      await ctx.close();
    }
  }
  await browser.close(); srv.close();
  fs.writeFileSync(travail(LANGUE, 'site-verification.json'), JSON.stringify(rapport, null, 1));
  for (const r of rapport) console.log(`${r.page} (${r.largeur} px) : ${r.francais.length} textes en français, ${r.casses.length} adresses cassées, ${r.erreurs.length} erreurs`);
}

if (process.argv[1] && process.argv[1].endsWith('site.mjs')) {
  if (ACTION === 'recolter') await recolter();
  else if (ACTION === 'construire') await construire();
  else if (ACTION === 'publier') publier();
  else await verifier();
}
