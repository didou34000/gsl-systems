# Environnements — 29 septembre 2026

| Environnement | Identité | État vérifié |
|---|---|---|
| Production actuelle | www.gsl-systems.com ; Supabase ihugldueruspxdyooycc | Inventaire lu, aucune migration ni donnée modifiée pendant cette reprise |
| Base de tests | PGlite en mémoire dans test-postgres.mjs | Toutes les migrations locales appliquées, fixtures isolées, tests de droits exécutés |
| UI locale | localhost:5191, build Next.js de la branche | Contact, catalogue indisponible honnête, méthode, connexion avec contexte ; langue FR/EN et largeurs 390/768 px contrôlées ; pas de Supabase configuré |
| Préproduction Supabase | GSL Systems — préproduction, Paris, même organisation | Création autorisée à 0/mois puis refusée : quota gratuit de deux projets actifs atteint. Dorian a indiqué libérer une place ; aucun projet existant modifié. |
| Vercel preview de cette branche | Non déployée | Aucun statut ready ne peut être annoncé |

Variables : [environment.example](environment.example). Les clés de service restent exclusivement dans les secrets serveur. Le contact professionnel confirmé est contact@gsl-systems.com ; sa présence ne prouve pas le fonctionnement SMTP.

## Migrations

Deux migrations ajoutées : `20260929112314_operational_workflows.sql` et `20260929114840_complete_operational_actions.sql`. Elles ont été exécutées uniquement dans PostgreSQL embarqué. La seconde comprend recherche, commandes, revue, fichiers, notifications et contrôle de republication ; lire sa portée avant application.

Le projet distant comporte cinq migrations historiques dont les horodatages diffèrent des fichiers locaux. Ne pas exécuter un push aveugle : comparer les définitions distantes et locales, établir un rapprochement des cinq migrations, sauvegarder le schéma et appliquer les ajouts sur un projet dédié. Ne jamais marquer une version appliquée sans avoir vérifié son contenu.

Les migrations initiales sont réservées à une base dédiée à GSL : leur initialisation des grants parcourt les tables publiques. Ne pas les appliquer à une base contenant une autre application.

## Préproduction et recette hébergée

1. Identifier le projet dédié autorisé et son organisation. Confirmer tout coût avant création.
2. Configurer les URL d'authentification, SMTP Auth, longueur réelle des codes (l'interface actuelle attend huit chiffres), délais et redirections propres à la préproduction.
3. Appliquer les migrations après rapprochement, générer à nouveau les types depuis le schéma hébergé et comparer avec `database.generated.ts` (actuellement généré localement).
4. Créer uniquement les comptes synthétiques sur des boîtes contrôlées autorisées ; attribuer le reviewer de test par procédure opérateur.
5. Exécuter les 100 cas avec clients utilisateur, Data API, Storage, concurrence réelle et réception FR/EN.
6. Déployer une preview Vercel avec `GSL_ENVIRONMENT=preview`, le projet de test et indexation désactivée. Vérifier les routes après déploiement.
7. Lever les dépendances de lancement et préparer sauvegarde/retour arrière avant toute promotion en production.

Aucun résultat de build n'autorise à lui seul la migration de production.
