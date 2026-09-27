export const PERMISOS = [
  { id: "equipos_editar", label: "Crear y editar equipos" },
  { id: "empleados_editar", label: "Crear y editar empleados (y habilitar su acceso)" },
  { id: "cargas_masivas", label: "Cargas masivas CSV" },
  { id: "actas_entrega", label: "Crear actas de entrega" },
  { id: "actas_devolucion", label: "Crear actas de devolución" },
  { id: "firmas_capturar", label: "Capturar firmas y generar enlaces" },
  { id: "repositorio_ver", label: "Ver repositorio de actas" },
  { id: "reportes_exportar", label: "Exportar reportes" },
] as const;
export type Permiso = (typeof PERMISOS)[number]["id"];

export const CATALOGOS = [
  { id: "marca", label: "Marcas" },
  { id: "tipo_equipo", label: "Tipos de equipo" },
  { id: "sede", label: "Sedes" },
  { id: "area", label: "Áreas" },
  { id: "empresa", label: "Empresas" },
] as const;
export type CatalogoTipo = (typeof CATALOGOS)[number]["id"];

export const ESTADO_EQUIPO: Record<string, { label: string; cls: string }> = {
  disponible: { label: "Disponible", cls: "bg-success/15 text-success border-success/30" },
  asignado: { label: "Asignado", cls: "bg-primary/10 text-primary border-primary/30" },
  en_reparacion: { label: "En reparación", cls: "bg-warning/20 text-warning-foreground border-warning/40" },
  de_baja: { label: "De baja", cls: "bg-muted text-muted-foreground border-border" },
};

export const ESTADO_ACTA: Record<string, { label: string; cls: string }> = {
  pendiente: { label: "Pendiente de firma", cls: "bg-warning/20 text-warning-foreground border-warning/40" },
  firmada: { label: "Firmada", cls: "bg-success/15 text-success border-success/30" },
  anulada: { label: "Anulada", cls: "bg-destructive/10 text-destructive border-destructive/30" },
};

export const TIPO_ACTA: Record<string, string> = { entrega: "Entrega", devolucion: "Devolución" };

export function fmtFecha(d?: string | null, hora = false) {
  if (!d) return "—";
  const date = new Date(d.length === 10 ? d + "T12:00:00" : d);
  return date.toLocaleString("es-CO", hora
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" });
}

export function descargarCSV(nombre: string, filas: Record<string, unknown>[]) {
  if (!filas.length) return;
  const cols = Object.keys(filas[0]!);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "\uFEFF" + [cols.join(";"), ...filas.map((f) => cols.map((c) => esc(f[c])).join(";"))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = nombre; a.click();
  URL.revokeObjectURL(url);
}

export function errMsg(e: unknown) {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  return m.replace(/^PAZ_Y_SALVO:\s*/, "");
}
