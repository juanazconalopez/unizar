-- Ejecutar completa después de 096. No genera envíos ni importa avisos anteriores.
begin;

insert into public.permission_definitions
  (key,section_key,section_label,label,description,action,parent_key,sort_order,configurable,owner_only)
values ('notifications.push','notifications','Notificaciones','Recibir notificaciones push',
  'Activar voluntariamente avisos en dispositivos propios. Cada aviso respeta sus permisos de consulta.','view',null,690,true,false);
insert into public.role_permission_defaults(role,permission_key) values
  ('coach','notifications.push'),('viewer','notifications.push'),('player','notifications.push');
insert into public.role_permissions(role,permission_key)
  select role,permission_key from public.role_permission_defaults where permission_key='notifications.push';

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_key uuid not null unique,
  endpoint text not null unique check(length(endpoint) <= 2048),
  p256dh text not null check(p256dh ~ '^[A-Za-z0-9_-]{87}$'),
  auth_key text not null check(auth_key ~ '^[A-Za-z0-9_-]{22}$'),
  topics text[] not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check(cardinality(topics) <= 8 and topics <@ array['matches','lineups','announcements','training_groups',
    'availability_reminders','availability_digest','training_changes','training_reminders']::text[])
);
create index push_subscriptions_user on public.push_subscriptions(user_id);

create table public.push_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  kind text not null check(kind in ('match_published','match_changed','lineup','announcement','training_group',
    'availability_reminder','availability_digest','training_changed','training_reminder','test')),
  source_id uuid,
  season_id uuid references public.seasons(id) on delete cascade,
  target_date date,
  previous_date date,
  recipient_id uuid references public.profiles(id) on delete cascade,
  subscription_id uuid references public.push_subscriptions(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  available_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp()+interval '1 day')
);
create index push_events_expiry on public.push_events(expires_at);

