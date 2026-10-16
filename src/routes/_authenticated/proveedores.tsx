import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { useCatalogos } from "@/lib/catalogos";
import { errMsg } from "@/lib/constantes";
import { PageHeader } from "@/components/Estado";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DataTablePagination, FilasSkeleton, usePaginacion } from "@/components/DataTablePagination";
import { toast } from "sonner";
import { Mail, MessageCircle, Pencil, Phone, Plus, Trash2, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/proveedores")({
  head: () => ({ meta: [{ title: "Proveedores — Finesa" }, { name: "description", content: "Directorio de proveedores del inventario." }] }),
  component: Proveedores,
});

type Prov = { id: string; nombre: string; nit: string | null; contacto_nombre: string | null; telefono: string; whatsapp: string | null; email: string | null; ciudad: string | null; notas: string | null };
const cop = (n: number | null | undefined) => (n == null ? "—" : `$${Number(n).toLocaleString("es-CO")}`);
const digitos = (s: string) => s.replace(/[^\d+]/g, "");
const wa = (s: string) => { const d = s.replace(/\D/g, ""); return d.length === 10 ? `57${d}` : d; };

function Proveedores() {
  const { data: me } = useMe();
  const [texto, setTexto] = useState("");
  const pag = usePaginacion(texto);
  const [editar, setEditar] = useState<Prov | "nuevo" | null>(null);
  const [ver, setVer] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["proveedores", texto, pag.desde, pag.tamano],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let s = supabase.from("proveedores").select("*, articulo_proveedores(count), equipos(count)", { count: "exact" });
      const t = texto.trim().replace(/[,()]/g, " ");
      if (t) s = s.or(`nombre.ilike.%${t}%,nit.ilike.%${t}%,ciudad.ilike.%${t}%`);
      const { data, count, error } = await s.order("nombre").range(pag.desde, pag.hasta);
      if (error) throw error;
      return { filas: data ?? [], total: count ?? 0 };
    },
  });
  if (!me?.isStaff) return <p className="text-muted-foreground">Sin acceso.</p>;
  const cnt = (v: unknown) => (Array.isArray(v) ? Number((v[0] as { count?: number })?.count ?? 0) : 0);

  async function exportar() {
    const { data } = await supabase.from("proveedores").select("*").order("nombre");
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet((data ?? []).map((p) => ({ Nombre: p.nombre, NIT: p.nit ?? "", Contacto: p.contacto_nombre ?? "", Teléfono: p.telefono, WhatsApp: p.whatsapp ?? "", Correo: p.email ?? "", Ciudad: p.ciudad ?? "", Notas: p.notas ?? "" })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Proveedores"); XLSX.writeFile(wb, "proveedores.xlsx");
  }

  return (
    <div>
      <PageHeader title="Proveedores" desc="Directorio de proveedores, artículos que surten y equipos comprados.">
        <Button variant="outline" onClick={exportar}><Download className="mr-1 h-4 w-4" />Excel</Button>
        <Button onClick={() => setEditar("nuevo")}><Plus className="mr-1 h-4 w-4" />Nuevo proveedor</Button>
      </PageHeader>
      <Input placeholder="Buscar por nombre, NIT o ciudad" className="mb-4 w-full sm:w-80" value={texto} onChange={(e) => setTexto(e.target.value)} />
      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">Nombre</th><th className="px-4 py-2">NIT</th><th className="px-4 py-2">Contacto</th><th className="px-4 py-2">Teléfono</th><th className="px-4 py-2">Ciudad</th><th className="px-4 py-2 text-right">Tipos</th><th className="px-4 py-2 text-right">Equipos</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {q.isLoading && <FilasSkeleton columnas={8} />}
            {(q.data?.filas ?? []).map((p) => (
              <tr key={p.id} className="hover:bg-muted/50">
                <td className="px-4 py-2.5"><button className="font-medium text-primary hover:underline" onClick={() => setVer(p.id)}>{p.nombre}</button></td>
                <td className="px-4 py-2.5">{p.nit ?? "—"}</td>
                <td className="px-4 py-2.5">{p.contacto_nombre ?? "—"}</td>
                <td className="px-4 py-2.5">{p.telefono}</td>
                <td className="px-4 py-2.5">{p.ciudad ?? "—"}</td>
                <td className="px-4 py-2.5 text-right">{cnt(p.articulo_proveedores)}</td>
                <td className="px-4 py-2.5 text-right">{cnt(p.equipos)}</td>
                <td className="px-4 py-2.5 text-right"><Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setEditar(p as Prov)}><Pencil className="h-4 w-4" /></Button></td>
              </tr>
            ))}
            {!q.isLoading && !q.data?.filas.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No hay proveedores registrados.</td></tr>}
          </tbody>
        </table>
      </div>
      <DataTablePagination total={q.data?.total ?? 0} pagina={pag.pagina} tamano={pag.tamano} onPagina={pag.setPagina} onTamano={pag.setTamano} />
      {editar && <FormProveedor p={editar === "nuevo" ? null : editar} onClose={() => setEditar(null)} />}
      <DetalleProveedor id={ver} onClose={() => setVer(null)} />
    </div>
  );
}

