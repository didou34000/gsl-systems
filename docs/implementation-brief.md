# PROMPT MAÎTRE — Finaliser GSL Systems avec Supabase

**Version du 29 septembre 2026 · Cahier d’implémentation, pas simple proposition graphique**

## Mode d’emploi

Fournir ce document intégralement à l’agent de développement qui possède le dépôt GSL Systems et les accès techniques autorisés. Lui fournir également l’audit et la grille de recette joints. Le texte ci-dessous constitue sa mission. Les constats sont datés : l’agent doit comparer l’état actuel aux fichiers audités avant de corriger. Il ne doit pas écraser des changements plus récents.

La présence de ce prompt ne signifie pas que son contenu a été développé. Le résultat attendu est une implémentation démontrée, avec tests et compte rendu d’exécution. Le dépôt et Supabase n’ont pas été modifiés par l’auditeur.

---

## 01 — Ta mission et le résultat attendu

Tu interviens comme responsable produit, développeur full-stack, spécialiste Supabase, concepteur des parcours et responsable qualité. Termine la version opérationnelle de GSL Systems, sans repartir arbitrairement de zéro. Le produit doit aider un acheteur à trouver des fabricants pertinents, comprendre leurs capacités et leurs limites, envoyer une demande de devis explicite, puis comparer les réponses dans un espace privé. Un fournisseur doit pouvoir s’inscrire simplement, enrichir son dossier progressivement et publier ses informations après une revue autorisée.

Ne réponds pas uniquement avec une analyse, des maquettes, une nouvelle liste de tâches ou des composants factices. Travaille dans le code, implémente les migrations nécessaires dans l’environnement autorisé, exécute les tests, corrige les défauts observés et fournis les preuves. Conserve une liste persistante des tâches pour ne pas oublier les exigences en cours de travail.

Une version « terminée » possède un circuit complet et vérifié : compte fournisseur → entreprise → capacités et offre → dossier soumis → revue → publication réelle → recherche acheteur → sélection → demande transmise → notification → réponse du fournisseur → comparaison. Aucun bouton présenté comme actif ne doit aboutir à une simulation, une liste artificiellement vide ou un succès non enregistré.

Sépare quatre états dans ton compte rendu : implémenté ; testé ; déployé dans un environnement identifié ; bloqué par une dépendance externe. Ne confonds jamais compilation réussie, test local, livraison email et fonctionnement en production. Ne promets pas de revenus ni de classement Google : ce travail vise une plateforme exploitable, pas une garantie commerciale.

## 02 — Contexte exact et observations à revalider

Projet : GSL Systems, domaine `gsl-systems.com`, dépôt `didou34000/gsl-systems`. L’audit a lu le commit `ca1f72f62e1326156f6438e7dc9f2002d94028ac`, daté du 27 septembre 2026. La structure observée mélange un historique Sites/Cloudflare/D1 et un déploiement Next.js/Vercel, avec Supabase Auth et un début d’onboarding Supabase.

Le projet Supabase identifié s’appelle « GSL Systems », référence `ihugldueruspxdyooycc`. Cette référence identifie l’existant : **elle ne doit jamais être la cible par défaut d’un test, d’un seed, d’une remise à zéro ou d’une migration destructive**. L’utilisateur confirme disposer d’un email de contact. Son adresse exacte et l’identité juridique à publier ne sont pas confirmées dans le présent document.

Les constats suivants sont un point de départ à vérifier contre la branche actuelle :

- `app/api/business/route.ts` renvoie, en mode Vercel, un catalogue vide pour `view=catalogue`, et une indisponibilité pour les autres opérations. Le chemin alternatif reste lié à D1 et à l’identité Sites.
- `lib/hosting.ts` produit `WORKSPACE_NOT_OPEN`. `next.config.ts` choisit la cible Vercel à partir de l’environnement et substitue l’import Cloudflare.
- `app/api/workspace/route.ts` retourne le compte Supabase mais des listes vides de brouillons et favoris sur Vercel ; ses écritures restent fermées sur cette cible.
- `app/api/supplier-profile/route.ts` enregistre un dossier JSON dans Supabase. Cette route ne réalise pas le passage complet du dossier à une organisation normalisée et à une publication.
- `lib/onboarding/country-options.ts` ne propose que FR, DE, IT, ES, PL, RO, GB, TR, GE, MA, TN, US et CN. Les fiches locales détaillées sont FR, TR, GE, MA et TN ; un mécanisme de revue manuelle existe pour les autres.
- `lib/onboarding/supplier-profile.ts` exige notamment logo, URL professionnelle, description longue et référence d’offre pour soumettre. Le même schéma strict est utilisé pour sauvegarder et soumettre.
- `app/auth/callback/route.ts` ne restitue pas l’intention initiale après confirmation par lien. La vérification par code exige huit chiffres : aligner cette exigence sur la configuration réelle, sans supposer qu’elle est incorrecte.
- `lib/operator.ts` est vide. `app/operator-contact.tsx` ne rend le contact que si un nom ou une entreprise est renseigné : ajouter uniquement l’email ne suffit pas.
- `app/discovery.tsx` donne la priorité au catalogue fictif ; l’accueil utilise également des données de démonstration.
- `app/layout.tsx` applique globalement `noindex` et `nofollow`, avec des métadonnées de démonstration. La langue et les routes doivent être rendues cohérentes.

L’audit a trouvé 29 tables publiques avec RLS activée et des buckets privés. Les compteurs métier lus étaient nuls pour organisations, dossiers fournisseurs, fournisseurs publiés, produits publiés, demandes et offres. Cela n’autorise aucune suppression : des comptes, réglages, historiques ou données dans un ancien stockage peuvent exister. La réception des emails, le rendu public et les tests de bout en bout n’ont pas été validés par l’audit.

## 03 — Méthode d’intervention et garde-fous

Commence par un inventaire : état Git, branche, changements non commités, scripts, runtime, variables attendues, schéma Supabase, migrations appliquées, rôles, règles Storage et routes réellement actives. Compare avec l’audit. Enregistre dans `docs/implementation-status.md` la matrice des exigences, leur statut et leur preuve. Ne traite pas un commentaire « livré » dans d’anciennes notes comme un test actuel.

Travaille sur une branche dédiée et un environnement de développement ou de préproduction autorisé. Lis les procédures d’hébergement présentes dans le projet avant d’installer ou de remplacer l’outillage. Conserve le lockfile. Ne lance pas des mises à jour globales de dépendances dans le cadre d’une correction ciblée. Vérifie les documentations officielles correspondant aux versions réellement utilisées.

N’effectue pas de reset Supabase, de suppression d’utilisateurs, de remplacement massif de tables ou de publication de données privées. Toute migration doit être additive autant que possible, documentée, testée sur une copie adaptée et accompagnée d’une stratégie de retour arrière. Ne crée pas un projet payant, un service email, un abonnement, un scanner ou une branche facturée sans autorisation. N’envoie pas de messages à de vrais fournisseurs pour « tester ».

Ne corrige jamais une erreur en désactivant RLS, en créant une politique publique permissive, en exposant une clé d’administration ou en acceptant l’organisation indiquée par le client sans contrôle. Ne copie pas les données de production dans des fixtures. N’intègre aucune information personnelle trouvée dans un compte connecté ou dans les auteurs Git comme coordonnées professionnelles de l’exploitant.

Les accès ou faits externes manquants doivent être inscrits dans un registre de dépendances. Continue les parties indépendantes. N’invente pas des valeurs pour faire disparaître ces dépendances. Une fonctionnalité dépendant d’un service non configuré doit être clairement désactivée ou marquée non opérationnelle dans l’environnement concerné, jamais simuler une réussite.

## 04 — Positionnement et périmètre de la première version

Conserve GSL comme plateforme de recherche et de mise en relation industrielle destinée notamment aux acheteurs européens. La couverture fournisseur doit pouvoir être internationale. Ne fais pas dépendre le fonctionnement d’un futur accord avec la Géorgie. Ne transforme pas automatiquement le site en plateforme de bâtiment : aucune verticale unique n’a été approuvée dans cette mission.

Organise les catégories comme une taxonomie configurable. Conserve les données utiles existantes, mais distingue clairement produits commercialisés, capacités de fabrication sur mesure, prestations de sous-traitance et services d’ingénierie. Un atelier qui fabrique sur plan ne doit pas inventer des références catalogue pour être présent.

La version initiale comprend recherche, profils publics, sélection, comptes, dossiers fournisseurs, revue interne, demandes de devis, conversations, offres, notifications, contact et exploitation. Elle ne comprend pas obligatoirement paiement en ligne, séquestre, calcul fiscal mondial, transport intégré, contrôles physiques d’usines ou certification réglementaire automatique. Ne présente pas ces prestations comme acquises.

Le sourcing accompagné peut être proposé si un opérateur est réellement disponible, avec consentement à lui partager le besoin et conditions explicites. La consultation autonome ne doit pas devenir un formulaire commercial opaque. La mise en avant payante éventuelle est identifiée et ne modifie pas artificiellement le niveau de conformité aux critères.

## 05 — Architecture de production et configuration

Pour la cible publique actuellement décrite, termine une architecture Next.js + Supabase cohérente. Toute utilisation restante de D1, des en-têtes d’identité Sites ou de `getChatGPTUser()` dans le parcours public doit être analysée et remplacée par un chemin compatible avec la cible, ou isolée explicitement comme ancien environnement. Ne retire pas le garde-fou Vercel pour exécuter simplement du code D1 incompatible.

Définis des modules serveur de domaine : organisations, profils fournisseurs, publication, recherche, demandes, échanges, offres, notifications, fichiers et revue. Les composants d’interface ne doivent pas contenir l’ensemble des règles d’autorisation. Conserve un client Supabase exécuté avec l’identité réelle de l’utilisateur pour les opérations ordinaires. Les opérations élevées doivent avoir une justification, une portée limitée et une trace d’audit.

Sors l’URL Supabase et les paramètres de déploiement du code en dur vers une configuration validée. Une clé publiable reste publique ; une clé secrète ou `service_role` reste exclusivement côté serveur et hors du dépôt. Prévois une configuration distincte production/préproduction/tests, avec un refus explicite d’exécuter les seeds de test contre la production. Les variables absentes doivent produire un diagnostic de déploiement, pas une interface feignant de fonctionner.

Documente les paramètres nécessaires dans un exemple sans secrets : URL canonique, environnement, Supabase, contact confirmé, expéditeur transactionnel, prestataire email, secret de webhook, politique de stockage et éventuellement scanner. Les noms exacts doivent correspondre au code. Ne réclame pas un service externe inutile : utilise d’abord les capacités déjà disponibles et autorisées.

Les réponses contenant identité, brouillons, messages, plans et tokens ne doivent pas être mises en cache publiquement. Sépare le cache du catalogue publié de celui des espaces privés. Prévois une invalidation explicite du cache public après publication, retrait ou changement critique. Ne renvoie aucune donnée privée dans les métadonnées ou dans un payload hydraté côté client.

## 06 — Arborescence, navigation et pages

Conserve les URL existantes utiles et ajoute des redirections explicites si elles changent. L’utilisateur doit comprendre où il se trouve sans connaître les anciens environnements. Organise les pages autour de : accueil, recherche/catalogue, fabricants, profil fabricant, produit/capacité, sélection, demande de devis, espace acheteur, espace fournisseur, compte, contact, méthode, aide et administration.

