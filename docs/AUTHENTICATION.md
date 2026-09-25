# Account authentication — 25 September 2026

Production uses Supabase Auth (project `ihugldueruspxdyooycc`). The former ChatGPT header authentication remains disabled on Vercel.

## Available routes

- `/connexion`: email/password login; link to registration and recovery.
- `/inscription`: name, email, password and confirmation; email verification required.
- `/mot-de-passe-oublie`: recovery email.
- `/auth/callback`: PKCE exchange; expired/missing codes return to a useful error page.
- `/nouveau-mot-de-passe`: password update after authenticated recovery.
- `/compte`: verified session, private profile, sign out.
- `/professionnel`: redirects to the account on Vercel. The legacy business portal stays on Sites.

## Security and configuration

The server uses the project publishable key, not a service-role key. Session cookies are HttpOnly, SameSite=Lax, Secure in production, host-only. Auth requests validate the browser Origin against the three owned production origins. Return paths exclude external URLs and auth/API endpoints. Each authenticated request verifies the user with Supabase; profile operations are scoped by the verified ID and RLS. Metadata never confers authorization. No passwords or session tokens are returned in JSON or written to application logs. Private responses use no-store. Session refresh cookies are written in route handlers; no auth client is used in server components or browser localStorage.

Supabase has email confirmation enabled and a 12-character minimum password. SMTP is configured through OVH with contact@gsl-systems.com (credentials stored only in Supabase). Callback and recovery callback URLs are explicitly allowed for www.gsl-systems.com and gsl-systems.vercel.app. Do not broaden these to arbitrary preview hosts.

The default email link must be opened in the same browser used to request it (PKCE). A cross-browser/expired link presents a resend path. SMTP acceptance alone does not prove inbox delivery; validate registration and recovery with an owned mailbox before claiming end-to-end completion.

## Scope

Account access and private profile are integrated. RFQs, supplier onboarding, document uploads, bookmarks and messaging on the public deployment remain unavailable; their existing demonstration notice is retained. This change does not migrate legacy D1 data.

## Validation

- `node --experimental-strip-types scripts/test-auth-policy.mjs`
- `VERCEL=1 npx next build --webpack`
- HTTP checks: public forms, unauthenticated profile denial, cross-origin denial, password/email validation, incorrect credentials, ignored spoofed legacy identity headers.
- Supabase security advisor returned no findings.
