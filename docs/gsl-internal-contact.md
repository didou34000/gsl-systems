# Contact des fabricants par la messagerie GSL

Les fiches fabricants et produits proposent le contact par `/messagerie`. Les coordonnées directes, les cartes externes et les liens sortants des sources ne sont plus affichés. Les références documentaires restent lisibles. Le catalogue public et ses réponses API filtrent aussi les coordonnées et les URL présentes dans les données publiées, y compris les blocs de recherche encodés en JSON. Les dossiers privés et les outils documentaires d’administration conservent leurs données.

## Mise en service

Appliquer `supabase/migrations/20261021150000_gsl_internal_contact.sql` sur le projet Supabase GSL avant le déploiement du code, après vérification des migrations existantes. Elle dépend notamment des migrations `curated_catalogue_management` et `curated_owner_messaging` du 9 octobre. Recharger le schéma PostgREST après application. Aucune migration hébergée n’est exécutée par la création ou la fusion de cette PR.

La migration retire `referenceContact` et `website` des projections publiques existantes et empêche leur retour lors d’une republication. Les informations du dossier fournisseur privé restent conservées. L’ancienne case autorisant la publication du contact disparaît du formulaire.

Les cinq fabricants repérés n’ont pas de compte fournisseur. Pour eux, `referenced_messaging_target` crée au premier accès authentifié un destinataire documentaire géré par les owners GSL existants. Le visiteur n’obtient aucune appartenance au fabricant. Les messages, réponses, notifications et contrôles MFA réutilisent le système interne existant. Aucun produit n’est admis au catalogue par cette opération et aucun fabricant externe n’est contacté automatiquement. Un owner GSL actif doit déjà être configuré.

## Vérifications

- Compilation de production et TypeScript.
- Tests PostgreSQL complets : publication, confidentialité, produits, fichiers et échanges.
- Tests API de messagerie et du catalogue public, dont le retrait des contacts sans altérer les valeurs techniques.
- Tests des cinq destinataires repérés : idempotence, réponses des owners GSL, absence de droits fournisseur pour le visiteur, refus des accès anonymes et non autorisés, retrait d’une fiche.
- Contrôle dans le navigateur de WAT et de son produit : aucun lien externe dans la fiche, bouton vers la messagerie, référence produit conservée dans le premier brouillon. Envoi vérifié avec des comptes synthétiques locaux, sans service hébergé.
