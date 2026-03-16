-- ============================================================
-- Datrix — Supabase SQL Schema
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/embkymkmbsbegdcjzwpz/sql
-- ============================================================

-- ──────────────────────────────────────────────────
-- 1. Profiles (extends auth.users)
-- ──────────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  system_role text default 'user' check (system_role in ('user', 'superadmin')),
  created_at timestamptz default now()
);

-- ──────────────────────────────────────────────────
-- 2. Organizations
-- ──────────────────────────────────────────────────
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ──────────────────────────────────────────────────
-- 3. Org membership
-- Roles: admin (org creator) | editor (can query+edit) | member (query only)
-- ──────────────────────────────────────────────────
create table if not exists org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','editor','member')),
  invited_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(org_id, user_id)
);

-- ──────────────────────────────────────────────────
-- 3.5. Organization Invitations
-- ──────────────────────────────────────────────────
create table if not exists organization_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','editor','member')),
  invited_by uuid references profiles(id),
  status text default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default now(),
  unique(org_id, email)
);

-- ──────────────────────────────────────────────────
-- 4. Database connections
-- ──────────────────────────────────────────────────
create table if not exists database_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  type text not null check (type in ('postgres','mysql','s3')),
  encrypted_config text not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ──────────────────────────────────────────────────
-- 5. Per-user DB access grants
-- ──────────────────────────────────────────────────
create table if not exists db_access_grants (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references database_connections(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  granted_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(connection_id, user_id)
);

-- ──────────────────────────────────────────────────
-- 6. Activity logs
-- ──────────────────────────────────────────────────
create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references profiles(id),
  user_email text,
  action text not null,
  resource text,
  query text,
  status text default 'success' check (status in ('success','error')),
  duration_ms integer,
  ip_address text,
  created_at timestamptz default now()
);

-- ──────────────────────────────────────────────────
-- 7. Row Level Security
-- ──────────────────────────────────────────────────
alter table profiles enable row level security;
alter table organizations enable row level security;
alter table org_members enable row level security;
alter table database_connections enable row level security;
alter table db_access_grants enable row level security;
alter table activity_logs enable row level security;
alter table organization_invitations enable row level security;

-- ──────────────────────────────────────────────────
-- 8. Trigger: auto-create profile on signup
-- ──────────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ──────────────────────────────────────────────────
-- ──────────────────────────────────────────────────
-- 8.5. Helper Functions for RLS (Bypasses infinite recursion)
-- ──────────────────────────────────────────────────
create or replace function get_user_org_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select org_id from org_members where user_id = auth.uid();
$$;

