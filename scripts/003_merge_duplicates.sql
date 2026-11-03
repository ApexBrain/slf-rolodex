-- SLF Rolodex: merge duplicate contacts (same person entered twice)
-- Generated from scripts/data_quality_report.js + manual review of every group.
-- Run AFTER 002_cleanup_and_integrity.sql. Idempotent. Reversible: removed rows are copied to
-- public.contacts_merge_archive (with merged_into) before deletion.
-- 40 groups, 43 rows removed. NOT merged (needs a human): Advocate Capital (A vs C tier),
-- Latch (David vs Daniel), Richardson (3 addresses), The Function (2 locations), Keystone Rayman,
-- Da-Ren Chen, Schreiber, Feinberg.
-- Survivor per group: has a tier > most complete record > lowest id. A group with conflicting tiers is skipped.

begin;

create table if not exists public.contacts_merge_archive (like public.contacts);
alter table public.contacts_merge_archive
    add column if not exists merged_into bigint,
    add column if not exists merged_at timestamptz default now();
alter table public.contacts_merge_archive enable row level security;  -- no policies: invisible to the app/API

create temp table merge_groups (grp int, id bigint) on commit drop;
insert into merge_groups values
    (1,2),
    (1,352),
    (2,17),
    (2,216),
    (3,62),
    (3,1231),
    (4,85),
    (4,251),
    (5,99),
    (5,357),
    (6,111),
    (6,487),
    (7,138),
    (7,745),
    (8,177),
    (8,1149),
    (8,1150),
    (9,276),
    (9,280),
    (10,292),
    (10,296),
    (11,299),
    (11,302),
    (12,384),
    (12,389),
    (13,397),
    (13,407),
    (14,429),
    (14,446),
    (15,462),
    (15,470),
    (16,564),
    (16,582),
    (17,631),
    (17,632),
    (18,640),
    (18,643),
    (19,774),
    (19,786),
    (20,806),
    (20,807),
    (21,817),
    (21,894),
    (21,895),
    (22,818),
    (22,836),
    (23,913),
    (23,932),
    (23,970),
    (24,925),
    (24,951),
    (25,926),
    (25,981),
    (26,929),
    (26,945),
    (27,936),
    (27,937),
    (28,939),
    (28,952),
    (29,940),
    (29,954),
    (30,958),
    (30,977),
    (31,964),
    (31,965),
    (32,974),
    (32,983),
    (33,985),
    (33,995),
    (34,1018),
    (34,1020),
    (35,1042),
    (35,1056),
    (36,1069),
    (36,1085),
    (37,1134),
    (37,1144),
    (38,1170),
    (38,1176),
    (39,1178),
    (39,1179),
    (40,1242),
    (40,1254);

-- Only rows that still exist; skip groups with fewer than 2 rows left or conflicting tiers.
create temp table ranked on commit drop as
with live as (
    select g.grp, c.*,
           case when c.a then 'A' when c.b then 'B' when c.c then 'C' end as tier,
           ( (coalesce(c.email,'')<>'')::int + (coalesce(c.phone1,'')<>'')::int + (coalesce(c.website,'')<>'')::int
           + (coalesce(c.contact_name,'')<>'')::int + (coalesce(c.who,'')<>'')::int
           + (coalesce(c.street_address,'') !~ '(^$|\.0$)')::int ) as richness
    from merge_groups g join public.contacts c on c.id = g.id
), ok as (
    select grp from live group by grp having count(*) > 1 and count(distinct tier) <= 1
)
select l.*, row_number() over (partition by l.grp order by (l.tier is not null) desc, l.richness desc, l.id) as rn
from live l join ok using (grp);

create temp table survivors on commit drop as select grp, id as sid from ranked where rn = 1;

-- Phones: distinct by digits, survivor's first, up to 4 slots.
create temp table phone_pick on commit drop as
with p as (
    select r.grp, regexp_replace(x.phone, '\D', '', 'g') as k, min(x.phone) as phone, min(r.rn * 10 + x.slot) as ord
    from ranked r
    cross join lateral (values (r.phone1,1),(r.phone2,2),(r.phone3,3),(r.phone4,4)) x(phone, slot)
    where regexp_replace(coalesce(x.phone,''), '\D', '', 'g') ~ '^\d{7,}$'
    group by r.grp, regexp_replace(x.phone, '\D', '', 'g')
)
select grp, array_agg(phone order by ord) as phones from p group by grp;

