-- Greenfield tenant foundation. No existing identities are migrated.
create table public.profiles (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 80),
  height_cm numeric not null check (height_cm between 50 and 250),
  weight_kg numeric not null check (weight_kg between 20 and 500),
  goal text not null check (goal in ('maintain','cut','bulk')),
  timezone text not null check (length(timezone) between 1 and 80),
  units text not null check (units in ('metric','imperial')),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null, timezone text not null,
  weight_kg numeric not null check (weight_kg between 20 and 500),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(owner_id, local_date)
);
create table public.plans (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('meal','workout')), created_at timestamptz not null default now(),
  unique(id, owner_id)
);
create table public.plan_versions (
  plan_id uuid not null, owner_id uuid not null references auth.users(id) on delete cascade,
  version integer not null check(version > 0), payload jsonb not null,
  schema_version text not null, policy_version text not null, prompt_version text not null,
  provenance text not null check (provenance in ('generated','repaired','template')),
  created_at timestamptz not null default now(), primary key(plan_id, version),
  foreign key(plan_id, owner_id) references public.plans(id, owner_id) on delete cascade
);
create table public.training_sessions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid, plan_version integer, started_at timestamptz not null,
  completed_at timestamptz, created_at timestamptz not null default now(),
  foreign key(plan_id, plan_version) references public.plan_versions(plan_id, version),
  foreign key(plan_id, owner_id) references public.plans(id, owner_id),
  check (completed_at is null or completed_at >= started_at),
  check ((plan_id is null) = (plan_version is null))
);
create table public.ai_operations (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null, input_digest text not null,
  state text not null check (state in ('pending','completed','failed')),
  created_at timestamptz not null default now(), expires_at timestamptz not null,
  unique(owner_id, idempotency_key)
);
create table public.consent_records (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('camera_local','photo_storage','provider_processing')),
  action text not null check (action in ('grant','withdraw')),
  policy_version text not null check (policy_version = '2026-10-01'), created_at timestamptz not null default now()
);
create table public.photo_metadata (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  object_path text not null unique, consent_id uuid not null references public.consent_records(id),
  expires_at timestamptz not null, created_at timestamptz not null default now(),
  check (object_path like owner_id::text || '/%')
);
create table public.deletion_jobs (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  state text not null check (state in ('requested','running','completed','failed')),
  requested_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.usage_buckets (
  owner_id uuid not null references auth.users(id) on delete cascade, bucket timestamptz not null,
  requests integer not null default 0 check(requests >= 0), reserved_tokens integer not null default 0 check(reserved_tokens >= 0),
  primary key(owner_id, bucket)
);
create table public.global_usage_buckets (
  bucket timestamptz primary key, requests integer not null default 0 check(requests >= 0),
  reserved_tokens integer not null default 0 check(reserved_tokens >= 0)
);
create table public.ai_budget_leases (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null, created_at timestamptz not null default now()
);
create index ai_budget_leases_owner_expiry on public.ai_budget_leases(owner_id, expires_at);

alter table public.profiles enable row level security;
create policy owner_read on public.profiles for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

alter table public.daily_logs enable row level security;
create policy owner_read on public.daily_logs for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.daily_logs from anon, authenticated;
grant select on public.daily_logs to authenticated;

alter table public.plans enable row level security;
create policy owner_read on public.plans for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.plans from anon, authenticated;
grant select on public.plans to authenticated;

alter table public.plan_versions enable row level security;
create policy owner_read on public.plan_versions for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.plan_versions from anon, authenticated;
grant select on public.plan_versions to authenticated;

alter table public.training_sessions enable row level security;
create policy owner_read on public.training_sessions for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.training_sessions from anon, authenticated;
grant select on public.training_sessions to authenticated;

alter table public.ai_operations enable row level security;
create policy owner_read on public.ai_operations for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.ai_operations from anon, authenticated;
grant select on public.ai_operations to authenticated;

alter table public.consent_records enable row level security;
create policy owner_read on public.consent_records for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.consent_records from anon, authenticated;
grant select on public.consent_records to authenticated;

alter table public.photo_metadata enable row level security;
create policy owner_read on public.photo_metadata for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.photo_metadata from anon, authenticated;
grant select on public.photo_metadata to authenticated;

alter table public.deletion_jobs enable row level security;
create policy owner_read on public.deletion_jobs for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.deletion_jobs from anon, authenticated;
grant select on public.deletion_jobs to authenticated;

alter table public.usage_buckets enable row level security;
create policy owner_read on public.usage_buckets for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.usage_buckets from anon, authenticated;
grant select on public.usage_buckets to authenticated;

alter table public.ai_budget_leases enable row level security;
create policy owner_read on public.ai_budget_leases for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.ai_budget_leases from anon, authenticated;
grant select on public.ai_budget_leases to authenticated;

alter table public.global_usage_buckets enable row level security;
revoke all on public.global_usage_buckets from anon, authenticated;
-- Authenticated users have read-only table grants. Narrow RPCs below handle writes.

create function public.save_profile(expected_revision integer, profile_data jsonb)
returns setof public.profiles language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise sqlstate 'PT401' using message = 'Unauthenticated'; end if;
  if expected_revision < 0 or profile_data is null or jsonb_typeof(profile_data) <> 'object' or
    (select count(*) from jsonb_object_keys(profile_data)) <> 7 or
    exists(select 1 from jsonb_object_keys(profile_data) key where key not in ('display_name','height_cm','weight_kg','goal','timezone','units','policy_version')) or
    profile_data->>'policy_version' is distinct from '2026-10-01' or
    jsonb_typeof(profile_data->'display_name') is distinct from 'string' or
    jsonb_typeof(profile_data->'height_cm') is distinct from 'number' or
    jsonb_typeof(profile_data->'weight_kg') is distinct from 'number' or
    jsonb_typeof(profile_data->'goal') is distinct from 'string' or
    jsonb_typeof(profile_data->'timezone') is distinct from 'string' or
    jsonb_typeof(profile_data->'units') is distinct from 'string' or
    not exists(select 1 from pg_catalog.pg_timezone_names where name = profile_data->>'timezone') then
    raise sqlstate 'PT400' using message = 'Invalid profile';
  end if;
  if expected_revision = 0 then
    return query insert into public.profiles(owner_id,display_name,height_cm,weight_kg,goal,timezone,units)
      values(actor,btrim(profile_data->>'display_name'),(profile_data->>'height_cm')::numeric,(profile_data->>'weight_kg')::numeric,profile_data->>'goal',profile_data->>'timezone',profile_data->>'units')
      on conflict(owner_id) do nothing returning *;
  else
    return query update public.profiles set display_name=btrim(profile_data->>'display_name'),height_cm=(profile_data->>'height_cm')::numeric,
      weight_kg=(profile_data->>'weight_kg')::numeric,goal=profile_data->>'goal',timezone=profile_data->>'timezone',units=profile_data->>'units',
      revision=revision+1,updated_at=now() where owner_id=actor and revision=expected_revision returning *;
  end if;
  if not found then raise sqlstate 'PT409' using message = 'Revision conflict'; end if;
end $$;
revoke all on function public.save_profile(integer,jsonb) from public,anon;
grant execute on function public.save_profile(integer,jsonb) to authenticated;

create function public.save_daily_log(expected_revision integer, log_date date, log_timezone text, log_weight_kg numeric)
returns setof public.daily_logs language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise sqlstate 'PT401' using message='Unauthenticated'; end if;
  if expected_revision < 0 or log_date is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=log_timezone) then
    raise sqlstate 'PT400' using message='Invalid log'; end if;
  if expected_revision=0 then
    return query insert into public.daily_logs(owner_id,local_date,timezone,weight_kg) values(actor,log_date,log_timezone,log_weight_kg)
      on conflict(owner_id,local_date) do nothing returning *;
  else
    -- A historical entry's timezone/date identity never changes during an edit.
    return query update public.daily_logs set weight_kg=log_weight_kg,revision=revision+1,updated_at=now()
      where owner_id=actor and local_date=log_date and timezone=log_timezone and revision=expected_revision returning *;
  end if;
  if not found then raise sqlstate 'PT409' using message='Revision conflict'; end if;
