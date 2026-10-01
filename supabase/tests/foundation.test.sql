begin;
select plan(3);
select has_table('public', 'foundation_fixtures', 'fixture migration applied');
select results_eq($$select label from public.foundation_fixtures where id = 'phase-1'$$, $$values ('Synthetic foundation fixture'::text)$$, 'synthetic seed exists');
select ok((select relrowsecurity from pg_class where oid = 'public.foundation_fixtures'::regclass), 'RLS enabled');
select * from finish();
rollback;
