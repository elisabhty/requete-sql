/* Elisa, 1er novembre, 9 h 53 : six bases de plus (Hôpital, Wok, Zoo, Fromagerie, Laboratoire de recherche, Agence de voyages),
   « intègre les bases et corrige ce qu’il y a à corriger ». Chaque base se charge dans sql.js, sans clé étrangère orpheline ;
   chaque remarque de son fichier est vraie dans les données ; les incohérences relevées sont corrigées ; elles s’explorent dans
   la Console, parmi les « Bases d’entraînement ». */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({ locateFile: f => path.join(root, 'vendor/sqljs', f) });
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const entree = id => cut(`\n  ${id}:{nom:'`, '\n`}');
const base = id => { const e = entree(id); const d = new SQL.Database(); d.run('PRAGMA foreign_keys = ON'); d.run(e.slice(e.indexOf('sql:`') + 5)); return d; };
const val = (d, q) => { const r = d.exec(q); return r[0] ? r[0].values[0][0] : null; };

const CHECKS = {
 "hopital": [
  [
   "médecin d'une hospitalisation dans le service",
   "SELECT COUNT(*) FROM hospitalisations h JOIN medecins m ON m.id=h.medecin_id WHERE m.service_id<>h.service_id",
   0
  ],
  [
   "pédiatres : seulement des enfants",
   "SELECT COUNT(*) FROM consultations c JOIN medecins m ON m.id=c.medecin_id JOIN patients p ON p.id=c.patient_id WHERE m.specialite='Pédiatre' AND p.date_naissance<'2008-01-01'",
   0
  ],
  [
   "pédiatrie : seulement des enfants",
   "SELECT COUNT(*) FROM hospitalisations h JOIN patients p ON p.id=h.patient_id WHERE h.service_id=2 AND p.date_naissance<'2008-01-01'",
   0
  ],
  [
   "consultation après l'admission",
   "SELECT COUNT(*) FROM consultations c JOIN patients p ON p.id=c.patient_id WHERE c.date_consultation<p.date_admission",
   0
  ],
  [
   "hospitalisation après l'admission",
   "SELECT COUNT(*) FROM hospitalisations h JOIN patients p ON p.id=h.patient_id WHERE h.date_debut<p.date_admission",
   0
  ],
  [
   "sortie après l'entrée",
   "SELECT COUNT(*) FROM hospitalisations WHERE date_fin<date_debut",
   0
  ],
  [
   "un lit occupé par un seul patient à la fois",
   "SELECT COUNT(*) FROM hospitalisations a JOIN hospitalisations b ON a.lit=b.lit AND a.id<b.id AND a.date_debut<=COALESCE(b.date_fin,'9999') AND b.date_debut<=COALESCE(a.date_fin,'9999')",
   0
  ],
  [
   "un patient hospitalisé une fois à la fois",
   "SELECT COUNT(*) FROM hospitalisations a JOIN hospitalisations b ON a.patient_id=b.patient_id AND a.id<b.id AND a.date_debut<=COALESCE(b.date_fin,'9999') AND b.date_debut<=COALESCE(a.date_fin,'9999')",
   0
  ],
  [
   "patients sans consultation : 39 et 40",
   "SELECT group_concat(id) FROM (SELECT p.id FROM patients p LEFT JOIN consultations c ON c.patient_id=p.id WHERE c.id IS NULL ORDER BY 1)",
   "39,40"
  ],
  [
   "médecin sans consultation : 14",
   "SELECT group_concat(id) FROM (SELECT m.id FROM medecins m LEFT JOIN consultations c ON c.medecin_id=m.id WHERE c.id IS NULL)",
   "14"
  ],
  [
   "sans diagnostic : 3, 8, 13, 20, 28, 33, 38",
   "SELECT group_concat(id) FROM (SELECT id FROM consultations WHERE diagnostic IS NULL ORDER BY 1)",
   "3,8,13,20,28,33,38"
  ],
  [
   "hospitalisations en cours",
   "SELECT group_concat(id) FROM (SELECT id FROM hospitalisations WHERE date_fin IS NULL ORDER BY 1)",
   "7,8,11,14,15,16,17,19,21,22,23,24,25,26,27,28,29"
  ],
  [
   "services saturés : Neurologie et Oncologie",
   "SELECT group_concat(id) FROM (SELECT s.id FROM services s JOIN hospitalisations h ON h.service_id=s.id AND h.date_fin IS NULL GROUP BY s.id HAVING COUNT(*)>=s.capacite_lits ORDER BY 1)",
   "4,5"
  ],
  [
   "jamais plus de patients que de lits",
   "SELECT COUNT(*) FROM (SELECT s.id FROM services s JOIN hospitalisations h ON h.service_id=s.id AND h.date_fin IS NULL GROUP BY s.id HAVING COUNT(*)>s.capacite_lits)",
   0
  ],
  [
   "numéro de lit dans la capacité du service",
   "SELECT COUNT(*) FROM hospitalisations h JOIN services s ON s.id=h.service_id WHERE CAST(substr(h.lit, -2) AS INTEGER)>s.capacite_lits",
   0
  ],
  [
   "hospitalisation après une consultation dans le service",
   "SELECT COUNT(*) FROM hospitalisations h WHERE NOT EXISTS (SELECT 1 FROM consultations c JOIN medecins m ON m.id=c.medecin_id WHERE c.patient_id=h.patient_id AND c.date_consultation<=h.date_debut)",
   0
  ],
  [
   "patients vus plusieurs fois",
   "SELECT group_concat(patient_id) FROM (SELECT patient_id FROM consultations GROUP BY 1 HAVING COUNT(*)>1 ORDER BY 1)",
   "1,2,3,4,5,7,9,11"
  ],
  [
   "durée de prescription en nombre",
   "SELECT COUNT(*) FROM prescriptions WHERE typeof(duree_jours)<>'integer'",
   0
  ]
 ],
 "wok": [
  [
   "commande après l'inscription",
   "SELECT COUNT(*) FROM commandes c JOIN clients k ON k.id=c.client_id WHERE c.date_commande<k.date_inscription",
   0
  ],
  [
   "commande après l'embauche du serveur",
   "SELECT COUNT(*) FROM commandes c JOIN serveurs s ON s.id=c.serveur_id WHERE c.date_commande<s.date_embauche",
   0
  ],
  [
   "Camille a commandé pendant trois mois",
   "SELECT COUNT(DISTINCT strftime('%m',date_commande)) FROM commandes WHERE client_id=1",
   3
  ],
  [
   "Camille a commandé le même plat dans trois commandes distinctes",
   "SELECT COUNT(*) FROM (SELECT c.id FROM commandes c JOIN lignes_commande l ON l.commande_id=c.id WHERE c.client_id=1 AND l.plat_id=5 GROUP BY c.id)",
   3
  ],
  [
   "pas plus de convives que de places",
   "SELECT COUNT(*) FROM commandes c JOIN tables_resto t ON t.id=c.table_id WHERE c.nb_personnes>t.nb_places",
   0
  ],
  [
   "une table par service",
   "SELECT COUNT(*) FROM commandes a JOIN commandes b ON a.table_id=b.table_id AND a.date_commande=b.date_commande AND a.id<b.id AND (a.heure_commande<'16:00')=(b.heure_commande<'16:00')",
   0
  ],
  [
   "prix de la ligne = prix du plat",
   "SELECT COUNT(*) FROM lignes_commande l JOIN plats p ON p.id=l.plat_id WHERE l.prix_unitaire<>p.prix",
   0
  ],
  [
   "menu midi le midi, menu soir le soir",
   "SELECT COUNT(*) FROM lignes_commande l JOIN commandes c ON c.id=l.commande_id WHERE (l.plat_id=18 AND c.heure_commande>='16:00') OR (l.plat_id=19 AND c.heure_commande<'16:00')",
   0
  ],
  [
   "plat commandé disponible",
   "SELECT COUNT(*) FROM lignes_commande l JOIN plats p ON p.id=l.plat_id WHERE p.disponible=0",
   0
  ],
  [
   "avis du client de la commande",
   "SELECT COUNT(*) FROM avis a JOIN commandes c ON c.id=a.commande_id WHERE c.client_id IS NOT a.client_id",
   0
  ],
  [
   "avis sur une commande payée",
   "SELECT COUNT(*) FROM avis a JOIN commandes c ON c.id=a.commande_id WHERE c.statut<>'Payée'",
   0
  ],
  [
   "clients sans commande : 28, 29, 30",
   "SELECT group_concat(id) FROM (SELECT k.id FROM clients k LEFT JOIN commandes c ON c.client_id=k.id WHERE c.id IS NULL ORDER BY 1)",
   "28,29,30"
  ],
  [
   "serveur sans commande : 8",
   "SELECT group_concat(id) FROM (SELECT s.id FROM serveurs s LEFT JOIN commandes c ON c.serveur_id=s.id WHERE c.id IS NULL)",
   "8"
  ],
  [
   "plat indisponible : 11",
   "SELECT group_concat(id) FROM plats WHERE disponible=0",
   "11"
  ],
  [
   "ingrédient sous le seuil : 15",
   "SELECT group_concat(id) FROM ingredients WHERE stock<seuil_alerte",
   "15"
  ],
  [
   "commandes sans client : 8, 22, 39",
   "SELECT group_concat(id) FROM (SELECT id FROM commandes WHERE client_id IS NULL ORDER BY 1)",
   "8,22,39"
  ],
  [
   "avis sans commentaire : 3, 7, 13, 16",
   "SELECT group_concat(id) FROM (SELECT id FROM avis WHERE commentaire IS NULL ORDER BY 1)",
   "3,7,13,16"
  ]
 ],
 "zoo": [
  [
   "pas plus d'animaux que la capacité",
   "SELECT COUNT(*) FROM (SELECT e.id FROM enclos e JOIN animaux a ON a.enclos_id=e.id GROUP BY e.id HAVING COUNT(*)>e.capacite)",
   0
  ],
  [
   "pas de proie avec un carnivore (mammifères)",
   "SELECT COUNT(*) FROM animaux a JOIN especes s ON s.id=a.espece_id JOIN animaux b ON b.enclos_id=a.enclos_id JOIN especes t ON t.id=b.espece_id WHERE s.regime='Carnivore' AND s.classe='Mammifère' AND t.regime='Herbivore' AND t.classe='Mammifère'",
   0
  ],
  [
   "arrivé après sa naissance",
   "SELECT COUNT(*) FROM animaux WHERE date_arrivee<date_naissance",
   0
  ],
  [
   "repas par un soigneur en poste dans l'enclos",
   "SELECT COUNT(*) FROM repas r JOIN animaux a ON a.id=r.animal_id WHERE r.soigneur_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM affectations_soigneurs f WHERE f.soigneur_id=r.soigneur_id AND f.enclos_id=a.enclos_id AND f.date_debut<=r.date_repas AND (f.date_fin IS NULL OR f.date_fin>=r.date_repas))",
   0
  ],
  [
   "type de repas selon l'heure",
   "SELECT COUNT(*) FROM repas WHERE type_repas <> CASE WHEN heure_repas<'11:00' THEN 'Matin' WHEN heure_repas<'16:00' THEN 'Midi' ELSE 'Soir' END",
   0
  ],
  [
   "affectation après l'embauche",
   "SELECT COUNT(*) FROM affectations_soigneurs f JOIN soigneurs s ON s.id=f.soigneur_id WHERE f.date_debut<s.date_embauche",
   0
  ],
  [
   "billet après l'inscription",
   "SELECT COUNT(*) FROM billets b JOIN visiteurs v ON v.id=b.visiteur_id WHERE b.date_visite<v.date_inscription",
   0
  ],
  [
   "même prix pour un même type de billet",
   "SELECT COUNT(*) FROM (SELECT type_billet FROM billets GROUP BY 1 HAVING COUNT(DISTINCT prix)>1)",
   0
  ],
  [
   "avis après une visite",
   "SELECT COUNT(*) FROM avis a WHERE NOT EXISTS (SELECT 1 FROM billets b WHERE b.visiteur_id=a.visiteur_id AND b.date_visite<=a.date_avis)",
   0
  ],
  [
   "animaux non pesés : 33, 34",
   "SELECT group_concat(id) FROM (SELECT id FROM animaux WHERE poids_kg IS NULL ORDER BY 1)",
   "33,34"
  ],
  [
   "soigneur sans affectation : 8",
   "SELECT group_concat(id) FROM (SELECT s.id FROM soigneurs s LEFT JOIN affectations_soigneurs f ON f.soigneur_id=s.id WHERE f.id IS NULL)",
   "8"
  ],
  [
   "repas automatiques : 39, 40",
   "SELECT group_concat(id) FROM (SELECT id FROM repas WHERE soigneur_id IS NULL ORDER BY 1)",
   "39,40"
  ],
  [
   "visiteurs sans billet : 28, 29, 30",
   "SELECT group_concat(id) FROM (SELECT v.id FROM visiteurs v LEFT JOIN billets b ON b.visiteur_id=v.id WHERE b.id IS NULL ORDER BY 1)",
   "28,29,30"
  ],
  [
   "billets anonymes : 28, 29, 41",
   "SELECT group_concat(id) FROM (SELECT id FROM billets WHERE visiteur_id IS NULL ORDER BY 1)",
   "28,29,41"
  ],
  [
   "enclos vide : le bassin des reptiles",
   "SELECT group_concat(id) FROM (SELECT e.id FROM enclos e LEFT JOIN animaux a ON a.enclos_id=e.id WHERE a.id IS NULL)",
   "4"
  ]
 ],
 "fromagerie": [
  [
   "fin d'affinage = début + durée",
   "SELECT COUNT(*) FROM affinages WHERE date_fin IS NOT NULL AND date_fin<>date(date_debut, '+' || duree_jours || ' days')",
   0
  ],
  [
   "affinage en cours pas encore écoulé (au 31/10/2024)",
   "SELECT COUNT(*) FROM affinages WHERE date_fin IS NULL AND date(date_debut, '+' || duree_jours || ' days')<='2024-10-31'",
   0
  ],
  [
   "lot vendu une fois affiné",
   "SELECT COUNT(*) FROM ventes v JOIN lots l ON l.id=v.lot_id JOIN affinages a ON a.id=l.affinage_id WHERE a.date_fin IS NULL OR v.date_vente<a.date_fin",
   0
  ],
  [
   "lot du fromage de son affinage",
   "SELECT COUNT(*) FROM lots l JOIN affinages a ON a.id=l.affinage_id WHERE a.fromage_id<>l.fromage_id",
   0
  ],
  [
   "lot produit au début de son affinage",
   "SELECT COUNT(*) FROM lots l JOIN affinages a ON a.id=l.affinage_id WHERE l.date_production<>a.date_debut",
   0
  ],
  [
   "numéro de lot daté comme le lot",
   "SELECT COUNT(*) FROM lots WHERE substr(numero_lot, 5, 6)<>substr(strftime('%Y%m%d', date_production), 3)",
   0
  ],
  [
   "vente après la production",
   "SELECT COUNT(*) FROM ventes v JOIN lots l ON l.id=v.lot_id WHERE v.date_vente<l.date_production",
   0
  ],
  [
   "prix = quantité × prix au kilo",
   "SELECT COUNT(*) FROM ventes v JOIN lots l ON l.id=v.lot_id JOIN fromages f ON f.id=l.fromage_id WHERE ABS(v.prix_total - v.quantite_kg*f.prix_kg)>0.005",
   0
  ],
  [
   "pas plus vendu que le poids du lot",
   "SELECT COUNT(*) FROM (SELECT l.id FROM lots l JOIN ventes v ON v.lot_id=l.id GROUP BY l.id HAVING SUM(v.quantite_kg)>l.poids_kg)",
   0
  ],
  [
   "vente après l'inscription",
   "SELECT COUNT(*) FROM ventes v JOIN clients c ON c.id=v.client_id WHERE v.date_vente<c.date_inscription",
   0
  ],
  [
   "dégustation après l'inscription",
   "SELECT COUNT(*) FROM degustations d JOIN clients c ON c.id=d.client_id WHERE d.date_degustation<c.date_inscription",
   0
  ],
  [
   "numéros de lot uniques",
   "SELECT COUNT(*)-COUNT(DISTINCT numero_lot) FROM lots",
   0
  ],
  [
   "clients sans achat : 28, 29, 30",
   "SELECT group_concat(id) FROM (SELECT c.id FROM clients c LEFT JOIN ventes v ON v.client_id=c.id WHERE v.id IS NULL ORDER BY 1)",
   "28,29,30"
  ],
  [
   "fromage indisponible : 21",
   "SELECT group_concat(id) FROM fromages WHERE disponible=0",
   "21"
  ],
  [
   "affinages en cours : 19, 20",
   "SELECT group_concat(id) FROM (SELECT id FROM affinages WHERE date_fin IS NULL ORDER BY 1)",
   "19,20"
  ],
  [
   "lots sans affinage : 26, 27, 29, 30",
   "SELECT group_concat(id) FROM (SELECT id FROM lots WHERE affinage_id IS NULL ORDER BY 1)",
   "26,27,29,30"
  ],
  [
   "ventes anonymes : 28, 29",
   "SELECT group_concat(id) FROM (SELECT id FROM ventes WHERE client_id IS NULL ORDER BY 1)",
   "28,29"
  ],
  [
   "dégustations sans commentaire",
   "SELECT group_concat(id) FROM (SELECT id FROM degustations WHERE commentaire IS NULL ORDER BY 1)",
   "2,7,10,13,17"
  ]
 ],
 "labo": [
  [
   "grades d'une seule écriture",
   "SELECT group_concat(grade) FROM (SELECT DISTINCT grade FROM chercheurs ORDER BY 1)",
   "Chargé de recherche,Directeur,Doctorant,Post-doc"
  ],
  [
   "rôles d'une seule écriture",
   "SELECT group_concat(role) FROM (SELECT DISTINCT role FROM affectations_chercheurs ORDER BY 1)",
   "Chercheur,Doctorant,Post-doc,Responsable"
  ],
  [
   "chercheur dans l'équipe du projet",
   "SELECT COUNT(*) FROM experiences e JOIN projets p ON p.id=e.projet_id JOIN chercheurs c ON c.id=e.chercheur_id WHERE c.equipe_id<>p.equipe_id",
   0
  ],
  [
   "chercheur affecté au projet de son expérience",
   "SELECT COUNT(*) FROM experiences e WHERE NOT EXISTS (SELECT 1 FROM affectations_chercheurs a WHERE a.chercheur_id=e.chercheur_id AND a.projet_id=e.projet_id)",
   0
  ],
  [
   "expérience pendant le projet",
   "SELECT COUNT(*) FROM experiences e JOIN projets p ON p.id=e.projet_id WHERE e.date_experience<p.date_debut OR (p.date_fin IS NOT NULL AND e.date_experience>p.date_fin)",
   0
  ],
  [
   "affectation après l'embauche",
   "SELECT COUNT(*) FROM affectations_chercheurs a JOIN chercheurs c ON c.id=a.chercheur_id WHERE a.date_debut<c.date_embauche",
   0
  ],
  [
   "expérience après l'embauche",
   "SELECT COUNT(*) FROM experiences e JOIN chercheurs c ON c.id=e.chercheur_id WHERE e.date_experience<c.date_embauche",
   0
  ],
  [
   "planifiée = à venir, terminée = passée (jour J : 1er février 2025)",
   "SELECT COUNT(*) FROM experiences WHERE (statut='Planifiée' AND date_experience<='2025-02-01') OR (statut<>'Planifiée' AND date_experience>'2025-02-01')",
   0
  ],
  [
   "projet en cours sans date de fin, terminé avec",
   "SELECT COUNT(*) FROM projets WHERE (statut='En cours') <> (date_fin IS NULL)",
   0
  ],
  [
   "affectations d'un projet fini finies",
   "SELECT COUNT(*) FROM affectations_chercheurs a JOIN projets p ON p.id=a.projet_id WHERE p.statut<>'En cours' AND a.date_fin IS NULL",
   0
  ],
  [
   "résultat d'une expérience terminée obtenu et validé",
   "SELECT COUNT(*) FROM resultats r JOIN experiences e ON e.id=r.experience_id WHERE (e.statut='Terminée') <> (r.valeur IS NOT NULL AND r.valide=1)",
   0
  ],
  [
   "pas de résultat ni d'échantillon après la date de l'expérience planifiée",
   "SELECT COUNT(*) FROM resultats r JOIN experiences e ON e.id=r.experience_id WHERE e.statut='Planifiée'",
   0
  ],
  [
   "chercheur sans expérience ni affectation : 20",
   "SELECT group_concat(id) FROM (SELECT c.id FROM chercheurs c LEFT JOIN experiences e ON e.chercheur_id=c.id LEFT JOIN affectations_chercheurs a ON a.chercheur_id=c.id WHERE e.id IS NULL AND a.id IS NULL)",
   "20"
  ],
  [
   "projets en cours",
   "SELECT group_concat(id) FROM (SELECT id FROM projets WHERE date_fin IS NULL ORDER BY 1)",
   "2,4,5,6,8,10,12,13,15"
  ],
  [
   "résultats non obtenus",
   "SELECT group_concat(id) FROM (SELECT id FROM resultats WHERE valeur IS NULL ORDER BY 1)",
   "7,12,17,21,25,26,30,32"
  ],
  [
   "publications en préparation",
   "SELECT group_concat(id) FROM (SELECT id FROM publications WHERE date_publication IS NULL ORDER BY 1)",
   "5,10,12,14"
  ],
  [
   "expériences sans échantillon",
   "SELECT group_concat(id) FROM (SELECT e.id FROM experiences e LEFT JOIN echantillons s ON s.experience_id=e.id WHERE s.id IS NULL ORDER BY 1)",
   "8,14,20,25,26,32"
  ]
 ],
 "voyages": [
  [
   "payé = prix × personnes",
   "SELECT COUNT(*) FROM reservations r JOIN circuits c ON c.id=r.circuit_id WHERE (SELECT SUM(montant) FROM paiements p WHERE p.reservation_id=r.id) <> c.prix_base*r.nb_personnes",
   0
  ],
  [
   "paiement après la réservation",
   "SELECT COUNT(*) FROM paiements p JOIN reservations r ON r.id=p.reservation_id WHERE p.date_paiement<r.date_reservation",
   0
  ],
  [
   "réservation après l'inscription",
   "SELECT COUNT(*) FROM reservations r JOIN clients c ON c.id=r.client_id WHERE r.date_reservation<c.date_inscription",
   0
  ],
  [
   "statut du paiement = statut de la réservation",
   "SELECT COUNT(*) FROM paiements p JOIN reservations r ON r.id=p.reservation_id WHERE (r.statut='Confirmée' AND p.statut<>'Payé') OR (r.statut='Annulée' AND p.statut<>'Remboursé') OR (r.statut='En attente' AND p.statut<>'En attente')",
   0
  ],
  [
   "avis sur une réservation confirmée, après elle",
   "SELECT COUNT(*) FROM avis a WHERE NOT EXISTS (SELECT 1 FROM reservations r WHERE r.client_id=a.client_id AND r.circuit_id=a.circuit_id AND r.statut='Confirmée' AND r.date_reservation<=a.date_avis)",
   0
  ],
  [
   "un guide sur un circuit à la fois",
   "SELECT COUNT(*) FROM affectations_guides a JOIN affectations_guides b ON a.guide_id=b.guide_id AND a.id<b.id AND a.date_debut<=COALESCE(b.date_fin,'9999') AND b.date_debut<=COALESCE(a.date_fin,'9999')",
   0
  ],
  [
   "affectation après l'embauche",
   "SELECT COUNT(*) FROM affectations_guides a JOIN guides g ON g.id=a.guide_id WHERE a.date_debut<g.date_embauche",
   0
  ],
  [
   "durée de l'affectation = durée du circuit",
   "SELECT COUNT(*) FROM affectations_guides a JOIN circuits c ON c.id=a.circuit_id WHERE a.date_fin IS NOT NULL AND julianday(a.date_fin)-julianday(a.date_debut)<>c.duree_jours",
   0
  ],
  [
   "noms sans espace ni caractère étranger",
   "SELECT COUNT(*) FROM (SELECT nom FROM destinations UNION ALL SELECT nom FROM circuits) WHERE nom<>trim(nom) OR nom GLOB '*[^ -~À-ÿŒœ’]*'",
   0
  ],
  [
   "clients sans réservation : 28, 29, 30",
   "SELECT group_concat(id) FROM (SELECT c.id FROM clients c LEFT JOIN reservations r ON r.client_id=c.id WHERE r.id IS NULL ORDER BY 1)",
   "28,29,30"
  ],
  [
   "guide sans affectation : 8",
   "SELECT group_concat(id) FROM (SELECT g.id FROM guides g LEFT JOIN affectations_guides a ON a.guide_id=g.id WHERE a.id IS NULL)",
   "8"
  ],
  [
   "circuits sans réservation : 14, 18",
   "SELECT group_concat(id) FROM (SELECT c.id FROM circuits c LEFT JOIN reservations r ON r.circuit_id=c.id WHERE r.id IS NULL ORDER BY 1)",
   "14,18"
  ],
  [
   "affectations en cours : 24, 25",
   "SELECT group_concat(id) FROM (SELECT id FROM affectations_guides WHERE date_fin IS NULL ORDER BY 1)",
   "24,25"
  ],
  [
   "avis sans commentaire : 5, 14, 20",
   "SELECT group_concat(id) FROM (SELECT id FROM avis WHERE commentaire IS NULL ORDER BY 1)",
   "5,14,20"
  ],
  [
   "réservations annulées 26, 32 ; en attente 24, 29",
   "SELECT (SELECT group_concat(id) FROM reservations WHERE statut='Annulée')||' ; '||(SELECT group_concat(id) FROM reservations WHERE statut='En attente')",
   "26,32 ; 24,29"
  ],
  [
   "réservations payées en deux fois : 1, 3, 5, 7, 9",
   "SELECT group_concat(reservation_id) FROM (SELECT reservation_id FROM paiements GROUP BY 1 HAVING COUNT(*)>1 ORDER BY 1)",
   "1,3,5,7,9"
  ]
 ]
};
const NOMS = { hopital: 'Hôpital', wok: 'Wok Chinois', zoo: 'Zoo', fromagerie: 'Fromagerie', labo: 'Laboratoire de recherche', voyages: 'Agence de voyages' };
const VOLUMES = {
  hopital: { services: 6, medecins: 14, infirmiers: 10, patients: 40, consultations: 50, hospitalisations: 29, prescriptions: 60 },
  wok: { categories: 6, plats: 20, ingredients: 15, plats_ingredients: 30, clients: 30, serveurs: 8, tables_resto: 10, commandes: 42, lignes_commande: 74, avis: 20 },
  zoo: { especes: 15, enclos: 10, animaux: 35, soigneurs: 8, affectations_soigneurs: 14, repas: 40, visiteurs: 30, billets: 45, avis: 20 },
  fromagerie: { producteurs: 12, laits: 4, fromages: 25, affinages: 20, lots: 30, clients: 30, ventes: 55, degustations: 20 },
  labo: { equipes: 6, chercheurs: 20, projets: 15, experiences: 40, echantillons: 35, resultats: 45, publications: 15, affectations_chercheurs: 46 },
  voyages: { destinations: 12, guides: 10, circuits: 20, clients: 30, reservations: 45, paiements: 50, affectations_guides: 25, avis: 25 },
};

