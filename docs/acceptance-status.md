# Recette GSL — 29 septembre 2026

Exécution : 29 septembre 2026, Codex. Aucun résultat historique n’est repris comme test actuel.

Environnements : tests purs et PostgreSQL embarqué PGlite jetable ; navigateur Next local sans backend hébergé configuré. RÉUSSI porte uniquement sur la preuve précisée. Une preuve SQL partielle ne valide pas un scénario navigateur/Auth/Storage complet. BLOQUÉ indique une dépendance externe ; NON EXÉCUTÉ inclut les scénarios dont seule une partie a été vérifiée.

Supabase a refusé la création de la préproduction autorisée à 0/mois : quota de deux projets gratuits actifs atteint. Dorian a indiqué libérer une place. Aucun projet existant n’a été mis en pause ou supprimé par Codex.

| ID | Scénario | État | Preuve / limite |
|---|---|---|---|
| T001 | Inscription sur une boîte de test autorisée | BLOQUÉ | Préproduction Supabase / comptes et boîtes de test nécessaires ; aucun essai de production. |
| T002 | Compte dont l’email n’est pas confirmé | BLOQUÉ | Préproduction Supabase / comptes et boîtes de test nécessaires ; aucun essai de production. |
| T003 | Code valide, expiré puis erroné | BLOQUÉ | Préproduction Supabase / comptes et boîtes de test nécessaires ; aucun essai de production. |
| T004 | Confirmation depuis le parcours fournisseur | BLOQUÉ | Préproduction Supabase / comptes et boîtes de test nécessaires ; aucun essai de production. |
| T005 | Confirmation ou lien ouvert sur un autre navigateur | BLOQUÉ | Préproduction Supabase / comptes et boîtes de test nécessaires ; aucun essai de production. |
| T006 | Lien de retour externe, encodé ou ambigu | RÉUSSI | test-operational-rules.mjs : redirections externes, doubles encodages et séparateurs rejetés. |
| T007 | Mot de passe oublié et récupération | BLOQUÉ | Préproduction Supabase / comptes et boîtes de test nécessaires ; aucun essai de production. |
| T008 | Expiration de session pendant une saisie | BLOQUÉ | Préproduction Supabase / comptes et boîtes de test nécessaires ; aucun essai de production. |
| T009 | Déconnexion puis ouverture d’une ancienne URL privée | BLOQUÉ | Préproduction Supabase / comptes et boîtes de test nécessaires ; aucun essai de production. |
| T010 | Tentatives répétées de connexion ou de renvoi | BLOQUÉ | Préproduction Supabase / comptes et boîtes de test nécessaires ; aucun essai de production. |
| T011 | Création d’un compte sans logo ni site web | NON EXÉCUTÉ | Logo et site facultatifs testés dans le schéma ; création Auth non testée. |
| T012 | Enregistrement d’une saisie encore incomplète | RÉUSSI | test-supplier-profile.mjs : brouillons partiels acceptés, schéma strict et borné. |
| T013 | Saisie, autosauvegarde, rechargement | NON EXÉCUTÉ | Autosauvegarde implémentée ; parcours navigateur connecté et rechargement à exécuter. |
| T014 | Coupure réseau pendant la sauvegarde | NON EXÉCUTÉ | Scénario à exécuter. |
| T015 | Deux onglets modifient la même version | NON EXÉCUTÉ | Conflit de version testé en SQL ; deux onglets réels non exécutés. |
| T016 | Distributeur sans usine détenue | NON EXÉCUTÉ | Règles métier distributeur implémentées ; formulaire complet à parcourir. |
| T017 | Service sur plan sans référence catalogue | NON EXÉCUTÉ | Référence facultative dans le schéma ; parcours sur plan à vérifier. |
| T018 | Changement de pays ou de forme juridique | NON EXÉCUTÉ | Confirmation UI et isolation des champs testées partiellement ; interaction complète à exécuter. |
| T019 | Quantité décimale locale et date impossible | RÉUSSI | test-supplier-profile.mjs : normalisation décimale et dates calendaires impossibles. |
| T020 | Soumission avec informations nécessaires manquantes | NON EXÉCUTÉ | Rejet du schéma testé ; focus/résumé d’erreurs à tester au clavier. |
| T021 | Parcours du référentiel pays retenu | NON EXÉCUTÉ | Référentiel ISO chargé ; tous les choix n’ont pas été exercés dans le navigateur. |
| T022 | Code pays invalide envoyé directement | RÉUSSI | test-country-requirements.mjs : code ISO non reconnu rejeté par le validateur serveur. |
| T023 | Pays sans modèle local documenté | NON EXÉCUTÉ | Repli manuel testé ; revue complète pays générique à exécuter. |
| T024 | Formes juridiques différentes dans un même pays | NON EXÉCUTÉ | Conditionnement par entityKind testé ; couverture mondiale non exhaustive. |
| T025 | Identifiants FR, GB, DE, IT et PL dans les fixtures | NON EXÉCUTÉ | FR/GB/DE/IT/PL présents ; distinction KRS/CEIDG ajoutée et testée localement ; fixture complète de publication par pays à exécuter. |
| T026 | Entité américaine avec juridiction de constitution | RÉUSSI | test-country-requirements.mjs : juridiction US et absence d’EIN par défaut. |
| T027 | Dossier chinois, géorgien ou arabe | NON EXÉCUTÉ | Chaînes Unicode conservées par schéma ; recette de bout en bout non exécutée. |
| T028 | Adresse avec subdivision variable ou sans code postal applicable | NON EXÉCUTÉ | Champs souples ; référentiel d’adresses international détaillé non intégré. |
| T029 | Contrôle de registre ou de TVA indisponible | NON EXÉCUTÉ | Aucune confirmation automatique ; indisponibilité registre réel non simulée. |
| T030 | Nouvelle version d’une règle pays après soumission | NON EXÉCUTÉ | Version pays et historique conservés ; changement réel de règle à exécuter. |
| T031 | PDF ou image autorisée dans les limites | NON EXÉCUTÉ | Signature et taille validées ; Storage hébergé non testé. |
| T032 | Fichier dont l’extension et le contenu divergent | NON EXÉCUTÉ | Dérivation refuse faux raster et PDF ; contrôle API complet à tester. |
| T033 | Fichier dépassant la taille ou quota autorisés | NON EXÉCUTÉ | Quota de réservations testé SQL ; upload HTTP excessif non exécuté. |
| T034 | Téléversements simultanés à la limite du quota | NON EXÉCUTÉ | Verrouillage du quota testé séquentiellement ; vraie concurrence réseau non exécutée. |
| T035 | Échec entre téléversement et enregistrement des métadonnées | NON EXÉCUTÉ | Compensation codée ; injection de panne réseau réelle non exécutée. |
| T036 | Suppression en concurrence avec la soumission du dossier | NON EXÉCUTÉ | États deleting/pending testés SQL ; concurrence réseau à exécuter. |
| T037 | Utilisateur tiers demandant un fichier ou une URL signée | NON EXÉCUTÉ | Politiques SQL/Storage simulées rejettent tiers ; URL signée hébergée à tester. |
| T038 | Pièce confidentielle attribuée à un seul fournisseur | NON EXÉCUTÉ | Scénario SQL deux fournisseurs réussi ; téléchargement hébergé à tester. |
| T039 | Fichier en quarantaine, rejeté ou scan non configuré | NON EXÉCUTÉ | Pending bloque en SQL et scanner absent désactive le transfert ; scanner réel non configuré. |
| T040 | Image publique approuvée et extrait privé du même dossier | NON EXÉCUTÉ | Dérivation réelle avec suppression EXIF/ICC et approbation/retrait SQL réussis ; diffusion HTTP à tester. |
| T041 | Fournisseur tentant de devenir reviewer | NON EXÉCUTÉ | Refus reviewer et exigence AAL2 testés SQL ; parcours Auth hébergé à tester. |
| T042 | Reviewer autorisé examine un dossier assigné | NON EXÉCUTÉ | Assignation/contrôles/publish SQL réussis ; interface connectée à tester. |
| T043 | Demande de complément puis nouvelle soumission | NON EXÉCUTÉ | Réouverture et soumission versionnées testées ; demande de complément UI à tester. |
| T044 | Approbation valide avec conversion du dossier | NON EXÉCUTÉ | Conversion et republication sans doublon testées SQL ; UI hébergée à tester. |
| T045 | Approbation répétée ou deux reviewers concurrents | NON EXÉCUTÉ | Rejeu publication testé SQL ; deux reviewers réellement concurrents non exécutés. |
| T046 | Entreprise déjà présente avec identifiant approprié | RÉUSSI | test-republication.mjs : identité déjà revendiquée rejetée ; aucune adhésion accordée. |
| T047 | Modification directe d’un statut ou d’une note de revue par le fournisseur | RÉUSSI | test-workflows.mjs et operational-isolation.sql : rôle fournisseur incapable de modifier le statut privilégié. |
| T048 | Invitation, acceptation et retrait d’un membre | RÉUSSI | test-security-extensions.mjs : invitation liée à l’adresse, retrait et révocation des accès SQL. |
| T049 | Changement critique et correction éditoriale après publication | NON EXÉCUTÉ | Retrait/republication/historique testés ; distinction correction éditoriale à compléter. |
| T050 | Référence croisée de produit, site ou fichier d’une autre entreprise | NON EXÉCUTÉ | Contraintes et isolation testées localement ; chemins API exposés à tester. |
| T051 | Ouverture du catalogue réel avec zéro fiche publiée | NON EXÉCUTÉ | État indisponible observé localement ; état vide avec backend connecté à tester. |
| T052 | Recherche d’un fournisseur effectivement publié | NON EXÉCUTÉ | Fournisseur publié retrouvé en SQL ; fiche réelle navigateur non vérifiée. |
| T053 | Critère obligatoire non satisfait | RÉUSSI | test-workflows.mjs : procédé requis non satisfait exclu. |
| T054 | Critère obligatoire dont la valeur est inconnue | RÉUSSI | test-workflows.mjs : inconnue exclue ou groupe inconnu explicite. |
| T055 | Siège européen et usine hors UE | NON EXÉCUTÉ | Recherche sur pays de fabrication codée ; fixture siège EU/usine hors EU dédiée à compléter. |
| T056 | MOQ et demande exprimés dans des unités différentes | RÉUSSI | test-workflows.mjs : unités incompatibles jamais comparées comme équivalentes. |
| T057 | Critère préféré, synonymes et recherche FR/EN | RÉUSSI | test-workflows.mjs : alias usinage/CNC et préférence non satisfaite explicitée. |
| T058 | Filtres, pagination, retour navigateur et partage d’URL | NON EXÉCUTÉ | Filtres FR/EN contrôlés localement ; retour navigateur/pagination peuplée à tester. |
| T059 | Retrait d’une publication ou expiration d’une preuve | NON EXÉCUTÉ | Retrait SQL masque fiche et galerie ; expiration automatique de preuve à compléter. |
| T060 | Consultation anonyme du payload de fiche | RÉUSSI | test-workflows.mjs : projection publique sans payload privé ; accès anonyme dossier refusé. |
| T061 | Sélection anonyme puis création de compte | BLOQUÉ | Préproduction Supabase / comptes et boîtes de test nécessaires ; aucun essai de production. |
| T062 | Création et rechargement d’un brouillon acheteur | NON EXÉCUTÉ | Brouillon SQL et idempotence testés ; autosauvegarde UI connectée à tester. |
| T063 | Consultation du brouillon d’un autre acheteur | RÉUSSI | test-workflows.mjs : brouillon tiers invisible et modification refusée. |
| T064 | Aperçu avant envoi à plusieurs fournisseurs | NON EXÉCUTÉ | Aperçu et choix de destinataires implémentés ; session acheteur réelle nécessaire. |
| T065 | Double clic ou répétition réseau de la commande d’envoi | RÉUSSI | test-workflows.mjs : même commande rejouée sans nouveau destinataire ; arguments divergents rejetés. |
| T066 | Fournisseur retiré entre sélection et envoi | NON EXÉCUTÉ | NOT_PUBLISHED testé SQL ; retrait entre sélection UI et envoi à exécuter. |
| T067 | Échec au milieu de la création des destinataires | RÉUSSI | test-workflows.mjs : destinataire invalide annule toute la transmission. |
| T068 | Modification après transmission | NON EXÉCUTÉ | Snapshot immuable codé ; parcours amendement explicite à compléter. |
| T069 | Partage d’un besoin avec l’assistance GSL | NON EXÉCUTÉ | Consentement exigé par RPC ; interface et traitement opérateur à compléter. |
| T070 | Ajout d’un destinataire ou annulation après un premier envoi | NON EXÉCUTÉ | Interface ajout destinataire livrée ; annulation et sa notification testées SQL avec rejeu. Recette navigateur connectée à exécuter. |
| T071 | Fournisseur X ouvre la conversation de Y | RÉUSSI | test-request-files.mjs / test-workflows.mjs : destinataire concurrent et tiers isolés. |
| T072 | Message enregistré puis rechargé | NON EXÉCUTÉ | Message persistant testé SQL ; pagination de conversation codée, navigateur connecté à tester. |
| T073 | Répétition d’envoi d’un message après timeout | RÉUSSI | test-workflows.mjs : nouvelle exécution même clé de message sans doublon. |
| T074 | Offre avec plusieurs lignes, quantité et frais fixes | NON EXÉCUTÉ | Calcul décimal et offre SQL testés ; fixture multiligne avec frais fixes à renforcer. |
| T075 | Devise à zéro ou trois décimales et grands montants | RÉUSSI | test-operational-rules.mjs : zéro/trois décimales, grands montants ; TND confirmé en SQL. |
| T076 | Offres de devises différentes sans taux de conversion disponible | NON EXÉCUTÉ | Comparateur conserve devises séparées ; recette visuelle connectée non exécutée. |
| T077 | Transport inconnu, variante et délai seulement indicatif | NON EXÉCUTÉ | Transport et hypothèses visibles dans le code ; scénario de comparaison à exécuter. |
| T078 | Révision d’une offre et expiration de validité | NON EXÉCUTÉ | Version/validité gardées ; recette complète révision/expiration à exécuter. |
| T079 | Acheteur retient une offre sans paiement intégré | RÉUSSI | test-workflows.mjs : sélection persistée une fois, dossier clos, aucun paiement créé. |
| T080 | Changement d’organisation ou déconnexion pendant un échange | NON EXÉCUTÉ | Changement org remonte les conversations ; déconnexion/expiration réelle à tester. |
| T081 | Configuration contenant uniquement un email de contact confirmé | NON EXÉCUTÉ | Contact confirmé visible sur /contact ; configuration email seul non réexécutée. |
| T082 | Formulaire de contact valide | NON EXÉCUTÉ | Contact SQL idempotent et notification testés ; soumission HTTP et réception non exécutées. |
| T083 | Formulaire abusif, injection et volume excessif | NON EXÉCUTÉ | Limitation SQL contact testée ; injection/enveloppe SMTP de bout en bout à compléter. |
| T084 | Création d’une notification dans la même transaction que l’événement | RÉUSSI | test-workflows.mjs : notifications en transaction, pas de destinataires partiels après échec. |
| T085 | Prestataire indisponible puis rétabli | NON EXÉCUTÉ | Retries bornés et échec ambigu codés ; panne prestataire réelle non exercée. |
| T086 | Deux workers prennent la même tâche | NON EXÉCUTÉ | Leases disjoints testés séquentiellement ; vraie concurrence worker non exécutée. |
| T087 | Webhook non signé, répété ou arrivé dans le désordre | NON EXÉCUTÉ | Pas de webhook prestataire implémenté avec SMTP ; suivi livraison/rebonds encore à configurer. |
| T088 | Réception sur une boîte contrôlée française et anglaise | BLOQUÉ | Préproduction Supabase / comptes et boîtes de test nécessaires ; aucun essai de production. |
| T089 | Message rejeté ou adresse en échec permanent | NON EXÉCUTÉ | File failed exposée et tentatives bornées ; vrai rebond SMTP non testé. |
| T090 | Préférences marketing refusées | NON EXÉCUTÉ | Aucune inscription marketing implémentée ; vérification du parcours complet non exécutée. |
| T091 | Construction avec la commande de la cible réelle | RÉUSSI | Build Next et compilation TypeScript réussis ; lint zéro erreur, 52 avertissements. |
| T092 | Tests ou seeds lancés avec une URL de production | RÉUSSI | test-postgres.mjs refuse DATABASE_URL/SUPABASE_URL ; test-operational-rules refuse hôte production hors production. |
| T093 | Pages publiques, privées, démonstration et préproduction | NON EXÉCUTÉ | Noindex/config et gardes codés ; validation HTTP complète à terminer. |
| T094 | Sitemap, canonical, hreflang et fiche supprimée | NON EXÉCUTÉ | Sitemap/canonical/langue codés ; suppression et toutes les URL non exercées. |
| T095 | Navigation complète FR/EN avec retour par email | NON EXÉCUTÉ | Navigation publique FR/EN observée ; retour email non vérifié. |
| T096 | Mobile, clavier, zoom et lecteur d’écran sur étapes critiques | NON EXÉCUTÉ | Catalogue mobile 390 px et connexion 390/768 px sans débordement ; clavier/zoom/lecteur à terminer. |
| T097 | Réduction de mouvement et réseau contraint | NON EXÉCUTÉ | Vidéo et fallback préexistants conservés ; réseau contraint non testé. |
| T098 | Inspecter réponses, cache, logs et bundle public | NON EXÉCUTÉ | Cache privé et headers codés ; audit bundle/logs complet non exécuté. |
| T099 | Incident de file, revue en retard et suppression/export de données | NON EXÉCUTÉ | Export/demande suppression et guide présents ; rétention, suppression effective et incidents à tester. |
| T100 | Recette après déploiement autorisé et retour arrière contrôlé | BLOQUÉ | Préproduction Supabase / comptes et boîtes de test nécessaires ; aucun essai de production. |
