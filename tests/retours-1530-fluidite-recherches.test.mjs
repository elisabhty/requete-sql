/* Elisa, 12 novembre, 15 h 30 : « Tu peux améliorer la fluidité, l’appui sur les boutons, vérifier toutes les recherches, les champs où
   il faut taper… La console SQL, améliorer l’UX de l’application. Tout ce que tu peux améliorer, tu améliores. »
   L’audit (tous les écrans, processeur ralenti ×4) a trouvé, puis corrigé :
   - fluidité : chaque changement d’écran mettait deux fois l’écran en page (l’ancien contenu, puis le nouveau) ; Mon compte et la
     planche redessinaient tous leurs stickers à chaque ouverture ;
   - recherches : la première lettre d’une recherche de cours affichait « Aucun cours ne correspond » ; « l’index » trouvait moins
     que « index » dans les questions d’entretien ; pas de croix pour vider la recherche d’un pays, deux dans la Console ;
   - Console : l’erreur d’une requête effacée restait sous l’éditeur vide ; le bouton restait rouge pendant la correction ;
   - appui : quelques boutons sans retour sous le doigt, d’autres plus petits que le doigt. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = lire('index.html'), lud = lire('ludique.css');
const cut = (a, b) => { const i = html.indexOf(a); assert.ok(i > 0, `repère : ${a}`); const j = html.indexOf(b, i); assert.ok(j > i, `repère : ${b}`); return html.slice(i, j); };

test('changer d’écran : une seule mise en page (la position se règle après le rendu, la barre SQL fermée ne mesure rien)', () => {
  const sw = cut('function switchTab(name){', '/* ---------- Retour par glissement depuis le bord gauche');
  const fin = sw.slice(sw.lastIndexOf("scr.classList.add('active');"));
  assert.ok(fin.indexOf('refreshTabScreen(name);') > 0 && fin.indexOf('refreshTabScreen(name);') < fin.indexOf('scr.scrollTop=tabScrollPositions[name]||0;'), 'le rendu, puis la position');
  assert.ok(sw.includes("refreshTabScreen(name);\n    if(!restoringNav) scr.scrollTop=tabScrollPositions[name]||0;"), 'mouvements réduits : pareil');
  assert.equal(sw.split('scr.scrollTop=').length - 1, 2, 'plus de réglage avant le rendu');
  const k = cut('function syncKbarOffset(){', 'function noteSqlEnVue(){');
  assert.ok(k.includes('const kb=on?keyboardInset():0;'), 'barre fermée : pas de lecture de la hauteur du clavier');
  assert.ok(k.includes('const kbLift=on&&kb>40;') && k.includes("kbar.style.bottom=kbLift?kb+'px':'';"), 'le reste ne change pas : fermée, le clavier ne servait à rien');
});

test('l’accueil redessiné sous un autre écran n’est pas mesuré', () => {
  const f = cut('function lqSesAjuste(host){', "if(typeof window!=='undefined'&&typeof addEventListener==='function'){let lqSesT=0;");
  const garde = "if(ecran&&ecran.classList&&!ecran.classList.contains('active'))return;";
  assert.ok(f.includes(garde) && f.indexOf(garde) < f.indexOf('hi.clientWidth'), 'avant toute mesure');
  /* Joué : écran caché, aucune largeur n’est lue. */
  let lues = 0;
  const ecran = {classList: {contains: () => false}};
  const t = {getBoundingClientRect() {}, querySelector: () => null, style: {removeProperty() {}}, get scrollWidth() { lues++; return 100; }};
  const hi = {querySelector: s => s === '.lq-hi-title' ? t : null, closest: s => s === '.screen' ? ecran : null, classList: {remove() {}, add() {}}, get clientWidth() { lues++; return 300; }};
  const ctx = vm.createContext({});
  vm.runInContext(f, ctx);
  ctx.host = {querySelector: () => hi};
  vm.runInContext('lqSesAjuste(host)', ctx);
  assert.equal(lues, 0);
  ecran.classList.contains = () => true;
  vm.runInContext('lqSesAjuste(host)', ctx);
  assert.ok(lues > 0, 'écran affiché : mesuré comme avant');
});

