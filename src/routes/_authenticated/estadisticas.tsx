import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { useCatalogos } from "@/lib/catalogos";
import { ESTADO_EQUIPO } from "@/lib/constantes";
import { PageHeader } from "@/components/Estado";
import { Button } from "@/components/ui/button";
import { useStockBajo } from "@/components/StockAlertas";
import { Download, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/estadisticas")({
  head: () => ({ meta: [{ title: "Estadísticas — Finesa" }, { name: "description", content: "Estadísticas, estados y valor del inventario." }] }),
  component: Estadisticas,
});

type Fila = { nombre: string; cantidad: number; valor: number };
type Tipo = Fila & { disponibles: number; asignados: number; en_reparacion: number; de_baja: number; promedio: number | null };
type Stats = {
  total: number; valor_total: number; sin_valor: number; garantia_vencida: number; garantia_por_vencer: number;
  actas_firmadas_mes: number; actas_pendientes: number;
  por_estado: Record<string, number>; valor_por_estado: Record<string, number>;
  por_tipo: Tipo[]; por_marca: Fila[]; por_sede: Fila[]; top_proveedores: Fila[];
  ingresos_mes: { mes: string; cantidad: number; valor: number }[]; por_anio: { anio: number; cantidad: number }[];
  actas_mes: { mes: string; entregas: number; devoluciones: number }[];
};
const cop = (n: number | null | undefined) => `$${Math.round(Number(n ?? 0)).toLocaleString("es-CO")}`;
const COLORES = ["var(--primary)", "var(--chart-2, #134074)", "var(--chart-3, #8DA9C4)", "var(--chart-4, #E0A458)", "var(--destructive)", "var(--chart-5, #5A7D9A)"];
const etiquetaEstado = (k: string) => (ESTADO_EQUIPO as Record<string, { label: string } | undefined>)[k]?.label ?? k;

