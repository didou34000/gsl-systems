# Dashboard administrateur — livraison locale des 6 et 7 octobre 2026

## Gestion des autorisations — 7 octobre

L’onglet « Accès et données » présente les autorisations du compte connecté, une matrice de quatre rôles et le périmètre de chaque catégorie de données. Les analystes consultent les indicateurs, le catalogue et leur activité autorisée. Les opérateurs peuvent aussi traiter les contacts et gérer leurs tâches. Les administrateurs disposent de l’export. Seuls les propriétaires gèrent les accès.

Le propriétaire peut attribuer un rôle à un compte existant confirmé et actif, changer un rôle ou révoquer un accès. Chaque opération exige un motif de 10 à 500 caractères et une confirmation indiquant le compte et les droits concernés. L’historique conserve auteur, compte, ancien et nouveau rôle, motif et date. Les comptes ne peuvent pas modifier leur propre accès ; le dernier propriétaire est protégé.

PostgreSQL vérifie les permissions à chaque commande, y compris avec un ancien jeton après révocation ou suspension. L’interface masque les actions non autorisées et réactualise les droits au retour dans l’onglet et chaque minute lorsqu’elle est visible. Les contenus des contacts et les registres d’accès sont filtrés côté serveur. Les conversations, justificatifs et brouillons privés conservent leurs droits distincts.

Les exports passent désormais par une API protégée, sont journalisés et limités à 5 000 lignes avec indication de troncature. Une confirmation précise qu’ils portent sur la collection autorisée et que les filtres affichés ne s’appliquent pas. La désactivation d’un export n’empêche pas de copier des données déjà visibles, et la révocation ne rappelle pas les fichiers déjà téléchargés.

Vérifications supplémentaires : matrice SQL des quatre rôles, faux droits dans les métadonnées, appels directs et anciennes fonctions, comptes suspendus, protection du dernier propriétaire, audit immuable, conflits de révisions et limite de 5 000 exports. Les tests HTTP portent sur les accès et l’export CSV, avec colonnes autorisées, formules neutralisées et réponses non mises en cache. Les 100 nouveaux libellés disposent de dix traductions. Les tests opérationnels existants passent également.

Essais navigateur sur fixtures isolées : attribution, réduction puis révocation d’un compte fictif, trois traces d’audit et persistance après rechargement ; vues analyste et opérateur sans commandes interdites ; export serveur accepté. À une largeur de fenêtre de 390 px, les panneaux français et arabes restent dans la page, les tableaux défilent à l’intérieur et les boutons de confirmation sont entièrement visibles. Le navigateur intégré n’a pas signalé son événement de téléchargement : la réception physique du fichier reste à vérifier dans le navigateur cible. Aucun droit réel n’a été attribué.

## Fonctionnalités livrées dans le code local

- `/administration` : vue d’ensemble, indicateurs de la base, graphique sur 7 ou 30 jours, entreprises et produits publiés/retirés, recherche, filtres, détails et export CSV.
- Contacts : consultation, traitement et réouverture, sans envoi de réponse automatique.
- Tâches personnelles : création, modification, suppression, priorité, échéance, déplacement entre colonnes et tri. Les boutons et sélecteurs offrent une alternative au glisser-déposer.
- Modules de la vue d’ensemble : réordonnancement enregistré, poignées souris/tactiles, commandes clavier et remise à zéro.
- Accès par rôle administrateur explicite, compte confirmé et double authentification. Le rôle de contrôleur documentaire reste distinct. L’entrée apparaît dans le compte uniquement après reconnaissance du rôle côté serveur.
- Dépôt des logos, photos et justificatifs par zone de dépôt ou sélection de fichier ; réordonnancement des photos avec sauvegarde dans le brouillon fournisseur.
- Dix langues sur les principaux parcours et dans le dashboard. Arabe de droite à gauche, préférence conservée, QR code pour l’activation de la double authentification.

## Vérifications terminées

- Build Next.js optimisé et TypeScript : réussis.
- Lint : aucune erreur ; 54 avertissements principalement sur les images et les dépendances de hooks.
- `npm run test:admin` : permissions, MFA, RLS, isolation entre administrateurs, CRUD, ordre, contacts, validation, conflits de révision, API et contenu CSV.
- `npm run test:i18n` : 1 161 clés partagées, 1 178 appels d’interface et 66 appels d’exigences pays ; persistance et API pour les dix langues ; contrôles fournisseur et libellés générés. Le dashboard dispose en plus de 185 libellés dans chacune des dix langues.
- `npm run test:operational` : règles et migrations complètes sur PostgreSQL embarqué, fournisseur, fichiers, produits, demandes et images.
- Navigateur sur données locales fictives : création et déplacement d’une tâche, changement de statut, traitement/réouverture d’un contact, réordonnancement des modules puis rechargement, ajout de deux photos et réordonnancement persistant, changement de langue, états connexion/permissions/MFA/panne/vide.
- Mobile à 390 px : aucun débordement horizontal de la page, menu fermé masqué aux technologies d’assistance, affichage arabe RTL contrôlé.

Les tests SQL utilisent PGlite isolé. Les essais visuels passent par des fixtures locales en mémoire ; ils ne prouvent pas la session Supabase hébergée ni la livraison d’emails. La génération CSV est testée, mais l’événement de téléchargement du navigateur intégré n’a pas été observé ; la réception du fichier reste à confirmer dans un navigateur de déploiement. Les gestes tactiles ont été relus, sans essai sur appareil physique.

## Activation restante

Le 7 octobre, l’utilisateur a confirmé `dorian.vuattoux@gmail.com` comme compte à habiliter au niveau maximal. La lecture ciblée de la production a confirmé que ce compte existe, que son email est confirmé, qu’il est actif et qu’il n’a pas encore de facteur MFA vérifié ni d’habilitation reviewer. Aucun rôle réel n’a encore été attribué.

Les tables d’administration sont absentes de la production. La validation automatique a refusé la première migration, en demandant un accord explicite pour les changements de schéma et de droits en production. La procédure exacte, prête à exécuter après cet accord, est décrite dans [admin-owner-activation.md](admin-owner-activation.md). Elle applique les quatre migrations nécessaires puis attribue `owner` et reviewer au compte existant, avec audit. Aucune migration ne promeut automatiquement une adresse email. La connexion réelle AAL2, le déploiement du code et les sauvegardes hébergées restent à vérifier séparément.

La portée linguistique et les exceptions des anciens contenus et emails sont décrites dans [localization.md](localization.md). Les droits, limites de collections et commandes sont détaillés dans [admin-backend.md](admin-backend.md).

## Prévisualisation locale

Avec le build Next démarré sur `127.0.0.1:5173`, lancer `node scripts/serve-admin-fixtures.mjs` puis ouvrir `http://127.0.0.1:5189/administration?lang=fr`. Les noms et adresses sont fictifs ; les actions restent dans le processus de test et disparaissent à son arrêt. Ce serveur de fixtures ne fait pas partie de l’application déployée.
