import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "buscar_equipos",
  title: "Buscar equipos",
  description: "Busca equipos visibles para el usuario por serie, modelo, activo fijo o nombre, con filtro opcional de estado.",
  inputSchema: {
    texto: z.string().trim().max(100).optional().describe("Texto a buscar en serie, modelo, activo fijo o nombre de equipo."),
    estado: z.enum(["disponible", "asignado", "en_reparacion", "dado_de_baja"]).optional().describe("Estado del equipo."),
    limite: z.number().int().min(1).max(100).optional().describe("Máximo de resultados (por defecto 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ texto, estado, limite }, ctx) => {
    let q = supabaseForUser(ctx)
      .from("equipos")
      .select("id, serie, activo_fijo, modelo, nombre_equipo, estado, empleado:empleados(nombre)")
      .order("serie")
      .limit(limite ?? 25);
    if (estado) q = q.eq("estado", estado);
    if (texto) {
      const t = texto.replace(/[,()%]/g, " ");
      q = q.or(`serie.ilike.%${t}%,modelo.ilike.%${t}%,activo_fijo.ilike.%${t}%,nombre_equipo.ilike.%${t}%`);
    }
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const equipos = (data ?? []).map((e) => ({
      id: String(e.id),
      serie: String(e.serie),
      activo_fijo: e.activo_fijo ?? null,
      modelo: e.modelo ?? null,
      nombre_equipo: e.nombre_equipo ?? null,
      estado: String(e.estado),
      responsable: (e.empleado as { nombre?: string } | null)?.nombre ?? null,
    }));
    return {
      content: [{ type: "text", text: equipos.length ? JSON.stringify(equipos) : "Sin resultados." }],
      structuredContent: { equipos },
    };
  },
});
