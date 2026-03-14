# Feature Proposal: MongoDB Support

## Summary

Add first-class MongoDB support to Datrix so users can manage document databases alongside existing SQL and S3 resources.

## Motivation

Many teams run mixed data stacks. Today Datrix supports PostgreSQL, MySQL, and S3-compatible storage. MongoDB support enables:

- Unified operational workflows across SQL and NoSQL
- Centralized team access management
- Shared observability and logs across connection types

## Goals

- Create and manage MongoDB connections.
- Verify connection health and metadata.
- Browse databases, collections, and documents.
- Run filtered find operations with pagination.
- Support create/update/delete document operations (role-based).
- Integrate MongoDB actions into existing logs pipeline.

## Non-goals (Initial Phase)

- Full aggregation pipeline editor with visual builder
- Advanced index management UI
- Backup/restore orchestration

## Proposed Architecture

## 1. Adapter Layer

Introduce a connector abstraction in lib/connector layer:

- EngineAdapter interface with common operations:
  - testConnection
  - listNamespaces
  - listSchema
  - queryLikeOperation

MongoDB adapter implementation maps these operations to MongoDB semantics.

## 2. API Endpoints

Add new API routes under app/api/connections/[id]/mongo:

- health/route.ts
- explorer/route.ts
- query/route.ts
- schema/route.ts

Behavior should mirror existing SQL route conventions where possible.

## 3. Data Model Changes

Extend connection entity with:

- engine value: mongodb
- encrypted connection payload fields:
  - uri
  - database (default)
  - options (tls, authSource, replicaSet)

## 4. Feature Flag

Add:

- ENABLE_MONGODB=true|false

## API/UX Behavior

## Connection Form

Fields:

- Display name
- MongoDB URI (mongodb:// or mongodb+srv://)
- Default database
- Optional TLS/Auth options

Validation:

- Reject unsupported URI protocols
- Enforce secret handling and encrypted storage

## Explorer

- List databases and collections
- Show document count estimates
- Paginate documents with limit/offset-like cursor controls

## Query Model

Support JSON-based operations:

- find
- findOne
- insertOne
- updateOne
- deleteOne

Guardrails:

- max document limit per request
- timeout controls
- payload size limits

## Security and Roles

- Reuse existing auth middleware and team role checks.
- Restrict write operations by role (Owner/Admin/Editor only).
- Redact sensitive credential fragments in logs.

## Observability

Log MongoDB operations into existing logs stream with fields:

- user_id
- org_id
- connection_id
- engine=mongodb
- action
- collection
- duration_ms
- status

## Implementation Plan

### Phase 1: Foundation

- Add mongodb dependency and types
- Implement MongoDB connector adapter
- Add connection health endpoint
- Add feature flag wiring

### Phase 2: Read Workflows

- Explorer endpoint and collection listing
- Query endpoint for find/findOne
- Basic UI integration in dashboard

### Phase 3: Write Workflows

- insert/update/delete operations
- Role-gated write controls
- Additional audit logs

### Phase 4: Hardening

- Performance tuning
- Error normalization
- Integration and end-to-end tests
- Documentation updates

## Testing Strategy

- Unit tests for adapter behavior and query validation
- Integration tests against a local MongoDB container
- Permission tests for role-based write restrictions
- API contract tests for error shape consistency

## Risks

- Query complexity and unbounded payloads
- Inconsistent behavior across MongoDB versions
- Cursor handling and pagination semantics

Mitigations:

- Strict operation allowlist
- Timeouts and row/document limits
- Defensive validation and normalized errors

## Success Metrics

- MongoDB connection success rate
- Query latency p95 for read operations
- Error rate by operation type
- Adoption: number of MongoDB connections created

## Open Questions

- Should aggregation be included in v1 or delayed?
- Should per-collection permissions be supported initially?
- Should we support direct Atlas project integrations later?