for (const id of Object.keys(NOMS)) {
  test(`${NOMS[id]} : les volumes, aucune clé étrangère orpheline, chaque table et colonne décrite`, () => {
    const e = entree(id);
    assert.ok(e.startsWith(`\n  ${id}:{nom:'${NOMS[id]}',`));
    const d = base(id);
    for (const [t, n] of Object.entries(VOLUMES[id])) assert.equal(val(d, `SELECT COUNT(*) FROM ${t}`), n, `${t}`);
    assert.equal(d.exec('PRAGMA foreign_key_check').length, 0);
    const m = e.match(/\n    tables:(\{[^\n]+\}),\n    cols:(\{[^\n]+\}),\n    desc:'([^']+)',/);
    assert.ok(m, 'tables, colonnes, description');
    const tables = JSON.parse(m[1]), cols = JSON.parse(m[2]);
    assert.ok(m[3].startsWith('Bienvenue dans ') && m[3].endsWith('Explore la base pour résoudre les différentes missions.'));
    const noms = d.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")[0].values.map(v => v[0]);
    assert.deepEqual(Object.keys(tables).sort(), noms);
    for (const t of noms) assert.deepEqual(Object.keys(cols[t]).sort(), d.exec(`PRAGMA table_info(${t})`)[0].values.map(v => v[1]).sort(), t);
    d.close();
  });
  test(`${NOMS[id]} : les remarques du fichier sont vraies, les incohérences corrigées`, () => {
    const d = base(id);
    for (const [nom, q, attendu] of CHECKS[id]) assert.equal(val(d, q), attendu, nom);
    d.close();
  });
}

