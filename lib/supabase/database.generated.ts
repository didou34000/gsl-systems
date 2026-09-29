// Generated from the locally migrated PostgreSQL schema by scripts/test-postgres.mjs.
// Hosted schema parity is NOT confirmed.
export interface DatabaseRows {
  addresses: {
    id: string;
    organization_id: string;
    kind: string;
    line1: string;
    line2: string;
    city: string;
    region: string;
    postal_code: string;
    country_code: string;
    public_precision: string;
  };
  capabilities: {
    id: string;
    organization_id: string;
    site_id: string | null;
    process: string;
    materials: string[];
    equipment: string;
    description: string;
    capacity: number | string | null;
    capacity_unit: string | null;
    capacity_period: string | null;
    minimum_quantity: number | string | null;
    quantity_unit: string | null;
    retired_at: string | null;
  };
  contact_requests: {
    id: string;
    email: string;
    name: string;
    subject: string;
    body: string;
    language: string;
    created_at: string;
    resolved_at: string | null;
  };
  country_requirement_versions: {
    country_code: string;
    version: string;
    specification: unknown;
    researched_at: string;
  };
  declared_orders: {
    id: string;
    offer_id: string;
    buyer_organization_id: string;
    reference: string;
    note: string;
    declared_at: string;
  };
  evidence_documents: {
    id: string;
    organization_id: string;
    file_id: string;
    kind: string;
    reference: string;
    issuer: string;
    standard: string | null;
    issued_on: string | null;
    expires_on: string | null;
    scope_description: string;
    revision: number | string;
    created_at: string;
    updated_at: string;
  };
  evidence_scopes: {
    id: string;
    organization_id: string;
    evidence_id: string;
    site_id: string | null;
    product_id: string | null;
    product_revision: number | string | null;
    scope_kind: string;
  };
  files: {
    id: string;
    organization_id: string;
    uploaded_by: string;
    object_path: string;
    original_name: string;
    mime_type: string;
    size_bytes: number | string;
    purpose: string;
    media_origin: string | null;
    caption: string;
    rights_attested_at: string | null;
    scan_status: string;
    created_at: string;
    upload_state: string;
  };
  media_links: {
    id: string;
    organization_id: string;
    file_id: string;
    site_id: string | null;
    product_id: string | null;
    position: number | string;
    alt_en: string;
    alt_fr: string;
  };
  memberships: {
    organization_id: string;
    user_id: string;
    role: string;
    active: boolean;
    created_at: string;
  };
  messages: {
    id: string;
    thread_id: string;
    sender_organization_id: string;
    sender_user_id: string;
    body: string;
    created_at: string;
  };
  notification_outbox: {
    id: string;
    event_key: string;
    recipient_id: string | null;
    template: string;
    resource_id: string;
    language: string;
    state: string;
    attempts: number | string;
    available_at: string;
    created_at: string;
    lease_id: string | null;
    lease_until: string | null;
    provider_reference: string | null;
    failure_code: string | null;
    template_version: string;
    recipient_email: string | null;
  };
  offer_selections: {
    rfq_id: string;
    offer_id: string;
    selected_by: string;
    selected_at: string;
  };
  offers: {
    id: string;
    thread_id: string;
    supplier_organization_id: string;
    version: number | string;
    amount_minor: number | string;
    currency: string;
    quantity: number | string;
    unit: string;
    terms: string;
    lead_time_assumptions: string;
    valid_until: string;
    created_at: string;
    lines: unknown;
    exclusions: string;
    transport: string;
    currency_decimals: number | string;
    fixed_fee_minor: number | string;
  };
  onboarding_uploads: {
    id: string;
    owner_id: string;
    object_path: string;
    kind: string;
    name: string;
    size: number | string;
    caption: string;
    state: string;
    scan_state: string;
    created_at: string;
    updated_at: string;
    rights_attested_at: string | null;
  };
  operator_actions: {
    id: string;
    actor_id: string;
    action: string;
    resource_id: string;
    created_at: string;
  };
  organization_contacts: {
    id: string;
    organization_id: string;
    name: string;
    job_title: string;
    email: string | null;
    phone: string | null;
    languages: string[];
    publication_consent_at: string | null;
    public: boolean;
  };
  organization_identifiers: {
    id: string;
    organization_id: string;
    identifier_type: string;
    value: string;
    authority: string;
    country_code: string;
    requirement_version: string | null;
  };
  organization_invitations: {
    id: string;
    organization_id: string;
    email: string;
    role: string;
    invited_by: string;
    state: string;
    expires_at: string;
    created_at: string;
    accepted_at: string | null;
  };
  organizations: {
    id: string;
    created_by: string;
    legal_name: string;
    trading_name: string;
    country_code: string;
    entity_kind: string;
    legal_form: string;
    description: string;
    website: string | null;
    buyer: boolean;
    supplier: boolean;
    revision: number | string;
    created_at: string;
    updated_at: string;
  };
  privacy_requests: {
    id: string;
    user_id: string;
    kind: string;
    created_at: string;
    resolved_at: string | null;
    resolution: string | null;
    reviewer_id: string | null;
  };
  product_compliance_records: {
    id: string;
    organization_id: string;
    product_id: string;
    product_revision: number | string;
    intended_use: string;
    destination_markets: string[];
    ce_applicability: string;
    applicability_reason: string;
    legislation: string[];
    standards: string[];
    assessment_procedure: string;
    notified_body_number: string | null;
  };
  production_sites: {
    id: string;
    organization_id: string;
    address_id: string;
    name: string;
    relationship: string;
    description: string;
    workforce_range: string | null;
    area_square_meters: number | string | null;
    retired_at: string | null;
  };
  products: {
    id: string;
    organization_id: string;
    site_id: string | null;
    name: string;
    model_reference: string;
    category: string;
    description: string;
    made_to_order: boolean;
    specifications: unknown;
    revision: number | string;
    created_at: string;
    updated_at: string;
  };
  profiles: {
    user_id: string;
    display_name: string;
    language: string;
    created_at: string;
  };
  published_media: {
    id: string;
    organization_id: string;
    kind: string;
    caption: string;
    origin: string;
    published_at: string;
    withdrawn_at: string | null;
  };
  published_products: {
    product_id: string;
    organization_id: string;
    source_revision: number | string;
    name: string;
    category: string;
    description: string;
    published_at: string;
    withdrawn_at: string | null;
    specifications: unknown;
  };
  published_supplier_profiles: {
    organization_id: string;
    source_revision: number | string;
    display_name: string;
    country_code: string;
    city: string;
    description: string;
    published_at: string;
    withdrawn_at: string | null;
    processes: string[];
    materials: string[];
    manufacturing_countries: string[];
    public_details: unknown;
  };
  review_assignments: {
    owner_id: string;
    reviewer_id: string;
    submission_revision: number | string;
    identity_checked: boolean;
    scope_checked: boolean;
    privacy_checked: boolean;
    internal_note: string;
    updated_at: string;
  };
  rfq_files: {
    organization_id: string;
    rfq_id: string;
    file_id: string;
    recipient_organization_id: string | null;
  };
  rfq_items: {
    id: string;
    organization_id: string;
    rfq_id: string;
    description: string;
    selected_product_id: string | null;
    quantity: number | string;
    unit: string;
    specifications: unknown;
  };
  rfq_recipients: {
    rfq_id: string;
    supplier_organization_id: string;
    sent_at: string;
  };
  rfqs: {
    id: string;
    organization_id: string;
    created_by: string;
    title: string;
    details: string;
    mode: string;
    assistance_shared_at: string | null;
    state: string;
    destination_country: string | null;
    deadline: string | null;
    revision: number | string;
    created_at: string;
    updated_at: string;
    sent_snapshot: unknown | null;
    draft_items: unknown;
  };
  saved_selections: {
    owner_id: string;
    product_id: string;
    created_at: string;
  };
  supplier_application_events: {
    id: string;
    owner_id: string;
    status: string;
    created_at: string;
  };
  supplier_application_files: {
    id: string;
    owner_id: string;
    object_path: string;
    kind: string;
    name: string;
    size: number | string;
    caption: string;
    created_at: string;
  };
  supplier_applications: {
    owner_id: string;
    payload: unknown;
    status: string;
    revision: number | string;
    reviewer_notes: string;
    created_at: string;
    updated_at: string;
    organization_id: string | null;
  };
  supplier_review_decisions: {
    id: string;
    owner_id: string;
    revision: number | string;
    reviewer_id: string;
    decision: string;
    feedback: string;
    created_at: string;
  };
  supplier_submission_versions: {
    owner_id: string;
    revision: number | string;
    payload: unknown;
    file_manifest: unknown;
    submitted_at: string;
  };
  threads: {
    id: string;
    rfq_id: string;
    supplier_organization_id: string;
    created_at: string;
  };
  verification_events: {
    id: string;
    organization_id: string;
    product_id: string | null;
    evidence_id: string | null;
    reviewed_revision: number | string;
    reviewer_id: string;
    decision: string;
    method: string;
    source_url: string | null;
    note: string;
    checked_at: string;
    next_review_at: string | null;
  };
  workflow_commands: {
    actor_id: string;
    command_id: string;
    action: string;
    result: unknown;
    created_at: string;
  };
  workflow_events: {
    id: string;
    organization_id: string;
    actor_id: string;
    action: string;
    resource_id: string;
    created_at: string;
  };
  workspace_drafts: {
    id: string;
    owner_id: string;
    kind: string;
    title: string;
    payload: unknown;
    revision: number | string;
    created_at: string;
    updated_at: string;
  };
}
