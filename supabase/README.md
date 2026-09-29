# Supabase GSL systems

Les migrations et tests de cette branche sont décrits dans [../docs/environments.md](../docs/environments.md). Le projet `ihugldueruspxdyooycc` est la production existante ; il n'est jamais une cible de fixtures.

`npm run test:operational` applique les migrations à PostgreSQL embarqué PGlite, passe sous les rôles ordinaires pour tester RLS, puis détruit la base. Cela n'atteste pas du fonctionnement des services Auth/Storage hébergés.

Les nouveaux workflows n'ont pas été migrés sur le projet distant pendant cette reprise. Les notes du 25 septembre ont été archivées dans `docs/history/README-supabase-2026-09-25.md`.
