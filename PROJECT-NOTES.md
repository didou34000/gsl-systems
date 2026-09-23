# FORGE — première version

Prototype interactif de marketplace industrielle B2B, en français.

## Disponible
Catalogue fictif, recherche texte, pays et secteur, filtre quantité minimale, tri, sélection temporaire, comparateur (3 produits), fiches produits, annuaire fabricants, demande de devis simulée avec validation, parcours fournisseur simulé, méthode de vérification.

## Limites explicites
Aucune commande ni transmission à un fournisseur. Aucun compte métier, base de données, stockage documentaire, messagerie ou paiement réel. Sélections en mémoire de session seulement. Les écrans sont des vues client, pas encore des pages SEO indépendantes. Pas de certifications vérifiées. Nom FORGE provisoire.

## Suite technique
Définir le nom et le secteur pilote. Connecter les comptes professionnels et organisations (Supabase envisagé), puis produits, dossiers documentaires, demandes de devis et conversations avec permissions par organisation. Créer les URL produit/fabricant et les métadonnées SEO. Ajouter l'administration avant intégration de fournisseurs réels. Finaliser conditions commerciales et commissions avant les paiements.

## Validation
TypeScript sans erreur. Aperçu HTTP 200. Recherche WebMCP testée avec entrée valide et invalide. Parcours de devis validé dans le navigateur avec données fictives.
