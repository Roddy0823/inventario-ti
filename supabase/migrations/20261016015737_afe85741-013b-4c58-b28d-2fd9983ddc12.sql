ALTER TABLE public.proveedores
  ADD COLUMN IF NOT EXISTS direccion text,
  ADD COLUMN IF NOT EXISTS sitio_web text,
  ADD COLUMN IF NOT EXISTS asesor_telefono text,
  ADD COLUMN IF NOT EXISTS etiquetas text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dias_entrega integer,
  ADD COLUMN IF NOT EXISTS forma_pago text,
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;
ALTER TABLE public.proveedores ALTER COLUMN telefono DROP NOT NULL;

ALTER TABLE public.articulo_proveedores
  ADD COLUMN IF NOT EXISTS ultimo_precio numeric,
  ADD COLUMN IF NOT EXISTS ultima_compra date;
UPDATE public.articulo_proveedores a SET es_principal=false
  WHERE es_principal AND id <> (SELECT b.id FROM public.articulo_proveedores b WHERE b.es_principal AND b.tipo_id=a.tipo_id AND b.owner_id IS NOT DISTINCT FROM a.owner_id ORDER BY b.created_at LIMIT 1);
CREATE UNIQUE INDEX IF NOT EXISTS articulo_proveedores_un_principal ON public.articulo_proveedores(owner_id, tipo_id) WHERE es_principal;

CREATE TABLE public.solicitudes_reabastecimiento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_id uuid NOT NULL REFERENCES public.catalogo_items(id),
  proveedor_id uuid REFERENCES public.proveedores(id) ON DELETE SET NULL,
  cantidad integer NOT NULL DEFAULT 1,
  estado text NOT NULL DEFAULT 'solicitada',
  solicitado_por uuid DEFAULT auth.uid(),
  solicitado_nombre text,
  cerrado_at timestamptz,
  owner_id uuid DEFAULT public.my_owner_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitudes_reabastecimiento TO authenticated;
GRANT ALL ON public.solicitudes_reabastecimiento TO service_role;
ALTER TABLE public.solicitudes_reabastecimiento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Personal gestiona solicitudes" ON public.solicitudes_reabastecimiento FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) AND owner_id = public.my_owner_id())
  WITH CHECK (public.is_staff(auth.uid()) AND public.is_active(auth.uid()) AND owner_id = public.my_owner_id());
CREATE INDEX ON public.solicitudes_reabastecimiento(owner_id, tipo_id, estado);
CREATE TRIGGER solicitudes_audit AFTER INSERT OR UPDATE OR DELETE ON public.solicitudes_reabastecimiento FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER solicitudes_upd BEFORE UPDATE ON public.solicitudes_reabastecimiento FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.equipos ADD COLUMN IF NOT EXISTS reparacion_proveedor_id uuid REFERENCES public.proveedores(id) ON DELETE SET NULL;
ALTER TABLE public.equipos ADD COLUMN IF NOT EXISTS reparacion_inicio timestamptz;

CREATE TABLE public.reparaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id uuid NOT NULL REFERENCES public.equipos(id) ON DELETE CASCADE,
  proveedor_id uuid REFERENCES public.proveedores(id) ON DELETE SET NULL,
  inicio timestamptz NOT NULL DEFAULT now(),
  fin timestamptz,
  owner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reparaciones TO authenticated;
GRANT ALL ON public.reparaciones TO service_role;
ALTER TABLE public.reparaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Personal ve reparaciones" ON public.reparaciones FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) AND owner_id = public.my_owner_id());
CREATE INDEX ON public.reparaciones(proveedor_id);

