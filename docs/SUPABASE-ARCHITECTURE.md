# GSL Systems — données et parcours d’inscription

Version du 25 septembre 2026. Le projet **GSL Systems** est créé à Paris, référence `ihugldueruspxdyooycc`, dans l’organisation confirmée `avpoyfvuowhznvimqvcp`. Le projet « south conciergerie » a été mis en pause pour libérer une place gratuite ; il n’a pas été supprimé. Ce document décrit la cible et distingue ci-dessous ce qui est installé de ce qui reste à intégrer. Le site utilise encore son stockage et son authentification actuels.

La base contient 26 tables publiques protégées par RLS, une table privée de contrôleurs, cinq fiches pays versionnées et le bucket privé `gsl-private`. Les scripts SQL sous `supabase/migrations` ont été appliqués au projet. Les contrôles de séparation des organisations, des brouillons, des offres concurrentes et des messages ainsi que la révocation d’un membre passent dans `supabase/tests/tenant-isolation.sql`. Les données de test sont annulées en fin de transaction. Aucun utilisateur ni entreprise fictive n’est conservé.

Les fiches pays sont également disponibles dans `lib/onboarding/country-requirements.ts`. Elles ne sont pas encore branchées aux écrans d’inscription. La complétude d’un formulaire ne valide ni le format national détaillé de chaque identifiant, ni l’existence de l’entreprise.

## Décisions

Un compte appartient à une personne ; une organisation représente une entité juridique. Une personne peut travailler pour plusieurs organisations. Une organisation peut acheter et fournir, sans créer deux identités légales. Le siège, les établissements de production et les adresses de livraison sont distincts.

L’inscription reste progressive : email confirmé → pays et forme juridique → identité et rôle acheteur/fournisseur → activité → justificatifs → revue → publication volontaire. Enregistrer un brouillon est possible avant que tous les champs soient remplis. La vérification doit être expliquée avant le dépôt de documents.

Les exigences de complétude sont une politique de référencement GSL, pas une affirmation que chaque document serait imposé par la loi. Une dérogation motivée ou un pays non couvert part en revue manuelle. La vérification du format d’un identifiant ne prouve jamais son authenticité.

## Modèle relationnel prévu

Toutes les clés métier sont des UUID. Dates en `timestamptz`, codes pays ISO, langues BCP 47, montants entiers en unité monétaire mineure avec devise. Les quantités, dimensions, tolérances et capacités ont une unité explicite. Les prix indicatifs ont des hypothèses et une date ; le sur-mesure reste « Sur devis après étude du plan » sans données réelles.