-- Things that would otherwise be lost: other emails, other addresses, other office names.
create temp table extras on commit drop as
select s.grp,
       string_agg(distinct piece, '; ') as extra
from ( select grp, id, email, street_address, office_name, comments from ranked ) d
join survivors s on s.grp = d.grp
join ranked sv on sv.id = s.sid
cross join lateral (values
    (case when lower(coalesce(d.email,'')) not in ('', lower(coalesce(sv.email,''))) then 'also email: ' || lower(d.email) end),
    (case when d.street_address !~ '(^$|\.0$)' and regexp_replace(lower(d.street_address),'[^a-z0-9]','','g') <> regexp_replace(lower(coalesce(sv.street_address,'')),'[^a-z0-9]','','g')
          then 'other address: ' || d.street_address end),
    (case when regexp_replace(lower(coalesce(d.office_name,'')),'[^a-z0-9]','','g') <> regexp_replace(lower(coalesce(sv.office_name,'')),'[^a-z0-9]','','g') and coalesce(d.office_name,'')<>''
          then 'aka: ' || d.office_name end)
) v(piece)
where d.id <> s.sid and piece is not null
group by s.grp;

update public.contacts t set
    email        = coalesce(nullif(t.email,''), (select r.email from ranked r where r.grp = s.grp and coalesce(r.email,'')<>'' order by r.rn limit 1), ''),
    phone1       = coalesce(pp.phones[1], t.phone1),
    phone2       = coalesce(pp.phones[2], t.phone2),
    phone3       = coalesce(pp.phones[3], t.phone3),
    phone4       = coalesce(pp.phones[4], t.phone4),
    website      = coalesce(nullif(t.website,''), (select r.website from ranked r where r.grp = s.grp and coalesce(r.website,'')<>'' order by r.rn limit 1), ''),
    who          = coalesce(nullif(t.who,''), (select r.who from ranked r where r.grp = s.grp and coalesce(r.who,'')<>'' order by r.rn limit 1), ''),
    mailing      = coalesce(nullif(t.mailing,''), (select r.mailing from ranked r where r.grp = s.grp and coalesce(r.mailing,'')<>'' order by r.rn limit 1), ''),
    street_address = case when coalesce(t.street_address,'') ~ '(^$|\.0$)'
                          then coalesce((select r.street_address from ranked r where r.grp = s.grp and r.street_address !~ '(^$|\.0$)' order by r.rn limit 1), t.street_address)
                          else t.street_address end,
    zip          = coalesce(nullif(t.zip,''), (select r.zip from ranked r where r.grp = s.grp and coalesce(r.zip,'')<>'' order by r.rn limit 1), ''),
    pinned_note  = coalesce(nullif(t.pinned_note,''), (select r.pinned_note from ranked r where r.grp = s.grp and coalesce(r.pinned_note,'')<>'' order by r.rn limit 1), ''),
    specialties  = (select coalesce(array_agg(distinct x order by x), '{}') from ranked r, unnest(coalesce(r.specialties,'{}')) x where r.grp = s.grp),
    notes        = coalesce((select jsonb_agg(v order by v ->> 'timestamp' desc)
                             from (select distinct on (v ->> 'text', v ->> 'timestamp') v
                                   from ranked r, jsonb_array_elements(coalesce(r.notes,'[]'::jsonb)) v
                                   where r.grp = s.grp) q), '[]'::jsonb),
    comments     = nullif(concat_ws(' | ',
                       nullif(regexp_replace(coalesce(t.comments,''), '\s*\|?\s*(Email Addresses Okay|United States)\s*', '', 'g'), ''),
                       'merged duplicates -- ' || (select e.extra from extras e where e.grp = s.grp)), '')
from survivors s
left join phone_pick pp on pp.grp = s.grp
where t.id = s.sid;

-- Archive, then delete the duplicates.
insert into public.contacts_merge_archive
select c.*, s.sid, now()
from ranked r join public.contacts c on c.id = r.id join survivors s on s.grp = r.grp
where r.rn > 1;

delete from public.contacts where id in (select id from ranked where rn > 1);

select (select count(*) from survivors) as groups_merged,
       (select count(*) from ranked where rn > 1) as rows_removed;

commit;