create table public.push_deliveries (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.push_events(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  attempts integer not null default 0 check(attempts between 0 and 5),
  next_attempt_at timestamptz not null default clock_timestamp(),
  lease_token uuid,
  locked_until timestamptz,
  finished_at timestamptz,
  last_status integer,
  unique(event_id,subscription_id)
);
create index push_deliveries_pending on public.push_deliveries(next_attempt_at,id) where finished_at is null;

alter table public.push_subscriptions enable row level security;
alter table public.push_events enable row level security;
alter table public.push_deliveries enable row level security;
revoke all on public.push_subscriptions,public.push_events,public.push_deliveries from public,anon,authenticated;

-- Equivalente de current_user_has_permission para el trabajo interno sin sesión de usuaria.
-- Recorre también padres para que una retirada de permisos bloquee eventos ya encolados.
create function public.push_user_has_permission(checked_user uuid,checked_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  with recursive required as (
    select key,parent_key,active from public.permission_definitions where key=checked_permission
    union
    select p.key,p.parent_key,p.active from public.permission_definitions p join required r on r.parent_key=p.key
  )
  select exists(select 1 from public.profiles p where p.id=checked_user
    and p.is_approved and p.is_active and not p.is_archived
    and (p.is_owner or (exists(select 1 from required) and not exists(
      select 1 from required r where not r.active or not exists(
        select 1 from public.role_permissions g where g.permission_key=r.key and g.enabled and
          ((g.role='coach' and p.is_coach) or (g.role='viewer' and p.is_viewer) or (g.role='player' and p.is_player))
      )
    ))));
$$;

create function public.push_endpoint_allowed(checked_endpoint text)
returns boolean language sql immutable set search_path = '' as $$
  select length(checked_endpoint) <= 2048 and checked_endpoint ~
    '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|[a-z0-9-]+[.]push[.]apple[.]com|[a-z0-9-]+[.]notify[.]windows[.]com)/[^[:space:]]+$';
$$;

create function public.register_push_device(checked_device_key uuid,checked_endpoint text,checked_p256dh text,checked_auth text,checked_topics text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.current_user_has_permission('notifications.push') then raise exception 'No tienes permiso para activar notificaciones'; end if;
  if checked_device_key is null or checked_endpoint is null or not public.push_endpoint_allowed(checked_endpoint)
    or checked_p256dh is null or checked_p256dh !~ '^[A-Za-z0-9_-]{87}$'
    or checked_auth is null or checked_auth !~ '^[A-Za-z0-9_-]{22}$' or checked_topics is null
    or array_position(checked_topics,null) is not null then raise exception 'Suscripción push no válida'; end if;
  -- Bloqueo por cuenta: el límite también se respeta con altas concurrentes.
  perform 1 from public.profiles where id=auth.uid() for update;
  if (select count(*) from public.push_subscriptions where user_id=auth.uid() and device_key<>checked_device_key) >= 10 then
    raise exception 'Has alcanzado el máximo de diez dispositivos. Desactiva uno antes de añadir otro';
  end if;
  if exists(select 1 from public.push_subscriptions where device_key=checked_device_key and user_id<>auth.uid()) then
    raise exception 'Desvincula la cuenta anterior antes de activar las notificaciones';
  end if;
  insert into public.push_subscriptions(user_id,device_key,endpoint,p256dh,auth_key,topics)
    values(auth.uid(),checked_device_key,checked_endpoint,checked_p256dh,checked_auth,checked_topics)
    on conflict(device_key) do update set endpoint=excluded.endpoint,p256dh=excluded.p256dh,
      auth_key=excluded.auth_key,topics=excluded.topics,created_at=clock_timestamp(),updated_at=clock_timestamp();
end;
$$;

create function public.get_own_push_device(checked_device_key uuid)
returns table(topics text[]) language sql stable security definer set search_path = '' as $$
  select s.topics from public.push_subscriptions s where s.device_key=checked_device_key and s.user_id=auth.uid()
    and public.current_user_has_permission('notifications.push');
$$;

create function public.set_own_push_topics(checked_device_key uuid,checked_topics text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.current_user_has_permission('notifications.push') then raise exception 'No tienes permiso para recibir notificaciones'; end if;
  if checked_topics is null or array_position(checked_topics,null) is not null then raise exception 'Preferencias no válidas'; end if;
  update public.push_subscriptions set topics=checked_topics,updated_at=clock_timestamp()
    where device_key=checked_device_key and user_id=auth.uid();
  if not found then raise exception 'Activa primero las notificaciones en este dispositivo'; end if;
end;
$$;

create function public.unregister_push_device(checked_device_key uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where device_key=checked_device_key and user_id=auth.uid();
$$;

create function public.queue_own_push_test(checked_device_key uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare device uuid; event uuid;
begin
  if not public.current_user_has_permission('notifications.push') then raise exception 'No tienes permiso para recibir notificaciones'; end if;
  select id into device from public.push_subscriptions where device_key=checked_device_key and user_id=auth.uid();
  if device is null then raise exception 'Activa primero las notificaciones en este dispositivo'; end if;
  insert into public.push_events(event_key,kind,recipient_id,subscription_id,expires_at)
    values('test:'||auth.uid()::text||':'||to_char(clock_timestamp(),'YYYYMMDDHH24MI'),'test',auth.uid(),device,clock_timestamp()+interval '10 minutes')
    on conflict(event_key) do nothing returning id into event;
  if event is null then raise exception 'Espera un minuto antes de solicitar otra prueba'; end if;
  insert into public.push_deliveries(event_id,subscription_id) values(event,device);
end;
$$;

revoke all on function public.push_user_has_permission(uuid,text),public.push_endpoint_allowed(text) from public,anon,authenticated;
revoke all on function public.register_push_device(uuid,text,text,text,text[]),public.get_own_push_device(uuid),
  public.set_own_push_topics(uuid,text[]),public.unregister_push_device(uuid),public.queue_own_push_test(uuid) from public,anon;
grant execute on function public.register_push_device(uuid,text,text,text,text[]),public.get_own_push_device(uuid),
  public.set_own_push_topics(uuid,text[]),public.unregister_push_device(uuid),public.queue_own_push_test(uuid) to authenticated;

commit;
