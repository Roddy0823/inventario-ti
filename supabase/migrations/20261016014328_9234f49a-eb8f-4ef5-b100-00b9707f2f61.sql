ALTER TABLE public.equipos ADD COLUMN IF NOT EXISTS valor_compra numeric(14,2),
  ADD COLUMN IF NOT EXISTS proveedor_id uuid REFERENCES public.proveedores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS equipos_proveedor_id_idx ON public.equipos(proveedor_id);

CREATE OR REPLACE FUNCTION public.equipos_after_update()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare cambios text[] := '{}'; det text; ev text; emp_old text; emp_new text;
  x text := nullif(current_setting('app.hist_detalle', true), '');
  acta uuid := nullif(current_setting('app.acta_id', true), '')::uuid;
  evs text := nullif(current_setting('app.hist_evento', true), '');
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
  if new.valor_compra is distinct from old.valor_compra then cambios := cambios || ('Valor de compra: ' || coalesce(old.valor_compra::text,'—') || ' → ' || coalesce(new.valor_compra::text,'—')); end if;
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
end $function$;

CREATE OR REPLACE FUNCTION public.estadisticas_inventario(p_sede uuid DEFAULT NULL, p_tipo uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
with e as (
  select eq.*, coalesce(eq.valor_compra,0) v from equipos eq
  where eq.owner_id = my_owner_id()
    and (p_sede is null or eq.sede_id = p_sede) and (p_tipo is null or eq.tipo_id = p_tipo)
)
select jsonb_build_object(
  'total', (select count(*) from e),
  'valor_total', (select coalesce(sum(v),0) from e where estado <> 'de_baja'),
  'valor_por_estado', (select coalesce(jsonb_object_agg(estado, val),'{}') from (select estado, sum(v) val from e group by estado) s),
  'por_estado', (select coalesce(jsonb_object_agg(estado, n),'{}') from (select estado, count(*) n from e group by estado) s),
  'sin_valor', (select count(*) from e where valor_compra is null),
  'por_tipo', (select coalesce(jsonb_agg(t order by t.cantidad desc),'[]') from (
      select coalesce(c.nombre,'—') nombre, count(*) cantidad,
        count(*) filter (where estado='disponible') disponibles,
        count(*) filter (where estado='asignado') asignados,
        count(*) filter (where estado='en_reparacion') en_reparacion,
        count(*) filter (where estado='de_baja') de_baja,
        sum(v) valor, round(avg(valor_compra),0) promedio
      from e left join catalogo_items c on c.id=e.tipo_id group by c.nombre) t),
  'por_marca', (select coalesce(jsonb_agg(t order by t.cantidad desc),'[]') from (
      select coalesce(c.nombre,'Sin marca') nombre, count(*) cantidad, sum(v) valor from e left join catalogo_items c on c.id=e.marca_id group by c.nombre order by 2 desc limit 15) t),
  'por_sede', (select coalesce(jsonb_agg(t order by t.cantidad desc),'[]') from (
      select coalesce(c.nombre,'Sin sede') nombre, count(*) cantidad, sum(v) valor from e left join catalogo_items c on c.id=e.sede_id group by c.nombre) t),
  'ingresos_mes', (select coalesce(jsonb_agg(t order by t.mes),'[]') from (
      select to_char(date_trunc('month', fecha_ingreso),'YYYY-MM') mes, count(*) cantidad, sum(v) valor from e
      where fecha_ingreso >= date_trunc('month', current_date) - interval '11 months' group by 1) t),
  'por_anio', (select coalesce(jsonb_agg(t order by t.anio),'[]') from (
      select anio_compra anio, count(*) cantidad from e where anio_compra is not null group by 1) t),
  'garantia_vencida', (select count(*) from e where garantia_fin < current_date and estado <> 'de_baja'),
  'garantia_por_vencer', (select count(*) from e where garantia_fin between current_date and current_date + 90 and estado <> 'de_baja'),
  'top_proveedores', (select coalesce(jsonb_agg(t order by t.valor desc),'[]') from (
      select coalesce(p.nombre, nullif(e.proveedor,''), 'Sin proveedor') nombre, count(*) cantidad, sum(v) valor
      from e left join proveedores p on p.id=e.proveedor_id group by 1 order by 3 desc limit 10) t),
  'actas_mes', (select coalesce(jsonb_agg(t order by t.mes),'[]') from (
      select to_char(date_trunc('month', firmado_at),'YYYY-MM') mes,
        count(*) filter (where tipo='entrega') entregas, count(*) filter (where tipo='devolucion') devoluciones
      from actas where owner_id = my_owner_id() and estado='firmada'
        and firmado_at >= date_trunc('month', current_date) - interval '11 months' group by 1) t),
  'actas_firmadas_mes', (select count(*) from actas where owner_id=my_owner_id() and estado='firmada' and firmado_at >= date_trunc('month', current_date)),
  'actas_pendientes', (select count(*) from actas where owner_id=my_owner_id() and estado='pendiente')
)
$$;
REVOKE EXECUTE ON FUNCTION public.estadisticas_inventario(uuid,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.estadisticas_inventario(uuid,uuid) TO authenticated, service_role;