# Activation des propriétaires de la plateforme

## Cible et état

Projet Supabase : GSL Systems (`ihugldueruspxdyooycc`). Comptes explicitement demandés le 7 octobre 2026 : `dorian.vuattoux@gmail.com` et `celiandvl@gmail.com`. Les deux comptes existants ont été vérifiés par leur email exact et leur UUID : email confirmé, compte actif, aucun rôle reviewer et aucun facteur MFA vérifié. Chaque UUID doit être relu et fourni explicitement à l’opération ; il n’est pas intégré dans les migrations.

L’activation n’a pas été effectuée. La validation automatique a refusé `admin_dashboard` en production, car elle demande un accord explicite pour ce schéma précis et ses dépendances. Elle a confirmé que l’ajout du second compte ne constituait pas cet accord explicite. Les tables d’administration sont absentes. Aucun rôle n’a été attribué et aucune migration n’a été appliquée lors de ces tentatives.

## Changements à autoriser en production

Appliquer dans cet ordre, avec l’outil de migration et son historique :

1. `20261006211355_admin_dashboard.sql` : tables privées administrateurs, tâches, préférences et activité ; fonctions protégées de consultation et de modification ; RLS et interdiction d’accès direct aux tables.
2. `20261006213000_ten_languages.sql` : autoriser les dix langues dans les profils et contacts ; conserver le fallback anglais/français des emails.
3. `20261007084200_admin_roles_exports.sql` : quatre rôles, permissions, gestion des accès, export limité et audits immuables ; protection du dernier propriétaire et révocation des anciennes fonctions appelables par les clients.
4. `20261007122815_reviewer_active_account.sql` : appliquer aux contrôleurs documentaires la vérification du compte actif et confirmé, en plus du rôle et de la MFA.

Puis exécuter `supabase/operations/grant-platform-owner.sql` pour chacun des deux comptes dans une même transaction serveur contrôlée, après avoir redéfini pour chaque exécution avec `set_config(..., ..., true)` :

- `gsl.owner_grant_user_id` : UUID relu dans `auth.users` pour l’adresse exacte confirmée ;
- `gsl.owner_grant_email` : l’adresse exacte du compte concerné, `dorian.vuattoux@gmail.com` puis `celiandvl@gmail.com` ;
- `gsl.owner_grant_reason` : motif documentant la demande explicite de droits Propriétaire et reviewer, de 10 à 500 caractères.

La même transaction contient les paramètres propres à chaque compte, les deux exécutions et la vérification finale avant validation. Toute erreur annule l’ensemble des attributions. L’opération refuse les paramètres absents, une identité non concordante, un compte non confirmé, suspendu ou supprimé. Elle verrouille le registre des accès, attribue les deux habilitations et journalise l’opération serveur. La réexécution sans changement n’ajoute pas de doublon. Ce fichier n’est ni une migration automatique, ni une route accessible au navigateur.

Le résultat attendu est le rôle applicatif `owner` avec les huit permissions du dashboard, plus la validation fournisseur et documentaire. Les règles d’attribution des dossiers, d’isolation des entreprises et de MFA restent actives. Aucun rôle d’administration de la console Supabase n’est attribué.

## Vérification

Avant exécution : `npm run test:admin` et `npm run test:operational` sur PGlite isolé. Les tests d’attribution couvrent identité exacte, comptes inactifs, répétition, promotion, audit, privilèges owner/reviewer et maintien du refus AAL1.

Après exécution : relire le rôle et le reviewer pour les deux seuls UUID cibles, vérifier les huit permissions et les traces d’audit de chacun, relire l’historique des migrations puis lancer les conseillers de sécurité. Les tables privées avec RLS sans politique restent volontairement inaccessibles directement aux clients.

Chaque compte devra ensuite activer et valider la double authentification dans son espace Compte pour accéder à `/administration` et à la revue. Cette étape nécessite le titulaire du facteur ; elle ne doit pas être simulée. La disponibilité du code sur le site déployé et le parcours réel de connexion sont des vérifications distinctes du push Git.