test('quelques corrections, nommément', () => {
  const h = base('hopital');
  assert.equal(val(h, "SELECT COUNT(*) FROM consultations WHERE medecin_id IN (1, 2, 14) AND diagnostic = 'Angine'"), 0, 'pas d’angine chez le cardiologue');
  /* 10 h 10 : « je préfère des services saturés » */
  assert.equal(val(h, "SELECT group_concat(nom, ', ') FROM (SELECT s.nom FROM services s JOIN hospitalisations h ON h.service_id = s.id WHERE h.date_fin IS NULL GROUP BY s.id HAVING COUNT(*) >= s.capacite_lits ORDER BY s.id)"), 'Neurologie, Oncologie');
  h.close();
  const z = base('zoo');
  assert.equal(val(z, 'SELECT enclos_id FROM animaux WHERE id = 4'), 8, 'Dumbo chez les herbivores');
  assert.equal(val(z, 'SELECT nom FROM enclos WHERE id = 9'), 'Rivière africaine');
  z.close();
  const v = base('voyages');
  assert.equal(val(v, 'SELECT nom FROM circuits WHERE id = 7'), 'Tour de l’Islande'.replace('’', "'"));
  assert.equal(val(v, 'SELECT COUNT(*) FROM paiements WHERE montant = 0'), 0, 'plus de paiement à 0 €');
  v.close();
  const l = base('labo');
  assert.equal(val(l, "SELECT COUNT(*) FROM chercheurs WHERE grade LIKE '%e de recherche' OR grade = 'Doctorante'"), 0);
  l.close();
  assert.ok(!/[\u4e00-\u9fff]/.test(app), 'aucun caractère chinois dans l’appli');
});

