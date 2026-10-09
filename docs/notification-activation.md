# Activation des notifications transactionnelles

État du code au 9 octobre 2026 : file transactionnelle et traitement prêts ; aucun envoi réel ni secret n’a été créé par cette modification. La configuration actuelle doit être complétée et la cadence confirmée avant activation. `vercel.json` ne contient pas de nouvelle planification.

## Destinataires et droits

Les contacts directs créent un événement `direct_message` par membre autorisé de l’autre entreprise, avec exclusion de l’auteur. Les fiches du catalogue documentées par GSL donnent un accès interne aux owners de plateforme confirmés et actifs. Seules les appartenances créées par la synchronisation sont retirées lors d’une révocation ou d’une désactivation. La lecture et l’écriture au moyen de ces appartenances nécessitent une session AAL2.

Les RFQ utilisent les appartenances existantes pour notifier les destinataires. Les formulaires de contact général créent un accusé de réception pour l’expéditeur et une notification par owner actif. Les emails des owners sont résolus depuis Auth au traitement ; ils ne sont pas publiés dans le catalogue. Les identifiants des événements évitent les doublons. Aucun ancien message ni ancien formulaire n’est ajouté à la file par la migration.

Les liens `direct_message` ouvrent `/messagerie?conversation=…`. Les liens RFQ ouvrent `/operations?thread=…`, ou `/operations?request=…` pour une annulation. La consultation reste protégée par RLS et propose les entreprises autorisées avant une réponse.

## Points d’entrée

| Point d’entrée | Autorisation serveur | Effet |
| --- | --- | --- |
| `GET /api/internal/notifications` | `Bearer GSL_WORKER_SECRET` | Statut de configuration expurgé, sans connexion ni prise de lot. |
| `POST /api/internal/notifications` | `Bearer GSL_WORKER_SECRET` | Traitement d’un lot de deux notifications au maximum. |
| `GET /api/internal/notifications/cron` | `Bearer CRON_SECRET` | Même traitement, adapté aux requêtes GET de Vercel Cron. |
| `HEAD /api/internal/notifications/cron` | Sans objet | Réponse 405 ; aucun traitement. |

Chaque route vérifie la variable d’autorisation qui lui est propre. Le `User-Agent` ne sert jamais d’autorisation. Une configuration désactivée ou incomplète est refusée avant la prise de lot.

`notificationConfigStatus()` retourne `enabled`, `configured`, `ready`, `status`, `missing`, `invalid`, ainsi que les booléens `authorization.manual` et `authorization.cron`. Ce contrôle vérifie la présence et le format ; il ne prouve pas la validité distante du compte SMTP ni la délivrabilité.

## Configuration à fournir par le responsable du déploiement

- Configuration Supabase et site existante : `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `GSL_ENVIRONMENT`, `GSL_SITE_URL`.
- Identifiant serveur Supabase dans `SUPABASE_SERVICE_ROLE_KEY` : clé `service_role` existante ou clé serveur `sb_secret_…`. Une clé publique est refusée. Aucun mécanisme de génération de privilèges n’est inclus.
- Relais transactionnel existant : `GSL_SMTP_HOST`, `GSL_SMTP_PORT` (465 par défaut), `GSL_SMTP_USER`, `GSL_SMTP_PASSWORD`, `GSL_EMAIL_FROM` (adresse seule, expéditeur autorisé par le relais). TLS est imposé.
- Au moins une autorisation de déclenchement : `GSL_WORKER_SECRET` pour le statut et le POST internes, et/ou `CRON_SECRET` pour Vercel Cron. Fournir des secrets indépendants depuis le gestionnaire de secrets habituel ; aucune valeur ne figure dans le dépôt.
- Laisser `GSL_TRANSACTIONAL_EMAIL_ENABLED` désactivé tant que la configuration et la planification ne sont pas validées. L’activation exige la valeur exacte `true`.

L’inspection du statut se fait avec le point d’entrée GET interne ; elle n’envoie rien. Les essais de cette modification utilisent uniquement un transport simulé ; aucun déclenchement réel n’a été effectué.

## Cadence et capacité

La documentation Vercel consultée le 9 octobre 2026 indique : Hobby autorise une exécution quotidienne, avec une précision à l’heure ; Pro et Enterprise autorisent une cadence à la minute. Vercel Cron invoque la route de production en GET, avec le secret configuré dans l’en-tête d’autorisation. Sources officielles : [limites Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing), [fonctionnement](https://vercel.com/docs/cron-jobs), [sécurisation et exploitation](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

Le traitement actuel prend deux notifications par invocation. Une cadence quotidienne limiterait donc le débit à deux emails par jour, soit un seul contact direct nécessitant deux owners ; une demande de contact général génère déjà trois emails. Cette cadence ne satisfait pas le besoin de suivi des demandes. Aucun cron quotidien n’a été ajouté pour présenter artificiellement le traitement comme opérationnel.

Après confirmation d’un plan compatible, le bloc suivant peut être fusionné dans `vercel.json`, en conservant ses autres propriétés :

```json
{
  "crons": [
    {
      "path": "/api/internal/notifications/cron",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Cinq minutes donnent un plafond théorique de 576 notifications par jour avec ce lot de deux, avant échecs, reprises et indisponibilités. Deux emails par demande divisent cette capacité par deux. Le délai réel dépend de la profondeur de file et du relais ; il ne constitue pas un engagement de délai de livraison. Une cadence à la minute peut être étudiée sur un plan qui la permet. Un ordonnanceur déjà autorisé par l’organisation peut aussi appeler le POST interne à la cadence retenue. Aucun abonnement, compte ou ordonnanceur externe n’a été créé.

Vercel peut manquer ou dupliquer un déclenchement et ne relance pas automatiquement une invocation échouée. Les prises de lot PostgreSQL utilisent des verrous et un bail pour éviter de traiter simultanément la même ligne. Source : [gestion des Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Comportement en cas d’échec

Le destinataire est revérifié lors de la prise de lot : les comptes inactifs et les accès retirés ne reçoivent pas les événements encore en attente. Les échecs certains avant transfert SMTP peuvent être repris, au maximum cinq tentatives. Les erreurs après `DATA`, les acceptations SMTP dont l’accusé PostgreSQL est perdu et les baux interrompus restent des cas incertains ; ils ne sont jamais renvoyés aveuglément. Une acceptation SMTP indique la prise en charge par le relais, pas la livraison dans la boîte de réception.

Avant l’activation, examiner les lignes déjà présentes dans l’outbox : une migration sans backfill peut néanmoins coexister avec des notifications anciennes créées par l’application précédente. Toute reprise d’un état `failed` ou incertain requiert un examen de l’événement et de sa référence fournisseur. Le code n’effectue aucune remise en attente générale.

## Vérifications locales

```sh
node scripts/test-curated-messaging-postgres.mjs
node scripts/test-messaging-api.mjs
node scripts/test-notifications-worker.mjs
node scripts/test-postgres.mjs
node scripts/test-i18n-database.mjs
```

Ces tests utilisent PostgreSQL en mémoire et des adaptateurs HTTP/SMTP simulés. Ils couvrent les deux owners et 50 entreprises, les restrictions AAL2, les révocations, les identités de réponse, le routage direct/RFQ/contact, la déduplication, l’absence de backfill et les limites de reprise. Ils ne prétendent pas valider la délivrabilité d’un futur relais.
