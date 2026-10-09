# Catalogue documenté par GSL — 9 octobre 2026

## Contenu et statut

Le lot `gsl-research-2026-10-09` contient 50 entreprises, cinq par pays : Albanie,
Bosnie-Herzégovine, Égypte, Géorgie, Macédoine du Nord, Maroc, Moldavie, Serbie,
Tunisie et Turquie. Il comprend 78 fiches de produits ou de familles de produits,
réparties dans 16 spécialités industrielles. Les catégories générales existantes
continuent à regrouper les spécialités correspondantes.

Le fichier public de référence est `data/curated-catalogue-2026-10-09.json`.
`data/curated-catalogue-summary.json` contient les décomptes et son SHA-256.
`scripts/prepare-curated-catalogue.py` compile les dossiers de recherche ; il ne
contacte aucun fournisseur et ne modifie aucune base. Les coordonnées de contact
du dossier de prospection sont exclues du fichier public et de l'import.

Chaque fiche porte la mention « Fiche documentée par GSL ». Elle ne constitue
ni une inscription effectuée par le fabricant, ni un mandat commercial, ni une
attestation de conformité émise par GSL. Les accords commerciaux sont décrits
avec leurs conditions d'origine, leurs justificatifs et leurs limites ; aucun
droit nul ou marquage CE n'est déduit du seul pays de l'entreprise.

Les preuves de certification gardent leur nature et leur date : document consulté
(D), registre officiel consulté (R), déclaration du fabricant (F), preuve historique
ou expirée (H), preuve publique non trouvée (N). Une date future ne remplace pas
une vérification du statut auprès de l'émetteur. Une portée limitée à un site ou
à une activité ne s'étend pas à tout le groupe.

## Prix, volumes et délais

Les champs inconnus restent nuls. Les hypothèses de fabrication sur commande ne
remplacent pas les informations effectivement trouvées. Les sources et conditions
sont accessibles sur les fiches publiques.

Le jeu de données contient un seul produit avec une plage de prix et une unité
établies, Current 4 Click de MIKROE : quatre paliers en USD, un seuil de dix cartes
pour le prix minimal et une indisponibilité affichée à la date de recherche.
Trois produits ont un minimum de commande établi. Les prix Sakcable dont l'unité
n'est pas explicite figurent seulement dans la note documentaire. Aucun délai
de livraison ferme n'est inventé.

## Gestion des propriétaires

`/administration/catalogue` liste les entreprises et produits du lot, leur statut
de publication, les destinataires propriétaires et l'état de configuration email.
Les propriétaires peuvent modifier les informations et leurs sources, masquer
une fiche et la republier. Les commandes utilisent une révision attendue : une
modification concurrente nécessite de recharger la fiche.

Masquer une entreprise masque ses produits. La republication de l'entreprise
conserve les choix individuels de masquage des produits. L'historique des commandes
de gestion est conservé dans `private.curated_catalogue_events`.

Les RPC relisent le rôle actif, la confirmation du compte et AAL2. Une simple
déclaration de rôle dans les métadonnées Auth ne donne aucun droit. Le synchroniseur
attribue aux propriétaires GSL des adhésions administratives dont la provenance
est enregistrée ; il ne crée pas de compte fabricant. Une révocation ne retire
que ces adhésions gérées, jamais une adhésion indépendante préexistante.

## Import contrôlé

Ordre : migration `curated_catalogue_management`, puis `curated_owner_messaging`,
puis l'opération `supabase/operations/import-curated-catalogue.sql` dans une
transaction administrative PostgreSQL. Les versions exactes appliquées dans
l'environnement hébergé sont tenues par l'historique Supabase.

L'appelant charge depuis le client les paramètres transactionnels
`gsl.import_payload`, `gsl.import_digest` et `gsl.import_actor`. L'acteur est le vrai
propriétaire initiateur vérifié en base. La transaction renseigne uniquement
l'attribution nécessaire aux déclencheurs de création ; elle ne simule aucune
session de connexion ou preuve MFA. Le journal identifie l'opération comme
`server_import`.

Le lot vérifie ses identifiants, ses pays, les sources et les données commerciales.
Les projections publiques sont écrites après les données métier. Les identifiants
stables dérivent des identifiants documentaires et permettent de reconnaître un
nouvel essai. Rejouer le même lot terminé ne remplace jamais les modifications
ultérieures des propriétaires. Un digest différent impose un examen explicite.

## Messagerie et email

Les demandes visent l'équipe GSL qui gère la fiche. Les adresses des fabricants
ne sont ni utilisées comme destinataires ni publiées. Les demandes directes, les
échanges de devis et les contacts généraux produisent leurs événements dans la
transaction métier, avec dédoublonnage. Les destinataires sont les propriétaires
actifs admissibles, relus lors de la prise en charge d'un email.

L'activation SMTP nécessite les configurations serveur déjà prévues :
`SUPABASE_SERVICE_ROLE_KEY`, `GSL_WORKER_SECRET`, `GSL_SMTP_HOST`,
`GSL_SMTP_USER`, `GSL_SMTP_PASSWORD`, `GSL_EMAIL_FROM`, et éventuellement
`GSL_SMTP_PORT` (465 par défaut), en plus de la configuration Supabase publique et
de l'URL de production. `GSL_TRANSACTIONAL_EMAIL_ENABLED=true` active le transport
seulement quand cette configuration est complète et valide. Ne jamais ajouter
ces valeurs au dépôt ni aux variables préfixées `NEXT_PUBLIC_`.

`GET /api/internal/notifications`, protégé par le secret du worker, expose seulement
la présence et la validité de configuration. `POST` sur cette route traite la file.
Le planificateur doit appeler le traitement régulièrement avec une authentification
serveur, jamais un secret dans l'URL. La cadence et le volume doivent correspondre
au plan d'hébergement et au trafic ; deux messages par jour ne couvrent pas un flux
de demandes destiné à deux propriétaires.

Avant une activation réelle, vérifier l'expéditeur chez le prestataire et les
événements déjà en attente. Aucun ancien message n'est reconstitué automatiquement.
La remise au serveur SMTP ne prouve pas la réception en boîte mail. Une remise
possible suivie d'une interruption est signalée pour examen, sans renvoi aveugle.

## Vérification

Les scripts `test-curated-catalogue-postgres.mjs`,
`test-curated-messaging-postgres.mjs`, `test-messaging-api.mjs` et
`test-notifications-worker.mjs` utilisent des bases en mémoire, des utilisateurs
fictifs et des transports simulés. Ils refusent une URL de base externe. Les
vérifications du site de production sont séparées : lectures des fiches publiées,
décomptes, droits exposés et statut du déploiement. Aucun résultat d'un test simulé
n'est présenté comme une réception réelle d'email.