CREATE OR REPLACE FUNCTION public.cambiar_estado_equipo(p_equipo uuid, p_estado equipo_estado, p_motivo text, p_proveedor uuid DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare e public.equipos; es_admin boolean := public.has_role(auth.uid(),'admin'); pn text;
begin
  if not public.has_permiso(auth.uid(),'equipos_editar') then raise exception 'Sin permiso'; end if;
  if coalesce(btrim(p_motivo),'') = '' then raise exception 'El motivo es obligatorio'; end if;
  if p_estado = 'asignado' then raise exception 'Asignado solo se obtiene con un acta de entrega firmada'; end if;
  if p_estado = 'de_baja' and not es_admin then raise exception 'Solo el Administrador puede dar de baja equipos'; end if;
  select * into e from public.equipos where id = p_equipo;
  if e.estado = 'de_baja' then raise exception 'El equipo ya está dado de baja'; end if;
  if e.estado = 'asignado' and p_estado <> 'en_reparacion' and not es_admin then raise exception 'El equipo está asignado; realice primero el acta de devolución'; end if;
  if p_proveedor is not null then select nombre into pn from public.proveedores where id = p_proveedor and owner_id = e.owner_id; end if;
  perform set_config('app.estado_ok','1', true);
  perform set_config('app.hist_evento', p_estado::text, true);
  perform set_config('app.hist_detalle', 'Motivo: ' || p_motivo || coalesce(' · Proveedor de servicio: ' || pn, ''), true);
  update public.equipos set estado = p_estado,
    empleado_id = case when p_estado = 'en_reparacion' then e.empleado_id else null end,
    reparacion_proveedor_id = case when p_estado = 'en_reparacion' and pn is not null then p_proveedor else null end,
    reparacion_inicio = case when p_estado = 'en_reparacion' then now() else null end
  where id = p_equipo;
  if p_estado = 'en_reparacion' then
    insert into public.reparaciones(equipo_id, proveedor_id, owner_id) values (p_equipo, case when pn is not null then p_proveedor end, e.owner_id);
  elsif e.estado = 'en_reparacion' then
    update public.reparaciones set fin = now() where equipo_id = p_equipo and fin is null;
  end if;
  perform set_config('app.estado_ok','', true);
  perform set_config('app.hist_evento','', true);
  perform set_config('app.hist_detalle','', true);
end $function$;
DROP FUNCTION IF EXISTS public.cambiar_estado_equipo(uuid, equipo_estado, text);

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
    update public.equipos set estado='asignado', reparacion_proveedor_id=null, reparacion_inicio=null where id=p_equipo;
  else
    update public.equipos set estado='disponible', empleado_id=null, reparacion_proveedor_id=null, reparacion_inicio=null where id=p_equipo;
  end if;
  update public.reparaciones set fin = now() where equipo_id = p_equipo and fin is null;
  perform set_config('app.estado_ok','', true);
  perform set_config('app.hist_evento','', true);
  perform set_config('app.hist_detalle','', true);
end $function$;

REVOKE EXECUTE ON FUNCTION public.cambiar_estado_equipo(uuid, equipo_estado, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cambiar_estado_equipo(uuid, equipo_estado, text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resumen_proveedores()
 RETURNS TABLE(proveedor_id uuid, nombre text, equipos bigint, en_garantia bigint, valor numeric, reparaciones bigint, en_reparacion bigint, dias_promedio numeric)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
  SELECT p.id, p.nombre,
    (SELECT count(*) FROM equipos e WHERE e.proveedor_id=p.id AND e.estado<>'de_baja'),
    (SELECT count(*) FROM equipos e WHERE e.proveedor_id=p.id AND e.estado<>'de_baja' AND e.garantia_fin >= current_date),
    (SELECT coalesce(sum(e.valor_compra),0) FROM equipos e WHERE e.proveedor_id=p.id AND e.estado<>'de_baja'),
    (SELECT count(*) FROM reparaciones r WHERE r.proveedor_id=p.id AND r.fin IS NOT NULL),
    (SELECT count(*) FROM reparaciones r WHERE r.proveedor_id=p.id AND r.fin IS NULL),
    (SELECT round(avg(extract(epoch FROM r.fin - r.inicio)/86400)::numeric,1) FROM reparaciones r WHERE r.proveedor_id=p.id AND r.fin IS NOT NULL)
  FROM proveedores p WHERE p.owner_id = my_owner_id() ORDER BY p.nombre
$$;