Les anciennes routes `/professionnel`, `/espace`, `/selection`, `/comparateur`, `/demande-de-devis` et `/espace-fournisseur` doivent être harmonisées, pas laissées en concurrence. Définis une destination principale pour chaque action. Un lien provenant d’un produit conserve l’identifiant du produit et le fournisseur ; un lien provenant d’un fournisseur conserve ce fournisseur sans imposer un produit fictif.

Isole toute démonstration dans un chemin tel que `/demo`, avec ses propres données, un bandeau permanent et aucune transmission extérieure. Le catalogue réel est le choix par défaut. Une base vide affiche un état vide honnête et une action utile : préciser le besoin, solliciter un accompagnement réellement disponible ou présenter sa capacité comme fournisseur. Ne transforme pas les entreprises fictives en sociétés réelles en retirant leur badge.

Le menu principal privilégie « Trouver un fabricant », « Décrire mon besoin » et « Devenir fournisseur ». Les actions du compte dépendent de ses rôles, sans empêcher une entreprise d’acheter et de vendre. Les pages légales et le contact restent accessibles depuis le pied de page. Tous les liens doivent être audités contre la route réelle, y compris sur mobile et après changement de langue.

## 07 — Recherche côté acheteur

L’accueil propose une recherche classique et, si une implémentation fiable est possible, une description libre du besoin. Le visiteur ne doit pas être obligé de parler à un chatbot. Une phrase comme « 500 boîtiers aluminium, fabrication UE, livraison à Lyon » devient une proposition de critères modifiables. Les quantités, lieux ou contraintes non mentionnés restent inconnus : ne les devine pas silencieusement.

Représente chaque critère par une clé stable, une valeur typée, une unité si nécessaire et un niveau obligatoire/préféré. Une contrainte obligatoire non satisfaite exclut le fournisseur du groupe « critères confirmés ». Une valeur inconnue n’est pas une confirmation ; elle peut apparaître dans un groupe séparé « à confirmer », uniquement avec une explication explicite. Ne relâche jamais les filtres sans action de l’acheteur.

Les filtres sont adaptés à la catégorie : procédé, matière, dimensions, tolérances, finition, quantité minimale, unités, type d’offre, lieu réel de fabrication, destinations servies, langues et documents correspondant au produit. Évite les champs universels sans sens. Un MOQ de 100 mètres ne doit pas être comparé à une demande de 100 pièces. Une conversion n’est autorisée que si elle est définie et applicable.

Le pays de siège, le pays d’un site de production, le lieu d’expédition et l’origine douanière ne sont pas interchangeables. Le filtre « fabrication dans l’UE » doit s’appuyer sur les sites ou les références de fabrication concernés, pas sur l’adresse du siège. La présence d’un bureau européen ne prouve pas une usine européenne. La capacité générale ne garantit pas la disponibilité sur une commande.

Chaque résultat montre la raison du rapprochement, les critères connus, les inconnues et la date de mise à jour pertinente. Supprime les scores de type « compatible à 97 % » non explicables. Classe d’abord par adéquation aux contraintes, puis par critères documentés de pertinence et de fraîcheur. N’invente pas un délai de réponse moyen avant d’avoir un historique suffisant et une définition stable.

Implémente d’abord un moteur structuré avec PostgreSQL, index adaptés, pagination serveur et recherche textuelle. Des synonymes éditorialisés FR/EN et une recherche tolérante peuvent suffire. N’ajoute pas systématiquement une base vectorielle ou une dépendance IA à chaque requête. Un éventuel parseur IA produit uniquement des critères validés contre un schéma ; il n’invente pas de fabricants ni de capacités, ne valide pas un document et ne transmet jamais une demande tout seul.

Conserve la recherche dans l’URL lorsque cela ne contient pas d’information sensible. Retour arrière, partage, rechargement et changement d’affichage doivent conserver filtres et pagination. Le texte d’un cahier des charges confidentiel ne doit pas être inscrit dans l’URL, les analytics ou les logs. Prévois états de chargement, indisponibilité et zéro résultat distincts.

## 08 — Fiches publiques et crédibilité

Une fiche fabricant doit présenter ce que l’entreprise fait réellement : nom commercial et raison sociale appropriés, activité, lieux de production autorisés à publication, procédés, matériaux, catégories, exemples de réalisations réels, marchés desservis et modalités de prise de contact. Les champs non renseignés ne deviennent ni zéro, ni « non », ni une valeur commerciale flatteuse.

Distingue fabricant, sous-traitant, distributeur et intermédiaire. Pour les sites partenaires, indique la relation et ce qui a été documenté. Une photo illustrative ne doit pas devenir une preuve d’usine. Les logos, images et références publiés doivent avoir une provenance et un droit d’utilisation. Les références clients ne sont pas inventées et ne sont publiées que lorsque leur usage est autorisé.

Les informations publiques proviennent d’une projection ou d’une version approuvée à champs autorisés. Ne renvoie jamais le JSON complet du dossier fournisseur à un visiteur. Adresse privée d’un entrepreneur, email personnel, extrait complet de registre, signature, données d’identité et rapports confidentiels ne sont pas publics par défaut. Les coordonnées de contact publiées nécessitent un choix distinct de la validation interne.

Affiche des états précis : informations déclarées ; identité examinée à une date ; document reçu ; document examiné pour un périmètre ; information à confirmer ; document expiré. La publication n’est pas une certification. Le contrôle de l’entreprise ne vaut pas contrôle physique de l’usine ni conformité de tous ses produits. Un document ISO de management ne remplace pas une déclaration réglementaire applicable à un produit.

Une fiche produit ou capacité distingue dimensions, matière, processus, quantité/unité, personnalisation, conditions indicatives et documents liés à la référence exacte. Une donnée de délai est datée et qualifiée comme indicative ou confirmée pour une offre. Une information expirée doit perdre son statut actuel automatiquement, sans effacer l’historique nécessaire.

## 09 — Sélection, compte acheteur et reprise

Autorise la consultation et la sélection de quelques profils sans compte. Le stockage local du visiteur peut contenir des identifiants de fiches publiques et des filtres non sensibles, mais pas des extraits d’identité ou des plans industriels. Au moment de sauvegarder durablement un besoin privé ou de le transmettre, explique pourquoi un compte est nécessaire.

Après connexion, propose de rattacher la sélection au compte sans écraser une sélection existante. Les identifiants disparus ou retirés sont signalés, jamais remplacés automatiquement par d’autres fournisseurs. Une entreprise peut disposer de plusieurs membres et, si le modèle le permet, un utilisateur de plusieurs entreprises ; le contexte actif reste visible.

La création d’un compte acheteur ne doit pas imposer un dossier de fabricant. Demande le minimum opérationnel : identité du contact, email confirmé, entreprise ou contexte professionnel, destination et éléments du besoin. Les justificatifs supplémentaires sont conditionnels à un besoin réel de contrôle ou à une opération précise, pas un obstacle automatique à toute demande.

Préserve `next`, langue, sélection et référence de brouillon à travers connexion, confirmation et réinitialisation. Les destinations de retour sont internes et validées ; un paramètre contenant une URL externe, une variante encodée ou un chemin ambigu est rejeté. Ne place pas le contenu privé du besoin dans les paramètres de retour.

## 10 — Inscription fournisseur en quatre temps

Le parcours doit distinguer **création de compte**, **profil minimum**, **enrichissement** et **revue/publication**. Ne transforme pas la première visite en collecte de tous les documents internationaux.

À l’entrée, demande au plus les informations permettant de créer le compte et de commencer : nom du contact, email, moyen de connexion, nom de l’entreprise, pays d’immatriculation et type d’activité. Selon l’architecture retenue, nom de société et pays peuvent même être saisis après confirmation. N’exige ni logo, ni certificat, ni photographie d’usine, ni site internet pour créer le compte.

Présente ensuite un profil minimum permettant de comprendre l’entreprise et son offre : activité, localisation pertinente, description courte utile, catégorie et au moins un produit, une capacité ou un service. Une référence catalogue n’est pas obligatoire pour une prestation sur plan ; un identifiant interne peut être généré sans être présenté comme un SKU commercial du fournisseur.

L’enrichissement comprend sites, équipements, capacités, marchés, conditions d’achat, images et justificatifs. Les rubriques facultatives portent explicitement cette mention et peuvent être reprises ultérieurement. La progression mesure les étapes réellement accomplies, sans associer complétude et vérification. Un profil avec logo n’est pas plus authentique qu’un profil sans logo.

Avant soumission, affiche uniquement les éléments nécessaires à la politique de revue applicable. Le fournisseur voit les champs qui seront publics, ceux qui resteront privés, les destinataires internes du dossier et la portée exacte de son attestation. La soumission ne publie rien automatiquement. Le dossier possède un statut consultable et un mécanisme de demande de complément.

Les questions changent selon l’activité. Un fabricant décrit ses propres moyens ; un sous-traitant ses procédés ; un distributeur les produits et sa relation avec les fabricants ; un intermédiaire sa fonction ; une société d’ingénierie ses services. N’exige pas une usine ou une machine à un acteur qui n’en possède légitimement pas. Ne coche pas « fabricant » à sa place sans confirmation explicite.

## 11 — Sauvegarde et qualité des formulaires

Implémente une autosauvegarde serveur après une courte période d’inactivité et lors des transitions pertinentes, sans multiplier les requêtes inutilement. Affiche clairement « modifications en cours », « enregistrement », « enregistré », « hors ligne » et « échec à réessayer ». N’affiche « enregistré » qu’après confirmation serveur. Une réponse échouée conserve la saisie à l’écran.

Utilise un schéma de brouillon distinct : bornes de taille et sécurité conservées, mais champs incomplets autorisés. La validation stricte s’effectue lors de la soumission et des opérations critiques. Un email encore en cours de frappe, une URL sans suffixe ou une décimale incomplète ne doit pas empêcher de préserver les autres informations valides du brouillon. Le serveur ne doit jamais accepter des champs de rôle ou d’approbation à travers ce mécanisme tolérant.

Conserve les révisions et le contrôle de concurrence. Deux onglets ne doivent pas s’écraser silencieusement. En cas de conflit, propose rechargement ou réconciliation des modifications avec confirmation de l’utilisateur ; ne remplace pas automatiquement la version serveur par la plus récente requête arrivée. Une soumission utilise une version complète et verrouillée du dossier et de ses pièces.

La navigation arrière, le rafraîchissement, la perte de connexion et l’expiration de session doivent être testés. Une reconnexion retrouve le dossier sans recréer une entreprise. N’utilise pas le stockage local durable comme cache de documents ou d’identifiants personnels. Une récupération temporaire de contenu sensible doit être justifiée, minimale, protégée et accompagnée d’une durée de conservation claire.

Les erreurs sont localisées par champ avec résumé cliquable, libellés accessibles et déplacement du focus vers le premier problème. Les champs obligatoires sont expliqués. Les valeurs numériques acceptent une saisie adaptée à la langue puis sont normalisées explicitement. Vérifie les dates calendaires réellement valides ; ne te contente pas du fait que JavaScript sait les convertir. Préserve les zéros initiaux des identifiants.

## 12 — Couverture mondiale et moteur de règles pays

L’objectif est de pouvoir traiter un fournisseur de tout pays ou territoire pris en charge par le référentiel international retenu, sans inventer une expertise juridique exhaustive. Distingue trois couches : référentiel de pays/adresses ; politique commerciale et opérationnelle d’admission ; règles documentées de revue par juridiction et forme juridique. Un pays présent dans un menu n’est pas automatiquement couvert par une vérification locale complète.

