-- Production migrations do not permit collection before Phase 6 privacy controls.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.runtime_settings (singleton boolean primary key default true check(singleton), account_writes_enabled boolean not null default false);
insert into private.runtime_settings(singleton,account_writes_enabled) values(true,false);
revoke all on private.runtime_settings from public,anon,authenticated;
create function private.assert_account_writes()
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from private.runtime_settings where singleton and account_writes_enabled) then
    raise sqlstate 'PT403' using message='Account writes are not enabled';
  end if;
end $$;
create function public.configure_account_writes(enabled boolean)
returns void language sql security definer set search_path='' as $$
  update private.runtime_settings set account_writes_enabled=enabled where singleton;
$$;
revoke all on function public.configure_account_writes(boolean) from public,anon,authenticated;
grant execute on function public.configure_account_writes(boolean) to service_role;

create or replace function public.save_profile(expected_revision integer, profile_data jsonb)
returns setof public.profiles language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  perform private.assert_account_writes();
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

create or replace function public.save_daily_log(expected_revision integer, log_date date, log_timezone text, log_weight_kg numeric)
returns setof public.daily_logs language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  perform private.assert_account_writes();
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

create or replace function public.record_consent(consent_purpose text, consent_action text, consent_version text)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.assert_account_writes();
  if auth.uid() is null then raise sqlstate 'PT401' using message='Unauthenticated'; end if;
  insert into public.consent_records(owner_id,purpose,action,policy_version) values(auth.uid(),consent_purpose,consent_action,consent_version);
end $$;
