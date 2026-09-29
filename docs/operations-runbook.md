# Exploitation et incidents

## Notifications

Configurer le SMTP transactionnel déjà autorisé, son expéditeur et le secret `GSL_WORKER_SECRET`. L'endpoint `POST /api/internal/notifications` exige `Authorization: Bearer <secret>`. Aucun secret n'est passé dans l'URL. Le scheduler reste à configurer dans l'environnement de test puis de production autorisé ; aucun cron facturé n'est créé automatiquement.

Chaque invocation prend au maximum deux tâches, avec verrou PostgreSQL SKIP LOCKED, bail et cinq tentatives maximum. Les erreurs de connexion éligibles sont reprises avec délai. Une interruption après une remise SMTP possible est marquée incertaine pour examen humain : ne pas renvoyer aveuglément. Vérifier le prestataire avec l'identifiant stable du message avant correction de la file. Les tâches sont créées dans la transaction métier.

Le transport actuel est SMTP : il ne reçoit pas de webhooks de livraison. Aucun endpoint non signé n'accepte de déclarations de livraison. Le suivi de rebond/livraison par webhook reste à intégrer si le prestataire retenu le fournit. SPF, DKIM, DMARC et la réception réelle FR/EN restent à vérifier. Le secret SMTP Auth et celui du worker sont des configurations distinctes.

## Fichiers

Dépôt maximal applicatif : 3 Mio ; 40 pièces onboarding ou 20 pièces par demande. Les réservations sont sérialisées avec le dossier. Les images/PDF sont contrôlés par signature. Aucun écrasement d'objet n'est autorisé.

Pour les demandes, configurer `GSL_SCAN_URL`, `GSL_SCAN_TOKEN` et la clé de service serveur. Le processeur HTTPS autorisé reçoit les octets bruts, un bearer et `X-Content-SHA256`. Il doit retourner JSON `{ "sha256": "digest exact", "verdict": "clean" ou "rejected" }` après une analyse réelle. Un timeout, code d'erreur ou digest différent laisse pending. Aucune redirection n'est suivie ; aucun URL de scanner ne provient d'un utilisateur. Le processeur et son traitement des documents doivent être approuvés avant configuration.

Sans scanner, dépôt métier désactivé. Les documents d'onboarding restent privés et en quarantaine ; les reviewers sont avertis avant téléchargement. Les photos éligibles ont une attestation de droits et une approbation séparée. Sharp décode le raster, borne à 1600 px et réencode en WebP sans EXIF/ICC ; le test exécute réellement cette transformation. Le bucket des dérivées reste privé : la route média sert seulement les images dont la fiche est encore publiée. Ne jamais rendre le bucket d'onboarding public.

Transfert interrompu : le propriétaire voit les opérations incomplètes et peut demander leur retrait puis recommencer. La suppression est annoncée seulement après suppression Storage et confirmation de métadonnées. Une demande transmise garde ses pièces immuables. Une pièce ciblée sur X n'est visible ni dans les métadonnées ni dans Storage pour Y. Un job automatique de nettoyage ancien reste à configurer/valider ; ne pas effacer des objets actifs par ancienneté seule.

## Incident d'accès ou document problématique

Retirer la publication via la commande de revue `withdraw`, relever l'identifiant de ressource et l'heure, révoquer les membres concernés si nécessaire. Ne pas copier le document ni les tokens dans un ticket public. Les téléchargements métier contrôlent les droits actuels ; les anciennes URL signées d'onboarding ont une validité maximale de dix minutes. Un document déjà téléchargé ne peut pas être repris.

## Sauvegarde et déploiement

Avant migration hébergée : rapprocher les cinq versions historiques, sauvegarder le schéma et les données suivant les capacités du forfait, inventorier les objets Storage et versions de configuration. Tester une restauration sur une cible dédiée. **Cette restauration n'a pas été exécutée dans cette passe.**

Déployer la branche en preview avec la base de test. Après recette, promouvoir le commit autorisé et ses migrations additives. En incident, revenir au déploiement applicatif antérieur compatible ; ne pas supprimer les nouvelles tables ayant reçu des demandes. Conserver le schéma et appliquer une correction en avant. Si une restauration s'impose, arrêter les écritures, définir la fenêtre de perte et faire valider l'opération avant exécution.

## Droits, export et conservation

Le retrait de membre prend effet dans RLS. Le propriétaire ne se retire pas lui-même via le formulaire. L'export et la suppression de données passent actuellement par une demande au contact GSL, avec contrôle d'identité et du périmètre. Le compte dispose d'un export JSON sous les droits actuels et d'une demande de suppression enregistrée, idempotente et visible à l'exploitation. La suppression finale et une politique de rétention validée restent nécessaires ; ne pas déclarer le lancement commercial prêt. Ne pas effacer l'historique appartenant également à une autre partie.

## Logs et performance

Ne journaliser ni contenu des plans, ni clés, ni tokens, ni URL signée entière. Conserver seulement référence, commande, statut et code d'erreur lorsqu'une trace est nécessaire. Les interfaces de revue exposent les retards de file ; alerting externe et durées de conservation des logs restent à configurer.

Objectifs de recette à mesurer : absence de débordement à 390 px, LCP ≤ 2,5 s sur profil mobile représentatif, CLS ≤ 0,1, recherche initiale indépendante de la vidéo. Les seuils ne sont pas des résultats. La vérification actuelle a confirmé un scrollWidth égal à 390 px sur le catalogue ; aucun score Lighthouse/Core Web Vitals n'est revendiqué.