Utilise des codes stables ISO 3166-1, des noms localisés et un moteur de sélection recherchable au clavier. Drapeaux et groupes géographiques sont des aides visuelles, pas des clés de base de données. Sépare les listes autorisées pour le pays d’immatriculation, la destination et un site de fabrication lorsque la politique commerciale le nécessite. Un pays non encore documenté doit pouvoir être enregistré dans un brouillon et orienté vers la revue manuelle, sauf restriction d’admission réelle et expliquée.

Les adresses doivent tolérer lignes multiples, subdivisions variables, noms non latins et pays sans code postal applicable. Ne rends pas « département », « État », « province » ou « code postal » obligatoires partout. Préserve la forme d’origine et, si nécessaire, une translittération distincte. La présence de caractères arabes, géorgiens, chinois ou d’accents n’est pas une erreur. Les labels et l’ordre des champs doivent provenir d’un référentiel maintenu et dont la licence est respectée.

Un téléphone est analysé avec un indicatif et une bibliothèque maintenue ; conserve la saisie d’origine et une forme normalisée lorsqu’elle est valide. La validation de format ne signifie pas possession du numéro. Une devise utilise un code ISO 4217 et des règles de décimales adaptées ; n’impose pas EUR au fournisseur. Langues, fuseaux horaires, unités et dates sont explicités plutôt que déduits automatiquement du pays.

Le modèle de règle pays doit comporter au minimum : code pays ; juridiction/subdivision si nécessaire ; types d’entités concernés ; autorité d’immatriculation ; noms des identifiants ; distinction registre/fiscalité/TVA ; champs requis selon la politique GSL ; pièces acceptées et alternatives ; niveaux de confidentialité ; mode de revue ; sources officielles ; date de recherche ; version ; responsable de maintenance ; état actif/à revoir. Un lien officiel n’est pas une preuve que tous les champs sont légalement obligatoires.

Conserve les cinq modèles existants FR/TR/GE/MA/TN après relecture de leurs sources. Pour les autres pays déjà proposés, complète uniquement ce qui est documenté. Pour les juridictions restantes, crée un comportement de secours utilisable : raison sociale dans l’écriture locale, pays et forme juridique, autorité du registre si applicable, identifiant d’entreprise si applicable, justificatif ou explication d’absence, revue humaine. Ne crée pas 249 faux modèles « vérifiés » à partir d’une même fiche générique.

Pour les 13 pays actuellement visibles, respecte au minimum ces distinctions, à revalider sur source officielle lors de l’implémentation :

| Pays | Distinction à préserver | Traitement prudent |
|---|---|---|
| France | SIREN de l’entreprise, SIRET d’établissement et TVA ne sont pas le même identifiant. | RNE ou justificatif adapté ; TVA seulement si applicable. |
| Allemagne | Référence du registre et autorité/tribunal ; registre selon type d’entité. | Ne pas traiter un numéro TVA comme preuve universelle d’immatriculation. |
| Italie | Données du Registro Imprese, identifiants fiscaux et références locales selon l’entité. | Extrait adapté et provenance ; ne pas supposer tout accès officiel gratuit. |
| Espagne | Registre et identifiant fiscal ont des fonctions différentes. | Règles selon forme juridique ; éviter une obligation uniforme mal documentée. |
| Pologne | Distinguer les parcours CEIDG et KRS selon l’entité. | Champs conditionnels, pas exigence des deux registres pour tout le monde. |
| Roumanie | Identifier l’autorité et les références locales pertinentes. | Tant que la fiche exacte n’est pas sourcée, revue manuelle explicite. |
| Royaume-Uni | Companies House convient aux entités qui y sont enregistrées. | Ne pas exiger un numéro de société à chaque entrepreneur individuel. |
| Turquie | MERSİS, registre et bureau selon la forme ; données fiscales séparées. | Pas de numéro d’identité personnel dans un champ d’entreprise par défaut. |
| Géorgie | Identification d’entreprise et extrait NAPR ; siège distinct de l’usine. | Aucune conclusion automatique sur origine préférentielle ou conformité UE. |
| Maroc | ICE et registre du commerce avec contexte local ; fiscalité séparée. | Une réservation de nom n’est pas une preuve suffisante de société active. |
| Tunisie | Référence figurant au RNE et données fiscales pertinentes. | Préserver exactement les identifiants ; contrôle documentaire adapté. |
| États-Unis | Registre et juridiction de constitution selon l’entité ; fiscalité distincte. | Aucun EIN ou numéro fédéral imposé indistinctement à toutes les entreprises. |
| Chine | Raison sociale originale, autorité et justificatif de licence approprié. | Pas de regex ou de validation universelle sans documentation actuelle. |

Les listes d’autorités GLEIF et les registres nationaux peuvent aider à construire le référentiel, mais l’inscription à GSL ne doit pas exiger un LEI par défaut. VIES est un contrôle de TVA pertinent dans son périmètre, pas un registre universel d’usines. Un service indisponible ou une réponse non concluante conduit à « contrôle en attente », pas à « entreprise frauduleuse ».

Chaque dossier conserve la version de règles utilisée. Un changement de pays ou de forme juridique montre ce qui change et demande confirmation avant d’effacer des identifiants. Les données antérieures nécessaires à l’historique restent privées. Les contrôles par format ou somme de contrôle ne constituent jamais une vérification d’existence, d’activité ou de pouvoir de représentation.

Documente la couverture dans `docs/country-coverage.md` : saisie supportée, adresses, modèle local documenté ou manuel, sources, date, limites et tests. La politique de restrictions géographiques doit être explicite, fondée sur des règles applicables et revue par un responsable ; n’invente pas de score de risque par nationalité ou de sanctions universelles. Couverture technique mondiale et possibilité de traiter une transaction donnée restent deux sujets distincts.

## 13 — Données fournisseur et documents conditionnels

Sépare l’entité juridique, les sites, les contacts, les offres, les capacités et les preuves. Les champs structurés recherchables ne doivent pas rester uniquement dans une description libre. Conserve toutefois le texte original du fournisseur pour éviter qu’une normalisation appauvrisse ou transforme sa déclaration.

La matrice documentaire dépend du pays, du type d’entité, de l’activité, de la catégorie de produit, de son usage déclaré et des marchés visés. Ne demande pas un « certificat CE » identique à tous les fournisseurs. Ne confonds pas déclaration de conformité, déclaration de performances, rapport d’essai, certificat d’un système de management et rapport d’audit. Pour une référence soumise à des exigences spécifiques, la preuve doit correspondre à la référence et à l’usage concernés.

Le fournisseur peut indiquer « je ne sais pas » ou « à confirmer » sur l’applicabilité d’une exigence. Cela doit conduire à un traitement et un affichage prudents, pas à une validation positive. Un produit non encore autorisé à être présenté comme conforme peut rester en brouillon sans bloquer nécessairement toute l’existence de l’entreprise. La décision de publier cette référence relève de la politique de revue appropriée.

Chaque pièce possède un type, un émetteur déclaré, une référence, les produits/sites concernés, une date éventuelle, une échéance éventuelle, une source de vérification et un niveau de diffusion. L’absence d’une date d’expiration ne permet pas d’en inventer une. Les rapports peuvent avoir un périmètre restreint. Prévois le remplacement d’une pièce, son retrait, sa contestation et la conservation de son historique selon la politique de rétention.

Pour les entrepreneurs individuels, limite les informations personnelles. N’exige pas systématiquement passeport, carte d’identité, numéro fiscal personnel, domicile publié ou coordonnées bancaires. Si une vérification renforcée est réellement nécessaire, elle doit avoir une finalité, une base appropriée, un accès restreint et un canal adapté ; ne l’ajoute pas simplement pour donner une apparence de sérieux.

## 14 — Authentification, sessions et récupération

Conserve Supabase Auth comme source d’identité du parcours public. Une adresse saisie dans le formulaire n’est pas une identité authentifiée. Contrôle l’utilisateur et ses droits côté serveur pour chaque opération sensible. Les métadonnées modifiables par l’utilisateur ne doivent jamais servir à lui attribuer un rôle de revue ou d’administration.

Implémente et teste inscription, confirmation, renvoi du code ou lien, connexion, déconnexion, mot de passe oublié, nouveau mot de passe et changement de langue. Aligne la longueur des codes, leur type, les modèles de message, l’expiration et les URL de redirection avec la configuration effective. Si le code actuel attend huit chiffres, vérifie le paramètre réel avant de le changer.

La confirmation et la récupération doivent restaurer l’intention de navigation de manière sûre. Si le flux PKCE impose un contexte de navigateur, explique et teste le comportement lorsqu’un lien est ouvert sur un autre appareil ; propose un parcours compatible, par exemple un code correctement configuré, plutôt qu’un écran sans issue. Ne mets pas de tokens dans les logs, outils d’analyse, notifications internes ou captures diffusées.

Le code actuel utilise des cookies HTTP-only côté serveur. Ne les rends pas accessibles au JavaScript du navigateur uniquement pour simplifier un composant. Choisis une stratégie explicite : accès serveur avec endpoints contrôlés, ou client navigateur si un besoin réel le justifie. Mets en place le renouvellement des sessions adapté au rendu serveur et aux contraintes de Next.js ; vérifie que des cookies actualisés sont effectivement renvoyés là où cela est autorisé.

Les protections contre le bruteforce, l’abus d’envoi et la création automatisée doivent être compatibles avec l’environnement distribué. Évite un compteur uniquement en mémoire d’une instance éphémère. Ne fais pas confiance sans configuration à n’importe quel en-tête d’adresse IP fourni par le client. Des messages génériques protègent l’existence des comptes, tandis que les erreurs utiles restent consultables dans des logs restreints et expurgés.

Active les protections de mot de passe disponibles dans le forfait autorisé et documente celles nécessitant une décision. Exige une authentification renforcée pour les fonctions de revue et d’administration lorsqu’elle est disponible et validée. Prévois une procédure de récupération d’accès qui ne passe pas par un rôle secret codé dans le frontend.

## 15 — Stockage, téléversement et confidentialité des fichiers

Préserve le contrôle de signature des fichiers déjà présent. Le nom ou le MIME envoyé par le navigateur ne suffit pas. Les limites actuelles sont de 3 Mio pour l’onboarding et 10 Mio pour le bucket métier inspecté ; revois-les selon les besoins et les limites du runtime, sans simplement augmenter un formulaire au-delà de ce que le serveur accepte.

Définis des catégories séparées : image publique dérivée et approuvée ; justificatif privé ; document technique à accès contrôlé ; pièce jointe de demande ; pièce jointe de conversation. Un plan partagé à un fournisseur n’est pas automatiquement partagé aux autres. Un document d’identité reste réservé aux personnes chargées de son examen, pas aux prospects.

Pour un téléversement direct signé, le serveur crée une autorisation courte, une destination imprévisible et un enregistrement rattaché à l’utilisateur ou à son organisation. Vérifie ensuite existence, taille, type et relation métier avant de rendre le fichier utilisable. Le client ne choisit pas librement le bucket, le propriétaire, le statut de scan ou le chemin d’un autre compte. Les quotas doivent résister à plusieurs téléversements simultanés.

Prévois les états `pending`, `quarantined`, `clean`, `rejected` ou leurs équivalents justifiés. Un statut « analysé » n’est inscrit que par le service de contrôle autorisé après un résultat réel. Si le service n’est pas configuré, les documents ne doivent pas être présentés comme sûrs ou diffusés à des tiers comme si le contrôle avait eu lieu. Une intégration simulée est réservée aux tests et clairement isolée.

