# Guide de revue

## Habilitation

Un opérateur doit confirmer l'identité du responsable, l'UUID de son compte Supabase confirmé et son périmètre. Un administrateur autorisé inscrit ce compte dans `private.platform_reviewers` via un accès serveur contrôlé. Ne jamais utiliser une métadonnée utilisateur, un domaine email ou un nom comme autorisation. Aucun reviewer n'a été créé dans la production pendant cette reprise.

Le code exige un JWT `aal2` dans `private.is_reviewer()` : une simple session `aal1` est refusée, même avec l'habilitation privée. La migration `reviewer_active_account` ajoute le contrôle en direct du compte confirmé, non suspendu et non supprimé, y compris avec un ancien jeton. L'écran Compte permet l'enrôlement et la vérification TOTP via Supabase. Les refus sont testés en PostgreSQL local ; l'enrôlement réel et le renouvellement des cookies AAL2 restent à valider sur Supabase hébergé. En perte du facteur, un opérateur doit vérifier l'identité avant toute récupération dans l'administration Supabase ; aucun contournement n'est codé dans le frontend.

## Traitement

1. Ouvrir `/administration/revue`. Prendre en charge le dossier ; une attribution existante à une autre personne bloque la prise en charge.
2. Examiner la version soumise et les pièces privées nécessaires. Les téléchargements passent par le serveur et sont réservés au reviewer assigné. Un fichier non analysé n'est pas déclaré sûr.
3. Vérifier identité/représentation, périmètre des capacités/documents et champs publiables. Consigner les sources, dates et limites dans la note **interne** ; elle ne doit pas être copiée dans le retour au fournisseur.
4. Demander un complément avec un retour compréhensible ou publier après enregistrement des trois contrôles. La décision porte sur la révision exacte.
5. Consulter la fiche publique et la recherche. La publication expose une liste blanche, jamais le payload privé.

La conversion est transactionnelle. Une double commande identique restitue son résultat ; la réutilisation de sa clé avec un contenu différent est refusée. Un identifiant d'entreprise déjà attribué bloque la seconde création et n'accorde aucune adhésion. Le rattachement d'une nouvelle personne à une entreprise existante doit passer par l'invitation d'un membre habilité ou une procédure opérateur documentée.

## Changements après publication

Le fournisseur peut reprendre son dossier après confirmation du retrait public. Il reste propriétaire du brouillon, tandis que les soumissions et décisions précédentes sont conservées. Une nouvelle revue republie la même organisation ; les produits gardent leur identité lorsqu'ils gardent leur référence. Les anciennes capacités/sites normalisés sont marqués retirés, les anciennes projections produits non reprises restent retirées.

Cette première politique retire la fiche pendant toute révision, y compris éditoriale. Un circuit de correction éditoriale sans retrait n'est pas encore implémenté. Le rattachement d'identifiants historiques nécessite un examen humain ; ne pas libérer automatiquement une identité déjà revendiquée.

## Exploitation

L'écran présente les demandes de contact non traitées, le nombre et l'âge des emails en attente et les échecs d'envoi. « Marquer traitée » ne répond pas au contact et ne lui envoie rien. Toute réponse humaine doit être réellement effectuée par l'opérateur via sa messagerie.

Un accusé SMTP n'est pas une livraison reçue. Le détail de la file est réservé aux opérateurs ; aucune pièce jointe confidentielle n'est incluse dans les notifications.

## Refus de publication

Le reviewer assigné peut refuser une version avec un motif visible du fournisseur. La décision est historisée et sa notification mise en file. Le dossier passe en lecture seule ; le fournisseur peut contacter GSL pour demander un réexamen, mais ne peut ni s’auto-publier ni effacer le refus en rouvrant le dossier. Un circuit de recours administratif dans l’interface reste à compléter.
