# Voix off : la liste exacte à régénérer (ElevenLabs)

_5 novembre 2026, d’après le contrôle des voix du 4 novembre. Elisa décide de ce qui est généré._

**10 novembre, 13 h : la relecture finale des 72 cours** (six relecteurs débutants, en parallèle). Quatre phrases fausses ou bloquantes, chacune avec la voix de son cours ; la page garde ses textes tant que la voix n’est pas refaite (`tools/voix/<cours>-relecture.json`) :
  - WITH RECURSIVE (Anaïs, ch06, 422 caractères) : « EXCEPT retire les 12 dates de juillet présentes dans la table commandes » (la table en a 14, deux en août) ;
  - GROUP BY sur plusieurs colonnes (Antoine, ch05, 296 caractères) : « chaque colonne du GROUP BY doit figurer dans le SELECT » devient un conseil (la vidéo montre ensuite que la requête s’exécute) ;
  - Normalisation (Agathe, ch05, 688 caractères) : la 2e forme normale parle de « la clé » avant qu’elle soit présentée ;
  - Bases relationnelles (Agathe, ch06, 1391 caractères, déjà à refaire pour ses légendes muettes) : « ne peut pas être nulle » devient « n’est jamais vide ».

  Environ 2 800 crédits :

```
cd ~/SQL && git pull --ff-only && node tools/voix/generer.mjs --toutes --cours with-recursive-relecture,group-by-colonnes-relecture,projet-normaliser-relecture,bases-relationnelles-relecture --oui
```

  Puis « fini » : `node tools/voix/integrer.mjs <cours> tools/voix/sortie/<cours>-relecture --garder` pour chacun.

**10 novembre, 10 h 10 : contrôle automatique des 1 436 voix** (signal seul : débuts et fins, silences, volume, saturation, débit ; `tools/voix/clics.mjs`). Rien de coupé au début, aucune saturation, aucun silence anormal (le plus long fait 1,2 s), volumes homogènes (`volume.mjs` : 0 fichier à régler), débits normaux. Corrigé sans régénérer ni réencoder : 51 « tic » en fin de phrase et 5 souffles après la dernière syllabe (les trames concernées rendues muettes, durée inchangée, le reste du son identique à l’échantillon près). Reste pour l’oreille d’Elisa : `coalesce/ch02` (un bruit après « absents », trop proche de la voix pour être retiré sans risque), et `bases-relationnelles/ch11`, jamais généré (voir plus bas). Les accents et la prononciation ne se contrôlent pas automatiquement ici.

**6 novembre, 21 h 45 : tout est intégré.** Les deux commandes du 6 novembre ont tourné ; l’appli joue maintenant la voix d’Anaïs dans les 20 cours (et le chapitre refait de GROUP BY), les corrections de la relecture, les moments expliqués avant d’être posés, les deux phrases de la vidéo du site et la phrase des index. Chaque voix intégrée est ramenée au niveau de son cours (`tools/voix/volume.mjs`).

Il reste **une seule consigne** à refaire, avec la voix d’Anaïs : le 3e moment de « Sous-requête dans WHERE avec IN » disait « ici, la base ne lit que la première de la liste » ; la règle d’Elisa ne fait jamais parler la base, la consigne devient « ici, seule la première de la liste compte ». Environ 155 crédits :

```
cd ~/SQL && git pull --ff-only && node tools/voix/generer.mjs --toutes --cours sous-requete-in-retouches --oui
```

Puis « fini » : `node tools/voix/integrer.mjs sous-requete-in tools/voix/sortie/sous-requete-in-retouches --garder` (la consigne change avec sa voix ; les autres fichiers du cours restent).

**6 novembre, 17 h 16 : où on en était.** (Tout ce qui suit jusqu’aux « Déjà corrigé » est fait et intégré.)

