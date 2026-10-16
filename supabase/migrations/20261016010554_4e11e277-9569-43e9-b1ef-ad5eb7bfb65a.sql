CREATE TABLE public.proveedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL, nit text, contacto_nombre text, telefono text NOT NULL, whatsapp text, email text, ciudad text, notas text,
  owner_id uuid DEFAULT public.my_owner_id(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.alertas_stock_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_id uuid NOT NULL REFERENCES public.catalogo_items(id) ON DELETE CASCADE,
  stock_minimo integer NOT NULL DEFAULT 3, activa boolean NOT NULL DEFAULT true,
  owner_id uuid DEFAULT public.my_owner_id(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, tipo_id)
);
CREATE TABLE public.articulo_proveedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_id uuid NOT NULL REFERENCES public.catalogo_items(id) ON DELETE CASCADE,
  proveedor_id uuid NOT NULL REFERENCES public.proveedores(id) ON DELETE CASCADE,
  precio_referencia numeric, tiempo_entrega_dias integer, es_principal boolean NOT NULL DEFAULT false,
  owner_id uuid DEFAULT public.my_owner_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo_id, proveedor_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proveedores, public.alertas_stock_config, public.articulo_proveedores TO authenticated;
GRANT ALL ON public.proveedores, public.alertas_stock_config, public.articulo_proveedores TO service_role;
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_stock_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articulo_proveedores ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE t text; BEGIN
FOREACH t IN ARRAY ARRAY['proveedores','alertas_stock_config','articulo_proveedores'] LOOP
  EXECUTE format('CREATE POLICY "Personal gestiona %1$s" ON public.%1$I FOR ALL TO authenticated USING (public.is_staff(auth.uid()) AND owner_id = public.my_owner_id()) WITH CHECK (public.is_staff(auth.uid()) AND public.is_active(auth.uid()) AND owner_id = public.my_owner_id())', t);
  EXECUTE format('CREATE TRIGGER %1$s_audit AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()', t);
END LOOP; END $$;
CREATE TRIGGER proveedores_upd BEFORE UPDATE ON public.proveedores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER alertas_upd BEFORE UPDATE ON public.alertas_stock_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.stock_bajo()
RETURNS TABLE(tipo_id uuid, tipo text, disponibles bigint, stock_minimo integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT a.tipo_id, c.nombre, (SELECT count(*) FROM equipos e WHERE e.tipo_id = a.tipo_id AND e.estado = 'disponible' AND e.owner_id = a.owner_id), a.stock_minimo
  FROM alertas_stock_config a JOIN catalogo_items c ON c.id = a.tipo_id
  WHERE a.activa AND a.owner_id = my_owner_id()
    AND (SELECT count(*) FROM equipos e WHERE e.tipo_id = a.tipo_id AND e.estado = 'disponible' AND e.owner_id = a.owner_id) <= a.stock_minimo
  ORDER BY 3, 2;
$$;
REVOKE EXECUTE ON FUNCTION public.stock_bajo() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.stock_bajo() TO authenticated;
CREATE INDEX IF NOT EXISTS equipos_owner_estado_tipo_idx ON public.equipos (owner_id, estado, tipo_id);
CREATE INDEX IF NOT EXISTS auditoria_created_desc_idx ON public.auditoria (created_at DESC);