Les images publiques doivent être réencodées si nécessaire, limitées en dimensions et débarrassées des métadonnées inutiles. Les formats actifs ou exécutables ne sont pas acceptés par défaut. Ne rends pas directement du HTML ou un SVG utilisateur dans le domaine applicatif. Les fichiers CAD autorisés doivent être limités à une liste documentée et ne doivent pas être exécutés par le serveur. La prévisualisation avancée n’est pas requise pour la première version.

Un téléchargement vérifie les droits actuels. Les URL signées ont une durée limitée et ne sont pas journalisées intégralement. Leur validité résiduelle après révocation doit être comprise ; une information déjà téléchargée ne peut pas être « reprise ». Pour les documents les plus sensibles, choisis un mécanisme de contrôle compatible avec cette limite. Les pièces sont délivrées avec des en-têtes sûrs et un nom assaini.

Gère les erreurs partielles : fichier téléversé mais métadonnée non enregistrée ; métadonnée présente mais objet supprimé ; suppression concurrente avec soumission ; scan retardé. Un mécanisme de compensation et de nettoyage doit être idempotent et observable. Ne présente pas une suppression comme réussie avant d’avoir défini ce qui a été supprimé et ce qui reste en attente.

## 16 — Organisation, membres et contrôle des accès

Réutilise `organizations`, `memberships` et les rôles existants plutôt que créer une seconde identité de société dans chaque fonctionnalité. Les dossiers d’onboarding peuvent rester des brouillons attachés à un utilisateur, mais le rattachement à une organisation doit être explicite et contrôlé lors de la conversion. Prévois le cas d’une entreprise existante et de plusieurs représentants.

Un domaine email commun ne permet pas de rejoindre automatiquement une entreprise. Les invitations sont temporaires, liées à un destinataire et acceptées dans un contexte authentifié. Seul un membre autorisé peut inviter ou modifier des droits. Un fournisseur ne peut pas se déclarer reviewer en modifiant son profil. Le dernier propriétaire ne doit pas pouvoir se retirer sans transfert ou procédure de fermeture.

Distingue accès lecture, achat, vente, gestion d’entreprise et revue de plateforme. Un utilisateur peut cumuler des rôles légitimes, mais chaque action utilise le contexte de l’organisation explicitement sélectionnée et vérifié. Un changement d’organisation ne doit pas conserver un ancien dossier privé à l’écran ou dans un cache partagé.

La détection de doublon utilise le pays, l’autorité et l’identifiant approprié lorsqu’ils existent, pas seulement un nom commercial. Un identifiant fiscal n’est pas toujours la clé d’une entité distincte. Les homonymes, établissements secondaires et changements de forme doivent disposer d’une voie de revue sans créer une fausse accusation de fraude.

## 17 — Administration, revue et publication

Construis un espace de revue réellement utilisable. Il doit permettre de consulter la file des dossiers, prendre en charge un dossier, demander un complément, examiner des pièces autorisées, consigner une décision, publier une version et retirer une publication. Un simple changement manuel de statut dans le dashboard Supabase ne constitue pas le parcours final d’exploitation.

Utilise un mécanisme d’attribution du rôle reviewer réservé aux opérateurs autorisés. Réutilise ou adapte la table privée de reviewers existante. Ne crée aucun reviewer public ou mot de passe d’administration par défaut. Si aucun responsable n’est effectivement configuré, la mise en service de la revue est une dépendance de lancement explicite.

Les états doivent être définis et reliés à des transitions autorisées : brouillon, soumis, en examen, compléments demandés, approuvé, refusé, retiré ou équivalents compatibles avec l’existant. L’état du dossier, celui de la publication de l’entreprise et celui de chaque produit sont distincts. « Dossier examiné » ne doit pas faire apparaître tous les produits comme réglementairement validés.

La décision comporte auteur, horodatage serveur, version examinée, éléments vérifiés, périmètre et motif. Sépare notes internes et retour visible au fournisseur. Le fournisseur peut corriger un dossier selon les règles prévues, sans changer la décision antérieure. La réouverture crée une révision ; elle ne permet pas de modifier silencieusement les preuves déjà examinées.

Implémente une opération atomique et idempotente pour convertir le dossier approuvé en organisation, adhésion légitime, sites, contacts, capacités, offres et preuves normalisées. Vérifie les doublons, l’identité du propriétaire, la révision, les relations entre fichiers et produits, et la version des règles pays. Deux clics ou deux tentatives réseau ne doivent pas créer deux entreprises.

La publication produit une projection publique à champs autorisés, avec la version source et sa date. Ne copie pas tout le payload privé dans une colonne publique. Les données publiées deviennent consultables par le moteur réel, sans étape cachée à effectuer manuellement dans une autre base.

Prévois une politique de modification : un changement critique peut retirer immédiatement une assertion ou une publication ; une correction éditoriale non sensible peut être proposée sans effacer la dernière version approuvée. Ne supprime pas aveuglément les triggers existants : remplace leur comportement par des invariants testés. Toute version publique retirée doit être invalidée dans les caches et exclue des nouvelles demandes.

## 18 — Schéma Supabase et intégrité métier

Réutilise les 29 tables publiques inspectées : `country_requirement_versions`, `profiles`, `organizations`, `memberships`, `organization_identifiers`, `addresses`, `production_sites`, `organization_contacts`, `capabilities`, `products`, `files`, `media_links`, `evidence_documents`, `evidence_scopes`, `product_compliance_records`, `verification_events`, `rfqs`, `rfq_items`, `rfq_recipients`, `rfq_files`, `threads`, `messages`, `offers`, `declared_orders`, `published_supplier_profiles`, `published_products`, `supplier_applications`, `supplier_application_files`, `supplier_application_events`.

Étends-les ou ajoute des tables ciblées pour les besoins réellement absents : taxonomie et attributs, sélections enregistrées, lignes de devis, décisions de revue, notifications et file d’envoi transactionnelle. Évite de recréer une deuxième série d’organisations, de fournisseurs et de demandes sans plan de correspondance. Les noms définitifs peuvent s’adapter au code, mais leur responsabilité doit être documentée.

Les valeurs recherchables importantes doivent avoir des types et des contraintes : codes pays, unités, quantités positives lorsqu’applicables, valeurs manquantes explicites, relations d’organisation, références de produits, statut et version. Ne stocke pas le pays uniquement comme son nom français. Ne code pas l’absence d’un prix par `0`. Si `0` est une valeur métier légitime, distingue-la de `NULL`.

Les liens entre fichiers, sites, offres et demandes doivent empêcher les associations entre entreprises non autorisées. Conserve les clés composites pertinentes et teste les tentatives de rattachement d’un objet d’un autre compte. Contrôle également l’immutabilité des créateurs, propriétaires, décisions de revue et dates importantes.

Les transitions sensibles — soumettre, publier, envoyer une demande, créer une offre officielle, clôturer, retirer — doivent être atomiques. Une validation exclusivement située dans un composant ou une route est insuffisante si un autre chemin d’écriture autorisé permet de la contourner. Inspecte les grants, RLS, triggers et fonctions avant de décider de l’implémentation. Teste les appels directs avec les rôles ordinaires en environnement isolé ; ne déclare pas une vulnérabilité sans preuve.

Les fonctions élevées, si nécessaires, doivent avoir des droits d’exécution minimaux, des objets qualifiés, un `search_path` maîtrisé et une vérification explicite du rôle et de l’organisation. N’accorde pas leur exécution à tous par défaut. Certaines fonctions existantes exigent `auth.uid()` : ne suppose pas qu’un appel avec un secret d’administration conserve automatiquement l’identité du décideur. Fais fonctionner le contexte d’acteur de façon explicite et auditée.

Les vues exposées doivent respecter le modèle de permissions prévu ; vérifie notamment le comportement de sécurité de l’invocateur lorsqu’il est approprié. RLS et grants sont complémentaires. Les tests doivent utiliser des clients utilisateur réels, pas exclusivement un client d’administration qui contourne les politiques.

Génère les types à partir du schéma réellement migré. Versionne les migrations et leurs tests. Pour les ajouts d’index, utilise les requêtes réellement exécutées et les plans pertinents ; ne multiplie pas les index au hasard. Documente les migrations, leur compatibilité, le backfill et la procédure de retour arrière sans perdre des données créées entre-temps.

## 19 — Création et transmission des demandes de devis

Une demande recueille les informations nécessaires au chiffrage : nature du besoin, catégorie, matière ou spécification, quantité et unité, destination, échéance souhaitée, éventuelles variantes, pièces jointes et budget facultatif. L’acheteur peut ne pas connaître tous les critères techniques ; le formulaire doit signaler les points à préciser sans inventer une spécification.

Le brouillon est privé. L’assistance GSL n’y accède que dans le cadre prévu et après partage explicite. Les fournisseurs ne voient pas les demandes simplement parce qu’ils sont inscrits. Avant transmission, l’acheteur voit les destinataires nommés, le contenu transmis, les fichiers et les éventuelles coordonnées partagées.

Propose par défaut une sélection réduite de fournisseurs pertinents, par exemple trois à cinq, sans la présenter comme une obligation universelle. La limite exacte est configurable. N’envoie pas la demande à tous les fabricants d’une catégorie. Un nouveau destinataire ajouté après le premier envoi exige une confirmation distincte et une trace.

L’envoi doit être idempotent : un identifiant de commande ou une clé d’idempotence empêche les doublons. Une transaction valide la version du brouillon, les droits de l’acheteur, les destinataires encore publiés, l’état des pièces et les contraintes nécessaires, puis crée destinataires, fils privés et événements d’envoi. Si une étape échoue, la demande ne doit pas sembler entièrement transmise alors que des destinataires manquent.

Enregistre un instantané du besoin transmis, ou un mécanisme équivalent de versionnement. Une modification après envoi devient une nouvelle version ou un complément visible aux destinataires concernés. Ne permets pas de changer silencieusement les quantités ou les plans sous un devis déjà reçu. Conserve les anciennes versions selon la politique de conservation.

La transaction crée les tâches de notification dans une outbox ; l’envoi email externe est traité séparément avec reprise sur erreur. Le succès métier signifie « demande enregistrée et transmise dans la plateforme ». La réception email et la lecture sont des événements distincts. Une panne email ne doit pas perdre la demande ni forcer un nouvel envoi créant plusieurs conversations.

Les états doivent être compréhensibles : brouillon, transmis, réponse attendue, offre reçue, clôturé, annulé ; les sous-états techniques restent dans les journaux ou une explication adaptée. Un retrait de fournisseur après un envoi ne doit pas rendre l’historique incohérent : applique une politique documentée aux conversations existantes et bloque les nouveaux envois concernés.

## 20 — Messagerie et espace fournisseur

Le fournisseur retrouve uniquement les demandes qui lui ont été adressées, avec leur contexte et les documents explicitement partagés. Il peut accepter d’étudier le besoin, demander une précision, décliner avec un motif approprié ou déposer une offre. Une demande à laquelle il ne peut pas répondre ne doit pas disparaître sans statut.

Crée un fil distinct par fournisseur et par demande. Le fournisseur A ne peut consulter ni les réponses, ni les prix, ni la liste des contacts internes du fournisseur B. L’acheteur peut gérer les fils ensemble sans mélanger les messages. Les notes internes de GSL ne sont pas visibles à un fournisseur sauf publication explicite d’un retour.

Les messages ont un auteur authentifié, une organisation, un horodatage serveur et un état de persistance. Ne présente pas un message comme envoyé avant son enregistrement. Prévois une protection anti-doublon et un traitement sûr du texte ; aucun HTML utilisateur exécuté. Les pièces jointes suivent les mêmes règles de permissions que le fil.