test('la Console : sept bases d’entraînement en plus de celle du cours, construites à leur première ouverture', () => {
  assert.ok(app.includes("function isDemoDb(id){return id==='cours'||(typeof DEFI_BASES!=='undefined'&&Object.prototype.hasOwnProperty.call(DEFI_BASES,id));}"));
  assert.ok(app.includes("function activeDb(){ return activeDbId==='cours'?db:(customDbs[activeDbId]||demoDb(activeDbId)); }"));
  assert.ok(app.includes("function openConsoleProject(id){\n  if(id!=='cours'&&!customDbs[id]&&!demoDb(id))return;"));
  assert.ok(app.includes("const n=database?listTables(database).length:isDemoDb(id)?Object.keys(DEFI_BASES[id].tables||{}).length:0;"), 'le nombre de tables sans construire la base');
  assert.ok(app.includes('<div class="console-projects-head"><h2>Bases d’entraînement</h2><span>${plur(demos.length,\'base\')}</span></div>'));
  assert.ok(app.includes("wok:{nom:'Wok Chinois',"), 'la Console nomme la base comme un restaurant chinois');
  assert.ok(app.includes('Bienvenue dans un restaurant chinois spécialisé dans la cuisine au wok.'), 'description de la base Wok');
  assert.ok(app.includes("${mine.length?`<div class=\"console-projects-head\"><h2>Tes projets</h2>"), 'tes projets d’abord, s’il y en a');
  for (const id of Object.keys(NOMS)) assert.ok(new RegExp(`\\n  ${id}:'SELECT `).test(cut('const DEMO_SQL={', '\n};')), `requête de départ : ${id}`);
  assert.ok(app.includes("  if(isDemoDb(target)){toast(`La ${demoLabel(target).replace(/^Base/,'base')} est protégée`);return null;}"));
});
