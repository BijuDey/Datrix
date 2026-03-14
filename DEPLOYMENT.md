# Deployment Guide

This guide outlines production deployment for Datrix.

## Deployment Targets

- Vercel (recommended for Next.js)
- Any Node.js host that supports Next.js server mode

## Prerequisites

- Node.js runtime compatible with Next.js 16
- Production Supabase project
- Secure secrets management for env vars
- Network access to database and storage endpoints

## Required Environment Variables

- APP_NAME
- APP_ENV
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- ENCRYPTION_SECRET

Feature flags (optional but recommended):

- ENABLE_POSTGRES
- ENABLE_MYSQL
- ENABLE_S3
- ENABLE_TEAMS
- ENABLE_LOGS

## Build and Run

```bash
npm ci
npm run build
npm run start
```

## Vercel Deployment

1. Import repository into Vercel.
2. Set environment variables for Production/Preview.
3. Trigger deployment.
4. Validate key workflows after deploy:
   - Login/signup
   - Database connection tests
   - Query execution
   - Storage listing/upload

## Self-hosted Deployment

1. Build artifact with npm run build.
2. Run with process manager (PM2/systemd/container).
3. Configure reverse proxy and TLS.
4. Restrict outbound network egress to trusted DB/storage hosts.

## Security Hardening

- Never expose SUPABASE_SERVICE_ROLE_KEY to browser contexts.
- Rotate ENCRYPTION_SECRET only with a migration plan for encrypted data.
- Apply strict CORS and CSP policies as needed.
- Enable audit logging and monitoring.

## Post-deployment Smoke Checklist

- [ ] App boots without runtime errors
- [ ] Auth works
- [ ] Protected routes redirect correctly
- [ ] Connection test API passes for enabled engines
- [ ] Query and schema endpoints return valid responses
- [ ] Storage browser operations succeed