function Estadisticas() {
  const { data: me } = useMe();
  const cat = useCatalogos();
  const stock = useStockBajo();
  const [sede, setSede] = useState("");
  const [tipo, setTipo] = useState("");
  const q = useQuery({
    queryKey: ["estadisticas", sede, tipo], enabled: !!me?.isStaff, placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("estadisticas_inventario", { p_sede: sede || undefined, p_tipo: tipo || undefined } as never);
      if (error) throw error;
      return data as unknown as Stats;
    },
  });
  if (!me?.isStaff) return <p className="text-muted-foreground">Sin acceso.</p>;
  const s = q.data;
  const sel = "h-9 rounded-md border border-input bg-card px-3 text-sm";
  const estados = s ? Object.entries(s.por_estado).map(([k, n]) => ({ nombre: etiquetaEstado(k), cantidad: n })) : [];

  async function excel() {
    if (!s) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Indicador: "Total equipos", Valor: s.total }, { Indicador: "Valor total (sin bajas)", Valor: s.valor_total },
      ...Object.entries(s.por_estado).map(([k, n]) => ({ Indicador: `Equipos ${etiquetaEstado(k)}`, Valor: n })),
      ...Object.entries(s.valor_por_estado).map(([k, n]) => ({ Indicador: `Valor ${etiquetaEstado(k)}`, Valor: n })),
      { Indicador: "Sin valor registrado", Valor: s.sin_valor }, { Indicador: "Garantías vencidas", Valor: s.garantia_vencida }, { Indicador: "Garantías por vencer (90 días)", Valor: s.garantia_por_vencer },
    ]), "Resumen");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.por_tipo.map((t) => ({ Tipo: t.nombre, Cantidad: t.cantidad, Disponibles: t.disponibles, Asignados: t.asignados, "En reparación": t.en_reparacion, "De baja": t.de_baja, "Valor total": t.valor, "Valor promedio": t.promedio ?? 0 }))), "Por tipo");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.por_sede.map((t) => ({ Sede: t.nombre, Cantidad: t.cantidad, Valor: t.valor }))), "Por sede");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.por_marca.map((t) => ({ Marca: t.nombre, Cantidad: t.cantidad, Valor: t.valor }))), "Por marca");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.top_proveedores.map((t) => ({ Proveedor: t.nombre, Equipos: t.cantidad, Valor: t.valor }))), "Proveedores");
    XLSX.writeFile(wb, `estadisticas-inventario-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }
  async function pdf() {
    if (!s) return;
    const { jsPDF } = await import("jspdf").catch(() => ({ jsPDF: null as never }));
    if (!jsPDF) return window.print();
    window.print();
  }

  return (
    <div className="print:p-0">
      <PageHeader title="Estadísticas del inventario" desc="Estados, valor y movimiento de todo el inventario.">
        <select className={sel} value={sede} onChange={(e) => setSede(e.target.value)}><option value="">Todas las sedes</option>{cat.byTipo("sede").map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
        <select className={sel} value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todos los tipos</option>{cat.byTipo("tipo_equipo").map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
        <Button variant="outline" onClick={excel} disabled={!s}><Download className="mr-1 h-4 w-4" />Excel</Button>
        <Button variant="outline" onClick={pdf} disabled={!s}><FileText className="mr-1 h-4 w-4" />PDF</Button>
      </PageHeader>
      {!s ? <p className="text-muted-foreground">{q.error ? "No se pudieron cargar las estadísticas." : "Cargando estadísticas…"}</p> : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tarjeta label="Equipos totales" v={s.total.toLocaleString("es-CO")} />
            <Tarjeta label="Valor total del inventario" v={cop(s.valor_total)} sub="Sin contar dados de baja" destacado />
            <Tarjeta label="Valor asignado" v={cop(s.valor_por_estado.asignado)} sub={`${s.por_estado.asignado ?? 0} equipos`} />
            <Tarjeta label="Valor disponible" v={cop(s.valor_por_estado.disponible)} sub={`${s.por_estado.disponible ?? 0} equipos`} />
            <Tarjeta label="Valor en reparación" v={cop(s.valor_por_estado.en_reparacion)} sub={`${s.por_estado.en_reparacion ?? 0} equipos`} />
            <Tarjeta label="Valor dado de baja" v={cop(s.valor_por_estado.de_baja)} sub={`${s.por_estado.de_baja ?? 0} equipos`} />
            <Tarjeta label="Sin valor registrado" v={s.sin_valor.toLocaleString("es-CO")} sub="Equipos por completar" />
            <Tarjeta label="Actas" v={`${s.actas_firmadas_mes} firmadas`} sub={`este mes · ${s.actas_pendientes} pendientes`} />
            <Tarjeta label="Garantías vencidas" v={String(s.garantia_vencida)} />
            <Tarjeta label="Garantías por vencer" v={String(s.garantia_por_vencer)} sub="Próximos 90 días" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Grafico titulo="Equipos por estado">
              <PieChart><Pie data={estados} dataKey="cantidad" nameKey="nombre" outerRadius={90} label>{estados.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}</Pie><Tooltip /><Legend /></PieChart>
            </Grafico>
            <Grafico titulo="Equipos por tipo">
              <BarChart data={s.por_tipo.slice(0, 12)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="nombre" fontSize={11} interval={0} angle={-25} textAnchor="end" height={60} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="cantidad" name="Equipos" fill="var(--primary)" /></BarChart>
            </Grafico>
            <Grafico titulo="Valor por tipo">
              <BarChart data={[...s.por_tipo].sort((a, b) => b.valor - a.valor).slice(0, 12)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="nombre" fontSize={11} interval={0} angle={-25} textAnchor="end" height={60} /><YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1e6)}M`} /><Tooltip formatter={(v) => cop(Number(v))} /><Bar dataKey="valor" name="Valor" fill={COLORES[1]} /></BarChart>
            </Grafico>
            <Grafico titulo="Equipos y valor por sede">
              <BarChart data={s.por_sede}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="nombre" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v, n) => (n === "Valor" ? cop(Number(v)) : v)} /><Bar dataKey="cantidad" name="Equipos" fill="var(--primary)" /></BarChart>
            </Grafico>
            <Grafico titulo="Equipos por marca (top 15)">
              <BarChart data={s.por_marca} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" fontSize={11} /><YAxis type="category" dataKey="nombre" width={100} fontSize={11} /><Tooltip /><Bar dataKey="cantidad" name="Equipos" fill={COLORES[2]} /></BarChart>
            </Grafico>
            <Grafico titulo="Ingresos de equipos (últimos 12 meses)">
              <LineChart data={s.ingresos_mes}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Line dataKey="cantidad" name="Equipos" stroke="var(--primary)" strokeWidth={2} /></LineChart>
            </Grafico>
            <Grafico titulo="Entregas vs devoluciones firmadas">
              <BarChart data={s.actas_mes}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="entregas" name="Entregas" fill="var(--primary)" /><Bar dataKey="devoluciones" name="Devoluciones" fill={COLORES[3]} /></BarChart>
            </Grafico>
            <Grafico titulo="Antigüedad por año de compra">
              <BarChart data={s.por_anio}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="anio" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="cantidad" name="Equipos" fill={COLORES[5]} /></BarChart>
            </Grafico>
          </div>

          <Tabla titulo="Resumen por tipo de equipo" cols={["Tipo", "Cantidad", "Disponibles", "Asignados", "En reparación", "De baja", "Valor total", "Valor promedio"]}
            filas={s.por_tipo.map((t) => [t.nombre, t.cantidad, t.disponibles, t.asignados, t.en_reparacion, t.de_baja, cop(t.valor), t.promedio != null ? cop(t.promedio) : "—"])} />
          <div className="grid gap-6 lg:grid-cols-2">
            <Tabla titulo="Top proveedores por valor" cols={["Proveedor", "Equipos", "Valor"]} filas={s.top_proveedores.map((p) => [p.nombre, p.cantidad, cop(p.valor)])} />
            <Tabla titulo="Alertas de stock bajo" cols={["Tipo", "Disponibles", "Mínimo"]} filas={(stock.data ?? []).map((a) => [a.tipo, a.disponibles, a.stock_minimo])} vacio="Sin alertas de stock bajo." />
          </div>
        </div>
      )}
    </div>
  );
}

