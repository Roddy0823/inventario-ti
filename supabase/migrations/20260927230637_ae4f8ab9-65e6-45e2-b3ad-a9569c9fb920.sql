CREATE OR REPLACE FUNCTION public.cambiar_estado_equipo(p_equipo uuid, p_estado equipo_estado, p_motivo text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare e public.equipos; es_admin boolean := public.has_role(auth.uid(),'admin');
begin
  if not public.has_permiso(auth.uid(),'equipos_editar') then raise exception 'Sin permiso'; end if;
  if coalesce(btrim(p_motivo),'') = '' then raise exception 'El motivo es obligatorio'; end if;
  if p_estado = 'asignado' then raise exception 'Asignado solo se obtiene con un acta de entrega firmada'; end if;
  if p_estado = 'de_baja' and not es_admin then raise exception 'Solo el Administrador puede dar de baja equipos'; end if;
  select * into e from public.equipos where id = p_equipo;
  if e.estado = 'de_baja' then raise exception 'El equipo ya está dado de baja'; end if;
  if e.estado = 'asignado' and p_estado <> 'en_reparacion' and not es_admin then raise exception 'El equipo está asignado; realice primero el acta de devolución'; end if;
  perform set_config('app.estado_ok','1', true);
  perform set_config('app.hist_evento', p_estado::text, true);
  perform set_config('app.hist_detalle', 'Motivo: ' || p_motivo, true);
  update public.equipos set estado = p_estado,
    empleado_id = case when p_estado = 'en_reparacion' then e.empleado_id else null end
  where id = p_equipo;
  perform set_config('app.estado_ok','', true);
  perform set_config('app.hist_evento','', true);
  perform set_config('app.hist_detalle','', true);
end $function$;

CREATE OR REPLACE FUNCTION public.finalizar_reparacion(p_equipo uuid, p_devolver boolean, p_motivo text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare e public.equipos;
begin
  if not public.has_permiso(auth.uid(),'equipos_editar') then raise exception 'Sin permiso'; end if;
  if coalesce(btrim(p_motivo),'') = '' then raise exception 'El motivo es obligatorio'; end if;
  select * into e from public.equipos where id = p_equipo;
  if e.estado <> 'en_reparacion' then raise exception 'El equipo no está en reparación'; end if;
  if p_devolver and e.empleado_id is null then raise exception 'El equipo no tiene empleado ligado; déjelo disponible'; end if;
  perform set_config('app.estado_ok','1', true);
  perform set_config('app.hist_evento', case when p_devolver then 'asignado' else 'disponible' end, true);
  perform set_config('app.hist_detalle', 'Fin de reparación' || case when p_devolver then ' (devuelto al empleado)' else '' end || '. Motivo: ' || p_motivo, true);
  if p_devolver then
    update public.equipos set estado='asignado' where id=p_equipo;
  else
    update public.equipos set estado='disponible', empleado_id=null where id=p_equipo;
  end if;
  perform set_config('app.estado_ok','', true);
  perform set_config('app.hist_evento','', true);
  perform set_config('app.hist_detalle','', true);
end $function$;
REVOKE EXECUTE ON FUNCTION public.finalizar_reparacion(uuid,boolean,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.finalizar_reparacion(uuid,boolean,text) TO authenticated;