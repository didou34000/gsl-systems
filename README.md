# GSL systems

Plateforme industrielle Next.js 16 / React 19 / Supabase. Le cahier de réception est dans [docs/implementation-brief.md](docs/implementation-brief.md). La branche `codex/operational-platform` contient la reprise opérationnelle. Elle n'est pas encore une livraison de production validée.

## Démarrage

Node.js >= 22.13. Installer avec `npm ci`. Copier les variables de [docs/environment.example](docs/environment.example) dans une configuration locale ignorée par Git et renseigner un projet Supabase **de développement dédié**. Aucun secret ne doit être versionné.

- `npm run dev` : Next.js, port 5173.
- `npm run test:operational` : règles et PostgreSQL embarqué ; refuse toute URL de base externe. Les fixtures sont synthétiques, sans réseau, détruites avec le processus.
- `npx tsc --noEmit` : vérification TypeScript.
- `npm run lint` : analyse statique.
- `npm run build:vercel` : build Next.js destiné à Vercel.
- `npm start -- --port 5173` : servir ce build ; définir `GSL_SITE_URL=http://localhost:5173` pour les écritures locales.

La référence `ihugldueruspxdyooycc` est la production existante. Elle est refusée par la configuration hors environnement `production`. Ne jamais l'utiliser pour les tests, fixtures ou resets.

## Parcours

`/fabricants` et `/catalogue` lisent les projections approuvées ; `/fabricants/[id]` et `/produits/[id]` affichent les fiches réelles. `/selection` conserve les identifiants publics choisis et propose une fusion explicite au compte. `/operations` regroupe entreprises, demandes privées, destinataires, conversations et offres. `/espace-fournisseur` contient le dossier en quatre étapes. `/administration/revue` est réservé aux reviewers désignés hors frontend. `/demo` isole les exemples.

Langue : anglais par défaut, français avec `?lang=fr`, cookie de préférence et rendu serveur cohérents. Les noms et descriptions fournis restent dans leur langue d'origine.

## Architecture

Les API ordinaires utilisent la session Supabase de l'utilisateur. Les commandes transactionnelles et leurs contrôles d'accès sont dans les migrations PostgreSQL. `lib/supabase/` gère la session et les lectures publiques, `lib/onboarding/` les règles de formulaire, `lib/files/` les signatures et l'adaptateur d'analyse, `lib/notifications/` la file et les modèles email.

Les fichiers demeurent privés. Un plan de demande peut être limité à un destinataire. Sans scanner configuré, le dépôt métier est indisponible ; aucun résultat clean n'est simulé. Les emails restent en file sans worker configuré ; une acceptation SMTP ne prouve pas une réception.

## Livraison et preuves

- [État des exigences](docs/implementation-status.md)
- [Recette de 100 cas](docs/acceptance-status.md)
- [Couverture pays](docs/country-coverage.md)
- [Environnements et migrations](docs/environments.md)
- [Guide de revue](docs/reviewer-guide.md)
- [Incidents et retour arrière](docs/operations-runbook.md)

Les tests PGlite exercent SQL/RLS, mais ne remplacent pas Supabase Auth, PostgREST, Storage hébergé, une concurrence réseau réelle ou des emails reçus. La production ne doit pas être basculée tant que cette recette et les dépendances externes restent ouvertes.

L'ancien environnement Sites/Cloudflare/D1 est isolé par `GSL_LEGACY_SITES=true` et les scripts `*:legacy`. Ses notes sont archivées dans `docs/history/` ; elles ne constituent pas la preuve du nouveau backend.
