-- Ejecutar después de 097 con postgres. Credenciales y despliegue: docs/web-push.md.
begin;

create function public.push_member_on(checked_user uuid,checked_season uuid,checked_date date)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.season_players sp join public.seasons s on s.id=sp.season_id
    join public.profiles p on p.id=sp.player_id
    where sp.player_id=checked_user and sp.season_id=checked_season and p.is_player
      and p.is_approved and p.is_active and not p.is_archived
      and checked_date between s.start_date and s.end_date
      and sp.active_from<=checked_date and (sp.active_until is null or sp.active_until>=checked_date));
$$;

create function public.push_staff_match_scope(checked_user uuid,checked_match uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.push_user_has_permission(checked_user,'matches.view') and exists(
    select 1 from public.profiles p join public.matches m on m.id=checked_match
    where p.id=checked_user and (p.is_owner or (p.is_viewer and m.status<>'draft') or (p.is_coach and exists(
      select 1 from public.season_team_coaches assignment join public.season_teams assigned on assigned.id=assignment.season_team_id
      left join public.season_teams target on target.id=m.team_id
      where assignment.coach_id=p.id and (assignment.season_team_id=m.team_id or (target.is_mixed and assigned.season_id=m.season_id))
    )))
  );
$$;

create function public.push_availability_pending(checked_user uuid,checked_match uuid)
returns boolean language sql volatile security definer set search_path = '' as $$
  select public.push_user_has_permission(checked_user,'matches.availability_own') and exists(
    select 1 from public.matches m where m.id=checked_match and m.status='published' and not m.lineup_published
      and m.match_date >= (now() at time zone 'Europe/Madrid')::date
      and public.player_can_access_match(m.id,checked_user)
      and public.player_license_allows_availability(m.id,checked_user)
      and not public.player_has_absence_on(checked_user,m.match_date)
      and not exists(select 1 from public.match_fixture_availability(m.id) a where a.player_id=checked_user)
      and not exists(select 1 from public.matches related where related.internal_fixture_id=m.internal_fixture_id and related.lineup_published)
      and not exists(select 1 from public.matches other_match
        cross join lateral public.match_participation_player_ids(other_match.id) reserved
        where other_match.id<>m.id and other_match.status<>'cancelled' and reserved.player_id=checked_user
          and public.match_participation_window(other_match.match_date)=public.match_participation_window(m.match_date))
      and exists(select 1 from public.player_availability_opportunities(m.season_id,checked_user) opportunity where opportunity.match_id=m.id)
  );
$$;

create function public.push_training_pending(checked_user uuid,checked_plan uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.push_user_has_permission(checked_user,'calendar.training_respond') and exists(
    select 1 from public.training_plans p where p.id=checked_plan and p.status<>'cancelled'
      and public.push_member_on(checked_user,p.season_id,p.session_date)
      and (p.session_date+p.end_time) at time zone 'Europe/Madrid'>now()
      and not exists(select 1 from public.season_holidays h where h.season_id=p.season_id and h.holiday_date=p.session_date)
      and not exists(select 1 from public.training_sessions s where s.session_date=p.session_date)
      and not exists(select 1 from public.training_responses r where r.training_plan_id=p.id and r.player_id=checked_user and r.schedule_version=p.schedule_version)
  );
$$;

create function public.push_event_topic(checked_kind text)
returns text language sql immutable set search_path = '' as $$
  select case checked_kind when 'match_published' then 'matches' when 'match_changed' then 'matches'
    when 'lineup' then 'lineups' when 'announcement' then 'announcements' when 'training_group' then 'training_groups'
    when 'availability_reminder' then 'availability_reminders' when 'availability_digest' then 'availability_digest'
    when 'training_changed' then 'training_changes' when 'training_reminder' then 'training_reminders' end;
$$;

-- Se utiliza al encolar y se vuelve a evaluar al reclamar cada entrega.
create function public.push_event_allowed(checked_event uuid,checked_subscription uuid)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare e public.push_events; s public.push_subscriptions; m public.matches; t public.training_plans;
begin
  select * into e from public.push_events where id=checked_event;
  select * into s from public.push_subscriptions where id=checked_subscription;
  if e.id is null or s.id is null or e.expires_at<=clock_timestamp() or s.created_at>e.created_at
    or not public.push_user_has_permission(s.user_id,'notifications.push')
    or (e.recipient_id is not null and e.recipient_id<>s.user_id)
    or (e.subscription_id is not null and e.subscription_id<>s.id) then return false; end if;
  if e.kind='test' then return true; end if;
  if not (public.push_event_topic(e.kind)=any(s.topics)) then return false; end if;
  if not exists(select 1 from public.seasons season where season.id=e.season_id
    and season.end_date>=(now() at time zone 'Europe/Madrid')::date) then return false; end if;
  if e.kind in ('match_changed','lineup','training_changed','training_group') and exists(
    select 1 from public.push_events newer where newer.source_id=e.source_id and newer.kind=e.kind and newer.created_at>e.created_at
  ) then return false; end if;

  if e.kind in ('match_published','match_changed','lineup','availability_reminder','availability_digest') then
    select * into m from public.matches where id=e.source_id;
    if m.id is null or m.status not in ('published','cancelled') or m.season_id<>e.season_id
      or m.match_date<>e.target_date or m.match_date<(now() at time zone 'Europe/Madrid')::date then return false; end if;
    if e.kind='availability_reminder' then return public.push_availability_pending(s.user_id,m.id); end if;
    if e.kind='availability_digest' then return m.status='published' and public.push_staff_match_scope(s.user_id,m.id)
      and public.push_user_has_permission(s.user_id,'matches.availability_team')
      and exists(select 1 from public.profiles p where p.id=s.user_id and (p.is_owner or p.is_coach)); end if;
    if e.kind='lineup' and (not m.lineup_published or m.status<>'published'
      or not public.push_user_has_permission(s.user_id,'matches.lineup_view')) then return false; end if;
    if e.kind='match_published' and m.status<>'published' then return false; end if;
    return public.push_user_has_permission(s.user_id,'matches.view') and (
      public.push_staff_match_scope(s.user_id,m.id) or public.push_member_on(s.user_id,m.season_id,m.match_date)
      or (e.previous_date is not null and public.push_member_on(s.user_id,m.season_id,e.previous_date))
    );
  elsif e.kind='announcement' then
    return exists(select 1 from public.team_announcements a where a.id=e.source_id and a.status='published'
      and a.season_id=e.season_id and (public.push_user_has_permission(s.user_id,'announcements.view_team')
        or (public.push_user_has_permission(s.user_id,'announcements.view') and public.push_member_on(s.user_id,a.season_id,a.announcement_date))));
  elsif e.kind='training_group' then
    return public.push_user_has_permission(s.user_id,'training_groups.view') and exists(
      select 1 from public.training_group_blocks b join public.training_group_members member on member.block_id=b.id
      where b.id=e.source_id and b.status='published' and member.player_id=s.user_id
        and public.push_member_on(s.user_id,b.season_id,greatest(b.starts_on,(now() at time zone 'Europe/Madrid')::date))
        and exists(select 1 from public.training_group_roster(b.season_id,greatest(b.starts_on,(now() at time zone 'Europe/Madrid')::date)) r where r.player_id=s.user_id));
  elsif e.kind in ('training_changed','training_reminder') then
    select * into t from public.training_plans where id=e.source_id;
    if t.id is null or t.season_id<>e.season_id or t.session_date<>e.target_date
      or (t.session_date+t.end_time) at time zone 'Europe/Madrid'<=now() then return false; end if;
    if e.kind='training_reminder' then return public.push_training_pending(s.user_id,t.id); end if;
    return public.push_user_has_permission(s.user_id,'training.view')
      or (public.push_user_has_permission(s.user_id,'calendar.training_view') and (
        public.push_member_on(s.user_id,t.season_id,t.session_date)
        or (e.previous_date is not null and public.push_member_on(s.user_id,t.season_id,e.previous_date))));
  end if;
  return false;
end;
$$;

create function public.enqueue_push_event(checked_key text,checked_kind text,checked_source uuid,checked_season uuid,
  checked_date date,checked_previous_date date default null,checked_recipient uuid default null,checked_delay interval default interval '0')
returns void language plpgsql security definer set search_path = '' as $$
declare event uuid;
begin
  if not exists(select 1 from public.push_subscriptions) then return; end if;
  insert into public.push_events(event_key,kind,source_id,season_id,target_date,previous_date,recipient_id,available_at)
    values(checked_key,checked_kind,checked_source,checked_season,checked_date,checked_previous_date,checked_recipient,clock_timestamp()+checked_delay)
    on conflict(event_key) do nothing returning id into event;
  if event is null then return; end if;
  insert into public.push_deliveries(event_id,subscription_id)
    select event,s.id from public.push_subscriptions s where public.push_event_allowed(event,s.id)
    on conflict do nothing;
end;
$$;

create function public.capture_push_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare key text;
begin
  key := tg_table_name||':'||new.id::text||':'||txid_current()::text;
  if tg_table_name='matches' then
    if new.match_date<(now() at time zone 'Europe/Madrid')::date then return new; end if;
    if new.status='published' and (tg_op='INSERT' or old.status<>'published') then
      perform public.enqueue_push_event(key||':published','match_published',new.id,new.season_id,new.match_date);
    elsif tg_op='UPDATE' and old.status='published' and new.status in ('published','cancelled') and
      (new.status,new.match_date,new.kickoff_time,new.venue,new.callup_time,new.callup_venue,new.opponent,new.team_id,new.is_home)
      is distinct from (old.status,old.match_date,old.kickoff_time,old.venue,old.callup_time,old.callup_venue,old.opponent,old.team_id,old.is_home) then
      perform public.enqueue_push_event(key||':changed','match_changed',new.id,new.season_id,new.match_date,old.match_date);
    end if;
    if new.status='published' and new.lineup_published and (tg_op='INSERT' or not old.lineup_published) then
      perform public.enqueue_push_event('lineup:'||new.id::text||':'||txid_current()::text,'lineup',new.id,new.season_id,new.match_date);
    end if;
  elsif tg_table_name='team_announcements' then
    if new.status='published' and (tg_op='INSERT' or old.status<>'published')
      and new.announcement_date>=(now() at time zone 'Europe/Madrid')::date then
      perform public.enqueue_push_event(key,'announcement',new.id,new.season_id,new.announcement_date);
    end if;
  elsif tg_table_name='training_group_blocks' then
    if new.status='published' and (tg_op='INSERT' or new.published_at is distinct from old.published_at) then
      perform public.enqueue_push_event(key,'training_group',new.id,new.season_id,new.starts_on);
    end if;
  elsif tg_table_name='training_plans' and tg_op='UPDATE' then
    if greatest(new.session_date,old.session_date)>=(now() at time zone 'Europe/Madrid')::date and
      (new.session_date,new.start_time,new.end_time,new.status='cancelled')
      is distinct from (old.session_date,old.start_time,old.end_time,old.status='cancelled') then
      perform public.enqueue_push_event(key,'training_changed',new.id,new.season_id,new.session_date,old.session_date);
    end if;
  end if;
  return new;
end;
$$;
-- Separado: match_lineup y match_availability no tienen columna id.
create function public.capture_push_match_detail()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target public.matches; checked_match uuid;
begin
  if tg_op='UPDATE' then
    if tg_table_name='match_availability' then
      if (new.status,new.comment) is not distinct from (old.status,old.comment) then return new; end if;
    elsif tg_table_name='match_lineup' then
      if (new.player_id,new.role,new.position,new.slot_number,new.sort_order)
        is not distinct from (old.player_id,old.role,old.position,old.slot_number,old.sort_order) then return new; end if;
    end if;
  end if;
  checked_match := case when tg_op='DELETE' then old.match_id else new.match_id end;
  select * into target from public.matches where id=checked_match;
  if target.status='published' and target.match_date>=(now() at time zone 'Europe/Madrid')::date then
    if tg_table_name='match_lineup' and target.lineup_published then
      perform public.enqueue_push_event('lineup:'||target.id::text||':'||txid_current()::text,'lineup',target.id,target.season_id,target.match_date);
    elsif tg_table_name='match_availability' then
      perform public.enqueue_push_event('availability:'||target.id::text||':'||floor(extract(epoch from clock_timestamp())/900)::text,
        'availability_digest',target.id,target.season_id,target.match_date,null,null,interval '15 minutes');
    end if;
  end if;
  return null;
end;
$$;

create trigger push_matches after insert or update on public.matches for each row execute function public.capture_push_event();
create trigger push_announcements after insert or update on public.team_announcements for each row execute function public.capture_push_event();
create trigger push_training_groups after insert or update on public.training_group_blocks for each row execute function public.capture_push_event();
create trigger push_training_changes after update on public.training_plans for each row execute function public.capture_push_event();
create trigger push_lineup after insert or update or delete on public.match_lineup for each row execute function public.capture_push_match_detail();
create trigger push_availability after insert or update or delete on public.match_availability for each row execute function public.capture_push_match_detail();

create function public.prepare_push_reminders()
returns void language plpgsql security definer set search_path = '' as $$
declare local_now timestamp := clock_timestamp() at time zone 'Europe/Madrid'; m record; p record;
begin
  if not exists(select 1 from public.push_subscriptions) then return; end if;
  -- Solo de mañana: no recuperar recordatorios antiguos al día siguiente.
  if local_now::time < time '09:00' or local_now::time >= time '12:00' then return; end if;
  if extract(isodow from local_now) in (1,3) then
    for m in select * from public.matches where status='published' and not lineup_published
      and match_date>=local_now::date and date_trunc('week',match_date::timestamp)=date_trunc('week',local_now)
    loop
      perform public.enqueue_push_event('availability-reminder:'||m.id::text||':'||local_now::date::text,
        'availability_reminder',m.id,m.season_id,m.match_date);
    end loop;
  end if;
  for p in select * from public.training_plans where session_date=local_now::date and status<>'cancelled'
    and start_time>time '12:00'
  loop
    perform public.enqueue_push_event('training-reminder:'||p.id::text||':'||p.schedule_version::text||':'||local_now::date::text,
      'training_reminder',p.id,p.season_id,p.session_date);
  end loop;
  update public.push_events set expires_at=(local_now::date+time '20:00') at time zone 'Europe/Madrid'
    where kind in ('availability_reminder','training_reminder') and (created_at at time zone 'Europe/Madrid')::date=local_now::date
      and expires_at>((local_now::date+time '20:00') at time zone 'Europe/Madrid');
end;
$$;

create function public.claim_push_deliveries(checked_limit integer default 30)
returns table(delivery_id bigint,lease uuid,endpoint text,p256dh text,auth_key text,user_id uuid,event_id uuid,
  kind text,target_date date,source_id uuid,target_view text,expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare job record; token uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Solo el servicio interno puede enviar push'; end if;
  for job in select d.id,d.event_id,d.subscription_id from public.push_deliveries d
    join public.push_events e on e.id=d.event_id
    where d.finished_at is null and d.attempts<5 and d.next_attempt_at<=clock_timestamp()
      and (d.locked_until is null or d.locked_until<clock_timestamp()) and e.available_at<=clock_timestamp()
    order by d.next_attempt_at,d.id for update of d skip locked limit least(greatest(checked_limit,1),30)
  loop
    if not public.push_event_allowed(job.event_id,job.subscription_id) then
      update public.push_deliveries set finished_at=clock_timestamp() where id=job.id;
      continue;
    end if;
    token := gen_random_uuid();
    update public.push_deliveries set lease_token=token,locked_until=clock_timestamp()+interval '3 minutes',attempts=attempts+1 where id=job.id;
    return query select job.id,token,s.endpoint,s.p256dh,s.auth_key,s.user_id,e.id,e.kind,e.target_date,e.source_id,
      case when e.kind='training_group' then 'training-groups' when e.kind='test' then 'home'
        when e.kind in ('match_published','match_changed','lineup','availability_reminder','availability_digest')
          and not (p.is_owner or p.is_coach or p.is_player) then 'matches' else 'calendar' end,
      e.expires_at
      from public.push_subscriptions s join public.push_events e on e.id=job.event_id
      join public.profiles p on p.id=s.user_id where s.id=job.subscription_id;
  end loop;
end;
$$;

create function public.finish_push_delivery(checked_delivery bigint,checked_lease uuid,checked_status integer)
returns void language plpgsql security definer set search_path = '' as $$
declare job public.push_deliveries;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Solo el servicio interno puede finalizar push'; end if;
  select * into job from public.push_deliveries where id=checked_delivery and lease_token=checked_lease for update;
  if job.id is null then return; end if;
  if checked_status in (404,410) then
    delete from public.push_subscriptions where id=job.subscription_id;
    return;
  end if;
  update public.push_deliveries set last_status=checked_status,lease_token=null,locked_until=null,
    finished_at=case when checked_status between 200 and 299 or attempts>=5
      or checked_status in (400,401,403,413,422) then clock_timestamp() else null end,
    next_attempt_at=clock_timestamp()+make_interval(mins=>least(60,(power(2,job.attempts))::integer))
    where id=job.id;
end;
$$;

-- Solo Cron utiliza Vault y pg_net. Sin credenciales no se realiza ninguna llamada.
create extension if not exists pg_net with schema extensions;
create function public.dispatch_push_notifications()
returns void language plpgsql security definer set search_path = '' as $$
declare function_url text; dispatch_secret text; pending integer; batch integer;
begin
  -- Evita procesadores concurrentes y limita el histórico a 30 días.
  if not pg_try_advisory_xact_lock(hashtextextended('unizar-web-push-dispatch',0)) then return; end if;
  delete from public.push_events where expires_at<clock_timestamp()-interval '30 days';
  update public.push_deliveries set finished_at=clock_timestamp()
    where finished_at is null and (attempts>=5 or exists(select 1 from public.push_events e where e.id=event_id and e.expires_at<=clock_timestamp()));
  perform public.prepare_push_reminders();
  select count(*) into pending from public.push_deliveries d join public.push_events e on e.id=d.event_id
    where d.finished_at is null and d.next_attempt_at<=clock_timestamp() and e.available_at<=clock_timestamp()
      and (d.locked_until is null or d.locked_until<clock_timestamp());
  if pending=0 then return; end if;
  select decrypted_secret into function_url from vault.decrypted_secrets where name='push_function_url';
  select decrypted_secret into dispatch_secret from vault.decrypted_secrets where name='push_dispatch_secret';
  if function_url is null or dispatch_secret is null then return; end if;
  -- La URL solo se configura por postgres en Vault, nunca mediante una RPC pública.
  for batch in 1..least(8,ceil(pending/30.0)::integer) loop
    perform net.http_post(url:=function_url,headers:=jsonb_build_object('Content-Type','application/json','x-push-secret',dispatch_secret),
      body:='{}'::jsonb,timeout_milliseconds:=120000);
  end loop;
end;
$$;

revoke all on function public.push_member_on(uuid,uuid,date),public.push_staff_match_scope(uuid,uuid),
  public.push_availability_pending(uuid,uuid),public.push_training_pending(uuid,uuid),public.push_event_topic(text),
  public.push_event_allowed(uuid,uuid),public.enqueue_push_event(text,text,uuid,uuid,date,date,uuid,interval),
  public.capture_push_event(),public.capture_push_match_detail(),public.prepare_push_reminders(),
  public.dispatch_push_notifications(),public.claim_push_deliveries(integer),public.finish_push_delivery(bigint,uuid,integer)
  from public,anon,authenticated;
grant execute on function public.claim_push_deliveries(integer),public.finish_push_delivery(bigint,uuid,integer) to service_role;

-- pg_cron ya se instaló en 090. Máximo habitual: cinco minutos hasta el envío.
select cron.schedule('unizar-web-push','*/5 * * * *','select public.dispatch_push_notifications();');

commit;
