# GSL Systems — Supabase

Projet : `ihugldueruspxdyooycc` · région Paris (`eu-west-3`).

[Console du projet](https://supabase.com/dashboard/project/ihugldueruspxdyooycc)

Les quatre migrations présentes ont été appliquées à ce projet neuf. Elles ne doivent pas être appliquées à un projet Supabase contenant une autre application : la migration initiale définit les droits des tables publiques de ce projet dédié.

- `migrations/` : schéma, permissions et fiches pays.
- `tests/tenant-isolation.sql` : test transactionnel, fixtures Auth annulées avec `ROLLBACK`. Exécuter avec un rôle d’administration dans un environnement de test. Il se place ensuite dans les rôles utilisateurs réels pour les assertions.
- `../scripts/test-country-requirements.mjs` : contrôles des formulaires pays.
- `../docs/SUPABASE-ARCHITECTURE.md` : modèle, sources officielles et limites d’intégration.

Cette base n’est pas encore connectée au site. Ne pas remplacer les variables de l’hébergement actuel avant la migration de l’authentification et des services de données. Aucune clé secrète ou mot de passe n’est inclus dans ce dépôt.

Résultats du 25 septembre 2026 : tests d’accès réussis, aucune anomalie dans le rapport de sécurité Supabase, aucun compte de test conservé. Le stockage est privé ; les documents partagés ne sont lisibles par un fournisseur que s’ils sont liés à une demande reçue et marqués analysés par un traitement serveur. L’analyse de fichiers et la publication des photos restent à intégrer.
