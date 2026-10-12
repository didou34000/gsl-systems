# Spécialisation robotique — déploiement

Le catalogue public, l’accueil, les fabricants, les familles et le comparateur utilisent exclusivement `robotics_products` / `search_robotics_catalogue`. Les anciennes publications restent conservées ; elles ne sont plus des candidats implicites à la robotique. Les anciennes fiches produit accessibles par leur URL affichent leur absence d’admission. Les anciennes pages de secteurs sans équivalent robotique retournent 404, sans redirection vers l’accueil.

## Activation

1. Appliquer `supabase/migrations/20261012120000_robotics_selection.sql` avant de déployer le code. La migration ne publie ni ne supprime de fabricant.
2. Vérifier que l’import documenté du 9 octobre 2026 est présent (INMOLD, F019).
3. Pour importer la première offre, charger `data/robotics-catalogue-2026-10-12.json` via un paramètre lié dans une transaction PostgreSQL administrative, définir `gsl.robotics_payload` avec le JSON et `gsl.import_actor` avec l’UUID réel d’un propriétaire GSL actif, puis exécuter `supabase/operations/import-robotics-catalogue.sql`. Aucun UUID d’utilisateur ne doit être inventé. Le script refuse un acteur sans habilitation et les collisions. Sa réexécution conserve les éditions existantes.
4. Déployer la branche, puis vérifier `/catalogue?lang=fr&q=robotique`, `/secteurs`, la fiche INMOLD et le parcours de demande sur mobile.

La compilation locale utilise une base fictive isolée. Aucune migration ni import n’a été exécuté sur la production par ce lot. Aucun fournisseur n’a été contacté.

## Admission des prochaines offres

L’exploitant doit établir et conserver trois preuves : fabrication réelle d’une offre pour la robotique, site de production dans TR/MA/TN/RS/MK/BA/MD/GE/AL/EG, sources datées décrivant l’offre. L’utilisation d’un robot par un atelier, un procédé CNC, un certificat d’entreprise ou un accord commercial ne suffisent pas.

Une admission référence la révision publiée du produit ET de l’entreprise. Une nouvelle publication les invalide : réexaminer l’offre et actualiser explicitement l’admission. Une fiche retirée disparaît de la sélection, même si une admission existe. Seule une connexion serveur habilitée peut écrire les admissions ; ce lot ne crée aucun droit dans le navigateur. Les décisions sont consignées dans le journal éditorial. Le premier import est volontairement borné à l’offre INMOLD étudiée.

Les caractéristiques numériques sont des chaînes en unités canoniques : kg, mm, N, N·m, tr/min, arcmin, V, Hz selon `lib/robotics.ts`. Ne jamais extraire automatiquement un chiffre d’un texte ambigu ni inventer charge, portée ou cadence. Les bornes numériques excluent une valeur absente ; l’option « Afficher séparément » les distingue. Une offre documentée n’est ni une garantie de disponibilité ni une attestation de conformité.

## Première fiche préparée

INMOLD : robots IML fabriqués en Serbie, sources officielles examinées le 12 octobre 2026. R928 constitue un exemple historique de livraison de 2022 (12 empreintes, contenants de 200 ml), pas une promesse de stock ou de performance actuelle. Charge, portée, interfaces, cadence et conditions commerciales restent à confirmer. La demande passe par GSL puisque la fiche documentaire n’établit pas l’inscription du fabricant.

## Mesure du parcours

`lib/journey-analytics.ts` émet des événements navigateur `gsl:journey` : résultats de recherche (nombre, présence d’une requête, famille), ouverture d’une fiche, ajout à la comparaison, passage d’une étape de demande et enregistrement d’une demande structurée. Aucun texte recherché, plan, contenu du besoin, email ou identité n’est émis. Brancher le collecteur choisi par l’exploitant sur ces événements pour mesurer les recherches sans résultat, clics, comparaisons et abandons par étape. Sans collecteur configuré, ces événements ne constituent pas une statistique centralisée. « qualified_request_saved » signifie dossier valide enregistré, pas qualification humaine ni envoi à un fabricant. Les délais et la pertinence des réponses nécessitent une mesure dans le suivi opérationnel.

## Validation

- `npm run test:robotics` : critères, admission et demandes.
- `node scripts/test-robotics-postgres.mjs` : migrations sur PGlite isolé, import et droits, périmètre, révisions, recherche, inconnues et bornes.
- `node scripts/test-curated-catalogue-postgres.mjs` : non-régression du catalogue et des accès existants.
- `node scripts/test-requirement.mjs` : données techniques exportées/enregistrées, brouillons historiques, quantités et limites.
- `node node_modules/typescript/bin/tsc --noEmit` et `node node_modules/next/dist/bin/next build --webpack`.
- `scripts/serve-robotics-fixtures.mjs` : démonstration locale fictive pour contrôles visuels, sans donnée ni écriture en production.

Contrôle Chrome local sur les versions exactes du package-lock : accueil, familles publiées, filtres, comparateur → demande, export technique, ordinateur et mobile 390 px sans débordement.
