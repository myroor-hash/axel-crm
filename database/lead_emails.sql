create extension if not exists pgcrypto;

create table if not exists lead_emails (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  resend_email_id text unique,
  recipient_email text not null,
  sender_email text not null,
  sent_by_user_id uuid references users(id),
  sent_by_name text,
  subject text not null,
  body_text text not null,
  attachment_id text,
  attachment_name text,
  status text not null default 'sent',
  sent_at timestamptz not null default now(),
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lead_emails_lead_id_idx
on lead_emails(lead_id);

create index if not exists lead_emails_clicked_at_idx
on lead_emails(clicked_at desc);

alter table lead_emails enable row level security;

drop policy if exists "authenticated users can read lead emails" on lead_emails;
drop policy if exists "authenticated users can insert lead emails" on lead_emails;

create policy "authenticated users can read lead emails"
on lead_emails
for select
to authenticated
using (true);

create policy "authenticated users can insert lead emails"
on lead_emails
for insert
to authenticated
with check (true);

create or replace function set_lead_emails_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lead_emails_set_updated_at on lead_emails;
create trigger trg_lead_emails_set_updated_at
before update on lead_emails
for each row
execute function set_lead_emails_updated_at();
