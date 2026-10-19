# Product approval and photos rollout

Apply `supabase/migrations/20261019143000_supplier_product_review_photos.sql` to the intended Supabase project **before deploying the application commit**. Use the normal project migration process, or execute the migration once through the Supabase SQL editor. No production migration is performed by this PR.

The migration creates private product requests, an immutable decision log, a private WebP image bucket and its storage policies. It changes the existing supplier publication RPC to private submission and introduces `submit_supplier_products`. The new application deliberately does not fall back to immediate publication when that RPC is missing.

Administrators with an existing active platform `owner` or `admin` role and AAL2 can review submissions at `/administration/validation-produits`. No new administrator access is granted. They must review the submitted snapshot, its photos, catalogue family, production site, robotics use and source before approving, or return feedback for correction.

Smoke test with a disposable supplier product: save a complete product; upload a JPEG/PNG/WebP (maximum 3 MB; five selected photos); submit; confirm an anonymous session cannot open the pending product or photo; approve with an administrator; confirm the catalogue, product page and selected photos become public. Edit and resubmit: the previous approved version must remain public until the new version is approved. Submit a removal/private draft: the public product and its photos must become inaccessible.

Existing public products are preserved. New submissions and later supplier changes use the approval flow. Removed image selections remain attached to a historical approved snapshot until a replacement is approved or the product is withdrawn. Image bytes are re-encoded as bounded WebP without original metadata.

Local validation: production build and TypeScript; PostgreSQL/PGlite migration and publication lifecycle tests; API tests with mocked Auth/Storage transport and real raster conversion; supplier schemas and image derivation; ten-language coverage. Hosted Supabase Auth/Storage and production deployment must still be verified after applying the migration.
