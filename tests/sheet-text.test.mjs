/* Le texte des feuilles « À toi » sur iPhone et sur ordinateur (Elisa, 26 octobre, 9 h 59, capture du moment 3 du chapitre 14 :
   « Vérifie le formatage du texte sur iPhone et ordi -> c’est pas top »).
   Les textes arrivent avec la typographie des légendes (chaque petit mot collé au suivant, et les collages propres aux légendes :
   « qu’une », « seule »… avec le mot suivant), faite pour des lignes coupées à la main. Dans la feuille, la largeur change d’un écran à
   l’autre : les lignes se coupaient au hasard de ces blocs (« … de Léa Simon : celle / de Nathan Petit attend son tour. »,
   « Comment faire / pour qu’une seule inscription soit confirmée ? »). Le lecteur reprend la typographie du texte courant, puis fait
   commencer chaque phrase, et chaque membre de phrase après « : » ou « ; », sur sa ligne quand cela n’ajoute pas de ligne. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cut = (from, to) => {
  const a = html.indexOf(from), b = html.indexOf(to, a + 1);
  assert.ok(a >= 0 && b > a, `extrait introuvable : ${from}`);
  return html.slice(a, b);
};
const NB = ' ';
const ctx = vm.createContext({getComputedStyle: e => e.cs});
vm.runInContext(cut('function lvNw(h){', 'function lvPkShow(i,p){') + ';this.typo = lvFlowTypo; this.cuts = lvCuts; this.text = lvText;', ctx);
/* Ce que le moteur des vidéos (core.js, fr) envoie : la typographie des légendes. */
const LEGENDE = `La${NB}ligne reste verrouillée jusqu’à la${NB}fin de${NB}la${NB}transaction de${NB}Léa${NB}Simon${NB}: celle de${NB}Nathan${NB}Petit attend son${NB}tour.`;

test('la typographie du texte courant : sans les collages des légendes, avec les insécables du français', () => {
  /* La phrase de la capture : les petits mots restent avec ce qui les suit, la ponctuation et les noms aussi. */
  assert.equal(ctx.typo(LEGENDE), LEGENDE, 'ici, rien à défaire');
  /* « qu’une », « seule » ne sont plus collés au mot suivant : « pour qu’une seule inscription » n’est plus un bloc */
  assert.equal(ctx.typo(`Comment faire pour${NB}qu’une${NB}seule${NB}inscription soit confirmée${NB}?`), `Comment faire pour${NB}qu’une seule inscription soit confirmée${NB}?`);
  /* Un prénom et un nom ne se séparent pas, même hors de la liste des légendes */
  assert.equal(ctx.typo('Julie Roy (1) retrouve le Dr Claire Morel.'), `Julie${NB}Roy (1) retrouve le${NB}Dr${NB}Claire${NB}Morel.`);
  /* Nombres, guillemets, « ? », et rien dans le code */
  assert.equal(ctx.typo('Il reste 0 place : « Plus qu’une place ! » <code>a = 1 ; b</code>'), `Il${NB}reste${NB}0${NB}place${NB}: «${NB}Plus${NB}qu’une${NB}place${NB}!${NB}» <code>a = 1 ; b</code>`);
  /* Un petit mot en fin de morceau, juste avant une balise, reste avec elle (« dans la <b>table produits</b> ») */
  assert.equal(ctx.typo('dans la <b>table produits</b>'), `dans${NB}la${NB}<b>table produits</b>`);
});

test('les retours possibles : après une phrase, après « : » ou « ; », jamais pour laisser moins de 14 caractères', () => {
  assert.equal(ctx.cuts(LEGENDE), LEGENDE.replace(`Simon${NB}: celle`, `Simon${NB}:<br>celle`));
  const t = ctx.typo('s.manager_id = s.id demande d’être son propre manager. Personne ne l’est : aucune ligne.');
  assert.ok(ctx.cuts(t).includes('manager.<br>Personne') && !ctx.cuts(t).includes(':<br>aucune'), 'pas de « aucune ligne. » seul');
  const join = ctx.typo('<code>LEFT JOIN</code> garde toute la table placée après <code>FROM</code> : les bassins, même les Abysses. <code>RIGHT</code> aurait gardé les animaux.');
  assert.ok(ctx.cuts(join, ['sent']).includes('Abysses.<br><code>RIGHT</code>') && !ctx.cuts(join, ['sent']).includes(':<br>'), 'les phrases seules');
  assert.ok(ctx.cuts(join, ['colon']).includes(`</code>${NB}:<br>les`) && !ctx.cuts(join, ['colon']).includes('Abysses.<br>'), 'les « : » seuls');
  assert.equal(ctx.cuts(ctx.typo('<code>SELECT a ; SELECT b</code> : deux.')), ctx.typo('<code>SELECT a ; SELECT b</code> : deux.'), 'rien dans le code, rien de trop court');
  assert.equal(ctx.cuts(ctx.typo('<code>SELECT a ; SELECT b</code> : deux requêtes.')), ctx.typo('<code>SELECT a ; SELECT b</code> :<br>deux requêtes.'), 'après le code, oui');
});

