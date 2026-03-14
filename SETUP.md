# Setup Guide

This guide helps you run Datrix locally for development.

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase project (for authentication and org workflows)
- Optional test targets:
  - PostgreSQL instance
  - MySQL instance
  - S3-compatible storage (AWS S3, MinIO, or Cloudflare R2)

## 1. Install Dependencies

```bash
npm install
```

## 2. Configure Environment

Copy environment file:

```bash
cp .env .env.local
```

Update values in .env.local:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- ENCRYPTION_SECRET

Feature flags:

- ENABLE_POSTGRES=true
- ENABLE_MYSQL=true
- ENABLE_S3=true
- ENABLE_TEAMS=true
- ENABLE_LOGS=true

## 3. Start Development Server

```bash
npm run dev
```

App URL: http://localhost:3000

## 4. Build Verification

```bash
npm run lint
npm run build
```

## 5. Authentication Notes

Supabase auth is required for protected routes and organization/team actions.

- Ensure your Supabase project is active.
- Confirm anon and service role keys are valid.
- Keep service role keys server-side only.

## 6. Common Issues

### Missing env values

Symptom: Auth errors or API route failures.

Fix: Verify .env.local values and restart the dev server.

### Database connection test fails

Symptom: Connection route returns error.

Fix:

- Check host, port, and credentials.
- Verify outbound network access from your machine.
- Ensure SSL configuration matches your target database.

### S3 operations fail

Symptom: Bucket listing/upload errors.

Fix:

- Confirm access key, secret, region, and endpoint.
- Confirm bucket-level permissions.
- For MinIO/R2, verify custom endpoint style.

## 7. Recommended Local Workflow

1. Start with lint clean state.
2. Run dev server.
3. Test API routes through UI flow.
4. Run build before creating PR.
