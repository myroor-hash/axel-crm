alter table if exists lead_emails
add column if not exists sent_by_user_id uuid references users(id);

alter table if exists lead_emails
add column if not exists sent_by_name text;
