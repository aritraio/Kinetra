-- A photo cannot refer to another tenant's consent, even in privileged jobs.
alter table public.consent_records add constraint consent_records_id_owner_unique unique(id,owner_id);
alter table public.photo_metadata drop constraint photo_metadata_consent_id_fkey;
alter table public.photo_metadata add constraint photo_metadata_consent_owner_fkey foreign key(consent_id,owner_id) references public.consent_records(id,owner_id);
