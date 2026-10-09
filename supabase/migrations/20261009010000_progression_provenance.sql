-- Phase 8: Add 'progression' and 'synthetic_fixture' to plan_versions provenance check constraint
alter table public.plan_versions drop constraint if exists plan_versions_provenance_check;

alter table public.plan_versions
  add constraint plan_versions_provenance_check
  check (provenance in ('generated', 'repaired', 'template', 'synthetic_fixture', 'progression'));
