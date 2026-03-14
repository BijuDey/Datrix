# Architecture

This document summarizes the current Datrix architecture and module responsibilities.

## System Overview

Datrix uses a Next.js App Router architecture with server-side API routes for data operations.

Core responsibilities:

- UI and navigation in app routes
- Data connectors and helper logic in shared libraries
- Auth and org workflows via Supabase
- Database and storage operations exposed through API endpoints

## Directory Roles

- app: pages, layouts, API route handlers
- components: UI building blocks and feature widgets
- config: app-level branding/config values
- lib: shared helpers, auth context, cryptography, Supabase client helpers
- theme: design tokens and theme setup
- types: shared domain typings

## API Surface (Current)

The app folder exposes API endpoints for:

- Authentication signup
- Connection CRUD and health checks
- SQL query execution
- Schema introspection
- Storage operations (S3)
- Logs retrieval
- Team membership and invitations
- Organization invitation flows

## Authentication and Authorization

- Supabase handles identity.
- Middleware gates access to protected resources.
- Team/org routes enforce role-aware collaboration behavior.

## Data Access Model

Relational engines:

- PostgreSQL via pg
- MySQL via mysql2

Object storage:

- S3-compatible APIs via AWS SDK

Credentials are encrypted before storage using the configured encryption secret.

## Feature Flag Model

Feature flags are environment-driven and used to gate modules at runtime:

- ENABLE_POSTGRES
- ENABLE_MYSQL
- ENABLE_S3
- ENABLE_TEAMS
- ENABLE_LOGS

## Runtime Flow (High-level)

1. User authenticates via Supabase.
2. User navigates dashboard pages.
3. UI calls API routes for data actions.
4. API routes validate auth, load/decrypt connection credentials, and execute operations.
5. Responses return normalized payloads for rendering.

## Scaling Considerations

- Add queueing for heavy data exports.
- Add per-organization rate limits.
- Add structured observability and tracing.
- Add adapter interface for non-SQL connectors (MongoDB proposal in docs/FEATURE_MONGODB_SUPPORT.md).
