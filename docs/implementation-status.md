# État de réalisation — 29 septembre 2026

Branche `codex/operational-platform`, base `ca1f72f`. Production inchangée. Ce document distingue le code écrit des parcours réellement validés. **Le cahier des charges n’est pas encore intégralement réceptionné.**

| Section | État | Preuve / limite |
|---|---|---|
| 01 — Mission et résultat | En cours | Boucles métier implémentées ; recette hébergée non exécutée. |
| 02 — Observations initiales | Revalidé localement | Architecture Next/Supabase ; inventaire distant initial documenté dans environments.md. |
| 03 — Méthode et garde-fous | Implémenté | Branche isolée, fixtures PGlite éphémères, refus des URL de production dans les tests. |
| 04 — Positionnement | Implémenté | Catalogue publié, démonstration séparée, aucun tarif/garantie inventé. |
| 05 — Architecture | Implémenté, intégration à valider | runtime-config.ts, server.ts, proxy.ts ; build Next réussi. |
| 06 — Navigation | Implémenté, recette partielle | Catalogue, profils, compte, opérations, revue, contact et aide ; pages locales ouvertes. |
| 07 — Recherche | Implémenté, recette SQL | Synonymes, critères requis/préférés, inconnues, pays de production, unités, pagination. Filtres techniques avancés à compléter. |
| 08 — Fiches publiques | Implémenté, recette SQL partielle | Projections approuvées, galerie dérivée, retrait. Images par référence produit à compléter. |
| 09 — Sélection acheteur | Implémenté, Auth à valider | Sélection publique locale, fusion explicite, brouillons privés ; parcours création de compte non testé en ligne. |
| 10 — Inscription fournisseur | Implémenté | Quatre étapes, logo/site facultatifs, capacités, documents, récapitulatif. |
| 11 — Sauvegarde | Implémenté, recette partielle | Brouillons partiels, autosauvegarde, révisions, conflits ; coupure réseau réelle à tester. |
| 12 — Règles pays | Partiel | Référentiel ISO ; 11 fiches documentées et repli manuel. RO/CN restent génériques ; voir country-coverage.md. |
| 13 — Documents conditionnels | Implémenté, recette partielle | Périmètre/dates/type, justificatif ou explication ; données privées conservées dans le dossier. |
| 14 — Authentification | Implémenté, hébergement bloqué | Retour/langue, récupération, cookies privés, MFA TOTP. Configuration OTP/SMTP distante et réception à vérifier. |
| 15 — Fichiers | Implémenté, services à configurer | Réservations, quotas, suppression coordonnée, scan, diffusion limitée ; dérivés WebP approuvés. Scanner réel absent. |
| 16 — Membres et accès | Implémenté, recette SQL | Invitations liées à l’adresse, rôles, révocation effective ; AAL2 pour les reviewers. |
| 17 — Revue | Implémenté, recette SQL partielle | Assignation, contrôles versionnés, compléments, publication/retrait/republication. Refus motivé ajouté et testé ; habilitation réelle à attribuer et recours à compléter. |
| 18 — Intégrité | Implémenté, recette SQL | 8 migrations appliquées localement ; contraintes, RLS, commandes idempotentes, types générés locaux. Historique distant à rapprocher. |
| 19 — Demandes de devis | Implémenté, recette SQL partielle | Brouillon, destinataires nommés, aperçu, snapshot, transmission atomique, annulation. Ajout destinataire disponible en interface ; assistance en RPC, interface à compléter. |
| 20 — Messagerie | Implémenté, recette partielle | Messages privés persistants, idempotence, historique paginé par conversation ; demandes paginées par entreprise (20 par page), testées sur 25 brouillons. |
| 21 — Offres | Implémenté, recette partielle | Lignes, frais fixes, devises exactes, historique, sélection sans paiement. Équivalence commerciale détaillée à valider. |
| 22 — Contact et emails | Implémenté, livraison non vérifiée | Référence contact, outbox transactionnelle, worker SMTP FR/EN, relances bornées. Scheduler, DNS et réception non testés. |
| 23 — Confiance et confidentialité | Partiel | Méthode claire, export et demande de suppression. Raison sociale, adresse et durées de conservation à confirmer. |
| 24 — Internationalisation | Implémenté sur parcours nouveaux, audit incomplet | FR/EN, langue SSR et retour ; couverture intégrale des anciennes pages à vérifier. |
| 25 — Interface/accessibilité | Recette partielle | Catalogue mobile 390 px sans débordement ; contact/méthode contrôlés. Tablette, clavier, zoom et lecteur d’écran à terminer. |
| 26 — SEO | Implémenté, validation partielle | Projections publiques SSR, sitemap conditionnel, canonical/langue, pages privées hors index. Aucun feu vert à indexation de production. |
| 27 — Exploitation | Partiel | En-têtes, monitoring outbox/revue, procédures. Restauration, charge réelle, nettoyage planifié et alertes externes non testés. |
| 28 — Mesure produit | Partiel | Événements métier enregistrés, volumes non assimilés à du chiffre d’affaires. Tableau de volumes métier et délai médian ajouté ; funnel visites/recherche/abandon à compléter ; aucun revenu déclaré. |
| 29 — Livraison progressive | En cours | Code isolé, documentation et tests ; aucune publication sur main. |
| 30 — Recette | Partielle | Tests locaux exécutés ; 100 cas tracés avec limites dans acceptance-status.md, pas 100 réussites. |
| 31 — Dépendances externes | Ouvert | Préproduction à 0/mois autorisée mais refusée par Supabase : quota gratuit atteint ; scanner, SMTP, comptes de test et identité légale. |
| 32 — Livrables | En cours | Code, migrations, types, guides et matrice présents ; validation hébergée et livraison finale non acquises. |

## Exécution confirmée

- `npm run test:operational` : succès sur règles, formulaires, pays, PostgreSQL embarqué et dérivés images.
- `npm run build` : succès Next.js avec compilation TypeScript, après correction MFA et historique des messages.
- `npm run lint` : zéro erreur, 52 avertissements ; ne constitue pas un audit d’accessibilité.
- Migrations : les cinq migrations historiques et les trois migrations du 29 septembre appliquées uniquement dans PGlite éphémère. Aucun changement de schéma hébergé.
- Navigateur : `/contact`, `/fabricants` et `/notre-methode?lang=fr` et `/connexion?lang=fr&next=%2Foperations` ouverts localement. Catalogue en indisponibilité réelle sans backend local configuré. Aucun compte ou email de production créé pour la recette.

## Documents

`acceptance-status.md` : scénario par scénario. `country-coverage.md` : pays et sources. `environments.md` : cibles. `reviewer-guide.md` : publication. `operations-runbook.md` : incidents, files, restauration et limites. `environment.example` : noms des réglages sans secrets.

## Responsabilités à confirmer

Dorian Vuattoux / Célian Duval : identité légale, adresse professionnelle, responsable habilité, destinataires de test et politique de conservation. Contact confirmé : contact@gsl-systems.com. Une mention nominative ne vaut pas attribution d’un droit reviewer. La création d’une préproduction à 0 par mois a été autorisée, puis refusée par Supabase (deux projets gratuits actifs). Dorian a indiqué libérer une place.

## Version remise

Commit initial `80997b8`, branche poussée sur GitHub. Demande de revue en brouillon : https://github.com/didou34000/gsl-systems/pull/1. Aucune fusion, migration hébergée ou publication de production réalisée.
