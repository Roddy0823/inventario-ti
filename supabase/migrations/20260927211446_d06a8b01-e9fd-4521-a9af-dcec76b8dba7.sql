create type public.app_role as enum ('admin','auxiliar','empleado');
create type public.app_permiso as enum ('equipos_editar','empleados_editar','cargas_masivas','actas_entrega','actas_devolucion','firmas_capturar','repositorio_ver','reportes_exportar');
create type public.catalogo_tipo as enum ('marca','tipo_equipo','sede','area','empresa');
create type public.equipo_estado as enum ('disponible','asignado','en_reparacion','de_baja');
create type public.acta_tipo as enum ('entrega','devolucion');
create type public.acta_estado as enum ('pendiente','firmada','anulada');

create or replace function public.update_updated_at_column() returns trigger language plpgsql set search_path=public as $$
begin new.updated_at = now(); return new; end $$;

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  email text not null default '',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create table public.user_permisos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  permiso public.app_permiso not null,
  created_at timestamptz not null default now(),
  unique (user_id, permiso)
);
grant select on public.user_permisos to authenticated;
grant all on public.user_permisos to service_role;
alter table public.user_permisos enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role) returns boolean
language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;
create or replace function public.is_active(_user_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.profiles where id=_user_id and activo)
$$;
create or replace function public.is_staff(_user_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select public.is_active(_user_id) and exists (select 1 from public.user_roles where user_id=_user_id and role in ('admin','auxiliar'))
$$;
create or replace function public.has_permiso(_user_id uuid, _p public.app_permiso) returns boolean
language sql stable security definer set search_path=public as $$
  select public.is_active(_user_id) and (
    public.has_role(_user_id,'admin') or
    (public.has_role(_user_id,'auxiliar') and exists (select 1 from public.user_permisos where user_id=_user_id and permiso=_p))
  )
$$;

create policy "Ver perfil propio o personal" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff(auth.uid()));
create policy "Ver roles propios o admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "Ver permisos propios o admin" on public.user_permisos for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id, email, nombre) values (new.id, coalesce(new.email,''), coalesce(new.raw_user_meta_data->>'nombre', ''))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- catalogos
create table public.catalogo_items (
  id uuid primary key default gen_random_uuid(),
  tipo public.catalogo_tipo not null,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tipo, nombre)
);
grant select, insert, update, delete on public.catalogo_items to authenticated;
grant all on public.catalogo_items to service_role;
alter table public.catalogo_items enable row level security;
create policy "Catalogos visibles" on public.catalogo_items for select to authenticated using (true);
create policy "Admin crea catalogos" on public.catalogo_items for insert to authenticated with check (public.has_role(auth.uid(),'admin') and public.is_active(auth.uid()));
create policy "Admin edita catalogos" on public.catalogo_items for update to authenticated using (public.has_role(auth.uid(),'admin') and public.is_active(auth.uid()));
create policy "Admin elimina catalogos" on public.catalogo_items for delete to authenticated using (public.has_role(auth.uid(),'admin') and public.is_active(auth.uid()));