function FormProveedor({ p, onClose }: { p: Prov | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ nombre: p?.nombre ?? "", nit: p?.nit ?? "", contacto_nombre: p?.contacto_nombre ?? "", telefono: p?.telefono ?? "", whatsapp: p?.whatsapp ?? "", email: p?.email ?? "", ciudad: p?.ciudad ?? "", notas: p?.notas ?? "" });
  async function guardar() {
    if (!f.nombre.trim() || !f.telefono.trim()) return toast.error("Nombre y teléfono son obligatorios");
    const datos = { nombre: f.nombre.trim(), telefono: f.telefono.trim(), nit: f.nit.trim() || null, contacto_nombre: f.contacto_nombre.trim() || null, whatsapp: f.whatsapp.trim() || null, email: f.email.trim().toLowerCase() || null, ciudad: f.ciudad.trim() || null, notas: f.notas.trim() || null };
    const { error } = p ? await supabase.from("proveedores").update(datos).eq("id", p.id) : await supabase.from("proveedores").insert(datos);
    if (error) return toast.error(errMsg(error));
    toast.success(p ? "Proveedor actualizado" : "Proveedor creado");
    qc.invalidateQueries({ queryKey: ["proveedores"] }); qc.invalidateQueries({ queryKey: ["proveedor"] }); onClose();
  }
  async function eliminar() {
    if (!p || !confirm(`¿Eliminar el proveedor ${p.nombre}? Se quitarán sus vínculos con artículos.`)) return;
    const { error } = await supabase.from("proveedores").delete().eq("id", p.id);
    if (error) return toast.error(errMsg(error));
    toast.success("Proveedor eliminado"); qc.invalidateQueries({ queryKey: ["proveedores"] }); onClose();
  }
  const campo = (k: keyof typeof f, label: string, type = "text") => (
    <div className="space-y-1"><Label>{label}</Label><Input type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{p ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {campo("nombre", "Nombre *")}{campo("nit", "NIT")}{campo("contacto_nombre", "Contacto")}{campo("telefono", "Teléfono *")}
          {campo("whatsapp", "WhatsApp")}{campo("email", "Correo", "email")}{campo("ciudad", "Ciudad")}
          <div className="space-y-1 sm:col-span-2"><Label>Notas</Label><Textarea rows={2} value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} /></div>
        </div>
        <DialogFooter className="gap-2">
          {p && <Button variant="outline" className="text-destructive" onClick={eliminar}><Trash2 className="mr-1 h-4 w-4" />Eliminar</Button>}
          <Button onClick={guardar}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetalleProveedor({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const cat = useCatalogos();
  const q = useQuery({
    queryKey: ["proveedor", id], enabled: !!id,
    queryFn: async () => {
      const [p, vin, eqs] = await Promise.all([
        supabase.from("proveedores").select("*").eq("id", id!).single(),
        supabase.from("articulo_proveedores").select("*").eq("proveedor_id", id!),
        supabase.from("equipos").select("id, serie, tipo_id, modelo, valor_compra, estado").eq("proveedor_id", id!).order("created_at", { ascending: false }).limit(500),
      ]);
      if (p.error) throw p.error;
      return { p: p.data as Prov, vinculos: vin.data ?? [], equipos: eqs.data ?? [] };
    },
  });
  const [n, setN] = useState({ tipo_id: "", precio: "", dias: "", principal: false });
  const refrescar = () => { qc.invalidateQueries({ queryKey: ["proveedor", id] }); qc.invalidateQueries({ queryKey: ["proveedores"] }); qc.invalidateQueries({ queryKey: ["proveedores_articulo"] }); };
  async function vincular() {
    if (!n.tipo_id || !id) return toast.error("Seleccione un tipo de equipo");
    const { error } = await supabase.from("articulo_proveedores").insert({ tipo_id: n.tipo_id, proveedor_id: id, es_principal: n.principal, precio_referencia: n.precio ? Number(n.precio) : null, tiempo_entrega_dias: n.dias ? Number(n.dias) : null });
    if (error) return toast.error(error.code === "23505" ? "Ya está vinculado a ese tipo." : errMsg(error));
    setN({ tipo_id: "", precio: "", dias: "", principal: false }); refrescar();
  }
  async function quitar(vid: string) {
    const { error } = await supabase.from("articulo_proveedores").delete().eq("id", vid);
    if (error) toast.error(errMsg(error)); else refrescar();
  }
  const d = q.data;
  const total = (d?.equipos ?? []).reduce((a, e) => a + Number(e.valor_compra ?? 0), 0);
  const ya = new Set((d?.vinculos ?? []).map((v) => v.tipo_id));
  const sel = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm";
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader><SheetTitle>{d?.p.nombre ?? "Proveedor"}</SheetTitle></SheetHeader>
        {d && (
          <div className="mt-4 space-y-6 text-sm">
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <div className="text-muted-foreground">{[d.p.nit && `NIT ${d.p.nit}`, d.p.contacto_nombre, d.p.ciudad, d.p.email].filter(Boolean).join(" · ") || "Sin datos adicionales"}</div>
              {d.p.notas && <p className="mt-1">{d.p.notas}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild><a href={`tel:${digitos(d.p.telefono)}`}><Phone className="mr-1 h-3.5 w-3.5" />Llamar</a></Button>
                <Button size="sm" variant="outline" asChild><a href={`https://wa.me/${wa(d.p.whatsapp || d.p.telefono)}?text=${encodeURIComponent("Hola, somos Finesa. Quisiéramos solicitar una cotización. Gracias.")}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 h-3.5 w-3.5" />WhatsApp</a></Button>
                {d.p.email && <Button size="sm" variant="outline" asChild><a href={`mailto:${d.p.email}?subject=${encodeURIComponent("Cotización Finesa")}`}><Mail className="mr-1 h-3.5 w-3.5" />Correo</a></Button>}
              </div>
            </div>
            <section>
              <h3 className="mb-2 font-medium">Tipos de equipo que surte</h3>
              <ul className="space-y-1.5">
                {d.vinculos.map((v) => (
                  <li key={v.id} className="flex items-center justify-between rounded border border-border px-3 py-2">
                    <span>{cat.nombre(v.tipo_id)}{v.es_principal && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">Principal</span>}<span className="ml-2 text-xs text-muted-foreground">{[v.precio_referencia != null ? cop(v.precio_referencia) : null, v.tiempo_entrega_dias != null ? `${v.tiempo_entrega_dias} días` : null].filter(Boolean).join(" · ")}</span></span>
                    <Button size="icon" variant="ghost" aria-label="Quitar" onClick={() => quitar(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </li>
                ))}
                {!d.vinculos.length && <li className="text-muted-foreground">Sin tipos vinculados.</li>}
              </ul>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-md border border-border p-3">
                <div className="col-span-2 space-y-1"><Label>Vincular tipo de equipo</Label>
                  <select className={sel} value={n.tipo_id} onChange={(e) => setN({ ...n, tipo_id: e.target.value })}><option value="">—</option>{cat.byTipo("tipo_equipo").filter((c) => !ya.has(c.id)).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
                </div>
                <div className="space-y-1"><Label>Precio referencia</Label><Input type="number" min={0} value={n.precio} onChange={(e) => setN({ ...n, precio: e.target.value })} /></div>
                <div className="space-y-1"><Label>Días de entrega</Label><Input type="number" min={0} value={n.dias} onChange={(e) => setN({ ...n, dias: e.target.value })} /></div>
                <label className="flex items-center gap-2"><Switch checked={n.principal} onCheckedChange={(c) => setN({ ...n, principal: c })} />Principal</label>
                <Button onClick={vincular}>Vincular</Button>
              </div>
            </section>
            <section>
              <h3 className="mb-2 font-medium">Equipos comprados ({d.equipos.length}) · Total {cop(total)}</h3>
              <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded border border-border">
                {d.equipos.map((e) => (
                  <li key={e.id} className="flex justify-between px-3 py-2">
                    <Link to="/equipos/$id" params={{ id: e.id }} className="font-mono text-xs text-primary hover:underline">{e.serie}</Link>
                    <span className="text-xs text-muted-foreground">{cat.nombre(e.tipo_id)} {e.modelo ?? ""} · {cop(e.valor_compra)}</span>
                  </li>
                ))}
                {!d.equipos.length && <li className="px-3 py-3 text-muted-foreground">Ningún equipo tiene este proveedor asignado.</li>}
              </ul>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
