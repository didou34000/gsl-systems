# Activation des propriétaires de la plateforme

## Cible et état

Projet Supabase : GSL Systems (`ihugldueruspxdyooycc`). Comptes explicitement demandés le 7 octobre 2026 : `dorian.vuattoux@gmail.com` et `celiandvl@gmail.com`. Les deux comptes existants ont été vérifiés par leur email exact et leur UUID : email confirmé et compte actif. Chaque UUID a été fourni explicitement à l’opération ; il n’est pas intégré dans les migrations.

L’activation a été effectuée le 7 octobre 2026 après le « OUI » explicite de l’utilisateur à l’application des quatre migrations et aux deux attributions. Les deux comptes disposent du rôle `owner`, de ses huit permissions et de l’habilitation reviewer. La transaction commune a été validée, puis les attributions ont été relues dans la base réelle. La révision du registre est passée de 0 à 2 ; chaque compte possède une trace d’attribution owner et une trace reviewer, avec un acteur explicitement identifié comme opération serveur.

## Migrations appliquées en production

Les migrations suivantes ont été appliquées dans cet ordre par l’outil de migration :

1. `20261006211355_admin_dashboard.sql` : tables privées administrateurs, tâches, préférences et activité ; fonctions protégées de consultation et de modification ; RLS et interdiction d’accès direct aux tables.
2. `20261006213000_ten_languages.sql` : autoriser les dix langues dans les profils et contacts ; conserver le fallback anglais/français des emails.
3. `20261007084200_admin_roles_exports.sql` : quatre rôles, permissions, gestion des accès, export limité et audits immuables ; protection du dernier propriétaire et révocation des anciennes fonctions appelables par les clients.
4. `20261007122815_reviewer_active_account.sql` : appliquer aux contrôleurs documentaires la vérification du compte actif et confirmé, en plus du rôle et de la MFA.

Les versions de l’historique distant sont générées à l’application par l’outil. Les correspondances vérifiées sont :

| Migration locale | Version distante enregistrée |
| --- | --- |
| `20261006211355_admin_dashboard` | `20261007124133` |
| `20261006213000_ten_languages` | `20261007124153` |
| `20261007084200_admin_roles_exports` | `20261007124211` |
| `20261007122815_reviewer_active_account` | `20261007124227` |

Ne pas rejouer les migrations dashboard et RBAC : leurs tables, colonnes et fonctions existent désormais. Vérifier les noms et cette correspondance avant toute automatisation de migration fondée sur les seuls horodatages.

## Procédure d’attribution exécutée

`supabase/operations/grant-platform-owner.sql` a été exécuté pour chacun des deux comptes dans une même transaction serveur contrôlée, après avoir redéfini pour chaque exécution avec `set_config(..., ..., true)` :

- `gsl.owner_grant_user_id` : UUID relu dans `auth.users` pour l’adresse exacte confirmée ;
- `gsl.owner_grant_email` : l’adresse exacte du compte concerné, `dorian.vuattoux@gmail.com` puis `celiandvl@gmail.com` ;
- `gsl.owner_grant_reason` : motif documentant la demande explicite de droits Propriétaire et reviewer, de 10 à 500 caractères.

La même transaction contient les paramètres propres à chaque compte, les deux exécutions et la vérification finale avant validation. Toute erreur annule l’ensemble des attributions. L’opération refuse les paramètres absents, une identité non concordante, un compte non confirmé, suspendu ou supprimé. Elle verrouille le registre des accès, attribue les deux habilitations et journalise l’opération serveur. La réexécution sans changement n’ajoute pas de doublon. Ce fichier n’est ni une migration automatique, ni une route accessible au navigateur.

Le résultat vérifié est le rôle applicatif `owner` avec les huit permissions du dashboard, plus la validation fournisseur et documentaire. Les règles d’attribution des dossiers, d’isolation des entreprises et de MFA restent actives. Aucun rôle d’administration de la console Supabase n’a été attribué.

## Vérification

Avant exécution : `npm run test:admin` et `npm run test:operational` réussis sur PGlite isolé. Les tests d’attribution couvrent identité exacte, comptes inactifs, répétition, promotion, audit, privilèges owner/reviewer et maintien du refus AAL1.

Après exécution : rôles, reviewers, huit permissions, statut actif et audits des deux seuls UUID cibles vérifiés ; quatre migrations présentes une fois dans l’historique. Les huit tables privées d’administration et de revue ont RLS activée et aucun privilège direct de lecture/écriture pour `anon` ou `authenticated`. Les anciennes fonctions `before_roles` et la fonction interne de gestion des accès sont interdites aux clients. Les fonctions publiques restent réservées aux utilisateurs authentifiés ; MFA, compte actif et rôle UUID sont contrôlés dans leurs implémentations privées. Les quatre triggers d’immutabilité d’audit sont actifs.

Les conseillers de sécurité ont été relus : les informations [RLS sans politique](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) des tables privées correspondent au refus intentionnel d’accès direct. L’avertissement préexistant [protection contre les mots de passe compromis désactivée](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) subsiste ; aucun paramètre Auth global n’a été changé pendant l’attribution.

Lors du contrôle final, aucun des deux comptes n’avait encore de facteur MFA vérifié. Chaque titulaire doit activer et valider la double authentification dans son espace Compte pour accéder à `/administration` et à la revue. Aucune session ni aucun jeton AAL2 n’a été simulé en production. La disponibilité du code sur le site déployé et le parcours réel de connexion sont des vérifications distinctes du push Git.