Une actualisation périodique ou un bouton de rafraîchissement peut suffire à la première version ; Realtime n’est pas obligatoire. Si Realtime est utilisé, ses abonnements doivent respecter la confidentialité et se désabonner au changement de session ou d’organisation. Ne diffuse pas tous les changements de messages à tous les clients avant filtrage local.

L’espace fournisseur présente également les compléments demandés, l’état de publication, les documents expirant, les offres en cours et les étapes suivantes. L’absence de demandes n’est pas masquée par de fausses statistiques. Les délais moyens et performances ne sont affichés qu’avec une méthode de calcul et un historique suffisants.

## 21 — Offres et comparateur

Une offre doit préciser les lignes chiffrées, références, quantités, unités, devise, prix unitaires et totaux, coûts fixes éventuels, transport inclus ou non, emballage, conditions de livraison, délai ou date, validité, modalités de paiement et exclusions. Une variante est présentée comme variante, pas comme réponse exacte au cahier des charges.

Les montants ne sont pas calculés avec une arithmétique flottante approximative. Choisis des décimaux adaptés ou des unités mineures avec une définition par devise ; n’impose pas deux décimales à toutes les devises. Les grands entiers traversant du JSON doivent être sérialisés sans perte. Les calculs sont reproduits côté serveur et testés.

La plateforme ne calcule pas automatiquement toute la fiscalité mondiale. Enregistre le traitement fiscal déclaré et les conditions de l’offre sans en déduire une garantie réglementaire. Un Incoterm, lorsqu’utilisé, doit comporter le lieu et la version pertinents ; ne transforme pas un sigle en estimation fiable de coût livré.

Le comparateur distingue éléments connus, manquants et non comparables. Deux montants dans des devises différentes ne sont pas classés comme si leur valeur était identique. Une conversion indicative éventuelle exige une source de taux, une date et un avertissement ; elle ne remplace pas le montant contractuel. Aucun taux actuel ne doit être inventé ou figé à partir d’une connaissance non vérifiée.

L’acheteur peut demander une révision, retenir une offre ou clôturer sa consultation. Si aucune commande juridiquement engageante n’est gérée dans la première version, utilise « offre retenue » ou « commande déclarée hors plateforme » selon le mécanisme réel. Ne marque pas « payé », « commandé » ou « commission acquise » sur la base d’un clic de sélection.

## 22 — Contact et emails qui fonctionnent réellement

Identifie l’email professionnel explicitement confirmé dans la configuration autorisée ou auprès de l’opérateur. **N’invente pas `contact@…`, n’utilise pas l’adresse personnelle d’un commit et ne publie pas une donnée de compte connecté par déduction.** Centralise le contact dans un module ou une configuration validée. Corrige l’affichage conditionnel afin qu’un email confirmé puisse apparaître indépendamment d’un champ nom encore vide.

L’identité juridique, l’adresse et les mentions nécessaires doivent être renseignées à partir de données confirmées. Une page contact peut contenir le contact réellement connu pendant une phase préparatoire, mais l’ouverture commerciale ne doit pas être déclarée finalisée si l’identité d’exploitation requise manque. Ne remplace pas des mentions manquantes par une société imaginaire.

Le formulaire de contact valide côté serveur le sujet, le texte et une adresse de réponse, limite l’abus, enregistre une demande avec référence et crée une notification. L’expéditeur technique appartient à un domaine autorisé ; l’email du visiteur sert de `Reply-To` après validation, jamais de champ `From` usurpé. Si l’envoi échoue après enregistrement, la demande reste traçable et l’interface ne ment pas sur son état.

Sépare les emails d’authentification, les notifications métier et les messages marketing. Une boîte contact existante ne prouve pas qu’un SMTP Auth ou qu’un prestataire transactionnel est configuré. Inspecte les paramètres disponibles, les URL de redirection, les modèles et les restrictions d’envoi. Utilise un SMTP ou hook Auth approprié à la production selon les services autorisés ; ne t’appuie pas sans vérification sur le service de test intégré.

Prévois des modèles FR/EN pour confirmation, récupération, dossier reçu, complément demandé, décision de publication, nouvelle demande, nouveau message, offre reçue et accusé de contact. Le sujet est clair ; aucun justificatif sensible ou plan confidentiel n’est joint automatiquement. Les liens mènent à un espace authentifié avec contexte restauré.

La file d’envoi conserve événement métier, destinataire, langue, modèle/version, tentative, statut et identifiant du prestataire. Déduplication, reprise avec délai, limite de tentatives et file d’échec sont nécessaires. Les webhooks sont authentifiés, idempotents et traitent les événements arrivant dans le désordre. « Accepté par le prestataire » n’équivaut ni à réception en boîte principale ni à lecture.

Vérifie SPF, DKIM, politique DMARC et domaine expéditeur avec les paramètres réels du prestataire. Ne modifie pas les DNS sans accès et autorisation adaptés. Les tests de livraison se font sur des boîtes contrôlées et autorisées, jamais en créant des comptes chez des tiers. Les notifications critiques liées à une demande sont séparées des préférences marketing ; n’impose pas un abonnement commercial pour recevoir une réponse à un devis.

## 23 — Confiance, confidentialité et limites réglementaires

Décris clairement le rôle réel de GSL : mise en relation, organisation de demandes et éventuelle assistance. Ne revendique pas le rôle de fabricant, importateur, organisme notifié, certificateur ou assureur si l’activité et les contrats ne le justifient pas. La vérification d’une entreprise ou d’un document est décrite avec son périmètre et ses limites.

Les conditions d’utilisation et la politique de confidentialité doivent correspondre aux traitements réellement implémentés : finalités, catégories de données, destinataires, prestataires, durées, droits, modalités de contact et transferts éventuels. Elles nécessitent des informations de l’exploitant et une validation appropriée ; tu ne peux pas déclarer une conformité juridique mondiale sur la base d’un modèle générique.

Prévois consultation, correction, export et suppression dans la mesure des règles applicables, avec un traitement explicite des historiques qui doivent être conservés. Documente les durées pour brouillons abandonnés, dossiers refusés, documents remplacés, messages, demandes et journaux. Ne conserve pas tout indéfiniment « au cas où ». La fermeture d’une entreprise ne supprime pas sans règle les éléments nécessaires à l’autre partie d’un échange.

Les pages publiques ne doivent exposer que ce qui est nécessaire. Les droits sur les photos, catalogues et descriptions sont attestés et enregistrés. Un fabricant importé depuis un annuaire ne devient pas un partenaire actif. Si un référencement non revendiqué est ajouté plus tard, sa provenance, son statut et son droit de correction sont distincts des fiches déposées volontairement.

Les cookies strictement nécessaires sont distingués des outils d’analyse ou publicitaires. Ne charge pas un outil non essentiel avant le consentement lorsque celui-ci est nécessaire. Le refus doit être accessible ; n’ajoute pas une bannière décorative si seuls des mécanismes nécessaires sont utilisés. Les cartes ou intégrations tierces doivent être évaluées avant chargement, sans supposer qu’un clic résout toutes les obligations.

N’utilise pas un badge « certifié UE », « usine auditée » ou « DPP ready » sans critères, preuve et périmètre vérifiés. Le passeport numérique de produit, les règles de construction ou un accord UE–Géorgie ne sont pas un prétexte pour inventer des fonctionnalités réglementaires. Prévois une extension documentaire future, mais la première version doit fonctionner avec les règles actuellement applicables et les vérifications réellement réalisées.

## 24 — Internationalisation complète du parcours livré

Livre au minimum un parcours complet français et anglais : navigation, formulaires, aides, erreurs, statuts, emails et pages opérationnelles. Ne mélange pas un accueil anglais avec une confirmation ou une erreur incompréhensible uniquement en français. La langue reste stable après connexion, retour email et changement de rubrique.

Choisis une stratégie d’URL localisées cohérente avec le rendu serveur, par exemple segments `/fr` et `/en`, avec redirections maîtrisées depuis les URL existantes. Le choix exact peut différer si le projet dispose déjà d’une stratégie valide ; documente-la. Le `lang` du document et les métadonnées doivent correspondre au contenu rendu initialement, pas seulement être corrigés après hydratation.

Les noms de sociétés, adresses et descriptions originales ne sont pas remplacés silencieusement par une traduction. Une traduction automatique éventuelle est identifiée et conserve l’original. Les références, tolérances, matières et nombres ne doivent pas être altérés. L’interface peut être FR/EN tout en acceptant des données de tous les pays : cela ne signifie pas qu’elle est traduite dans toutes les langues.

Localise l’affichage des dates, des nombres et des unités sans modifier les valeurs stockées. Les devises restent explicitement indiquées. Accepte les écritures de droite à gauche dans les champs et les fichiers lorsque nécessaire, avec isolation directionnelle adaptée. Ne déduis pas une langue ou une nationalité obligatoire à partir d’une adresse IP.

## 25 — Interface, accessibilité et états réels

Préserve les éléments cohérents de l’identité GSL. Ne remplace pas la charte par un thème générique sans examiner le rendu actuel. La priorité est la lisibilité de l’action : besoin, critères, résultat, sélection, envoi. L’esthétique doit soutenir ce parcours, pas masquer une absence de données par de grandes photographies et des statistiques fictives.

Crée des composants partagés pour boutons, champs, messages d’erreur, tableaux, statuts, étapes, cartes et pièces jointes. Toutes les actions ont un état normal, attente, succès, échec et désactivation justifiée. Une action qui requiert un compte doit l’expliquer puis reprendre au bon endroit. Un bouton non opérationnel est retiré de l’expérience commerciale ou clairement présenté comme indisponible, jamais laissé actif sans effet.

Teste réellement les principaux parcours sur une largeur de téléphone, une tablette et un écran desktop. Les tableaux de comparaison peuvent déborder dans un conteneur explicitement défilable, mais la page ne doit pas imposer un défilement horizontal involontaire. Les boutons tactiles, tailles de texte, erreurs et panneaux de filtres restent utilisables. Un clavier virtuel ne doit pas masquer l’unique action de validation.

Vise les critères d’accessibilité WCAG 2.2 AA applicables, sans annoncer une certification non réalisée. Vérifie navigation clavier, focus visible, ordre de lecture, labels, contrastes, annonces d’état et zoom. Le sélecteur de pays doit fonctionner sans souris ; une liste de drapeaux sans noms ne suffit pas. Les modales doivent gérer focus et fermeture, et les informations importantes ne doivent pas dépendre uniquement d’une couleur.

Conserve les réglages de réduction du mouvement et d’économie de données pour la vidéo. Le contenu principal et la recherche doivent être utilisables sans téléchargement préalable du film. Une image de remplacement est prévue. Les photographies ne sont pas assimilées à des usines référencées. Corrige après mesure réelle et ne produis pas une note de design ou un score de performance inventé.

## 26 — SEO et rendu public

Lève le `noindex` global uniquement pour les pages publiques réellement prêtes en production. Maintiens les démonstrations, préproductions, comptes, brouillons, demandes, conversations et pièces privées hors index. Les contrôles d’accès restent la vraie sécurité : `robots.txt` et `noindex` n’empêchent pas une personne d’ouvrir un document non protégé.

Chaque fabricant et produit publié dispose d’une URL stable, d’un titre, d’une description appropriée et d’un contenu substantiel disponible dans un rendu crawlable. Ne rends pas une page publique uniquement comme un shell de démonstration. Les paramètres de filtres doivent avoir une politique canonique ; n’indexe pas toutes les permutations et les recherches internes vides.

