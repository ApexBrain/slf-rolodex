-- Run this in Supabase SQL Editor.
-- This sets up role-based user management for:
-- - admin: CRUD contacts + export + manage users
-- - staff: read/insert/update contacts, no delete, no user management

create table if not exists public.app_users (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    role text not null check (role in ('admin', 'staff')),
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

alter table public.app_users enable row level security;
alter table public.contacts enable row level security;

drop policy if exists "Allow anon all" on public.contacts;

create or replace function public.current_user_email()
returns text
language sql
stable
as $$
    select lower(auth.jwt() ->> 'email')
$$;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select au.role
    from public.app_users au
    where lower(au.email) = public.current_user_email()
      and au.is_active = true
    limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.current_app_role() = 'admin'
$$;

create or replace function public.is_staff_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.current_app_role() in ('admin', 'staff')
$$;

grant execute on function public.current_user_email() to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff_or_admin() to authenticated;

drop policy if exists "contacts_select_staff_admin" on public.contacts;
create policy "contacts_select_staff_admin"
on public.contacts
for select
to authenticated
using (public.is_staff_or_admin());

drop policy if exists "contacts_insert_staff_admin" on public.contacts;
create policy "contacts_insert_staff_admin"
on public.contacts
for insert
to authenticated
with check (public.is_staff_or_admin());

drop policy if exists "contacts_update_staff_admin" on public.contacts;
create policy "contacts_update_staff_admin"
on public.contacts
for update
to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

drop policy if exists "contacts_delete_admin_only" on public.contacts;
create policy "contacts_delete_admin_only"
on public.contacts
for delete
to authenticated
using (public.is_admin());

drop policy if exists "app_users_select_admin_or_self" on public.app_users;
create policy "app_users_select_admin_or_self"
on public.app_users
for select
to authenticated
using (
    public.is_admin()
    or lower(email) = public.current_user_email()
);

drop policy if exists "app_users_insert_admin_or_first" on public.app_users;
drop policy if exists "app_users_insert_admin_only" on public.app_users;
create policy "app_users_insert_admin_only"
on public.app_users
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "app_users_update_admin_only" on public.app_users;
create policy "app_users_update_admin_only"
on public.app_users
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "app_users_delete_admin_only" on public.app_users;
create policy "app_users_delete_admin_only"
on public.app_users
for delete
to authenticated
using (public.is_admin());
