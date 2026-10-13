# Sourcing de composants, devis et livraison — 13 octobre 2026

## Périmètre livré

Le catalogue public contient huit familles de composants et les dix pays hors Union européenne du projet. Les projections `component_products` et `component_supplier_profiles` écartent les robots complets et les contenus hors périmètre sans supprimer les organisations, produits, sources ou dossiers historiques. Deux anciennes URL de familles redirigent vers la famille mécanique ou le catalogue. Les anciennes fiches produits restent consultables comme références historiques, sans admission implicite au catalogue.

Le parcours `/decrire-mon-besoin` → `/suivi` enregistre un véritable brouillon privé, une référence et les composants demandés. Une confirmation distincte transmet le dossier aux administrateurs GSL habilités. Aucun fabricant, transporteur ni destinataire email n’est contacté automatiquement. Le fabricant préféré est conservé comme contexte, même quand sa fiche représente une capacité sourcée et non un compte fournisseur inscrit.

`/administration/sourcing` permet qualification, versions immuables des devis, commissions internes, partenaires manuels, expéditions, documents privés et historique. La sélection par l’acheteur porte sur la dernière version valide : elle ne signifie ni paiement ni réservation. Les statuts production, expédition et livraison représentent des événements que l’opérateur doit confirmer, jamais des actions exécutées automatiquement.

## Ordre de mise en service

1. Examiner la PR et sauvegarder la base. Ne pas appliquer de migration en production pendant la revue.
2. Dans un projet Supabase de test, appliquer les migrations existantes puis `supabase/migrations/20261013130000_component_sourcing_delivery.sql`. La migration est additive et ne publie aucune des 70 entreprises. Recharger le schéma PostgREST après application si nécessaire.
3. Configurer Auth et `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` conformément à `docs/AUTHENTICATION.md` et `docs/environment.example`. Utiliser un compte confirmé, une organisation acheteuse et un propriétaire GSL explicitement habilité. Les administrateurs doivent satisfaire AAL2 ; les analystes ne lisent pas les contacts.
4. Configurer le bucket privé `gsl-private` et le service d’analyse de fichiers existant (`GSL_SCAN_URL`, `GSL_SCAN_TOKEN`, clé service côté serveur uniquement). Les fichiers commerciaux sont limités à 3 Mio et les dossiers à 20 pièces. MIME détecté par signature ; une analyse absente ou échouée reste en attente. Les acheteurs ne téléchargent pas les pièces commerciales non analysées. Les pièces techniques non analysées empêchent la transmission. Sans scanner configuré, l’upload commercial renvoie une erreur réelle ; aucune analyse positive n’est simulée.
5. Depuis le compte propriétaire AAL2, importer `data/gsl-70-import-2026-10-13.json` dans la file de qualification. Examiner les preuves et sources de chaque entreprise avant publication. Tester le parcours sur cette base, y compris les rôles, pièces scannées et statuts.
6. Après validation humaine seulement, suivre le processus habituel de fusion et déploiement. Cette PR n’exécute ni migration hébergée, ni fusion, ni déploiement.

Un schéma absent, des clés absentes ou une RPC indisponible produisent une erreur explicite. La confirmation affichée dépend du résultat de l’enregistrement ; l’interface ne remplace pas une base indisponible par un faux succès. Les notifications existantes sont séparées : SMTP n’est pas requis pour ce parcours, qui ne prétend envoyer aucun email.

## Tableau réel des 70 entreprises

