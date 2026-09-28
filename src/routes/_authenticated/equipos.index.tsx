import { fetchAll } from "@/lib/fetchAll";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { useCatalogos } from "@/lib/catalogos";
import { ESTADO_EQUIPO, errMsg, fmtFecha } from "@/lib/constantes";
import { FinalizarReparacion } from "@/components/FinalizarReparacion";

import { PageHeader, EstadoEquipo } from "@/components/Estado";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/equipos/")({
  validateSearch: (s: Record<string, unknown>): { tab?: "activos" | "en_reparacion" | "de_baja" | undefined; estado?: "disponible" | "asignado" | undefined } => ({
    tab: s.tab === "en_reparacion" || s.tab === "de_baja" || s.tab === "activos" ? s.tab : undefined,
    estado: s.estado === "disponible" || s.estado === "asignado" ? s.estado : undefined,
  }),
  head: () => ({ meta: [{ title: "Inventario — Finesa" }, { name: "description", content: "Equipos de cómputo y periféricos." }] }),
  component: Equipos,
});

export const equiposQuery = {
  queryKey: ["equipos"],
  queryFn: async () => {
    return fetchAll((a, b) => supabase.from("equipos").select("*, empleado:empleados(id, nombre)").order("created_at", { ascending: false }).order("id").range(a, b));
  },
};

const sel = "h-9 rounded-md border border-input bg-card px-3 text-sm";

type Pestana = "activos" | "en_reparacion" | "de_baja";

