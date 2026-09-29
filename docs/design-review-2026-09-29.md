# GSL Systems sourcing interface — 29 September 2026

Shared anthracite, ivory and terracotta identity, serif editorial headings and sans-serif controls. Updated public discovery, profile templates, auth, supplier onboarding, and shared workspace surfaces. Chain logo and favicon use terracotta.

## Verified
- Production build succeeds.
- Lint: zero errors; 51 existing/general warnings (mainly image optimization).
- Operational integration suite passes locally in PGlite, including isolation and RFQ workflows.
- Browser checks at 1440 × 1000 and 390 × 844: homepage, catalogue filters, sign-in, country and guide pages.
- Homepage search preserves both query and country in the destination catalogue.
- Country, capabilities and volume filters are expanded; matching preferences collapsed.
- Mobile homepage and sign-in have no horizontal overflow.
- Supplier UI exposes five steps; submission requirements are preserved.

## Limits
- Local Supabase credentials are not configured. The live catalogue displays an honest unavailable state. Published profile templates and authenticated workspace/onboarding were reviewed in code, not validated with hosted accounts/data.
- No production deployment or hosted database changes performed as part of this design update.
- Country links without a dedicated editorial country page open the existing country-filtered directory.
- Some existing guide content remains in French, explicitly labelled.
