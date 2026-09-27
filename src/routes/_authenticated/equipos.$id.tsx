import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { useCatalogos } from "@/lib/catalogos";
import { errMsg, fmtFecha } from "@/lib/constantes";
import { PageHeader, EstadoEquipo } from "@/components/Estado";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/equipos/$id")({
  head: () => ({ meta: [{ title: "Ficha del equipo — Finesa" }, { name: "description", content: "Datos e historial del equipo." }] }),
  component: FichaEquipo,
});

const EVENTOS: Record<string, string> = {
  ingreso: "Ingreso", entrega: "Entrega", devolucion: "Devolución", en_reparacion: "En reparación", de_baja: "De baja",
  disponible: "Disponible", correccion_serie: "Corrección de serie", acta_anulada: "Acta anulada",
};

function FichaEquipo() {
  const { id } = Route.useParams();
  const { data: me } = useMe();
  const cat = useCatalogos();
  const q = useQuery({
    queryKey: ["equipo", id],
    queryFn: async () => {
      const [e, h] = await Promise.all([
        supabase.from("equipos").select("*, empleado:empleados(id, nombre)").eq("id", id).maybeSingle(),
        supabase.from("equipo_historial").select("*").eq("equipo_id", id).order("created_at", { ascending: true }),
      ]);
      if (e.error) throw e.error;
      return { e: e.data, h: h.data ?? [] };
    },
  });
  const e = q.data?.e;
  if (q.isLoading) return <p className="text-muted-foreground">Cargando…</p>;
  if (!e) return <p className="text-muted-foreground">Equipo no encontrado.</p>;

  async function verFactura() {
    const { data, error } = await supabase.storage.from("facturas").createSignedUrl(e!.factura_path!, 120);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  }

  const emp = e.empleado as { id: string; nombre: string } | null;
  return (
    <div>
      <PageHeader title={e.serie} desc={`${cat.nombre(e.tipo_id)} · ${cat.nombre(e.marca_id)} ${e.modelo ?? ""}`}>
        <EstadoEquipo estado={e.estado} />
        {me?.can("equipos_editar") && <EditarEquipo e={e} />}
        {me?.can("equipos_editar") && e.estado !== "asignado" && e.estado !== "de_baja" && <CambiarEstado id={e.id} actual={e.estado} admin={!!me?.isAdmin} />}
        {me?.isAdmin && <CorregirSerie id={e.id} serie={e.serie} />}
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-3">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-md border border-border bg-card p-5 text-sm lg:col-span-1">
          <Dato k="Sede" v={cat.nombre(e.sede_id)} />
          <Dato k="Asignado a" v={emp ? <Link to="/empleados/$id" params={{ id: emp.id }} className="text-primary hover:underline">{emp.nombre}</Link> : "—"} />
          <Dato k="Fecha de ingreso" v={fmtFecha(e.fecha_ingreso)} />
          <Dato k="Fin de garantía" v={fmtFecha(e.garantia_fin)} />
          <Dato k="Proveedor" v={e.proveedor ?? "—"} />
          <Dato k="Código interno" v={e.codigo_interno ? "Sí" : "No"} />
          <div className="col-span-2"><dt className="text-xs text-muted-foreground">Observaciones</dt><dd className="whitespace-pre-wrap">{e.observaciones || "—"}</dd></div>
          {e.factura_path && <div className="col-span-2"><Button size="sm" variant="outline" onClick={verFactura}>Ver factura</Button></div>}
        </dl>
        <div className="rounded-md border border-border bg-card lg:col-span-2">
          <div className="border-b border-border px-5 py-3 font-medium">Historial</div>
          <ol className="relative space-y-0 p-5">
            {q.data!.h.map((h) => (
              <li key={h.id} className="relative border-l-2 border-accent pb-5 pl-5 last:pb-0">
                <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-primary" />
                <div className="text-xs text-muted-foreground">{fmtFecha(h.created_at, true)}</div>
                <div className="font-medium">{EVENTOS[h.evento] ?? h.evento}</div>
                {h.detalle && <div className="text-sm text-muted-foreground">{h.detalle}</div>}
                {h.acta_id && <Link to="/actas/$id" params={{ id: h.acta_id }} className="text-xs text-primary hover:underline">Ver acta</Link>}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function Dato({ k, v }: { k: string; v: React.ReactNode }) {
  return <div><dt className="text-xs text-muted-foreground">{k}</dt><dd>{v}</dd></div>;
}

type Eq = { id: string; modelo: string | null; marca_id: string | null; sede_id: string | null; proveedor: string | null; garantia_fin: string | null; observaciones: string | null };

function EditarEquipo({ e }: { e: Eq }) {
  const qc = useQueryClient();
  const cat = useCatalogos();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ modelo: e.modelo ?? "", marca_id: e.marca_id ?? "", sede_id: e.sede_id ?? "", proveedor: e.proveedor ?? "", garantia_fin: e.garantia_fin ?? "", observaciones: e.observaciones ?? "" });
  async function guardar() {
    const { error } = await supabase.from("equipos").update({ modelo: f.modelo || null, marca_id: f.marca_id || null, sede_id: f.sede_id || null, proveedor: f.proveedor || null, garantia_fin: f.garantia_fin || null, observaciones: f.observaciones || null }).eq("id", e.id);
    if (error) return toast.error(errMsg(error));
    toast.success("Equipo actualizado"); setOpen(false);
    qc.invalidateQueries({ queryKey: ["equipo", e.id] }); qc.invalidateQueries({ queryKey: ["equipos"] });
  }
  const s = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline">Editar</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar equipo</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1"><Label>Marca</Label><select className={s} value={f.marca_id} onChange={(x) => setF({ ...f, marca_id: x.target.value })}><option value="">—</option>{cat.byTipo("marca").map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
          <div className="space-y-1"><Label>Modelo</Label><Input value={f.modelo} onChange={(x) => setF({ ...f, modelo: x.target.value })} /></div>
          <div className="space-y-1"><Label>Sede</Label><select className={s} value={f.sede_id} onChange={(x) => setF({ ...f, sede_id: x.target.value })}><option value="">—</option>{cat.byTipo("sede").map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
          <div className="space-y-1"><Label>Proveedor</Label><Input value={f.proveedor} onChange={(x) => setF({ ...f, proveedor: x.target.value })} /></div>
          <div className="space-y-1"><Label>Fin de garantía</Label><Input type="date" value={f.garantia_fin} onChange={(x) => setF({ ...f, garantia_fin: x.target.value })} /></div>
          <div className="space-y-1"><Label>Observaciones</Label><Textarea value={f.observaciones} onChange={(x) => setF({ ...f, observaciones: x.target.value })} /></div>
          <p className="text-xs text-muted-foreground">La serie no es editable. El Administrador puede corregirla indicando un motivo.</p>
        </div>
        <DialogFooter><Button onClick={guardar}>Guardar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CambiarEstado({ id, actual, admin }: { id: string; actual: string; admin: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [estado, setEstado] = useState(actual === "en_reparacion" ? "disponible" : "en_reparacion");
  const [motivo, setMotivo] = useState("");
  async function guardar() {
    if (!motivo.trim()) return toast.error("El motivo es obligatorio");
    const { error } = await supabase.rpc("cambiar_estado_equipo", { p_equipo: id, p_estado: estado as "disponible", p_motivo: motivo.trim() });
    if (error) return toast.error(errMsg(error));
    toast.success("Estado actualizado"); setOpen(false); setMotivo("");
    qc.invalidateQueries({ queryKey: ["equipo", id] }); qc.invalidateQueries({ queryKey: ["equipos"] });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline">Cambiar estado</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Cambiar estado</DialogTitle></DialogHeader>
        <select className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" value={estado} onChange={(e) => setEstado(e.target.value)}>
          {actual !== "disponible" && <option value="disponible">Disponible</option>}
          {actual !== "en_reparacion" && <option value="en_reparacion">En reparación</option>}
          {admin && <option value="de_baja">De baja (definitivo)</option>}
        </select>
        <div className="space-y-1"><Label>Motivo *</Label><Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
        <DialogFooter><Button onClick={guardar} variant={estado === "de_baja" ? "destructive" : "default"}>Confirmar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CorregirSerie({ id, serie }: { id: string; serie: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nueva, setNueva] = useState(serie);
  const [motivo, setMotivo] = useState("");
  async function guardar() {
    const { error } = await supabase.rpc("corregir_serie", { p_equipo: id, p_serie: nueva, p_motivo: motivo });
    if (error) return toast.error(error.code === "23505" ? "Esa serie ya existe." : errMsg(error));
    toast.success("Serie corregida"); setOpen(false);
    qc.invalidateQueries({ queryKey: ["equipo", id] }); qc.invalidateQueries({ queryKey: ["equipos"] });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost">Corregir serie</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Corregir número de serie</DialogTitle></DialogHeader>
        <div className="space-y-1"><Label>Nueva serie</Label><Input value={nueva} onChange={(e) => setNueva(e.target.value)} /></div>
        <div className="space-y-1"><Label>Motivo de la corrección *</Label><Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
        <DialogFooter><Button onClick={guardar} disabled={!motivo.trim() || !nueva.trim()}>Corregir</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
