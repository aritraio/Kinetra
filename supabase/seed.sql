insert into public.foundation_fixtures (id, label) values ('phase-1', 'Synthetic foundation fixture') on conflict (id) do update set label = excluded.label;

-- This seed is run only by the documented disposable local stack. Hosted migrations keep writes disabled.
select public.configure_account_writes(true);
