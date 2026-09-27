import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { errMsg } from "@/lib/constantes";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export function FinalizarReparacion({ id, empleado, size }: { id: string; empleado: string | null; size?: "sm" | "default" }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [devolver, setDevolver] = useState(!!empleado);
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  async function guardar() {
    if (!motivo.trim()) return toast.error("El motivo es obligatorio");
    setLoading(true);
    const { error } = await (supabase.rpc as unknown as (n: string, a: object) => Promise<{ error: unknown }>)("finalizar_reparacion", { p_equipo: id, p_devolver: devolver, p_motivo: motivo.trim() });
    setLoading(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Reparación finalizada"); setOpen(false); setMotivo("");
    qc.invalidateQueries({ queryKey: ["equipo", id] }); qc.invalidateQueries({ queryKey: ["equipos"] });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size={size}>Finalizar reparación</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Finalizar reparación</DialogTitle></DialogHeader>
        <div className="space-y-2 text-sm">
          <label className={`flex items-start gap-2 ${empleado ? "" : "opacity-50"}`}>
            <input type="radio" disabled={!empleado} checked={devolver} onChange={() => setDevolver(true)} className="mt-1" />
            <span>Devolver al empleado{empleado ? ` (${empleado})` : " — no tiene empleado ligado"}. Vuelve a quedar asignado.</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" checked={!devolver} onChange={() => setDevolver(false)} className="mt-1" />
            <span>Dejar disponible en el inventario (se desliga del empleado).</span>
          </label>
        </div>
        <div className="space-y-1"><Label>Motivo / diagnóstico *</Label><Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
        <DialogFooter><Button onClick={guardar} disabled={loading}>Confirmar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