_Décisions d’Elisa, 6 novembre, 21 h 05 : la voix garde « identifiant » pour id ; la Console reste telle quelle pour les commandes de serveur (MERGE, CREATE SCHEMA, FOR UPDATE, GRANT, REVOKE) ; les moments « À toi » qui demandent avant d’expliquer : la vidéo explique d’abord (en cours, une deuxième commande suivra) ; les 20 cours d’Anaïs sont intégrés avec le reste, au « fini »._

- Les 20 cours qui passent à la voix d’Anaïs et le chapitre de GROUP BY **sont générés** (sur le Mac, le 5 novembre entre 1 h 25 et 1 h 41, dans `tools/voix/sortie/`), **mais pas encore intégrés** : l’appli joue toujours les anciennes voix de ces cours. Pour les intégrer, dire « fini » à Claude.
- La vidéo du site : seules **deux phrases** sont à refaire, avec la voix de Louis : s12 « animés par huit formateurs » (au lieu d’« une dizaine ») et s16 « cent quarante-deux questions » (l’appli en a 142 ; la voix en dit 141).
- Les index et EXPLAIN (leçon 57) : la consigne du 2e moment ne dit plus « Bientôt » (« La table va passer à un million de commandes. ») ; une phrase, avec la voix d’Abraham.
- MERGE (leçon 82, 19 h) : la vidéo ne dit plus que MERGE n’existe pas dans l’app. Le chapitre 7 d’Anaïs (`ch07`, fait le 5 novembre) commençait par cette phrase : il est refait sans elle, lui seul (les 21 autres fichiers du cours, sur le Mac, ont le même texte et la même voix : vérifié le 6 novembre).
- Procédures et fonctions stockées (leçon 83, 19 h 56) : de même, plus de « Dans la base de l’app, elles n’existent pas. » ; son chapitre 7 d’Anaïs est refait sans la phrase, lui seul (les 22 autres fichiers : vérifiés).
- **Les erreurs trouvées par la relecture des cours (6 novembre, 20 h 30)**, chacune avec la voix de son cours ; la page garde ses textes tant que la voix n’est pas refaite (les retouches, `tools/voix/<cours>-retouches.json`, les posent à l’intégration) :
  - BETWEEN : « Ces 4 commandes reçoivent… » (la base n’a que 3 clients pour ces 4 commandes) ;
  - Renommer avec AS : la voix dit « l’euro entre parenthèses donne une erreur » (c’est la parenthèse qui en donne une) ;
  - NOT : le compte des 3 clients (age > 35 écarte aussi les plus jeunes), et la date dite chiffre par chiffre ;
  - Comparer des valeurs : le Shaker Inox, un accessoire, reste à écarter (« il faudra combiner deux conditions ») ;
  - Fonctions numériques : « sauf entre deux entiers : 7 / 2 donne 3 » ;
  - GROUP BY sur plusieurs colonnes : « La date et le statut… » (la table n’a pas de colonne mois) ;
  - Plusieurs conditions dans ON : la consigne du 3e moment, « OR à la place de AND » (la requête du piège n’en remplace qu’un : 72 lignes) ;
  - LAG et LEAD : le piège, « rangées par client puis par date » (seule cette suite donne −23 jours), dans la légende et la consigne du 3e moment ;
  - Quel JOIN choisir ? : « même vides, et seulement eux » (3e moment) et « elle n’apparaît pas comme salariée » (Nadia Benali) ;
  - CREATE TABLE : la date dite chiffre par chiffre (« comme 2026, tiret, 09, tiret, 12 ») ;
  - INSERT … SELECT (voix d’Anaïs, avec les 20 cours) : la consigne du 2e moment, « pour que chaque valeur arrive dans la bonne colonne » (ville aussi rendait la requête acceptée).

  Tout d’un coup, environ 5 600 crédits :

