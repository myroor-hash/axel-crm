create extension if not exists pgcrypto;

do $$ begin
  create type user_role as enum ('admin', 'sales');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type lead_status as enum (
    'new',
    'attempted_contact',
    'spoke_to_contact',
    'follow_up_required',
    'information_sent',
    'sample_sent',
    'customer',
    'dead_lead'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type call_outcome as enum (
    'no_answer',
    'wrong_number',
    'gatekeeper_only',
    'spoke_to_buyer',
    'not_interested',
    'call_back_requested',
    'send_information',
    'sample_requested',
    'converted_to_customer'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type activity_type as enum (
    'call',
    'note',
    'email_sent',
    'status_changed',
    'sample_recorded',
    'customer_converted'
  );
exception
  when duplicate_object then null;
end $$;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  full_name text not null,
  email text not null unique,
  role user_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists lead_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  shop_name text not null,
  contact_first_name text,
  contact_last_name text,
  contact_job_title text,
  phone_number text not null,
  email text,
  address_line_1 text,
  address_line_2 text,
  town_city text,
  county_region text,
  postcode text,
  lead_source_id uuid references lead_sources(id),
  status lead_status not null default 'new',
  customer_flag boolean not null default false,
  won_by_user_id uuid references users(id),
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  sample_sent_at timestamptz,
  last_outcome call_outcome,
  priority_note text,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);

create table if not exists lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  user_id uuid not null references users(id),
  activity_type activity_type not null,
  call_outcome call_outcome,
  note_text text,
  previous_status lead_status,
  new_status lead_status,
  follow_up_set_for timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists lead_locks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  user_id uuid not null references users(id),
  locked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  released_at timestamptz,
  is_active boolean not null default true
);

drop trigger if exists trg_users_set_updated_at on users;
create trigger trg_users_set_updated_at
before update on users
for each row
execute function set_updated_at();

drop trigger if exists trg_lead_sources_set_updated_at on lead_sources;
create trigger trg_lead_sources_set_updated_at
before update on lead_sources
for each row
execute function set_updated_at();

drop trigger if exists trg_leads_set_updated_at on leads;
create trigger trg_leads_set_updated_at
before update on leads
for each row
execute function set_updated_at();
