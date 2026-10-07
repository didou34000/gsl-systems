# Administration dashboard

The dashboard at `/administration` uses the authenticated session for `GET /api/admin` and `POST /api/admin`. It never uses a service-role key. Every response is private and non-cacheable. The contract is in `lib/admin/types.ts`.

## Access

Administration is an explicit UUID grant in `private.platform_admins`, separate from supplier review in `private.platform_reviewers`. Administration requires a confirmed, active account and a Supabase `aal2` session. Neither the user's email nor editable metadata is used to authorize access. Revocation, role changes, a future `auth.users.banned_until`, or a non-null `deleted_at` take effect on the next request without waiting for a JWT refresh. Expired bans permit the existing live grant again. Mutations and exports lock the actor's Auth row and grant while checking permissions, so concurrent role revocation or suspension waits for an already-authorized transaction and prevents subsequent writes.

The migrations create no administrators or owners. Existing grants become `admin`, which cannot manage access. Bootstrapping the first owner requires an independently authorized, controlled database operation binding the exact existing, confirmed, active `auth.users.id`. If the requested account does not exist or is not confirmed, registration/confirmation must happen first. Do not substitute a similar email, create a password on the user's behalf, or automatically grant a future account based on its email. The initial owner grant is an operational prerequisite; the application never promotes itself.

The controlled operation is `supabase/operations/grant-platform-owner.sql`, kept outside the migration history. Its caller supplies the exact UUID, matching email and reason in transaction-local settings, then executes it in the same transaction. It grants `owner` plus the independent reviewer capability, records the server operation distinctly from a signed-in user, and is idempotent. The [activation runbook](admin-owner-activation.md) documents the pending production activation. Reviewer authorization now also checks live account confirmation, suspension and soft deletion, including previously issued AAL2 tokens.

The four fixed permission sets are defined in SQL and mirrored by `lib/admin/permissions.ts` for display:

| Permission | Analyst | Operator | Admin | Owner |
| --- | --- | --- | --- | --- |
| `overview.read` | yes | yes | yes | yes |
| `catalog.read` | yes | yes | yes | yes |
| `contacts.read` | no | yes | yes | yes |
| `contacts.manage` | no | yes | yes | yes |
| `tasks.manage` | no | yes | yes | yes |
| `activity.read` | yes | yes | yes | yes |
| `data.export` | no | no | yes | yes |
| `access.manage` | no | no | no | yes |

Every role retains read access to its own tasks and can save its own widget preferences. The SQL functions check the live grant independently of the frontend and HTTP validation. Former private implementations are explicitly revoked from clients; they are not alternate APIs that bypass the permission checks.

`public.admin_access()` returns only the caller's `{isAdmin, canReview, mfaRequired}`. It is available at AAL1 so navigation can guide an administrator to their existing account MFA screen. It does not disclose other users or dashboard data. A separate reviewer grant remains necessary to use document-review functions; the snapshot's `viewer.reviewer` controls that link.

The new tables live in the private schema, have RLS enabled, and have no client table privileges. Exposed RPC wrappers are `SECURITY INVOKER`. Their private implementations have a fixed empty `search_path`, explicit authentication/role/MFA checks, and narrowly granted execution privileges.

## Data and actions

The snapshot contains real aggregate counts from the existing database. No monetary revenue, delivery rate, growth percentage, or fabricated metric is generated. The 30-day UTC series counts organization creation, product creation, and contact receipt, including zero days. Counts of all organizations/products can include records without a public listing; `publishedCompanies` and `publishedProducts` count visible published records. A product belonging to a withdrawn company is considered withdrawn.

Company and product detail arrays select a public-field whitelist from published projections. They include withdrawn projections for administration, but exclude application payloads, private legal identifiers, attachments, specifications, and business-message contents. Contact content requires `contacts.read`; analysts receive `contacts: []` and `totals.contacts: 0`. All roles can see aggregate open-contact counts and the daily number of received contacts, without sender identities or message contents. Reviewer privileges remain independent of these presets.

Tasks and widget preferences belong to the individual administrator and persist in PostgreSQL. There is a maximum of 250 tasks per administrator. All task CRUD, drag sorting, status changes, and widget reorder mutations require the current workspace `revision`. A row lock plus revision comparison prevents stale tabs from overwriting newer changes. A reorder must contain every task exactly once and cannot include another administrator's task. Dates and lengths are checked both in the HTTP boundary and in the database.