```
cd ~/SQL && git pull --ff-only && node tools/voix/generer.mjs --toutes --cours video-site-retouches,projet-index-retouches,projet-merge,projet-procedures,insert-select,between-retouches,as-retouches,not-retouches,comparer-retouches,fonctions-numeriques-retouches,group-by-colonnes-retouches,plusieurs-conditions-on-retouches,lag-lead-retouches,quel-join-choisir-retouches,projet-create-retouches --oui
```

  Puis dire « fini » à Claude, qui les intègre : `node tools/voix/integrer-site.mjs tools/voix/sortie/video-site-retouches` (les quinze autres phrases et la musique restent) et, pour chaque cours retouché, `node tools/voix/integrer.mjs <cours> tools/voix/sortie/<cours>-retouches --garder` (les autres fichiers du cours restent ; les légendes et les consignes changent avec leur voix). MERGE, Procédures et INSERT … SELECT passent à Anaïs avec les 17 autres cours (voir ci-dessous) ; en attendant, l’appli garde leurs voix d’avant, sans les phrases retirées. **Ne pas lancer `video-site`, `projet-index`, ni `--toutes` sans `--cours`** : le Mac n’a pas les fichiers d’origine de la plupart des cours, toute leur voix serait refaite.

**6 novembre, 21 h 30 : les moments expliqués avant d’être posés** (décision d’Elisa, 21 h 05 : « Expliquer avant le moment »). Pour 12 moments (dans 11 cours), la vidéo donne d’abord ce qu’il faut savoir, dans la légende juste avant ou dans la consigne : DISTINCT (sa place), AND et OR (les parenthèses), INNER JOIN (ON), SELF JOIN (le signe <>), NTILE (la ligne en plus), fenêtres glissantes (le cadre par défaut), UML (les multiplicités, 2 moments), CREATE TABLE (le type DATE), les droits (GRANT … TO, REVOKE … FROM), et, avec la voix d’Anaïs, IN (le signe = devant une sous-requête) et les transactions (COMMIT et ROLLBACK). Les retouches s’appellent `tools/voix/<cours>-moments.json` ; la page garde ses textes jusqu’à l’intégration. LIKE et Comparer ne changent pas : le moment de LIKE montre le résultat à chaque essai, et la carte des six opérateurs de Comparer dit déjà ce que veut dire `!=`.

  La deuxième commande, environ 3 000 crédits (elle peut suivre la première, ou partir en même temps) :

```
cd ~/SQL && git pull --ff-only && node tools/voix/generer.mjs --toutes --cours sous-requete-in,projet-transaction,distinct-moments,and-or-moments,inner-join-moments,self-join-moments,first-last-ntile-moments,fenetres-glissantes-moments,projet-uml-moments,projet-create-moments,projet-droits-moments --oui
```

  Puis « fini » : `node tools/voix/integrer.mjs <cours> tools/voix/sortie/<cours>-moments --garder` pour chacun ; IN et les transactions passent à Anaïs avec les 18 autres cours.

Déjà corrigé sans régénérer : les 60 débuts de phrase coupés (tables VOICE, et la cause dans `integrer.mjs`), le « Bravo » final trop fort (27 cours, ramené au niveau de leur cours) et, le 6 novembre, le volume de toutes les voix (1 089 fichiers ramenés au niveau de leur cours et des premiers cours, sans réencodage : `tools/voix/volume.mjs`, que `integrer.mjs` applique aussi à chaque nouvelle voix).

**5 novembre, 0 h 38 : les 20 cours de Miya (Mia), Emily, Coralie (Koraly), Arthur et Sam passent à la voix d’Anaïs** et sont refaits en entier, avec les règles de prononciation d’aujourd’hui, ainsi qu’un chapitre de GROUP BY (Antoine) qui ne nomme plus SQLite et, à 6 h 37, la phrase de la vidéo du site « animés par huit formateurs » (Louis, au lieu d’« une dizaine ») : environ 68 600 crédits.

```
cd ~/SQL && git pull --ff-only && node tools/voix/generer.mjs --toutes --cours sous-requete-in,sous-requete-select,sous-requete-from,insert-select,exists,any-all,with-cte,union,intersect-except,with-recursive,projet-insert,projet-update,projet-merge,projet-delete,projet-ondelete,projet-transaction,projet-savepoint,projet-concurrence,projet-procedures,projet-trigger,group-by
```