test('stickers : mesures groupées, un dessin déjà fait est recopié, un canvas déjà à jour n’est pas touché', () => {
  const p = cut('const stkFaits=new Map();', '/* ---------- Écran Stickers ---------- */');
  assert.ok(p.indexOf('lot.push({cv,w,mode,ombre:') < p.indexOf('lot.forEach('), 'toutes les mesures avant le premier dessin');
  assert.ok(p.includes("const cle=[id,mode,n,px,ombre?1:0,etat,stkFontOk?1:0].join('|')"), 'même sticker, même taille, même état, même police');
  assert.ok(p.includes("if(etat!=='a'&&cv._stkCle===cle&&cv.width===n&&cv.height===n){stkFaits.set(cle,cv);return;}"), 'stkPaint qui repasse sur la page ne redessine rien');
  assert.ok(p.includes('try{ctx.drawImage(fait,0,0);cv._stkCle=cle;stkFaits.set(cle,cv);return;}catch(e){}'), 'la copie remplace l’ancien canvas dans la réserve : rien en double');
  assert.ok(p.includes('if(stkFaits.size>90)stkFaits.delete(stkFaits.keys().next().value);'), 'réserve bornée');
  assert.ok(html.includes("if(typeof stkFaits!=='undefined')for(const k of [...stkFaits.keys()])if(k.startsWith(id+'|'))stkFaits.delete(k);"), 'une image 3D qui arrive : ses dessins sont refaits');
  /* Joué avec de faux canvas. */
  const mk = () => { const log = []; return {log, cv: {width: 108, height: 108, offsetWidth: 36, dataset: {stk: 'x'}, parentElement: {}, closest: () => null,
    getContext: () => ({clearRect() { log.push('efface'); }, drawImage(src) { log.push(src && src.dataset ? 'copie' : 'image'); }, save() {}, restore() {}, translate() {}})}}; };
  let pleins = 0;
  const ctx = vm.createContext({window: {devicePixelRatio: 3}, getComputedStyle: () => ({width: '29.33px'}), STK_PAD: 3.3334, STK_3D: new Set(), stkImgs: {}, stkFontOk: true,
    stkShadow() {}, stkDraw() { pleins++; }, stkMask: () => '', stkGlitter: () => '', stkFontWatch() {}, STK_HOLO: {}, Map, Math});
  vm.runInContext(p, ctx);
  const a = mk(), b = mk();
  const paint = cvs => ctx.stkPaint({querySelectorAll: s => s === 'canvas[data-stk]' ? cvs : []});
  paint([a.cv]);
  assert.equal(pleins, 1, 'premier dessin : complet');
  paint([a.cv]);
  assert.equal(pleins, 1); assert.deepEqual(a.log, ['efface'], 'repassage : rien');
  paint([b.cv]);
  assert.equal(pleins, 1, 'écran redessiné (canvas neuf) : pas de dessin complet');
  assert.deepEqual(b.log, ['efface', 'copie']);
});

test('recherche de cours : une lettre seule n’affiche plus « Aucun cours ne correspond »', () => {
  const f = cut('function filterCourseCatalog(value){', 'const emptyTitle=');
  assert.ok(f.includes('const searching=tokens.length>0&&!(tokens.length===1&&/^[a-z]$/.test(tokens[0])&&!hits.length);'));
  assert.ok(f.includes("suggest.hidden=searching||(!!value&&tokens.length!==1)||courseFilter!=='all';"), 'les suggestions restent sous la première lettre');
  const cherche = (tokens, hits) => tokens.length > 0 && !(tokens.length === 1 && /^[a-z]$/.test(tokens[0]) && !hits);
  assert.equal(cherche(['j'], 0), false, '« j » : pas encore une recherche');
  assert.equal(cherche(['jo'], 15), true);
  assert.equal(cherche(['%'], 1), true, 'un signe cherche tout de suite');
  assert.equal(cherche(['1'], 2), true, 'un chiffre aussi');
  assert.equal(cherche(['xy'], 0), true, 'deux lettres sans résultat : « Aucun cours ne correspond »');
});

test('questions d’entretien : l’article élidé ne compte pas (« l’index » comme « index »)', () => {
  const ctx = vm.createContext({});
  vm.runInContext('let entSearch="";' + cut('function entFold(s){', 'const ENT_HAY=new WeakMap();'), ctx);
  const termes = q => { ctx.q = q; return [...vm.runInContext('entSearch=q;entSearchTerms()', ctx)]; };
  assert.deepEqual(termes('l’index'), ['index']);
  assert.deepEqual(termes("d'une Jointure"), ['une', 'jointure']);
  assert.deepEqual(termes('qu’est-ce'), ['est-ce']);
  assert.deepEqual(termes('clé étrangère'), ['cle', 'etrangere'], 'sans accents, comme avant');
  assert.deepEqual(termes("l'"), ["l'"], 'trop court pour être un article : laissé tel quel');
  assert.deepEqual(termes('sql'), ['sql']);
});

