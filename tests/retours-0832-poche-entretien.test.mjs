/* Elisa, 13 novembre, 8 h 32, sur le widget « La requête de poche » : « Tu vois le widget du QCM, il faudrait éviter les questions
   combien il y a de lignes car on ne peut pas exécuter […] Et il faudrait que tu génères des questions, pas que sur les cours, mais
   sur les parties, toutes les parties en fait, en évitant les requêtes. Quel est le résultat ? Parce qu’on n’a pas d’exécuteur, on ne
   saura pas. Je veux juste des questions niveau, tu sais, entretien, toutes les questions possibles, mais pas sur quel est le
   résultat. Et j’ai l’impression que ce widget-là, il est mal formaté […] Il y a des trous, il y a des espaces. »
   1. Plus aucun « Quel résultat ? » (POCHE_PLUS, widgetPoche, le widget).
   2. POCHE_ENTRETIEN : dix questions d’entretien par partie du programme, quinze parties, sans code ni requête à exécuter.
   3. widgetPoche : une question d’entretien, une révision ; l’entretien touche les quinze parties dès le premier tour.
   4. Le widget : trois étages (l’étiquette, le milieu qui prend la place qui reste, les réponses et le pied à hauteur fixe), des
      réponses sur deux lignes quand il le faut, le verdict en pastille sur le coin de la puce. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html');
const swift = lire('resources/ios/widget/RequeteWidget/RequeteWidget.swift');
const ios = lire('IOS.md');
const entre = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j); };
const ici = x => JSON.parse(JSON.stringify(x));
const banque = n => ici(vm.runInNewContext(entre(app, 'const ' + n + '=[', '\n];\n') + '\n];' + n));
const POCHE = banque('POCHE'), PLUS = banque('POCHE_PLUS'), ENT = banque('POCHE_ENTRETIEN');
const MODULES = ici(vm.runInNewContext(entre(app, 'const MODULES = [', 'const CHALLENGES=[').replace(/guide\(/g, '(') + ';MODULES', {}));
const LECONS = MODULES.flatMap(m => m.lessons);
const nom = p => `partie ${p.m} « ${p.e} »`;
const tous = (t, l) => { for (const k of l) assert.ok(t.includes(k), k); };

/* ---------- 1. Plus de « Quel résultat ? » ---------- */
test('« on ne peut pas exécuter » : plus aucune question ne demande ce qu’une requête renvoie', () => {
  assert.ok(!PLUS.some(p => p.g === 'resultat'), 'le genre est parti de la banque');
  assert.ok(!/g:"resultat"/.test(app));
  for (const p of PLUS.concat(ENT)) {
    assert.doesNotMatch(p.e || '', /^Combien de (lignes|colonnes) dans le résultat|Quel(le)? (est le )?résultat|Que renvoie|Quelle valeur renvoie/i, p.e);
  }
  /* Une question d’entretien n’a aucun code à lire */
  assert.ok(ENT.every(p => p.q === undefined && p.r === undefined && p.l === undefined), 'ni requête, ni résultat, ni leçon');
});

/* ---------- 2. La banque d’entretien ---------- */
test('« toutes les parties en fait » : dix questions d’entretien pour chacune des quinze parties', () => {
  assert.equal(MODULES.length, 15);
  assert.equal(ENT.length, 150);
  MODULES.forEach((m, k) => assert.equal(ENT.filter(p => p.m === k).length, 10, m.titre));
  for (const b of [0, 1, 2]) assert.ok(ENT.filter(p => p.b === b).length >= 40, 'la bonne réponse change de place : ' + b);
  /* Dans chaque partie aussi : jamais toujours la même place */
  MODULES.forEach((m, k) => assert.ok(new Set(ENT.filter(p => p.m === k).map(p => p.b)).size === 3, m.titre));
  /* Chaque question est unique, et ne redit pas un QCM déjà là (le pont retrouve la question du moment par son énoncé) */
  const enonces = ENT.map(p => p.e).concat(PLUS.filter(p => p.g === 'qcm').map(p => p.e));
  assert.equal(new Set(enonces).size, enonces.length, 'aucun énoncé en double');
});

