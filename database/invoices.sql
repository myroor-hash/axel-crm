create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_ref text not null unique,
  invoice_date date,
  invoice_type text,
  customer_name text,
  customer_ref text,
  description text,
  total_amount text,
  status text,
  sent_status text,
  created_at timestamptz not null default now()
);

create index if not exists invoices_customer_name_idx
on invoices(customer_name);

create index if not exists invoices_customer_ref_idx
on invoices(customer_ref);