test('recherche d’un pays : une croix pour repartir de zéro ; une seule croix par champ de recherche', () => {
  const p = cut('function paysFeuille(actuel,choisir){', 'function paysFiltrer(f,texte){');
  assert.ok(p.includes('<button type="button" class="pays-vider lq-clear" aria-label="Effacer la recherche" hidden>'));
  assert.ok(p.includes("input.addEventListener('input',()=>{ if(vider)vider.hidden=!input.value; paysFiltrer(f,input.value); });"));
  assert.ok(p.includes("input.value=''; vider.hidden=true; paysFiltrer(f,''); try{input.focus({preventScroll:true});}catch(x){}"), 'elle vide, remet la liste et rend le clavier au champ');
  assert.ok(lud.includes('html.lq input[type="search"]::-webkit-search-cancel-button,html.lq input[type="search"]::-webkit-search-decoration{-webkit-appearance:none;appearance:none;display:none}'), 'celle du navigateur ne s’ajoute plus à côté');
  for (const id of ['console-query-search', 'ent-search', 'course-search']) assert.ok(new RegExp(`<input id="${id}" type="search"`).test(html), id);
});

test('Console : le bouton rouge redevient « Exécuter » dès qu’on corrige ; l’erreur d’une requête effacée s’en va', () => {
  const h = cut("if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('input',e=>{", 'function setLessonOut(html){');
  assert.ok(h.includes("if(t.id==='ed-console'){"));
  assert.ok(h.includes("btn.classList.contains('is-ko')&&!btn.classList.contains('running')") && h.includes('setRunLoading(btn,false);'));
  assert.ok(h.includes("if(!t.value.trim()&&out&&out.querySelector('.feedback.err,.console-lock')&&!out.querySelector('.query-loading')){"), 'seulement une erreur : un résultat réussi reste');
  assert.ok(h.includes("out.innerHTML='';out.style.minHeight='';") && h.includes("if(p&&p.querySelector('.is-ko'))p.remove();"), 'l’encadré et « ✕ Erreur »');
});

test('champs : le nom d’un projet se valide au clavier, les deux champs d’une note ont un nom', () => {
  assert.ok(html.includes('<input id="console-project-name" name="projectName" maxlength="40" autocomplete="off" enterkeyhint="done" placeholder="Analyse des ventes">'));
  assert.ok(html.includes('<textarea class="ne-ta" id="ne-ta" aria-label="Ta note" placeholder="Écris ce que tu veux retenir…"></textarea>'));
  assert.ok(html.includes('<textarea id="ne-sql" aria-label="Requête SQL de la note (facultative)" spellcheck="false" autocapitalize="off" autocorrect="off" placeholder="-- optionnel">'));
  /* Aucun champ de saisie sous 16 px : iOS agrandit la page à l’appui sinon (mesuré dans le navigateur sur tous les écrans). */
  assert.ok(!/maximum-scale|user-scalable/.test(html.match(/<meta name="viewport"[^>]*>/)[0]), 'le zoom reste permis');
});

test('appui : les boutons qui ne répondaient pas s’enfoncent, les petits ont une zone tactile plus grande', () => {
  const b = lud.slice(lud.indexOf('/* 12 novembre, 15 h 30 (Elisa : « améliorer la fluidité, l’appui sur les boutons'));
  assert.ok(b.length > 100 && lud.indexOf('/* 12 novembre, 15 h 30 (Elisa : « améliorer la fluidité') < lud.indexOf('Défis — la refonte du 7 novembre'), 'avant la section Défis');
  for (const r of ['html.lq #scr-planning :is(.planning-progress,.plan-modules)>summary:active,html.lq .plus-details>summary:active,html.lq #schema-sheet .umd-liens>summary:active{transform:scale(.985);opacity:.78}',
    'html.lq .acct-badges-more>button:active{transform:scale(.95);opacity:.75}', 'html.lq #schema-sheet :is(.umd-hb,.umd-c.is-plus):active{opacity:.55}',
    'html.lq .note-back-list:active{transform:scale(.95);opacity:.65}', 'html.lq .lst-close:active{transform:scale(.88);background-color:rgba(255,255,255,.3)}',
    'html.lq #schema-sheet .umd-pli::after{content:"";position:absolute;inset:-9px}', 'html.lq .note-back-list::after{content:"";position:absolute;inset:-8px -10px -2px}',
    'html.lq .table-scroll .table-next::after{content:"";position:absolute;inset:-6px}', 'html.lq .lst-close::after{content:"";position:absolute;inset:-5px}'])
    assert.ok(b.includes(r), r);
  assert.ok(b.includes('@media (prefers-reduced-motion:reduce){html.lq :is(#scr-planning'), 'mouvements réduits : pas de déplacement');
});
