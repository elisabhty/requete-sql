// La feuille de connexion, reprise (Elisa, 12 novembre, 18 h 12, ses captures de l’iPhone : « C’est pas UI UX, tout blanc ça fait
// bizarre et les deux boutons tournent en même temps, puis l’UI UX de connexion aussi bizarre. Et deux bouts arrivent décollés.
// J’aime pas le “Garde-le” : remplace par la réf. 4. “Connecte-toi en un geste, et c’est parti” »).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = lire('index.html'), obv = lire('onboarding-vitrine.css'), sh = lire('scripts/ios-ecran-lancement.sh');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const page = cut("}else if(slide==='account'){", "}else if(slide==='paywall'){");
const feuille = page.slice(page.indexOf('if(!masquee){'), page.indexOf('}else\n    html='));

test('les textes : la réf. 4 dans la feuille, « Connecte-toi en un geste, et c’est parti. » au-dessus', () => {
  assert.ok(feuille.includes('<h1 class="ob-title" id="ob-title">Ton parcours, <em>partout avec toi</em>.</h1>'));
  assert.ok(feuille.includes('<p class="ob-compte-sub">Connecte-toi pour retrouver tes cours, tes défis et tes réussites sur tous tes appareils.</p>'));
  assert.ok(feuille.includes('<b>${haut}</b><small>Connecte-toi en un geste, et c’est parti.</small>'));
  assert.ok(!/Garde-le|Garde ta|Sauvegarde ton/.test(feuille), 'plus de « Garde-le » ni de second titre selon l’arrivée');
  /* Le haut ne dit « Ton parcours est prêt » qu’à qui vient de le construire */
  assert.ok(page.includes("const haut=finale?`Ton parcours est prêt${prenom?', '+esc(prenom):''}.`:typeof obEntry!=='undefined'&&obEntry==='account'&&state.onboarded?'Ton compte Requête':'Bon retour&nbsp;!';"));
});

test('un seul bloc : la phrase des conditions est dans la feuille, le pied est caché', () => {
  assert.ok(feuille.includes("${authReady?`<p class=\"ob-acc-legal\">${legalHtml}</p>`:''}\n      </div></div>`;"), 'tout en bas de la feuille');
  assert.ok(page.includes("if(!masquee&&authReady)obSetFooter('',null,'','','');\n    else obSetFooter(authReady?'':'Continuer',authReady?null:obPasserConnexion,'','',{html:legal});"));
  assert.ok(app.includes("root.classList.toggle('ob-feuille-seule',slide==='account'&&!obLegalMode&&authReady&&!(typeof obConnexionMasquee==='function'&&obConnexionMasquee()));"));
  assert.ok(obv.includes('html #onboarding.ob-vitrine.ob-feuille-seule .ob-foot{display:none!important}'));
  assert.ok(obv.includes('html #onboarding.ob-vitrine .ob-acc-legal{margin:14px auto 0;max-width:330px;color:var(--v-ink-3);'));
  /* Les repères n’arrivent plus un par un : tout monte avec la feuille */
  assert.ok(obv.includes('html #onboarding.ob-vitrine .ob-account.is-feuille .ob-compte-atouts li{flex-direction:column;align-items:center;gap:6px;padding:0 5px;text-align:center;animation:none!important}'));
});

test('plus tout blanc : une feuille lavande, les repères dans une carte, les boutons sur leur épaisseur', () => {
  for (const r of ['html #onboarding.ob-vitrine .ob-acc-feuille{padding:10px 22px calc(var(--safe-bottom,0px) + max(12px,22px - max(0px,var(--safe-bottom,0px) - 34px)));background:#F4F2FC}',
    'html #onboarding.ob-vitrine .ob-account.is-feuille .ob-compte-atouts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;width:100%;max-width:none;margin:14px 0 0!important;padding:11px 2px 10px;\n  border:2px solid var(--v-line);border-radius:18px;background:#fff;box-shadow:0 3px 0 var(--v-lip)}',
    'html #onboarding.ob-vitrine .ob-account.is-feuille .ob-provider.is-apple{box-shadow:0 4px 0 #2B2647!important}'])
    assert.ok(obv.includes(r), r);
});

