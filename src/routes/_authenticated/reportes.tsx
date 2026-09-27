import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { useCatalogos } from "@/lib/catalogos";
import { ESTADO_EQUIPO, TIPO_ACTA, descargarCSV } from "@/lib/constantes";
import { PageHeader } from "@/components/Estado";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reportes")({
  head: () => ({ meta: [{ title: "Reportes — Finesa" }, { name: "description", content: "Exportación de inventario y actas." }] }),
  component: Reportes,
});

function Reportes() {
  const { data: me } = useMe();
  const cat = useCatalogos();
  const hoy = new Date().toISOString().slice(0, 10);
  const [desde, setDesde] = useState(hoy.slice(0, 8) + "01");
  const [hasta, setHasta] = useState(hoy);
  const [estado, setEstado] = useState("");
  const [sede, setSede] = useState("");
  if (!me?.can("reportes_exportar")) return <p className="text-muted-foreground">No tiene permiso para exportar reportes.</p>;

  async function inventario() {
    let data;
    try {
      data = await fetchAll((a, b) => {
        let q = supabase.from("equipos").select("*, empleado:empleados(nombre, identificacion)").order("serie");
        if (estado) q = q.eq("estado", estado as "disponible");
        if (sede) q = q.eq("sede_id", sede);
        return q.range(a, b);
      });
    } catch (e) { return toast.error((e as Error).message); }
    if (!data?.length) return toast.info("No hay datos para exportar");
    descargarCSV(`inventario_${hoy}.csv`, data.map((e) => {
      const emp = e.empleado as { nombre: string; identificacion: string } | null;
      return { serie: e.serie, activo_fijo: e.activo_fijo ?? "", tipo: cat.nombre(e.tipo_id), marca: cat.nombre(e.marca_id), modelo: e.modelo ?? "", sede: cat.nombre(e.sede_id), estado: ESTADO_EQUIPO[e.estado]?.label, asignado_a: emp?.nombre ?? "", identificacion: emp?.identificacion ?? "", fecha_ingreso: e.fecha_ingreso, anio_compra: e.anio_compra ?? "", garantia_fin: e.garantia_fin ?? "", proveedor: e.proveedor ?? "", nombre_equipo: e.nombre_equipo ?? "", novedad: e.novedad ?? "" };
    }));
    await supabase.rpc("log_evento", { p_accion: "EXPORTAR", p_detalle: "Reporte de inventario" });
  }

  async function actas() {
    const { data, error } = await supabase.from("actas").select("*, empleado:empleados(nombre, identificacion)").eq("estado", "firmada").gte("firmado_at", desde).lte("firmado_at", hasta + "T23:59:59").order("firmado_at");
    if (error) return toast.error(error.message);
    if (!data?.length) return toast.info("No hay actas firmadas en el periodo");
    descargarCSV(`actas_firmadas_${desde}_${hasta}.csv`, data.map((a) => {
      const emp = a.empleado as { nombre: string; identificacion: string } | null;
      return { numero: a.numero, tipo: TIPO_ACTA[a.tipo], empleado: emp?.nombre ?? "", identificacion: emp?.identificacion ?? "", tecnico: a.tecnico_nombre ?? "", creada: a.created_at, firmada: a.firmado_at, medio: a.firma_medio ?? "", ip: a.firma_ip ?? "" };
    }));
    await supabase.rpc("log_evento", { p_accion: "EXPORTAR", p_detalle: `Actas firmadas ${desde} a ${hasta}` });
  }

  const s = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm";
  return (
    <div>
      <PageHeader title="Reportes" desc="Exportaciones en CSV compatibles con Excel." />
      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-4 rounded-md border border-border bg-card p-5">
          <h2 className="font-bold">Inventario actual</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>Estado</Label><select className={s} value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todos</option>{Object.entries(ESTADO_EQUIPO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
            <div className="space-y-1"><Label>Sede</Label><select className={s} value={sede} onChange={(e) => setSede(e.target.value)}><option value="">Todas</option>{cat.byTipo("sede", false).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
          </div>
          <Button onClick={inventario}>Exportar inventario</Button>
        </section>
        <section className="space-y-4 rounded-md border border-border bg-card p-5">
          <h2 className="font-bold">Actas firmadas en un periodo</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>Desde</Label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
            <div className="space-y-1"><Label>Hasta</Label><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
          </div>
          <Button onClick={actas}>Exportar actas</Button>
        </section>
      </div>
    </div>
  );
}