function Equipos() {
  const { data: me } = useMe();
  const cat = useCatalogos();
  const q = useQuery(equiposQuery);
  const sp = Route.useSearch();
  const [tab, setTab] = useState<Pestana>(sp.tab ?? "activos");
  const [f, setF] = useState({ texto: "", tipo: "", marca: "", estado: sp.estado ?? "", sede: "" });
  useEffect(() => { setTab(sp.tab ?? "activos"); setF((x) => ({ ...x, estado: sp.estado ?? "" })); }, [sp.tab, sp.estado]);
  const conteo = useMemo(() => {
    const d = q.data ?? [];
    return { activos: d.filter((e) => e.estado === "disponible" || e.estado === "asignado").length, en_reparacion: d.filter((e) => e.estado === "en_reparacion").length, de_baja: d.filter((e) => e.estado === "de_baja").length };
  }, [q.data]);
  const lista = useMemo(() => {
    const t = f.texto.trim().toLowerCase();
    return (q.data ?? []).filter((e) =>
      (tab === "activos" ? (e.estado === "disponible" || e.estado === "asignado") : e.estado === tab) &&
      (!t || e.serie.toLowerCase().includes(t) || (e.activo_fijo ?? "").toLowerCase().includes(t) || (e.modelo ?? "").toLowerCase().includes(t) || ((e.empleado as { nombre: string } | null)?.nombre ?? "").toLowerCase().includes(t)) &&
      (!f.tipo || e.tipo_id === f.tipo) && (!f.marca || e.marca_id === f.marca) && (tab !== "activos" || !f.estado || e.estado === f.estado) && (!f.sede || e.sede_id === f.sede));
  }, [q.data, f, tab]);

  const tabs: [Pestana, string][] = [["activos", "Activos"], ["en_reparacion", "En reparación"], ["de_baja", "Dados de baja"]];
  return (
    <div>
      <PageHeader title="Inventario" desc={`${lista.length} equipo(s)`}>
        {me?.can("equipos_editar") && <NuevoEquipo />}
      </PageHeader>
      <div className="mb-4 flex gap-1 border-b border-border">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {l} <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs">{conteo[k]}</span>
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder="Buscar por serie, activo fijo, modelo o empleado" className="w-full sm:w-80" value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} />
        <select className={sel} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}><option value="">Tipo</option>{cat.byTipo("tipo_equipo", false).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
        <select className={sel} value={f.marca} onChange={(e) => setF({ ...f, marca: e.target.value })}><option value="">Marca</option>{cat.byTipo("marca", false).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
        {tab === "activos" && <select className={sel} value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}><option value="">Estado</option><option value="disponible">Disponible</option><option value="asignado">Asignado</option></select>}
        <select className={sel} value={f.sede} onChange={(e) => setF({ ...f, sede: e.target.value })}><option value="">Sede</option>{cat.byTipo("sede", false).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
      </div>
      {tab !== "activos" ? <ListaEspecial tab={tab} lista={lista} puedeEditar={!!me?.can("equipos_editar")} /> : (
      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">Serie / código</th><th className="px-4 py-2">Tipo</th><th className="px-4 py-2">Marca / modelo</th><th className="px-4 py-2">Sede</th><th className="px-4 py-2">Asignado a</th><th className="px-4 py-2">Estado</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lista.map((e) => (
              <tr key={e.id} className="hover:bg-muted/50">
                <td className="px-4 py-2.5"><Link to="/equipos/$id" params={{ id: e.id }} className="font-mono text-xs font-medium text-primary hover:underline">{e.serie}</Link>{e.activo_fijo && <div className="font-mono text-[11px] text-muted-foreground">{e.activo_fijo}</div>}</td>
                <td className="px-4 py-2.5">{cat.nombre(e.tipo_id)}</td>
                <td className="px-4 py-2.5">{cat.nombre(e.marca_id)} {e.modelo}</td>
                <td className="px-4 py-2.5">{cat.nombre(e.sede_id)}</td>
                <td className="px-4 py-2.5">{(e.empleado as { nombre: string } | null)?.nombre ?? "—"}</td>
                <td className="px-4 py-2.5"><EstadoEquipo estado={e.estado} /></td>
              </tr>
            ))}
            {!q.isLoading && !lista.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No hay equipos que coincidan.</td></tr>}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

type Eq = { id: string; serie: string; activo_fijo: string | null; tipo_id: string; marca_id: string | null; modelo: string | null; sede_id: string | null; estado: string; empleado: unknown };

function ListaEspecial({ tab, lista, puedeEditar }: { tab: "en_reparacion" | "de_baja"; lista: Eq[]; puedeEditar: boolean }) {
  const cat = useCatalogos();
  const hq = useQuery({
    queryKey: ["equipos", "eventos", tab, lista.map((e) => e.id).join(",")],
    enabled: lista.length > 0,
    queryFn: async () => {
      const ids = lista.map((e) => e.id);
      const filas: { equipo_id: string; detalle: string | null; created_at: string; user_id: string | null }[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await supabase.from("equipo_historial").select("equipo_id, detalle, created_at, user_id").eq("evento", tab).in("equipo_id", ids.slice(i, i + 200)).order("created_at", { ascending: false });
        filas.push(...(data ?? []));
      }
      const ultimo: Record<string, (typeof filas)[number]> = {};
      for (const r of filas) if (!ultimo[r.equipo_id]) ultimo[r.equipo_id] = r;
      const uids = [...new Set(Object.values(ultimo).map((r) => r.user_id).filter(Boolean))] as string[];
      const { data: ps } = uids.length ? await supabase.from("profiles").select("id, nombre, email").in("id", uids) : { data: [] };
      const usuarios = Object.fromEntries((ps ?? []).map((p) => [p.id, p.nombre || p.email]));
      return { ultimo, usuarios };
    },
  });
  const info = (id: string) => {
    const r = hq.data?.ultimo[id];
    const d = r?.detalle ?? "";
    return {
      fecha: r ? fmtFecha(r.created_at) : "—",
      motivo: d.match(/Motivo:\s*(.*)$/)?.[1] ?? "—",
      anterior: d.match(/Responsable:\s*(.*?)\s*→/)?.[1] ?? "—",
      por: r?.user_id ? hq.data?.usuarios[r.user_id] ?? "Usuario" : "—",
    };
  };
  async function exportar() {
    const XLSX = await import("xlsx");
    const filas = lista.map((e) => {
      const i = info(e.id);
      const emp = (e.empleado as { nombre: string } | null)?.nombre ?? "";
      return tab === "en_reparacion"
        ? { Serie: e.serie, "Activo fijo": e.activo_fijo ?? "", Tipo: cat.nombre(e.tipo_id), Marca: cat.nombre(e.marca_id), Modelo: e.modelo ?? "", Empleado: emp, Desde: i.fecha, Motivo: i.motivo }
        : { Serie: e.serie, "Activo fijo": e.activo_fijo ?? "", Tipo: cat.nombre(e.tipo_id), Marca: cat.nombre(e.marca_id), Modelo: e.modelo ?? "", "Último responsable": i.anterior, "Fecha de baja": i.fecha, Motivo: i.motivo, "Dado de baja por": i.por };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), tab === "en_reparacion" ? "En reparación" : "Dados de baja");
    XLSX.writeFile(wb, tab === "en_reparacion" ? "equipos-en-reparacion.xlsx" : "equipos-dados-de-baja.xlsx");
  }
  const th = "px-4 py-2";
  return (
    <div>
      <div className="mb-2 flex justify-end"><Button variant="outline" size="sm" onClick={exportar} disabled={!lista.length}>Exportar a Excel</Button></div>
      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            {tab === "en_reparacion"
              ? <tr><th className={th}>Serie / código</th><th className={th}>Equipo</th><th className={th}>Empleado ligado</th><th className={th}>Desde</th><th className={th}>Motivo</th><th className={th}></th></tr>
              : <tr><th className={th}>Serie / código</th><th className={th}>Equipo</th><th className={th}>Último responsable</th><th className={th}>Fecha de baja</th><th className={th}>Motivo</th><th className={th}>Por</th></tr>}
          </thead>
          <tbody className="divide-y divide-border">
            {lista.map((e) => {
              const i = info(e.id);
              const emp = e.empleado as { id: string; nombre: string } | null;
              return (
                <tr key={e.id} className="hover:bg-muted/50">
                  <td className="px-4 py-2.5"><Link to="/equipos/$id" params={{ id: e.id }} className="font-mono text-xs font-medium text-primary hover:underline">{e.serie}</Link>{e.activo_fijo && <div className="font-mono text-[11px] text-muted-foreground">{e.activo_fijo}</div>}</td>
                  <td className="px-4 py-2.5">{cat.nombre(e.tipo_id)} · {cat.nombre(e.marca_id)} {e.modelo}</td>
                  {tab === "en_reparacion"
                    ? <td className="px-4 py-2.5">{emp ? <Link to="/empleados/$id" params={{ id: emp.id }} className="text-primary hover:underline">{emp.nombre}</Link> : "—"}</td>
                    : <td className="px-4 py-2.5">{i.anterior}</td>}
                  <td className="px-4 py-2.5 whitespace-nowrap">{i.fecha}</td>
                  <td className="px-4 py-2.5 max-w-xs">{i.motivo}</td>
                  {tab === "en_reparacion"
                    ? <td className="px-4 py-2.5 text-right">{puedeEditar && <FinalizarReparacion id={e.id} empleado={emp?.nombre ?? null} size="sm" />}</td>
                    : <td className="px-4 py-2.5">{i.por}</td>}
                </tr>
              );
            })}
            {!lista.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No hay equipos en esta sección.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NuevoEquipo() {
  const qc = useQueryClient();
  const cat = useCatalogos();
  const [open, setOpen] = useState(false);
  const vacio = { tipo_id: "", marca_id: "", sede_id: "", modelo: "", serie: "", fecha_ingreso: new Date().toISOString().slice(0, 10), estado: "disponible", observaciones: "", proveedor: "", garantia_fin: "" };
  const [f, setF] = useState(vacio);
  const [factura, setFactura] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.tipo_id) return toast.error("Seleccione el tipo de equipo");
    setLoading(true);
    try {
      let factura_path: string | null = null;
      if (factura) {
        if (factura.size > 10 * 1024 * 1024) throw new Error("La factura supera 10 MB");
        const ext = factura.name.split(".").pop()?.toLowerCase() ?? "pdf";
        factura_path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("facturas").upload(factura_path, factura, { contentType: factura.type });
        if (error) throw error;
      }
      const { data, error } = await supabase.from("equipos").insert({
        tipo_id: f.tipo_id, marca_id: f.marca_id || null, sede_id: f.sede_id || null, modelo: f.modelo || null,
        serie: f.serie.trim(), fecha_ingreso: f.fecha_ingreso, estado: f.estado as "disponible", observaciones: f.observaciones || null,
        proveedor: f.proveedor || null, garantia_fin: f.garantia_fin || null, factura_path,
      }).select("serie").single();
      if (error) throw error.code === "23505" ? new Error("Ya existe un equipo con esa serie o código.") : error;
      toast.success(`Equipo registrado: ${data.serie}`);
      setF(vacio); setFactura(null); setOpen(false);
      qc.invalidateQueries({ queryKey: ["equipos"] });
    } catch (e) { toast.error(errMsg(e)); } finally { setLoading(false); }
  }

  const opt = (tipo: string) => cat.byTipo(tipo).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>Registrar equipo</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Registrar equipo</DialogTitle></DialogHeader>
        <form onSubmit={guardar} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Tipo de equipo *</Label><select className={sel + " w-full"} value={f.tipo_id} onChange={(e) => setF({ ...f, tipo_id: e.target.value })} required><option value="">Seleccione…</option>{opt("tipo_equipo")}</select></div>
          <div className="space-y-1.5"><Label>Marca</Label><select className={sel + " w-full"} value={f.marca_id} onChange={(e) => setF({ ...f, marca_id: e.target.value })}><option value="">—</option>{opt("marca")}</select></div>
          <div className="space-y-1.5"><Label>Modelo</Label><Input value={f.modelo} onChange={(e) => setF({ ...f, modelo: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Número de serie</Label><Input value={f.serie} placeholder="Vacío = código FIN-ACC automático" onChange={(e) => setF({ ...f, serie: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Sede</Label><select className={sel + " w-full"} value={f.sede_id} onChange={(e) => setF({ ...f, sede_id: e.target.value })}><option value="">—</option>{opt("sede")}</select></div>
          <div className="space-y-1.5"><Label>Estado inicial</Label><select className={sel + " w-full"} value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}><option value="disponible">Disponible</option><option value="en_reparacion">En reparación</option></select></div>
          <div className="space-y-1.5"><Label>Fecha de ingreso</Label><Input type="date" value={f.fecha_ingreso} onChange={(e) => setF({ ...f, fecha_ingreso: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Fin de garantía</Label><Input type="date" value={f.garantia_fin} onChange={(e) => setF({ ...f, garantia_fin: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Proveedor</Label><Input value={f.proveedor} onChange={(e) => setF({ ...f, proveedor: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Factura (PDF o imagen)</Label><Input type="file" accept="application/pdf,image/*" onChange={(e) => setFactura(e.target.files?.[0] ?? null)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Observaciones</Label><Textarea value={f.observaciones} onChange={(e) => setF({ ...f, observaciones: e.target.value })} /></div>
          <DialogFooter className="sm:col-span-2"><Button type="submit" disabled={loading}>Guardar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
