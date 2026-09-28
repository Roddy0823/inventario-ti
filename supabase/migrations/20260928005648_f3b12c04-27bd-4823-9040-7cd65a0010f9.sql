DROP POLICY IF EXISTS "Ver items de actas visibles" ON public.acta_items;
CREATE POLICY "Ver items de actas visibles" ON public.acta_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.actas a WHERE a.id = acta_items.acta_id AND (a.owner_id = public.my_owner_id() OR a.empleado_id = public.my_empleado_id())));

DROP POLICY IF EXISTS "Ver perfil propio o personal" ON public.profiles;
CREATE POLICY "Ver perfil propio o personal" ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR (public.is_staff(auth.uid()) AND (
    id = public.my_owner_id()
    OR id IN (SELECT ur.user_id FROM public.user_roles ur WHERE ur.owner_id = public.my_owner_id())
    OR id IN (SELECT e.user_id FROM public.empleados e WHERE e.owner_id = public.my_owner_id() AND e.user_id IS NOT NULL)
  ))
);

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef AND p.prorettype <> 'trigger'::regtype AND p.prorettype <> 'event_trigger'::regtype
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_equipos_owner_estado ON public.equipos(owner_id, estado);
CREATE INDEX IF NOT EXISTS idx_equipos_serie ON public.equipos(serie);
CREATE INDEX IF NOT EXISTS idx_equipos_empleado ON public.equipos(empleado_id);
CREATE INDEX IF NOT EXISTS idx_empleados_identificacion ON public.empleados(identificacion);
CREATE INDEX IF NOT EXISTS idx_empleados_user ON public.empleados(user_id);
CREATE INDEX IF NOT EXISTS idx_actas_owner_created ON public.actas(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_actas_empleado ON public.actas(empleado_id);
CREATE INDEX IF NOT EXISTS idx_acta_items_acta ON public.acta_items(acta_id);
CREATE INDEX IF NOT EXISTS idx_hist_equipo_created ON public.equipo_historial(equipo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_owner ON public.user_roles(owner_id);

CREATE OR REPLACE FUNCTION public.panel_conteos()
RETURNS TABLE(estado public.equipo_estado, total bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT e.estado, count(*) FROM public.equipos e WHERE e.owner_id = public.my_owner_id() GROUP BY e.estado
$$;
REVOKE EXECUTE ON FUNCTION public.panel_conteos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.panel_conteos() TO authenticated;