import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_actas",
  title: "Listar actas",
  description: "Lista las actas de entrega o devolución visibles para el usuario, más recientes primero.",
  inputSchema: {
    estado: z.enum(["pendiente", "firmada", "anulada"]).optional().describe("Estado del acta."),
    limite: z.number().int().min(1).max(100).optional().describe("Máximo de resultados (por defecto 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ estado, limite }, ctx) => {
    let q = supabaseForUser(ctx)
      .from("actas")
      .select("id, numero, tipo, estado, created_at, firmado_at, empleado:empleados(nombre)")
      .order("created_at", { ascending: false })
      .limit(limite ?? 25);
    if (estado) q = q.eq("estado", estado);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const actas = (data ?? []).map((a) => ({
      id: String(a.id),
      numero: Number(a.numero),
      tipo: String(a.tipo),
      estado: String(a.estado),
      creada: String(a.created_at),
      firmada: a.firmado_at ?? null,
      empleado: (a.empleado as { nombre?: string } | null)?.nombre ?? null,
    }));
    return {
      content: [{ type: "text", text: actas.length ? JSON.stringify(actas) : "Sin actas." }],
      structuredContent: { actas },
    };
  },
});
