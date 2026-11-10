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
  assert.ok(app.includes("const OB_SLIDES = ['welcome','name','pays','age','job','goal','level','rhythm','jours','build','temoignages','pact','practice','source','rappel','widget','widgetTuto','pseudo','ready','account','paywall'];"));
  const { ctx, vers } = monter();
  ctx.obApresPret('home'); assert.deepEqual(vers, ['→account'], 'la connexion d’abord');
  ctx.obApresCompte(); assert.deepEqual(vers, ['→account', '→paywall'], 'puis le paywall');
  ctx.obPaywallEntrer(); assert.deepEqual(vers.at(-1), 'home', 'puis ce que le bouton de la dernière page promettait');
  const masquee = monter(); masquee.ctx.obConnexionMasquee = () => true; masquee.ctx.obApresPret('salle');
  assert.deepEqual(masquee.vers, ['→paywall'], 'dans l’app sans connexion branchée : droit au paywall');
  const abonne = monter({ achat: { acheter: async () => true, actif: () => true } }); abonne.ctx.obApresCompte();
  assert.deepEqual(abonne.vers, ['plan-ready'], 'déjà abonné : pas de paywall');
});

test('les prix : 44,99 € par an en gros, 0,86 € par semaine dessous, −86 %, 5,99 € par semaine ; l’annuel choisi d’avance', () => {
  const { ctx } = monter();
  const h = ctx.obPaywallHTML().replace(/[\u00a0\u202f](?!%)/g, ' ').replace(/&nbsp;/g, '\u00a0');
  assert.ok(h.includes('<span class="pw-o-p"><b>44,99 €</b> par an</span><span class="pw-o-s"><i class="pw-essai">3\u00a0jours gratuits</i>soit 0,86 € par semaine</span>'));
  assert.ok(h.includes('<span class="pw-o-p"><b>5,99 €</b> par semaine</span>'));
  assert.ok(h.includes('<span class="pw-badge">−86\u00a0%</span>'));
  assert.ok(/class="pw-offre is-an is-on" role="radio" aria-checked="true"/.test(h) && /class="pw-offre is-semaine" role="radio" aria-checked="false"/.test(h));
  assert.ok(h.indexOf('is-an') < h.indexOf('is-semaine'), 'l’annuel en haut');
  assert.ok(h.includes('Elisa, va au bout de ton <em>objectif</em>.') && h.includes('<b>Progresser en SQL</b> · fin estimée le 3 décembre'), 'son parcours d’abord');
  assert.ok(h.includes('<b>71\u00a0leçons vidéo</b>') && h.includes('<b>477\u00a0défis</b>'), 'les vrais chiffres');
  assert.ok(h.includes('Plus de 1 000 personnes apprécient Requête'), 'la preuve sociale vérifiée');
  assert.ok(h.includes('assets/chat-diplome.webp'), 'le chat diplômé');
});

test('le pied : avec l’annuel, l’essai de 3 jours, ce qui suit et ses liens ; avec la semaine, « Sans engagement » (18 h 49 : « Oui » à l’essai)', () => {
  const nb = x => x.replace(/[\u00a0\u202f]/g, ' ').replace(/&nbsp;/g, ' ');
  const { ctx, pied } = monter();
  ctx.obPaywallPied();
  let [libelle, , , , note] = pied.at(-1);
  assert.equal(nb(libelle), 'Essayer gratuitement 3 jours');
  assert.ok(nb(note.html).includes('<b class="pw-sans">3 jours gratuits, puis 44,99 € par an.</b> Annule avant la fin de l’essai et tu ne paies rien. Renouvellement automatique ensuite')
    && note.html.includes('Conditions') && note.html.includes('Confidentialité'));
  assert.ok(nb(ctx.obPaywallHTML()).includes('<span class="pw-o-s"><i class="pw-essai">3 jours gratuits</i>soit 0,86 € par semaine</span>') && (nb(ctx.obPaywallHTML()).match(/pw-essai/g) || []).length === 1, 'la pastille sur l’annuel seulement');
  ctx.obPaywallChoisir('semaine');
  [libelle, , , , note] = pied.at(-1);
  assert.equal(libelle, 'Commencer mon parcours');
  assert.ok(nb(note.html).includes('<b class="pw-sans">Sans engagement, annulable à tout moment.</b> Renouvellement automatique à 5,99 € par semaine'));
  const deja = monter({ achat: { acheter: async () => true, essaiDispo: () => false } });
  deja.ctx.obPaywallPied();
  assert.equal(deja.pied.at(-1)[0], 'Commencer mon parcours', 'essai déjà utilisé : plus proposé');
  assert.ok(!deja.ctx.obPaywallHTML().includes('pw-essai'));
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

test('la DA du site : cartes blanches à rebord, bord soleil pour l’offre choisie, coches jaunes, contrastes lisibles ; tout tient sur un iPhone SE', () => {
  for (const r of ['html #onboarding.ob-vitrine .pw-offre.is-on{border-color:var(--v-sun);', 'html #onboarding.ob-vitrine .pw-plus li::before{content:\'\';',
    'html #onboarding.ob-vitrine .pw-tag{display:inline-block;', 'html #onboarding.ob-vitrine .pw-o-s{grid-area:s;color:#0E7A47;', 'background:#C8306A;color:#fff;',
    '@media (max-height:700px){html #onboarding.ob-vitrine .pw-chat{width:74px;top:-2px}'])
    assert.ok(css.includes(r), r);
  assert.ok(css.includes('html:not([data-motion="reduce"]) #onboarding.ob-vitrine .pw-passer{animation:pwPasser .4s ease-out 2s both}'), '« Continuer » arrive au bout de deux secondes');
});
