# Supplier workspace

Entry: /espace-fournisseur, from header, mobile navigation and account. Existing /devenir-fournisseur redirects here. EN and FR interface. Signup and code confirmation preserve the supplier destination.

Six sections: identity and country registry; production sites and capabilities; product/service offers; images and evidence; commercial/export details; private profile preview and submission.

Country templates: TR, GE, MA, TN, FR. The initial selector is limited to 13 countries: FR, DE, IT, ES, PL, RO, GB, TR, GE, MA, TN, US, CN. Other ISO codes remain readable in historical drafts, but registration submission requires a currently supported country. Countries without a researched template explicitly require a country-specific manual review. Required registry fields are GSL intake policy, not a statement of universal law. Existing templates are reused without assuming that EU registration confers product conformity. Sole traders do not enter personal identity numbers.

Product conformity is recorded per exact reference. CE applicability can remain pending assessment; it never produces a compliance badge. A declared applicable CE product needs legislation and a linked technical declaration. A non-applicable declaration needs explanation. Management certificates, product certificates and test reports are separate, with issuer, identifier, covered scope, product linkage, dates, optional notified-body number and evidence. Expired certificates cannot support a submission. No automatic NANDO certification claim.

## Persistence and review

A private pre-publication application is associated with the authenticated owner, one per account. This is separate from published organizations to avoid publishing incomplete profiles. It is not yet a multi-user company workspace.

- supplier_applications: JSON profile, revision, status, reviewer_notes.
- supplier_application_files: owner metadata and private object references.
- supplier_application_events: database-maintained status timeline.
- gsl-onboarding: private bucket, PDF/JPEG/PNG/WebP, maximum 3 MiB/file. Application intake limits 40 files. No SVG/HTML uploads. Signature inspection is not antivirus scanning. Documents are served as downloads; photo URLs expire after ten minutes and refresh on page reload/save.

Drafts are explicitly saved, not silently auto-saved. Navigation away from unsaved changes prompts the user. Concurrent saves use a revision check. Submitted content is frozen until the supplier withdraws it to draft; status changes are recorded. Documents and photos remain private even in the profile preview. Public contact/address display preferences do not publish anything by themselves.

Review is operated in the Supabase dashboard by authorised project administrators. In Table Editor, inspect supplier_applications with status submitted, the associated supplier_application_files and private Storage folder. Add reviewer_notes and change status to in_review, changes_requested or reviewed. Suppliers see feedback on reload. No automatic notification email, SLA, external certification, public publication or reviewer web console is implied. A reviewed application still needs a separate publication workflow into the existing organization/product foundation.

Users cannot grant themselves reviewed status, write reviewer notes or forge timeline events. Row isolation applies to all three tables and storage. No service-role credential is used by the web application. Review trigger is private and non-callable by clients. Cross-origin writes are rejected. POST responses are no-store.

## Verification

- Production build and TypeScript.
- scripts/test-supplier-profile.mjs: completeness, country changes, declaration requirements, certificate scope/expiry, invalid URLs/countries/volumes.
- scripts/test-country-requirements.mjs: country isolation, sole-trader privacy, manual fallback.
- Transactional database tests with rollback: cross-user isolation, forbidden self-approval/reviewer notes, frozen submissions, owner withdrawal and private events/files.
- Temporary synthetic account integration: sign in, save, stale-revision conflict, incomplete submission rejection, PDF/logo upload, signed download, submit, locked edits, reopen, persisted payload, history, remove test files and logout. Test records removed after verification.

## Sources consulted

- https://help.europages.com/en/supplier/company-profile-basic-information
- https://help.europages.com/en/supplier/add-products-and-services-via-manual-upload
- https://europa.eu/youreurope/business/product-rules-compliance/general-product-compliance/ce-marking/index_en.htm
- https://www.ticaret.gov.tr/ic-ticaret/ticaret-sicili/merkezi-sicil-kayit-sistemi-mersis
- https://napr.gov.ge/EN/page/consultation-cards/business-registration-consultation
- https://entreprendre.service-public.gouv.fr/vosdroits/R19859
- Country-specific source URLs are also stored in lib/onboarding/country-requirements.ts.

## September 27 refinements

The company review section now explains identity, professional presence/contact, B2B relevance/duplicates and supporting evidence. A website or verifiable public professional profile is required at submission. These are manual GSL review criteria, not claims that automatic checks have occurred. Inspired by https://help.europages.com/en/supplier/why-has-my-registration-been-declined .

Flags are local SVG assets from flag-icons v7.3.2 (MIT), with the original license at public/flags/LICENSE.txt. No flag emojis or external asset calls. The grouped country selector supports keyboard navigation, Escape dismissal and selection state.
