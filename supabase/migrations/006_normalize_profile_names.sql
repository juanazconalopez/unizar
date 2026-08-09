-- Store display names consistently as title case and collapse accidental spaces.
-- The trigger covers profiles created by handle_new_user as well as later edits.

create or replace function public.normalize_display_name(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.initcap(
    pg_catalog.lower(
      pg_catalog.regexp_replace(pg_catalog.btrim(value), '[[:space:]]+', ' ', 'g')
    )
  );
$$;

create or replace function public.normalize_profile_display_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.display_name = public.normalize_display_name(new.display_name);
  return new;
end;
$$;

create trigger profiles_normalize_display_name
before insert or update of display_name on public.profiles
for each row execute function public.normalize_profile_display_name();

-- Normalize every profile already stored. Rows that are already correct remain
-- semantically unchanged; the updated_at trigger records the cleanup date.
update public.profiles
set display_name = public.normalize_display_name(display_name)
where display_name is distinct from public.normalize_display_name(display_name);

alter table public.profiles
  add constraint profiles_display_name_not_empty
  check (length(pg_catalog.btrim(display_name)) > 0);