Crée un sitemap ne contenant que les URL publiques autorisées, avec une date de modification réelle. Les langues disposent de relations cohérentes `hreflang` et de canonical adaptés. Les pages retirées, supprimées et jamais existantes doivent produire un comportement HTTP et un contenu appropriés, pas toutes une page 200 vide. L’état publié de la base doit être revalidé pour éviter une fuite par un ancien cache.

Les données structurées décrivent uniquement ce qui est affiché et attesté. Pas d’avis inventés, de prix « 0 », de stock disponible fictif ou de note agrégée sans source. Une capacité sur devis ne devient pas un produit avec un prix ferme pour satisfaire un validateur SEO. N’annonce aucun classement ou volume de trafic garanti.

Les pages secteurs et pays doivent répondre à un besoin réel et disposer d’un contenu utile. Ne génère pas des milliers de pages artificielles à partir de toutes les combinaisons pays × produits. Commence par les catégories et marchés réellement alimentés. Les contenus réglementaires comportent date, périmètre et sources, avec un processus de mise à jour.

## 27 — Performance, sécurité applicative et exploitation

Définis des budgets de performance comme objectifs de recette, puis mesure-les sur le build cible. À titre d’objectifs pour les pages publiques : limiter les ressources initiales, garder un chargement principal rapide, une interaction réactive et une mise en page stable. Les seuils choisis doivent être indiqués dans le rapport de tests ; ils ne sont pas des résultats tant qu’ils n’ont pas été mesurés.

La recherche et les listes utilisent pagination serveur, plafonds de taille et requêtes indexées. Les pièces jointes ne passent pas toutes dans la mémoire d’une fonction sans limite. Les imports volumineux, scans et envois répétés sont exécutés via une tâche contrôlée adaptée au runtime. Évite les appels en cascade inutiles ; ne mets toutefois jamais en cache une réponse privée pour gagner artificiellement quelques millisecondes.

Ajoute des en-têtes et contrôles adaptés : protection contre l’injection, validation d’entrée, politique de chargement des ressources, protection contre le framing si nécessaire, redirections sûres et contrôle d’origine pour les écritures concernées. Un lien ou document externe ne doit pas déclencher un fetch serveur libre pouvant joindre le réseau interne. Si l’import d’un site fournisseur est ajouté, limite protocoles, adresses, redirections, taille et temps, et traite le contenu comme non fiable.

Les logs doivent aider à diagnostiquer sans exposer noms complets inutiles, contenus de dossiers, tokens, clés, URL signées ou pièces. Utilise des identifiants de corrélation, codes d’erreur et événements de domaine. Les erreurs affichées ne révèlent pas d’informations sur d’autres comptes. L’accès aux logs est limité et leur conservation documentée.

Surveille au minimum erreurs serveur, échecs de sauvegarde, file de revue, âge des demandes non traitées, retards d’outbox, rejets de fichiers et taux d’échec email. Les tâches planifiées sont idempotentes, bornées et authentifiées. Un worker ne doit pas prendre deux fois la même tâche sans mécanisme de coordination ; un arrêt en cours de traitement doit pouvoir être repris.

Documente sauvegarde, restauration, retrait d’une fiche, suspension d’un compte, révocation d’un membre et gestion d’un document problématique. Un plan de restauration qui n’a jamais été testé doit être présenté comme non vérifié. Les accès de maintenance ne sont pas intégrés dans le code public. Ne considère pas le succès d’un advisor automatique comme un audit de sécurité complet.

## 28 — Mesure du produit et monétisation honnête

Instrumente le parcours avec des événements limités : recherche, absence de résultat, ouverture de fiche, ajout à la sélection, début de demande, demande transmise, première réponse et offre reçue. Mesure les abandons par étape sans enregistrer le contenu confidentiel des demandes dans les outils d’analyse. Les événements doivent résister aux doubles clics et aux rechargements lorsqu’ils servent à des indicateurs métier.

Le tableau de bord doit distinguer visiteurs, demandes, fournisseurs destinataires, réponses exploitables et commandes déclarées. Le nombre d’emails émis n’est pas le nombre de leads qualifiés. Une estimation d’intérêt n’est pas une vente. Les métriques d’usage sont destinées à améliorer l’expérience, pas à fabriquer un argument commercial avant l’existence d’un réseau réel.

Ne construis pas un paiement ou un abonnement facturé sans modèle approuvé. Une première version peut proposer l’inscription fournisseur et la recherche sans paiement, puis une prestation accompagnée sur devis lorsque l’opérateur peut réellement la fournir. Les tarifs non confirmés ne doivent pas être inventés ; les exemples du raisonnement commercial antérieur ne sont pas des prix validés.

Prépare le modèle de droits pour des offres futures, mais n’ajoute pas des restrictions artificielles bloquant la recette de base. Une offre payante doit avoir une contrepartie réelle. Les emplacements sponsorisés sont identifiés et séparés du classement de compatibilité. Les documents de conformité et les signaux de vérification ne s’achètent pas en choisissant un abonnement premium.

## 29 — Ordre d’exécution et livraisons intermédiaires

**Lot 1 : rendre l’architecture cohérente.** Confirme la cible, isole l’ancien D1/Sites, configure les environnements, termine l’authentification et la reprise, inspecte les droits et prépare les commandes métier Supabase. Conserve l’interface existante tant que les composants n’empêchent pas ce travail. Livrable : une session réelle et des brouillons persistants dans la bonne base, avec tests d’isolation.

**Lot 2 : fermer le circuit fournisseur.** Allège l’entrée, implémente les règles de brouillon, la couverture pays, les documents privés et la revue. Termine la conversion vers les données normalisées et la publication. Livrable : un fournisseur fictif de test devient une fiche publiée de test dans la préproduction, après une décision d’un reviewer de test autorisé, sans données personnelles ni raccourci de sécurité.

**Lot 3 : fermer le circuit acheteur.** Relie la recherche à ces données, termine sélection, demandes, destinataires, fils et offres. Ajoute la file email et le contact réellement acheminé dans l’environnement autorisé. Livrable : un acheteur de test trouve la fiche et reçoit une réponse exploitable du fournisseur de test, tandis qu’un tiers ne peut pas lire leur échange.

**Lot 4 : finaliser le lancement.** Corrige mobile/accessibilité, FR/EN, SEO, erreurs, mesures et documentation. Exécute la recette complète sur la cible. Configure les éléments d’exploitation confirmés et prépare le déploiement avec retour arrière. Ne publie pas en production tant que les dépendances bloquantes et les contrôles d’accès ne sont pas résolus.

Chaque lot produit des commits compréhensibles et un état actualisé de la matrice. Ne réécris pas tout le projet avant de vérifier une première boucle complète. Si une exigence réclame un choix non connu, implémente un point de configuration sûr et documente exactement ce qui manque ; ne diffère pas tout le travail indépendant.

## 30 — Tests à exécuter et preuves à produire

Crée des fixtures synthétiques dans une base locale ou de préproduction explicitement dédiée : acheteur A, acheteur B, fournisseur X, fournisseur Y, reviewer R et visiteur anonyme. Aucun de ces comptes n’est une personne ou une entreprise réelle. Les fixtures de test ne sont pas indexées et ne sont pas copiées dans le catalogue public.

La recette doit combiner tests unitaires de règles, tests d’intégration PostgreSQL/RLS, tests d’API et parcours navigateur sur le build destiné à l’hébergeur cible. Les mocks sont utiles pour simuler les pannes, mais ne constituent pas la seule preuve de fonctionnement de Supabase, Storage ou de la livraison email. Les tests doivent explicitement vérifier les effets persistants, pas seulement les réponses HTTP 200.

Exécute la grille de 100 cas jointe à la fin de ce document. Pour chacun, conserve environnement, résultat, preuve et éventuelle limite. Un test non exécuté est « non exécuté », pas « réussi par inspection ». Un cas non applicable doit comporter une justification liée au périmètre livré, sans utiliser cette catégorie pour masquer un parcours central manquant.

Teste les permissions avec les rôles utilisateurs et les chemins réellement exposés, y compris la Data API et le Storage si accessibles. Ne lance pas d’exploration intrusive sur des comptes de production. Les essais concurrents, quotas et pannes utilisent des volumes limités et un environnement de test. Ne désactive pas une politique pour faire passer un test : corrige la règle ou le comportement attendu de manière justifiée.

Vérifie le typecheck, le lint, les tests automatisés et le build exact déployé. Si le script historique construit Vinext mais Vercel exécute Next.js, teste la cible qui sera utilisée. Décris les anciens tests conservés et ceux remplacés ; ne recycle pas le nombre de 187 assertions historiques comme résultat du nouveau backend.

## 31 — Dépendances externes et définition de « terminé »

Les dépendances possibles doivent être vérifiées, pas supposées absentes : email de contact confirmé ; identité légale ; responsable de revue habilité ; configuration SMTP ou hook Auth ; prestataire transactionnel ; DNS expéditeur ; service de contrôle de fichiers ; accès au déploiement ; règles de conservation et documents juridiques validés. Pour chacune, indique propriétaire de la décision, configuration attendue, test permettant de la lever et impact exact sur le lancement.

La première version est techniquement recevable lorsque tous les parcours centraux fonctionnent, que les politiques empêchent les accès croisés, que les données publiées sont réellement issues de la revue, que les recherches exploitent les bonnes informations, que les demandes et réponses persistent, et que l’exploitant peut traiter les dossiers sans modification manuelle improvisée de la base.

Elle n’est commercialement ouverte que lorsque les coordonnées, les modalités d’exploitation, les responsabilités de revue et les notifications nécessaires sont confirmées, que des données réelles publiables sont disponibles ou qu’un état de lancement limité est clairement assumé, et que la recette correspond à l’environnement effectivement accessible au public.

Les contraintes de production ne doivent pas être contournées par une sortie de démonstration. Ne déclare pas « tout fonctionne » si seuls les écrans ont été terminés. Ne déclare pas « tous les pays vérifiés » si la majorité suit une revue manuelle. Ne déclare pas « emails reçus » si seul un appel API au prestataire a réussi.

## 32 — Livrables obligatoires de l’agent

À la fin, remets le code dans la branche prévue, les migrations versionnées, les types générés, les tests et une documentation exploitable. Mets à jour le README pour GSL/Next.js/Supabase et relègue les anciennes instructions non applicables dans un historique identifiable. Fournis `docs/implementation-status.md`, `docs/country-coverage.md`, un inventaire d’environnements sans secrets, un guide de revue et un guide de traitement des incidents.

Le compte rendu doit contenir les fichiers modifiés et leur rôle, les migrations appliquées et leur environnement, les commandes réellement exécutées et leur résultat, les routes testées, la matrice des 100 cas, les limites restantes et les dépendances externes. Une URL de prévisualisation ou de production n’est donnée comme validée que si elle a réellement été ouverte et contrôlée.

Ne pousse pas directement sur la branche de production et ne déclenche pas une facturation, une migration destructive ou un envoi réel sans l’autorisation correspondante. Prépare un déploiement contrôlé avec procédure de retour arrière. Si le déploiement final est autorisé, vérifie après publication la version servie, la configuration, les parcours de contrôle et la confidentialité ; ne te limite pas au statut de build.

Termine par un verdict factuel sous quatre rubriques : « livré dans le code », « vérifié par exécution », « disponible dans l’environnement », « restant à configurer ou valider ». Une tâche partiellement réalisée doit être présentée comme telle. L’objectif est une plateforme utilisable et vérifiable, pas une liste impressionnante de fonctionnalités déclarées.

---

## ANNEXE A — Recette de 100 cas

