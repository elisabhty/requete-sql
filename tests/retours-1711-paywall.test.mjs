// Elisa, 10 novembre, 17 h 11 : « mettre la page de connexion et le paywall au bon moment » ; ses choix : « À la fin », « 4,99 par
// semaine + 59 par an, regarder ailleurs si c’est cohérent » puis, à 17 h 50, « Ok 5,99 par semaine et 44,99 par an, une page étudiée psychologiquement et de la même DA que le site internet »,
// et, tant que le paiement n’est pas branché, « Visible, on passe ».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../onboarding-vitrine.css', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const code = cut('const OB_OFFRES=', '\nfunction obFinSuivante(');
const fin = cut('function obCompteVisible(){', '/* ---------- Le paywall');

const monter = ({ achat = null, offre, name = 'Elisa' } = {}) => {
  const vers = [], pied = [];
  const ctx = vm.createContext({ window: achat ? { REQUETE_ACHAT: achat } : {}, draft: { name, offre, finVoulue: 'plan-ready' }, state: {}, TOTAL: 71, CHALLENGES: { length: 477 },
    OB_COMMUNAUTE: 1000, OB_STK_AVIS: '<svg></svg>', esc: s => String(s), escAttr: s => String(s), legalUrl: k => k, mascotReduced: () => false,
    obPlanInfo: () => ({ goal: 'Progresser en SQL', endLabel: '3 décembre', minutes: 20 }), obBackButton: () => '<button class="ob-back"></button>',
    obSetFooter: (...a) => pied.push(a), buzz() {}, finishOnboard: a => vers.push(a), obGoto: t => vers.push('→' + t), obConnexionMasquee: () => false,
    document: { querySelectorAll: () => [], getElementById: () => null } });
  vm.runInContext(fin + code, ctx);
  return { ctx, vers, pied };
};

test('l’ordre : les questions, « Ton parcours est prêt », la connexion, le paywall, puis l’app', () => {
  assert.ok(app.includes("const OB_SLIDES = ['bonjour','welcome','questions','name','pays','age','job','goal','level','rhythm','jours','build','methode','temoignages','pact','practice','source','rappel','widget','widgetTuto','pseudo','ready','account','paywall'];"));
  const { ctx, vers } = monter();
  ctx.obApresPret('home'); assert.deepEqual(vers, ['→account'], 'la connexion d’abord');
  ctx.obApresCompte(); assert.deepEqual(vers, ['→account', '→paywall'], 'puis le paywall');
  ctx.obPaywallEntrer(); assert.deepEqual(vers.at(-1), 'home', 'puis ce que le bouton de la dernière page promettait');
  const masquee = monter(); masquee.ctx.obConnexionMasquee = () => true; masquee.ctx.obApresPret('salle');
  assert.deepEqual(masquee.vers, ['→paywall'], 'dans l’app sans connexion branchée : droit au paywall');
  const abonne = monter({ achat: { acheter: async () => true, actif: () => true } }); abonne.ctx.obApresCompte();
  assert.deepEqual(abonne.vers, ['plan-ready'], 'déjà abonné : pas de paywall');
});

// 11 novembre, 1 h 42 : la refonte d’après sa maquette ; 1 h 43 : « Dire que c’est via le site internet (avis etc) ».
const nb = x => x.replace(/&nbsp;/g, ' ').replace(/[  ]/g, ' ');
const dateEssai = j => { const d = new Date(); d.setDate(d.getDate() + j); return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }).replace(/^1 /, '1er '); };