Contacts can be marked resolved or reopened with `contacts.manage`. The command includes `expectedResolvedAt`, and the row is locked before comparing that value, so one tab cannot overwrite a newer contact decision. Marking a contact resolved does not send a reply. Every successful change records an activity entry. Task and preference entries are visible only to their owner, contact events require `contacts.read`, reviewer events require the separate reviewer grant, and access events require `access.manage`. Export events are visible only to the exporter while that user retains export permission. Unknown event kinds are denied until explicitly assigned a scope.

Read bounds are explicit: 1,000 company projections, 1,000 product projections, 500 contacts (open first), and 100 activity entries. `limits` and `totals` identify truncation; frontend filters apply to those returned records. Except for intentionally redacted contact totals, counts reflect all permitted rows independently of the display bounds.

## Access management and exports

Only an owner receives a non-null `access` snapshot containing the global directory revision, up to 500 members, and the most recent 100 access events. `access.grant`, `access.change`, and `access.revoke` require that revision and a trimmed reason of 10–500 characters. Granting resolves one exact existing email, ignoring only case and surrounding spaces, to its confirmed active account; it neither invites users nor changes their credentials. Changing an inactive user's role is refused, but revoking it remains possible. No user may change their own access. The singleton lock serializes directory changes, stale revisions fail, and a database trigger protects the final owner from deletion or demotion. There is no implicit reviewer grant.

Successful access changes append an audit row with actor and target identities, historical email addresses, old/new roles, reason, and timestamp. Audit rows deliberately survive account deletion. Access and export audit tables have no client privileges, no mutation RPC, and triggers rejecting UPDATE, DELETE and TRUNCATE. A database superuser can ultimately disable triggers; the dashboard cannot.

`POST /api/admin/export` accepts `{resource, language}` and calls `public.admin_export({resource})`. Only admin and owner presets have `data.export`; every resource also checks its read scope. Resources are `overview`, `companies`, `products`, `contacts`, `activity`, and `tasks`. Exports query all permitted records up to 5,000 rows, independently of the smaller snapshot limits. Rows use the same safe fields and scoped activity; tasks always belong to the caller. Overview rows are `{name, value}` pairs of real aggregate counts. The RPC returns `{resource, rows, generatedAt, truncated, rowLimit}` and appends a successful-export audit entry only after authorization and validation. A truncated response is explicit rather than silently claiming all records were exported.

The HTTP layer whitelists CSV columns again, localizes headings, escapes quotes, neutralizes spreadsheet formulas, and returns private no-store download headers with row count and truncation status. Filters in the dashboard do not alter the server export scope: an export contains the permitted resource, subject to the advertised 5,000-row limit.

## Failure contract

Failures return `{error, errorCode}` with the same stable code in both fields: `LOGIN_REQUIRED` (401); `ADMIN_REQUIRED`, `MFA_REQUIRED`, `PERMISSION_REQUIRED`, or `SELF_ACCESS_CHANGE` (403); `INVALID` (400); `CONFLICT`, `LIMIT_REACHED`, `LAST_OWNER`, `EMAIL_UNCONFIRMED`, `USER_INACTIVE`, or `ALREADY_GRANTED` (409); `NOT_FOUND` or `USER_NOT_FOUND` (404); and `NOT_CONFIGURED` or `UNAVAILABLE` (503). Mutation and export requests require a trusted Origin and JSON body. Database internals are never returned to the browser. `NOT_CONFIGURED` means a required RPC migration is absent from the connected environment.

## Verification

Run `npm run test:admin` from the project root. `test-admin-postgres.mjs` applies the full migration history to in-memory PGlite and invokes the additional `test-admin-roles.mjs` suite; that helper is not a separate database runner. Fixtures reject external database configuration. Tests cover the role/permission matrix, SQL/frontend parity, contact/activity redaction, role/MFA/confirmation/active-account gates, direct-table and legacy-function denial, metadata forgery, public-field whitelists, counts, personal-task isolation, CRUD, reorder, input nulls and rollback, contact reopening, stale revisions, exact grants, self-change prevention, last-owner protection, immutable audit, immediate revocation, and 5,000-row export truncation. PGlite serializes its connection; this verifies conflict handling rather than hosted multi-connection scheduling. The database row locks provide serialization on PostgreSQL.

The HTTP runner executes the actual route with controlled Auth/RPC adapters and checks origin, malformed/oversized input, validation, safe failure mapping, and cache headers. Neither runner contacts a production service. Hosted Auth cookie renewal, real MFA enrollment, deployment, and production-role binding require separate hosted verification.

Implementation references checked against the current [Supabase function guidance](https://supabase.com/docs/guides/database/functions), [SSR client guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), and [changelog](https://supabase.com/changelog). Existing pinned `@supabase/ssr` integration is retained.
