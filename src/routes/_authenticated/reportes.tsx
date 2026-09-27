import { fetchAll } from "@/lib/fetchAll";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { useCatalogos } from "@/lib/catalogos";
import { ESTADO_EQUIPO, TIPO_ACTA, descargarCSV, fmtFecha } from "@/lib/constantes";
import { reportePdf } from "@/lib/reportePdf";
import { PageHeader } from "@/components/Estado";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reportes")({
  head: () => ({ meta: [{ title: "Reportes — Finesa" }, { name: "description", content: "Exportación de inventario y actas en Excel y PDF." }] }),
  component: Reportes,
});

type Emp = { nombre: string; identificacion: string } | null;

function Reportes() {
  const { data: me } = useMe();
  const cat = useCatalogos();
  const hoy = new Date().toISOString().slice(0, 10);
  const [desde, setDesde] = useState(hoy.slice(0, 8) + "01");
  const [hasta, setHasta] = useState(hoy);
  const [estado, setEstado] = useState("");
  const [sede, setSede] = useState("");
  const [cargando, setCargando] = useState(false);
  if (!me?.can("reportes_exportar")) return <p className="text-muted-foreground">No tiene permiso para exportar reportes.</p>;

  async function datosInventario() {
    return fetchAll((a, b) => {
      let q = supabase.from("equipos").select("*, empleado:empleados(nombre, identificacion)").order("serie").order("id");
      if (estado) q = q.eq("estado", estado as "disponible");
      if (sede) q = q.eq("sede_id", sede);
      return q.range(a, b);
    });
  }

  async function inventario(formato: "csv" | "pdf") {
    setCargando(true);
    try {
      const data = await datosInventario();
      if (!data?.length) return toast.info("No hay datos para exportar");
      if (formato === "csv") {
        descargarCSV(`inventario_${hoy}.csv`, data.map((e) => {
          const emp = e.empleado as Emp;
          return { serie: e.serie, activo_fijo: e.activo_fijo ?? "", tipo: cat.nombre(e.tipo_id), marca: cat.nombre(e.marca_id), modelo: e.modelo ?? "", sede: cat.nombre(e.sede_id), estado: ESTADO_EQUIPO[e.estado]?.label, asignado_a: emp?.nombre ?? "", identificacion: emp?.identificacion ?? "", fecha_ingreso: e.fecha_ingreso, anio_compra: e.anio_compra ?? "", garantia_fin: e.garantia_fin ?? "", proveedor: e.proveedor ?? "", nombre_equipo: e.nombre_equipo ?? "", novedad: e.novedad ?? "" };
        }));
      } else {
        const cuenta: Record<string, number> = {};
        data.forEach((e) => { const l = ESTADO_EQUIPO[e.estado]?.label ?? e.estado; cuenta[l] = (cuenta[l] ?? 0) + 1; });
        reportePdf({
          titulo: "REPORTE DE INVENTARIO ACTUAL",
          subtitulo: `Estado: ${estado ? ESTADO_EQUIPO[estado as "disponible"]?.label : "Todos"}  ·  Sede: ${sede ? cat.nombre(sede) : "Todas"}`,
          resumen: [`Total equipos: ${data.length}`, ...Object.entries(cuenta).map(([k, v]) => `${k}: ${v}`)],
          columnas: ["Serie", "Activo fijo", "Tipo", "Marca", "Modelo", "Sede", "Estado", "Responsable", "Cédula"],
          filas: data.map((e) => { const emp = e.empleado as Emp; return [e.serie, e.activo_fijo ?? "", cat.nombre(e.tipo_id), cat.nombre(e.marca_id), e.modelo ?? "", cat.nombre(e.sede_id), ESTADO_EQUIPO[e.estado]?.label ?? "", emp?.nombre ?? "", emp?.identificacion ?? ""]; }),
          archivo: `inventario_${hoy}.pdf`,
        });
      }
      await supabase.rpc("log_evento", { p_accion: "EXPORTAR", p_detalle: `Reporte de inventario (${formato.toUpperCase()})` });
    } catch (e) { toast.error((e as Error).message); } finally { setCargando(false); }
  }

  async function actas(formato: "csv" | "pdf") {
    setCargando(true);
    try {
      const data = await fetchAll((a, b) => supabase.from("actas").select("*, empleado:empleados(nombre, identificacion), items:acta_items(count)").eq("estado", "firmada").gte("firmado_at", desde).lte("firmado_at", hasta + "T23:59:59").order("firmado_at").order("id").range(a, b));
      if (!data?.length) return toast.info("No hay actas firmadas en el periodo");
      const n = (a: (typeof data)[number]) => (a.items as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
      if (formato === "csv") {
        descargarCSV(`actas_firmadas_${desde}_${hasta}.csv`, data.map((a) => {
          const emp = a.empleado as Emp;
          return { numero: a.numero, tipo: TIPO_ACTA[a.tipo], empleado: emp?.nombre ?? "", identificacion: emp?.identificacion ?? "", tecnico: a.tecnico_nombre ?? "", creada: a.created_at, firmada: a.firmado_at, medio: a.firma_medio ?? "", ip: a.firma_ip ?? "", equipos: n(a) };
        }));
      } else {
        const ent = data.filter((a) => a.tipo === "entrega").length;
        reportePdf({
          titulo: "REPORTE DE ACTAS FIRMADAS",
          subtitulo: `Periodo: ${fmtFecha(desde)} a ${fmtFecha(hasta)}`,
          resumen: [`Total actas: ${data.length}`, `Entregas: ${ent}`, `Devoluciones: ${data.length - ent}`, `Equipos: ${data.reduce((s, a) => s + n(a), 0)}`],
          columnas: ["No.", "Tipo", "Empleado", "Cédula", "Técnico", "Fecha de firma", "Medio", "Equipos"],
          filas: data.map((a) => { const emp = a.empleado as Emp; return [a.numero, TIPO_ACTA[a.tipo], emp?.nombre ?? "", emp?.identificacion ?? "", a.tecnico_nombre ?? "", fmtFecha(a.firmado_at, true), a.firma_medio ?? "", n(a)]; }),
          archivo: `actas_firmadas_${desde}_${hasta}.pdf`,
        });
      }
      await supabase.rpc("log_evento", { p_accion: "EXPORTAR", p_detalle: `Actas firmadas ${desde} a ${hasta} (${formato.toUpperCase()})` });
    } catch (e) { toast.error((e as Error).message); } finally { setCargando(false); }
  }

  const s = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm";
  return (
    <div>
      <PageHeader title="Reportes" desc="Exportaciones en Excel (CSV) o PDF." />
      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-4 rounded-md border border-border bg-card p-5">
          <h2 className="font-bold">Inventario actual</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>Estado</Label><select className={s} value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todos</option>{Object.entries(ESTADO_EQUIPO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
            <div className="space-y-1"><Label>Sede</Label><select className={s} value={sede} onChange={(e) => setSede(e.target.value)}><option value="">Todas</option>{cat.byTipo("sede", false).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
          </div>
          <div className="flex gap-2"><Button disabled={cargando} onClick={() => inventario("csv")}>Excel</Button><Button disabled={cargando} variant="outline" onClick={() => inventario("pdf")}>PDF</Button></div>
        </section>
        <section className="space-y-4 rounded-md border border-border bg-card p-5">
          <h2 className="font-bold">Actas firmadas en un periodo</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>Desde</Label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
            <div className="space-y-1"><Label>Hasta</Label><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
          </div>
          <div className="flex gap-2"><Button disabled={cargando} onClick={() => actas("csv")}>Excel</Button><Button disabled={cargando} variant="outline" onClick={() => actas("pdf")}>PDF</Button></div>
        </section>
      </div>
    </div>
  );
}
