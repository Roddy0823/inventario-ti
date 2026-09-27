import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { TIPO_ACTA, ESTADO_ACTA, fmtFecha } from "@/lib/constantes";
import { urlArchivo } from "@/lib/firmas.functions";
import { descargarPdfActa } from "@/lib/descargarPdf";
import { PageHeader, EstadoActa } from "@/components/Estado";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/actas/")({
  validateSearch: z.object({ estado: z.string().optional() }),
  head: () => ({ meta: [{ title: "Repositorio de actas — Finesa" }, { name: "description", content: "Listado centralizado de actas." }] }),
  component: Repositorio,
});

function Repositorio() {
  const search = Route.useSearch();
  const { data: me } = useMe();
  const url = useServerFn(urlArchivo);
  const [f, setF] = useState({ desde: "", hasta: "", empleado: "", tipo: "", estado: search.estado ?? "" });
  const q = useQuery({
    queryKey: ["actas", f],
    queryFn: async () => {
      let s = supabase.from("actas").select("*, empleado:empleados(nombre, identificacion)").order("created_at", { ascending: false }).limit(500);
      if (f.desde) s = s.gte("created_at", f.desde);
      if (f.hasta) s = s.lte("created_at", f.hasta + "T23:59:59");
      if (f.tipo) s = s.eq("tipo", f.tipo as "entrega");
      if (f.estado) s = s.eq("estado", f.estado as "pendiente");
      const { data, error } = await s;
      if (error) throw error;
      const t = f.empleado.toLowerCase();
      return (data ?? []).filter((a) => { const e = a.empleado as { nombre: string; identificacion: string } | null; return !t || (e && (e.nombre.toLowerCase().includes(t) || e.identificacion.includes(t))); });
    },
  });
  async function descargar(id: string, numero: number) {
    await descargarPdfActa(url, id, `acta-${numero}.pdf`);
  }
  const s = "h-9 rounded-md border border-input bg-card px-3 text-sm";
  const puedeVer = me?.can("repositorio_ver");
  return (
    <div>
      <PageHeader title="Repositorio de actas" desc="Filtre, consulte y descargue cualquier acta." />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder="Empleado o identificación" className="w-full sm:w-64" value={f.empleado} onChange={(e) => setF({ ...f, empleado: e.target.value })} />
        <Input type="date" className="w-auto" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} aria-label="Desde" />
        <Input type="date" className="w-auto" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} aria-label="Hasta" />
        <select className={s} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}><option value="">Tipo</option>{Object.entries(TIPO_ACTA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className={s} value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}><option value="">Estado</option>{Object.entries(ESTADO_ACTA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
      </div>
      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">No.</th><th className="px-4 py-2">Tipo</th><th className="px-4 py-2">Empleado</th><th className="px-4 py-2">Creada</th><th className="px-4 py-2">Firmada</th><th className="px-4 py-2">Estado</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(q.data ?? []).map((a) => (
              <tr key={a.id} className="hover:bg-muted/50">
                <td className="px-4 py-2.5"><Link to="/actas/$id" params={{ id: a.id }} className="font-mono text-xs font-medium text-primary hover:underline">#{a.numero}</Link></td>
                <td className="px-4 py-2.5">{TIPO_ACTA[a.tipo]}</td>
                <td className="px-4 py-2.5">{(a.empleado as { nombre: string } | null)?.nombre}</td>
                <td className="px-4 py-2.5 text-xs">{fmtFecha(a.created_at)}</td>
                <td className="px-4 py-2.5 text-xs">{fmtFecha(a.firmado_at, true)}</td>
                <td className="px-4 py-2.5"><EstadoActa estado={a.estado} /></td>
                <td className="px-4 py-2.5 text-right">{a.pdf_path && puedeVer && <Button size="icon" variant="ghost" onClick={() => descargar(a.id, a.numero)} aria-label="Descargar PDF"><Download className="h-4 w-4" /></Button>}</td>
              </tr>
            ))}
            {!q.isLoading && !q.data?.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No hay actas.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
