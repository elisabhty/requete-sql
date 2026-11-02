#!/usr/bin/env node
/* Elisa, 3 novembre, 0 h 00 : « mets juste le V », « quand on rafraîchit ça quitte la salle et les défis », « au retour avec Défis il y
   a un décalage » ; 0 h 04 : le crayon en haut à droite dans la DA du site. */
import fs from 'fs';
import path from 'path';
const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const dp = fs.readFileSync(path.join(ROOT, 'design-premium.js'), 'utf8');
let passed = 0, failed = 0;
const assert = (c, l) => { if (c) { passed++; console.log(`  ✓ ${l}`); } else { failed++; console.log(`  ✗ ${l}`); } };
const fn = n => { const i = html.indexOf(`\nfunction ${n}(`); return html.slice(i, html.indexOf('\nfunction ', i + 1)); };
console.log('\n=== Salle : reprise, copie, retour ===');
assert(fn('jeuCopyCode').includes("btn.innerHTML=JEU_COPIED_SVG;btn.setAttribute('aria-label','Code copié');"), 'copié : la coche seule');
assert(fn('saveNav').includes("{view:'jeu',code:JEU.code,host:jeuIsHost()?1:0,niv:JEU.niv,nb:JEU.nb,fromTab:'defis'}") && fn('saveNav').includes("JEU.solo?{view:'tab',tab:'defis'}"), 'la salle est gardée au rechargement ; seul, retour sur Défis');
assert(fn('restoreNav').includes("nav.view==='jeu'") && fn('restoreNav').includes('setTimeout(()=>jeuReprendre(nav),0);'), 'au rechargement, on revient dans la salle');
assert(fn('jeuReprendre').includes("reprise:{host:!!nav.host}") && fn('jeuStart').includes('if(rep){jeuStart(code,true,null,{nomId:opts.nomId});return;}'), 'personne ne répond et on était l’hôte : la salle rouvre, même code');
assert(fn('jeuStart').includes('try{saveNav();}catch(e){}'), 'la position est gardée dès l’entrée');
assert(fn('leaveLessonScreen').includes("window.pNavBack()"), 'quitter la salle est un retour');
assert(dp.includes("if(screen.classList.contains('push-back'))return;") && dp.includes("from.id==='scr-lesson'"), 'Défis arrive par la gauche, sans second glissement');
assert(html.includes('design-premium.js?v=1403'), 'script de transitions versionné');
assert(css.includes('html.lq body.in-lesson .fab .fab-pen{box-sizing:content-box;width:16px!important;height:16px!important;padding:7px;border-radius:50%;'), 'crayon : rond violet dans une pastille blanche, comme le retour');
console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