test('les prix : 44,99 € / an en gros, 0,86 € par semaine, −86 %, 5,99 € / semaine ; l’annuelle « Meilleur choix », choisie d’avance', () => {
  const { ctx } = monter();
  const h = nb(ctx.obPaywallHTML());
  assert.ok(h.includes('<span class="pw-o-p"><b>44,99 €</b> / an</span>') && h.includes('<span class="pw-o-p"><b>5,99 €</b> / semaine</span>'));
  assert.ok(h.includes('<i class="pw-essai">3 jours d’essai</i>') && h.includes('<span class="pw-o-s"><span class="pw-soit">Soit </span><b>0,86 €</b> par semaine</span>'));
  assert.ok(h.includes('<span class="pw-badge">−86 %</span>') && h.includes('Meilleur choix</span>'));
  assert.ok(/class="pw-offre is-an is-on" role="radio" aria-checked="true" aria-label="Annuel, 44,99 € par an, 3 jours d’essai, soit 0,86 € par semaine"/.test(h)
    && /class="pw-offre is-semaine" role="radio" aria-checked="false" aria-label="Hebdomadaire, 5,99 € par semaine, accès immédiat, tous les niveaux, résiliable à tout moment"/.test(h), 'lu en entier par VoiceOver');
  assert.ok(h.indexOf('is-an') < h.indexOf('is-semaine'), 'l’annuelle en haut');
  assert.ok(h.includes('Elisa, tu es prêt·e à atteindre <em>ton objectif</em> !') && h.includes('<b>Progresser en SQL</b>, fin estimée le 3 décembre.'), 'son parcours d’abord');
  assert.ok(h.includes('<b>71 leçons vidéo</b>et leurs exercices') && h.includes('<b>477 défis</b>en solo ou entre amis') && (h.match(/class="pw-ico"/g) || []).length === 3, 'les vrais chiffres, avec leurs icônes');
  assert.ok(h.includes('Économise<br><b>266 €</b>') && h.includes('<b>0 €</b><br>aujourd’hui') && h.includes('Accès<br><b>illimité</b>'), 'l’économie réelle : 5,99 × 52 − 44,99');
  assert.ok(h.includes('Accès<br>immédiat') && h.includes('Tous les<br>niveaux') && h.includes('Résiliable à<br>tout moment') && !h.includes('Sans essai'), 'l’hebdomadaire dit ce qu’elle apporte (19 h 20)');
  assert.ok(h.includes('<b>+1 000 apprenant·es</b> font déjà confiance à Requête<small>Chiffre et avis issus du site requeteapp.com</small>'), 'la preuve sociale, et d’où elle vient');
  assert.ok(!/★|4,5|note moyenne/.test(h), 'pas de note étoilée : l’appli n’en a pas encore');
  assert.ok(h.includes('assets/chat-diplome.webp'), 'le chat diplômé');
});

test('le pied : le bouton dit ce qu’il fait, trois réassurances, la date et le montant du premier prélèvement', () => {
  const { ctx, pied } = monter();
  ctx.obPaywallPied();
  let [libelle, , , , note] = pied.at(-1);
  assert.equal(nb(libelle), 'Essayer gratuitement 3 jours');
  const n = nb(note.html);
  assert.ok(n.includes(`<b class="pw-sans">3 jours d’essai, puis 44,99 € par an à partir du ${dateEssai(3)}.</b> Renouvellement automatique, sauf annulation 24 h avant (réglages Apple).`));
  assert.ok(n.includes('Paiement Apple') && n.includes('Annulable') && n.includes('Données protégées') && n.includes('Conditions') && n.includes('Confidentialité'));
  assert.equal((nb(ctx.obPaywallHTML()).match(/pw-essai/g) || []).length, 1, 'la pastille sur l’annuelle seulement');
  ctx.obPaywallChoisir('semaine');
  [libelle, , , , note] = pied.at(-1);
  assert.equal(nb(libelle), 'S’abonner pour 5,99 €', 'le prix avant de valider');
  assert.ok(nb(note.html).includes('<b class="pw-sans">5,99 € aujourd’hui, puis chaque semaine.</b> Renouvellement automatique'));
  const deja = monter({ achat: { acheter: async () => true, essaiDispo: () => false } });
  deja.ctx.obPaywallPied();
  assert.equal(nb(deja.pied.at(-1)[0]), 'S’abonner pour 44,99 €', 'essai déjà utilisé : plus proposé');
  const hd = nb(deja.ctx.obPaywallHTML());
  assert.ok(!hd.includes('pw-essai') && hd.includes('Un paiement<br><b>par an</b>') && hd.includes('Résiliable à<br>tout moment') && !hd.includes('Sans essai'));
  assert.ok(nb(deja.pied.at(-1)[4].html).includes('<b class="pw-sans">44,99 € aujourd’hui, puis chaque année.</b>'));
});