test('chaque question d’entretien tient dans le widget, à la typographie de l’app', () => {
  const prose = s => s.replace(/`[^`]*`/g, '');
  for (const p of ENT) {
    const n = nom(p);
    assert.deepEqual(Object.keys(p), ['m', 'e', 'c', 'b', 'oui', 'non'], n);
    assert.ok(p.e.length >= 12 && p.e.length <= 100, `${n} : ${p.e.length} caractères`);
    assert.match(p.e, /[?…:]$| \?$/, n + ' : une question');
    assert.ok(p.c.length === 3 && new Set(p.c).size === 3 && p.b >= 0 && p.b <= 2, n + ' : trois réponses, une bonne');
    for (const c of p.c) {
      assert.ok(c.length >= 1 && c.length <= 18, `${n} : « ${c} » trop long`);
      for (const mot of c.split(' ')) assert.ok(mot.length <= 12, `${n} : le mot « ${mot} » ne se coupe pas`);
      assert.doesNotMatch(c, /'|`/, `${n} : « ${c} »`);
    }
    assert.doesNotMatch(p.e, / [?!:;»]|« /, n + ' : espace insécable');
    assert.doesNotMatch(p.e, /^(Il|Elle|Ils|Elles) /, n);
    for (const k of ['oui', 'non']) {
      const s = p[k];
      assert.ok(s.length >= 8 && s.replace(/`/g, '').length <= 40, `${n} ${k} : ${s}`);
      assert.equal((s.split('`').length - 1) % 2, 0, `${n} ${k} : accents graves`);
      assert.doesNotMatch(prose(s), / [?!:;»]|« /, `${n} ${k} : espace insécable`);
      assert.doesNotMatch(prose(s), /'/, `${n} ${k} : apostrophe typographique`);
      assert.doesNotMatch(s, /^(Il|Elle|Ils|Elles) /, `${n} ${k} : le sujet nommé`);
    }
    assert.doesNotMatch([p.e, p.oui, p.non].concat(p.c).join(' '), /bientôt|prochainement/i, n);
  }
});

/* La mesure approchée du widget (PocheRangement.cadratin, large, coupee, formeProse), refaite ici : les réponses tiennent */
const cadratin = c => c === ' ' ? 0.28 : 'mwMW'.includes(c) ? 0.98 : "iljI.,'’:;!|".includes(c) ? 0.34 : 'tfr/()-'.includes(c) ? 0.45 : (c !== c.toLowerCase() || /[0-9]/.test(c)) ? 0.74 : 0.63;
const large = s => [...s].reduce((t, c) => t + cadratin(c), 0);
const coupee = s => { const m = s.split(' '); let mieux = large(s); for (let k = 1; k < m.length; k++) mieux = Math.min(mieux, Math.max(large(m.slice(0, k).join(' ')), large(m.slice(k).join(' ')))); return mieux; };
const forme = (choix, largeur, u, v) => {
  const marge = 5 * u, part = (largeur - 12 * u) / 3 - 2 * marge;
  let une = 1, deux = 1;
  for (const c of choix) { une = Math.max(une, large(c)); deux = Math.max(deux, coupee(c)); }
  const surUne = part / une, surDeux = part / deux;
  if (surUne >= 11 * u || surDeux <= surUne + 0.01) return { taille: Math.max(9 * u, Math.min(13 * u, surUne)), lignes: 1, hauteur: 30 * v, besoin: une };
  return { taille: Math.max(9 * u, Math.min(12.5 * u, surDeux)), lignes: 2, hauteur: 38 * v, besoin: deux };
};
const mesure = (w, h) => { const u = Math.min(w / 364, h / 170), chat = Math.min(w * 0.29, h * 0.62), gauche = chat + 4 * u; return { u, v: h / 170, contenu: Math.max(120, w - gauche - 14 * u) }; };