create or replace function is_org_admin(check_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(
    select 1 from org_members 
    where org_id = check_org_id and user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function is_org_editor(check_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(
    select 1 from org_members 
    where org_id = check_org_id and user_id = auth.uid() and role in ('admin', 'editor')
  );
$$;

-- ──────────────────────────────────────────────────
-- 9. RLS Policies
-- ──────────────────────────────────────────────────

-- Profiles
drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

drop policy if exists "Service role can insert profiles" on profiles;
create policy "Service role can insert profiles" on profiles
  for insert with check (true);

-- Organizations
drop policy if exists "Members can view their org" on organizations;
create policy "Members can view their org" on organizations
  for select using (
    id in (select get_user_org_ids())
  );

drop policy if exists "Admins can update org" on organizations;
create policy "Admins can update org" on organizations
  for update using (
    is_org_admin(id)
  );

drop policy if exists "Anyone can insert org" on organizations;
create policy "Anyone can insert org" on organizations
  for insert with check (true);

-- Org members
drop policy if exists "Members can view org members" on org_members;
create policy "Members can view org members" on org_members
  for select using (
    org_id in (select get_user_org_ids())
  );

drop policy if exists "Admins can insert members" on org_members;
create policy "Admins can insert members" on org_members
  for insert with check (true);

drop policy if exists "Admins can update member roles" on org_members;
create policy "Admins can update member roles" on org_members
  for update using (
    is_org_admin(org_id)
  );

drop policy if exists "Admins can remove members" on org_members;
create policy "Admins can remove members" on org_members
  for delete using (
    is_org_admin(org_id)
  );

-- DB connections
drop policy if exists "View connections" on database_connections;
create policy "View connections" on database_connections
  for select using (
    org_id in (select get_user_org_ids())
  );

drop policy if exists "Admins can insert connections" on database_connections;
create policy "Admins can insert connections" on database_connections
  for insert with check (
    is_org_editor(org_id)
  );

drop policy if exists "Admins can delete connections" on database_connections;
create policy "Admins can delete connections" on database_connections
  for delete using (
    is_org_admin(org_id)
  );

-- DB access grants
drop policy if exists "View grants" on db_access_grants;
create policy "View grants" on db_access_grants
  for select using (
    user_id = auth.uid()
    or is_org_admin((select org_id from database_connections where id = connection_id))
  );

drop policy if exists "Admins can manage grants" on db_access_grants;
create policy "Admins can manage grants" on db_access_grants
  for all using (
    is_org_admin((select org_id from database_connections where id = connection_id))
  );

-- Activity logs
drop policy if exists "Members view org logs" on activity_logs;
create policy "Members view org logs" on activity_logs
  for select using (
    org_id in (select get_user_org_ids())
  );

drop policy if exists "Anyone can insert logs" on activity_logs;
create policy "Anyone can insert logs" on activity_logs
  for insert with check (true);

-- Organization invitations
drop policy if exists "Users view their own invitations by email" on organization_invitations;
create policy "Users view their own invitations by email" on organization_invitations
  for select using (email = auth.jwt() ->> 'email');

drop policy if exists "Admins view org invitations" on organization_invitations;
create policy "Admins view org invitations" on organization_invitations
  for all using (is_org_admin(org_id));

-- ──────────────────────────────────────────────────
-- 10. API Studio: Collections, Requests, Environments, Imports, Revisions
-- ──────────────────────────────────────────────────
alter table organizations
  add column if not exists description text;

create table if not exists api_collections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  description text,
  visibility text not null default 'org' check (visibility in ('org', 'private')),
  is_imported boolean default false,
  source text,
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists api_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  collection_id uuid references api_collections(id) on delete set null,
  name text not null,
  method text not null default 'GET' check (method in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS')),
  url text not null,
  headers jsonb default '{}'::jsonb,
  query_params jsonb default '{}'::jsonb,
  body_type text default 'none',
  body jsonb,
  pre_request_script text,
  tests_script text,
  last_run_at timestamptz,
  last_response_status integer,
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists api_environments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  variables jsonb not null default '{}'::jsonb,
  is_shared boolean default true,
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, name)
);

create table if not exists api_request_revisions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references api_requests(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  snapshot jsonb not null,
  source text default 'autosave' check (source in ('autosave', 'manual', 'import')),
  saved_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists api_import_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  collection_id uuid references api_collections(id) on delete set null,
  source text not null default 'postman' check (source in ('postman')),
  imported_by uuid references profiles(id),
  status text default 'success' check (status in ('success', 'failed')),
  imported_count integer default 0,
  raw_meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_api_collections_org on api_collections(org_id);
create index if not exists idx_api_requests_org_collection on api_requests(org_id, collection_id);
create index if not exists idx_api_environments_org on api_environments(org_id);
create index if not exists idx_api_request_revisions_request on api_request_revisions(request_id);

-- ──────────────────────────────────────────────────
-- 11. White-label support tables (additive, optional use)
-- ──────────────────────────────────────────────────
create table if not exists whitelabel_brands (
  id uuid primary key default gen_random_uuid(),
  org_id uuid unique references organizations(id) on delete cascade,
  app_name text,
  app_tagline text,
  logo_url text,
  favicon_url text,
  support_email text,
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists whitelabel_themes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid unique references organizations(id) on delete cascade,
  theme_mode text default 'dark' check (theme_mode in ('light', 'dark', 'system')),
  primary_color text,
  accent_color text,
  surface_color text,
  text_color text,
  font_heading text,
  font_body text,
  custom_css text,
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists whitelabel_domains (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  domain text not null unique,
  status text default 'pending' check (status in ('pending', 'verified', 'failed')),
  verification_token text,
  verified_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ──────────────────────────────────────────────────
-- 12. Shared trigger for updated_at maintenance
-- ──────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_api_collections_updated_at on api_collections;
create trigger trg_api_collections_updated_at
before update on api_collections
for each row execute procedure set_updated_at();

drop trigger if exists trg_api_requests_updated_at on api_requests;
create trigger trg_api_requests_updated_at
before update on api_requests
for each row execute procedure set_updated_at();

drop trigger if exists trg_api_environments_updated_at on api_environments;
create trigger trg_api_environments_updated_at
before update on api_environments
for each row execute procedure set_updated_at();

drop trigger if exists trg_whitelabel_brands_updated_at on whitelabel_brands;
create trigger trg_whitelabel_brands_updated_at
before update on whitelabel_brands
for each row execute procedure set_updated_at();

drop trigger if exists trg_whitelabel_themes_updated_at on whitelabel_themes;
create trigger trg_whitelabel_themes_updated_at
before update on whitelabel_themes
for each row execute procedure set_updated_at();

-- ──────────────────────────────────────────────────
-- 13. Enable RLS for new tables
-- ──────────────────────────────────────────────────
alter table api_collections enable row level security;
alter table api_requests enable row level security;
alter table api_environments enable row level security;
alter table api_request_revisions enable row level security;
alter table api_import_jobs enable row level security;
alter table whitelabel_brands enable row level security;
alter table whitelabel_themes enable row level security;
alter table whitelabel_domains enable row level security;

-- ──────────────────────────────────────────────────
-- 14. RLS policies for API Studio tables
-- ──────────────────────────────────────────────────
drop policy if exists "Members view api collections" on api_collections;
create policy "Members view api collections" on api_collections
  for select using (org_id in (select get_user_org_ids()));

drop policy if exists "Editors manage api collections" on api_collections;
create policy "Editors manage api collections" on api_collections
  for all using (is_org_editor(org_id)) with check (is_org_editor(org_id));

drop policy if exists "Members view api requests" on api_requests;
create policy "Members view api requests" on api_requests
  for select using (org_id in (select get_user_org_ids()));

drop policy if exists "Editors manage api requests" on api_requests;
create policy "Editors manage api requests" on api_requests
  for all using (is_org_editor(org_id)) with check (is_org_editor(org_id));

drop policy if exists "Members view api environments" on api_environments;
create policy "Members view api environments" on api_environments
  for select using (org_id in (select get_user_org_ids()));

drop policy if exists "Editors manage api environments" on api_environments;
create policy "Editors manage api environments" on api_environments
  for all using (is_org_editor(org_id)) with check (is_org_editor(org_id));

drop policy if exists "Members view api revisions" on api_request_revisions;
create policy "Members view api revisions" on api_request_revisions
  for select using (org_id in (select get_user_org_ids()));

drop policy if exists "Editors write api revisions" on api_request_revisions;
create policy "Editors write api revisions" on api_request_revisions
  for insert with check (is_org_editor(org_id));

drop policy if exists "Members view import jobs" on api_import_jobs;
create policy "Members view import jobs" on api_import_jobs
  for select using (org_id in (select get_user_org_ids()));

drop policy if exists "Editors create import jobs" on api_import_jobs;
create policy "Editors create import jobs" on api_import_jobs
  for insert with check (is_org_editor(org_id));

-- ──────────────────────────────────────────────────
-- 15. RLS policies for white-label tables
-- ──────────────────────────────────────────────────
drop policy if exists "Members view whitelabel brands" on whitelabel_brands;
create policy "Members view whitelabel brands" on whitelabel_brands
  for select using (org_id in (select get_user_org_ids()));

drop policy if exists "Admins manage whitelabel brands" on whitelabel_brands;
create policy "Admins manage whitelabel brands" on whitelabel_brands
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "Members view whitelabel themes" on whitelabel_themes;
create policy "Members view whitelabel themes" on whitelabel_themes
  for select using (org_id in (select get_user_org_ids()));

drop policy if exists "Admins manage whitelabel themes" on whitelabel_themes;
create policy "Admins manage whitelabel themes" on whitelabel_themes
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "Members view whitelabel domains" on whitelabel_domains;
create policy "Members view whitelabel domains" on whitelabel_domains
  for select using (org_id in (select get_user_org_ids()));

drop policy if exists "Admins manage whitelabel domains" on whitelabel_domains;
create policy "Admins manage whitelabel domains" on whitelabel_domains
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));
