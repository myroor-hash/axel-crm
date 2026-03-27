create table if not exists lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  user_id uuid not null references users(id),
  actor_name text,
  note_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists lead_notes_lead_id_idx
on lead_notes(lead_id, created_at desc);
