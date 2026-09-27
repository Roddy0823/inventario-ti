import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCatalogos } from "@/lib/catalogos";
import { useMe } from "@/lib/me";
import { CATALOGOS, errMsg } from "@/lib/constantes";
import { PageHeader } from "@/components/Estado";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Pencil, Trash2, Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/catalogos")({
  head: () => ({ meta: [{ title: "Catálogos — Finesa" }, { name: "description", content: "Listas maestras del sistema." }] }),
  component: Catalogos,
});

function Catalogos() {
  const { data: me } = useMe();
  if (!me?.isAdmin) return <p className="text-muted-foreground">Solo el Administrador puede gestionar catálogos.</p>;
  return (
    <div>
      <PageHeader title="Catálogos" desc="Listas cerradas para estandarizar el ingreso de datos. Los ítems en uso no se pueden eliminar; solo desactivar." />
      <Tabs defaultValue="marca">
        <TabsList className="flex-wrap">{CATALOGOS.map((c) => <TabsTrigger key={c.id} value={c.id}>{c.label}</TabsTrigger>)}</TabsList>
        {CATALOGOS.map((c) => <TabsContent key={c.id} value={c.id}><Lista tipo={c.id} /></TabsContent>)}
      </Tabs>
    </div>
  );
}

function Lista({ tipo }: { tipo: string }) {
  const qc = useQueryClient();
  const { byTipo } = useCatalogos();
  const items = byTipo(tipo, false);
  const [nuevo, setNuevo] = useState("");
  const [edit, setEdit] = useState<{ id: string; nombre: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["catalogos"] });

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    const nombre = nuevo.trim();
    if (!nombre) return;
    const { error } = await supabase.from("catalogo_items").insert({ tipo: tipo as never, nombre });
    if (error) return toast.error(error.code === "23505" ? "Ya existe ese nombre." : error.message);
    setNuevo(""); refresh();
  }
  async function guardar() {
    if (!edit?.nombre.trim()) return;
    const { error } = await supabase.from("catalogo_items").update({ nombre: edit.nombre.trim() }).eq("id", edit.id);
    if (error) return toast.error(errMsg(error));
    setEdit(null); refresh();
  }
  async function toggle(id: string, activo: boolean) {
    const { error } = await supabase.from("catalogo_items").update({ activo }).eq("id", id);
    if (error) return toast.error(errMsg(error));
    refresh();
  }
  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este ítem?")) return;
    const { error } = await supabase.from("catalogo_items").delete().eq("id", id);
    if (error) return toast.error(error.code === "23503" ? "Este ítem está en uso. Solo puede desactivarlo." : errMsg(error));
    refresh();
  }

  return (
    <div className="mt-4 max-w-2xl rounded-md border border-border bg-card">
      <form onSubmit={crear} className="flex gap-2 border-b border-border p-4">
        <Input placeholder="Nuevo ítem" value={nuevo} onChange={(e) => setNuevo(e.target.value)} maxLength={100} />
        <Button type="submit">Agregar</Button>
      </form>
      <ul className="divide-y divide-border">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
            {edit?.id === i.id ? (
              <>
                <Input value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} className="h-8" />
                <Button size="icon" variant="ghost" onClick={guardar} aria-label="Guardar"><Check className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => setEdit(null)} aria-label="Cancelar"><X className="h-4 w-4" /></Button>
              </>
            ) : (
              <>
                <span className={i.activo ? "flex-1" : "flex-1 text-muted-foreground line-through"}>{i.nombre}</span>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  {i.activo ? "Activo" : "Inactivo"}
                  <Switch checked={i.activo} onCheckedChange={(v) => toggle(i.id, v)} />
                </label>
                <Button size="icon" variant="ghost" onClick={() => setEdit({ id: i.id, nombre: i.nombre })} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => eliminar(i.id)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button>
              </>
            )}
          </li>
        ))}
        {!items.length && <li className="px-4 py-6 text-sm text-muted-foreground">Sin ítems todavía.</li>}
      </ul>
    </div>
  );
}
