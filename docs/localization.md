# Interface languages

The interface supports English, French, Spanish, Portuguese, German, Italian, Turkish, Arabic, Hindi and simplified Chinese. The selector uses native language names. Arabic sets `dir="rtl"` on the HTML document; codes, email addresses and user content retain their values.

## Coverage

The member dashboard, account access and security, inbox, buying requests, quotes, team permissions, requirement builder, supplier workspace, upload controls, main home and catalogue screens use the shared dictionaries in `lib/i18n/`. The administration dashboard has its own complete dictionary in `lib/admin/translations.ts`.

`l(english, french)` preserves existing English and French copy. Each additional-language dictionary row contains Spanish, Portuguese, German, Italian, Turkish, Arabic, Hindi and Chinese, in that order. Generated photo labels and supplier validation messages use narrowly scoped templates. Country pickers have fixed localized country labels to keep server and browser rendering consistent.

Supplier-written descriptions, messages, specifications, filenames, company names and contact details are not automatically translated. Demo product text currently falls back to English outside French. Older editorial/legal pages remain French and show a localized availability notice. Any other missing dictionary key falls back to English, never an undefined label.

## Persistence and server boundaries

- The `gsl-language` cookie and the `lang` query parameter accept only the ten supported codes. Internal site links preserve language, filters and fragments; API URLs and external links remain intact.
- Signup, password recovery, authentication callbacks and saved profiles retain the selected language.
- `20261006213000_ten_languages.sql` extends profile and contact-request constraints and contact submission validation. It preserves the contact's selected language for administrators. Apply it with the other pending migrations before publishing these code changes.
- Transactional notification templates are still English/French. A French preference receives French; the eight new languages receive English. The stored contact/interface preference remains unchanged. This change does not send any email itself.

## Verification

Run `npm run test:i18n` for dictionary shape, live-source coverage of the critical interfaces, routing, Arabic direction, non-Latin search, and a fully isolated PostgreSQL/Auth fixture. The fixture checks all ten profile and contact preferences, contact retry idempotency, invalid-code rejection, notification-language fallback, and actual API/callback logic with a mocked transport. It refuses hosted database configuration and sends no external requests.

`node scripts/test-supplier-translations.mjs` checks supplier controls and generated labels. `node scripts/test-requirement.mjs` and `node scripts/test-discovery.mjs` protect request serialization and catalogue identity/search behavior. Hosted Supabase migration parity and email delivery require a separate deployment check.
