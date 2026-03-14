# Datrix

Datrix is a modern data control platform for teams that need one place to manage:

- PostgreSQL and MySQL connections
- SQL querying and schema exploration
- S3-compatible object storage
- Team access and organization workflows
- Operational and query logs

## Tech Stack

- Next.js (App Router)
- React + TypeScript
- Supabase Auth (SSR helpers)
- PostgreSQL and MySQL drivers
- AWS SDK for S3-compatible storage

## Features

- Multi-connection data workspace
- SQL query execution through API routes
- Schema introspection endpoints
- Storage bucket and object operations
- Organization, team, and invitation management
- Feature flags for modular enable/disable

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create local environment file:

```bash
cp .env .env.local
```

3. Update values in .env.local for your environment.

4. Start development server:

```bash
npm run dev
```

5. Open http://localhost:3000

## Available Scripts

- npm run dev: Start local development server
- npm run build: Build production bundle
- npm run start: Run production server
- npm run lint: Run ESLint checks

## Documentation

- [Setup Guide](SETUP.md)
- [Architecture](ARCHITECTURE.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [Project Plan](plan.md)
- [MongoDB Feature Proposal](docs/FEATURE_MONGODB_SUPPORT.md)
- [New Organization Flow Proposal](docs/FEATURE_NEW_ORGANIZATION_FLOW.md)
- [Roadmap](docs/ROADMAP.md)

## Project Structure

High-level directories:

- app: UI routes and API endpoints
- components: Shared UI and feature components
- lib: Auth, crypto, utilities, and clients
- config: App-level configuration
- theme: Theme primitives
- types: Shared TypeScript types

## Security Note

Do not commit real secrets. Use local-only env files and rotate any credential that has been shared publicly.

## License

This project is licensed under the terms in [LICENSE](LICENSE).