test('les retours ne sont posés que s’ils n’ajoutent pas de ligne : iPhone et ordinateur', () => {
  /* Une boîte simulée : son nombre de lignes dépend du texte posé (comme le navigateur à une largeur donnée). */
  const box = lines => {
    const el = {cs: {lineHeight: '20px', fontSize: '14.5px', paddingTop: '10px', paddingBottom: '10px'}, _h: ''};
    Object.defineProperty(el, 'innerHTML', {get: () => el._h, set: v => { el._h = v; }});
    Object.defineProperty(el, 'clientHeight', {get: () => 20 + 20 * lines(el._h)});
    return el;
  };
  const sans = h => h.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '');
  /* iPhone : la phrase prend trois lignes, coupée ou non : « … de Léa Simon : / celle de Nathan Petit attend son tour. » */
  const iph = box(h => 3);
  ctx.text(iph, LEGENDE);
  assert.ok(iph.innerHTML.includes(`Simon${NB}:<br>celle`), 'iPhone : retour après « : »');
  /* Ordinateur : deux lignes pleines sans retour, trois avec : le texte reste tel quel */
  const desk = box(h => h.includes('<br>') ? 3 : 2);
  ctx.text(desk, LEGENDE);
  assert.ok(!desk.innerHTML.includes('<br>'), 'ordinateur : pas de ligne en plus');
  /* Une ligne : rien à couper */
  const one = box(h => 1);
  ctx.text(one, LEGENDE);
  assert.ok(!one.innerHTML.includes('<br>'));
  /* Deux retours possibles : on garde les phrases si les « : » ajouteraient une ligne */
  const two = box(h => 2 + (h.match(/<br>/g) || []).length - (h.includes('Abysses.<br>') ? 1 : 0));
  ctx.text(two, '<code>LEFT JOIN</code> garde toute la table placée après <code>FROM</code> : les bassins, même les Abysses. <code>RIGHT</code> aurait gardé les animaux.');
  assert.ok(two.innerHTML.includes('Abysses.<br>') && !two.innerHTML.includes(':<br>'));
  assert.equal(sans(two.innerHTML).replace(/ /g, ' '), 'LEFT JOIN garde toute la table placée après FROM : les bassins, même les Abysses. RIGHT aurait gardé les animaux.', 'le texte lui-même ne change pas');
});

test('le lecteur passe par là pour chaque texte de la feuille', () => {
  const show = cut('function lvPkShow(i,p){', '/* Moment fini : le verdict');
  assert.ok(show.includes('<span class="lv-pk-tx">${p.prompt}</span></p>'), 'la consigne dans son propre morceau, après le « ? »');
  assert.ok(show.includes("lvText(box.querySelector('.lv-pk-tx'),rawPrompt,box.querySelector('.lv-pk-t'));") && show.includes("if(rawHint)lvText(box.querySelector('.lv-pk-hint'),rawHint);"), 'consigne et aide, une fois la feuille dans la page');
  assert.ok(show.includes('${lvNw(lvFlowTypo(esc(o.label)))}</button>`'), 'les réponses aussi (« La transaction / de Léa Simon est annulée »)');
  assert.ok(cut('function lvPkKept(P,a){', 'function lvPkTry(').includes("w.className='lv-pk-why ok'; w.hidden=false; box.querySelector('.lv-pk-t').hidden=true; opts.hidden=true; lvText(w,why);"), 'moment déjà réussi');
  assert.ok(cut('function lvPkVerdict(P,k,btn,ok,r){', 'if(ok){').includes("wEl.className='lv-pk-why '+(ok?'ok':'ko'); wEl.hidden=false;\n    P.box.querySelector('.lv-pk-t').hidden=true;\n    lvText(wEl,why);"), 'explication d’un choix');
  assert.ok(html.includes("if(why&&wEl){ wEl.className='lv-pk-why ko'; wEl.hidden=false; tEl.hidden=true; lvText(wEl,why); }"), 'geste raté');
  assert.ok(cut('function lvPkWin(P,why,rect){', 'LV.video.sfx(').includes("wEl.className='lv-pk-why ok'; wEl.hidden=false;\n    P.box.querySelector('.lv-pk-t').hidden=true;\n    lvText(wEl,why);"), 'gestes réussis');
  assert.ok(html.includes("lvText(el.querySelector('.lv-pk-tip-t'),h.text,el);"), 'indice');
  assert.ok(html.includes("if(o)h.innerHTML=lvNw(lvFlowTypo(tpl.replace('{x}',x))); else lvText(h,P.p.hint);"), 'ligne d’aide du rangement');
  assert.ok(!/\.innerHTML=lvNw\(why\)/.test(html), 'plus d’explication posée telle quelle');
});
