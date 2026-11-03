-- SLF Rolodex: merge duplicate contacts (same person entered twice)
-- REBUILT FROM THE LIVE DATABASE (live ids differ from the repo's data.js ids; the first version of this
-- file used repo ids and would have merged the wrong people -- do not use older copies).
-- 56 groups, 60 rows removed. Every group was reviewed by hand.
-- SAFETY GUARD: each id carries an expected name fragment. If any row in a group does not contain that
-- fragment in contact_name/office_name (id drift, already merged, edited), the WHOLE group is skipped.
-- Run AFTER 002_cleanup_and_integrity.sql and AFTER exporting a backup of contacts. Idempotent.
-- Reversible: removed rows are copied to public.contacts_merge_archive (with merged_into) before deletion.
-- NOT merged (needs a human): Advocate Capital (A vs C tier), The Function (2 locations), Latch (David vs Daniel),
-- Richardson (3 addresses), Keystone Rayman, Da-Ren Chen, Schreiber, Feinberg, Ali Reza Bamdad (1188),
-- Elk Grove Natural Health (26/390, different address), Serpa (422/427), Integrity (500/508),
-- Franceschi (856/874), Stevens Creek Levine (967/983), San Leandro Macchesney (1056/1058).
-- Test rows 1341/1342 ("Andres test") should simply be deleted from the app.
-- Survivor per group: has a tier > most complete record > lowest id. A group with conflicting tiers is skipped.

begin;

create table if not exists public.contacts_merge_archive (like public.contacts);
alter table public.contacts_merge_archive
    add column if not exists merged_into bigint,
    add column if not exists merged_at timestamptz default now();
alter table public.contacts_merge_archive enable row level security;  -- no policies: invisible to the app/API

create temp table merge_groups (grp int, id bigint, expect text) on commit drop;
insert into merge_groups values
    (1,10,'noorivaz'),
    (1,11,'noorivaz'),
    (2,23,'knapp'),
    (2,242,'knapp'),
    (3,28,'frigard'),
    (3,254,'frigard'),
    (4,36,'dietzen'),
    (4,530,'dietzen'),
    (5,41,'olson'),
    (5,338,'olson'),
    (6,43,'oranje'),
    (6,669,'oranje'),
    (6,670,'oranje'),
    (7,50,'singh'),
    (7,452,'singh'),
    (8,68,'kenny'),
    (8,1269,'kenny'),
    (9,78,'bhakta'),
    (9,783,'bhakta'),
    (10,80,'andrade'),
    (10,326,'andrade'),
    (11,81,'ambrose'),
    (11,386,'ambrose'),
    (12,88,'shakeri'),
    (12,255,'shakeri'),
    (13,98,'patel'),
    (13,1189,'patel'),
    (14,115,'rosari'),
    (14,286,'rosari'),
    (15,118,'bernardo'),
    (15,726,'bernardo'),
    (16,121,'bamdad'),
    (16,1187,'bamdad'),
    (17,123,'nguyen'),
    (17,950,'nguyen'),
    (18,125,'dancy'),
    (18,598,'dancy'),
    (19,143,'katz'),
    (19,850,'katz'),
    (20,155,'chahay'),
    (20,723,'chahay'),
    (21,157,'rasheed'),
    (21,1257,'rasheed'),
    (22,168,'tedla'),
    (22,204,'tedla'),
    (22,525,'tedla'),
    (23,174,'nori'),
    (23,1230,'nori'),
    (24,181,'rixen'),
    (24,388,'rixen'),
    (25,184,'spencer'),
    (25,599,'spencer'),
    (26,187,'romero'),
    (26,1042,'romero'),
    (27,189,'baratta'),
    (27,1297,'baratta'),
    (28,199,'zawada'),
    (28,756,'zawada'),
    (29,226,'giessman'),
    (29,289,'giessman'),
    (30,233,'sundstrom'),
    (30,395,'sundstrom'),
    (31,314,'sunrise'),
    (31,318,'sunrise'),
    (32,330,'anderson'),
    (32,334,'anderson'),
    (33,337,'sitzmann'),
    (33,340,'sitzmann'),
    (34,435,'slone'),
    (34,445,'slone'),
    (35,467,'norton'),
    (35,484,'norton'),
    (36,602,'magtoto'),
    (36,620,'magtoto'),
    (37,678,'kirk'),
    (37,681,'kirk'),
    (38,812,'grimes'),
    (38,824,'grimes'),
    (39,844,'oikawa'),
    (39,845,'oikawa'),
    (40,855,'calzaret'),
    (40,932,'calzaret'),
    (40,933,'calzaret'),
    (41,951,'terribilini'),
    (41,970,'terribilini'),
    (41,1008,'terribilini'),
    (42,963,'daniels'),
    (42,989,'daniels'),
    (43,964,'daryaie'),
    (43,1019,'daryaie'),
    (44,1012,'daryaie'),
    (44,1021,'daryaie'),
    (45,974,'chaunce'),
    (45,975,'chaunce'),
    (46,977,'dieter'),
    (46,990,'dieter'),
    (47,978,'decker'),
    (47,992,'decker'),
    (48,996,'elite'),
    (48,1015,'elite'),
    (49,1002,'adams'),
    (49,1003,'adams'),
    (50,1023,'jamieson'),
    (50,1033,'jamieson'),
    (51,1080,'rockwell'),
    (51,1094,'rockwell'),
    (52,1107,'hwang'),
    (52,1123,'hwang'),
    (53,1172,'bernd'),
    (53,1182,'bernd'),
    (54,1208,'lundberg'),
    (54,1214,'lundberg'),
    (55,1216,'petersen'),
    (55,1217,'petersen'),
    (56,1280,'bergman'),
    (56,1292,'bergman');

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
    except
    -- name guard: any row not matching its expected fragment disqualifies the whole group
    select g.grp from merge_groups g
    left join public.contacts c on c.id = g.id
    where c.id is null
       or lower(coalesce(c.contact_name,'') || ' ' || coalesce(c.office_name,'')) not like '%' || g.expect || '%'
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