test('les réponses en mots : une ligne si elles y tiennent à 11 points, deux sinon ; jamais moins de 10 points, sur trois iPhone', () => {
  for (const [w, h] of [[364, 170], [338, 158], [329, 155]]) {
    const { u, v, contenu } = mesure(w, h), part = (contenu - 12 * u) / 3 - 10 * u;
    let deux = 0;
    for (const p of ENT.concat(PLUS.filter(x => x.g === 'qcm').map(x => ({ m: -1, e: x.e, c: x.c })))) {
      const f = forme(p.c, contenu, u, v);
      if (p.m >= 0) assert.ok(f.taille >= 10 * u, `${w} × ${h} ${nom(p)} : ${f.taille.toFixed(1)} points`);
      assert.ok(f.besoin * f.taille <= part + 0.01 || f.taille === 9 * u, `${w} × ${h} « ${p.c.join(' / ')} » : la plus large tient dans sa part`);
      assert.ok(f.lignes * f.taille * 1.2 <= f.hauteur - 6 * v, 'les lignes tiennent dans la hauteur de la puce');
      if (f.lignes === 2) deux++;
    }
    assert.ok(deux >= 60 && deux <= 140, deux + ' questions sur deux lignes');
  }
  /* Trois mots seuls restent sur une ligne, même un peu petits : une deuxième ligne ne leur servirait à rien */
  const m = mesure(364, 170);
  assert.equal(forme(['INTERSECT', 'UNION', 'EXCEPT'], m.contenu, m.u, m.v).lignes, 1);
  assert.equal(forme(['Perdre des lignes', 'Une erreur', 'Des doublons'], m.contenu, m.u, m.v).lignes, 2);
  assert.equal(forme(['Non', 'Oui', 'Erreur'], m.contenu, m.u, m.v).taille, 13);
});

