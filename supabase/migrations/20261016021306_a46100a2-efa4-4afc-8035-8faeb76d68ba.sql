CREATE TABLE public.pedidos_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigserial,
  proveedor_id uuid NOT NULL REFERENCES public.proveedores(id),
  estado text NOT NULL DEFAULT 'borrador',
  fecha_pedido date,
  fecha_esperada date,
  notas text,
  creado_por uuid DEFAULT auth.uid(),
  creado_nombre text,
  cancelado_motivo text,
  cerrado_at timestamptz,
  owner_id uuid DEFAULT public.my_owner_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_compra TO authenticated;
GRANT USAGE ON SEQUENCE public.pedidos_compra_numero_seq TO authenticated;
GRANT ALL ON public.pedidos_compra TO service_role;
ALTER TABLE public.pedidos_compra ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Personal gestiona pedidos" ON public.pedidos_compra FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) AND owner_id = public.my_owner_id())
  WITH CHECK (public.is_staff(auth.uid()) AND public.is_active(auth.uid()) AND owner_id = public.my_owner_id());

CREATE TABLE public.pedido_lineas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos_compra(id) ON DELETE CASCADE,
  tipo_id uuid NOT NULL REFERENCES public.catalogo_items(id),
  cantidad integer NOT NULL DEFAULT 1,
  recibida integer NOT NULL DEFAULT 0,
  precio_estimado numeric,
  owner_id uuid DEFAULT public.my_owner_id(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedido_lineas TO authenticated;
GRANT ALL ON public.pedido_lineas TO service_role;
ALTER TABLE public.pedido_lineas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Personal gestiona lineas" ON public.pedido_lineas FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) AND owner_id = public.my_owner_id())
  WITH CHECK (public.is_staff(auth.uid()) AND public.is_active(auth.uid()) AND owner_id = public.my_owner_id());

CREATE OR REPLACE FUNCTION public.pedidos_validar() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.estado NOT IN ('borrador','pedido','parcial','recibido','cancelado') THEN RAISE EXCEPTION 'Estado inválido'; END IF;
  IF TG_OP='UPDATE' AND OLD.estado IN ('recibido','cancelado') AND NEW.estado <> OLD.estado THEN RAISE EXCEPTION 'El pedido ya está cerrado'; END IF;
  IF NEW.estado='cancelado' AND coalesce(trim(NEW.cancelado_motivo),'')='' THEN RAISE EXCEPTION 'Indique el motivo de cancelación'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pedidos_validar BEFORE INSERT OR UPDATE ON public.pedidos_compra FOR EACH ROW EXECUTE FUNCTION public.pedidos_validar();
CREATE TRIGGER pedidos_upd BEFORE UPDATE ON public.pedidos_compra FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER pedidos_audit AFTER INSERT OR UPDATE OR DELETE ON public.pedidos_compra FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER lineas_audit AFTER INSERT OR UPDATE OR DELETE ON public.pedido_lineas FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE OR REPLACE FUNCTION public.recibir_pedido_linea(p_linea uuid, p_seriales text[], p_sin_serial integer, p_marca uuid, p_sede uuid, p_modelo text, p_valor numeric, p_factura text, p_garantia date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l record; p record; n integer := 0; s text; prov text; pend integer;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_permiso(auth.uid(),'equipos_editar')) THEN RAISE EXCEPTION 'Sin permiso'; END IF;
  SELECT * INTO l FROM pedido_lineas WHERE id=p_linea AND owner_id=public.my_owner_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Línea no encontrada'; END IF;
  SELECT * INTO p FROM pedidos_compra WHERE id=l.pedido_id FOR UPDATE;
  IF p.estado NOT IN ('pedido','parcial') THEN RAISE EXCEPTION 'El pedido debe estar en estado Pedido realizado'; END IF;
  SELECT nombre INTO prov FROM proveedores WHERE id=p.proveedor_id;
  pend := l.cantidad - l.recibida;
  IF coalesce(array_length(p_seriales,1),0) + coalesce(p_sin_serial,0) = 0 THEN RAISE EXCEPTION 'Nada para recibir'; END IF;
  IF coalesce(array_length(p_seriales,1),0) + coalesce(p_sin_serial,0) > pend THEN RAISE EXCEPTION 'Supera lo pendiente (%)', pend; END IF;
  FOREACH s IN ARRAY coalesce(p_seriales,'{}'::text[]) LOOP
    INSERT INTO equipos(tipo_id,marca_id,sede_id,modelo,serie,proveedor_id,proveedor,valor_compra,factura_numero,garantia_fin,anio_compra,estado,created_by,owner_id)
    VALUES (l.tipo_id,p_marca,p_sede,nullif(trim(p_modelo),''),upper(trim(s)),p.proveedor_id,prov,p_valor,nullif(trim(p_factura),''),p_garantia,extract(year from now())::int,'disponible',auth.uid(),p.owner_id);
    n := n+1;
  END LOOP;
  FOR i IN 1..coalesce(p_sin_serial,0) LOOP
    INSERT INTO equipos(tipo_id,marca_id,sede_id,modelo,serie,proveedor_id,proveedor,valor_compra,factura_numero,garantia_fin,anio_compra,estado,created_by,owner_id)
    VALUES (l.tipo_id,p_marca,p_sede,nullif(trim(p_modelo),''),'',p.proveedor_id,prov,p_valor,nullif(trim(p_factura),''),p_garantia,extract(year from now())::int,'disponible',auth.uid(),p.owner_id);
    n := n+1;
  END LOOP;
  UPDATE pedido_lineas SET recibida = recibida + n WHERE id=l.id;
  IF EXISTS (SELECT 1 FROM articulo_proveedores WHERE tipo_id=l.tipo_id AND proveedor_id=p.proveedor_id) THEN
    UPDATE articulo_proveedores SET ultima_compra=current_date, ultimo_precio=coalesce(p_valor,ultimo_precio) WHERE tipo_id=l.tipo_id AND proveedor_id=p.proveedor_id;
  ELSE
    INSERT INTO articulo_proveedores(tipo_id,proveedor_id,ultima_compra,ultimo_precio,owner_id) VALUES (l.tipo_id,p.proveedor_id,current_date,p_valor,p.owner_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pedido_lineas WHERE pedido_id=p.id AND recibida < cantidad) THEN
    UPDATE pedidos_compra SET estado='recibido', cerrado_at=now() WHERE id=p.id;
  ELSE
    UPDATE pedidos_compra SET estado='parcial' WHERE id=p.id;
  END IF;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.recibir_pedido_linea(uuid,text[],integer,uuid,uuid,text,numeric,text,date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.recibir_pedido_linea(uuid,text[],integer,uuid,uuid,text,numeric,text,date) TO authenticated;

-- Migrar solicitudes abiertas
DO $$ DECLARE r record; pid uuid; BEGIN
  FOR r IN SELECT * FROM solicitudes_reabastecimiento WHERE estado='solicitada' AND proveedor_id IS NOT NULL LOOP
    INSERT INTO pedidos_compra(proveedor_id,estado,fecha_pedido,creado_por,creado_nombre,owner_id,notas,created_at)
    VALUES (r.proveedor_id,'pedido',r.created_at::date,r.solicitado_por,r.solicitado_nombre,r.owner_id,'Migrado de solicitud de cotización',r.created_at) RETURNING id INTO pid;
    INSERT INTO pedido_lineas(pedido_id,tipo_id,cantidad,owner_id) VALUES (pid,r.tipo_id,r.cantidad,r.owner_id);
    UPDATE solicitudes_reabastecimiento SET estado='migrada', cerrado_at=now() WHERE id=r.id;
  END LOOP;
END $$;
DROP POLICY "Personal gestiona solicitudes" ON public.solicitudes_reabastecimiento;
CREATE POLICY "Personal ve solicitudes" ON public.solicitudes_reabastecimiento FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) AND owner_id = public.my_owner_id());