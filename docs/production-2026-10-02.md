# Sourcing, questionnaire et messagerie — 2 octobre 2026

## Changements

Le questionnaire utilise des sélecteurs de pays natifs, accepte les quantités décimales avec espaces et vérifie les dates calendaires. Les étapes déjà parcourues restent accessibles et l'étape courante est conservée dans l'onglet. La demande est enregistrée comme brouillon privé avant sélection des destinataires.

L'accueil présente des photographies industrielles. La carte mondiale est grisée et seuls TR, MA, TN, GE sont interactifs, conformément au catalogue de pays d'origine. Les pays de livraison et d'immatriculation restent distincts du périmètre de sourcing.

La messagerie produit utilise deux nouvelles tables sous RLS, un historique paginé et une commande idempotente. Le destinataire est déduit du produit publié, jamais fourni librement par le navigateur. Les rôles acheteur et commercial sont contrôlés pour chaque lecture et écriture. Les messages restent consultables et les réponses possibles après retrait du produit ; aucune nouvelle conversation ne peut alors être créée. Les notifications de cette messagerie sont internes (actualisation périodique), sans promesse d'email ni de statut de lecture.

## Configuration et migrations

Le projet Vercel ne contenait aucune variable. GSL_ENVIRONMENT, GSL_SITE_URL, SUPABASE_URL et SUPABASE_PUBLISHABLE_KEY ont été ajoutées en Production uniquement. Aucune clé de service n'est nécessaire à ces parcours.

Les cinq premières migrations hébergées ont été comparées aux sources locales (identiques, hors commentaire de la migration membership). Les migrations suivantes ont été appliquées via Supabase après réussite des tests PostgreSQL locaux :

| Source locale | Version hébergée |
| --- | --- |
| 20260929112314_operational_workflows | 20261002141106 |
| 20260929160000_workspace_pagination | 20261002141204 |
| 20261002135754_product_messaging | 20261002141210 |
| 20260929114840_complete_operational_actions | 20261002141607 |

La migration complete_operational_actions a été autorisée explicitement par l'utilisateur après présentation de son impact sur fichiers, revue et notifications. Les horodatages hébergés diffèrent des fichiers ; ne pas lancer un push automatique sans rapprocher l'historique.

## Vérification

- Tests PostgreSQL isolés : création/réponse acheteur-fabricant, déduplication, refus des tiers et de l'usurpation d'entreprise, révocation d'accès et retrait de produit.
- Suite opérationnelle existante : parcours RFQ, isolation des fichiers, revue/publication, invitations et pagination.
- Questionnaire : sérialisation complète, quantités, dates impossibles, navigation et saisie vérifiées dans Chrome.
- TypeScript et compilation de production réussis ; lint sans erreur (avertissements existants).
- La recherche hébergée retourne un catalogue vide valide. Aucune entreprise, conversation ou donnée de démonstration n'a été créée en production.

Un échange avec de vrais comptes ne peut être démontré avant publication d'un premier fabricant et d'un produit. La livraison réelle des emails Auth n'a pas été retestée avec une boîte utilisateur pendant cette intervention.

L'analyse Supabase ne signale aucune anomalie RLS sur les nouvelles tables. Les tables internes fermées par défaut restent sans politique de lecture publique, intentionnellement. L'avertissement préexistant de [protection contre les mots de passe compromis](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) reste à traiter dans la configuration Auth.
