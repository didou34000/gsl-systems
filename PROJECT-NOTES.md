# CD systems — version B2B privée

## Livré
Identité et catalogue de démonstration précédents conservés. `/professionnel` apporte :
- Organisation acheteur ou fournisseur, une adhésion par identité; rôle propriétaire fixé côté serveur. Aucun auto-octroi de rôle de revue.
- Entreprise et produits en base : brouillon, soumission, validation/rejet motivé, publication explicite. Toute modification remet la fiche en brouillon et retire sa publication. Une entreprise non publiée masque ses produits.
- Registre documentaire déclaré (référence, émetteur, périmètre), revue et historique. Ce n’est ni un hébergement de pièces ni une certification.
- Demandes de devis : création, édition et suppression logique du brouillon; envoi interne explicite à 1–10 fournisseurs publiés; un fil privé distinct par fournisseur.
- Messages persistants et propositions chiffrées en EUR HT, avec délai et conditions. Aucun email externe, paiement ni commande.
- Recherche des produits publiés en base au-dessus du catalogue fictif. Les anciens brouillons de démonstration restent accessibles séparément dans `/espace`.

## Accès et autorisations
L’identité vient de `getChatGPTUser()` et des en-têtes de confiance du dispatcher Sites. Toutes les lectures et écritures privées sont autorisées côté serveur (`lib/b2b/api.ts`). Aucun identifiant d’utilisateur, rôle ou propriétaire fourni par le client n’est accepté. Les fournisseurs ne voient que leurs propres fiches et les conversations dont ils sont participants. Le propriétaire de la demande voit un fil par destinataire; les fournisseurs ne voient jamais les offres des autres destinataires.
Les mutations exigent l’origine de l’application, une entrée strictement validée et, pour les transitions/éditions, la révision courante. D1 batch rend atomiques création+adhésion, décision+journal et envoi+création des fils. Les suppressions concernent uniquement les brouillons et sont logiques.

## Mise en service de la revue — dépendance restante
Aucun responsable de revue n’est attribué dans la production par ce lot. Le site affiche cette absence. L’exploitation doit désigner explicitement l’identité Sites de la personne autorisée : elle figure dans « Entreprise → Identité de connexion ». Un opérateur habilité peut ensuite renseigner la variable serveur `CD_REVIEWER_USER_IDS` avec cet identifiant exact (liste séparée par virgules), puis publier la configuration. Ne pas utiliser un email ni l’identifiant de compte affiché par l’outil de partage : ils ne sont pas nécessairement le sujet Sites. Autre mécanisme réservé à l’exploitation : table `reviewers` avec traçabilité du grant. Aucun endpoint de l’application ne modifie ces privilèges.
Le site reste privé, accessible au propriétaire uniquement, avec `noindex`. Un test multi-utilisateur en ligne nécessite que l’utilisateur autorise explicitement d’autres comptes dans le partage Sites. Aucun partage n’a été élargi. Aucun fabricant réel n’a été contacté.

## Validation reproductible
`node scripts/test-b2b.mjs` : 106 assertions HTTP/statuts/données, cinq identités fictives A/B/C/D/reviewer, base SQLite isolée migrée puis réouverte. Le serveur de test injecte ces identités exclusivement dans le processus de test; cette simulation n’est jamais importée par l’application ni publiée. Le handler testé est celui utilisé par `/api/business`.
Couvre l’isolation entre organisations, refus d’auto-validation et de propriétaire usurpé, rejet d’origine externe, états de publication/rejet, remise en brouillon après édition, révisions obsolètes, registre documentaire, modification/suppression/envoi de demande, refus des accès des tiers et des fournisseurs voisins, propositions et messages persistants après réouverture de la base.
Test navigateur sur le runtime D1 local : inscription d’un fournisseur fictif, création de produit, soumission, statut retrouvé après rechargement. TypeScript et build de production contrôlés séparément. Les tests ne certifient pas la connexion SIWC de plusieurs comptes réels en ligne.

## Limites connues et prochaines décisions
Une organisation par identité; pas d’invitations de collaborateurs dans l’app. Pas de fichiers documentaires, seulement le registre de revue. Actualisation manuelle des conversations. Pas de notifications email, de recrutement ni de contrôle réel des fabricants. Catalogue de réseau limité à 100 résultats par requête dans ce pilote. Les anciens brouillons de démonstration ne sont pas convertis automatiquement en demandes du réseau. Les règles juridiques, de conservation et les commissions restent à définir avant l’ouverture commerciale.