(Lancée le 5 novembre à 1 h 25 : ces cours sont faits. La phrase de la vidéo du site est passée dans `video-site-retouches`, ci-dessus.)

Dans les listes ci-dessous, les lignes de ces 20 cours sont donc caduques (Mia, Emily, Koraly, Sam : leurs fichiers seront dits par Anaïs).

## 1. Les voix qui manquent

**`fin-sql`, la vidéo de fin « Merci pour tout » : aucune voix (9 légendes, 414 caractères).** Aucune voix ne lui est attribuée dans `preparer.mjs` (elle prendrait Adam par défaut) : proposé, Agathe, la formatrice du premier cours.

1. Bravo : tu as terminé la dernière leçon du projet NutriBoost !
2. Toutes les équipes de NutriBoost te remercient.
3. À ton tour de leur répondre.
4. Ton message est envoyé à toute l’équipe NutriBoost.
5. Souviens-toi de ta toute première requête.
6. Regarde le chemin parcouru depuis !
7. 15 modules, 65 cours et 184 requêtes SQL.
8. Bravo : tu as terminé ton apprentissage du SQL !
9. Et maintenant, place à la pratique : des défis t’attendent !

**`bases-relationnelles` (Agathe) : 7 légendes muettes.** Les chapitres 5 et 6 sont à refaire en entier (5 légendes ajoutées après la génération), et le chapitre 11 « À retenir » n’a jamais été généré : ch05, ch06 et ch11, 2385 caractères.

- Le SQL est le langage qui permet de communiquer avec le SGBD.
- Une requête est une instruction écrite en SQL : elle demande au SGBD de lire ou de modifier des données.
- Ici, SELECT * FROM produits demande d’afficher tous les produits de notre catalogue (la table produits).
- INTEGER est le type de donnée de la colonne id : un nombre entier.
- Chaque colonne a son type : TEXT pour un prénom ou un e-mail, REAL pour un prix à virgule, comme 29,90 €.
- Pour finir, voici les trois idées à retenir.
- Ajoute ce résumé à tes notes pour le retrouver facilement.

**30 bulles « Touche le mail pour l’ouvrir » sans voix, dans 15 cours** (1107 caractères), dans la voix de chaque cours. Il faut d’abord corriger `preparer.mjs`, qui ne lit pas les mails construits avec `msgOpen` ou `.map`.

| cours | bulle | texte |
|---|---|---|
| projet-concurrence | touche1 | Touche le mail ou message pour l’ouvrir. |
| projet-delete | touche1 | Touche le mail ou message pour l’ouvrir. |
| projet-delete | touche2 | Touche le mail ou message pour l’ouvrir. |
| projet-delete | touche3 | Touche le mail ou message pour l’ouvrir. |
| projet-droits | touche1 | Touche le mail ou message pour l’ouvrir. |
| projet-droits | touche3 | Touche le mail ou message pour l’ouvrir. |
| projet-droits | touche5 | Touche le mail ou message pour l’ouvrir. |
| projet-drop | touche1 | Touche le mail pour l’ouvrir. |
| projet-index | touche1 | Touche le mail ou message pour l’ouvrir. |
| projet-insert | touche1 | Touche le mail pour l’ouvrir. |
| projet-insert | touche2 | Touche le mail pour l’ouvrir. |
| projet-insert | touche3 | Touche le mail pour l’ouvrir. |
| projet-merge | touche1 | Touche le mail ou message pour l’ouvrir. |
| projet-ondelete | touche1 | Touche le mail ou message pour l’ouvrir. |
| projet-procedures | touche1 | Touche le mail ou message pour l’ouvrir. |
| projet-procedures | touche2 | Touche le mail ou message pour l’ouvrir. |
| projet-savepoint | touche1 | Touche le mail ou message pour l’ouvrir. |
| projet-savepoint | touche2 | Touche le mail ou message pour l’ouvrir. |
| projet-savepoint | touche5 | Touche le mail ou message pour l’ouvrir. |
| projet-savepoint | touche6 | Touche la photo pour l’agrandir. |
| projet-schemas | touche1 | Touche le mail ou message pour l’ouvrir. |
| projet-transaction | touche1 | Touche le mail ou message pour l’ouvrir. |
| projet-transaction | touche2 | Touche la photo pour l’agrandir. |
| projet-transaction | touche3 | Touche le mail ou message pour l’ouvrir. |
| projet-trigger | touche1 | Touche le mail ou message pour l’ouvrir. |
| projet-update | touche1 | Touche le mail pour l’ouvrir. |
| projet-update | touche2 | Touche le mail pour l’ouvrir. |
| projet-update | touche3 | Touche le mail pour l’ouvrir. |
| projet-vue | touche1 | Touche le mail ou message pour l’ouvrir. |
| projet-vue | touche4 | Touche le mail ou message pour l’ouvrir. |

