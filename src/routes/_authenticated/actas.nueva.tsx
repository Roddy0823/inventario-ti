import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { useCatalogos } from "@/lib/catalogos";
import { errMsg } from "@/lib/constantes";
import { PageHeader } from "@/components/Estado";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/actas/nueva")({
  head: () => ({ meta: [{ title: "Nueva acta — Finesa" }, { name: "description", content: "Crear acta de entrega o devolución." }] }),
  component: NuevaActa,
});

function NuevaActa() {
  const { data: me } = useMe();
  const cat = useCatalogos();
  const nav = useNavigate();
  const [tipo, setTipo] = useState<"entrega" | "devolucion">(me?.can("actas_entrega") ? "entrega" : "devolucion");
  const [empleadoId, setEmpleadoId] = useState("");
  const [buscaEmp, setBuscaEmp] = useState("");
  const [buscaEq, setBuscaEq] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [obs, setObs] = useState("");
  const [loading, setLoading] = useState(false);

  const emps = useQuery({ queryKey: ["empleados"], queryFn: () => fetchAll((a, b) => supabase.from("empleados").select("*").order("nombre").order("id").range(a, b)) });
  const eqs = useQuery({ queryKey: ["equipos"], queryFn: () => fetchAll((a, b) => supabase.from("equipos").select("*, empleado:empleados(id, nombre)").order("created_at", { ascending: false }).order("id").range(a, b)) });

  const empleados = (emps.data ?? []).filter((e) => (tipo === "devolucion" || e.activo) && (!buscaEmp || e.nombre.toLowerCase().includes(buscaEmp.toLowerCase()) || e.identificacion.includes(buscaEmp)));
  const disponibles = useMemo(() => (eqs.data ?? []).filter((e) =>
    (tipo === "entrega" ? e.estado === "disponible" : e.estado === "asignado" && e.empleado_id === empleadoId) &&
    (!buscaEq || e.serie.toLowerCase().includes(buscaEq.toLowerCase()) || (e.modelo ?? "").toLowerCase().includes(buscaEq.toLowerCase()))), [eqs.data, tipo, empleadoId, buscaEq]);

  if (!me?.can("actas_entrega") && !me?.can("actas_devolucion")) return <p className="text-muted-foreground">No tiene permiso para crear actas.</p>;

  async function crear() {
    if (!empleadoId) return toast.error("Seleccione un empleado");
    if (!sel.length) return toast.error("Seleccione al menos un equipo");
    setLoading(true);
    try {
      const { data: acta, error } = await supabase.from("actas").insert({ tipo, empleado_id: empleadoId, tecnico_id: me!.id, observaciones: obs || null }).select("id").single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("acta_items").insert(sel.map((equipo_id) => ({ acta_id: acta.id, equipo_id })));
      if (e2) throw e2;
      toast.success("Acta creada. Proceda con la firma.");
      nav({ to: "/actas/$id", params: { id: acta.id } });
    } catch (e) { toast.error(errMsg(e)); } finally { setLoading(false); }
  }

  const empSel = emps.data?.find((e) => e.id === empleadoId);
  return (
    <div className="max-w-4xl">
      <PageHeader title="Nueva acta" desc="Seleccione empleado y equipos. El estado de los equipos cambia solo cuando el acta queda firmada." />
      <div className="mb-6 inline-flex rounded-md border border-border bg-card p-1">
        {me.can("actas_entrega") && <button onClick={() => { setTipo("entrega"); setSel([]); }} className={`rounded px-4 py-1.5 text-sm ${tipo === "entrega" ? "bg-primary text-primary-foreground" : ""}`}>Entrega</button>}
        {me.can("actas_devolucion") && <button onClick={() => { setTipo("devolucion"); setSel([]); }} className={`rounded px-4 py-1.5 text-sm ${tipo === "devolucion" ? "bg-primary text-primary-foreground" : ""}`}>Devolución</button>}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-md border border-border bg-card p-4">
          <Label className="mb-2 block">1. Empleado {tipo === "entrega" && "(solo activos)"}</Label>
          <Input placeholder="Buscar…" value={buscaEmp} onChange={(e) => setBuscaEmp(e.target.value)} className="mb-2" />
          <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded border border-border">
            {empleados.map((e) => (
              <li key={e.id}>
                <button onClick={() => { setEmpleadoId(e.id); setSel([]); }} className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${empleadoId === e.id ? "bg-accent" : ""}`}>
                  <div className="font-medium">{e.nombre}</div><div className="text-xs text-muted-foreground">{e.identificacion} · {cat.nombre(e.area_id)}</div>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-md border border-border bg-card p-4">
          <Label className="mb-2 block">2. Equipos {tipo === "entrega" ? "disponibles (puede agregar periféricos)" : `asignados a ${empSel?.nombre ?? "…"}`}</Label>
          <Input placeholder="Buscar serie o modelo…" value={buscaEq} onChange={(e) => setBuscaEq(e.target.value)} className="mb-2" />
          <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded border border-border">
            {disponibles.map((e) => (
              <li key={e.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted">
                  <Checkbox checked={sel.includes(e.id)} onCheckedChange={(c) => setSel(c ? [...sel, e.id] : sel.filter((x) => x !== e.id))} />
                  <span className="flex-1">{cat.nombre(e.tipo_id)} {cat.nombre(e.marca_id)} {e.modelo}</span>
                  <span className="font-mono text-xs text-muted-foreground">{e.serie}</span>
                </label>
              </li>
            ))}
            {!disponibles.length && <li className="px-3 py-6 text-center text-sm text-muted-foreground">{tipo === "devolucion" && !empleadoId ? "Seleccione un empleado" : "Sin equipos"}</li>}
          </ul>
        </section>
      </div>
      <div className="mt-6 space-y-2">
        <Label>3. Observaciones</Label>
        <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Estado físico, accesorios, novedades…" />
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={crear} disabled={loading}>Crear acta y continuar a la firma ({sel.length} equipo{sel.length === 1 ? "" : "s"})</Button>
      </div>
    </div>
  );
}