test('la connexion : seul le bouton touché tourne ; plus de carte « Connexion en cours… »', () => {
  const start = cut('async function obStartAuth(provider,btn){', '\n}\n');
  assert.ok(start.includes("obAuthBusy=true;obAuthQui=provider;obAuthFait=false;obAuthMessage='';paintOb();"));
  assert.ok(!app.includes('Connexion en cours…\';paintOb()'), 'le bouton le dit lui-même');
  assert.ok(start.includes('obAuthBusy=true;obAuthFait=true;obAuthMessage=obTypo('), 'le compte a répondu : « Connecté », la progression arrive');
  assert.ok(app.includes("let obAuthQui='',obAuthFait=false;"));
  assert.ok(page.includes("const moi=obAuthBusy&&qui===provider,fin=moi&&fait;"));
  assert.ok(page.includes("<span>${moi?(fin?'Connecté':'Connexion…'):`Continuer avec ${label}`}</span>"));
  assert.ok(page.includes("${moi?' is-moi':obAuthBusy?' is-attente':''}") && page.includes("${obAuthBusy?`disabled${moi?' aria-busy=\"true\"':''}`:''}"));
  for (const r of ['html #onboarding.ob-vitrine .ob-account.is-feuille .ob-provider.is-attente{opacity:.42!important}',
    'html #onboarding.ob-vitrine .ob-account.is-feuille .ob-provider.is-apple .ob-provider-spinner{border-color:rgba(255,255,255,.3);border-top-color:#fff}',
    'html #onboarding.ob-vitrine .ob-account.is-feuille .ob-auth-message{margin:12px 0 0!important;padding:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;',
    'html #onboarding.ob-vitrine .ob-account.is-feuille .ob-auth-message.is-err{padding:10px 14px!important;border-radius:14px!important;background:#FFE9EA!important;color:#9B1C26!important}'])
    assert.ok(obv.includes(r), r);
});

test('la feuille de style n’a plus d’accolade en trop (elle faisait sauter la règle suivante)', () => {
  assert.ok(obv.includes('@keyframes obvProjPop{from{opacity:0;scale:.3}to{opacity:1;scale:1}}\n') && !obv.includes('@keyframes obvProjPop{from{opacity:0;scale:.3}to{opacity:1;scale:1}}\n}'));
  /* Toute la feuille : chaque accolade fermée a été ouverte (commentaires et chaînes mis à part). Une accolade en trop ne casse
     pas la page : le navigateur jette seulement la règle qui la suit, sans rien dire (le message d’erreur de la connexion en avait
     perdu son style ; une autre, plus ancienne, faisait sauter une règle de la page d’accueil). */
  let d = 0, ligne = 1;
  for (let p = 0; p < obv.length; p++) {
    const c = obv[p];
    if (c === '\n') ligne++;
    if (c === '/' && obv[p + 1] === '*') { const e = obv.indexOf('*/', p + 2); ligne += obv.slice(p, e).split('\n').length - 1; p = e + 1; continue; }
    if (c === '"' || c === "'") { let e = p + 1; while (obv[e] !== c) { if (obv[e] === '\\') e++; e++; } p = e; continue; }
    if (c === '{') d++;
    else if (c === '}') { d--; assert.ok(d >= 0, `accolade en trop, ligne ${ligne}`); }
  }
  assert.equal(d, 0, 'aucun bloc resté ouvert');
});

test('la fenêtre de Google dit « Requête », plus « App »', () => {
  assert.ok(sh.includes('/usr/libexec/PlistBuddy -c "Set :CFBundleName Requête" "$plist" 2>/dev/null'));
  assert.ok(sh.includes('|| /usr/libexec/PlistBuddy -c "Add :CFBundleName string Requête" "$plist"'));
});