## 2. Les mots anglais mal dits : les fichiers qui changent

On change la graphie dans `MOTS_CLES` (ou `DIRE`) de `preparer.mjs`, puis on régénère seulement les fichiers dont le texte change.

| mot | correction | fichiers | caractères | voix |
|---|---|---:|---:|---|
| AND | ènde → ènd | 19 | 5644 | Agathe, Mia, Perle |
| LEFT / RIGHT | lèfte → lèft, raïte → raït | 15 | 3746 | Perle |
| ROW / ROWS | raô → rô, raôze → rôze | 6 | 1780 | Dorian |
| CREATE | criéïte → kriéït | 13 | 8244 | Abraham, Agathe, Anaïs, Anna, Emily, Mia, Sam |
| LENGTH | lènnguethe → length | 1 | 375 | Adam |
| HAVING | hèvinngue → having | 13 | 2930 | Antoine |
| COUNT(*) | (*) → « étoile » | 22 | 5965 | Antoine, Dorian, Mia, Perle |
| SELECT (Mia) | SELECT → silècte, cours de Mia | 19 | 6782 | Mia |
| INTEGER | inntédjeur → integer | 4 | 1212 | Adam |
| UNIQUE | UNIQUE → iounique | 2 | 2444 | Agathe |
| EXISTS (facultatif) | ègzisste → ègzists | 9 | 2971 | Anaïs, Mia |
| NULL (à décider) | NULL → neul | 46 | 14796 | Adam, Agathe, Anaïs, Antoine, Dorian, Emily, Koraly, Mia, Perle |

**Sans les deux lignes facultatives (EXISTS, NULL), 106 fichiers à régénérer, 35160 caractères** (un fichier qui contient plusieurs mots n’est compté qu’une fois).

À écouter avant de décider : EXPLAIN, REVOKE et VIEW (peut-être dits à la française).

<details><summary>Le détail, cours par cours</summary>

