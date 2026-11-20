-- Master Mind Institute: database + access policies
-- Run in Supabase SQL Editor. Safe to re-run for the tables/policies defined here.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'student' check (role in ('student','admin','super_admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','super_admin')
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles
for select to authenticated using (id = auth.uid() or public.is_admin());

-- Students cannot update their own role. Only admins can manage profile rows.
drop policy if exists "Users can update own basic profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

drop policy if exists "Admins can manage profiles" on public.profiles;
create policy "Admins can manage profiles" on public.profiles
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.study_materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  class_level text not null check (class_level in ('9','10','11','12')),
  subject text not null,
  material_type text not null check (material_type in ('lecture','notes','dpp','pyq','other')),
  file_url text,
  storage_path text,
  thumbnail_url text,
  is_published boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.study_materials enable row level security;

drop policy if exists "Published materials are visible" on public.study_materials;
create policy "Published materials are visible" on public.study_materials
for select to anon, authenticated using (is_published = true or public.is_admin());

drop policy if exists "Admins can insert materials" on public.study_materials;
create policy "Admins can insert materials" on public.study_materials
for insert to authenticated with check (public.is_admin());

drop policy if exists "Admins can update materials" on public.study_materials;
create policy "Admins can update materials" on public.study_materials
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete materials" on public.study_materials;
create policy "Admins can delete materials" on public.study_materials
for delete to authenticated using (public.is_admin());

-- Create the bucket if it does not exist. Existing bucket settings are not overwritten.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('study-materials', 'study-materials', true, 52428800,
  array['application/pdf','image/jpeg','image/png','image/webp','video/mp4'])
on conflict (id) do nothing;

drop policy if exists "Public can read study material files" on storage.objects;
create policy "Public can read study material files" on storage.objects
for select to anon, authenticated using (bucket_id = 'study-materials');

drop policy if exists "Admins can upload study material files" on storage.objects;
create policy "Admins can upload study material files" on storage.objects
for insert to authenticated with check (bucket_id = 'study-materials' and public.is_admin());

drop policy if exists "Admins can update study material files" on storage.objects;
create policy "Admins can update study material files" on storage.objects
for update to authenticated using (bucket_id = 'study-materials' and public.is_admin())
with check (bucket_id = 'study-materials' and public.is_admin());

drop policy if exists "Admins can delete study material files" on storage.objects;
create policy "Admins can delete study material files" on storage.objects
for delete to authenticated using (bucket_id = 'study-materials' and public.is_admin());

-- Automatically create a student profile when a new account signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name','Student'), 'student')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