/* ---------- 3. La série du jour ---------- */
test('la série : l’entretien d’abord, une révision ensuite ; les quinze parties dès le premier tour, les parties commencées en tête', () => {
  const src = entre(app, 'function widgetPoche(){', 'if(typeof document!==');
  const page = ({ faites, jour = new Date(2026, 10, 13), sans = false }) => {
    const ctx = vm.createContext({ POCHE, POCHE_PLUS: PLUS, MODULES, allLessons: LECONS, itemDone: id => faites.includes(id), dueList: () => [], auj: () => jour,
      dstr: d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` });
    if (!sans) ctx.POCHE_ENTRETIEN = ENT;
    vm.runInContext(src, ctx);
    return ici(ctx.widgetPoche());
  };
  const ent = l => l.filter(q => q.genre === 'entretien');
  /* Le premier jour, sans leçon faite : trente questions, l’entretien remplit ce que les révisions laissent */
  const debut = page({ faites: [] });
  assert.equal(debut.length, 30);
  assert.equal(debut[0].genre, 'entretien');
  assert.equal(debut[0].titre, 'Introduction', 'la partie commencée d’abord');
  assert.equal(new Set(ent(debut).slice(0, 15).map(q => q.titre)).size, 15, 'un tour : les quinze parties');
  assert.ok(ent(debut).length >= 20);
  for (const q of ent(debut)) {
    assert.deepEqual(q.code, []);
    const p = ENT.find(x => x.e === q.enonce);
    assert.ok(p && MODULES[p.m].titre === q.titre && q.choix[q.bon] === p.c[p.b] && q.oui === p.oui && q.non === p.non, q.enonce);
  }
  /* Deux parties commencées : elles ouvrent le tour, les treize autres suivent */
  const jointures = MODULES.findIndex(m => m.titre === 'Jointures');
  const deux = page({ faites: [0, MODULES[jointures].lessons[0].id] });
  assert.deepEqual(ent(deux).slice(0, 2).map(q => q.titre).sort(), ['Introduction', 'Jointures']);
  assert.equal(new Set(ent(deux).slice(0, 15).map(q => q.titre)).size, 15);
  /* Tout le parcours fait : quinze et quinze, en alternance ; d’un jour à l’autre, d’autres questions */
  const tout = page({ faites: LECONS.map(l => l.id) });
  assert.equal(ent(tout).length, 15);
  assert.equal(new Set(ent(tout).map(q => q.titre)).size, 15);
  assert.deepEqual(tout.map(q => q.genre === 'entretien'), tout.map((q, i) => i % 2 === 0));
  const vues = new Set();
  for (let j = 1; j <= 28; j++) for (const q of ent(page({ faites: LECONS.map(l => l.id), jour: new Date(2026, 10, j) }))) vues.add(q.enonce);
  assert.ok(vues.size >= 130, vues.size + ' questions d’entretien différentes en quatre semaines');
  /* Une ancienne page sans la banque : les révisions seules, comme avant */
  const avant = page({ faites: LECONS.map(l => l.id), sans: true });
  assert.ok(avant.length === 30 && ent(avant).length === 0);
  tous(src, ["genre:'entretien',enonce:p.e", ".filter(p=>p.g!=='resultat')", 'for(let tour=0;tour<10;tour++)for(const x of parties)if(x.q[tour]){']);
});

/* ---------- 4. Le widget ---------- */
test('le widget : « Entretien · la partie », plus de « Quel résultat ? », une série d’avant en est filtrée', () => {
  const r = entre(swift, 'enum PocheRangement {', '\nstruct BoutCode');
  tous(r, ['case "entretien": return "Entretien · " + q.titre', 'if q.genre == "resultat" { return false }',
    'static func prose(_ q: QuestionPoche) -> Bool {\n        q.genre == "qcm" || q.genre == "entretien"\n    }']);
  assert.ok(!r.includes('case "resultat"'));
  /* Sans question rangée : l’entretien n’attend aucune leçon */
  const v = entre(swift, 'struct PocheVue: View {', '\nstruct RequetePoche: Widget {');
  tous(v, ['Text("Pas encore de question")', 'Text("Ouvre l’app\\u{00A0}: tes questions du jour viendront ici.")']);
  assert.ok(!swift.includes('Rien à réviser pour l’instant') && !swift.includes('Termine une leçon'));
  assert.ok(swift.includes('.description("Une question SQL, de tes leçons ou d’entretien\\u{00A0}: tu réponds dans le widget, sans ouvrir l’app.")'));
});

test('« il y a des trous, il y a des espaces » : trois étages, le milieu prend la place qui reste, le pied garde sa hauteur', () => {
  const v = entre(swift, 'struct PocheVue: View {', '\nstruct RequetePoche: Widget {');
  const colonne = entre(v, 'private func colonne(_ m: MesurePoche, _ q: QuestionPoche) -> some View {', '\n    }\n');
  tous(colonne, ['let pied: CGFloat = 30 * u', 'return VStack(alignment: .leading, spacing: 0) {\n            etiquette(u, q)\n            milieu(u, v, q, m)\n            reponses(u, v, q, m)\n            retour(u, v, q)\n                .frame(height: pied)\n                .padding(.top, ecart)\n        }']);
  assert.ok(!colonne.includes('Spacer('), 'plus de ressort entre les réponses et la consigne : c’est là que le vide tombait');
  const milieu = entre(v, 'private func milieu(_ u: CGFloat, _ v: CGFloat, _ q: QuestionPoche, _ m: MesurePoche) -> some View {', '\n    }\n');
  tous(milieu, ['if PocheRangement.aEnonce(q) {\n                enonce(u, q, m)', 'if !q.code.isEmpty {\n                code(u, v, q, m)',
    '.padding(.vertical, marge)\n        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)']);
  /* L’énoncé seul grandit quand il est court */
  const r = entre(swift, 'enum PocheRangement {', '\nstruct BoutCode');
  tous(r, ['static func tailleEnonce(_ q: QuestionPoche, u: CGFloat) -> CGFloat {\n        if !q.code.isEmpty { return 12 * u }', 'if lettres <= 30 { return 17 * u }', 'if lettres <= 52 { return 16 * u }',
    'if lettres <= 76 { return 15 * u }\n        return 14 * u', 'let parHauteur: CGFloat = place * v / (1.3 * CGFloat(max(2, q.code.count)))']);
  tous(v, ['let taille: CGFloat = PocheRangement.tailleEnonce(q, u: u)']);
  /* La place compte : à 170 de haut, ce que chaque étage prend (les mêmes nombres que le Swift) */
  const fixe = 10 + 13.1 + 4 + 4 + 5 + 30 + 8;           // marges, étiquette, marges du milieu, écart, pied
  assert.ok(fixe + 38 + 3 * 16 * 1.2 <= 170.5, 'trois lignes d’énoncé à 16 points au-dessus de puces sur deux lignes');
  assert.ok(fixe + 28 + 12 * 1.2 + 5 + 12 + 35 <= 170, 'un cas pratique : l’énoncé, le code (35 points de lignes), les puces');
  assert.ok(fixe + 28 + 12 + 53 <= 170, 'une requête à trou : 53 points de lignes');
});

test('les puces : deux lignes quand il le faut, et le verdict en pastille sur le coin (le texte ne rétrécit plus au moment de répondre)', () => {
  const v = entre(swift, 'struct PocheVue: View {', '\nstruct RequetePoche: Widget {');
  tous(v, ['let forme: FormePuce = formePuce(u, v, q, m)', 'if PocheRangement.prose(q) {\n            return PocheRangement.formeProse(q, u: u, v: v, largeur: m.contenu)\n        }',
    'return FormePuce(taille: taille, lignes: 1, hauteur: 28 * v, marge: 6 * u)', '.multilineTextAlignment(.center)\n            .lineLimit(forme.lignes)',
    'return mot(texte, police, forme)\n            .foregroundColor(style.texte)', '.overlay(pastille(style, u), alignment: .topTrailing)', 'let decal: CGFloat = cote / 2', '.offset(x: decal, y: -decal)',
    '.background(Circle().fill(style.texte))\n                    .overlay(Circle().strokeBorder(Color.white, lineWidth: lisere))']);
  const puce = entre(v, 'private func puce(_ i: Int, _ texte: String, _ q: QuestionPoche, _ forme: FormePuce, _ u: CGFloat) -> some View {', '\n    }\n');
  assert.ok(!puce.includes('HStack') && !puce.includes('Image('), 'plus de symbole dans la ligne du texte');
  const r = entre(swift, 'enum PocheRangement {', '\nstruct BoutCode');
  tous(r, ['static func cadratin(_ c: Character) -> CGFloat {', 'if "mwMW".contains(c) { return 0.98 }', 'if c.isUppercase || c.isNumber { return 0.74 }',
    'let part: CGFloat = (largeur - 12 * u) / 3 - 2 * marge', 'let tient: Bool = surUne >= 11 * u', 'let motsSeuls: Bool = surDeux <= surUne + 0.01',
    'return FormePuce(taille: taille, lignes: 1, hauteur: 30 * v, marge: marge)', 'return FormePuce(taille: taille, lignes: 2, hauteur: 38 * v, marge: marge)',
    'struct FormePuce {\n    let taille: CGFloat\n    let lignes: Int\n    let hauteur: CGFloat\n    let marge: CGFloat\n}']);
  /* Les règles du projet pour le Swift : pas deux choix sur une ligne, pas de choix dans Text(...) */
  for (const l of v.split('\n')) assert.ok((l.match(/ \? /g) || []).length <= 1, l);
});

test('IOS.md raconte la requête de poche du 13 novembre', () => {
  const s = entre(ios, 'La requête de poche : l’entretien, plus de « Quel résultat ? », trois étages (13 novembre, 8 h 32)', '\n## ');
  tous(s, ['POCHE_ENTRETIEN', 'dix questions par partie', 'npm run ios:verif', 'Ce qui n’a pas été fait']);
});
