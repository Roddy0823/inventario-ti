import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { useCatalogos } from "@/lib/catalogos";
import { errMsg } from "@/lib/constantes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { AlertTriangle, Bell, Mail, MessageCircle, Phone, Trash2 } from "lucide-react";

export type StockBajo = { tipo_id: string; tipo: string; disponibles: number; stock_minimo: number };

export function useStockBajo() {
  const { data: me } = useMe();
  return useQuery({
    queryKey: ["equipos", "stock_bajo"],
    enabled: !!me?.isStaff,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("stock_bajo");
      if (error) throw error;
      return ((data ?? []) as StockBajo[]).map((r) => ({ ...r, disponibles: Number(r.disponibles) }));
    },
  });
}

const sel = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm";

/** Campana con contador; abre el panel de proveedores del artículo elegido. */
export function CampanaAlertas() {
  const q = useStockBajo();
  const [tipo, setTipo] = useState<string | null>(null);
  const n = q.data?.length ?? 0;
  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button className="relative rounded p-1.5 hover:bg-sidebar-accent" aria-label={`Alertas de stock: ${n}`}>
            <Bell className="h-4 w-4" />
            {n > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{n}</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <div className="border-b border-border px-4 py-2 text-sm font-medium">Stock bajo</div>
          {n === 0 ? <p className="px-4 py-4 text-sm text-muted-foreground">Sin alertas activas.</p> : (
            <ul className="max-h-72 divide-y divide-border overflow-y-auto">
              {q.data!.map((a) => (
                <li key={a.tipo_id}><button className="flex w-full justify-between px-4 py-2 text-left text-sm hover:bg-muted" onClick={() => setTipo(a.tipo_id)}>
                  <span>{a.tipo}</span><span className="text-destructive">{a.disponibles} / mín. {a.stock_minimo}</span>
                </button></li>
              ))}
            </ul>
          )}
          <Link to="/equipos" className="block border-t border-border px-4 py-2 text-xs text-primary hover:underline">Ir al inventario</Link>
        </PopoverContent>
      </Popover>
      <ProveedoresSheet tipoId={tipo} onClose={() => setTipo(null)} />
    </>
  );
}

