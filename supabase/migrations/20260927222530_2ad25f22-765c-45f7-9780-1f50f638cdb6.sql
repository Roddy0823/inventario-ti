alter table public.empleados add column if not exists pin_intentos integer not null default 0, add column if not exists pin_bloqueo_hasta timestamptz;

create or replace function public.equipos_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare cambios text[] := '{}'; det text; ev text; emp_old text; emp_new text;
  x text := nullif(current_setting('app.hist_detalle', true), '');
  acta uuid := nullif(current_setting('app.acta_id', true), '')::uuid;
  evs text := nullif(current_setting('app.hist_evento', true), '');
  function_nombre text;
begin
  if new.estado is distinct from old.estado or new.empleado_id is distinct from old.empleado_id then
    det := '';
    if new.empleado_id is distinct from old.empleado_id then
      select nombre into emp_old from public.empleados where id = old.empleado_id;
      select nombre into emp_new from public.empleados where id = new.empleado_id;
      det := 'Responsable: ' || coalesce(emp_old, 'Sin asignar') || ' → ' || coalesce(emp_new, 'Sin asignar');
    end if;
    if new.estado is distinct from old.estado then
      det := det || case when det <> '' then ' · ' else '' end || 'Estado: ' || old.estado || ' → ' || new.estado;
    end if;
    if x is not null then det := det || ' · ' || x; end if;
    ev := coalesce(evs, case when new.empleado_id is distinct from old.empleado_id then 'asignacion' else new.estado::text end);
    insert into public.equipo_historial(equipo_id, evento, detalle, acta_id) values (new.id, ev, det, acta);
  end if;
  if new.sede_id is distinct from old.sede_id then cambios := cambios || ('Sede: ' || coalesce((select nombre from catalogo_items where id=old.sede_id),'—') || ' → ' || coalesce((select nombre from catalogo_items where id=new.sede_id),'—')); end if;
  if new.marca_id is distinct from old.marca_id then cambios := cambios || ('Marca: ' || coalesce((select nombre from catalogo_items where id=old.marca_id),'—') || ' → ' || coalesce((select nombre from catalogo_items where id=new.marca_id),'—')); end if;
  if new.tipo_id is distinct from old.tipo_id then cambios := cambios || ('Tipo: ' || coalesce((select nombre from catalogo_items where id=old.tipo_id),'—') || ' → ' || coalesce((select nombre from catalogo_items where id=new.tipo_id),'—')); end if;
  if new.modelo is distinct from old.modelo then cambios := cambios || ('Modelo: ' || coalesce(old.modelo,'—') || ' → ' || coalesce(new.modelo,'—')); end if;
  if new.proveedor is distinct from old.proveedor then cambios := cambios || ('Proveedor: ' || coalesce(old.proveedor,'—') || ' → ' || coalesce(new.proveedor,'—')); end if;
  if new.garantia_fin is distinct from old.garantia_fin then cambios := cambios || ('Garantía: ' || coalesce(old.garantia_fin::text,'—') || ' → ' || coalesce(new.garantia_fin::text,'—')); end if;
  if new.activo_fijo is distinct from old.activo_fijo then cambios := cambios || ('Activo fijo: ' || coalesce(old.activo_fijo,'—') || ' → ' || coalesce(new.activo_fijo,'—')); end if;
  if new.nombre_equipo is distinct from old.nombre_equipo then cambios := cambios || ('Nombre de equipo: ' || coalesce(old.nombre_equipo,'—') || ' → ' || coalesce(new.nombre_equipo,'—')); end if;
  if new.sistema_operativo is distinct from old.sistema_operativo then cambios := cambios || ('Sistema operativo: ' || coalesce(old.sistema_operativo,'—') || ' → ' || coalesce(new.sistema_operativo,'—')); end if;
  if new.factura_numero is distinct from old.factura_numero then cambios := cambios || ('Factura: ' || coalesce(old.factura_numero,'—') || ' → ' || coalesce(new.factura_numero,'—')); end if;
  if new.anio_compra is distinct from old.anio_compra then cambios := cambios || ('Año de compra: ' || coalesce(old.anio_compra::text,'—') || ' → ' || coalesce(new.anio_compra::text,'—')); end if;
  if new.novedad is distinct from old.novedad then cambios := cambios || ('Novedad: ' || coalesce(old.novedad,'—') || ' → ' || coalesce(new.novedad,'—')); end if;
  if new.observaciones is distinct from old.observaciones then cambios := cambios || 'Observaciones actualizadas'::text; end if;
  if new.factura_path is distinct from old.factura_path then cambios := cambios || 'Factura adjunta actualizada'::text; end if;
  if array_length(cambios, 1) > 0 then
    insert into public.equipo_historial(equipo_id, evento, detalle) values (new.id, 'edicion', array_to_string(cambios, ' · '));
  end if;
  return new;
