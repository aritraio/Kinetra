-- A deliberately public synthetic fixture. No account tables until Phase 2.
create table public.foundation_fixtures (
  id text primary key,
  label text not null
);
alter table public.foundation_fixtures enable row level security;
create policy "Read synthetic fixtures" on public.foundation_fixtures for select to anon, authenticated using (true);
grant select on public.foundation_fixtures to anon, authenticated;
revoke insert, update, delete on public.foundation_fixtures from anon, authenticated;
