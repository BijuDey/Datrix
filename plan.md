# Datrix — Project Plan

## Overview

**Datrix** is an open-source, modern developer platform designed to manage:

- SQL Databases (MySQL, PostgreSQL)
- S3-compatible Object Storage
- Team database access
- Query execution
- Database activity logs

All from a **single fast, clean, and modern UI**.

**Goal:** Build a powerful, developer-friendly data control panel that is faster, more intuitive, and easier to use than traditional database administration tools.

---

## Tech Stack

### Frontend

- **Framework:** Next.js, React
- **Language:** TypeScript
- **Styling:** TailwindCSS

### Backend

- **API:** Next.js API Routes

### Auth & Organizations

- **Authentication:** Supabase Auth

### Storage & Databases

- **Object Storage:** S3-compatible (AWS S3, MinIO, R2)
- **Relational Databases:** PostgreSQL, MySQL

---

## Core Features

### Database Manager

- Connect multiple databases
- Encrypted credentials
- Connection testing

### SQL Editor

- Run queries with syntax highlighting
- Query history
- Multi-tab editor

### Table Viewer

- Pagination, filtering, and sorting
- Inline editing

### Schema Explorer

- Tables, views, indexes, and functions

### S3 Storage Browser

- Browse buckets
- Upload, download, and delete files
- Preview objects

### Organizations & Teams

- Team members and roles (Owner, Admin, Editor, Viewer)
- Shared database connections

### Database Activity Logs

Track actions with detailed logs specifying user, database, query, action, timestamp, and IP address.

- Executed queries
- Updated or deleted rows
- Schema changes

---

## UI/UX Design

A modern, fast, responsive, and highly usable developer dashboard.

**Layout:**

- **Top Bar:** Quick actions and profile management
- **Sidebar:** Connections, buckets, and navigation
- **Main Workspace (Tabs):** SQL Editor, Table Viewer, Storage Browser, Logs

**Design Principles:**

- Clean and minimal
- Highly responsive
- Performance-focused (fast load times)

---

## Open Source & Configurability

Datrix is built to be easily self-hosted and fully configurable.

### Environment Configuration (`.env`)

```env
APP_NAME="Datrix"
SUPABASE_URL="..."
SUPABASE_ANON_KEY="..."
ENABLE_S3="true"
ENABLE_POSTGRES="true"
ENABLE_MYSQL="true"
```

### Theme System

Centralized theme file (`/theme/theme.ts`) allowing customization of:

- Colors (Light/Dark mode support)
- Fonts and spacing
- Border radius

### Branding Configuration

Easily fork and rename the app via `/config/app.ts`:

```typescript
export const config = {
  APP_NAME: "Datrix",
  APP_DESCRIPTION: "Modern Data Control Platform",
  LOGO: "/logo.svg",
  THEME: "default",
};
```

---

## Architecture & Codebase

### Folder Structure

```text
├── app/          # Next.js App Router
├── api/          # Backend API routes
├── components/   # Reusable UI components
├── config/       # App and branding configuration
├── connectors/   # Database & Storage integrations (postgres, mysql, s3)
├── features/     # Feature-specific modules
├── lib/          # Helper functions and utilities
├── theme/        # Theme and styling system
└── types/        # TypeScript type definitions
```

### Code Principles

- **Clean Architecture:** Readable, maintainable, and scalable.
- **Modular Design:** Small, focused modules.
- **High Performance:** Optimized queries and rendering.
- **Contributor Friendly:** Easy for open-source developers to extend.

---

## Summary

Create a **modern open-source data control platform** that is powerful, fast, beautiful, developer-friendly, and easy to extend.

## NOTE- PLease dont use the generic AIish purple blue gradient colors. Use a more professional and modern color palette. and Make unique and modern UI/UX. and USE Unique font nice combo