| Tables | Contenu et relations |
| --- | --- |
| `profiles` | Référence `auth.users`, nom affiché, langue, coordonnées privées, préférences de notification. Aucun rôle administratif issu des métadonnées modifiables par l’utilisateur. |
| `organizations` | Raison sociale originale, nom commercial, translittération facultative, pays d’immatriculation, forme juridique, date de création déclarée, site web, description, révision. |
| `organization_roles` | Acheteur et/ou fournisseur ; clé composée organisation + rôle. |
| `memberships`, `invitations` | Utilisateur + organisation uniques, rôle propriétaire/administrateur/achats/commercial/lecture, statut, invitation à durée limitée dont seul le hash est stocké. Empêcher le retrait du dernier propriétaire actif. |
| `country_requirement_versions` | Pays, version, exigences selon forme juridique, liens officiels et date de recherche. Version utilisée conservée lors de chaque soumission. |
| `organization_identifiers` | Type local, valeur originale, valeur normalisée, autorité/juridiction, pays, confidentialité. Pas d’unicité mondiale d’un simple numéro RC. Les doublons déclenchent une revue, pas une fusion automatique. |
| `addresses` | Organisation, type siège/facturation/livraison, lignes d’adresse locales, ville, région, code postal facultatif selon pays, pays. Un seul siège actif ; historique des modifications. |
| `production_sites` | Organisation, adresse, nom d’atelier, propriétaire/exploitant, effectif par tranche, surface avec unité, visibilité de l’adresse précise. Un site étranger ne change pas le pays juridique. |
| `organization_contacts` | Fonction, langue, email professionnel, téléphone, visibilité et consentement de publication. Le représentant habilité reste privé. |
| `supplier_profiles`, `buyer_profiles` | Fournisseur : fabricant/distributeur/sous-traitant, secteurs, langues, marchés servis. Acheteur : secteurs, familles d’achats, besoins récurrents, lieux de livraison. Pas de dépenses ou chiffre d’affaires inventés. |
| `capabilities`, `equipment` | Procédés, matériaux, machines et site de rattachement, dimensions/tolérances avec unités, capacité mesurée sur une période, MOQ, disponibilités déclarées. |
| `products`, `product_revisions` | Organisation, modèle/référence, catégorie, fiche technique, spécifications, quantités, photos, version. Un produit et une capacité de fabrication ont un type distinct. |
| `files`, `media_links` | Propriétaire, objet Storage, taille, type vérifié, checksum, analyse, auteur. Lien typé vers organisation/site/produit/dossier. Photo réelle fournie ou illustration explicitement étiquetée ; légende, droits, ordre et texte alternatif EN/FR. |
| `evidence_documents`, `evidence_scopes` | Nature : registre, système qualité, certificat produit, déclaration UE, rapport d’essai, autre. Émetteur, référence, dates, document original, révision. Périmètre explicite organisation/site/modèles de produits, jamais implicite à tout le catalogue. |
| `product_compliance_records` | Produit et révision, usage prévu, marchés visés, textes applicables, normes revendiquées, statut d’applicabilité CE, procédure et pièces justificatives. Une déclaration UE est distincte d’un certificat tiers. |
| `verification_cases`, `verification_events` | Objet + révision contrôlée, contrôleur, méthode, registre ou émetteur consulté, date, résultat et motif, pièces manquantes, prochaine revue. Événements non modifiables par le fournisseur. |
| `published_supplier_profiles`, `published_products` | Projections minimales approuvées pour le catalogue : jamais une publication automatique de toute la ligne privée. Révision publiée référencée ; retrait immédiat si une information critique est invalidée. |
| `rfqs`, `rfq_items`, `rfq_recipients` | Organisation acheteuse, mode autonome/accompagné, produits et fournisseurs sélectionnés, pièces techniques, quantités/unités, destination, échéance. Envoi explicite à une liste de fournisseurs ; un brouillon n’est pas partagé. |
| `threads`, `messages`, `message_files` | Une conversation privée par couple demande/fournisseur. Auteur et organisation vérifiés à chaque envoi. Un fournisseur ne voit ni ses concurrents ni leurs offres. |
| `offers`, `offer_versions`, `offer_lines` | Réponses chiffrées, devise, quantités, conditions, validité, délais avec hypothèses, transport, Incoterm et lieu convenu. Historique immuable des versions envoyées. |
| `declared_orders`, `order_events` | Commande déclarée liée à une version d’offre, référence et justificatifs. Ne pas la présenter comme un paiement ou une livraison vérifiés. |
| `commission_agreements`, `commission_records` | Accord accepté et versionné avant facturation, assiette/taux/devise/partie redevable, événement déclencheur et avoirs. Aucun taux ni encaissement automatique sans décision commerciale. |
| `notification_outbox`, `audit_events` | Événements transactionnels, idempotence, état d’envoi/retry, historique des actions sensibles. Ne pas copier mots de passe ou documents complets dans les logs. |

Contraintes de cohérence : les relations site/produit/document comportent aussi l’identifiant d’organisation et des clés étrangères composées pour interdire le rattachement à un autre fournisseur. Les permissions ne reposent jamais seulement sur la présence d’un UUID. Les offres doivent appartenir à un destinataire effectif de la demande. Les transactions d’envoi sont atomiques et idempotentes.

## Formulaires par pays

Les champs communs sont la raison sociale dans son alphabet d’origine, la forme juridique, le siège, l’activité et les coordonnées professionnelles. Les données locales sont privées par défaut. Le nom commercial public peut être différent de la raison sociale.

