ALTER TABLE public.empleados DROP CONSTRAINT empleados_identificacion_key;
CREATE UNIQUE INDEX empleados_owner_identificacion_key ON public.empleados (owner_id, upper(identificacion));