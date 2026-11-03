-- SLF Rolodex: integrity + cleanup migration
-- Run in Supabase SQL Editor BEFORE deploying the cleanup/hardening-and-data branch.
-- Idempotent: safe to run twice. Section 5 (deletes) is commented out on purpose.
-- Take a backup first: select * from contacts;  -> export CSV.

begin;

-- 1. Audit columns: who changed a contact last, and when --------------------------
alter table public.contacts
    add column if not exists updated_at timestamptz not null default now(),
    add column if not exists updated_by text;

create or replace function public.contacts_touch()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    new.updated_by := coalesce(lower(auth.jwt() ->> 'email'), new.updated_by);
    return new;
end
$$;

drop trigger if exists contacts_touch on public.contacts;
create trigger contacts_touch
before update on public.contacts
for each row execute function public.contacts_touch();

-- 2. A contact can hold at most one tier (A, B or C) --------------------------------
-- NOT VALID so existing rows never block the migration; validate right after.
alter table public.contacts drop constraint if exists contacts_single_tier;
alter table public.contacts
    add constraint contacts_single_tier
    check (num_nonnulls(nullif(a, false), nullif(b, false), nullif(c, false)) <= 1) not valid;
-- If this line errors, a row has two tiers: fix it (select id, office_name from contacts where a::int + b::int + c::int > 1), then re-run.
alter table public.contacts validate constraint contacts_single_tier;

-- 3. Atomic writes: no more lost notes when two people save at the same moment ----------
-- SECURITY INVOKER (default): existing RLS update policy still applies.
create or replace function public.append_contact_note(p_contact_ids bigint[], p_note jsonb)
returns void
language sql
as $$
    update public.contacts
    set notes = jsonb_build_array(
            p_note || jsonb_build_object('author', lower(auth.jwt() ->> 'email'))
        ) || coalesce(notes, '[]'::jsonb)
    where id = any(p_contact_ids);
$$;

create or replace function public.add_contact_specialty(p_contact_ids bigint[], p_specialty text)
returns void
language sql
as $$
    update public.contacts
    set specialties = array_append(coalesce(specialties, '{}'), trim(p_specialty))
    where id = any(p_contact_ids)
      and not exists (
          select 1 from unnest(coalesce(specialties, '{}')) s where lower(s) = lower(trim(p_specialty))
      );
$$;

create or replace function public.remove_contact_specialty(p_contact_ids bigint[], p_specialty text)
returns void
language sql
as $$
    update public.contacts
    set specialties = array_remove(coalesce(specialties, '{}'), p_specialty)
    where id = any(p_contact_ids);
$$;

grant execute on function public.append_contact_note(bigint[], jsonb) to authenticated;
grant execute on function public.add_contact_specialty(bigint[], text) to authenticated;
grant execute on function public.remove_contact_specialty(bigint[], text) to authenticated;

-- 4. Normalization (mechanical, reversible from your backup) -------------------------
-- 4a. Phones: any 10-digit (or 1+10) number becomes (555) 123-4567. Others untouched.
create or replace function pg_temp.fmt_phone(p text) returns text language sql immutable as $$
    select case
        when length(regexp_replace(coalesce(p, ''), '\D', '', 'g')) = 10
            then regexp_replace(regexp_replace(p, '\D', '', 'g'), '(\d{3})(\d{3})(\d{4})', '(\1) \2-\3')
        when length(regexp_replace(coalesce(p, ''), '\D', '', 'g')) = 11 and left(regexp_replace(p, '\D', '', 'g'), 1) = '1'
            then regexp_replace(substr(regexp_replace(p, '\D', '', 'g'), 2), '(\d{3})(\d{3})(\d{4})', '(\1) \2-\3')
        else p
    end
$$;

update public.contacts set
    phone1 = pg_temp.fmt_phone(phone1),
    phone2 = pg_temp.fmt_phone(phone2),
    phone3 = pg_temp.fmt_phone(phone3),
    phone4 = pg_temp.fmt_phone(phone4)
where phone1 is distinct from pg_temp.fmt_phone(phone1)
   or phone2 is distinct from pg_temp.fmt_phone(phone2)
   or phone3 is distinct from pg_temp.fmt_phone(phone3)
   or phone4 is distinct from pg_temp.fmt_phone(phone4);

-- 4b. Import junk: ~1,000 rows carry "Email Addresses Okay" / "United States" from a bulk import.
update public.contacts set comments = nullif(trim(both ' |' from
        regexp_replace(regexp_replace(coalesce(comments, ''), '\s*\|?\s*(Email Addresses Okay|United States)\s*', ' | ', 'g'),
                       '(\s*\|\s*)+$', '')), '')
where comments ~ '(Email Addresses Okay|United States)';

-- 4c. A phone field that only says "United States" is an import artifact.
update public.contacts set phone1 = '' where phone1 = 'United States';

-- 4d. Trim stray whitespace and lowercase emails.
update public.contacts set
    office_name = trim(office_name),
    contact_name = trim(contact_name),
    city = trim(city),
    email = lower(trim(email))
where office_name is distinct from trim(office_name)
   or contact_name is distinct from trim(contact_name)
   or city is distinct from trim(city)
   or email is distinct from lower(trim(email));

-- 5. Review before running ------------------------------------------------------------
-- Fully empty rows (ids 1303 and 1304 in the original import). Uncomment after checking.
-- delete from public.contacts
-- where coalesce(office_name,'') = '' and coalesce(contact_name,'') = '' and coalesce(email,'') = ''
--   and coalesce(phone1,'') = '' and coalesce(street_address,'') = ''
--   and coalesce(jsonb_array_length(notes), 0) = 0;

-- 6. Insert safety: bulk import used explicit ids, which can leave the id sequence behind
-- and make "New contact" fail with a duplicate key error.
select setval(pg_get_serial_sequence('public.contacts', 'id'), greatest((select coalesce(max(id), 1) from public.contacts), 1));

commit;
