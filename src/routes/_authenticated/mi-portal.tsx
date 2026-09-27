import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { useCatalogos } from "@/lib/catalogos";
import { TIPO_ACTA, errMsg, fmtFecha } from "@/lib/constantes";
import { firmarComoEmpleado, urlArchivo } from "@/lib/firmas.functions";
import { descargarPdfActa } from "@/lib/descargarPdf";
import { PageHeader, EstadoActa } from "@/components/Estado";
import { ActaResumen } from "@/components/ActaResumen";
import { SignaturePad } from "@/components/SignaturePad";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mi-portal")({
  head: () => ({ meta: [{ title: "Mis equipos y actas — Finesa" }, { name: "description", content: "Portal del empleado." }] }),
  component: Portal,
});

function Portal() {
  const { data: me } = useMe();
  const cat = useCatalogos();
  const url = useServerFn(urlArchivo);
  const [abierta, setAbierta] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["portal"],
    enabled: !!me,
    queryFn: async () => {
      const { data: emp } = await supabase.from("empleados").select("*").eq("user_id", me!.id).maybeSingle();
      if (!emp) return null;
      const [eq, ac] = await Promise.all([
        supabase.from("equipos").select("*").eq("empleado_id", emp.id).in("estado", ["asignado", "en_reparacion"]),
        supabase.from("actas").select("*, items:acta_items(equipo:equipos(*))").eq("empleado_id", emp.id).order("created_at", { ascending: false }),
      ]);
      return { emp, equipos: eq.data ?? [], actas: ac.data ?? [] };
    },
  });
  if (q.isLoading) return <p className="text-muted-foreground">Cargando…</p>;
  if (!q.data) return <p className="text-muted-foreground">Su cuenta no está vinculada a un empleado. Contacte a soporte.</p>;
  const { emp, equipos, actas } = q.data;
  const pendientes = actas.filter((a) => a.estado === "pendiente");
  const reparacion = equipos.filter((e) => e.estado === "en_reparacion");
  const historial = actas.filter((a) => a.estado !== "pendiente");
  const actaAbierta = actas.find((a) => a.id === abierta);

  async function descargar(id: string, numero: number) {
    await descargarPdfActa(url, id, `acta-${numero}.pdf`);
  }


  return (
    <div className="max-w-4xl">
      <PageHeader title={`Hola, ${emp.nombre.split(" ")[0]}`} desc="Sus equipos asignados y actas." />
      {reparacion.length > 0 && (
        <section className="mb-8 rounded-md border border-warning/40 bg-warning/10 p-4">
          <div className="mb-2 flex items-center gap-2 font-bold"><Wrench className="h-4 w-4" />Tiene {reparacion.length} equipo(s) en reparación</div>
          <ul className="space-y-1 text-sm">
            {reparacion.map((e) => <li key={e.id}>{cat.nombre(e.tipo_id)} {cat.nombre(e.marca_id)} {e.modelo} · <span className="font-mono text-xs">{e.serie}</span> <span className="text-muted-foreground">· desde {fmtFecha(e.updated_at)}</span></li>)}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Mesa de ayuda le informará cuando el equipo esté listo. Sigue a su cargo mientras se repara.</p>
        </section>
      )}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold">Pendientes de firma ({pendientes.length})</h2>
        {pendientes.length ? (
          <div className="space-y-2">
            {pendientes.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 p-4">
                <div><div className="font-medium">Acta de {TIPO_ACTA[a.tipo]?.toLowerCase()} #{a.numero}</div><div className="text-xs text-muted-foreground">{fmtFecha(a.created_at, true)} · {a.items.length} equipo(s)</div></div>
                <Button onClick={() => setAbierta(a.id)}>Revisar y firmar</Button>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">No tiene actas pendientes.</p>}
      </section>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-md border border-border bg-card">
          <div className="border-b border-border px-5 py-3 font-medium">Equipos a mi cargo ({equipos.length})</div>
          <ul className="divide-y divide-border">
            {equipos.map((e) => <li key={e.id} className="flex items-center justify-between gap-2 px-5 py-3 text-sm"><span>{cat.nombre(e.tipo_id)} {cat.nombre(e.marca_id)} {e.modelo}<div className="font-mono text-xs text-muted-foreground">{e.serie}</div></span>{e.estado === "en_reparacion" && <EstadoEquipo estado={e.estado} />}</li>)}
            {!equipos.length && <li className="px-5 py-6 text-sm text-muted-foreground">No tiene equipos asignados.</li>}
          </ul>
        </section>
        <section className="rounded-md border border-border bg-card">
          <div className="border-b border-border px-5 py-3 font-medium">Historial de actas</div>
          <ul className="divide-y divide-border">
            {historial.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 px-5 py-3 text-sm">
                <span>{TIPO_ACTA[a.tipo]} #{a.numero}<div className="text-xs text-muted-foreground">{fmtFecha(a.firmado_at ?? a.created_at)}</div></span>
                <span className="flex items-center gap-2"><EstadoActa estado={a.estado} />{a.pdf_path && <Button size="icon" variant="ghost" onClick={() => descargar(a.id, a.numero)} aria-label="Descargar"><Download className="h-4 w-4" /></Button>}</span>
              </li>
            ))}
            {!historial.length && <li className="px-5 py-6 text-sm text-muted-foreground">Sin actas.</li>}
          </ul>
        </section>
      </div>
      <Dialog open={!!actaAbierta} onOpenChange={(o) => !o && setAbierta(null)}>
        <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>Firmar acta</DialogTitle></DialogHeader>
          {actaAbierta && <FirmaPortal acta={actaAbierta} emp={emp} onDone={() => setAbierta(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type ActaP = { id: string; numero: number; tipo: string; created_at: string; observaciones: string | null; tecnico_nombre: string | null; items: { equipo: { serie: string; modelo: string | null; tipo_id: string; marca_id: string | null } | null }[] };

function FirmaPortal({ acta, emp, onDone }: { acta: ActaP; emp: { nombre: string; identificacion: string; cargo: string | null; area_id: string | null; sede_id: string | null }; onDone: () => void }) {
  const cat = useCatalogos();
  const qc = useQueryClient();
  const fn = useServerFn(firmarComoEmpleado);
  const [firma, setFirma] = useState<string | null>(null);
  const [acepto, setAcepto] = useState(false);
  const [loading, setLoading] = useState(false);
  async function firmar() {
    if (!firma) return;
    setLoading(true);
    try { await fn({ data: { actaId: acta.id, firma } }); toast.success("Acta firmada"); qc.invalidateQueries({ queryKey: ["portal"] }); onDone(); }
    catch (e) { toast.error(errMsg(e)); } finally { setLoading(false); }
  }
  return (
    <div className="space-y-4">
      <ActaResumen a={{
        numero: acta.numero, tipo: acta.tipo, created_at: acta.created_at, observaciones: acta.observaciones, tecnico: acta.tecnico_nombre,
        empleado: { nombre: emp.nombre, identificacion: emp.identificacion, cargo: emp.cargo ?? "", area: cat.nombre(emp.area_id), sede: cat.nombre(emp.sede_id) },
        equipos: acta.items.filter((i) => i.equipo).map((i) => ({ serie: i.equipo!.serie, modelo: i.equipo!.modelo ?? "", tipo: cat.nombre(i.equipo!.tipo_id), marca: cat.nombre(i.equipo!.marca_id) })),
      }} />
      <SignaturePad onChange={setFirma} />
      <label className="flex items-start gap-3 text-sm">
        <Checkbox checked={acepto} onCheckedChange={(v) => setAcepto(v === true)} className="mt-0.5" />
        <span>Acepto firmar electrónicamente esta acta. Se registrará fecha, hora e IP.</span>
      </label>
      <Button className="w-full" disabled={!firma || !acepto || loading} onClick={firmar}>{loading ? "Firmando…" : "Firmar acta"}</Button>
    </div>
  );
}
