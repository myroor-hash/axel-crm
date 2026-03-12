Axel Elixir CRM
Project Overview

Axel Elixir CRM is a lightweight telesales CRM designed for a small sales team selling Axel Elixir bone broth to UK retail shops.

The system is optimised specifically for:

phone-based sales

rapid lead cycling

simple contact management

follow-up scheduling

email sending with attachments

spreadsheet importing of leads/customers

The design philosophy is speed, simplicity, and clarity during live calls.

Technology Stack

Framework
Next.js (App Router)

Language
TypeScript

Styling
TailwindCSS

Runtime
Node.js

Development Environment
MacOS (local development)

Hosting Target
Vercel

Planned Backend Services

Database
Supabase (Postgres)

Authentication
Supabase Auth

File Storage
Supabase Storage

Email Sending
Resend or Postmark

Current Application Status

The application runs locally and includes working UI and core workflow logic.

The project is currently transitioning from local prototype logic to persistent database architecture.

Core Features Implemented
Lead Queue

Displays leads in priority order.

Priority rules:

Follow-ups due

Never contacted leads

Oldest contacted leads

Queue currently loads the top 20 leads for performance.

Lead Locking UX

When a user opens a lead:

the lead appears locked

other users see a read-only view

lock owner is displayed

Lock persistence is currently simulated and will be moved to database.

Lead Detail Panel

Displays:

shop name

contact name

phone

email

location

priority notes

Call Outcome Workflow

Call workflow:

User writes optional note

User selects call outcome

Available outcomes:

No Answer

Gatekeeper

Spoke to Buyer

Send Info

Activity Timeline

Each lead displays its own timeline including:

call outcomes

notes

email activity

Timeline is currently stored locally and will be moved to database.

Auto-Advance Calling

After recording an outcome:

CRM automatically moves to the next lead

Call Next Lead Safety

If a user presses "Next Lead" without recording an outcome:

warning appears

confirmation required

Prevents accidental lead skipping.

Email Preparation Panel

Users can:

prepare a sales email

attach a brochure

review the message

manually press Send

Email sending is currently simulated.

Future version will send real emails via API.

Spreadsheet Importer

Imports customer data from CSV or Excel.

Tested using a Pandle customer export dataset.

Importer features:

file preview

lead source assignment

inline creation of new lead sources

duplicate detection

Duplicate detection uses:

external reference

phone number

Imported records currently stored in localStorage for testing.

Search Function

Global search allows finding leads by:

shop name

contact name

phone number

postcode

town

Used when customers phone the business.

UX Considerations

The system was designed with the following constraints:

salespeople are on the phone while using the system

interactions must be extremely fast

minimal screen switching

high visual clarity

accessible colour palette (works for red-green colour blindness)

File Structure Overview

Key directories:

app/
components/
features/
lib/
database/

Important components:

components/leads/
lead-list.tsx
lead-detail-panel.tsx
next-lead-button.tsx
email-compose-panel.tsx

components/import/
lead-import-workspace.tsx

features/import/
parse-file.ts
types.ts

features/leads/
types.ts
queries.ts

features/locks/

features/attachments/

Data Model (Planned)
leads

Fields will include:

id

shop_name

contact_name

phone_number

email

location fields

status

last_contacted_at

next_follow_up_at

lead_source_id

lead_activities

Stores timeline entries including:

call outcomes

notes

emails sent

lead_sources

Stores origin of leads.

Examples:

Paid List

Website Lead

Trade Show

Customer Referral

Pandle Import

Security Principles

The system must ensure:

protection against SQL injection

secure authentication

role-based access control

no exposure of sensitive data

secure handling of customer data

Attachments

Sales attachments will support:

File type
PDF only

Max file size
10MB

Admin users upload attachments which can be selected when sending emails.

Next Development Phase

The current version uses local data for testing.

Next development steps:

Move lead sources to Supabase

Move imported customers to Supabase

Persist activity timeline

Persist queue state

Implement Supabase authentication

Persist lead locking

Implement attachment storage

Implement real email sending

Deploy application to Vercel

Development Rules

When continuing development:

Provide full file replacements rather than partial snippets.

Assume the developer edits files using nano.

Preserve the existing UX behaviour.

Avoid re-asking questions already answered.

Maintain strong security practices.

Deployment Plan

Final deployment target:

crm.axelelixir.co.uk

