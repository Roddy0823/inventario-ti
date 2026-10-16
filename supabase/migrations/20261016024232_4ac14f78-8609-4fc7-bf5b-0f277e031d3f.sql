CREATE OR REPLACE FUNCTION public.estadisticas_avanzadas(p_sede uuid DEFAULT NULL, p_tipo uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
with e as (
  select eq.* from equipos eq where eq.owner_id = my_owner_id()
    and (p_sede is null or eq.sede_id = p_sede) and (p_tipo is null or eq.tipo_id = p_tipo)
), r as (
  select rp.* from reparaciones rp join e on e.id = rp.equipo_id
), a as (
  select * from actas where owner_id = my_owner_id() and estado <> 'anulada'
)
select jsonb_build_object(
  'fallas_30', (select count(distinct id) from (
      select equipo_id id from r where inicio >= now() - interval '30 days'
      union select id from e where estado='de_baja' and updated_at >= now() - interval '30 days') x),
  'fallas_30_prev', (select count(distinct id) from (
      select equipo_id id from r where inicio >= now() - interval '60 days' and inicio < now() - interval '30 days') x),
  'asignados_prev', (select count(*) from e where estado='asignado' and created_at < date_trunc('month', current_date)),
  'firmadas', (select count(*) from a where estado='firmada'),
  'pendientes', (select count(*) from a where estado='pendiente'),
  'firmadas_mes_prev', (select count(*) from a where estado='firmada' and firmado_at >= date_trunc('month', current_date) - interval '1 month' and firmado_at < date_trunc('month', current_date)),
  'horas_firma', (select round(avg(extract(epoch from firmado_at - created_at)/3600)::numeric,1) from a where estado='firmada' and firmado_at is not null),
  'por_tipo_estado', (select coalesce(jsonb_agg(t order by t.total desc),'[]') from (
      select coalesce(c.nombre,'—') nombre, count(*) total,
        count(*) filter (where estado='disponible') disponible, count(*) filter (where estado='asignado') asignado,
        count(*) filter (where estado='en_reparacion') en_reparacion, count(*) filter (where estado='de_baja') de_baja
      from e left join catalogo_items c on c.id=e.tipo_id group by c.nombre order by 2 desc limit 12) t),
  'fallas_marca', (select coalesce(jsonb_agg(t order by t.total desc),'[]') from (
      select coalesce(c.nombre,'Sin marca') nombre,
        (select count(*) from r join e e2 on e2.id=r.equipo_id where e2.marca_id is not distinct from c.id) reparaciones,
        count(*) filter (where e.estado='de_baja') bajas,
        count(*) equipos,
        (select count(*) from r join e e2 on e2.id=r.equipo_id where e2.marca_id is not distinct from c.id) + count(*) filter (where e.estado='de_baja') total
      from e left join catalogo_items c on c.id=e.marca_id group by c.id, c.nombre) t where t.total > 0 limit 12),
  'fallas_modelo', (select coalesce(jsonb_agg(t order by t.total desc),'[]') from (
      select coalesce(nullif(e.modelo,''),'Sin modelo') nombre,
        count(distinct r.id) reparaciones, count(distinct e.id) filter (where e.estado='de_baja') bajas,
        count(distinct r.id) + count(distinct e.id) filter (where e.estado='de_baja') total
      from e left join r on r.equipo_id=e.id group by 1) t where t.total > 0 limit 12),
  'por_cargo', (select coalesce(jsonb_agg(t order by t.cantidad desc),'[]') from (
      select coalesce(nullif(em.cargo,''),'Sin cargo') nombre, count(*) cantidad from e join empleados em on em.id=e.empleado_id where e.estado='asignado' group by 1 order by 2 desc limit 15) t),
  'por_area', (select coalesce(jsonb_agg(t order by t.cantidad desc),'[]') from (
      select coalesce(c.nombre,'Sin área') nombre, count(*) cantidad from e join empleados em on em.id=e.empleado_id left join catalogo_items c on c.id=em.area_id where e.estado='asignado' group by 1 order by 2 desc limit 15) t),
  'por_sede_emp', (select coalesce(jsonb_agg(t order by t.cantidad desc),'[]') from (
      select coalesce(c.nombre,'Sin sede') nombre, count(*) cantidad from e join empleados em on em.id=e.empleado_id left join catalogo_items c on c.id=em.sede_id where e.estado='asignado' group by 1 order by 2 desc limit 15) t),
  'movimientos', (select coalesce(jsonb_agg(t order by t.mes),'[]') from (
      select to_char(m,'YYYY-MM') mes,
        (select count(*) from a where estado='firmada' and tipo='entrega' and date_trunc('month',firmado_at)=m) entregas,
        (select count(*) from a where estado='firmada' and tipo='devolucion' and date_trunc('month',firmado_at)=m) devoluciones,
        (select count(*) from e where date_trunc('month',fecha_ingreso)=m) ingresos,
        (select count(*) from e where fecha_ingreso < m + interval '1 month') acumulado
      from generate_series(date_trunc('month',current_date) - interval '11 months', date_trunc('month',current_date), interval '1 month') m) t),
  'stock', (select coalesce(jsonb_agg(t order by t.nombre),'[]') from (
      select c.nombre, (select count(*) from equipos x where x.owner_id=my_owner_id() and x.tipo_id=s.tipo_id and x.estado='disponible') disponibles, s.stock_minimo minimo
      from alertas_stock_config s join catalogo_items c on c.id=s.tipo_id where s.owner_id=my_owner_id() and s.activa) t),
  'garantias', jsonb_build_object(
      'd30', (select count(*) from e where estado<>'de_baja' and garantia_fin between current_date and current_date+30),
      'd60', (select count(*) from e where estado<>'de_baja' and garantia_fin between current_date+31 and current_date+60),
      'd90', (select count(*) from e where estado<>'de_baja' and garantia_fin between current_date+61 and current_date+90))
)
$$;
REVOKE EXECUTE ON FUNCTION public.estadisticas_avanzadas(uuid,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.estadisticas_avanzadas(uuid,uuid) TO authenticated, service_role;