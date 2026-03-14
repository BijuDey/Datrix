# Feature Proposal: New Organization Creation Flow

## Summary

Add a complete in-app flow for users to create a new organization and become its initial owner.

## Problem

Organization management exists in parts of the current platform, but an explicit and guided "create new organization" experience is missing or incomplete.

## Goals

- Allow authenticated users to create an organization from the dashboard.
- Assign creator role as Owner automatically.
- Initialize default organization settings and metadata.
- Redirect users into the newly created organization context.
- Make the flow safe, validated, and auditable.

## Non-goals (Initial Version)

- Enterprise billing and subscription provisioning
- Advanced org templates and presets
- Domain verification and SSO setup wizard

## User Experience

## Entry Points

- Organizations page: primary "Create Organization" action
- Empty state when user has no organization
- Optional quick action in top navigation

## Form Fields

- Organization name (required)
- Slug (auto-generated, editable, unique)
- Optional description

Validation rules:

- Name: min 2 chars, max 80 chars
- Slug: lowercase, kebab-case, unique
- Reject reserved slugs (admin, api, root, system)

## Post-create Behavior

1. Persist organization.
2. Create creator membership as Owner.
3. Set active organization in session/context.
4. Navigate to organization dashboard.
5. Show success toast and optional invite teammates prompt.

## API Design

Add or complete endpoint:

- POST app/api/organizations/route.ts

Request body:

```json
{
  "name": "Acme Data Team",
  "slug": "acme-data-team",
  "description": "Optional description"
}
```

Response:

```json
{
  "organization": {
    "id": "org_xxx",
    "name": "Acme Data Team",
    "slug": "acme-data-team"
  },
  "membership": {
    "role": "owner"
  }
}
```

## Data Model

Required entities and fields:

- organizations
  - id
  - name
  - slug (unique)
  - description (nullable)
  - created_by
  - created_at

- organization_members
  - organization_id
  - user_id
  - role (owner/admin/editor/viewer)
  - created_at

## Authorization Rules

- Must be authenticated to create organization.
- One user can create multiple organizations (configurable policy).
- Only Owners can update core organization settings after creation.

## Security Considerations

- Server-side slug uniqueness check with conflict-safe write.
- Rate limit organization creation per user.
- Sanitize text fields and enforce length limits.
- Log create events to audit trail with actor and org id.

## Observability

Track events:

- organization_create_started
- organization_create_succeeded
- organization_create_failed

Recommended metadata:

- user_id
- org_id (on success)
- latency_ms
- error_code (on failure)

## Implementation Plan

### Phase 1: Backend

- Add/create POST endpoint for organization creation.
- Add validation schema and reserved slug list.
- Add transaction for org + owner membership creation.

### Phase 2: Frontend

- Add create organization modal/page.
- Add optimistic form UX and error states.
- Redirect into active organization context on success.

### Phase 3: Hardening

- Add server rate limiting.
- Add audit log integration.
- Add analytics/telemetry events.

## Testing Strategy

- Unit tests for validation and slug generation.
- Integration tests for create flow and role assignment.
- Concurrency test for slug collisions.
- UI tests for success and error states.

## Acceptance Criteria

- Authenticated user can create an organization successfully.
- Creator becomes Owner automatically.
- Duplicate slug returns 409 conflict with clear error.
- Newly created org is active immediately in UI context.
- Event is logged in audit trail.

## Open Questions

- Should there be a hard cap on organizations per user?
- Should slug be immutable after creation?
- Should we auto-open invite dialog after creation?
