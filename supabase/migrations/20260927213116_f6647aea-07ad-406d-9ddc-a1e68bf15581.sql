create or replace function public.cambiar_estado_equipo(p_equipo uuid, p_estado public.equipo_estado, p_motivo text) returns void
language plpgsql security definer set search_path=public as $$
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
  update public.equipos set estado = p_estado, empleado_id = null where id = p_equipo;
  perform set_config('app.estado_ok','', true);
  insert into public.equipo_historial(equipo_id, evento, detalle) values (p_equipo, p_estado::text, 'Motivo: ' || p_motivo);
end $$;
revoke execute on function public.cambiar_estado_equipo(uuid, public.equipo_estado, text) from public, anon;
grant execute on function public.cambiar_estado_equipo(uuid, public.equipo_estado, text) to authenticated;