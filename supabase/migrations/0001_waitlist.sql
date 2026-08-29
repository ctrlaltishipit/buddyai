-- Early-access waitlist.
--
-- One row per person who signed up with Google. Keyed to auth.users so a
-- deleted account takes its waitlist row with it.
--
-- Nothing writes here from the browser: the join-waitlist Edge Function does
-- the insert with the service-role key after verifying the caller's JWT.

create table if not exists public.waitlist (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  email         text        not null,
  display_name  text,
  companion     text        not null default 'sage'
                  check (companion in ('sage', 'sol', 'ember')),
  source        text,
  welcomed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists waitlist_created_at_idx on public.waitlist (created_at desc);
create unique index if not exists waitlist_email_key on public.waitlist (lower(email));

-- RLS on with NO policies: PostgREST exposes every public table to the anon
-- key, so without this anyone could read the full signup list. The Edge
-- Function uses the service-role key, which bypasses RLS by design.
alter table public.waitlist enable row level security;

comment on table public.waitlist is
  'Early-access signups. Written only by the join-waitlist Edge Function.';