- **and-or** : at2 (AND) ; ch00 (AND) ; ch02 (AND) ; ch03 (AND) ; ch04 (AND) ; ch05 (AND) ; indice3 (AND)
- **between** : ch02 (AND) ; ch03 (AND)
- **comparer** : lienapres (AND)
- **conversion-types** : at1 (INTEGER) ; ch03 (INTEGER) ; ch05 (INTEGER) ; ch06 (INTEGER)
- **count** : at1 (COUNT(*)) ; at3 (COUNT(*)) ; ch03 (COUNT(*)) ; ch05 (COUNT(*))
- **exists** : ch03 (SELECT (Mia)) ; ch04 (AND)
- **fenetres-glissantes** : ch05 (ROW / ROWS)
- **first-last-ntile** : ch04 (ROW / ROWS)
- **fonctions-rang** : at2 (ROW / ROWS) ; ch03 (ROW / ROWS) ; ch05 (ROW / ROWS) ; ch06 (ROW / ROWS)
- **fonctions-texte** : ch05 (LENGTH)
- **full-outer-join** : at1 (LEFT / RIGHT) ; ch02 (LEFT / RIGHT) ; lienavant (LEFT / RIGHT)
- **group-by** : at1 (COUNT(*)) ; ch02 (COUNT(*)) ; ch03 (COUNT(*)) ; ch05 (COUNT(*))
- **group-by-colonnes** : ch03 (COUNT(*)) ; lienapres (HAVING)
- **group-concat** : ch02 (COUNT(*))
- **having** : at1 (HAVING, COUNT(*)) ; at2 (HAVING) ; at3 (COUNT(*)) ; ch00 (HAVING) ; ch02 (COUNT(*)) ; ch03 (HAVING, COUNT(*)) ; ch04 (HAVING) ; ch05 (HAVING, COUNT(*))
- **in** : ch05 (AND)
- **inner-join** : lienapres (LEFT / RIGHT)
- **insert-select** : at2 (SELECT (Mia)) ; ch02 (CREATE, SELECT (Mia)) ; ch03 (SELECT (Mia)) ; ch04 (SELECT (Mia))
- **join-group-by** : at2 (COUNT(*))
- **left-join** : at1 (LEFT / RIGHT) ; at3 (LEFT / RIGHT) ; ch03 (LEFT / RIGHT) ; ch05 (LEFT / RIGHT) ; lienapres (LEFT / RIGHT)
- **not** : lienavant (AND)
- **ordre-execution** : at2 (HAVING, COUNT(*)) ; at3 (HAVING) ; ch02 (HAVING) ; ch03 (HAVING) ; ch04 (HAVING, COUNT(*)) ; lienavant (HAVING)
- **over** : ch02 (COUNT(*))
- **plusieurs-conditions-on** : at3 (AND) ; ch03 (AND) ; ch04 (AND) ; ch05 (AND)
- **projet-alter** : ch01 (CREATE) ; ch02 (CREATE)
- **projet-cles** : ch06 (UNIQUE)
- **projet-create** : ch01 (CREATE) ; ch02 (CREATE)
- **projet-droits** : ch03 (CREATE)
- **projet-index** : ch04 (CREATE)
- **projet-procedures** : ch07 (CREATE)
- **projet-schemas** : ch03 (CREATE)
- **projet-trigger** : ch03 (CREATE)
- **projet-uml** : ch05 (CREATE, UNIQUE)
- **projet-update** : ch06 (CREATE)
- **projet-vue** : ch03 (CREATE)
- **quel-join-choisir** : ch02 (LEFT / RIGHT) ; ch03 (LEFT / RIGHT)
- **right-join** : at1 (LEFT / RIGHT) ; ch03 (LEFT / RIGHT) ; ch05 (LEFT / RIGHT) ; lienavant (LEFT / RIGHT)
- **self-join** : ch03 (AND) ; ch04 (AND)
- **sous-requete-from** : at1 (SELECT (Mia)) ; ch05 (SELECT (Mia)) ; lienavant (SELECT (Mia))
- **sous-requete-in** : lienapres (SELECT (Mia))
- **sous-requete-select** : ch03 (SELECT (Mia))
- **union** : at1 (SELECT (Mia)) ; ch02 (COUNT(*)) ; ch03 (SELECT (Mia)) ; ch04 (COUNT(*), SELECT (Mia)) ; ch06 (SELECT (Mia))
- **with-cte** : at3 (SELECT (Mia)) ; ch03 (COUNT(*)) ; ch04 (SELECT (Mia)) ; ch05 (SELECT (Mia)) ; ch06 (SELECT (Mia))
- **with-recursive** : ch03 (SELECT (Mia))

</details>

## Total

Environ **39066 caractères** à générer (voix manquantes + mots anglais, sans EXISTS ni NULL). Sur ElevenLabs, un caractère coûte en général un crédit (selon le modèle et l’abonnement).

