CREATE UNIQUE INDEX IF NOT EXISTS user_roles_un_solo_admin ON public.user_roles ((role)) WHERE role = 'admin';
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='empleados' AND indexdef ILIKE '%owner_id%identificacion%' AND indexdef ILIKE '%UNIQUE%' LOOP
    EXECUTE format('DROP INDEX public.%I', r.indexname);
  END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS empleados_identificacion_unica ON public.empleados (upper(identificacion));