Source : [GSL — 70 fabricants et composants pour la robotique](https://docs.google.com/spreadsheets/d/1be8L5jLs2Qgz46eOSQDPLcteZhzbF_oSOQzNwhnbFrg/edit), onglet Entreprises, plage B7:O77, lue le 13 octobre 2026. Le document d’origine n’a pas été modifié.

Le snapshot et le script `node scripts/prepare-gsl-70.mjs` produisent 70 identifiants stables avec liens, provenance, grades et réserves : 29 A, 35 B, 6 C. Le filtrage de famille retient 46 candidats composants/périphériques ; les 24 autres lignes restent conservées hors catalogue public. Ce classement de périmètre n’est pas une validation technique. Les dates du tableau indiquent une lecture/import, pas une visite ou vérification indépendante des usines.

L’import est idempotent et privé. Un candidat commence non publié et « production à vérifier ». B/C ne deviennent jamais « offre explicitement robotique » automatiquement. Une production C exige une preuve complémentaire et une nouvelle source examinée. Les robots complets ne sont pas publiables comme composants. Les certificats doivent indiquer émetteur, périmètre, source et date ; sans validité connue ils n’activent pas le filtre des certifications en cours. Les décisions de qualification conservent leurs versions privées.

## Devis et confidentialité

Les montants sont saisis dans une seule devise et conservés en unités monétaires mineures entières, sans conversion automatique. Produits, transport, assurance, coordination, droits et taxes portent un statut confirmé, estimé, à confirmer ou exclu. Le total livré ferme est absent dès qu’un poste est incertain ou qu’une exclusion est renseignée. Des droits confirmés exigent une preuve sourcée et datée pour chaque composant (origine et classement), même pour un montant nul.

Les mutations sont validées dans l’API et dans PostgreSQL, avec révision et idempotence. L’accès se limite aux membres autorisés de l’organisation acheteuse, puis aux administrateurs GSL autorisés après transmission explicite. Les commissions internes, partenaires et données d’import ne sont pas exposés aux acheteurs. Les fichiers utilisent le stockage privé et des règles distinctes de lecture après analyse. Les commandes RFQ historiques ne peuvent contourner les révisions, la transmission ou le choix d’un devis du nouveau parcours.

## Transport réel et paiement : décisions restantes

Aucun transitaire, tarif, compte de paiement ni identifiant prestataire n’est inventé. `lib/sourcing/integrations.ts` expose les interfaces de futurs adaptateurs ; elles n’ont aucune implémentation active. `private.delivery_payment_events` prépare la déduplication future sans endpoint public d’écriture ni écran de paiement.

Avant transport réel, contractualiser le partenaire, confirmer sa couverture, obtenir un vrai devis, déterminer l’Incoterm et le lieu convenu, désigner l’importateur et préciser documents, assurance et contraintes. Le passage « expédié » exige ces données, un partenaire confirmé pour le pays d’origine et le suivi. Une saisie administrative n’est pas une preuve externe ni une réservation.

Avant paiement, décider le rôle contractuel GSL (coordination, rémunération, responsabilité, facturation, remboursements et litiges), choisir un prestataire habilité pour ce montage et vérifier individuellement les dix pays des fabricants. GSL n’est pas implicitement revendeur ou importateur. Aucun encaissement pour compte de tiers sur un compte bancaire ordinaire n’est implémenté. Le futur adaptateur doit utiliser le test prestataire, contrôler montant/devise/version côté serveur, vérifier les signatures sur le corps brut des webhooks et dédupliquer leurs événements avant tout état « payé ». Aucune donnée de carte ne doit être stockée.

Références officielles consultées le 13 octobre 2026 : [Commission européenne — importation dans l’UE](https://policy.trade.ec.europa.eu/help-exporters-and-importers/importing-eu_en), [Access2Markets — origine et produit](https://trade.ec.europa.eu/access-to-markets/en/my-trade-assistant), [Stripe — couverture conditionnelle des paiements transfrontaliers Connect](https://docs.stripe.com/connect/cross-border-payouts). Stripe n’est pas sélectionné. Un accord commercial ne garantit ni exonération ni conformité ; le classement, l’origine, le montage et les exigences du produit doivent être examinés pour le dossier concerné.

## Vérifications reproductibles

- `npm run test:sourcing` : API réelles avec dépendances Auth/RPC isolées, validations, PostgreSQL en mémoire avec toutes les migrations et données réelles d’import, rôles/AAL2, consentement, isolation entre acheteurs, versions, montants exacts, fichiers commerciaux, statuts et absence de paiement simulé.
- `node scripts/test-postgres.mjs` : régressions RFQ, messagerie, fichiers/scanner, publication, confidentialité et pagination existantes ; régénère les types de tables.
- `node scripts/test-curated-catalogue-postgres.mjs` : préservation et édition du catalogue historique.
- `npm run build` et TypeScript : build Next de production.
- `scripts/serve-sourcing-fixtures.mjs` : serveur local de fixtures fictives, base en mémoire, aucun accès Auth/écriture externe. Réservé aux tests, jamais démarré en production. Le navigateur isolé a vérifié catalogue → fabricant → demande persistée → devis admin → sélection acheteur, puis affichages 1440 et 390 px.

Ces tests ne prouvent pas la configuration Auth/Storage/scanner hébergée, la réalité d’une prestation logistique ni celle d’un contrat de paiement. Les vérifier dans un environnement dédié avant ouverture commerciale.

### Test navigateur local

Après `npm run build`, dans des terminaux dédiés :

```sh
node scripts/serve-sourcing-fixtures.mjs
SUPABASE_URL=http://127.0.0.1:5192 SUPABASE_PUBLISHABLE_KEY=local-sourcing-fixture GSL_ENVIRONMENT=test npm run start -- --hostname 127.0.0.1 --port 5173
GSL_PLAYWRIGHT_MODULE=/chemin/vers/playwright/index.mjs node scripts/test-sourcing-browser.mjs
```

Utiliser un Playwright fourni par l’environnement de test avec Chrome installé (aucune dépendance prestataire ajoutée à l’application). Les fixtures n’autorisent que les opérations isolées décrites dans le script et ne transmettent aucun cookie ou accès Auth au serveur Next. Arrêter les deux serveurs après test. Les captures sont écrites dans `/tmp`.