-- empleados
create table public.empleados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  identificacion text not null unique,
  email text,
  cargo text,
  area_id uuid references public.catalogo_items(id) on delete restrict,
  sede_id uuid references public.catalogo_items(id) on delete restrict,
  empresa_id uuid references public.catalogo_items(id) on delete restrict,
  activo boolean not null default true,
  user_id uuid unique references auth.users(id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.empleados to authenticated;
grant all on public.empleados to service_role;
alter table public.empleados enable row level security;

create or replace function public.my_empleado_id() returns uuid
language sql stable security definer set search_path=public as $$
  select id from public.empleados where user_id = auth.uid() limit 1
$$;

create policy "Ver empleados" on public.empleados for select to authenticated
  using (public.is_staff(auth.uid()) or user_id = auth.uid());
create policy "Crear empleados" on public.empleados for insert to authenticated
  with check (public.has_permiso(auth.uid(),'empleados_editar'));
create policy "Editar empleados" on public.empleados for update to authenticated
  using (public.has_permiso(auth.uid(),'empleados_editar'));

-- equipos
create sequence public.periferico_seq;
create table public.equipos (
  id uuid primary key default gen_random_uuid(),
  tipo_id uuid not null references public.catalogo_items(id) on delete restrict,
  marca_id uuid references public.catalogo_items(id) on delete restrict,
  sede_id uuid references public.catalogo_items(id) on delete restrict,
  modelo text,
  serie text not null unique,
  codigo_interno boolean not null default false,
  fecha_ingreso date not null default current_date,
  estado public.equipo_estado not null default 'disponible',
  observaciones text,
  proveedor text,
  garantia_fin date,
  factura_path text,
  empleado_id uuid references public.empleados(id) on delete restrict,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.equipos to authenticated;
grant all on public.equipos to service_role;
alter table public.equipos enable row level security;
create policy "Ver equipos" on public.equipos for select to authenticated
  using (public.is_staff(auth.uid()) or (empleado_id is not null and empleado_id = public.my_empleado_id()));
create policy "Crear equipos" on public.equipos for insert to authenticated
  with check (public.has_permiso(auth.uid(),'equipos_editar'));
create policy "Editar equipos" on public.equipos for update to authenticated
  using (public.has_permiso(auth.uid(),'equipos_editar'));

create or replace function public.equipos_before_insert() returns trigger language plpgsql set search_path=public as $$
begin
  if new.serie is null or btrim(new.serie) = '' then
    new.serie := 'FIN-ACC-' || lpad(nextval('public.periferico_seq')::text, 4, '0');
    new.codigo_interno := true;
  else
    new.serie := upper(btrim(new.serie));
  end if;
  if new.estado not in ('disponible','en_reparacion') then
    raise exception 'Un equipo nuevo solo puede registrarse como Disponible o En reparación';
  end if;
  new.empleado_id := null;
  return new;
end $$;
create trigger equipos_bi before insert on public.equipos for each row execute function public.equipos_before_insert();

create or replace function public.equipos_before_update() returns trigger language plpgsql set search_path=public as $$
begin
  if new.serie is distinct from old.serie and coalesce(current_setting('app.serie_ok', true),'') <> '1' then
    raise exception 'El número de serie no se puede modificar. Solo el Administrador puede corregirlo indicando un motivo.';
  end if;
  if (new.estado is distinct from old.estado or new.empleado_id is distinct from old.empleado_id)
     and coalesce(current_setting('app.estado_ok', true),'') <> '1' then
    raise exception 'El estado del equipo solo cambia mediante actas firmadas o con un motivo registrado.';
  end if;
  return new;
end $$;
create trigger equipos_bu before update on public.equipos for each row execute function public.equipos_before_update();

-- historial
create table public.equipo_historial (
  id uuid primary key default gen_random_uuid(),
  equipo_id uuid not null references public.equipos(id) on delete cascade,
  evento text not null,
  detalle text,
  acta_id uuid,
  user_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);
grant select on public.equipo_historial to authenticated;
grant all on public.equipo_historial to service_role;
alter table public.equipo_historial enable row level security;
create policy "Personal ve historial" on public.equipo_historial for select to authenticated using (public.is_staff(auth.uid()));

create or replace function public.equipos_after_insert() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.equipo_historial(equipo_id, evento, detalle) values (new.id, 'ingreso', 'Registro del equipo con estado ' || new.estado);
  return new;
end $$;
create trigger equipos_ai after insert on public.equipos for each row execute function public.equipos_after_insert();

-- paz y salvo
create or replace function public.empleados_before_update() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.activo and not new.activo then
    if exists (select 1 from public.equipos where empleado_id = new.id and estado = 'asignado') then
      raise exception 'PAZ_Y_SALVO: El empleado tiene equipos asignados. Realice primero el acta de devolución.';
    end if;
  end if;
  return new;
end $$;
create trigger empleados_bu before update on public.empleados for each row execute function public.empleados_before_update();

-- actas
create table public.actas (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  tipo public.acta_tipo not null,
  estado public.acta_estado not null default 'pendiente',
  empleado_id uuid not null references public.empleados(id) on delete restrict,
  tecnico_id uuid not null default auth.uid(),
  tecnico_nombre text,
  observaciones text,
  firmado_at timestamptz,
  firma_ip text,
  firma_user_agent text,
  firma_medio text,
  firma_path text,
  pdf_path text,
  anulada_motivo text,
  anulada_por uuid,
  anulada_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert on public.actas to authenticated;
grant all on public.actas to service_role;
alter table public.actas enable row level security;
create policy "Ver actas" on public.actas for select to authenticated
  using (public.is_staff(auth.uid()) or empleado_id = public.my_empleado_id());
create policy "Crear actas" on public.actas for insert to authenticated
  with check (
    tecnico_id = auth.uid() and estado = 'pendiente' and
    ((tipo='entrega' and public.has_permiso(auth.uid(),'actas_entrega')) or
     (tipo='devolucion' and public.has_permiso(auth.uid(),'actas_devolucion')))
  );

create or replace function public.actas_before_insert() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.tipo = 'entrega' and not exists (select 1 from public.empleados where id = new.empleado_id and activo) then
    raise exception 'No se puede entregar equipos a un empleado inactivo.';
  end if;
  new.estado := 'pendiente';
  new.firmado_at := null; new.pdf_path := null; new.firma_path := null;
  select coalesce(nullif(nombre,''), email) into new.tecnico_nombre from public.profiles where id = new.tecnico_id;
  return new;
end $$;
create trigger actas_bi before insert on public.actas for each row execute function public.actas_before_insert();

create table public.acta_items (
  id uuid primary key default gen_random_uuid(),
  acta_id uuid not null references public.actas(id) on delete cascade,
  equipo_id uuid not null references public.equipos(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (acta_id, equipo_id)
);
grant select, insert on public.acta_items to authenticated;
grant all on public.acta_items to service_role;
alter table public.acta_items enable row level security;
create policy "Ver items de actas visibles" on public.acta_items for select to authenticated
  using (exists (select 1 from public.actas a where a.id = acta_id and (public.is_staff(auth.uid()) or a.empleado_id = public.my_empleado_id())));
create policy "Agregar items a acta propia pendiente" on public.acta_items for insert to authenticated
  with check (exists (select 1 from public.actas a where a.id = acta_id and a.tecnico_id = auth.uid() and a.estado = 'pendiente'));

create or replace function public.acta_items_before_insert() returns trigger language plpgsql security definer set search_path=public as $$
declare a public.actas; e public.equipos;
begin
  select * into a from public.actas where id = new.acta_id;
  select * into e from public.equipos where id = new.equipo_id;
  if a.tipo = 'entrega' and e.estado <> 'disponible' then
    raise exception 'El equipo % no está Disponible.', e.serie;
  end if;
  if a.tipo = 'devolucion' and (e.estado <> 'asignado' or e.empleado_id is distinct from a.empleado_id) then
    raise exception 'El equipo % no está asignado a este empleado.', e.serie;
  end if;
  if exists (select 1 from public.acta_items i join public.actas x on x.id = i.acta_id
             where i.equipo_id = new.equipo_id and x.estado = 'pendiente' and x.id <> new.acta_id) then
    raise exception 'El equipo % ya está en otra acta pendiente de firma.', e.serie;
  end if;
  return new;
end $$;
create trigger acta_items_bi before insert on public.acta_items for each row execute function public.acta_items_before_insert();

create or replace function public.actas_before_update() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.estado <> 'pendiente' and new.estado is distinct from old.estado then
    raise exception 'Un acta firmada o anulada no puede cambiar de estado (salvo anulación).'
      using hint = 'use anular_acta';
  end if;
  return new;
end $$;

create or replace function public.actas_after_update() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.estado = 'firmada' and old.estado = 'pendiente' then
    perform set_config('app.estado_ok','1', true);
    if new.tipo = 'entrega' then
      update public.equipos set estado='asignado', empleado_id=new.empleado_id
        where id in (select equipo_id from public.acta_items where acta_id = new.id);
    else
      update public.equipos set estado='disponible', empleado_id=null
        where id in (select equipo_id from public.acta_items where acta_id = new.id);
    end if;
    insert into public.equipo_historial(equipo_id, evento, detalle, acta_id, user_id)
      select i.equipo_id, new.tipo::text, 'Acta #' || new.numero || ' firmada (' || coalesce(new.firma_medio,'') || ')', new.id, new.tecnico_id
      from public.acta_items i where i.acta_id = new.id;
    perform set_config('app.estado_ok','', true);
  end if;
  return new;
end $$;
create trigger actas_au after update on public.actas for each row execute function public.actas_after_update();

-- tokens de firma remota (solo servidor)
create table public.tokens_firma (
  id uuid primary key default gen_random_uuid(),
  acta_id uuid not null references public.actas(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
grant all on public.tokens_firma to service_role;
alter table public.tokens_firma enable row level security;

-- auditoria
create table public.auditoria (
  id bigint generated always as identity primary key,
  user_id uuid,
  tabla text not null,
  accion text not null,
  registro_id text,
  antes jsonb,
  despues jsonb,
  detalle text,
  created_at timestamptz not null default now()
);
grant select on public.auditoria to authenticated;
grant all on public.auditoria to service_role;
alter table public.auditoria enable row level security;
create policy "Admin ve auditoria" on public.auditoria for select to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.audit_trigger() returns trigger language plpgsql security definer set search_path=public as $$
declare rid text;
begin
  if tg_op = 'DELETE' then rid := old.id::text; else rid := new.id::text; end if;
  insert into public.auditoria(user_id, tabla, accion, registro_id, antes, despues)
  values (auth.uid(), tg_table_name, tg_op, rid,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger audit_profiles after insert or update or delete on public.profiles for each row execute function public.audit_trigger();
create trigger audit_user_roles after insert or update or delete on public.user_roles for each row execute function public.audit_trigger();
create trigger audit_user_permisos after insert or update or delete on public.user_permisos for each row execute function public.audit_trigger();
create trigger audit_catalogo after insert or update or delete on public.catalogo_items for each row execute function public.audit_trigger();
create trigger audit_empleados after insert or update or delete on public.empleados for each row execute function public.audit_trigger();
create trigger audit_equipos after insert or update or delete on public.equipos for each row execute function public.audit_trigger();
create trigger audit_actas after insert or update or delete on public.actas for each row execute function public.audit_trigger();
create trigger audit_acta_items after insert or update or delete on public.acta_items for each row execute function public.audit_trigger();
create trigger audit_tokens after insert or update or delete on public.tokens_firma for each row execute function public.audit_trigger();

create or replace function public.auditoria_inmutable() returns trigger language plpgsql as $$
begin raise exception 'La auditoría no puede modificarse ni eliminarse'; end $$;
create trigger auditoria_no_update before update or delete on public.auditoria for each row execute function public.auditoria_inmutable();

-- updated_at triggers
create trigger t_upd_profiles before update on public.profiles for each row execute function public.update_updated_at_column();
create trigger t_upd_catalogo before update on public.catalogo_items for each row execute function public.update_updated_at_column();
create trigger t_upd_empleados before update on public.empleados for each row execute function public.update_updated_at_column();
create trigger t_upd_equipos before update on public.equipos for each row execute function public.update_updated_at_column();
create trigger t_upd_actas before update on public.actas for each row execute function public.update_updated_at_column();

-- RPCs
create or replace function public.log_evento(p_accion text, p_detalle text default null) returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.auditoria(user_id, tabla, accion, detalle) values (auth.uid(), 'sesion', left(p_accion, 50), left(p_detalle, 500));
end $$;

create or replace function public.corregir_serie(p_equipo uuid, p_serie text, p_motivo text) returns void
language plpgsql security definer set search_path=public as $$
declare old_serie text;
begin
  if not (public.has_role(auth.uid(),'admin') and public.is_active(auth.uid())) then raise exception 'Solo el Administrador puede corregir series'; end if;
  if coalesce(btrim(p_motivo),'') = '' then raise exception 'El motivo es obligatorio'; end if;
  if coalesce(btrim(p_serie),'') = '' then raise exception 'La serie no puede estar vacía'; end if;
  select serie into old_serie from public.equipos where id = p_equipo;
  perform set_config('app.serie_ok','1', true);
  update public.equipos set serie = upper(btrim(p_serie)) where id = p_equipo;
  perform set_config('app.serie_ok','', true);
  insert into public.equipo_historial(equipo_id, evento, detalle) values (p_equipo, 'correccion_serie', old_serie || ' → ' || upper(btrim(p_serie)) || '. Motivo: ' || p_motivo);
end $$;

create or replace function public.cambiar_estado_equipo(p_equipo uuid, p_estado public.equipo_estado, p_motivo text) returns void
language plpgsql security definer set search_path=public as $$
declare e public.equipos;
begin
  if not public.has_permiso(auth.uid(),'equipos_editar') then raise exception 'Sin permiso'; end if;
  if coalesce(btrim(p_motivo),'') = '' then raise exception 'El motivo es obligatorio'; end if;
  if p_estado = 'asignado' then raise exception 'Asignado solo se obtiene con un acta de entrega firmada'; end if;
  if p_estado = 'de_baja' and not public.has_role(auth.uid(),'admin') then raise exception 'Solo el Administrador puede dar de baja equipos'; end if;
  select * into e from public.equipos where id = p_equipo;
  if e.estado = 'asignado' then raise exception 'El equipo está asignado; realice primero el acta de devolución'; end if;
  if e.estado = 'de_baja' then raise exception 'El equipo ya está dado de baja'; end if;
  perform set_config('app.estado_ok','1', true);
  update public.equipos set estado = p_estado where id = p_equipo;
  perform set_config('app.estado_ok','', true);
  insert into public.equipo_historial(equipo_id, evento, detalle) values (p_equipo, p_estado::text, 'Motivo: ' || p_motivo);
end $$;

create or replace function public.anular_acta(p_acta uuid, p_motivo text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not (public.has_role(auth.uid(),'admin') and public.is_active(auth.uid())) then raise exception 'Solo el Administrador puede anular actas'; end if;
  if coalesce(btrim(p_motivo),'') = '' then raise exception 'El motivo es obligatorio'; end if;
  update public.actas set estado='anulada', anulada_motivo=p_motivo, anulada_por=auth.uid(), anulada_at=now()
    where id = p_acta and estado <> 'anulada';
  update public.tokens_firma set used_at = now() where acta_id = p_acta and used_at is null;
  insert into public.equipo_historial(equipo_id, evento, detalle, acta_id)
    select equipo_id, 'acta_anulada', 'Motivo: ' || p_motivo, p_acta from public.acta_items where acta_id = p_acta;
end $$;

-- allow anulada transitions from firmada only via anular_acta: relax before-update to allow 'anulada'
create or replace function public.actas_before_update() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.estado = 'anulada' and new.estado is distinct from old.estado then
    raise exception 'Un acta anulada no puede cambiar de estado';
  end if;
  if old.estado = 'firmada' and new.estado not in ('firmada','anulada') then
    raise exception 'Un acta firmada solo puede anularse';
  end if;
  return new;
end $$;
create trigger actas_bu before update on public.actas for each row execute function public.actas_before_update();

grant execute on function public.log_evento(text, text) to authenticated;
grant execute on function public.corregir_serie(uuid, text, text) to authenticated;
grant execute on function public.cambiar_estado_equipo(uuid, public.equipo_estado, text) to authenticated;
grant execute on function public.anular_acta(uuid, text) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.has_permiso(uuid, public.app_permiso) to authenticated;
grant execute on function public.is_staff(uuid) to authenticated;
revoke execute on function public.log_evento(text, text) from anon;
revoke execute on function public.corregir_serie(uuid, text, text) from anon;
revoke execute on function public.cambiar_estado_equipo(uuid, public.equipo_estado, text) from anon;
revoke execute on function public.anular_acta(uuid, text) from anon;