function Tarjeta({ label, v, sub, destacado }: { label: string; v: string; sub?: string; destacado?: boolean }) {
  return (
    <div className={`rounded-md border p-4 ${destacado ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
      <div className={`text-xs uppercase tracking-wide ${destacado ? "opacity-80" : "text-muted-foreground"}`}>{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{v}</div>
      {sub && <div className={`text-xs ${destacado ? "opacity-80" : "text-muted-foreground"}`}>{sub}</div>}
    </div>
  );
}
function Grafico({ titulo, children }: { titulo: string; children: React.ReactElement }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="mb-2 text-sm font-medium">{titulo}</div>
      <div className="h-72"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
    </div>
  );
}
function Tabla({ titulo, cols, filas, vacio = "Sin datos." }: { titulo: string; cols: string[]; filas: (string | number)[][]; vacio?: string }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <div className="border-b border-border px-4 py-3 text-sm font-medium">{titulo}</div>
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr>{cols.map((c, i) => <th key={c} className={`px-4 py-2 ${i ? "text-right" : ""}`}>{c}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">
          {filas.map((f, i) => <tr key={i}>{f.map((c, j) => <td key={j} className={`px-4 py-2 ${j ? "text-right tabular-nums" : ""}`}>{c}</td>)}</tr>)}
          {!filas.length && <tr><td colSpan={cols.length} className="px-4 py-6 text-center text-muted-foreground">{vacio}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