test('les prix de la boutique : l’économie dans la devise du pays, et rien quand la devise manque', () => {
  const usd = monter({ achat: { acheter: async () => true, prix: k => k === 'an' ? { prix: 39.99, texte: '39,99 $', parSemaine: '0,76 $', devise: 'USD' } : { prix: 4.99, texte: '4,99 $', parSemaine: '4,99 $', devise: 'USD' } } });
  const h = nb(usd.ctx.obPaywallHTML());
  assert.ok(h.includes('<b>39,99 $</b> / an') && /Économise<br><b>219 \$/.test(h), h.match(/Économise[^/]*/)?.[0]);
  const sans = monter({ achat: { acheter: async () => true, prix: k => k === 'an' ? { prix: 39.99, texte: '39,99 $', parSemaine: '0,76 $' } : { prix: 4.99, texte: '4,99 $', parSemaine: '4,99 $' } } });
  assert.ok(!sans.ctx.obPaywallHTML().includes('Économise'), 'sans devise connue, pas de montant inventé');
});

test('tant que l’achat n’est pas branché : « Continuer » discret et le bouton entrent dans l’app ; branché, seul le paiement passe', async () => {
  const sans = monter();
  assert.ok(sans.ctx.obPaywallHTML().includes('<button type="button" class="pw-lien pw-passer" onclick="obPaywallPasser()">Continuer</button>'));
  await sans.ctx.obPaywallAcheter(); assert.deepEqual(sans.vers, ['plan-ready']);
  let achete = null;
  const avec = monter({ achat: { acheter: async o => { achete = o; return true; }, restaurer: async () => false } });
  const h = avec.ctx.obPaywallHTML();
  assert.ok(h.includes('onclick="obPaywallRestaurer()">Restaurer</button>') && !h.includes('pw-passer'), 'branché : « Restaurer », plus de « Continuer »');
  await avec.ctx.obPaywallAcheter(); assert.equal(achete, 'an'); assert.deepEqual(avec.vers, ['plan-ready']);
  assert.ok(app.includes("  else if(slide==='paywall'){if(!obAchatPret())obPaywallPasser();}"), 'Suivant et le glissé ne passent la page que sans achat branché');
});

test('la DA du site : cartes à rebord, la choisie blanche à bord soleil, coche qui rebondit, pied resserré ; « Continuer » au bout de 2 s', () => {
  for (const r of ['html #onboarding.ob-vitrine .pw-offre.is-on{background:#fff;border-color:var(--v-sun);', 'html #onboarding.ob-vitrine .pw-reco{position:absolute;',
    'html #onboarding.ob-vitrine .pw-tag{display:inline-block;', 'html #onboarding.ob-vitrine .pw-plus li+li{border-left:', 'background:#C8306A;color:#fff;',
    'html #onboarding.ob-vitrine .pw-chat{width:130px;top:-8px;right:-10px}', 'html #onboarding.ob-vitrine .pw-ico{width:30px;height:30px}', 'html #onboarding.ob-vitrine.ob-paywall-step .ob-foot{padding-top:10px!important;',
    'html:not([data-motion="reduce"]) #onboarding.ob-vitrine .pw-offre.is-on .pw-o-radio{animation:pwCoche'])
    assert.ok(css.includes(r), r);
  /* 11 novembre (6 h 54) : plus rien ne disparaît pour tenir, la page se met à l’échelle (obFit) : plus de règle d’écran qui cache les icônes ou le « Soit … par semaine » */
  assert.ok(!css.includes('.pw-ico{display:none}') && !css.includes('.pw-soit{display:none}'));
  assert.ok(css.includes('html:not([data-motion="reduce"]) #onboarding.ob-vitrine .pw-passer{animation:pwPasser .4s ease-out 2s both}'), '« Continuer » arrive au bout de deux secondes');
});
