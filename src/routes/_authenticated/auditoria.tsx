import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { PageHeader } from "@/components/Estado";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { descargarCSV, fmtFecha } from "@/lib/constantes";

export const Route = createFileRoute("/_authenticated/auditoria")({
  head: () => ({ meta: [{ title: "Auditoría — Finesa" }, { name: "description", content: "Registro inalterable de acciones." }] }),
  component: Auditoria,
});

const TABLAS: Record<string, string> = {
  equipos: "Equipos", empleados: "Empleados", actas: "Actas", acta_items: "Ítems de acta", catalogo_items: "Catálogos",
  profiles: "Perfiles", user_roles: "Roles", user_permisos: "Permisos", tokens_firma: "Enlaces de firma", usuarios: "Usuarios", sesion: "Sesión",
};

function Auditoria() {
  const { data: me } = useMe();
  const [tabla, setTabla] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [abierto, setAbierto] = useState<number | null>(null);
  const q = useQuery({
    queryKey: ["auditoria", tabla, desde, hasta],
    enabled: !!me?.isAdmin,
    queryFn: async () => {
      let s = supabase.from("auditoria").select("*").order("created_at", { ascending: false }).limit(500);
      if (tabla) s = s.eq("tabla", tabla);
      if (desde) s = s.gte("created_at", desde);
      if (hasta) s = s.lte("created_at", hasta + "T23:59:59");
      const [{ data }, { data: perfiles }] = await Promise.all([s, supabase.from("profiles").select("id, nombre, email")]);
      const nom = (id: string | null) => { const p = perfiles?.find((x) => x.id === id); return p ? p.nombre || p.email : id ? "—" : "Sistema / firmante externo"; };
      return (data ?? []).map((r) => ({ ...r, usuario: nom(r.user_id) }));
    },
  });
  if (!me?.isAdmin) return <p className="text-muted-foreground">Solo el Administrador puede ver la auditoría.</p>;
  const filas = q.data ?? [];
  return (
    <div>
      <PageHeader title="Auditoría" desc="Registro automático e inalterable de quién creó, editó, anuló o eliminó cada registro (últimos 500).">
        <Button variant="outline" onClick={() => descargarCSV("auditoria.csv", filas.map((r) => ({ fecha: r.created_at, usuario: r.usuario, modulo: r.tabla, accion: r.accion, registro: r.registro_id, detalle: r.detalle ?? "" })))}>Exportar CSV</Button>
      </PageHeader>
      <div className="mb-4 flex flex-wrap gap-3">
        <select className="h-9 rounded-md border border-input bg-card px-3 text-sm" value={tabla} onChange={(e) => setTabla(e.target.value)}>
          <option value="">Todos los módulos</option>
          {Object.entries(TABLAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Input type="date" className="w-auto" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <Input type="date" className="w-auto" value={hasta} onChange={(e) => setHasta(e.target.value)} />
      </div>
      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Usuario</th><th className="px-4 py-2">Módulo</th><th className="px-4 py-2">Acción</th><th className="px-4 py-2">Detalle</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filas.map((r) => (
              <>
                <tr key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setAbierto(abierto === r.id ? null : r.id)}>
                  <td className="whitespace-nowrap px-4 py-2 text-xs">{fmtFecha(r.created_at, true)}</td>
                  <td className="px-4 py-2">{r.usuario}</td>
                  <td className="px-4 py-2">{TABLAS[r.tabla] ?? r.tabla}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.accion}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{r.detalle ?? (r.antes || r.despues ? "Ver cambios" : "")}</td>
                </tr>
                {abierto === r.id && (r.antes || r.despues) && (
                  <tr key={r.id + "-d"}><td colSpan={5} className="bg-muted/40 px-4 py-3">
                    <div className="grid gap-3 md:grid-cols-2 text-xs">
                      <pre className="overflow-auto rounded bg-card p-2">{r.antes ? JSON.stringify(r.antes, null, 1) : "—"}</pre>
                      <pre className="overflow-auto rounded bg-card p-2">{r.despues ? JSON.stringify(r.despues, null, 1) : "—"}</pre>
                    </div>
                  </td></tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