| Pays | Champs de revue pour les sociétés | Vérification prévue |
| --- | --- | --- |
| Turquie | MERSİS, numéro et bureau du registre du commerce ; informations fiscales si applicables | Registre et justificatif d’immatriculation ; revue particulière pour un entrepreneur individuel. [Ministère du Commerce](https://ticaret.gov.tr/ic-ticaret/ticaret-sicili/merkezi-sicil-kayit-sistemi-mersis). |
| Géorgie | Code d’identification de société ; informations de l’extrait, siège séparé de l’atelier | Extrait du registre NAPR. Ne pas exiger systématiquement l’inscription au registre des activités économiques, qui est un registre distinct. [NAPR entreprises](https://napr.gov.ge/en/page/frequently-asked-questions), [activités économiques](https://www.napr.gov.ge/en/page/frequently-asked-questions/economic-activity). |
| Maroc | ICE, RC et tribunal ; identifiant fiscal si applicable | Justificatif du registre du commerce. Le certificat négatif de réservation de nom ne suffit pas. [OMPIC formulaires](https://www.ompic.ma/en/content/central-trade-register/forms), [identifiants OMPIC](https://rbe.ompic.ma/assets/doc/Formulaire%20de%20la%20demande.pdf). |
| Tunisie | Identifiant tel qu’inscrit sur l’extrait RNE ; matricule fiscal si applicable | Extrait et contrôle de son authenticité dans le service officiel. [RNE](https://www.registre-entreprises.tn/). |
| France | SIREN, SIRET du siège si renseigné, TVA si applicable | Attestation RNE ; ne pas rendre le Kbis universellement obligatoire. [Service public](https://entreprendre.service-public.gouv.fr/vosdroits/R19859). |
| Autres pays | Registre et identifiant local, justificatif | Revue manuelle tant qu’une fiche pays officielle n’a pas été documentée. Pas de faux formulaire « conforme à tous les pays ». |

Les sources ci-dessus servent à construire les champs de revue GSL. Elles ne constituent pas une liste exhaustive des obligations applicables à chaque forme juridique. Aucun accès automatisé aux registres n’est encore connecté ; aucun contrôle en ligne n’est simulé.

## Certification et confiance

Trois informations séparées : identité de l’entreprise contrôlée, document examiné, exigences du produit étudiées. Aucun badge général « entreprise certifiée UE ».

NANDO recense des organismes notifiés et leurs domaines de notification ; ce n’est pas un registre de fabricants certifiés. L’intervention d’un organisme notifié dépend du produit et de sa procédure. Certains produits ne relèvent pas du marquage CE. Le formulaire demande donc d’abord catégorie et usage avant les justificatifs pertinents. [Commission européenne — marquage CE](https://europa.eu/youreurope/business/product-rules-compliance/general-product-compliance/ce-marking/index_en.htm).

Une date d’expiration absente reste absente, avec motif si nécessaire. Ne pas inventer une durée de validité pour une déclaration UE ou un extrait. Une pièce expirée, retirée ou remplacée ne soutient plus un badge actif. Les dates de contrôle et la référence examinée sont consultables. Un changement de référence produit, d’entité, de siège ou de document déclenche une nouvelle revue du périmètre concerné.

## Droits et fichiers

RLS sur toutes les tables exposées. Les appartenances proviennent de la base, jamais de `user_metadata`. Un acheteur ne lit que les dossiers de ses organisations ; un commercial fournisseur uniquement les demandes effectivement reçues. Les fonctions administratives exigent un rôle interne accordé hors du parcours d’inscription.

| Acteur | Accès |
| --- | --- |
| Visiteur | Projections de catalogue publiées et photos autorisées, aucune pièce justificative privée. |
| Membre en lecture | Informations internes de son organisation selon son rôle ; pas d’invitations ou changement de propriétaire. |
| Achats | Brouillons, consultations, messages et comparaison d’offres de son organisation. |
| Commercial | Catalogue de son organisation, conversations reçues et offres émises. |
| Administrateur d’organisation | Profil, sites, équipe ; ne peut pas valider lui-même ses documents ni devenir contrôleur plateforme. |
| Contrôleur GSL | Dossiers soumis à revue, décision motivée et audit. Accès aux plans de sourcing accompagné uniquement après partage explicite du client. |

Storage : un espace privé pour justificatifs et plans avec URLs signées courtes après autorisation ; un espace de publication pour les seules copies de médias approuvées. Les noms d’objets sont générés, les types contrôlés côté serveur, les fichiers mis en quarantaine avant publication. SVG et HTML ne sont pas acceptés comme photos. Changement de fichier = nouvelle révision, pas écrasement silencieux du document déjà contrôlé.

Prévoir archivage, suppression et durées de conservation par finalité avant collecte réelle. Les pièces d’identité personnelles ne sont pas demandées systématiquement. L’adresse privée d’un entrepreneur individuel n’est pas publiée par défaut. Le propriétaire choisit l’affichage précis ou limité à la ville pour les sites, sans fausse localisation Google Maps.

## Migration et critères de mise en service

1. Identifier l’organisation Supabase cible et le projet précisément autorisé à supprimer. Les deux projets actuellement accessibles au connecteur ne sont pas identifiés comme GSL ; conserver leurs données. Confirmer le coût fourni par Supabase avant création.
2. Créer un projet GSL distinct en région européenne, appliquer migrations versionnées, référentiels pays et politiques d’accès. Pas de données de démonstration mélangées aux entreprises réelles.
3. Remplacer l’authentification ChatGPT Sites par Supabase Auth et sessions serveur vérifiées. Les en-têtes `oai-authenticated-*` actuels ne doivent jamais authentifier un visiteur sur Vercel.
4. Adapter les services de données SQLite/D1 à PostgreSQL et les fichiers R2 à Storage. Les comptes ChatGPT ne sont pas convertis en comptes email par simple égalité d’adresse ; prévoir une procédure explicite de rattachement.
5. Connecter les formulaires adaptatifs acheteur/fournisseur, les revues, le catalogue et les échanges. Reprise des données réelles seulement après inventaire et règles de correspondance ; aucun effacement de l’ancien site nécessaire au démarrage.
6. Tester avec deux acheteurs, deux fournisseurs, un membre révoqué et un contrôleur : accès croisés interdits, brouillons privés, offres concurrentes invisibles, documents non publics, refus d’auto-validation et de fausses relations entre sociétés, expiration des liens et invalidation des preuves.
7. Exécuter les contrôles Supabase sécurité/performance et un test complet inscription → vérification → publication → demande → réponse, puis déployer Vercel et raccorder le domaine. Le site actuel reste utilisable pendant la préparation.

État installé : comptes/profils, entreprises avec rôles acheteur/fournisseur, équipes, identifiants, adresses, sites, contacts, capacités, produits, médias privés, documents et périmètres, dossiers de conformité, événements de contrôle, brouillons de demandes et lignes, destinataires, conversations, messages, offres et commandes déclarées, projections publiques minimales. Les créations d’entreprise et de brouillon fonctionnent avec les permissions d’un utilisateur authentifié ; les modifications sensibles retirent les projections publiques concernées.

Reste à intégrer avant mise en service : formulaires et Supabase Auth côté site, invitations et gestion de l’équipe, soumission et revue documentaire, envoi transactionnel des demandes, émission/versionnement détaillé des offres, commandes, médias publics après analyse, notifications, commissions, rétention et reprise des anciens comptes. Les écritures de validation/publication/envoi sont volontairement réservées au serveur à ce stade : aucun client ne peut s’accorder un statut contrôlé ou contourner la préparation des demandes. Le contrôleur n’a pas encore de parcours de consultation des pièces privées ; il devra passer par le service de revue avec consentement et journalisation. Les tables du modèle cible non encore installées sont celles des invitations, profils métier détaillés, équipements structurés, historique complet des versions, dossiers de revue, commissions et notifications/audit général.

Le rapport de sécurité Supabase ne signale aucune anomalie après installation. Le rapport de performance indique des index encore inutilisés, attendu sur une base neuve ; leur utilité sera réévaluée avec les requêtes réelles. [Explication de cet indicateur](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