/** Aviso destacado para Panel e Inventario. */
export function BannerStock() {
  const { data: me } = useMe();
  const q = useStockBajo();
  const [config, setConfig] = useState(false);
  const [tipo, setTipo] = useState<string | null>(null);
  if (!me?.isStaff) return null;
  const lista = q.data ?? [];
  return (
    <>
      {lista.length > 0 ? (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <div className="font-medium">{lista.length} artículo(s) con stock bajo</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {lista.map((a) => (
                    <button key={a.tipo_id} onClick={() => setTipo(a.tipo_id)} className="rounded-full border border-destructive/40 bg-card px-2.5 py-0.5 text-xs hover:bg-muted">
                      {a.tipo}: {a.disponibles} disp. (mín. {a.stock_minimo})
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfig(true)}>Configurar alertas</Button>
              <Button size="sm" onClick={() => setTipo(lista[0]!.tipo_id)}>Ver proveedores / Reabastecer</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-4 flex justify-end"><Button size="sm" variant="ghost" onClick={() => setConfig(true)}><Bell className="mr-1 h-4 w-4" />Configurar alertas de stock</Button></div>
      )}
      <ConfigAlertas open={config} onClose={() => setConfig(false)} onProveedores={(t) => { setConfig(false); setTipo(t); }} />
      <ProveedoresSheet tipoId={tipo} onClose={() => setTipo(null)} />
    </>
  );
}

function ConfigAlertas({ open, onClose, onProveedores }: { open: boolean; onClose: () => void; onProveedores: (tipo: string) => void }) {
  const cat = useCatalogos();
  const qc = useQueryClient();
  const [nuevo, setNuevo] = useState({ tipo_id: "", min: "3" });
  const q = useQuery({
    queryKey: ["alertas_config"], enabled: open,
    queryFn: async () => (await supabase.from("alertas_stock_config").select("*").order("created_at")).data ?? [],
  });
  const refrescar = () => { qc.invalidateQueries({ queryKey: ["alertas_config"] }); qc.invalidateQueries({ queryKey: ["equipos", "stock_bajo"] }); };
  async function agregar() {
    const min = Number(nuevo.min);
    if (!nuevo.tipo_id || !Number.isInteger(min) || min < 0) return toast.error("Seleccione el artículo y un mínimo válido");
    const { error } = await supabase.from("alertas_stock_config").insert({ tipo_id: nuevo.tipo_id, stock_minimo: min });
    if (error) return toast.error(error.code === "23505" ? "Ese artículo ya tiene una alerta." : errMsg(error));
    setNuevo({ tipo_id: "", min: "3" }); refrescar(); toast.success("Alerta creada");
  }
  async function actualizar(id: string, v: { stock_minimo?: number; activa?: boolean }) {
    const { error } = await supabase.from("alertas_stock_config").update(v).eq("id", id);
    if (error) toast.error(errMsg(error)); else refrescar();
  }
  async function eliminar(id: string) {
    const { error } = await supabase.from("alertas_stock_config").delete().eq("id", id);
    if (error) toast.error(errMsg(error)); else refrescar();
  }
  const usados = new Set((q.data ?? []).map((a) => a.tipo_id));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Alertas de stock</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">La alerta se activa cuando los equipos disponibles de ese tipo son iguales o menores al mínimo.</p>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5"><Label>Artículo</Label>
            <select className={sel} value={nuevo.tipo_id} onChange={(e) => setNuevo({ ...nuevo, tipo_id: e.target.value })}>
              <option value="">Seleccione…</option>
              {cat.byTipo("tipo_equipo").filter((c) => !usados.has(c.id)).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="w-24 space-y-1.5"><Label>Mínimo</Label><Input type="number" min={0} value={nuevo.min} onChange={(e) => setNuevo({ ...nuevo, min: e.target.value })} /></div>
          <Button onClick={agregar}>Agregar</Button>
        </div>
        <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border">
          {(q.data ?? []).map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <button className="flex-1 text-left text-primary hover:underline" onClick={() => onProveedores(a.tipo_id)}>{cat.nombre(a.tipo_id)}</button>
              <Input type="number" min={0} className="h-8 w-20" defaultValue={a.stock_minimo} aria-label="Mínimo"
                onBlur={(e) => { const v = Number(e.target.value); if (Number.isInteger(v) && v >= 0 && v !== a.stock_minimo) actualizar(a.id, { stock_minimo: v }); }} />
              <Switch checked={a.activa} onCheckedChange={(c) => actualizar(a.id, { activa: c })} aria-label="Activa" />
              <Button size="icon" variant="ghost" onClick={() => eliminar(a.id)} aria-label="Eliminar alerta"><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </li>
          ))}
          {q.data && !q.data.length && <li className="px-3 py-4 text-sm text-muted-foreground">Aún no hay alertas configuradas.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

const soloDigitos = (s: string) => s.replace(/\D/g, "");
const waNum = (s: string) => { const d = soloDigitos(s); return d.length === 10 ? `57${d}` : d; };

export function ProveedoresSheet({ tipoId, onClose }: { tipoId: string | null; onClose: () => void }) {
  const cat = useCatalogos();
  const qc = useQueryClient();
  const stock = useStockBajo();
  const nombre = tipoId ? cat.nombre(tipoId) : "";
  const q = useQuery({
    queryKey: ["proveedores_articulo", tipoId], enabled: !!tipoId,
    queryFn: async () => {
      const [vin, todos, disp, cfg] = await Promise.all([
        supabase.from("articulo_proveedores").select("*, proveedor:proveedores(*)").eq("tipo_id", tipoId!).order("es_principal", { ascending: false }),
        supabase.from("proveedores").select("id, nombre").order("nombre"),
        supabase.from("equipos").select("id", { count: "exact", head: true }).eq("tipo_id", tipoId!).eq("estado", "disponible"),
        supabase.from("alertas_stock_config").select("stock_minimo, activa").eq("tipo_id", tipoId!).maybeSingle(),
      ]);
      return { vinculos: vin.data ?? [], todos: todos.data ?? [], disponibles: disp.count ?? 0, minimo: cfg.data?.stock_minimo ?? null };
    },
  });
  const vacio = { existente: "", nombre: "", nit: "", contacto_nombre: "", telefono: "", whatsapp: "", email: "", ciudad: "", notas: "", precio: "", dias: "", principal: false };
  const [f, setF] = useState(vacio);
  const [guardando, setGuardando] = useState(false);
  const refrescar = () => qc.invalidateQueries({ queryKey: ["proveedores_articulo"] });

  async function vincular(e: React.FormEvent) {
    e.preventDefault();
    if (!tipoId) return;
    setGuardando(true);
    try {
      let proveedor_id = f.existente;
      if (!proveedor_id) {
        if (!f.nombre.trim() || !f.telefono.trim()) throw new Error("Nombre y teléfono son obligatorios");
        const { data, error } = await supabase.from("proveedores").insert({
          nombre: f.nombre.trim(), telefono: f.telefono.trim(), nit: f.nit || null, contacto_nombre: f.contacto_nombre || null,
          whatsapp: f.whatsapp || null, email: f.email.trim().toLowerCase() || null, ciudad: f.ciudad || null, notas: f.notas || null,
        }).select("id").single();
        if (error) throw error;
        proveedor_id = data.id;
      }
      const { error } = await supabase.from("articulo_proveedores").insert({
        tipo_id: tipoId, proveedor_id, es_principal: f.principal,
        precio_referencia: f.precio ? Number(f.precio) : null, tiempo_entrega_dias: f.dias ? Number(f.dias) : null,
      });
      if (error) throw error.code === "23505" ? new Error("Ese proveedor ya está vinculado a este artículo.") : error;
      toast.success("Proveedor vinculado"); setF(vacio); refrescar();
    } catch (err) { toast.error(errMsg(err)); } finally { setGuardando(false); }
  }
  async function desvincular(id: string) {
    const { error } = await supabase.from("articulo_proveedores").delete().eq("id", id);
    if (error) toast.error(errMsg(error)); else refrescar();
  }

  const d = q.data;
  const bajo = stock.data?.some((s) => s.tipo_id === tipoId);
  const vinculados = new Set((d?.vinculos ?? []).map((v) => v.proveedor_id));
  return (
    <Sheet open={!!tipoId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>Proveedores · {nombre}</SheetTitle></SheetHeader>
        <div className={`mt-4 rounded-md border p-3 text-sm ${bajo ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/40"}`}>
          {d ? <><b>{nombre}:</b> {d.disponibles} disponible(s) — {d.minimo !== null ? `Mínimo configurado: ${d.minimo}` : "Sin alerta configurada"}</> : "Cargando…"}
        </div>
        <h3 className="mt-5 text-sm font-medium">Proveedores asociados</h3>
        <ul className="mt-2 space-y-2">
          {(d?.vinculos ?? []).map((v) => {
            const p = v.proveedor as { nombre: string; telefono: string; whatsapp: string | null; email: string | null; contacto_nombre: string | null; ciudad: string | null } | null;
            if (!p) return null;
            const msg = encodeURIComponent(`Hola${p.contacto_nombre ? ` ${p.contacto_nombre}` : ""}, somos Finesa. Quisiéramos solicitar una cotización de ${nombre}. Gracias.`);
            return (
              <li key={v.id} className="rounded-md border border-border bg-card p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{p.nombre}{v.es_principal && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">Principal</span>}</div>
                    <div className="text-xs text-muted-foreground">{[p.contacto_nombre, p.ciudad, v.precio_referencia != null ? `$${Number(v.precio_referencia).toLocaleString("es-CO")}` : null, v.tiempo_entrega_dias != null ? `${v.tiempo_entrega_dias} días` : null].filter(Boolean).join(" · ")}</div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => desvincular(v.id)} aria-label="Desvincular"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" asChild><a href={`tel:${soloDigitos(p.telefono)}`}><Phone className="mr-1 h-3.5 w-3.5" />Llamar</a></Button>
                  <Button size="sm" variant="outline" asChild><a href={`https://wa.me/${waNum(p.whatsapp || p.telefono)}?text=${msg}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 h-3.5 w-3.5" />WhatsApp</a></Button>
                  {p.email && <Button size="sm" variant="outline" asChild><a href={`mailto:${p.email}?subject=${encodeURIComponent(`Cotización ${nombre}`)}&body=${msg}`}><Mail className="mr-1 h-3.5 w-3.5" />Correo</a></Button>}
                </div>
              </li>
            );
          })}
          {d && !d.vinculos.length && <li className="text-sm text-muted-foreground">Aún no hay proveedores para este artículo.</li>}
        </ul>
        <form onSubmit={vincular} className="mt-6 space-y-3 rounded-md border border-border p-3">
          <h3 className="text-sm font-medium">Agregar proveedor</h3>
          <div className="space-y-1.5"><Label>Proveedor existente</Label>
            <select className={sel} value={f.existente} onChange={(e) => setF({ ...f, existente: e.target.value })}>
              <option value="">— Registrar uno nuevo —</option>
              {(d?.todos ?? []).filter((p) => !vinculados.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          {!f.existente && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1"><Label>Nombre *</Label><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></div>
              <div className="space-y-1"><Label>NIT</Label><Input value={f.nit} onChange={(e) => setF({ ...f, nit: e.target.value })} /></div>
              <div className="space-y-1"><Label>Contacto</Label><Input value={f.contacto_nombre} onChange={(e) => setF({ ...f, contacto_nombre: e.target.value })} /></div>
              <div className="space-y-1"><Label>Teléfono *</Label><Input value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} /></div>
              <div className="space-y-1"><Label>WhatsApp</Label><Input value={f.whatsapp} placeholder="Igual al teléfono si se deja vacío" onChange={(e) => setF({ ...f, whatsapp: e.target.value })} /></div>
              <div className="space-y-1"><Label>Correo</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
              <div className="space-y-1"><Label>Ciudad</Label><Input value={f.ciudad} onChange={(e) => setF({ ...f, ciudad: e.target.value })} /></div>
              <div className="space-y-1 sm:col-span-2"><Label>Notas</Label><Textarea rows={2} value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} /></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Precio de referencia</Label><Input type="number" min={0} value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })} /></div>
            <div className="space-y-1"><Label>Días de entrega</Label><Input type="number" min={0} value={f.dias} onChange={(e) => setF({ ...f, dias: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={f.principal} onCheckedChange={(c) => setF({ ...f, principal: c })} />Proveedor principal</label>
          <Button type="submit" disabled={guardando} className="w-full">{f.existente ? "Vincular proveedor" : "Registrar y vincular"}</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