La grille ci-dessous fait partie du périmètre d’implémentation. « Attendu » décrit un critère à prouver et non un résultat obtenu pendant cet audit. Les tests d’email utilisent uniquement des destinataires contrôlés et autorisés. Tous les tests de données utilisent un environnement séparé de la production.

<!-- RECETTE_INTEGREE -->
### Grille opérationnelle

**Plan à exécuter après implémentation. Aucun de ces résultats n’est présenté comme acquis par l’audit.**

Environnement dédié ; données et boîtes email de test autorisées. Pour chaque cas, consigner résultat, date, environnement, preuve et responsable. Utiliser les statuts NON EXÉCUTÉ, RÉUSSI, ÉCHOUÉ, BLOQUÉ ; NON APPLICABLE exige une justification et ne convient pas à un parcours central manquant.

### Authentification et reprise

| ID | Scénario | Résultat attendu |
|---|---|---|
| T001 | Inscription sur une boîte de test autorisée | Compte créé une seule fois ; aucune organisation ni publication approuvée implicitement. |
| T002 | Compte dont l’email n’est pas confirmé | Les opérations réservées sont refusées ; un renvoi contrôlé de confirmation est proposé. |
| T003 | Code valide, expiré puis erroné | Format conforme à la configuration ; succès seulement pour le code valide, erreurs compréhensibles sans fuite. |
| T004 | Confirmation depuis le parcours fournisseur | Retour à la bonne étape avec langue et intention conservées, pas au compte générique sans contexte. |
| T005 | Confirmation ou lien ouvert sur un autre navigateur | Comportement PKCE documenté et voie de récupération utilisable ; aucun compte bloqué sans solution. |
| T006 | Lien de retour externe, encodé ou ambigu | Destination non sûre rejetée ; aucune redirection vers le domaine proposé par l’attaquant. |
| T007 | Mot de passe oublié et récupération | Ancien lien expiré inutilisable ; nouveau mot de passe effectif ; aucun token visible dans les logs. |
| T008 | Expiration de session pendant une saisie | Saisie non présentée comme enregistrée ; reconnexion et reprise du brouillon avec droits revalidés. |
| T009 | Déconnexion puis ouverture d’une ancienne URL privée | Aucune donnée privée servie depuis un cache ; contrôle de session réalisé à nouveau. |
| T010 | Tentatives répétées de connexion ou de renvoi | Limitation d’abus observée sans compromettre le fonctionnement normal ni divulguer l’existence des comptes. |

### Parcours fournisseur et sauvegarde

| ID | Scénario | Résultat attendu |
|---|---|---|
| T011 | Création d’un compte sans logo ni site web | Le compte et le brouillon peuvent être créés ; ces enrichissements ne bloquent pas l’entrée. |
| T012 | Enregistrement d’une saisie encore incomplète | Brouillon conservé avec limites de taille ; la validation de soumission reste distincte. |
| T013 | Saisie, autosauvegarde, rechargement | Valeurs et étape récupérées ; état enregistré affiché seulement après confirmation serveur. |
| T014 | Coupure réseau pendant la sauvegarde | Message d’échec explicite ; contenu conservé à l’écran ; reprise sans doublon. |
| T015 | Deux onglets modifient la même version | Conflit de révision détecté ; aucun écrasement silencieux de la version concurrente. |
| T016 | Distributeur sans usine détenue | Questions adaptées à son activité ; aucune obligation de déclarer faussement un site de fabrication. |
| T017 | Service sur plan sans référence catalogue | Offre de capacité enregistrable sans SKU fictif ; type de prestation clairement présenté. |
| T018 | Changement de pays ou de forme juridique | Conséquences expliquées ; anciens identifiants non effacés sans confirmation ; nouvelles règles appliquées. |
| T019 | Quantité décimale locale et date impossible | Saisie numérique normalisée sans ambiguïté ; date invalide signalée ; brouillon récupérable. |
| T020 | Soumission avec informations nécessaires manquantes | Résumé des erreurs et focus accessibles ; aucun statut soumis ni publication créé par erreur. |

### Pays, identifiants et internationalisation des données

| ID | Scénario | Résultat attendu |
|---|---|---|
| T021 | Parcours du référentiel pays retenu | Chaque code valide autorisé par la politique est sélectionnable et persisté sans dépendre du nom traduit. |
| T022 | Code pays invalide envoyé directement | Rejet serveur ; aucune insertion silencieuse d’un code non reconnu. |
| T023 | Pays sans modèle local documenté | Brouillon et soumission selon le parcours prévu ; statut de revue manuelle explicite, jamais validation automatique. |
| T024 | Formes juridiques différentes dans un même pays | Champs conditionnels adaptés ; aucun numéro de société imposé indistinctement à un entrepreneur individuel. |
| T025 | Identifiants FR, GB, DE, IT et PL dans les fixtures | Autorité et type d’identifiant préservés ; aucune confusion entre registre, établissement et TVA. |
| T026 | Entité américaine avec juridiction de constitution | Le contexte local est conservé ; absence d’EIN non traitée comme impossibilité universelle d’inscription. |
| T027 | Dossier chinois, géorgien ou arabe | Noms et adresses dans l’écriture originale conservés ; translittération éventuelle distincte. |
| T028 | Adresse avec subdivision variable ou sans code postal applicable | Pas de validation française universelle ; adresse enregistrable selon le référentiel utilisé. |
| T029 | Contrôle de registre ou de TVA indisponible | État en attente ou revue manuelle ; ni confirmation fictive ni accusation de fraude. |
| T030 | Nouvelle version d’une règle pays après soumission | Version initiale traçable ; réévaluation explicite si nécessaire, sans réécriture de l’historique. |

### Fichiers et confidentialité documentaire

| ID | Scénario | Résultat attendu |
|---|---|---|
| T031 | PDF ou image autorisée dans les limites | Stockage privé, métadonnées exactes, rattachement au bon dossier et état de contrôle cohérent. |
| T032 | Fichier dont l’extension et le contenu divergent | Décision fondée sur contrôle du contenu ; fichier non autorisé refusé malgré une extension trompeuse. |
| T033 | Fichier dépassant la taille ou quota autorisés | Refus maîtrisé et message utile ; pas d’objet définitivement orphelin. |
| T034 | Téléversements simultanés à la limite du quota | Quota effectif respecté ; aucune course permettant de dépasser indéfiniment le plafond. |
| T035 | Échec entre téléversement et enregistrement des métadonnées | Compensation ou nettoyage traçable ; aucune réussite fictive ni fuite d’objet. |
| T036 | Suppression en concurrence avec la soumission du dossier | Instantané soumis cohérent ; document requis non substitué ou retiré silencieusement. |
| T037 | Utilisateur tiers demandant un fichier ou une URL signée | Accès refusé par le chemin réellement exposé, y compris Storage et API. |
| T038 | Pièce confidentielle attribuée à un seul fournisseur | L’autre fournisseur, le visiteur et une autre organisation ne peuvent pas la récupérer. |
| T039 | Fichier en quarantaine, rejeté ou scan non configuré | Pas de badge clean ni diffusion automatique à un tiers ; état et opération à réaliser explicites. |
| T040 | Image publique approuvée et extrait privé du même dossier | Seule la dérivée publique autorisée est visible ; données EXIF inutiles et pièces privées non exposées. |

### Revue, organisations et intégrité Supabase

| ID | Scénario | Résultat attendu |
|---|---|---|
| T041 | Fournisseur tentant de devenir reviewer | Modification de métadonnées, formulaire et API directe sans effet sur les privilèges. |
| T042 | Reviewer autorisé examine un dossier assigné | Accès nécessaire disponible, action auditée ; notes internes et retour fournisseur distincts. |
| T043 | Demande de complément puis nouvelle soumission | Historique et versions conservés ; fournisseur peut corriger les champs autorisés. |
| T044 | Approbation valide avec conversion du dossier | Organisation, membre, sites, offres et projection publique cohérents ; aucune fuite du payload privé. |
| T045 | Approbation répétée ou deux reviewers concurrents | Idempotence et contrôle de version ; pas de double entreprise ni décision écrasée silencieusement. |
| T046 | Entreprise déjà présente avec identifiant approprié | Doublon pris en charge sans usurper l’entreprise ; rattachement soumis à une autorisation réelle. |
| T047 | Modification directe d’un statut ou d’une note de revue par le fournisseur | Chemins API, Data API et droits SQL exposés empêchent la modification non autorisée. |
| T048 | Invitation, acceptation et retrait d’un membre | Droits limités à l’organisation ; domaine email commun insuffisant pour rejoindre ; révocation effective. |
| T049 | Changement critique et correction éditoriale après publication | Politique versionnée respectée ; informations critiques retirées, historique et version approuvée maîtrisés. |
| T050 | Référence croisée de produit, site ou fichier d’une autre entreprise | Contraintes et permissions rejettent le rattachement même avec des identifiants existants. |

### Recherche et profils publics

| ID | Scénario | Résultat attendu |
|---|---|---|
| T051 | Ouverture du catalogue réel avec zéro fiche publiée | État vide honnête ; aucune entreprise fictive proposée comme fournisseur opérationnel. |
| T052 | Recherche d’un fournisseur effectivement publié | Fiche retrouvée avec les données approuvées, ses capacités et la provenance utile. |
| T053 | Critère obligatoire non satisfait | Résultat exclu du groupe compatible ; aucune relaxation silencieuse. |
| T054 | Critère obligatoire dont la valeur est inconnue | Inconnue explicitée dans un groupe adapté ou exclusion ; jamais critère déclaré satisfait. |
| T055 | Siège européen et usine hors UE | Filtre de fabrication fondé sur l’usine ou la référence concernée, pas sur le siège. |
| T056 | MOQ et demande exprimés dans des unités différentes | Pas de comparaison numérique brute ; conversion seulement si définie et applicable. |
| T057 | Critère préféré, synonymes et recherche FR/EN | Pertinence explicable ; identités et valeurs techniques non modifiées par la traduction. |
| T058 | Filtres, pagination, retour navigateur et partage d’URL | Contexte maintenu ; aucun contenu confidentiel inscrit dans l’URL. |
| T059 | Retrait d’une publication ou expiration d’une preuve | Résultats et cache actualisés ; signal expiré non présenté comme preuve en cours. |
| T060 | Consultation anonyme du payload de fiche | Liste blanche publique uniquement ; aucun contact privé, justificatif intégral ou décision interne. |

### Demandes de devis et destinataires

| ID | Scénario | Résultat attendu |
|---|---|---|
| T061 | Sélection anonyme puis création de compte | Sélection conservée sans écraser silencieusement une sélection déjà enregistrée. |
| T062 | Création et rechargement d’un brouillon acheteur | Contenu privé persistant ; aucun accès fournisseur ou reviewer non prévu. |
| T063 | Consultation du brouillon d’un autre acheteur | Accès refusé même si l’identifiant de demande est connu. |
| T064 | Aperçu avant envoi à plusieurs fournisseurs | Contenu, fichiers et destinataires nommés visibles ; aucune diffusion avant confirmation. |
| T065 | Double clic ou répétition réseau de la commande d’envoi | Une seule demande et un seul fil par destinataire ; notifications dédupliquées. |
| T066 | Fournisseur retiré entre sélection et envoi | Publication et admissibilité revérifiées ; choix corrigé explicitement, sans substitution cachée. |
| T067 | Échec au milieu de la création des destinataires | Transaction cohérente ; pas d’état envoyé complet avec des fils ou destinataires manquants. |
| T068 | Modification après transmission | Nouvelle version ou complément explicite ; contenu initial utilisé pour les offres conservé. |
| T069 | Partage d’un besoin avec l’assistance GSL | Accès limité au partage accepté ; aucune lecture implicite de tous les brouillons. |
| T070 | Ajout d’un destinataire ou annulation après un premier envoi | Action autorisée, explicite et auditée ; historique cohérent et notifications appropriées. |