end $$;
revoke all on function public.save_daily_log(integer,date,text,numeric) from public,anon;
grant execute on function public.save_daily_log(integer,date,text,numeric) to authenticated;

create function public.record_consent(consent_purpose text, consent_action text, consent_version text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise sqlstate 'PT401' using message='Unauthenticated'; end if;
  insert into public.consent_records(owner_id,purpose,action,policy_version) values(auth.uid(),consent_purpose,consent_action,consent_version);
end $$;
revoke all on function public.record_consent(text,text,text) from public,anon;
grant execute on function public.record_consent(text,text,text) to authenticated;

-- Service-only budget RPC: global-first row locks serialize reservations across workers.
create function public.acquire_ai_budget(actor uuid, tokens integer, user_requests integer, global_requests integer,
  user_tokens integer, global_tokens integer, max_concurrent integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare hour_bucket timestamptz := date_trunc('hour',now()); user_bucket public.usage_buckets; global_bucket public.global_usage_buckets; lease uuid;
begin
  if actor is null or tokens < 1 or user_requests < 1 or global_requests < 1 or user_tokens < 1 or global_tokens < 1 or max_concurrent < 1 then
    raise sqlstate 'PT400' using message='Invalid budget'; end if;
  insert into public.global_usage_buckets(bucket) values(hour_bucket) on conflict do nothing;
  select * into global_bucket from public.global_usage_buckets where bucket=hour_bucket for update;
  insert into public.usage_buckets(owner_id,bucket) values(actor,hour_bucket) on conflict do nothing;
  select * into user_bucket from public.usage_buckets where owner_id=actor and bucket=hour_bucket for update;
  if global_bucket.requests >= global_requests or global_bucket.reserved_tokens+tokens > global_tokens or
     user_bucket.requests >= user_requests or user_bucket.reserved_tokens+tokens > user_tokens or
     (select count(*) from public.ai_budget_leases where owner_id=actor and expires_at > now()) >= max_concurrent then return null; end if;
  update public.global_usage_buckets set requests=requests+1,reserved_tokens=reserved_tokens+tokens where bucket=hour_bucket;
  update public.usage_buckets set requests=requests+1,reserved_tokens=reserved_tokens+tokens where owner_id=actor and bucket=hour_bucket;
  insert into public.ai_budget_leases(owner_id,expires_at) values(actor,now()+interval '30 seconds') returning id into lease;
  return lease;
end $$;
revoke all on function public.acquire_ai_budget(uuid,integer,integer,integer,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.acquire_ai_budget(uuid,integer,integer,integer,integer,integer,integer) to service_role;

create function public.release_ai_budget(actor uuid, lease uuid)
returns void language sql security definer set search_path='' as $$
  delete from public.ai_budget_leases where id=lease and owner_id=actor;
$$;
revoke all on function public.release_ai_budget(uuid,uuid) from public,anon,authenticated;
grant execute on function public.release_ai_budget(uuid,uuid) to service_role;

create function public.cleanup_security_records()
returns void language plpgsql security definer set search_path='' as $$
begin
  delete from public.ai_budget_leases where expires_at < now();
  delete from public.usage_buckets where bucket < now()-interval '24 hours';
  delete from public.global_usage_buckets where bucket < now()-interval '24 hours';
  delete from public.ai_operations where expires_at < now();
end $$;
revoke all on function public.cleanup_security_records() from public,anon,authenticated;
grant execute on function public.cleanup_security_records() to service_role;
create extension if not exists pg_cron;
select cron.schedule('kinetra-security-cleanup','17 * * * *','select public.cleanup_security_records()');