end $$;

drop trigger if exists equipos_au on public.equipos;
create trigger equipos_au after update on public.equipos for each row execute function public.equipos_after_update();

create or replace function public.actas_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'firmada' and old.estado = 'pendiente' then
    perform set_config('app.estado_ok','1', true);
    perform set_config('app.acta_id', new.id::text, true);
    perform set_config('app.hist_evento', new.tipo::text, true);
    perform set_config('app.hist_detalle', 'Acta #' || new.numero || ' firmada (' || coalesce(new.firma_medio,'') || ')', true);
    if new.tipo = 'entrega' then
      update public.equipos set estado='asignado', empleado_id=new.empleado_id
        where id in (select equipo_id from public.acta_items where acta_id = new.id);
    else
      update public.equipos set estado='disponible', empleado_id=null
        where id in (select equipo_id from public.acta_items where acta_id = new.id);
    end if;
    perform set_config('app.estado_ok','', true);
    perform set_config('app.acta_id','', true);
    perform set_config('app.hist_evento','', true);
    perform set_config('app.hist_detalle','', true);
  end if;
  return new;
end $$;

create or replace function public.cambiar_estado_equipo(p_equipo uuid, p_estado equipo_estado, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare e public.equipos; es_admin boolean := public.has_role(auth.uid(),'admin');
begin
  if not public.has_permiso(auth.uid(),'equipos_editar') then raise exception 'Sin permiso'; end if;
  if coalesce(btrim(p_motivo),'') = '' then raise exception 'El motivo es obligatorio'; end if;
  if p_estado = 'asignado' then raise exception 'Asignado solo se obtiene con un acta de entrega firmada'; end if;
  if p_estado = 'de_baja' and not es_admin then raise exception 'Solo el Administrador puede dar de baja equipos'; end if;
  select * into e from public.equipos where id = p_equipo;
  if e.estado = 'asignado' and not es_admin then raise exception 'El equipo está asignado; realice primero el acta de devolución'; end if;
  if e.estado = 'de_baja' then raise exception 'El equipo ya está dado de baja'; end if;
  perform set_config('app.estado_ok','1', true);
  perform set_config('app.hist_evento', p_estado::text, true);
  perform set_config('app.hist_detalle', 'Motivo: ' || p_motivo, true);
  update public.equipos set estado = p_estado, empleado_id = null where id = p_equipo;
  perform set_config('app.estado_ok','', true);
  perform set_config('app.hist_evento','', true);
  perform set_config('app.hist_detalle','', true);
end $$;

create or replace function public.asignar_carga_inicial(p_items jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare it jsonb; n int := 0;
begin
  if not (public.has_permiso(auth.uid(),'cargas_masivas') or auth.role() = 'service_role') then
    raise exception 'Sin permiso para cargas masivas';
  end if;
  perform set_config('app.estado_ok','1',true);
  perform set_config('app.hist_evento','carga_inicial',true);
  perform set_config('app.hist_detalle','Asignación registrada en carga inicial de inventario (sin acta)',true);
  for it in select * from jsonb_array_elements(p_items) loop
    update public.equipos set estado='asignado', empleado_id=(it->>'empleado_id')::uuid
      where id=(it->>'equipo_id')::uuid and estado='disponible' and empleado_id is null;
    if found then n := n + 1; end if;
  end loop;
  perform set_config('app.estado_ok','',true);
  perform set_config('app.hist_evento','',true);
  perform set_config('app.hist_detalle','',true);
  return n;
end $$;