# Couverture pays — 29 septembre 2026

La saisie utilise la liste ISO 3166-1 alpha-2 du dépôt, un sélecteur localisé recherchable et des drapeaux SVG. Ce support de saisie n'est pas une autorisation de transaction mondiale. Aucun score de risque n'est déduit de la nationalité.

Les champs privés sont une politique de complétude GSL, pas une liste universelle d'obligations légales. Un document ou un format valide ne prouve jamais l'existence ni la représentation d'une entreprise. Une explication d'absence d'immatriculation peut conduire à une revue manuelle. Les numéros fiscaux personnels ne sont pas demandés par défaut.

| Pays | Modèle du code | Distinctions et état |
|---|---|---|
| FR | Local | SIREN, SIRET et TVA séparés ; source Service public relue le 29/09 ; règles documentaires à revoir périodiquement |
| TR | Local | MERSİS, registre/bureau et fiscalité séparés ; source ministère relue le 29/09 ; entrepreneurs individuels en revue manuelle |
| GE | Local existant, à revoir | NAPR, code société, siège distinct des sites ; relecture web non concluante dans cette passe |
| MA | Local existant, à revoir | RC/tribunal, ICE et fiscalité séparés ; relecture web non concluante |
| TN | Local existant, à revoir | Référence RNE telle que déclarée ; relecture web non concluante |
| GB | Documenté, revue manuelle | Companies House si applicable ; pas de numéro fiscal imposé à toutes les entités |
| DE | Documenté, revue manuelle | Autorité/tribunal, type de registre et référence distincts de TVA |
| IT | Documenté, revue manuelle | Registre/autorité, code fiscal société et TVA séparés ; accès gratuit non promis |
| US | Documenté, revue manuelle | Juridiction de constitution et registre ; pas d'EIN universel imposé |
| PL | Documenté, revue manuelle | KRS pour les sociétés si applicable, CEIDG pour entrepreneurs individuels ; pas de KRS universel ni identifiant fiscal personnel imposé |
| ES | Documenté, revue manuelle | Registre émetteur, référence et type de justificatif ; distinction note informative / certification du registre |
| RO, CN | Secours manuel | Autorité et identifiant si applicables, preuve ou explication ; pas de modèle local présenté comme vérifié |
| Autres codes ISO | Secours manuel | Raison sociale originale, forme, registre applicable, document ou explication et décision humaine |

RO/CN requièrent encore une fiche locale plus détaillée pour couvrir totalement les distinctions demandées dans le cahier. Ni KRS/CEIDG ni la licence chinoise ne font l’objet d’une vérification automatique.

Adresses : lignes libres, ville, subdivision et code postal facultatifs, écritures originales conservées. Il n'existe pas encore de référentiel complet d'ordre d'adresse par pays. Téléphones : libphonenumber-js 1.12.31, saisie originale et E.164, pays explicite facultatif avec indicatif ; cela ne vérifie pas la possession du numéro.

Les versions de règles sont inscrites dans le payload soumis, conservé dans `supplier_submission_versions`. Le propriétaire de maintenance indiqué est GSL systems, Dorian Vuattoux et Célian Duval ; aucune habilitation technique de revue n'est attribuée par ces seuls noms.

## Sources effectivement consultées dans cette reprise

- FR : https://entreprendre.service-public.gouv.fr/vosdroits/F32135
- TR : https://ticaret.gov.tr/ic-ticaret/ticaret-sicili/merkezi-sicil-kayit-sistemi-mersis
- GB : https://www.gov.uk/guidance/searching-the-companies-house-register
- DE : https://www.handelsregister.de/rp_web/welcome.xhtml
- IT : https://italianbusinessregister.it/en/home
- US : https://www.sba.gov/counseling/launch-your-business/

Date de consultation : 29 septembre 2026. Une page accessible confirme une source, pas toutes les obligations d'une forme juridique. Les sources historiques des cinq modèles initiaux restent dans `lib/onboarding/country-requirements.ts` avec leur date antérieure.

## Tests

`test-country-requirements.mjs` : champs isolés par pays, formes individuelles, absence de pouvoir de s'auto-vérifier, secours manuel, explication d'absence d'identifiant, juridiction US sans EIN obligatoire. `test-supplier-profile.mjs` : brouillons partiels, dates, URL, périmètre des justificatifs et référence produit. Pas encore de recette hébergée pour toutes les écritures/adresses.

- [Pologne, portail officiel](https://biznes.gov.pl/en) : KRS/CEIDG, consulté le 29 septembre 2026.
- [Espagne, Registradores](https://www.registradores.org/en/informacion-al-ciudadano/servicion-on-line) : types de justificatifs, consulté le 29 septembre 2026.
