alter table public.equipos
  add column activo_fijo text,
  add column nombre_equipo text,
  add column sistema_operativo text,
  add column factura_numero text,
  add column anio_compra int,
  add column novedad text;
create unique index equipos_activo_fijo_uq on public.equipos (upper(activo_fijo)) where activo_fijo is not null;

create or replace function public.asignar_carga_inicial(p_items jsonb)
returns int language plpgsql security definer set search_path=public as $$
declare it jsonb; n int := 0; v_eq uuid; v_emp uuid;
begin
  if not (public.has_permiso(auth.uid(),'cargas_masivas') or auth.role() = 'service_role') then
    raise exception 'Sin permiso para cargas masivas';
  end if;
  perform set_config('app.estado_ok','1',true);
  for it in select * from jsonb_array_elements(p_items) loop
    v_eq := (it->>'equipo_id')::uuid; v_emp := (it->>'empleado_id')::uuid;
    update public.equipos set estado='asignado', empleado_id=v_emp
      where id=v_eq and estado='disponible' and empleado_id is null;
    if found then
      insert into public.equipo_historial(equipo_id, evento, detalle, user_id)
        values (v_eq, 'carga_inicial', 'Asignación registrada en carga inicial de inventario (sin acta)', coalesce(auth.uid(), (it->>'actor')::uuid));
      n := n + 1;
    end if;
  end loop;
  perform set_config('app.estado_ok','',true);
  return n;
end $$;
revoke all on function public.asignar_carga_inicial(jsonb) from public, anon;
grant execute on function public.asignar_carga_inicial(jsonb) to authenticated, service_role;