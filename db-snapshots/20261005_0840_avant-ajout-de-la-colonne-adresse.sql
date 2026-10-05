
PRAGMA foreign_keys = ON;
/* Schema pedagogique : clients, produits, commandes, et fidelite
   (une fiche de points par client : relation 1-1, lecon relations 1-1, 1-N et N-N). */
CREATE TABLE clients (
  id INTEGER PRIMARY KEY,
  prenom TEXT NOT NULL,
  nom TEXT,
  ville TEXT,
  age INTEGER CHECK (age >= 0),
  email TEXT UNIQUE,
  telephone TEXT,
  date_inscription TEXT
);
CREATE TABLE produits (
  id INTEGER PRIMARY KEY,
  nom TEXT NOT NULL,
  categorie TEXT,
  prix REAL,
  stock INTEGER CHECK (stock >= 0)
);
CREATE TABLE commandes (
  id INTEGER PRIMARY KEY,
  numero_commande TEXT,
  client_id INTEGER,
  produit_id INTEGER NOT NULL,
  quantite INTEGER NOT NULL CHECK (quantite > 0),
  date_commande TEXT,
  statut TEXT NOT NULL DEFAULT 'en_preparation',
  FOREIGN KEY (client_id)
    REFERENCES clients(id),
  FOREIGN KEY (produit_id)
    REFERENCES produits(id)
);
INSERT INTO clients VALUES
 (1,'Sophie','Martin','Paris',34,'sophie@mail.fr','06 39 98 12 04','2023-01-15'),
 (2,'Lucas','Bernard','Lyon',28,'lucas@mail.fr','06 39 98 21 47','2023-03-22'),
 (3,'Emma','Dubois','Marseille',45,'emma@mail.fr','06 39 98 33 08','2022-11-05'),
 (4,'Nathan','Petit','Paris',31,'nathan@mail.fr','06 39 98 40 15','2023-06-10'),
 (5,'Chloé','Moreau','Bordeaux',26,'chloe@mail.fr','06 39 98 51 62','2023-02-18'),
 (6,'Hugo','Laurent','Lyon',52,NULL,'06 39 98 68 03','2022-09-30'),
 (7,'Léa','Simon','Paris',38,'lea@mail.fr','06 39 98 74 29','2023-05-12'),
 (8,'Gabriel','Michel','Toulouse',29,'gabriel@mail.fr','06 39 98 85 16','2023-04-08'),
 (9,'Inès','Lefebvre','Nantes',41,NULL,'06 39 98 97 50','2023-07-26'),
 (10,'Nathan','Dupont','Paris',30,'nathan.dupont@mail.fr','06 39 98 10 26','2023-08-03');
INSERT INTO produits VALUES
 (1,'Fibre Prébiotique','Bien-être',29.90,120),(2,'Collagène Marin','Beauté',39.90,80),
 (3,'Magnésium','Bien-être',19.90,200),(4,'Vitamine D','Nutrition',14.90,150),
 (5,'Tisane Détox','Boisson',12.50,60),(6,'Protéine Végétale','Nutrition',34.90,45),
 (7,'Oméga 3','Bien-être',24.90,90),(8,'Shaker Inox','Accessoire',15.00,30);
INSERT INTO commandes VALUES
 (1,'CMD-2026-1002481',1,1,2,'2026-07-02','expédiée'),(2,'CMD-2026-1003912',1,3,1,'2026-07-02','expédiée'),(3,'CMD-2026-1015630',2,6,1,'2026-07-05','expédiée'),
 (4,'CMD-2026-1024057',3,2,3,'2026-07-08','expédiée'),(5,'CMD-2026-1038264',4,1,1,'2026-07-11','expédiée'),(6,'CMD-2026-1041739',5,4,2,'2026-07-12','expédiée'),
 (7,'CMD-2026-1056182',6,7,1,'2026-07-15','expédiée'),(8,'CMD-2026-1063405',7,1,4,'2026-07-18','expédiée'),(9,'CMD-2026-1067918',7,5,2,'2026-07-18','expédiée'),
 (10,'CMD-2026-1072346',2,3,2,'2026-07-20','expédiée'),(11,'CMD-2026-1085073',8,6,1,'2026-07-22','expédiée'),(12,'CMD-2026-1093528',4,2,1,'2026-07-25','en_preparation'),
 (13,'CMD-2026-1106294',1,8,1,'2026-07-28','en_preparation'),(14,'CMD-2026-1847392',3,7,2,'2026-07-30','en_preparation'),(15,'CMD-2026-1128760',5,1,3,'2026-08-01','en_preparation'),
 (16,'CMD-2026-1134085',NULL,4,1,'2026-08-03','en_preparation');
CREATE TABLE fidelite (
  id INTEGER PRIMARY KEY,
  client_id INTEGER UNIQUE,
  points INTEGER,
  FOREIGN KEY (client_id)
    REFERENCES clients(id)
);
INSERT INTO fidelite VALUES
 (1,1,120),
 (2,2,80),
 (3,4,250),
 (4,7,160);