### Messages, offres et comparaison

| ID | Scénario | Résultat attendu |
|---|---|---|
| T071 | Fournisseur X ouvre la conversation de Y | Refus sur lecture, écriture et téléchargement ; aucun prix concurrent révélé. |
| T072 | Message enregistré puis rechargé | Auteur et organisation vrais, persistance confirmée ; texte assaini, aucun HTML actif. |
| T073 | Répétition d’envoi d’un message après timeout | Pas de duplication indéfinie ; statut de persistance exact. |
| T074 | Offre avec plusieurs lignes, quantité et frais fixes | Calculs serveur exacts et périmètre comparable ; montant total expliqué. |
| T075 | Devise à zéro ou trois décimales et grands montants | Aucune hypothèse universelle de centimes ; sérialisation et calcul sans perte. |
| T076 | Offres de devises différentes sans taux de conversion disponible | Pas de classement numérique trompeur ; montants originaux et limite affichés. |
| T077 | Transport inconnu, variante et délai seulement indicatif | Écarts visibles ; offre non classée comme strictement équivalente aux autres. |
| T078 | Révision d’une offre et expiration de validité | Versions et dates conservées ; ancienne offre non présentée comme offre actuelle. |
| T079 | Acheteur retient une offre sans paiement intégré | État offre retenue ou commande déclarée exact ; aucun paiement ou commission annoncé à tort. |
| T080 | Changement d’organisation ou déconnexion pendant un échange | Données précédentes effacées de la vue ; droits revérifiés sur rafraîchissement ou abonnement. |

### Contact et notifications email

| ID | Scénario | Résultat attendu |
|---|---|---|
| T081 | Configuration contenant uniquement un email de contact confirmé | Email visible malgré nom ou société vide ; aucune donnée personnelle déduite. |
| T082 | Formulaire de contact valide | Demande avec référence enregistrée et mise en notification ; adresse visiteur utilisée sans usurper le From. |
| T083 | Formulaire abusif, injection et volume excessif | Validation et limitation actives ; pas d’envoi libre de contenu à des destinataires arbitraires. |
| T084 | Création d’une notification dans la même transaction que l’événement | Événement et tâche d’outbox cohérents ; aucune notification pour une transaction annulée. |
| T085 | Prestataire indisponible puis rétabli | Reprise contrôlée et bornée ; demande métier conservée ; échec non transformé en livraison réussie. |
| T086 | Deux workers prennent la même tâche | Coordination et déduplication effectives ; résultat traçable sans envois multiples incontrôlés. |
| T087 | Webhook non signé, répété ou arrivé dans le désordre | Événement rejeté ou traité de manière idempotente ; état final cohérent. |
| T088 | Réception sur une boîte contrôlée française et anglaise | Modèle, liens et langue vérifiés en réception ; aucune pièce confidentielle jointe par défaut. |
| T089 | Message rejeté ou adresse en échec permanent | Statut et file d’échec visibles à l’exploitation ; pas de réessai infini. |
| T090 | Préférences marketing refusées | Réponses transactionnelles nécessaires accessibles ; pas d’inscription marketing forcée. |

### Production, qualité et exploitation

| ID | Scénario | Résultat attendu |
|---|---|---|
| T091 | Construction avec la commande de la cible réelle | Typecheck, lint et build exécutés ; aucune réussite historique D1 présentée comme preuve Supabase. |
| T092 | Tests ou seeds lancés avec une URL de production | Refus explicite avant écriture ; fixtures réservées à l’environnement dédié. |
| T093 | Pages publiques, privées, démonstration et préproduction | Indexation appliquée par type ; données privées protégées par authentification et non par robots seuls. |
| T094 | Sitemap, canonical, hreflang et fiche supprimée | Seulement les URL publiables ; langues cohérentes ; statut HTTP approprié aux pages absentes. |
| T095 | Navigation complète FR/EN avec retour par email | Libellés, métadonnées, erreurs et étape cohérents ; aucune rupture de langue inexpliquée. |
| T096 | Mobile, clavier, zoom et lecteur d’écran sur étapes critiques | Actions atteignables, focus visible, erreurs annoncées ; pas de débordement bloquant. |
| T097 | Réduction de mouvement et réseau contraint | Recherche utilisable avant la vidéo ; pause et image de remplacement effectives. |
| T098 | Inspecter réponses, cache, logs et bundle public | Aucun secret serveur, token, contenu de dossier ou URL privée diffusé indûment. |
| T099 | Incident de file, revue en retard et suppression/export de données | Procédures d’exploitation utilisables ; événements traçables et rétention respectée. |
| T100 | Recette après déploiement autorisé et retour arrière contrôlé | Version servie identifiée, boucle fournisseur→devis vérifiée ; restauration documentée sans perte improvisée. |

### Conditions de réception

La recette ne remplace pas un audit juridique, un audit de sécurité approfondi ou l’évaluation commerciale. Aucun défaut d’accès croisé, de perte de données, de publication privée ou de faux succès sur un parcours central ne doit rester ouvert. Les pannes et dépendances externes doivent apparaître explicitement dans le bilan de lancement.

Le nombre de 100 cas est un périmètre de recette proposé, pas une mesure de couverture exhaustive ni une preuve que le site est terminé. Ajouter les tests découverts pendant l’implémentation.


## ANNEXE B — Sources et pièces du dossier

Les références ci-dessous orientent la vérification technique. Les observations de code sont attachées au commit audité ; revalider la branche actuelle. Les documents officiels doivent être relus pour les versions et règles effectivement applicables. Aucun extrait ou lien ne constitue une autorisation de publier une donnée privée.

- **C01 — API métier et fermeture sur Vercel** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/app/api/business/route.ts
- **C02 — Détection de déploiement et réponse 503** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/lib/hosting.ts
- **C03 — Configuration Next.js et remplacement Cloudflare** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/next.config.ts
- **C04 — Configuration Vercel** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/vercel.json
- **C05 — Espace acheteur, favoris et brouillons** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/app/api/workspace/route.ts
- **C06 — Authentification Supabase** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/app/api/auth/route.ts
- **C07 — Client Supabase côté serveur** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/lib/supabase/server.ts
- **C08 — Retour de confirmation par email** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/app/auth/callback/route.ts
- **C09 — Inscription fournisseur : modèle et validation** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/lib/onboarding/supplier-profile.ts
- **C10 — Liste de pays proposée** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/lib/onboarding/country-options.ts
- **C11 — Fiches de règles pays existantes** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/lib/onboarding/country-requirements.ts
- **C12 — Sélecteur de pays** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/components/country-picker.tsx
- **C13 — Enregistrement du dossier fournisseur** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/app/api/supplier-profile/route.ts
- **C14 — Téléversement des pièces fournisseurs** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/app/api/supplier-profile/files/route.ts
- **C15 — Interface du dossier fournisseur** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/app/supplier-workspace.tsx
- **C16 — Recherche et présentation du catalogue** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/app/discovery.tsx
- **C17 — Page d’accueil industrielle** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/app/industrial-home.tsx
- **C18 — Configuration du contact et de l’exploitant** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/lib/operator.ts
- **C19 — Affichage du contact** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/app/operator-contact.tsx
- **C20 — Layout, langue HTML, métadonnées et noindex** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/app/layout.tsx
- **C21 — Routes génériques et métadonnées de démonstration** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/app/[...slug]/page.tsx
- **C22 — Dépendances et commandes du projet** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/package.json
- **C23 — Documentation de démarrage** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/README.md
- **C24 — Historique fonctionnel et tests documentés** : https://github.com/didou34000/gsl-systems/blob/ca1f72f62e1326156f6438e7dc9f2002d94028ac/PROJECT-NOTES.md
- **C25 — Commit de référence du dépôt** : https://github.com/didou34000/gsl-systems/commit/ca1f72f62e1326156f6438e7dc9f2002d94028ac
- **S01 — Supabase : authentification serveur et cookies** : https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs
- **S02 — Supabase : Row Level Security** : https://supabase.com/docs/guides/database/postgres/row-level-security
- **S03 — Supabase : SMTP et emails en production** : https://supabase.com/docs/guides/auth/auth-smtp
- **S04 — Supabase : sécurité des mots de passe** : https://supabase.com/docs/guides/auth/password-security
- **S05 — Supabase : limites et protection contre les abus** : https://supabase.com/docs/guides/auth/rate-limits
- **S06 — Google : noindex** : https://developers.google.com/search/docs/crawling-indexing/block-indexing
- **S07 — Google : sites multilingues** : https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites
- **S08 — W3C : formulaires accessibles** : https://www.w3.org/WAI/tutorials/forms/
- **S09 — W3C : formulaires en plusieurs étapes** : https://www.w3.org/WAI/tutorials/forms/multi-page/
- **S10 — W3C : messages d’erreur et de confirmation** : https://www.w3.org/WAI/tutorials/forms/notifications/
- **S11 — GLEIF : répertoire des autorités d’enregistrement** : https://www.gleif.org/en/lei-data/code-lists/gleif-registration-authorities-list
- **S12 — GLEIF : formes juridiques et codes de référence** : https://www.gleif.org/en/lei-data/code-lists/
- **S13 — Google : métadonnées internationales d’adresses** : https://github.com/google/libaddressinput/wiki/AddressValidationMetadata
- **S14 — Google : numéros de téléphone internationaux** : https://github.com/google/libphonenumber
- **S15 — UE : vérification VIES et limites de son interprétation** : https://europa.eu/youreurope/business/finance-and-tax/vat/check-vat-number-vies/index_en.htm
- **S16 — UE : BRIS et registres d’entreprises** : https://e-justice.europa.eu/topics/registers-business-insolvency-land/business-registers-search-company-eu/general-information-find-company_en
- **S17 — Royaume-Uni : consultation du registre Companies House** : https://www.gov.uk/guidance/searching-the-companies-house-register
- **S18 — Allemagne : portail officiel des registres** : https://www.handelsregister.de/rp_web/welcome.xhtml
- **S19 — Italie : registre officiel des entreprises** : https://italianbusinessregister.it/en/home
- **S20 — Pologne : registres CEIDG et KRS** : https://biznes.gov.pl/en/portal/004161
- **S21 — Espagne : informations du Registro Mercantil** : https://www.registradores.org/en/informacion-al-ciudadano/servicion-on-line
- **S22 — États-Unis : immatriculation et juridictions** : https://www.sba.gov/counseling/launch-your-business/#register-business
- **S23 — CNIL : protection des données dès la conception** : https://www.cnil.fr/fr/organiser-les-processus-internes
- **S24 — CNIL : information des personnes** : https://www.cnil.fr/fr/falc-droit-information
- **S25 — CNIL : refus des cookies** : https://cnil.fr/fr/refuser-les-cookies-doit-etre-aussi-simple-quaccepter-mise-en-conformite-de-tous-les-organismes
- **S26 — UE : marquage CE et procédures applicables aux produits** : https://europa.eu/youreurope/business/product-rules-compliance/general-product-compliance/ce-marking/index_en.htm

Pièces complémentaires : `GSL_AUDIT_COMPLET_2026-09-29.md`, `GSL_RECETTE_100_TESTS.md` et `SOURCES_ET_PREUVES.json`. Ce prompt contient néanmoins la mission et la grille de recette pour rester utilisable indépendamment.
